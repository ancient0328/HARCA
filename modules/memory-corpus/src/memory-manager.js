/**
 * @fileoverview メモリマネージャー
 * 
 * このファイルでは、メモリエンティティの作成、取得、更新、削除などの
 * 基本的なCRUD操作を提供するメモリマネージャークラスを定義しています。
 */

import { Memory } from './memory-model.js';

// モックデータベースクライアント（テスト用）
class MockDbClient {
  constructor() {
    this.memories = new Map();
  }

  async connect() {
    return true;
  }

  async saveMemory(memory) {
    this.memories.set(memory.id, { ...memory });
    return memory.id;
  }

  async getMemory(id) {
    return this.memories.get(id) || null;
  }

  async updateMemory(id, data) {
    const memory = this.memories.get(id);
    if (!memory) return null;
    
    const updatedMemory = { ...memory, ...data, id };
    this.memories.set(id, updatedMemory);
    return updatedMemory;
  }

  async deleteMemory(id) {
    const exists = this.memories.has(id);
    this.memories.delete(id);
    return exists;
  }

  async listMemories(filter = {}, options = {}) {
    let results = Array.from(this.memories.values());
    
    // フィルタリング
    if (filter.type) {
      results = results.filter(mem => mem.type === filter.type);
    }
    
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(mem => 
        filter.tags.every(tag => mem.tags.includes(tag))
      );
    }
    
    // ソート
    if (options.sortBy) {
      results.sort((a, b) => {
        if (a[options.sortBy] < b[options.sortBy]) return -1;
        if (a[options.sortBy] > b[options.sortBy]) return 1;
        return 0;
      });
      
      if (options.sortOrder === 'desc') {
        results.reverse();
      }
    }
    
    // ページネーション
    const limit = options.limit || results.length;
    const offset = options.offset || 0;
    results = results.slice(offset, offset + limit);
    
    return {
      items: results,
      total: this.memories.size,
      limit,
      offset
    };
  }
}

// モックキャッシュクライアント（テスト用）
class MockCacheClient {
  constructor() {
    this.cache = new Map();
  }

  async get(key) {
    return this.cache.get(key) || null;
  }

  async set(key, value, ttl = 3600) {
    this.cache.set(key, value);
    return true;
  }

  async delete(key) {
    return this.cache.delete(key);
  }
}

// デフォルトのデータベースとキャッシュクライアント
let defaultDbClient = null;
let defaultCacheClient = null;

// データベースクライアントの取得
export const getDbClient = () => {
  if (!defaultDbClient) {
    defaultDbClient = new MockDbClient();
  }
  return defaultDbClient;
};

// キャッシュクライアントの取得
export const getCacheClient = () => {
  if (!defaultCacheClient) {
    defaultCacheClient = new MockCacheClient();
  }
  return defaultCacheClient;
};

/**
 * メモリマネージャークラス
 */
export class MemoryManager {
  /**
   * MemoryManagerのインスタンスを作成する
   * @param {Object} options 設定オプション
   * @param {Object} options.dbConfig データベース設定
   * @param {Object} options.cacheConfig キャッシュ設定
   */
  constructor(options = {}) {
    this.dbClient = getDbClient(options.dbConfig);
    this.cacheClient = getCacheClient(options.cacheConfig);
    
    // キャッシュキープレフィックス
    this.cacheKeyPrefix = 'memory:';
    
    // キャッシュTTL（秒）
    this.cacheTTL = options.cacheTTL || 3600; // デフォルト1時間
  }
  
  /**
   * メモリIDに基づくキャッシュキーを生成する
   * @param {string} memoryId メモリID
   * @returns {string} キャッシュキー
   * @private
   */
  _getCacheKey(memoryId) {
    return `${this.cacheKeyPrefix}${memoryId}`;
  }
  
  /**
   * 新しいメモリを作成する
   * @param {Object} memoryData メモリデータ
   * @returns {Promise<string>} 作成されたメモリのID
   */
  async createMemory(memoryData) {
    try {
      // メモリインスタンスの作成
      const memory = new Memory(memoryData);
      
      // データベースに保存
      await this.dbClient.saveMemory(memory);
      
      // キャッシュに保存
      const cacheKey = this._getCacheKey(memory.id);
      await this.cacheClient.set(cacheKey, memory);
      
      return memory.id;
    } catch (error) {
      throw new Error(`Failed to create memory: ${error.message}`);
    }
  }
  
