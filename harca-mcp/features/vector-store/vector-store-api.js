/**
 * HARCA ベクトルストアAPI
 * 
 * 埋め込みキャッシュとベクトル検索機能を提供するHTTP APIサーバー
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { EmbeddingCache } = require('./embedding-cache');
const { VectorStore } = require('./vector-store');

/**
 * ベクトルストアAPIサーバークラス
 */
class VectorStoreAPI {
  /**
   * ベクトルストアAPIサーバーを初期化
   * @param {Object} options - 設定オプション
   * @param {number} options.port - サーバーポート番号
   * @param {string} options.redisUrl - Redis接続URL
   * @param {boolean} options.enableCompression - 圧縮を有効にするかどうか
   * @param {number} options.compressionLevel - 圧縮レベル（1-9）
   * @param {number} options.compressionThreshold - 圧縮閾値（バイト）
   */
  constructor(options = {}) {
    this.port = options.port || process.env.VECTOR_STORE_API_PORT || 3701;
    this.app = express();
    this.setupMiddleware();
    
    // キャッシュとベクトルストアの初期化
    this.cache = new EmbeddingCache({
      redisUrl: options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      cacheTTL: options.cacheTTL || process.env.CACHE_TTL || 3600,
      cachePrefix: options.cachePrefix || process.env.CACHE_PREFIX || 'harca:embedding:',
      enableMemoryCache: options.enableMemoryCache !== undefined ? options.enableMemoryCache : 
        (process.env.ENABLE_MEMORY_CACHE !== 'false'),
      memoryCacheMaxItems: options.memoryCacheMaxItems || process.env.MEMORY_CACHE_MAX_ITEMS || 1000,
      enableRedisCache: options.enableRedisCache !== undefined ? options.enableRedisCache : 
        (process.env.ENABLE_REDIS_CACHE !== 'false'),
      enableFileCache: options.enableFileCache !== undefined ? options.enableFileCache : 
        (process.env.ENABLE_FILE_CACHE !== 'false'),
      fileCacheDir: options.fileCacheDir || process.env.FILE_CACHE_DIR || 
        path.join(__dirname, '.cache', 'api-embeddings'),
      enablePrefetch: options.enablePrefetch !== undefined ? options.enablePrefetch : 
        (process.env.ENABLE_PREFETCH !== 'false'),
      prefetchThreshold: options.prefetchThreshold || process.env.PREFETCH_THRESHOLD || 0.7,
      prefetchMaxItems: options.prefetchMaxItems || process.env.PREFETCH_MAX_ITEMS || 5,
      enableCacheCompression: options.enableCacheCompression !== undefined ? options.enableCacheCompression : 
        (process.env.ENABLE_CACHE_COMPRESSION !== 'false'),
      cacheCompressionLevel: options.cacheCompressionLevel || process.env.CACHE_COMPRESSION_LEVEL || 6,
      cacheCompressionThreshold: options.cacheCompressionThreshold || process.env.CACHE_COMPRESSION_THRESHOLD || 100
    });
    
    this.vectorStore = new VectorStore(this.cache);
    
    this.setupRoutes();
  }
  
