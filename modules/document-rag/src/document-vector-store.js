/**
 * ドキュメントベクトルストアクラス
 * ドキュメントの埋め込みベクトルを管理する
 */
const path = require('path');
const MockVectorStore = require('./mock-vector-store');
const logger = require('./utils/logger');

class DocumentVectorStore {
  /**
   * DocumentVectorStoreのコンストラクタ
   * @param {Object} options - 設定オプション
   */
  constructor(options = {}) {
    this.options = {
      namespace: options.namespace || 'document_vectors',
      ...options
    };
    
    // モックベクトルストアのインスタンス化
    this.vectorStore = new MockVectorStore({
      namespace: this.options.namespace,
      filePath: path.join(__dirname, '../.cache/vector-store.json')
    });
    
    logger.info(`DocumentVectorStore initialized with namespace: ${this.options.namespace}`);
  }

  /**
   * ドキュメントチャンクをベクトルストアに保存する
   * @param {Array<Object>} documentChunks - ドキュメントチャンクの配列
   * @returns {Promise<Array<string>>} 保存されたドキュメントIDの配列
   */
  async storeDocumentChunks(documentChunks) {
    try {
      logger.info(`Storing ${documentChunks.length} document chunks to vector store`);
      return await this.vectorStore.storeDocumentChunks(documentChunks);
    } catch (error) {
      logger.error(`Error storing document chunks: ${error.message}`);
      throw error;
    }
  }

  /**
   * ベクトルの類似性検索を実行する
   * @param {Array<number>} queryEmbedding - クエリの埋め込みベクトル
   * @param {Object} options - 検索オプション
   * @returns {Promise<Array<Object>>} 検索結果の配列
   */
  async search(queryEmbedding, options = {}) {
    try {
      logger.info(`Searching vector store with options: ${JSON.stringify(options)}`);
      return await this.vectorStore.search(queryEmbedding, options);
    } catch (error) {
      logger.error(`Error searching vector store: ${error.message}`);
      throw error;
    }
  }

  /**
   * ドキュメントIDに基づいてドキュメントを取得する
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
}

module.exports = DocumentVectorStore;
