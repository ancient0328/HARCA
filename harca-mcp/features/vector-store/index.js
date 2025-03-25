// features/vector-store/index.js - ベクトルストアプラグイン
import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { OpenAIEmbeddingModel } from './openai-model.js';
import { LocalEmbeddingModel } from './local-model.js';
import { SimpleHashEmbeddingModel } from './simple-hash.js';
import { EmbeddingCache } from './embedding-cache.js';
import { ModelManager } from './model-manager.js';

// ESモジュールで__dirnameを取得するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の読み込み
import dotenv from 'dotenv';
dotenv.config();

/**
 * ベクトルストアクラス
 * テキストの埋め込みベクトル生成、保存、検索を担当
 */
class VectorStore {
  /**
   * ベクトルストアの初期化
   * @param {Object} config - 設定オブジェクト
   */
  constructor(config = {}) {
    // PostgreSQL接続設定
    try {
      // 複数の可能性のある接続文字列環境変数をチェック
      const connectionString = 
        process.env.POSTGRES_CONNECTION_STRING || 
        process.env.HARCA_POSTGRES_CONNECTION_STRING || 
        process.env.SUPABASE_CONNECTION_STRING;
      
      if (!connectionString) {
        throw new Error('PostgreSQL接続文字列が設定されていません');
      }
      
      console.log('PostgreSQL接続を初期化します...');
      this.pool = new Pool({ connectionString });
      
      // 接続テスト
      this.testConnection();
    } catch (error) {
      console.error('PostgreSQL接続の初期化に失敗しました:', error.message);
      console.warn('ベクトルストアの機能は制限されます');
      this.pool = null;
    }
    
    // モデルマネージャーの初期化
    this.modelManager = new ModelManager(config.modelManager || {});
    
    // キャッシュ設定
    this.useCache = config.useCache !== false;
    this.cacheConfig = config.cache || {};
    
    if (this.useCache) {
      this.cache = new EmbeddingCache({
        useMemoryCache: this.cacheConfig.useMemoryCache !== false,
        useFileCache: this.cacheConfig.useFileCache !== false,
        memoryCacheSize: this.cacheConfig.memoryCacheSize || 1000,
        maxCacheSize: this.cacheConfig.maxCacheSize || 10000,
        ttl: this.cacheConfig.ttl || 30 * 24 * 60 * 60 * 1000, // 30日
        useFrequencyBasedStrategy: this.cacheConfig.useFrequencyBasedStrategy !== false
      });
    }
    
    // 埋め込みモデルの選択
    this.activeModelId = config.modelId || process.env.DEFAULT_EMBEDDING_MODEL || 'auto';
    
    // モデル初期化
    this.initializeEmbeddingModel();
    
    console.log(`ベクトルストアを初期化しました: モデル=${this.activeModelId}`);
    if (this.useCache) {
      console.log('埋め込みキャッシュが有効です');
    }
  }
  
