/**
 * @fileoverview 中期記憶（エピソード記憶）モジュール
 * 
 * このファイルでは、会話履歴やユーザー固有情報など、中程度の持続性を持つ
 * 情報を管理するためのエピソード記憶クラスを定義しています。
 */

import { v4 as uuidv4 } from 'uuid';
import { Memory, MemoryType, MemoryPriority } from '../memory-model.js';
import { getDbClient, getCacheClient } from '../memory-manager.js';

/**
 * エピソード記憶タイプの列挙型
 * @enum {string}
 */
export const EpisodicMemoryType = {
  CONVERSATION: 'conversation',      // 会話履歴
  USER_INTERACTION: 'user_interaction', // ユーザーとの対話
  SESSION: 'session',                // セッション情報
  TASK: 'task',                      // タスク履歴
  EVENT: 'event'                     // イベント記録
};

/**
 * エピソード記憶クラス
 */
export class EpisodicMemory {
  /**
   * EpisodicMemoryのインスタンスを作成する
   * @param {Object} options 設定オプション
   */
  constructor(options = {}) {
    this.dbClient = options.dbClient || getDbClient(options.dbConfig);
    this.cacheClient = options.cacheClient || getCacheClient(options.cacheConfig);
    
    // キャッシュキープレフィックス
    this.cacheKeyPrefix = 'episodic_memory:';
    
    // キャッシュTTL（秒）
    this.cacheTTL = options.cacheTTL || 86400; // 1日
    
    // デフォルト有効期限（ミリ秒）
    this.defaultExpiration = options.defaultExpiration || 30 * 24 * 60 * 60 * 1000; // 30日
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
   * ユーザーキャッシュキーを生成する
   * @param {string} userId ユーザーID
   * @returns {string} ユーザーキャッシュキー
   * @private
   */
  _getUserCacheKey(userId) {
    return `${this.cacheKeyPrefix}user:${userId}`;
  }

  /**
   * 会話キャッシュキーを生成する
   * @param {string} conversationId 会話ID
   * @returns {string} 会話キャッシュキー
   * @private
   */
  _getConversationCacheKey(conversationId) {
    return `${this.cacheKeyPrefix}conversation:${conversationId}`;
  }

  /**
   * エピソード記憶を保存する
   * @param {Object} data 記憶データ
   * @param {string} data.content 記憶内容
   * @param {string} [data.type] 記憶タイプ
   * @param {string} [data.user_id] ユーザーID
   * @param {string} [data.session_id] セッションID
   * @param {string} [data.conversation_id] 会話ID
   * @param {Array} [data.tags] タグ
   * @param {Object} [data.metadata] メタデータ
   * @returns {Promise<string>} 記憶ID
   */
  async store(data) {
    // IDの生成
    const id = data.id || `em_${uuidv4().replace(/-/g, '')}`;
    
    // 現在時刻
    const now = new Date();
    
    // 有効期限の計算
    const expiryDate = new Date(now.getTime() + this.defaultExpiration);
    
    // メモリオブジェクトの作成
    const memory = {
      id,
      content: data.content,
      type: data.type || EpisodicMemoryType.EVENT,
      user_id: data.user_id || 'anonymous',
      session_id: data.session_id || 'default',
      conversation_id: data.conversation_id || null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: data.expires_at || expiryDate.toISOString(),
      priority: data.priority || MemoryPriority.MEDIUM,
      tags: data.tags || [],
      metadata: data.metadata || {}
    };
    
    // データベースに保存
    await this.dbClient.saveMemory(memory);
    
    // キャッシュに保存
    const cacheKey = this._getCacheKey(id);
    await this.cacheClient.set(cacheKey, memory, this.cacheTTL);
    
    // ユーザー一覧に追加
    if (memory.user_id) {
      await this._addToUser(memory.user_id, id);
    }
    
    // 会話一覧に追加
    if (memory.conversation_id) {
      await this._addToConversation(memory.conversation_id, id);
    }
    
    return id;
  }

  /**
   * エピソード記憶を取得する
   * @param {string} id 記憶ID
   * @returns {Promise<Object|null>} 記憶オブジェクト
   */
  async get(id) {
    // キャッシュから取得を試みる
    const cacheKey = this._getCacheKey(id);
    let memory = await this.cacheClient.get(cacheKey);
    
    if (memory) {
      return memory;
    }
    
    // データベースから取得
    memory = await this.dbClient.getMemory(id);
    
    if (memory) {
      // キャッシュに保存
      await this.cacheClient.set(cacheKey, memory, this.cacheTTL);
    }
    
    return memory;
  }

  /**
   * エピソード記憶を更新する
   * @param {string} id 記憶ID
   * @param {Object} data 更新データ
   * @returns {Promise<Object|null>} 更新された記憶
   */
  async update(id, data) {
    // 現在の記憶を取得
    const memory = await this.get(id);
    
    if (!memory) {
      return null;
    }
    
    // 更新データの適用
    const updatedMemory = {
      ...memory,
      ...data,
      id: memory.id, // IDは変更不可
      updated_at: new Date().toISOString()
    };
    
    // データベースに保存
    await this.dbClient.updateMemory(id, updatedMemory);
    
    // キャッシュを更新
    const cacheKey = this._getCacheKey(id);
    await this.cacheClient.set(cacheKey, updatedMemory, this.cacheTTL);
    
    return updatedMemory;
  }

  /**
   * エピソード記憶を削除する
   * @param {string} id 記憶ID
   * @returns {Promise<boolean>} 削除成功の場合はtrue
   */
  async delete(id) {
    // 現在の記憶を取得
    const memory = await this.get(id);
    
    if (!memory) {
      return false;
    }
    
    // データベースから削除
    const success = await this.dbClient.deleteMemory(id);
    
    if (success) {
      // キャッシュから削除
      const cacheKey = this._getCacheKey(id);
      await this.cacheClient.delete(cacheKey);
      
      // ユーザー一覧から削除
      if (memory.user_id) {
        await this._removeFromUser(memory.user_id, id);
      }
      
      // 会話一覧から削除
      if (memory.conversation_id) {
        await this._removeFromConversation(memory.conversation_id, id);
      }
    }
    
    return success;
  }

  /**
   * クエリに基づいてエピソード記憶を検索する
   * @param {Object} query 検索クエリ
   * @param {Object} options 検索オプション
   * @returns {Promise<Array>} 記憶の配列
   */
  async retrieve(query = {}, options = {}) {
    // ユーザーIDによる検索
    if (query.user_id && !query.id && !query.conversation_id) {
      return this._retrieveByUser(query.user_id, query, options);
    }
    
    // 会話IDによる検索
    if (query.conversation_id && !query.id) {
      return this._retrieveByConversation(query.conversation_id, query, options);
    }
    
    // IDによる検索
    if (query.id) {
      const memory = await this.get(query.id);
      return memory ? [memory] : [];
    }
    
    // 一般的なクエリによる検索
    return this.dbClient.listMemories({
      ...query,
      type: query.type || { $in: Object.values(EpisodicMemoryType) }
    }, options);
  }

  /**
   * ユーザーの会話履歴を取得する
   * @param {string} userId ユーザーID
   * @param {Object} options 検索オプション
   * @returns {Promise<Array>} 会話履歴
   */
  async getUserConversations(userId, options = {}) {
    return this.retrieve({
      user_id: userId,
      type: EpisodicMemoryType.CONVERSATION
    }, options);
  }

  /**
   * 特定の会話の履歴を取得する
   * @param {string} conversationId 会話ID
   * @param {Object} options 検索オプション
   * @returns {Promise<Array>} 会話履歴
   */
  async getConversationHistory(conversationId, options = {}) {
    const memories = await this._retrieveByConversation(conversationId, {}, options);
    
    // 作成日時でソート
    memories.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    return memories;
  }

  /**
   * 会話メッセージを追加する
   * @param {string} conversationId 会話ID
   * @param {string} content メッセージ内容
   * @param {string} role メッセージの送信者ロール（'user'または'system'）
   * @param {string} userId ユーザーID
   * @param {Object} metadata メタデータ
   * @returns {Promise<string>} メッセージID
   */
  async addConversationMessage(conversationId, content, role, userId, metadata = {}) {
    return this.store({
      content,
      type: EpisodicMemoryType.CONVERSATION,
      user_id: userId,
      conversation_id: conversationId,
      tags: ['message', role],
      metadata: {
        ...metadata,
        role,
        message_index: await this._getNextMessageIndex(conversationId)
      }
    });
  }

  /**
   * ユーザーに関連するエピソード記憶を取得する
   * @param {string} userId ユーザーID
   * @param {Object} query 追加のクエリ条件
   * @param {Object} options 検索オプション
   * @returns {Promise<Array>} 記憶の配列
   * @private
   */
  async _retrieveByUser(userId, query = {}, options = {}) {
    // ユーザーキャッシュキーから記憶IDを取得
    const userKey = this._getUserCacheKey(userId);
    let ids = await this.cacheClient.get(userKey) || [];
    
    if (ids.length === 0) {
      // キャッシュにない場合はデータベースから検索
      const memories = await this.dbClient.listMemories({
        ...query,
        user_id: userId
      }, options);
      
      // 結果をキャッシュに保存
      ids = memories.map(memory => memory.id);
      if (ids.length > 0) {
        await this.cacheClient.set(userKey, ids, this.cacheTTL);
        
        // 個々のメモリもキャッシュに保存
        for (const memory of memories) {
          const cacheKey = this._getCacheKey(memory.id);
          await this.cacheClient.set(cacheKey, memory, this.cacheTTL);
        }
      }
      
      return memories;
    }
    
    // キャッシュから個々のメモリを取得
    const memories = [];
    for (const id of ids) {
      const memory = await this.get(id);
      if (memory) {
        // クエリ条件に一致するか確認
        let match = true;
        for (const [key, value] of Object.entries(query)) {
          if (key !== 'user_id' && memory[key] !== value) {
            match = false;
            break;
          }
        }
        
        if (match) {
          memories.push(memory);
        }
      }
    }
    
    return memories;
  }

  /**
   * 会話に関連するエピソード記憶を取得する
   * @param {string} conversationId 会話ID
   * @param {Object} query 追加のクエリ条件
   * @param {Object} options 検索オプション
   * @returns {Promise<Array>} 記憶の配列
   * @private
   */
  async _retrieveByConversation(conversationId, query = {}, options = {}) {
    // 会話キャッシュキーから記憶IDを取得
    const conversationKey = this._getConversationCacheKey(conversationId);
    let ids = await this.cacheClient.get(conversationKey) || [];
    
    if (ids.length === 0) {
      // キャッシュにない場合はデータベースから検索
      const memories = await this.dbClient.listMemories({
        ...query,
        conversation_id: conversationId
      }, options);
      
      // 結果をキャッシュに保存
      ids = memories.map(memory => memory.id);
      if (ids.length > 0) {
        await this.cacheClient.set(conversationKey, ids, this.cacheTTL);
        
        // 個々のメモリもキャッシュに保存
        for (const memory of memories) {
          const cacheKey = this._getCacheKey(memory.id);
          await this.cacheClient.set(cacheKey, memory, this.cacheTTL);
        }
      }
      
      return memories;
    }
    
    // キャッシュから個々のメモリを取得
    const memories = [];
    for (const id of ids) {
      const memory = await this.get(id);
      if (memory) {
        // クエリ条件に一致するか確認
        let match = true;
        for (const [key, value] of Object.entries(query)) {
          if (key !== 'conversation_id' && memory[key] !== value) {
            match = false;
            break;
          }
        }
        
        if (match) {
          memories.push(memory);
        }
      }
    }
    
    return memories;
  }

  /**
   * ユーザーに記憶IDを追加する
   * @param {string} userId ユーザーID
   * @param {string} memoryId 記憶ID
   * @returns {Promise<void>}
   * @private
   */
  async _addToUser(userId, memoryId) {
    const userKey = this._getUserCacheKey(userId);
    let ids = await this.cacheClient.get(userKey) || [];
    
    // 既に存在する場合は追加しない
    if (!ids.includes(memoryId)) {
      ids.push(memoryId);
      await this.cacheClient.set(userKey, ids, this.cacheTTL);
    }
  }

  /**
   * ユーザーから記憶IDを削除する
   * @param {string} userId ユーザーID
   * @param {string} memoryId 記憶ID
   * @returns {Promise<void>}
   * @private
   */
  async _removeFromUser(userId, memoryId) {
    const userKey = this._getUserCacheKey(userId);
    let ids = await this.cacheClient.get(userKey) || [];
    
    // IDを削除
    ids = ids.filter(id => id !== memoryId);
    
    if (ids.length > 0) {
      await this.cacheClient.set(userKey, ids, this.cacheTTL);
    } else {
      await this.cacheClient.delete(userKey);
    }
  }

  /**
   * 会話に記憶IDを追加する
   * @param {string} conversationId 会話ID
   * @param {string} memoryId 記憶ID
   * @returns {Promise<void>}
   * @private
   */
  async _addToConversation(conversationId, memoryId) {
    const conversationKey = this._getConversationCacheKey(conversationId);
    let ids = await this.cacheClient.get(conversationKey) || [];
    
    // 既に存在する場合は追加しない
    if (!ids.includes(memoryId)) {
      ids.push(memoryId);
      await this.cacheClient.set(conversationKey, ids, this.cacheTTL);
    }
  }

  /**
   * 会話から記憶IDを削除する
   * @param {string} conversationId 会話ID
   * @param {string} memoryId 記憶ID
   * @returns {Promise<void>}
   * @private
   */
  async _removeFromConversation(conversationId, memoryId) {
    const conversationKey = this._getConversationCacheKey(conversationId);
    let ids = await this.cacheClient.get(conversationKey) || [];
    
    // IDを削除
    ids = ids.filter(id => id !== memoryId);
    
    if (ids.length > 0) {
      await this.cacheClient.set(conversationKey, ids, this.cacheTTL);
    } else {
      await this.cacheClient.delete(conversationKey);
    }
  }

  /**
   * 次のメッセージインデックスを取得する
   * @param {string} conversationId 会話ID
   * @returns {Promise<number>} 次のメッセージインデックス
   * @private
   */
  async _getNextMessageIndex(conversationId) {
    const messages = await this._retrieveByConversation(conversationId, {
      type: EpisodicMemoryType.CONVERSATION
    });
    
    if (messages.length === 0) {
      return 0;
    }
    
    // 現在の最大インデックスを取得
    let maxIndex = -1;
    for (const message of messages) {
      if (message.metadata && message.metadata.message_index !== undefined) {
        maxIndex = Math.max(maxIndex, message.metadata.message_index);
      }
    }
    
    return maxIndex + 1;
  }
}