  /**
   * ミドルウェアの設定
   */
  setupMiddleware() {
    this.app.use(express.json({ limit: '50mb' })); // リクエストサイズの制限を50MBに設定
    this.app.use(cors());
    this.app.use(express.urlencoded({ extended: true }));
    
    // リクエストロギング
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });
    
    // エラーハンドリングミドルウェア
    this.app.use((err, req, res, next) => {
      console.error('APIエラー:', err);
      
      // エラータイプに基づいて適切なレスポンスを返す
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ 
          error: '不正なリクエスト形式', 
          message: 'JSONの解析に失敗しました' 
        });
      }
      
      if (err.type === 'entity.too.large') {
        return res.status(413).json({ 
          error: 'リクエストが大きすぎます', 
          message: `リクエストサイズが制限を超えています（最大: ${this.app.get('json limit')}）` 
        });
      }
      
      // その他のエラー
      res.status(500).json({ 
        error: 'サーバーエラーが発生しました', 
        message: err.message || '不明なエラー' 
      });
    });
  }
  
  /**
   * APIルートの設定
   */
  setupRoutes() {
    // ルートエンドポイント
    this.app.get('/', (req, res) => {
      res.json({ 
        status: 'ok', 
        service: 'Vector Store API', 
        version: '1.0.0',
        memory: process.memoryUsage()
      });
    });
    
    // 埋め込みエンドポイント
    this.app.post('/api/embed', async (req, res) => {
      try {
        const { text, model } = req.body;
        
        if (!text) {
          return res.status(400).json({
            error: '入力エラー',
            message: 'テキストが指定されていません'
          });
        }
        
        // テキストサイズの検証
        if (text.length > 100000) {
          return res.status(413).json({ 
            error: 'テキストが長すぎます', 
            message: 'テキストは100,000文字以下にしてください' 
          });
        }
        
        const modelName = model || process.env.DEFAULT_EMBEDDING_MODEL || 'text-embedding-ada-002';
        console.log(`埋め込みベクトルを取得します: "${text.substring(0, 30)}..." (モデル: ${modelName})`);
        
        const embedding = await this.vectorStore.getEmbedding(text, modelName);
        
        console.log(`埋め込みベクトルを取得しました: 次元数=${embedding.length}`);
        res.json({
          success: true,
          model: modelName,
          embedding,
          dimensions: embedding.length,
          text_length: text.length
        });
        console.log('埋め込みエンドポイントのレスポンスを送信しました');
      } catch (error) {
        this.handleApiError(res, error, '埋め込みベクトルの生成に失敗しました');
      }
    });
    
    // 検索エンドポイント
    this.app.post('/api/search', async (req, res) => {
      try {
        const { query, documents, topK, model, filters, highlight, hybridAlpha } = req.body;
        
        if (!query) {
          return res.status(400).json({
            error: '入力エラー',
            message: '検索クエリが指定されていません'
          });
        }
        
        if (!documents || !Array.isArray(documents) || documents.length === 0) {
          return res.status(400).json({
            error: '入力エラー',
            message: 'ドキュメントが指定されていないか、空の配列です'
          });
        }
        
        // ドキュメント数の検証
        if (documents.length > 1000) {
          return res.status(413).json({ 
            error: 'ドキュメント数が多すぎます', 
            message: 'ドキュメント数は1,000以下にしてください' 
          });
        }
        
        // ドキュメントの合計サイズを計算
        const totalSize = documents.reduce((size, doc) => size + (doc.text?.length || 0), 0);
        if (totalSize > 500000) {
          return res.status(413).json({ 
            error: 'ドキュメントの合計サイズが大きすぎます', 
            message: 'ドキュメントの合計テキストサイズは500,000文字以下にしてください' 
          });
        }
        
        const modelName = model || process.env.DEFAULT_EMBEDDING_MODEL || 'text-embedding-ada-002';
        const k = topK || 5;
        
        // 検索オプションの構築
        const searchOptions = {};
        
        // メタデータフィルタリングが指定されている場合
        if (filters && typeof filters === 'object') {
          searchOptions.filters = filters;
        }
        
        // ハイライト機能が指定されている場合
        if (highlight !== undefined) {
          searchOptions.highlight = !!highlight;
        }
        
        // ハイブリッド検索の重みが指定されている場合
        if (hybridAlpha !== undefined && typeof hybridAlpha === 'number') {
          searchOptions.hybridAlpha = Math.max(0, Math.min(1, hybridAlpha)); // 0-1の範囲に制限
        }
        
        console.log(`検索を実行します: クエリ="${query}" (モデル: ${modelName}, topK: ${k}, ドキュメント数: ${documents.length})`);
        console.log('検索オプション:', searchOptions);
        
        const results = await this.vectorStore.search(query, documents, k, modelName, searchOptions);
        
        console.log(`検索結果を取得しました: ${results.length}件`);
        res.json({
          success: true,
          query,
          model: modelName,
          options: searchOptions,
          results
        });
        console.log('検索エンドポイントのレスポンスを送信しました');
      } catch (error) {
        this.handleApiError(res, error, '検索処理に失敗しました');
      }
    });
    
    // キャッシュ統計情報エンドポイント
    this.app.get('/api/cache/stats', async (req, res) => {
      try {
        console.log('キャッシュ統計情報を取得します');
        const stats = await this.cache.getStats();
        console.log('キャッシュ統計情報を取得しました');
        res.json({
          success: true,
          stats
        });
        console.log('キャッシュ統計情報エンドポイントのレスポンスを送信しました');
      } catch (err) {
        console.error('キャッシュ統計取得エラー:', err);
        res.status(500).json({
          error: 'キャッシュ統計取得エラー',
          message: err.message
        });
        console.log('キャッシュ統計情報エンドポイントのエラーレスポンスを送信しました');
      }
    });
    
    // キャッシュクリアエンドポイント
    this.app.post('/api/cache/clear', async (req, res) => {
      try {
        const { model } = req.body;
        
        if (model) {
          console.log(`モデル ${model} のキャッシュをクリアします`);
          const success = await this.cache.clearModelCache(model);
          console.log(`モデル ${model} のキャッシュをクリアしました (成功: ${success})`);
          res.json({
            success: success,
            message: success 
              ? `モデル ${model} のキャッシュをクリアしました`
              : `モデル ${model} のキャッシュクリア中にエラーが発生しました`
          });
        } else {
          console.log('すべてのキャッシュをクリアします');
          const success = await this.cache.clear();
          console.log(`すべてのキャッシュをクリアしました (成功: ${success})`);
          res.json({
            success: success,
            message: success 
              ? 'すべてのキャッシュをクリアしました'
              : 'キャッシュクリア中にエラーが発生しました'
          });
        }
      } catch (error) {
        console.error('キャッシュクリア中にエラーが発生しました:', error);
        // エラーが発生しても必ずレスポンスを返す
        res.status(500).json({
          success: false,
          message: 'キャッシュクリア中にエラーが発生しました',
          error: error.message
        });
      }
    });
  }
  
  /**
   * エラーハンドリング関数
   * @param {Object} res - レスポンスオブジェクト
   * @param {Error} error - エラーインスタンス
   * @param {string} defaultMessage - デフォルトエラーメッセージ
   */
  handleApiError(res, error, defaultMessage = '処理中にエラーが発生しました') {
    console.error('API処理エラー:', error);
    
    // エラータイプに基づいてステータスコードを決定
    let statusCode = 500;
    let errorMessage = defaultMessage;
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      statusCode = 504;
      errorMessage = 'リクエストがタイムアウトしました';
    } else if (error.response && error.response.status) {
      // 外部APIからのエラーレスポンス
      statusCode = error.response.status;
      errorMessage = `外部サービスエラー: ${error.response.data?.error || error.message}`;
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
      errorMessage = 'レート制限に達しました。しばらく待ってから再試行してください';
    }
    
    res.status(statusCode).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
  
  /**
   * サーバーを起動
   * @returns {Promise<void>}
   */
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`ベクトルストアAPIサーバーが起動しました: http://localhost:${this.port}`);
        resolve();
      });
    });
  }
  
  /**
   * サーバーを停止
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(async () => {
          console.log('ベクトルストアAPIサーバーを停止しました');
          await this.cache.close();
          resolve();
        });
      });
    }
    return Promise.resolve();
  }
}

module.exports = { VectorStoreAPI };

// スタンドアロンモードで実行された場合、サーバーを起動
if (require.main === module) {
  const api = new VectorStoreAPI();
  api.start().then(() => {
    console.log('ベクトルストアAPIサーバーが起動しました');
  }).catch(err => {
    console.error('サーバー起動エラー:', err);
  });
  
  // プロセス終了時のクリーンアップ
  process.on('SIGINT', async () => {
    console.log('サーバーをシャットダウンしています...');
    await api.stop();
    process.exit(0);
  });
}
