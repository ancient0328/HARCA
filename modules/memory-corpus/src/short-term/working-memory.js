/**
 * @fileoverview 短期記憶（作業記憶）モジュール
 * 
 * このファイルでは、揮発性が高く即時アクセス可能な一時的な情報を
 * 保存・管理するための作業記憶クラスを定義しています。
 */

import { v4 as uuidv4 } from 'uuid';
import { Memory, MemoryType, MemoryPriority } from '../memory-model.js';
import { getCacheClient } from '../memory-manager.js';

/**
 * 作業記憶タイプの列挙型
 * @enum {string}
 */
export const WorkingMemoryType = {
  CONTEXT: 'context',          // コンテキスト情報
  USER_INPUT: 'user_input',    // ユーザー入力
  SYSTEM_OUTPUT: 'system_output', // システム出力
  THINKING: 'thinking',        // 思考プロセス
  TEMPORARY: 'temporary'       // 一時的なメモ
};

/**
 * 作業記憶クラス
 */
export class WorkingMemory {
  /**
   * WorkingMemoryのインスタンスを作成する
   * @param {Object} options 設定オプション
   */
  constructor(options = {}) {
    this.cacheClient = options.cacheClient || getCacheClient(options.cacheConfig);
    
    // キャッシュキープレフィックス
    this.cacheKeyPrefix = 'working_memory:';
    
    // デフォルトTTL（秒）
    this.defaultTTL = options.defaultTTL || 7200; // 2時間
    
    // 最大容量
    this.maxCapacity = options.maxCapacity || 200;
    
    // 現在のコンテキストID
    this.currentContextId = options.contextId || null;
  }

  /**
   * キャッシュキーを生成する
   * @param {string} id メモリID
   * @returns {string} キャッシュキー
   * @private
   */
  _getCacheKey(id) {
    return `${this.cacheKeyPrefix}${id}`;
  }

  /**
   * コンテキストキャッシュキーを生成する
   * @param {string} contextId コンテキストID
   * @returns {string} コンテキストキャッシュキー
   * @private
   */
  _getContextCacheKey(contextId) {
    return `${this.cacheKeyPrefix}context:${contextId}`;
  }

  /**
   * 作業記憶を保存する
   * @param {Object} data 記憶データ
   * @param {string} data.content 記憶内容
   * @param {string} [data.type] 記憶タイプ
   * @param {string} [data.context_id] コンテキストID
   * @param {Object} [data.metadata] メタデータ
   * @param {number} [ttl] 有効期限（秒）
   * @returns {Promise<string>} 記憶ID
   */
  async store(data, ttl = this.defaultTTL) {
    // IDの生成
    const id = data.id || `wm_${uuidv4().replace(/-/g, '')}`;
    
    // コンテキストIDの設定
    const contextId = data.context_id || this.currentContextId || 'default';
    
    // 現在時刻
    const now = new Date();
    
    // 有効期限の計算
    const expiryDate = new Date(now.getTime() + ttl * 1000);
    
    // メモリオブジェクトの作成
    const memory = {
      id,
      content: data.content,
      type: data.type || WorkingMemoryType.TEMPORARY,
      context_id: contextId,
      created_at: now.toISOString(),
      expires_at: expiryDate.toISOString(),
      priority: data.priority || MemoryPriority.MEDIUM,
      metadata: data.metadata || {
        source: 'system',
        session_id: 'current'
      }
    };
    
    // キャッシュに保存
    const cacheKey = this._getCacheKey(id);
    await this.cacheClient.set(cacheKey, memory, ttl);
    
    // コンテキスト一覧に追加
    await this._addToContext(contextId, id);
    
    // 容量制限の確認と古いデータの削除
    await this._enforceCapacityLimit(contextId);
    
    return id;
  }

  /**
   * 作業記憶を取得する
   * @param {Object} query 検索クエリ
   * @param {string} [query.id] 記憶ID
   * @param {string} [query.type] 記憶タイプ
   * @param {string} [query.context_id] コンテキストID
   * @returns {Promise<Array>} 記憶の配列
   */
  async retrieve(query = {}) {
    // IDによる取得
    if (query.id) {
      const cacheKey = this._getCacheKey(query.id);
      const memory = await this.cacheClient.get(cacheKey);
      return memory ? [memory] : [];
    }
    
    // コンテキストIDの設定
    const contextId = query.context_id || this.currentContextId || 'default';
    
    // コンテキスト内のすべてのIDを取得
    const contextKey = this._getContextCacheKey(contextId);
    const ids = await this.cacheClient.get(contextKey) || [];
    
    if (ids.length === 0) {
      return [];
    }
    
    // 各IDのメモリを取得
    const memories = [];
    for (const id of ids) {
      const cacheKey = this._getCacheKey(id);
      const memory = await this.cacheClient.get(cacheKey);
      if (memory) {
        memories.push(memory);
      }
    }
    
    // タイプによるフィルタリング
    if (query.type) {
      return memories.filter(memory => memory.type === query.type);
    }
    
    return memories;
  }

