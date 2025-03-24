/**
 * @fileoverview コンテキスト管理モジュール
 * 
 * このファイルでは、会話やタスクのコンテキストを管理するための
 * ContextManagerクラスを定義しています。
 */

import { v4 as uuidv4 } from 'uuid';
import { WorkingMemory, WorkingMemoryType } from './working-memory.js';

/**
 * コンテキストタイプの列挙型
 * @enum {string}
 */
export const ContextType = {
  CONVERSATION: 'conversation',  // 会話コンテキスト
  TASK: 'task',                  // タスクコンテキスト
  SESSION: 'session',            // セッションコンテキスト
  THINKING: 'thinking'           // 思考コンテキスト
};

/**
 * コンテキスト管理クラス
 */
export class ContextManager {
  /**
   * ContextManagerのインスタンスを作成する
   * @param {Object} options 設定オプション
   */
  constructor(options = {}) {
    this.workingMemory = options.workingMemory || new WorkingMemory(options);
    
    // アクティブコンテキスト
    this.activeContexts = new Map();
    
    // コンテキスト履歴の最大サイズ
    this.maxContextHistory = options.maxContextHistory || 10;
    
    // セッションID
    this.sessionId = options.sessionId || `session_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * 新しいコンテキストを作成する
   * @param {string} type コンテキストタイプ
   * @param {Object} metadata メタデータ
   * @returns {Promise<string>} コンテキストID
   */
  async createContext(type = ContextType.CONVERSATION, metadata = {}) {
    // コンテキストIDの生成
    const contextId = `ctx_${uuidv4().replace(/-/g, '')}`;
    
    // コンテキスト情報
    const contextInfo = {
      id: contextId,
      type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      session_id: this.sessionId,
      metadata: {
        ...metadata,
        parent_context: this.getActiveContext(type)
      }
    };
    
    // 作業記憶に保存
    await this.workingMemory.store({
      content: JSON.stringify(contextInfo),
      type: WorkingMemoryType.CONTEXT,
      context_id: contextId,
      metadata: {
        context_type: type,
        session_id: this.sessionId
      }
    });
    
    // アクティブコンテキストを更新
    this._setActiveContext(type, contextId);
    
    // 作業記憶の現在のコンテキストを設定
    this.workingMemory.setCurrentContext(contextId);
    
    return contextId;
  }

  /**
   * コンテキストを取得する
   * @param {string} contextId コンテキストID
   * @returns {Promise<Object|null>} コンテキスト情報
   */
  async getContext(contextId) {
    const results = await this.workingMemory.retrieve({
      type: WorkingMemoryType.CONTEXT,
      context_id: contextId
    });
    
    if (results.length === 0) {
      return null;
    }
    
    try {
      return JSON.parse(results[0].content);
    } catch (error) {
      console.error(`Error parsing context: ${error.message}`);
      return null;
    }
  }

  /**
   * コンテキストを更新する
   * @param {string} contextId コンテキストID
   * @param {Object} metadata 更新するメタデータ
   * @returns {Promise<Object|null>} 更新されたコンテキスト情報
   */
  async updateContext(contextId, metadata = {}) {
    const context = await this.getContext(contextId);
    
    if (!context) {
      return null;
    }
    
    // メタデータを更新
    const updatedContext = {
      ...context,
      updated_at: new Date().toISOString(),
      metadata: {
        ...context.metadata,
        ...metadata
      }
    };
    
    // 作業記憶に保存
    const memories = await this.workingMemory.retrieve({
      type: WorkingMemoryType.CONTEXT,
      context_id: contextId
    });
    
    if (memories.length > 0) {
      await this.workingMemory.update(memories[0].id, {
        content: JSON.stringify(updatedContext)
      });
    }
    
    return updatedContext;
  }

  /**
   * コンテキストにアイテムを追加する
   * @param {string} contextId コンテキストID
   * @param {Object} item 追加するアイテム
   * @param {string} itemType アイテムタイプ
   * @returns {Promise<string>} アイテムID
   */
  async addToContext(contextId, item, itemType = WorkingMemoryType.TEMPORARY) {
    // コンテキストの存在確認
    const context = await this.getContext(contextId);
    
    if (!context) {
      throw new Error(`Context with ID ${contextId} not found`);
    }
    
    // アイテムをコンテキストに追加
    const itemId = await this.workingMemory.store({
      content: typeof item === 'string' ? item : JSON.stringify(item),
      type: itemType,
      context_id: contextId,
      metadata: {
        context_type: context.type,
        session_id: this.sessionId,
        added_at: new Date().toISOString()
      }
    });
    
    // コンテキストの更新日時を更新
    await this.updateContext(contextId, {
      last_item_added: new Date().toISOString()
    });
    
    return itemId;
  }

  /**
   * コンテキストからアイテムを取得する
   * @param {string} contextId コンテキストID
   * @param {string} [itemType] アイテムタイプでフィルタリング
   * @returns {Promise<Array>} アイテムの配列
   */
  async getContextItems(contextId, itemType = null) {
    // コンテキストの存在確認
    const context = await this.getContext(contextId);
    
    if (!context) {
      return [];
    }
    
    // クエリの構築
    const query = {
      context_id: contextId
    };
    
    if (itemType) {
      query.type = itemType;
    } else {
      // コンテキスト自体は除外
      query.type = { $ne: WorkingMemoryType.CONTEXT };
    }
    
    // アイテムの取得
    const items = await this.workingMemory.retrieve(query);
    
    // 作成日時でソート
    items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    return items;
  }

  /**
   * 指定されたタイプのアクティブコンテキストを取得する
   * @param {string} type コンテキストタイプ
   * @returns {string|null} アクティブコンテキストID
   */
  getActiveContext(type = ContextType.CONVERSATION) {
    return this.activeContexts.get(type) || null;
  }

  /**
   * すべてのアクティブコンテキストを取得する
   * @returns {Object} タイプごとのアクティブコンテキストID
   */
  getAllActiveContexts() {
    const contexts = {};
    for (const [type, id] of this.activeContexts.entries()) {
      contexts[type] = id;
    }
    return contexts;
  }

  /**
   * コンテキストを切り替える
   * @param {string} contextId 切り替え先のコンテキストID
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async switchContext(contextId) {
    const context = await this.getContext(contextId);
    
    if (!context) {
      return false;
    }
    
    // アクティブコンテキストを更新
    this._setActiveContext(context.type, contextId);
    
    // 作業記憶の現在のコンテキストを設定
    this.workingMemory.setCurrentContext(contextId);
    
    return true;
  }

  /**
   * コンテキスト履歴を取得する
   * @param {string} type コンテキストタイプ
   * @param {number} limit 取得する履歴の最大数
   * @returns {Promise<Array>} コンテキスト履歴
   */
  async getContextHistory(type = ContextType.CONVERSATION, limit = this.maxContextHistory) {
    // セッション内のすべてのコンテキストを取得
    const allContexts = await this.workingMemory.retrieve({
      type: WorkingMemoryType.CONTEXT
    });
    
    // 指定されたタイプのコンテキストをフィルタリング
    const typeContexts = allContexts.filter(item => {
      try {
        const context = JSON.parse(item.content);
        return context.type === type;
      } catch (error) {
        return false;
      }
    });
    
    // 作成日時の降順でソート（新しい順）
    typeContexts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // 指定された数だけ取得
    const limitedContexts = typeContexts.slice(0, limit);
    
    // コンテキスト情報を抽出
    return limitedContexts.map(item => {
      try {
        return JSON.parse(item.content);
      } catch (error) {
        return null;
      }
    }).filter(context => context !== null);
  }

  /**
   * コンテキストを削除する
   * @param {string} contextId コンテキストID
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async deleteContext(contextId) {
    // コンテキストの存在確認
    const context = await this.getContext(contextId);
    
    if (!context) {
      return false;
    }
    
    // コンテキスト内のすべてのアイテムを削除
    await this.workingMemory.clearContext(contextId);
    
    // アクティブコンテキストから削除
    if (this.activeContexts.get(context.type) === contextId) {
      this.activeContexts.delete(context.type);
      
      // 親コンテキストがあれば、それをアクティブにする
      if (context.metadata && context.metadata.parent_context) {
        this._setActiveContext(context.type, context.metadata.parent_context);
        this.workingMemory.setCurrentContext(context.metadata.parent_context);
      }
    }
    
    return true;
  }

  /**
   * アクティブコンテキストを設定する
   * @param {string} type コンテキストタイプ
   * @param {string} contextId コンテキストID
   * @private
   */
  _setActiveContext(type, contextId) {
    this.activeContexts.set(type, contextId);
  }
}
