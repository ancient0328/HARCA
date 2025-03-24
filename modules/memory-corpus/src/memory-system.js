/**
 * @fileoverview メモリ管理システム
 * 
 * このファイルでは、短期記憶、中期記憶、長期記憶の各層を統合するメモリ管理システムを定義しています。
 * メモリ管理システムは、記憶の取得、保存、更新、削除などの基本操作と、
 * 記憶の強化、減衰、統合などの高度な機能を提供します。
 */

import { initializeShortTermMemory } from './short-term/index.js';
import { initializeMidTermMemory } from './mid-term/index.js';
import { initializeLongTermMemory } from './long-term/index.js';
import { MemoryType } from './memory-model.js';
import { MemoryManager } from './memory-manager.js';
import { MemorySearch } from './memory-search.js';
import { MemoryOptimizer } from './memory-optimizer.js';
import { MemoryIntegration } from './memory-integration.js';
import { MemoryReinforcement } from './memory-reinforcement.js';
import { SequentialThinkingIntegration } from './sequential-thinking-integration.js';

/**
 * メモリ管理システムクラス
 */
export class MemorySystem {
  /**
   * MemorySystemのインスタンスを作成する
   * @param {Object} options 設定オプション
   */
  constructor(options = {}) {
    // 基本コンポーネント
    this.memoryManager = options.memoryManager || new MemoryManager(options);
    this.memorySearch = options.memorySearch || new MemorySearch(options);
    this.memoryOptimizer = options.memoryOptimizer || new MemoryOptimizer(options);
    
    // 短期記憶モジュール
    const shortTermMemory = initializeShortTermMemory(options);
    this.workingMemory = shortTermMemory.workingMemory;
    this.contextManager = shortTermMemory.contextManager;
    
    // 中期記憶モジュール
    const midTermMemory = initializeMidTermMemory(options);
    this.episodicMemory = midTermMemory.episodicMemory;
    this.userProfile = midTermMemory.userProfile;
    
    // 長期記憶モジュール
    const longTermMemory = initializeLongTermMemory(options);
    this.knowledgeBase = longTermMemory.knowledgeBase;
    this.ruleEngine = longTermMemory.ruleEngine;
    
    // 記憶強化・減衰モジュール
    this.memoryReinforcement = options.memoryReinforcement || new MemoryReinforcement({
      ...options,
      memorySystem: this,
      memoryManager: this.memoryManager
    });
    
    // 記憶統合モジュール
    this.memoryIntegration = options.memoryIntegration || new MemoryIntegration({
      ...options,
      memorySystem: this,
      memoryManager: this.memoryManager,
      memorySearch: this.memorySearch,
      memoryOptimizer: this.memoryOptimizer
    });
    
    // 思考プロセス連携モジュール
    this.sequentialThinkingIntegration = options.sequentialThinkingIntegration || new SequentialThinkingIntegration({
      ...options,
      memorySystem: this,
      workingMemory: this.workingMemory,
      contextManager: this.contextManager,
      episodicMemory: this.episodicMemory,
      knowledgeBase: this.knowledgeBase,
      ruleEngine: this.ruleEngine
    });
    
    // 設定
    this.config = {
      // 記憶の強化・減衰設定
      reinforcement: {
        // 強化係数（高いほど強化効果が大きい）
        strengthFactor: options.strengthFactor || 0.2,
        // 減衰係数（高いほど減衰が速い）
        decayFactor: options.decayFactor || 0.05,
        // 強化の閾値（この値以上の重要度を持つ記憶のみ強化）
        strengthThreshold: options.strengthThreshold || 0.3,
        // 記憶の最大強度
        maxStrength: options.maxStrength || 1.0
      },
      
      // 記憶の統合設定
      integration: {
        // 類似度の閾値（この値以上の類似度を持つ記憶を統合候補とする）
        similarityThreshold: options.similarityThreshold || 0.85,
        // 統合の最小記憶数（この数以上の記憶がある場合に統合を検討）
        minMemoriesForIntegration: options.minMemoriesForIntegration || 3,
        // 統合の最大記憶数（この数以上の記憶は強制的に統合）
        maxMemoriesBeforeForceIntegration: options.maxMemoriesBeforeForceIntegration || 100
      },
      
      // 記憶の検索設定
      search: {
        // デフォルトの検索結果数
        defaultLimit: options.defaultSearchLimit || 10,
        // 最大検索結果数
        maxLimit: options.maxSearchLimit || 100,
        // 検索結果のキャッシュ有効期間（ミリ秒）
        cacheTTL: options.searchCacheTTL || 60 * 1000
      }
    };
    
    // イベントリスナー
    this.eventListeners = new Map();
  }

