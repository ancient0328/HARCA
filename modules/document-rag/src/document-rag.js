/**
 * ドキュメントRAGクラス
 * ドキュメント処理とベクトルストアを組み合わせて、RAG機能を提供する
 */
const fs = require('fs').promises;
const path = require('path');
const schedule = require('node-schedule');
const config = require('../config/default');
const DocumentProcessor = require('./document-processor');
const DocumentVectorStore = require('./document-vector-store');
const EmbeddingService = require('./embedding-service');
const CacheService = require('./cache-service');
const logger = require('./utils/logger');

// ログディレクトリの確保
const ensureLogDirectory = async () => {
  const logDir = path.dirname(config.logging.file);
  try {
    await fs.mkdir(logDir, { recursive: true });
    console.log(`ログディレクトリを確保しました: ${logDir}`);
  } catch (error) {
    console.error(`ログディレクトリの作成に失敗しました: ${logDir}`, error);
  }
};

class DocumentRAG {
  /**
   * DocumentRAGのコンストラクタ
   * @param {Object} options - 設定オプション
   */
  constructor(options = {}) {
    // ログディレクトリを確保
    ensureLogDirectory();
    
    this.options = {
      sourceDir: options.sourceDir || config.document.sourceDir,
      vectorNamespace: options.vectorNamespace || config.vectorStore.namespace,
      cachePrefix: options.cachePrefix || config.cache.prefix,
      enableAutoUpdate: options.enableAutoUpdate !== undefined ? options.enableAutoUpdate : config.schedule.enableAutoUpdate,
      updateCron: options.updateCron || config.schedule.updateCron,
      ...options
    };
    
    // 各サービスのインスタンス化
    this.documentProcessor = new DocumentProcessor({
      sourceDir: this.options.sourceDir
    });
    
    this.vectorStore = new DocumentVectorStore({
      namespace: this.options.vectorNamespace
    });
    
    this.embeddingService = new EmbeddingService();
    
    this.cacheService = new CacheService({
      prefix: this.options.cachePrefix
    });
    
    this.updateJob = null;
    
    logger.info(`DocumentRAG initialized with sourceDir: ${this.options.sourceDir}`);
    
    // 自動更新のスケジュール設定
    if (this.options.enableAutoUpdate) {
      this.scheduleUpdates();
    }
  }

  /**
   * 更新ジョブをスケジュールする
   */
  scheduleUpdates() {
    try {
      this.updateJob = schedule.scheduleJob(this.options.updateCron, async () => {
        logger.info('Running scheduled document update');
        try {
          await this.processAndStoreDocuments();
          logger.info('Scheduled document update completed successfully');
        } catch (error) {
          logger.error(`Error in scheduled document update: ${error.message}`);
        }
      });
      
      logger.info(`Document updates scheduled with cron: ${this.options.updateCron}`);
    } catch (error) {
      logger.error(`Error scheduling document updates: ${error.message}`);
    }
  }

  /**
   * ドキュメントを処理してベクトルストアに保存する
   * @returns {Promise<number>} 処理されたドキュメント数
   */
  async processAndStoreDocuments() {
    try {
      logger.info('Starting document processing and storage');
      
      // ドキュメントの処理
      const documents = await this.documentProcessor.processDirectory();
      logger.info(`Processed ${documents.length} documents`);
      
      // 埋め込みベクトルの生成とチャンク保存
      const documentChunks = [];
      let totalChunks = 0;
      
      for (const doc of documents) {
        for (const chunk of doc.chunks) {
          // キャッシュからベクトルを取得するか、新たに生成
          const cacheKey = `${doc.id}:chunk:${chunk.index}:${doc.metadata.modified.getTime()}`;
          let embedding = await this.cacheService.get(cacheKey);
          
          if (!embedding) {
            // ベクトルをキャッシュから取得できない場合は新たに生成
            embedding = await this.embeddingService.getEmbedding(chunk.content);
            
            // キャッシュに保存
            await this.cacheService.set(cacheKey, embedding);
          }
          
          documentChunks.push({
            embedding,
            text: chunk.content,
            metadata: {
              ...doc.metadata,
              chunkIndex: chunk.index,
              documentId: doc.id,
              documentTitle: doc.metadata.title || path.basename(doc.path, path.extname(doc.path))
            }
          });
          
          totalChunks++;
        }
      }
      
      // ベクトルストアに保存
      if (documentChunks.length > 0) {
        // 既存のドキュメントを削除（更新のため）
        await this.vectorStore.deleteDocuments({ 
          documentPath: { $regex: this.options.sourceDir }
        });
        
        // 新しいチャンクを保存
        const storedIds = await this.vectorStore.storeDocumentChunks(documentChunks);
        
        // 最終更新時間を記録
        await this.saveLastUpdateTime();
        
        logger.info(`Successfully stored ${storedIds.length} document chunks from ${documents.length} documents in vector store`);
        return documents.length;
      }
      
      logger.info(`No document chunks to store from ${documents.length} documents`);
      return 0;
    } catch (error) {
      logger.error(`Error processing and storing documents: ${error.message}`);
      throw error;
    }
  }