  /**
   * PostgreSQL接続をテスト
   * @private
   */
  async testConnection() {
    if (!this.pool) return false;
    
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('PostgreSQL接続テスト成功');
      return true;
    } catch (error) {
      console.error('PostgreSQL接続テスト失敗:', error.message);
      return false;
    }
  }
  
  /**
   * 埋め込みモデルの初期化
   * モデルマネージャーを使用して適切なモデルを選択
   */
  initializeEmbeddingModel() {
    try {
      if (this.activeModelId === 'auto') {
        // 自動選択: モデルマネージャーに最適なモデルを選択させる
        this.activeModelId = this.modelManager.autoSelectModel();
      }
      
      // モデルマネージャーからモデル情報を取得
      const modelInfo = this.modelManager.getModelInfo(this.activeModelId);
      
      if (!modelInfo) {
        throw new Error(`モデル ${this.activeModelId} は存在しません`);
      }
      
      // モデルタイプに基づいてモデルを初期化
      switch (modelInfo.provider) {
        case 'openai':
          this.embeddingModel = new OpenAIEmbeddingModel({
            modelId: modelInfo.name,
            maxRetries: 3
          });
          break;
          
        case 'local':
          this.embeddingModel = new LocalEmbeddingModel({
            modelName: modelInfo.name
          });
          break;
          
        case 'simple':
          this.embeddingModel = new SimpleHashEmbeddingModel();
          break;
          
        default:
          throw new Error(`未知のプロバイダー: ${modelInfo.provider}`);
      }
      
      // アクティブなモデルとして設定
      this.modelManager.setActiveModel(this.activeModelId);
      console.log(`埋め込みモデルを初期化しました: ${this.activeModelId} (${modelInfo.name})`);
    } catch (error) {
      console.error('埋め込みモデルの初期化に失敗しました:', error);
      console.log('フォールバック: シンプルハッシュモデルを使用します');
      
      // フォールバック: シンプルハッシュモデル
      this.embeddingModel = new SimpleHashEmbeddingModel();
      this.activeModelId = 'simple-hash';
      this.modelManager.setActiveModel(this.activeModelId);
    }
  }
  
  /**
   * 埋め込みモデルを変更
   * @param {string} modelId - 使用するモデルID
   * @param {Object} options - モデル固有のオプション
   * @returns {boolean} - 変更が成功したかどうか
   */
  changeEmbeddingModel(modelId, options = {}) {
    try {
      // モデルマネージャーからモデル情報を取得
      const modelInfo = this.modelManager.getModelInfo(modelId);
      
      if (!modelInfo) {
        console.error(`モデル ${modelId} は存在しません`);
        return false;
      }
      
      // モデルが失敗状態の場合は変更不可
      if (this.modelManager.isModelFailed(modelId)) {
        console.error(`モデル ${modelId} は現在利用できません（失敗状態）`);
        return false;
      }
      
      // モデルタイプに基づいてモデルを初期化
      switch (modelInfo.provider) {
        case 'openai':
          this.embeddingModel = new OpenAIEmbeddingModel({
            modelId: modelInfo.name,
            maxRetries: options.maxRetries || 3
          });
          break;
          
        case 'local':
          this.embeddingModel = new LocalEmbeddingModel({
            modelName: modelInfo.name,
            ...options
          });
          break;
          
        case 'simple':
          this.embeddingModel = new SimpleHashEmbeddingModel(options);
          break;
          
        default:
          console.error(`未知のプロバイダー: ${modelInfo.provider}`);
          return false;
      }
      
      // アクティブなモデルとして設定
      this.activeModelId = modelId;
      this.modelManager.setActiveModel(this.activeModelId);
      console.log(`埋め込みモデルを変更しました: ${this.activeModelId} (${modelInfo.name})`);
      return true;
    } catch (error) {
      console.error('埋め込みモデルの変更に失敗しました:', error);
      return false;
    }
  }
  
  /**
   * 利用可能なすべての埋め込みモデルのリストを取得
   * @returns {Array<Object>} - モデル情報のリスト
   */
  getAvailableModels() {
    const modelIds = this.modelManager.getAvailableModels();
    return modelIds.map(id => ({
      id,
      ...this.modelManager.getModelInfo(id),
      isFailed: this.modelManager.isModelFailed(id),
      isActive: id === this.activeModelId,
      stats: this.modelManager.getModelStatsById(id)
    }));
  }
  
  /**
   * 現在アクティブな埋め込みモデルの情報を取得
   * @returns {Object} - アクティブなモデルの情報
   */
  getActiveModelInfo() {
    const modelInfo = this.modelManager.getModelInfo(this.activeModelId);
    return {
      id: this.activeModelId,
      ...modelInfo,
      stats: this.modelManager.getModelStatsById(this.activeModelId)
    };
  }
  
  /**
   * テキストから埋め込みベクトルを生成
   * キャッシュを活用し、エラー時にはフォールバックメカニズムを使用
   * @param {string} text - 埋め込みを生成するテキスト
   * @returns {Promise<Array<number>>} - 埋め込みベクトル
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('埋め込み生成のためのテキストが無効です');
    }
    
    try {
      // キャッシュからベクトルを取得
      if (this.useCache) {
        const cachedEmbedding = this.cache.get(text, this.activeModelId);
        if (cachedEmbedding) {
          // 使用統計を記録
          this.modelManager.recordModelUsage(this.activeModelId, text.length / 4); // 概算トークン数
          return cachedEmbedding;
        }
      }
      
      // 現在のモデルで埋め込みを生成
      const startTime = Date.now();
      const embedding = await this.embeddingModel.embed(text);
      const elapsedTime = Date.now() - startTime;
      
      // 成功を記録
      this.modelManager.recordModelSuccess(this.activeModelId);
      
      // 使用統計を記録
      this.modelManager.recordModelUsage(this.activeModelId, text.length / 4); // 概算トークン数
      
      // キャッシュに保存
      if (this.useCache) {
        this.cache.set(text, embedding, this.activeModelId);
      }
      
      console.log(`埋め込み生成完了: モデル=${this.activeModelId}, 時間=${elapsedTime}ms`);
      return embedding;
    } catch (error) {
      console.error(`埋め込み生成中にエラーが発生しました (${this.activeModelId}):`, error.message);
      
      // エラーを記録
      const isFailed = this.modelManager.recordModelError(this.activeModelId, error);
      
      // モデルが失敗状態になった場合、または現在のモデルがフォールバックでない場合
      if (isFailed || !this.modelManager.getModelInfo(this.activeModelId).fallback) {
        console.log('フォールバックモデルを使用して再試行します...');
        
        // 別のモデルを選択
        const fallbackModelId = this.selectFallbackModel();
        
        if (fallbackModelId && fallbackModelId !== this.activeModelId) {
          // 一時的にモデルを変更
          const originalModelId = this.activeModelId;
          const success = this.changeEmbeddingModel(fallbackModelId);
          
          if (success) {
            try {
              // フォールバックモデルで再試行
              const fallbackEmbedding = await this.embeddingModel.embed(text);
              
              // キャッシュに保存
              if (this.useCache) {
                this.cache.set(text, fallbackEmbedding, fallbackModelId);
              }
              
              console.log(`フォールバック成功: ${fallbackModelId}`);
              
              // 元のモデルに戻す（失敗していない場合）
              if (!this.modelManager.isModelFailed(originalModelId)) {
                this.changeEmbeddingModel(originalModelId);
              }
              
              return fallbackEmbedding;
            } catch (fallbackError) {
              console.error(`フォールバックモデル (${fallbackModelId}) でもエラーが発生しました:`, fallbackError.message);
              this.modelManager.recordModelError(fallbackModelId, fallbackError);
              
              // 元のモデルに戻す（失敗していない場合）
              if (!this.modelManager.isModelFailed(originalModelId)) {
                this.changeEmbeddingModel(originalModelId);
              }
            }
          }
        }
      }
      
      // 最終手段: シンプルハッシュ
      if (this.activeModelId !== 'simple-hash') {
        console.log('最終フォールバック: シンプルハッシュモデルを使用します');
        const simpleHashModel = new SimpleHashEmbeddingModel();
        const simpleHashEmbedding = await simpleHashModel.embed(text);
        
        // キャッシュに保存
        if (this.useCache) {
          this.cache.set(text, simpleHashEmbedding, 'simple-hash');
        }
        
        return simpleHashEmbedding;
      }
      
      // すべてのフォールバックが失敗した場合はエラーを投げる
      throw new Error(`すべての埋め込みモデルが失敗しました: ${error.message}`);
    }
  }
  
  /**
   * フォールバックとして使用するモデルを選択
   * @returns {string|null} - フォールバックモデルのID、適切なモデルがない場合はnull
   */
  selectFallbackModel() {
    // 失敗していないモデルのリスト
    const availableModels = this.modelManager.getAvailableModels().filter(
      id => !this.modelManager.isModelFailed(id) && id !== this.activeModelId
    );
    
    if (availableModels.length === 0) {
      // シンプルハッシュは常に利用可能
      return 'simple-hash';
    }
    
    // 優先順位: 1. シンプルハッシュ（最も信頼性が高い）、2. ローカルモデル、3. OpenAIモデル
    const simpleHash = availableModels.find(id => 
      this.modelManager.getModelInfo(id).provider === 'simple'
    );
    
    if (simpleHash) return simpleHash;
    
    const localModels = availableModels.filter(id => 
      this.modelManager.getModelInfo(id).provider === 'local'
    );
    
    if (localModels.length > 0) {
      // 最も次元数が小さいモデル（高速）を選択
      return localModels.sort((a, b) => 
        this.modelManager.getModelInfo(a).dimensions - this.modelManager.getModelInfo(b).dimensions
      )[0];
    }
    
    // それ以外の場合は最初のモデルを使用
    return availableModels[0];
  }
  
  /**
   * コードをベクトルストアにインデックス化
   * @param {string} content - インデックス化するコードコンテンツ
   * @param {Object} metadata - コードに関するメタデータ
   * @returns {Promise<Object>} - インデックス化の結果
   */
  async indexCode(content, metadata = {}) {
    try {
      // PostgreSQL接続がない場合はエラー
      if (!this.pool) {
        throw new Error('PostgreSQL接続が利用できません');
      }
      
      // 埋め込みベクトルを生成
      const embedding = await this.generateEmbedding(content);
      
      // ベクトル形式に変換
      const vectorString = `[${embedding.join(',')}]`;
      
      // メタデータをJSON文字列に変換
      const metadataString = JSON.stringify(metadata);
      
      // テーブル存在確認
      const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'embeddings'
        );
      `;
      
      const tableExists = await this.pool.query(tableExistsQuery);
      
      if (tableExists.rows[0].exists) {
        // embeddingsテーブルを使用
        const query = `
          INSERT INTO embeddings (content, embedding, metadata)
          VALUES ($1, $2::jsonb, $3::jsonb)
          RETURNING id
        `;
        
        const result = await this.pool.query(query, [content, JSON.stringify(embedding), metadataString]);
        
        return {
          success: true,
          id: result.rows[0].id,
          message: 'コードが正常にインデックス化されました'
        };
      } else {
        // code_vectorsテーブルを使用（後方互換性のため）
        const query = `
          INSERT INTO code_vectors (content, embedding, metadata)
          VALUES ($1, $2::vector, $3::jsonb)
          RETURNING id
        `;
        
        const result = await this.pool.query(query, [content, vectorString, metadataString]);
        
        return {
          success: true,
          id: result.rows[0].id,
          message: 'コードが正常にインデックス化されました'
        };
      }
    } catch (error) {
      console.error('コードのインデックス化中にエラーが発生しました:', error);
      
      return {
        success: false,
        error: error.message,
        message: 'コードのインデックス化に失敗しました'
      };
    }
  }
  
  /**
   * クエリに類似したコードを検索
   * @param {string} query - 検索クエリ
   * @param {number} limit - 結果の最大数
   * @returns {Promise<Array<Object>>} - 類似度でソートされた結果
   */
  async searchSimilarCode(query, limit = 5) {
    try {
      // PostgreSQL接続がない場合はエラー
      if (!this.pool) {
        throw new Error('PostgreSQL接続が利用できません');
      }
      
      // クエリの埋め込みベクトルを生成
      const queryEmbedding = await this.generateEmbedding(query);
      
      // ベクトル形式に変換
      const vectorString = `[${queryEmbedding.join(',')}]`;
      
      // テーブル存在確認
      const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'embeddings'
        );
      `;
      
      const tableExists = await this.pool.query(tableExistsQuery);
      
      let result;
      
      if (tableExists.rows[0].exists) {
        // embeddingsテーブルを使用
        const searchQuery = `
          SELECT id, content, metadata, 
            1 - (embedding_vector <=> $1::vector) as similarity
          FROM embeddings
          ORDER BY similarity DESC
          LIMIT $2
        `;
        
        result = await this.pool.query(searchQuery, [vectorString, limit]);
      } else {
        // code_vectorsテーブルを使用（後方互換性のため）
        const searchQuery = `
          SELECT id, content, metadata, 
            1 - (embedding <=> $1::vector) as similarity
          FROM code_vectors
          ORDER BY similarity DESC
          LIMIT $2
        `;
        
        result = await this.pool.query(searchQuery, [vectorString, limit]);
      }
      
      // 結果を整形
      return result.rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
        similarity: row.similarity
      }));
    } catch (error) {
      console.error('類似コードの検索中にエラーが発生しました:', error);
      throw error;
    }
  }
  
  /**
   * ベクトルストアの状態情報を取得
   * @returns {Promise<Object>} - 状態情報
   */
  async getStatus() {
    try {
      let vectorCount = 0;
      
      // PostgreSQL接続がある場合のみデータベース情報を取得
      if (this.pool) {
        try {
          // embeddingsテーブルの確認
          const embeddingsQuery = `
            SELECT COUNT(*) FROM embeddings
            WHERE EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'embeddings'
            );
          `;
          
          const embeddingsResult = await this.pool.query(embeddingsQuery).catch(() => ({ rows: [{ count: 0 }] }));
          const embeddingsCount = parseInt(embeddingsResult.rows[0].count, 10) || 0;
          
          // code_vectorsテーブルの確認
          const codeVectorsQuery = `
            SELECT COUNT(*) FROM code_vectors
            WHERE EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'code_vectors'
            );
          `;
          
          const codeVectorsResult = await this.pool.query(codeVectorsQuery).catch(() => ({ rows: [{ count: 0 }] }));
          const codeVectorsCount = parseInt(codeVectorsResult.rows[0].count, 10) || 0;
          
          vectorCount = embeddingsCount + codeVectorsCount;
        } catch (error) {
          console.error('ベクトル数の取得中にエラーが発生しました:', error.message);
        }
      }
      
      // キャッシュ情報
      const cacheInfo = this.useCache ? this.cache.getStats() : null;
      
      // モデル情報
      const modelInfo = this.getActiveModelInfo();
      const allModels = this.getAvailableModels();
      
      // エラーログ
      const errorLog = this.modelManager.getErrorLog();
      
      return {
        vectorCount,
        activeModel: modelInfo,
        availableModels: allModels,
        cache: cacheInfo,
        errorLog: errorLog.slice(-10), // 最新の10件のみ
        postgresConnected: !!this.pool,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('状態情報の取得中にエラーが発生しました:', error);
      
      return {
        error: error.message,
        postgresConnected: !!this.pool,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * ベクトルストアをクリーンアップ
   */
  async cleanup() {
    try {
      // キャッシュをクリア
      if (this.useCache) {
        this.cache.clear();
      }
      
      // エラーログをクリア
      this.modelManager.clearErrorLog();
      
      // 失敗したモデルのリストをクリア
      this.modelManager.clearFailedModels();
      
      // データベース接続を終了
      await this.pool.end();
      
      console.log('ベクトルストアのクリーンアップが完了しました');
    } catch (error) {
      console.error('クリーンアップ中にエラーが発生しました:', error);
    }
  }
}

export { VectorStore };