  /**
   * 記憶を作成する
   * @param {Object} memoryData 記憶データ
   * @returns {Promise<string>} 記憶ID
   */
  async createMemory(memoryData) {
    try {
      // 記憶の種類に基づいて適切なストレージを選択
      const memoryType = memoryData.type || MemoryType.OBSERVATION;
      const importance = memoryData.metadata?.importance || 0.5;
      
      // 記憶IDを取得
      let memoryId;
      
      // 記憶の種類に基づいて適切なストレージに保存
      if (this._isShortTermMemory(memoryType, importance)) {
        // 短期記憶に保存
        memoryId = await this.workingMemory.store(memoryData);
        
        // 重要度が高い場合は中期記憶にも保存
        if (importance >= 0.7) {
          await this.episodicMemory.store(memoryData);
        }
      } else if (this._isMidTermMemory(memoryType, importance)) {
        // 中期記憶に保存
        memoryId = await this.episodicMemory.store(memoryData);
        
        // ユーザープロファイル関連の記憶の場合
        if (memoryType === MemoryType.PREFERENCE) {
          await this.userProfile.updatePreference(memoryData);
        }
      } else {
        // 長期記憶に保存
        memoryId = await this.knowledgeBase.store(memoryData);
      }
      
      // イベント発火
      this._triggerEvent('memory:created', { 
        id: memoryId, 
        type: memoryType,
        importance
      });
      
      return memoryId;
    } catch (error) {
      console.error(`Failed to create memory: ${error.message}`);
      throw new Error(`Failed to create memory: ${error.message}`);
    }
  }

  /**
   * 記憶を取得する
   * @param {string} memoryId 記憶ID
   * @returns {Promise<Object|null>} 記憶オブジェクト
   */
  async getMemory(memoryId) {
    try {
      // 各ストレージから順番に検索
      let memory = await this.workingMemory.get(memoryId);
      
      if (!memory) {
        memory = await this.episodicMemory.get(memoryId);
      }
      
      if (!memory) {
        memory = await this.knowledgeBase.get(memoryId);
      }
      
      // 記憶が見つかった場合、アクセス回数を増やして強化
      if (memory) {
        await this._strengthenMemory(memory);
      }
      
      return memory;
    } catch (error) {
      console.error(`Failed to get memory: ${error.message}`);
      return null;
    }
  }

  /**
   * 記憶を更新する
   * @param {string} memoryId 記憶ID
   * @param {Object} updateData 更新データ
   * @returns {Promise<Object|null>} 更新された記憶
   */
  async updateMemory(memoryId, updateData) {
    try {
      // 記憶を取得
      const memory = await this.getMemory(memoryId);
      
      if (!memory) {
        return null;
      }
      
      // 記憶の種類に基づいて適切なストレージを選択
      const memoryType = memory.type || MemoryType.OBSERVATION;
      const importance = updateData.metadata?.importance || memory.metadata?.importance || 0.5;
      
      let updatedMemory;
      
      // 記憶の種類に基づいて適切なストレージを更新
      if (this._isShortTermMemory(memoryType, importance)) {
        updatedMemory = await this.workingMemory.update(memoryId, updateData);
        
        // 重要度が高い場合は中期記憶も更新
        if (importance >= 0.7) {
          await this.episodicMemory.update(memoryId, updateData);
        }
      } else if (this._isMidTermMemory(memoryType, importance)) {
        updatedMemory = await this.episodicMemory.update(memoryId, updateData);
        
        // ユーザープロファイル関連の記憶の場合
        if (memoryType === MemoryType.PREFERENCE) {
          await this.userProfile.updatePreference(updateData);
        }
      } else {
        updatedMemory = await this.knowledgeBase.update(memoryId, updateData);
      }
      
      // イベント発火
      this._triggerEvent('memory:updated', { 
        id: memoryId, 
        type: memoryType,
        importance
      });
      
      return updatedMemory;
    } catch (error) {
      console.error(`Failed to update memory: ${error.message}`);
      return null;
    }
  }