  /**
   * 作業記憶を更新する
   * @param {string} id 記憶ID
   * @param {Object} data 更新データ
   * @param {number} [ttl] 新しい有効期限（秒）
   * @returns {Promise<Object>} 更新された記憶
   */
  async update(id, data, ttl = this.defaultTTL) {
    const cacheKey = this._getCacheKey(id);
    const memory = await this.cacheClient.get(cacheKey);
    
    if (!memory) {
      throw new Error(`Memory with ID ${id} not found`);
    }
    
    // 更新データの適用
    const updatedMemory = {
      ...memory,
      ...data,
      id: memory.id, // IDは変更不可
      updated_at: new Date().toISOString()
    };
    
    // キャッシュに保存
    await this.cacheClient.set(cacheKey, updatedMemory, ttl);
    
    return updatedMemory;
  }

  /**
   * 作業記憶を削除する
   * @param {string} id 記憶ID
   * @returns {Promise<boolean>} 削除成功の場合はtrue
   */
  async delete(id) {
    const cacheKey = this._getCacheKey(id);
    const memory = await this.cacheClient.get(cacheKey);
    
    if (!memory) {
      return false;
    }
    
    // キャッシュから削除
    await this.cacheClient.delete(cacheKey);
    
    // コンテキスト一覧から削除
    await this._removeFromContext(memory.context_id, id);
    
    return true;
  }

  /**
   * 現在のコンテキストを設定する
   * @param {string} contextId コンテキストID
   */
  setCurrentContext(contextId) {
    this.currentContextId = contextId;
  }

  /**
   * 現在のコンテキストを取得する
   * @returns {string} 現在のコンテキストID
   */
  getCurrentContext() {
    return this.currentContextId;
  }

  /**
   * コンテキスト内のすべての記憶を取得する
   * @param {string} [contextId] コンテキストID（省略時は現在のコンテキスト）
   * @returns {Promise<Array>} 記憶の配列
   */
  async getContextMemories(contextId) {
    const targetContextId = contextId || this.currentContextId || 'default';
    return this.retrieve({ context_id: targetContextId });
  }

  /**
   * コンテキスト内のすべての記憶を削除する
   * @param {string} [contextId] コンテキストID（省略時は現在のコンテキスト）
   * @returns {Promise<number>} 削除された記憶の数
   */
  async clearContext(contextId) {
    const targetContextId = contextId || this.currentContextId || 'default';
    const memories = await this.retrieve({ context_id: targetContextId });
    
    let deletedCount = 0;
    for (const memory of memories) {
      const success = await this.delete(memory.id);
      if (success) {
        deletedCount++;
      }
    }
    
    // コンテキストキーも削除
    const contextKey = this._getContextCacheKey(targetContextId);
    await this.cacheClient.delete(contextKey);
    
    return deletedCount;
  }

  /**
   * コンテキストに記憶IDを追加する
   * @param {string} contextId コンテキストID
   * @param {string} memoryId 記憶ID
   * @returns {Promise<void>}
   * @private
   */
  async _addToContext(contextId, memoryId) {
    const contextKey = this._getContextCacheKey(contextId);
    let ids = await this.cacheClient.get(contextKey) || [];
    
    // 既に存在する場合は追加しない
    if (!ids.includes(memoryId)) {
      ids.push(memoryId);
      await this.cacheClient.set(contextKey, ids, this.defaultTTL);
    }
  }

  /**
   * コンテキストから記憶IDを削除する
   * @param {string} contextId コンテキストID
   * @param {string} memoryId 記憶ID
   * @returns {Promise<void>}
   * @private
   */
  async _removeFromContext(contextId, memoryId) {
    const contextKey = this._getContextCacheKey(contextId);
    let ids = await this.cacheClient.get(contextKey) || [];
    
    // IDを削除
    ids = ids.filter(id => id !== memoryId);
    
    if (ids.length > 0) {
      await this.cacheClient.set(contextKey, ids, this.defaultTTL);
    } else {
      await this.cacheClient.delete(contextKey);
    }
  }

  /**
   * 容量制限を適用する
   * @param {string} contextId コンテキストID
   * @returns {Promise<void>}
   * @private
   */
  async _enforceCapacityLimit(contextId) {
    const contextKey = this._getContextCacheKey(contextId);
    let ids = await this.cacheClient.get(contextKey) || [];
    
    if (ids.length <= this.maxCapacity) {
      return;
    }
    
    // 容量を超えた分を削除（古いものから）
    const memories = await this.retrieve({ context_id: contextId });
    
    // 作成日時でソート（古い順）
    memories.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    // 削除すべき数を計算
    const deleteCount = memories.length - this.maxCapacity;
    
    // 古いものから削除
    for (let i = 0; i < deleteCount; i++) {
      await this.delete(memories[i].id);
    }
  }
}
