/**
 * Sequential Thinking統合モジュールキャッシュ
 * 
 * このモジュールは、Sequential Thinking統合モジュールのキャッシュ機能を提供します。
 * メモリキャッシュを実装し、ツール推奨や思考プロセスの結果をキャッシュします。
 */

import { config } from './config.js';
import { logger } from './logger.js';

/**
 * シンプルなメモリキャッシュ実装
 */
class MemoryCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || config.cache.maxSize;
    this.ttl = options.ttl || config.cache.ttl;
    this.cache = new Map();
    this.enabled = options.enabled !== undefined ? options.enabled : config.cache.enabled;
    
    if (config.debug) {
      logger.debug(`[Cache] Initialized with maxSize=${this.maxSize}, ttl=${this.ttl}ms, enabled=${this.enabled}`);
    }
    
    // 定期的な期限切れエントリのクリーンアップ
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // 1分ごとにクリーンアップ
  }
  
  /**
   * キーに基づいて値を取得
   * @param {string} key キャッシュキー
   * @returns {any|null} キャッシュされた値、または存在しない場合はnull
   */
  get(key) {
    if (!this.enabled) return null;
    
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // 期限切れチェック
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    if (config.debug) {
      logger.debug(`[Cache] Hit: ${key}`);
    }
    
    return entry.value;
  }
  
  /**
   * キーと値をキャッシュに設定
   * @param {string} key キャッシュキー
   * @param {any} value キャッシュする値
   * @param {number} [ttl] このエントリの有効期限（ミリ秒）
   */
  set(key, value, ttl) {
    if (!this.enabled) return;
    
    // キャッシュサイズの制限を超えた場合、最も古いエントリを削除
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      
      if (config.debug) {
        logger.debug(`[Cache] Evicted oldest entry: ${oldestKey}`);
      }
    }
    
    const expiry = Date.now() + (ttl || this.ttl);
    this.cache.set(key, { value, expiry });
    
    if (config.debug) {
      logger.debug(`[Cache] Set: ${key}, expires in ${(ttl || this.ttl) / 1000}s`);
    }
  }
  
  /**
   * キャッシュからキーを削除
   * @param {string} key キャッシュキー
   * @returns {boolean} 削除が成功したかどうか
   */
  delete(key) {
    if (!this.enabled) return false;
    return this.cache.delete(key);
  }
  
  /**
   * キャッシュをクリア
   */
  clear() {
    if (!this.enabled) return;
    this.cache.clear();
    
    if (config.debug) {
      logger.debug('[Cache] Cleared all entries');
    }
  }
  
  /**
   * 期限切れのエントリをクリーンアップ
   */
  cleanup() {
    if (!this.enabled) return;
    
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0 && config.debug) {
      logger.debug(`[Cache] Cleaned up ${expiredCount} expired entries`);
    }
  }
  
  /**
   * キャッシュの統計情報を取得
   * @returns {Object} キャッシュの統計情報
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      enabled: this.enabled
    };
  }
  
  /**
   * リソースの解放
   */
  dispose() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// デフォルトのキャッシュインスタンス
const defaultCache = new MemoryCache();

export { MemoryCache, defaultCache };
