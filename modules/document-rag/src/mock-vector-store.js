/**
 * モックベクトルストアクラス
 * HARCAのベクトルストア機能をモックして、ドキュメントベクトルを管理する
 */
const fs = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');

class MockVectorStore {
  /**
   * MockVectorStoreのコンストラクタ
   * @param {Object} options - 設定オプション
   */
  constructor(options = {}) {
    this.options = {
      namespace: options.namespace || 'document_vectors',
      filePath: options.filePath || path.join(__dirname, '../.cache/vector-store.json'),
      ...options
    };
    
    this.documents = [];
    this.initialized = false;
    
    logger.info(`MockVectorStore initialized with namespace: ${this.options.namespace}`);
  }

  /**
   * ベクトルストアを初期化する
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      logger.info('Initializing mock vector store...');
      
      // キャッシュディレクトリの作成
      const cacheDir = path.dirname(this.options.filePath);
      await fs.mkdir(cacheDir, { recursive: true });
      
      // 既存のデータがあれば読み込む
      try {
        const data = await fs.readFile(this.options.filePath, 'utf-8');
        this.documents = JSON.parse(data);
        logger.info(`Loaded ${this.documents.length} documents from cache`);
      } catch (error) {
        // ファイルが存在しない場合は空の配列で初期化
        this.documents = [];
        logger.debug('No existing vector store cache found, starting with empty store');
      }
      
      this.initialized = true;
      logger.info('Mock vector store initialized successfully');
    } catch (error) {
      logger.error(`Error initializing mock vector store: ${error.message}`);
      throw error;
    }
  }

  /**
   * ドキュメントチャンクをベクトルストアに保存する
   * @param {Array<Object>} documentChunks - ドキュメントチャンクの配列
   * @returns {Promise<Array<string>>} 保存されたドキュメントIDの配列
   */
  async storeDocumentChunks(documentChunks) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      logger.info(`Storing ${documentChunks.length} document chunks to mock vector store...`);
      
      const results = [];
      
      for (const chunk of documentChunks) {
        // ユニークIDを生成
        const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // ドキュメントを保存
        this.documents.push({
          id,
          embedding: chunk.embedding,
          content: chunk.text,
          metadata: chunk.metadata
        });
        
        results.push(id);
      }
      
      // ファイルに保存
      await this.saveToFile();
      
      logger.info(`Successfully stored ${results.length} document chunks`);
      return results;
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
      if (!this.initialized) {
        await this.initialize();
      }
      
      const searchOptions = {
        topK: options.topK || 5,
        minScore: options.minScore || 0.7,
        filter: options.filter || {}
      };
      
      logger.debug(`Searching mock vector store with topK=${searchOptions.topK}, minScore=${searchOptions.minScore}`);
      
      // フィルタリング
      let filteredDocuments = this.documents;
      
      if (Object.keys(searchOptions.filter).length > 0) {
        filteredDocuments = this.documents.filter(doc => {
          // 単純なフィルタリング実装
          for (const [key, value] of Object.entries(searchOptions.filter)) {
            if (typeof value === 'object' && value.$regex) {
              // 正規表現フィルタ
              const regex = new RegExp(value.$regex);
              if (!regex.test(doc.metadata[key])) {
                return false;
              }
            } else if (doc.metadata[key] !== value) {
              return false;
            }
          }
          return true;
        });
      }
      
      // コサイン類似度の計算（モック実装）
      const results = filteredDocuments.map(doc => {
        // 実際のコサイン類似度計算の代わりにランダムなスコアを生成
        const score = 0.7 + Math.random() * 0.3; // 0.7〜1.0の範囲
        
        return {
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          score
        };
      });
      
      // スコアでソートして上位を返す
      const sortedResults = results
        .sort((a, b) => b.score - a.score)
        .filter(result => result.score >= searchOptions.minScore)
        .slice(0, searchOptions.topK);
      
      logger.debug(`Found ${sortedResults.length} results from mock vector store`);
      return sortedResults;
    } catch (error) {
      logger.error(`Error searching mock vector store: ${error.message}`);
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
      if (!this.initialized) {
        await this.initialize();
      }
      
      logger.debug(`Getting document by ID: ${id}`);
      
      const document = this.documents.find(doc => doc.id === id);
      
      if (!document) {
        logger.debug(`Document not found for ID: ${id}`);
        return null;
      }
      
      logger.debug(`Document found for ID: ${id}`);
      return document;
    } catch (error) {
      logger.error(`Error getting document by ID ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * メタデータフィルタに基づいてドキュメントを削除する
   * @param {Object} filter - メタデータフィルタ
   * @returns {Promise<number>} 削除されたドキュメントの数
   */
  async deleteDocuments(filter) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      logger.info(`Deleting documents with filter: ${JSON.stringify(filter)}`);
      
      const initialCount = this.documents.length;
      
      // フィルタに基づいてドキュメントをフィルタリング
      this.documents = this.documents.filter(doc => {
        // 単純なフィルタリング実装
        for (const [key, value] of Object.entries(filter)) {
          if (typeof value === 'object' && value.$regex) {
            // 正規表現フィルタ
            const regex = new RegExp(value.$regex);
            if (regex.test(doc.metadata[key])) {
              return false; // 削除対象
            }
          } else if (doc.metadata[key] === value) {
            return false; // 削除対象
          }
        }
        return true; // 保持
      });
      
      const deletedCount = initialCount - this.documents.length;
      
      // ファイルに保存
      await this.saveToFile();
      
      logger.info(`Deleted ${deletedCount} documents`);
      return deletedCount;
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
      if (!this.initialized) {
        await this.initialize();
      }
      
      logger.warn(`Deleting ALL documents in namespace: ${this.options.namespace}`);
      
      const count = this.documents.length;
      this.documents = [];
      
      // ファイルに保存
      await this.saveToFile();
      
      logger.warn(`Deleted ${count} documents from namespace: ${this.options.namespace}`);
      return count;
    } catch (error) {
      logger.error(`Error deleting all documents: ${error.message}`);
      throw error;
    }
  }

  /**
   * ドキュメントをファイルに保存する
   * @returns {Promise<void>}
   */
  async saveToFile() {
    try {
      await fs.writeFile(this.options.filePath, JSON.stringify(this.documents, null, 2), 'utf-8');
      logger.debug(`Saved ${this.documents.length} documents to file: ${this.options.filePath}`);
    } catch (error) {
      logger.error(`Error saving documents to file: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MockVectorStore;
