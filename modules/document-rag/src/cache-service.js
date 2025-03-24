/**
 * キャッシュサービスクラス
 * 埋め込みベクトルなどをキャッシュする
 */
const path = require('path');
const MockCacheService = require('./mock-cache-service');
const logger = require('./utils/logger');

class CacheService {
  /**
   * CacheServiceのコンストラクタ
   * @param {Object} options - 設定オプション
   */
  constructor(options = {}) {
    this.options = {
      prefix: options.prefix || 'document_rag_cache',
      ttl: options.ttl || 86400, // デフォルトは1日
      ...options
    };
    
    // モックキャッシュサービスのインスタンス化
    this.cacheService = new MockCacheService({
      prefix: this.options.prefix,
      filePath: path.join(__dirname, '../.cache/cache-store.json'),
      ttl: this.options.ttl
    });
    
    logger.info(`CacheService initialized with prefix: ${this.options.prefix}`);
  }

  /**
   * キャッシュからデータを取得する
   * @param {string} key - キャッシュキー
   * @returns {Promise<any|null>} キャッシュされたデータまたはnull
   */
  async get(key) {
    try {
      return await this.cacheService.get(key);
    } catch (error) {
      logger.error(`Error getting cache for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * データをキャッシュに保存する
   * @param {string} key - キャッシュキー
   * @param {any} data - キャッシュするデータ
   * @param {number} ttl - キャッシュの有効期間（秒）
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async set(key, data, ttl = null) {
    try {
      return await this.cacheService.set(key, data, ttl);
    } catch (error) {
      logger.error(`Error setting cache for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * キャッシュからデータを削除する
   * @param {string} key - キャッシュキー
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async delete(key) {
    try {
      return await this.cacheService.delete(key);
    } catch (error) {
      logger.error(`Error deleting cache for key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * プレフィックスに一致するすべてのキャッシュを削除する
   * @param {string} prefix - キャッシュキープレフィックス
   * @returns {Promise<number>} 削除されたキャッシュエントリの数
   */
  async deleteByPrefix(prefix) {
    try {
      return await this.cacheService.deleteByPrefix(prefix);
    } catch (error) {
      logger.error(`Error deleting cache by prefix ${prefix}: ${error.message}`);
      return 0;
    }
  }

  /**
   * すべてのキャッシュを削除する
   * @returns {Promise<number>} 削除されたキャッシュエントリの数
   */
  async flush() {
    try {
      return await this.cacheService.flush();
    } catch (error) {
      logger.error(`Error flushing cache: ${error.message}`);
      return 0;
    }
  }
}

module.exports = CacheService;