  /**
   * 記憶を削除する
   * @param {string} memoryId 記憶ID
   * @returns {Promise<boolean>} 削除成功の場合はtrue
   */
  async deleteMemory(memoryId) {
    try {
      // 各ストレージから削除を試みる
      const deletedFromWorking = await this.workingMemory.delete(memoryId);
      const deletedFromEpisodic = await this.episodicMemory.delete(memoryId);
      const deletedFromKnowledge = await this.knowledgeBase.delete(memoryId);
      
      const deleted = deletedFromWorking || deletedFromEpisodic || deletedFromKnowledge;
      
      if (deleted) {
        // イベント発火
        this._triggerEvent('memory:deleted', { id: memoryId });
      }
      
      return deleted;
    } catch (error) {
      console.error(`Failed to delete memory: ${error.message}`);
      return false;
    }
  }

  /**
   * テキストで記憶を検索する
   * @param {Object} options 検索オプション
   * @param {string} options.query 検索クエリ
   * @param {Array<string>} options.types 記憶タイプの配列
   * @param {number} options.limit 結果の最大数
   * @param {number} options.threshold 類似度の閾値
   * @returns {Promise<Array>} 検索結果の配列
   */
  async searchMemories(options = {}) {
    try {
      const query = options.query || '';
      const types = options.types || Object.values(MemoryType);
      const limit = Math.min(options.limit || this.config.search.defaultLimit, this.config.search.maxLimit);
      const threshold = options.threshold || 0.7;
      
      // 各ストレージから検索結果を取得
      const workingResults = await this.workingMemory.search({
        query,
        types,
        limit: limit * 2, // より多くの候補を取得
        threshold
      });
      
      const episodicResults = await this.episodicMemory.search({
        query,
        types,
        limit: limit * 2,
        threshold
      });
      
      const knowledgeResults = await this.knowledgeBase.search({
        query,
        types,
        limit: limit * 2,
        threshold
      });
      
      // 結果をマージして重複を除去
      const allResults = [...workingResults, ...episodicResults, ...knowledgeResults];
      
      // 重複を除去（IDベース）
      const uniqueResults = this._deduplicateResults(allResults);
      
      // 重要度と関連度でソート
      const sortedResults = this._sortResultsByRelevance(uniqueResults, query);
      
      // 上位N件を返す
      return sortedResults.slice(0, limit);
    } catch (error) {
      console.error(`Failed to search memories: ${error.message}`);
      return [];
    }
  }