  /**
   * IDによりメモリを取得する
   * @param {string} memoryId メモリID
   * @returns {Promise<Memory|null>} 取得したメモリ、存在しない場合はnull
   */
  async getMemory(memoryId) {
    try {
      // キャッシュから取得を試みる
      const cacheKey = this._getCacheKey(memoryId);
      const cachedMemory = await this.cacheClient.get(cacheKey);
      
      if (cachedMemory) {
        return cachedMemory;
      }
      
      // データベースから取得
      const memoryData = await this.dbClient.getMemory(memoryId);
      
      if (!memoryData) {
        return null;
      }
      
      // メモリインスタンスの作成
      const memory = memoryData instanceof Memory ? memoryData : new Memory(memoryData);
      
      // キャッシュに保存
      await this.cacheClient.set(cacheKey, memory, this.cacheTTL);
      
      return memory;
    } catch (error) {
      throw new Error(`Failed to get memory: ${error.message}`);
    }
  }
  
  /**
   * メモリを更新する
   * @param {string} memoryId メモリID
   * @param {Object} updateData 更新データ
   * @returns {Promise<Memory|null>} 更新されたメモリ、存在しない場合はnull
   */
  async updateMemory(memoryId, updateData) {
    try {
      // 現在のメモリを取得
      const currentMemory = await this.getMemory(memoryId);
      
      if (!currentMemory) {
        return null;
      }
      
      // 更新を適用
      currentMemory.update(updateData);
      
      // データベースを更新
      await this.dbClient.updateMemory(memoryId, currentMemory);
      
      // キャッシュを更新
      const cacheKey = this._getCacheKey(memoryId);
      await this.cacheClient.set(cacheKey, currentMemory, this.cacheTTL);
      
      return currentMemory;
    } catch (error) {
      throw new Error(`Failed to update memory: ${error.message}`);
    }
  }
  
  /**
   * メモリを削除する
   * @param {string} memoryId メモリID
   * @returns {Promise<boolean>} 削除成功の場合はtrue
   */
  async deleteMemory(memoryId) {
    try {
      // データベースから削除
      const result = await this.dbClient.deleteMemory(memoryId);
      
      if (!result) {
        return false;
      }
      
      // キャッシュから削除
      const cacheKey = this._getCacheKey(memoryId);
      await this.cacheClient.delete(cacheKey);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete memory: ${error.message}`);
    }
  }
  
  /**
   * 条件に基づいてメモリを一括取得する
   * @param {Object} filter フィルタ条件
   * @param {Object} options 検索オプション
   * @returns {Promise<Object>} 取得結果
   */
  async listMemories(filter = {}, options = {}) {
    try {
      return await this.dbClient.listMemories(filter, options);
    } catch (error) {
      throw new Error(`Failed to list memories: ${error.message}`);
    }
  }
  
  /**
   * 複数のメモリを一括で作成する
   * @param {Array<Object>} memoriesData メモリデータの配列
   * @returns {Promise<Array<string>>} 作成されたメモリのID配列
   */
  async bulkCreateMemories(memoriesData) {
    try {
      const ids = [];
      for (const memoryData of memoriesData) {
        const id = await this.createMemory(memoryData);
        ids.push(id);
      }
      return ids;
    } catch (error) {
      throw new Error(`Failed to bulk create memories: ${error.message}`);
    }
  }
  
  /**
   * 複数のメモリを一括で削除する
   * @param {Array<string>} memoryIds 削除対象のメモリID配列
   * @returns {Promise<{success: number, failed: number}>} 削除結果
   */
  async bulkDeleteMemories(memoryIds) {
    let success = 0;
    let failed = 0;
    
    try {
      for (const id of memoryIds) {
        const result = await this.deleteMemory(id);
        if (result) {
          success++;
        } else {
          failed++;
        }
      }
      
      return { success, failed };
    } catch (error) {
      throw new Error(`Failed to bulk delete memories: ${error.message}`);
    }
  }
}