  /**
   * 最終更新時間を保存する
   * @returns {Promise<void>}
   */
  async saveLastUpdateTime() {
    try {
      const timestamp = new Date().toISOString();
      const lastUpdateFile = config.schedule.lastUpdateFile;
      
      await fs.writeFile(lastUpdateFile, timestamp, 'utf-8');
      logger.debug(`Last update time saved: ${timestamp}`);
    } catch (error) {
      logger.error(`Error saving last update time: ${error.message}`);
    }
  }

  /**
   * 最終更新時間を取得する
   * @returns {Promise<string|null>} 最終更新時間（ISO形式）またはnull
   */
  async getLastUpdateTime() {
    try {
      const lastUpdateFile = config.schedule.lastUpdateFile;
      const timestamp = await fs.readFile(lastUpdateFile, 'utf-8');
      return timestamp.trim();
    } catch (error) {
      logger.debug(`No last update time found: ${error.message}`);
      return null;
    }
  }

  /**
   * テキストクエリで類似ドキュメントを検索する
   * @param {string} query - 検索クエリ
   * @param {Object} options - 検索オプション
   * @returns {Promise<Array>} 検索結果の配列
   */
  async search(query, options = {}) {
    try {
      logger.info(`Searching for: "${query}"`);
      
      // クエリの埋め込みベクトルを生成
      const queryEmbedding = await this.embeddingService.getEmbedding(query);
      
      // ベクトル検索を実行
      const results = await this.vectorStore.search(queryEmbedding, options);
      
      logger.info(`Found ${results.length} results for query: "${query}"`);
      return results;
    } catch (error) {
      logger.error(`Error searching for query "${query}": ${error.message}`);
      throw error;
    }
  }

  /**
   * ドキュメントIDによるドキュメントの取得
   * @param {string} id - ドキュメントID
   * @returns {Promise<Object|null>} ドキュメントオブジェクトまたはnull
   */
  async getDocumentById(id) {
    try {
      logger.info(`Getting document by ID: ${id}`);
      return await this.vectorStore.getDocumentById(id);
    } catch (error) {
      logger.error(`Error getting document by ID ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * メタデータフィルタに基づいてドキュメントを削除する
   * @param {Object} filter - メタデータフィルタ
   * @returns {Promise<number>} 削除されたドキュメントの数
   */
  async deleteDocuments(filter) {
    try {
      logger.info(`Deleting documents with filter: ${JSON.stringify(filter)}`);
      return await this.vectorStore.deleteDocuments(filter);
    } catch (error) {
      logger.error(`Error deleting documents: ${error.message}`);
      throw error;
    }
  }

  /**
   * すべてのドキュメントを削除する
   * @returns {Promise<number>} 削除されたドキュメントの数
   */
  async deleteAllDocuments() {
    try {
      logger.warn('Deleting ALL documents from vector store');
      return await this.vectorStore.deleteAllDocuments();
    } catch (error) {
      logger.error(`Error deleting all documents: ${error.message}`);
      throw error;
    }
  }

  /**
   * リソースをクリーンアップする
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      logger.info('Shutting down DocumentRAG');
      
      // スケジュールされたジョブをキャンセル
      if (this.updateJob) {
        this.updateJob.cancel();
        logger.debug('Update job canceled');
      }
      
      // 各サービスのシャットダウン
      // 必要に応じて追加のクリーンアップを実行
      
      logger.info('DocumentRAG shutdown complete');
    } catch (error) {
      logger.error(`Error during shutdown: ${error.message}`);
    }
  }
}

module.exports = DocumentRAG;