  /**
   * コンテキストに基づいて関連する記憶を取得する
   * @param {Object} context コンテキスト
   * @param {Object} options オプション
   * @returns {Promise<Array>} 関連記憶の配列
   */
  async getRelevantMemories(context, options = {}) {
    try {
      const limit = Math.min(options.limit || this.config.search.defaultLimit, this.config.search.maxLimit);
      const types = options.types || Object.values(MemoryType);
      
      // コンテキストから検索クエリを生成
      const query = this._generateQueryFromContext(context);
      
      // 検索を実行
      const searchResults = await this.searchMemories({
        query,
        types,
        limit,
        threshold: options.threshold || 0.7
      });
      
      // ルールエンジンを使用して追加の関連記憶を取得
      const ruleResults = await this.ruleEngine.evaluateRules({
        context,
        memories: searchResults
      });
      
      // 検索結果とルール結果をマージ
      const allResults = [...searchResults];
      
      // ルール結果から記憶を抽出
      for (const result of ruleResults) {
        for (const action of result.actions) {
          if (action.type === 'memory' && action.result) {
            allResults.push(action.result);
          }
        }
      }
      
      // 重複を除去
      const uniqueResults = this._deduplicateResults(allResults);
      
      // 重要度と関連度でソート
      const sortedResults = this._sortResultsByRelevance(uniqueResults, query);
      
      // 上位N件を返す
      return sortedResults.slice(0, limit);
    } catch (error) {
      console.error(`Failed to get relevant memories: ${error.message}`);
      return [];
    }
  }

  /**
   * 記憶を強化する
   * @param {Object} memory 記憶オブジェクト
   * @returns {Promise<Object>} 強化された記憶
   * @private
   */
  async _strengthenMemory(memory) {
    try {
      // 記憶の重要度が閾値未満の場合は強化しない
      const importance = memory.metadata?.importance || 0.5;
      if (importance < this.config.reinforcement.strengthThreshold) {
        return memory;
      }
      
      // 現在の強度を取得
      const currentStrength = memory.metadata?.strength || 0;
      
      // 強度を増加（最大値を超えないように）
      const newStrength = Math.min(
        currentStrength + this.config.reinforcement.strengthFactor,
        this.config.reinforcement.maxStrength
      );
      
      // 強度が変わらない場合は更新しない
      if (newStrength === currentStrength) {
        return memory;
      }
      
      // メタデータを更新
      const updateData = {
        metadata: {
          ...memory.metadata,
          strength: newStrength,
          last_accessed: new Date().toISOString()
        }
      };
      
      // 記憶を更新
      return this.updateMemory(memory.id, updateData);
    } catch (error) {
      console.error(`Failed to strengthen memory: ${error.message}`);
      return memory;
    }
  }

  /**
   * 記憶を減衰させる
   * @param {Object} memory 記憶オブジェクト
   * @returns {Promise<Object>} 減衰された記憶
   * @private
   */
  async _decayMemory(memory) {
    try {
      // 現在の強度を取得
      const currentStrength = memory.metadata?.strength || 0;
      
      // 強度がない場合は減衰しない
      if (currentStrength <= 0) {
        return memory;
      }
      
      // 強度を減少
      const newStrength = Math.max(
        currentStrength - this.config.reinforcement.decayFactor,
        0
      );
      
      // 強度が変わらない場合は更新しない
      if (newStrength === currentStrength) {
        return memory;
      }
      
      // メタデータを更新
      const updateData = {
        metadata: {
          ...memory.metadata,
          strength: newStrength,
          last_decayed: new Date().toISOString()
        }
      };
      
      // 記憶を更新
      return this.updateMemory(memory.id, updateData);
    } catch (error) {
      console.error(`Failed to decay memory: ${error.message}`);
      return memory;
    }
  }

  /**
   * 記憶が短期記憶に属するかどうかを判定する
   * @param {string} memoryType 記憶タイプ
   * @param {number} importance 重要度
   * @returns {boolean} 短期記憶の場合はtrue
   * @private
   */
  _isShortTermMemory(memoryType, importance) {
    // 観察や相互作用は短期記憶
    if (memoryType === MemoryType.OBSERVATION || memoryType === MemoryType.INTERACTION) {
      return true;
    }
    
    // 重要度が低い場合は短期記憶
    if (importance < 0.3) {
      return true;
    }
    
    return false;
  }

