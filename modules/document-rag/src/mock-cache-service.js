/**
 * モックキャッシュサービスクラス
 * HARCAのキャッシュ機能をモックして、埋め込みベクトルなどをキャッシュする
 */
const fs = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');

class MockCacheService {
  /**
   * MockCacheServiceのコンストラクタ
   * @param {Object} options - 設定オプション
   */
  constructor(options = {}) {
    this.options = {
      prefix: options.prefix || 'document_rag_cache',
      filePath: options.filePath || path.join(__dirname, '../.cache/cache-store.json'),
      ttl: options.ttl || 86400, // デフォルトは1日
      ...options
    };
    
    this.cache = {};
    this.initialized = false;
    
    logger.info(`MockCacheService initialized with prefix: ${this.options.prefix}`);
  }

  /**
   * キャッシュサービスを初期化する
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      logger.info('Initializing mock cache service...');
      
      // キャッシュディレクトリの作成
      const cacheDir = path.dirname(this.options.filePath);
      await fs.mkdir(cacheDir, { recursive: true });
      
      // 既存のデータがあれば読み込む
      try {
        const data = await fs.readFile(this.options.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        
        // 期限切れのキャッシュエントリを削除
        const now = Date.now();
        this.cache = {};
        
        for (const [key, entry] of Object.entries(parsed)) {
          if (entry.expiry > now) {
            this.cache[key] = entry;
          }
        }
        
        logger.info(`Loaded ${Object.keys(this.cache).length} valid cache entries`);
      } catch (error) {
        // ファイルが存在しない場合は空のオブジェクトで初期化
        this.cache = {};
        logger.debug('No existing cache found, starting with empty cache');
      }
      
      this.initialized = true;
      logger.info('Mock cache service initialized successfully');
    } catch (error) {
      logger.error(`Error initializing mock cache service: ${error.message}`);
      throw error;
    }
  }

  /**
   * キャッシュからデータを取得する
   * @param {string} key - キャッシュキー
   * @returns {Promise<any|null>} キャッシュされたデータまたはnull
   */
  async get(key) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const prefixedKey = `${this.options.prefix}:${key}`;
      logger.debug(`Getting cache for key: ${prefixedKey}`);
      
      const entry = this.cache[prefixedKey];
      
      if (!entry) {
        logger.debug(`Cache miss for key: ${prefixedKey}`);
        return null;
      }
      
      // 期限切れチェック
      if (entry.expiry < Date.now()) {
        logger.debug(`Cache expired for key: ${prefixedKey}`);
        delete this.cache[prefixedKey];
        await this.saveToFile();
        return null;
      }
      
      logger.debug(`Cache hit for key: ${prefixedKey}`);
      return entry.data;
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
      if (!this.initialized) {
        await this.initialize();
      }
      
      const prefixedKey = `${this.options.prefix}:${key}`;
      const ttlValue = ttl || this.options.ttl;
      const expiry = Date.now() + (ttlValue * 1000);
      
      logger.debug(`Setting cache for key: ${prefixedKey}, TTL: ${ttlValue}s`);
      
      this.cache[prefixedKey] = {
        data,
        expiry
      };
      
      await this.saveToFile();
      
      logger.debug(`Cache set successfully for key: ${prefixedKey}`);
      return true;
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
      if (!this.initialized) {
        await this.initialize();
      }
      
      const prefixedKey = `${this.options.prefix}:${key}`;
      logger.debug(`Deleting cache for key: ${prefixedKey}`);
      
      if (this.cache[prefixedKey]) {
        delete this.cache[prefixedKey];
        await this.saveToFile();
        logger.debug(`Cache deleted for key: ${prefixedKey}`);
        return true;
      }
      
      logger.debug(`No cache found to delete for key: ${prefixedKey}`);
      return false;
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
      if (!this.initialized) {
        await this.initialize();
      }
      
      const fullPrefix = `${this.options.prefix}:${prefix}`;
      logger.debug(`Deleting cache by prefix: ${fullPrefix}`);
      
      let count = 0;
      const keysToDelete = Object.keys(this.cache).filter(key => key.startsWith(fullPrefix));
      
      for (const key of keysToDelete) {
        delete this.cache[key];
        count++;
      }
      
      if (count > 0) {
        await this.saveToFile();
      }
      
      logger.debug(`Deleted ${count} cache entries with prefix: ${fullPrefix}`);
      return count;
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
      if (!this.initialized) {
        await this.initialize();
      }
      
      logger.warn('Flushing all cache entries');
      
      const count = Object.keys(this.cache).length;
      this.cache = {};
      
      await this.saveToFile();
      
      logger.warn(`Flushed ${count} cache entries`);
      return count;
    } catch (error) {
      logger.error(`Error flushing cache: ${error.message}`);
      return 0;
    }
  }

  /**
   * キャッシュをファイルに保存する
   * @returns {Promise<void>}
   */
  async saveToFile() {
    try {
      await fs.writeFile(this.options.filePath, JSON.stringify(this.cache, null, 2), 'utf-8');
      logger.debug(`Saved ${Object.keys(this.cache).length} cache entries to file: ${this.options.filePath}`);
    } catch (error) {
      logger.error(`Error saving cache to file: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MockCacheService;