  /**
   * 記憶が中期記憶に属するかどうかを判定する
   * @param {string} memoryType 記憶タイプ
   * @param {number} importance 重要度
   * @returns {boolean} 中期記憶の場合はtrue
   * @private
   */
  _isMidTermMemory(memoryType, importance) {
    // 要約やプリファレンスは中期記憶
    if (memoryType === MemoryType.SUMMARY || memoryType === MemoryType.PREFERENCE) {
      return true;
    }
    
    // 重要度が中程度の場合は中期記憶
    if (importance >= 0.3 && importance < 0.7) {
      return true;
    }
    
    return false;
  }

  /**
   * 検索結果から重複を除去する
   * @param {Array} results 検索結果の配列
   * @returns {Array} 重複を除去した配列
   * @private
   */
  _deduplicateResults(results) {
    const seen = new Set();
    const uniqueResults = [];
    
    for (const result of results) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        uniqueResults.push(result);
      }
    }
    
    return uniqueResults;
  }

  /**
   * 検索結果を関連度でソートする
   * @param {Array} results 検索結果の配列
   * @param {string} query 検索クエリ
   * @returns {Array} ソートされた配列
   * @private
   */
  _sortResultsByRelevance(results, query) {
    return results.sort((a, b) => {
      // 重要度の比較
      const importanceA = a.metadata?.importance || 0.5;
      const importanceB = b.metadata?.importance || 0.5;
      
      // 強度の比較
      const strengthA = a.metadata?.strength || 0;
      const strengthB = b.metadata?.strength || 0;
      
      // 関連度の比較
      const relevanceA = a.metadata?.relevance || 0;
      const relevanceB = b.metadata?.relevance || 0;
      
      // 複合スコアの計算
      const scoreA = (importanceA * 0.4) + (strengthA * 0.3) + (relevanceA * 0.3);
      const scoreB = (importanceB * 0.4) + (strengthB * 0.3) + (relevanceB * 0.3);
      
      return scoreB - scoreA;
    });
  }

  /**
   * コンテキストから検索クエリを生成する
   * @param {Object} context コンテキスト
   * @returns {string} 検索クエリ
   * @private
   */
  _generateQueryFromContext(context) {
    // コンテキストの種類に応じてクエリを生成
    if (typeof context === 'string') {
      return context;
    }
    
    if (context.query) {
      return context.query;
    }
    
    if (context.text) {
      return context.text;
    }
    
    if (context.content) {
      return context.content;
    }
    
    if (context.message) {
      return context.message;
    }
    
    // オブジェクトの場合は重要なプロパティを抽出
    const parts = [];
    
    if (context.topic) parts.push(context.topic);
    if (context.subject) parts.push(context.subject);
    if (context.keywords) {
      if (Array.isArray(context.keywords)) {
        parts.push(...context.keywords);
      } else {
        parts.push(context.keywords);
      }
    }
    
    return parts.join(' ');
  }

  /**
   * イベントリスナーを登録する
   * @param {string} eventName イベント名
   * @param {Function} listener リスナー関数
   */
  addEventListener(eventName, listener) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    
    this.eventListeners.get(eventName).push(listener);
  }

  /**
   * イベントをトリガーする
   * @param {string} eventName イベント名
   * @param {Object} data イベントデータ
   * @private
   */
  _triggerEvent(eventName, data = {}) {
    const listeners = this.eventListeners.get(eventName) || [];
    
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventName}: ${error.message}`);
      }
    }
  }

  /**
   * 記憶を強化する
   * @param {string|Object} memory 記憶IDまたは記憶オブジェクト
   * @param {Object} options オプション
   * @returns {Promise<Object>} 強化された記憶
   */
  async strengthenMemory(memory, options = {}) {
    return this.memoryReinforcement.strengthenMemory(memory, options);
  }

  /**
   * 記憶を減衰させる
   * @param {string|Object} memory 記憶IDまたは記憶オブジェクト
   * @param {Object} options オプション
   * @returns {Promise<Object>} 減衰された記憶
   */
  async decayMemory(memory, options = {}) {
    return this.memoryReinforcement.decayMemory(memory, options);
  }

  /**
   * 複数の記憶を強化する
   * @param {Array} memories 記憶IDまたは記憶オブジェクトの配列
   * @param {Object} options オプション
   * @returns {Promise<Array>} 強化された記憶の配列
   */
  async strengthenMemories(memories, options = {}) {
    return this.memoryReinforcement.strengthenMemories(memories, options);
  }

  /**
   * 複数の記憶を減衰させる
   * @param {Array} memories 記憶IDまたは記憶オブジェクトの配列
   * @param {Object} options オプション
   * @returns {Promise<Array>} 減衰された記憶の配列
   */
  async decayMemories(memories, options = {}) {
    return this.memoryReinforcement.decayMemories(memories, options);
  }

  /**
   * すべての記憶を減衰させる
   * @param {Object} options オプション
   * @returns {Promise<number>} 減衰された記憶の数
   */
  async decayAllMemories(options = {}) {
    return this.memoryReinforcement.decayAllMemories(options);
  }

  /**
   * 記憶の強度を取得する
   * @param {string|Object} memory 記憶IDまたは記憶オブジェクト
   * @returns {Promise<number>} 記憶の強度
   */
  async getMemoryStrength(memory) {
    return this.memoryReinforcement.getMemoryStrength(memory);
  }

  /**
   * 自動減衰を停止する
   */
  stopAutoDecay() {
    this.memoryReinforcement.stopAutoDecay();
  }

  /**
   * 記憶群を統合する
   * @param {Array} memories 記憶の配列
   * @param {Object} options オプション
   * @returns {Promise<Object>} 統合された記憶
   */
  async integrateMemories(memories, options = {}) {
    return this.memoryIntegration.integrateMemories(memories, options);
  }

  /**
   * 記憶を要約する
   * @param {Array} memories 記憶の配列
   * @param {Object} options オプション
   * @returns {Promise<Object>} 要約された記憶
   */
  async summarizeMemories(memories, options = {}) {
    return this.memoryIntegration.summarizeMemories(memories, options);
  }

  /**
   * 思考プロセスを開始する
   * @param {Object} context 思考コンテキスト
   * @param {Object} options オプション
   * @returns {Promise<string>} 思考プロセスID
   */
  async startThinking(context, options = {}) {
    return this.sequentialThinkingIntegration.startThinking(context, options);
  }

  /**
   * 思考ステップを実行する
   * @param {string} thinkingId 思考プロセスID
   * @param {Object} stepData ステップデータ
   * @param {Object} options オプション
   * @returns {Promise<Object>} ステップ結果
   */
  async executeThinkingStep(thinkingId, stepData, options = {}) {
    return this.sequentialThinkingIntegration.executeThinkingStep(thinkingId, stepData, options);
  }

  /**
   * 思考プロセスを完了する
   * @param {string} thinkingId 思考プロセスID
   * @param {Object} result 思考結果
   * @returns {Promise<Object>} 完了情報
   */
  async completeThinking(thinkingId, result) {
    return this.sequentialThinkingIntegration.completeThinking(thinkingId, result);
  }

  /**
   * 思考プロセスの状態を取得する
   * @param {string} thinkingId 思考プロセスID
   * @returns {Promise<Object>} 思考プロセスの状態
   */
  async getThinkingState(thinkingId) {
    return this.sequentialThinkingIntegration.getThinkingState(thinkingId);
  }

  /**
   * 思考プロセスの履歴を取得する
   * @param {Object} options オプション
   * @returns {Promise<Array>} 思考プロセスの履歴
   */
  async getThinkingHistory(options = {}) {
    return this.sequentialThinkingIntegration.getThinkingHistory(options);
  }

  /**
   * 子思考プロセスを開始する
   * @param {string} parentId 親思考プロセスID
   * @param {Object} context 思考コンテキスト
   * @param {Object} options オプション
   * @returns {Promise<string>} 子思考プロセスID
   */
  async startChildThinking(parentId, context, options = {}) {
    return this.sequentialThinkingIntegration.startChildThinking(parentId, context, options);
  }
}
