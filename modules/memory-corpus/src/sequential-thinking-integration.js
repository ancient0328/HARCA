/**
 * @fileoverview 思考プロセス連携モジュール
 * 
 * このファイルでは、Sequential Thinking MCPと多階層記憶システムを連携するためのクラスを定義しています。
 * 思考プロセス連携モジュールは、思考プロセスの各ステップで必要な記憶を提供し、
 * 思考結果を記憶に保存する機能を提供します。
 */

import { MemoryType } from './memory-model.js';

/**
 * 思考プロセス連携クラス
 */
export class SequentialThinkingIntegration {
  /**
   * SequentialThinkingIntegrationのインスタンスを作成する
   * @param {Object} options 設定オプション
   */
  constructor(options = {}) {
    // 依存コンポーネント
    this.memorySystem = options.memorySystem;
    this.workingMemory = options.workingMemory;
    this.contextManager = options.contextManager;
    this.episodicMemory = options.episodicMemory;
    this.knowledgeBase = options.knowledgeBase;
    this.ruleEngine = options.ruleEngine;
    
    // 設定
    this.config = {
      // 思考プロセスの最大ステップ数
      maxThinkingSteps: options.maxThinkingSteps || 10,
      // 思考プロセスの最大深度
      maxThinkingDepth: options.maxThinkingDepth || 3,
      // 思考プロセスのタイムアウト（ミリ秒）
      thinkingTimeout: options.thinkingTimeout || 30000,
      // 思考プロセスの結果を自動的に記憶に保存するかどうか
      autoSaveThinkingResults: options.autoSaveThinkingResults !== false,
      // 思考プロセスの各ステップを記録するかどうか
      recordThinkingSteps: options.recordThinkingSteps !== false,
      // 思考プロセスの結果の重要度
      defaultImportance: options.defaultImportance || 0.7
    };
    
    // 現在の思考プロセスID
    this.currentThinkingId = null;
    
    // 思考プロセスの履歴
    this.thinkingHistory = new Map();
  }

  /**
   * 思考プロセスを開始する
   * @param {Object} context 思考コンテキスト
   * @param {Object} options オプション
   * @returns {Promise<string>} 思考プロセスID
   */
  async startThinking(context, options = {}) {
    try {
      // 思考プロセスIDを生成
      const thinkingId = this._generateThinkingId();
      
      // 思考プロセスの初期状態を作成
      const thinkingState = {
        id: thinkingId,
        context,
        options,
        steps: [],
        startTime: Date.now(),
        status: 'started',
        currentStep: 0,
        maxSteps: options.maxSteps || this.config.maxThinkingSteps,
        depth: options.depth || 0,
        parentId: options.parentId || null
      };
      
      // 思考プロセスの履歴に追加
      this.thinkingHistory.set(thinkingId, thinkingState);
      
      // 現在の思考プロセスIDを設定
      this.currentThinkingId = thinkingId;
      
      // 作業記憶に思考コンテキストを保存
      await this.workingMemory.store({
        content: JSON.stringify(context),
        type: 'thinking_context',
        metadata: {
          thinking_id: thinkingId,
          importance: options.importance || this.config.defaultImportance
        }
      });
      
      // コンテキストマネージャーに思考コンテキストを設定
      await this.contextManager.setContext('thinking', {
        thinking_id: thinkingId,
        context,
        options
      });
      
      return thinkingId;
    } catch (error) {
      console.error(`Failed to start thinking: ${error.message}`);
      throw new Error(`Failed to start thinking: ${error.message}`);
    }
  }

  /**
   * 思考ステップを実行する
   * @param {string} thinkingId 思考プロセスID
   * @param {Object} stepData ステップデータ
   * @param {Object} options オプション
   * @returns {Promise<Object>} ステップ結果
   */
  async executeThinkingStep(thinkingId, stepData, options = {}) {
    try {
      // 思考プロセスの状態を取得
      const thinkingState = this.thinkingHistory.get(thinkingId);
      
      if (!thinkingState) {
        throw new Error(`Thinking process not found: ${thinkingId}`);
      }
      
      // 思考プロセスが終了している場合はエラー
      if (thinkingState.status === 'completed' || thinkingState.status === 'failed') {
        throw new Error(`Thinking process already ${thinkingState.status}: ${thinkingId}`);
      }
      
      // ステップ番号を取得
      const stepNumber = thinkingState.currentStep + 1;
      
      // ステップ数が上限を超えている場合はエラー
      if (stepNumber > thinkingState.maxSteps) {
        throw new Error(`Thinking process exceeded max steps: ${thinkingId}`);
      }
      
      // 思考ステップの実行時間を計測
      const startTime = Date.now();
      
      // 思考ステップに関連する記憶を取得
      const relevantMemories = await this._getRelevantMemories(thinkingState, stepData);
      
      // ステップデータに記憶を追加
      const enhancedStepData = {
        ...stepData,
        memories: relevantMemories
      };
      
      // 思考ステップを実行
      const stepResult = await this._executeStep(enhancedStepData, options);
      
      // 実行時間を計算
      const executionTime = Date.now() - startTime;
      
      // ステップ情報を作成
      const stepInfo = {
        number: stepNumber,
        data: enhancedStepData,
        result: stepResult,
        startTime,
        executionTime,
        memories: relevantMemories.map(m => m.id)
      };
      
      // 思考プロセスの状態を更新
      thinkingState.steps.push(stepInfo);
      thinkingState.currentStep = stepNumber;
      thinkingState.lastStepTime = startTime;
      
      // 思考ステップの結果を記憶に保存
      if (this.config.recordThinkingSteps) {
        await this._saveThinkingStep(thinkingId, stepInfo);
      }
      
      // 最終ステップの場合は思考プロセスを完了
      if (stepNumber === thinkingState.maxSteps || stepResult.final) {
        await this.completeThinking(thinkingId, stepResult);
      }
      
      return {
        thinking_id: thinkingId,
        step: stepNumber,
        result: stepResult,
        execution_time: executionTime,
        final: stepNumber === thinkingState.maxSteps || stepResult.final
      };
    } catch (error) {
      console.error(`Failed to execute thinking step: ${error.message}`);
      
      // 思考プロセスを失敗状態に設定
      await this.failThinking(thinkingId, { error: error.message });
      
      throw new Error(`Failed to execute thinking step: ${error.message}`);
    }
  }

  /**
   * 思考プロセスを完了する
   * @param {string} thinkingId 思考プロセスID
   * @param {Object} result 思考結果
   * @returns {Promise<Object>} 完了情報
   */
  async completeThinking(thinkingId, result) {
    try {
      // 思考プロセスの状態を取得
      const thinkingState = this.thinkingHistory.get(thinkingId);
      
      if (!thinkingState) {
        throw new Error(`Thinking process not found: ${thinkingId}`);
      }
      
      // 思考プロセスが既に終了している場合は何もしない
      if (thinkingState.status === 'completed' || thinkingState.status === 'failed') {
        return {
          thinking_id: thinkingId,
          status: thinkingState.status,
          result: thinkingState.result
        };
      }
      
      // 完了時間を計算
      const completionTime = Date.now();
      const totalTime = completionTime - thinkingState.startTime;
      
      // 思考プロセスの状態を更新
      thinkingState.status = 'completed';
      thinkingState.result = result;
      thinkingState.completionTime = completionTime;
      thinkingState.totalTime = totalTime;
      
      // 思考結果を記憶に保存
      let memoryId = null;
      if (this.config.autoSaveThinkingResults) {
        memoryId = await this._saveThinkingResult(thinkingId, result);
      }
      
      // 思考プロセスの結果を記憶として保存
      await this.memorySystem.createMemory({
        content: `思考プロセス「${thinkingState.context.query || 'Unknown'}」の結果: ${result.output}`,
        type: MemoryType.FACT,
        metadata: {
          thinking_id: thinkingId,
          importance: thinkingState.options.importance || this.config.defaultImportance,
          confidence: result.confidence || 0.7
        }
      });
      
      // 思考プロセスの履歴を記録
      await this.episodicMemory.store({
        type: MemoryType.EPISODE,
        content: `思考プロセス「${thinkingState.context.query || 'Unknown'}」の実行履歴`,
        metadata: {
          thinking_id: thinkingId,
          steps: thinkingState.steps.length,
          total_time: totalTime,
          result: result.output
        }
      });
      
      // 親思考プロセスがある場合は通知
      if (thinkingState.parentId) {
        await this._notifyParentThinking(thinkingState.parentId, thinkingId, result);
      }
      
      // コンテキストマネージャーから思考コンテキストを削除
      await this.contextManager.removeContext('thinking');
      
      return {
        thinking_id: thinkingId,
        status: 'completed',
        result,
        total_time: totalTime,
        steps: thinkingState.steps.length
      };
    } catch (error) {
      console.error(`Failed to complete thinking: ${error.message}`);
      
      // 思考プロセスを失敗状態に設定
      return this.failThinking(thinkingId, { error: error.message });
    }
  }

  /**
   * 思考プロセスを失敗状態にする
   * @param {string} thinkingId 思考プロセスID
   * @param {Object} error エラー情報
   * @returns {Promise<Object>} 失敗情報
   */
  async failThinking(thinkingId, error) {
    try {
      // 思考プロセスの状態を取得
      const thinkingState = this.thinkingHistory.get(thinkingId);
      
      if (!thinkingState) {
        throw new Error(`Thinking process not found: ${thinkingId}`);
      }
      
      // 思考プロセスが既に終了している場合は何もしない
      if (thinkingState.status === 'completed' || thinkingState.status === 'failed') {
        return {
          thinking_id: thinkingId,
          status: thinkingState.status,
          error: thinkingState.error
        };
      }
      
      // 完了時間を計算
      const completionTime = Date.now();
      const totalTime = completionTime - thinkingState.startTime;
      
      // 思考プロセスの状態を更新
      thinkingState.status = 'failed';
      thinkingState.error = error;
      thinkingState.completionTime = completionTime;
      thinkingState.totalTime = totalTime;
      
      // 思考プロセスの失敗を記録
      await this.episodicMemory.store({
        type: MemoryType.EPISODE,
        content: `思考プロセス「${thinkingState.context.query || 'Unknown'}」の失敗`,
        metadata: {
          thinking_id: thinkingId,
          steps: thinkingState.steps.length,
          total_time: totalTime,
          error: error
        }
      });
      
      // 親思考プロセスがある場合は通知
      if (thinkingState.parentId) {
        await this._notifyParentThinking(thinkingState.parentId, thinkingId, null, error);
      }
      
      return {
        thinking_id: thinkingId,
        status: 'failed',
        error,
        total_time: totalTime,
        steps: thinkingState.steps.length
      };
    } catch (error) {
      console.error(`Failed to fail thinking: ${error.message}`);
      
      throw new Error(`Failed to fail thinking: ${error.message}`);
    }
  }

  /**
   * 思考プロセスの状態を取得する
   * @param {string} thinkingId 思考プロセスID
   * @returns {Promise<Object>} 思考プロセスの状態
   */
  async getThinkingState(thinkingId) {
    try {
      // 思考プロセスの状態を取得
      const thinkingState = this.thinkingHistory.get(thinkingId);
      
      if (!thinkingState) {
        throw new Error(`Thinking process not found: ${thinkingId}`);
      }
      
      // 状態情報を作成
      return {
        thinking_id: thinkingId,
        status: thinkingState.status,
        current_step: thinkingState.currentStep,
        max_steps: thinkingState.maxSteps,
        start_time: thinkingState.startTime,
        total_time: thinkingState.totalTime || (Date.now() - thinkingState.startTime),
        steps: thinkingState.steps,
        parent_id: thinkingState.parentId,
        depth: thinkingState.depth,
        result: thinkingState.result,
        error: thinkingState.error
      };
    } catch (error) {
      console.error(`Failed to get thinking state: ${error.message}`);
      throw new Error(`Failed to get thinking state: ${error.message}`);
    }
  }

  /**
   * 思考プロセスの履歴を取得する
   * @param {Object} options オプション
   * @returns {Promise<Array>} 思考プロセスの履歴
   */
  async getThinkingHistory(options = {}) {
    try {
      // 思考プロセスの履歴を取得
      const history = Array.from(this.thinkingHistory.values());
      
      // フィルタリング
      let filtered = history;
      
      if (options.status) {
        filtered = filtered.filter(item => item.status === options.status);
      }
      
      if (options.parentId) {
        filtered = filtered.filter(item => item.parentId === options.parentId);
      }
      
      // ソート（デフォルトは開始時間の降順）
      const sorted = filtered.sort((a, b) => {
        if (options.sortBy === 'completionTime') {
          return (b.completionTime || 0) - (a.completionTime || 0);
        }
        
        return b.startTime - a.startTime;
      });
      
      // ページング
      const limit = options.limit || 10;
      const offset = options.offset || 0;
      
      const paged = sorted.slice(offset, offset + limit);
      
      // 結果を整形
      return paged.map(item => ({
        thinking_id: item.id,
        status: item.status,
        current_step: item.currentStep,
        max_steps: item.maxSteps,
        start_time: item.startTime,
        total_time: item.totalTime || (Date.now() - item.startTime),
        steps: item.steps.length,
        parent_id: item.parentId,
        depth: item.depth
      }));
    } catch (error) {
      console.error(`Failed to get thinking history: ${error.message}`);
      return [];
    }
  }

  /**
   * 子思考プロセスを開始する
   * @param {string} parentId 親思考プロセスID
   * @param {Object} context 思考コンテキスト
   * @param {Object} options オプション
   * @returns {Promise<string>} 子思考プロセスID
   */
  async startChildThinking(parentId, context, options = {}) {
    try {
      // 親思考プロセスの状態を取得
      const parentState = this.thinkingHistory.get(parentId);
      
      if (!parentState) {
        throw new Error(`Parent thinking process not found: ${parentId}`);
      }
      
      // 深度を計算
      const depth = parentState.depth + 1;
      
      // 深度が上限を超えている場合はエラー
      if (depth > this.config.maxThinkingDepth) {
        throw new Error(`Thinking depth exceeded max depth: ${parentId}`);
      }
      
      // 子思考プロセスを開始
      const childId = await this.startThinking(context, {
        ...options,
        parentId,
        depth
      });
      
      return childId;
    } catch (error) {
      console.error(`Failed to start child thinking: ${error.message}`);
      throw new Error(`Failed to start child thinking: ${error.message}`);
    }
  }

  /**
   * 思考プロセスIDを生成する
   * @returns {string} 思考プロセスID
   * @private
   */
  _generateThinkingId() {
    return `thinking_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 思考ステップを実行する
   * @param {Object} stepData ステップデータ
   * @param {Object} options オプション
   * @returns {Promise<Object>} ステップ結果
   * @private
   */
  async _executeStep(stepData, options = {}) {
    // このメソッドは実際の思考ステップの実行を行う
    // 実際の実装はSequential Thinking MCPによって行われる
    
    // アクションに基づいて処理を分岐
    const action = stepData.action || 'unknown';
    
    switch (action) {
      case 'analyze':
        return {
          status: 'success',
          data: stepData,
          result: {
            output: 'Analysis completed successfully',
            final: false
          }
        };
        
      case 'conclusion':
      case 'conclude': // テストとの互換性のために両方サポート
        return {
          status: 'success',
          data: stepData,
          result: {
            output: 'Conclusion reached successfully',
            final: true
          }
        };
        
      case 'unknown':
        return {
          status: 'success',
          data: stepData,
          result: {
            output: 'Thinking step executed successfully',
            final: options.final || false
          }
        };
        
      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  }

  /**
   * 思考ステップに関連する記憶を取得する
   * @param {Object} thinkingState 思考プロセスの状態
   * @param {Object} stepData ステップデータ
   * @returns {Promise<Array>} 関連記憶の配列
   * @private
   */
  async _getRelevantMemories(thinkingState, stepData) {
    try {
      // 思考コンテキストとステップデータから検索クエリを生成
      const query = this._generateQueryFromThinking(thinkingState, stepData);
      
      // 関連する記憶を検索
      const memories = await this.memorySystem.getRelevantMemories(
        { query, context: thinkingState.context, step: stepData },
        { limit: 10 }
      );
      
      return memories;
    } catch (error) {
      console.error(`Failed to get relevant memories: ${error.message}`);
      return [];
    }
  }

  /**
   * 思考プロセスから検索クエリを生成する
   * @param {Object} thinkingState 思考プロセスの状態
   * @param {Object} stepData ステップデータ
   * @returns {string} 検索クエリ
   * @private
   */
  _generateQueryFromThinking(thinkingState, stepData) {
    // クエリの部分を抽出
    const parts = [];
    
    // ステップデータからクエリを抽出
    if (stepData.query) {
      parts.push(stepData.query);
    }
    
    if (stepData.question) {
      parts.push(stepData.question);
    }
    
    if (stepData.topic) {
      parts.push(stepData.topic);
    }
    
    // コンテキストからクエリを抽出
    const context = thinkingState.context;
    
    if (typeof context === 'string') {
      parts.push(context);
    } else {
      if (context.query) {
        parts.push(context.query);
      }
      
      if (context.question) {
        parts.push(context.question);
      }
      
      if (context.topic) {
        parts.push(context.topic);
      }
    }
    
    // クエリを結合
    return parts.join(' ');
  }

  /**
   * 思考ステップを記憶に保存する
   * @param {string} thinkingId 思考プロセスID
   * @param {Object} stepInfo ステップ情報
   * @returns {Promise<string>} 記憶ID
   * @private
   */
  async _saveThinkingStep(thinkingId, stepInfo) {
    try {
      // ステップ情報を記憶に保存
      const memoryId = await this.workingMemory.store({
        content: JSON.stringify(stepInfo.result),
        type: 'thinking_step',
        metadata: {
          thinking_id: thinkingId,
          step_number: stepInfo.number,
          importance: 0.6,
          execution_time: stepInfo.executionTime
        }
      });
      
      return memoryId;
    } catch (error) {
      console.error(`Failed to save thinking step: ${error.message}`);
      return null;
    }
  }

  /**
   * 思考結果を記憶に保存する
   * @param {string} thinkingId 思考プロセスID
   * @param {Object} result 思考結果
   * @returns {Promise<string>} 記憶ID
   * @private
   */
  async _saveThinkingResult(thinkingId, result) {
    try {
      // 思考プロセスの状態を取得
      const thinkingState = this.thinkingHistory.get(thinkingId);
      
      if (!thinkingState) {
        throw new Error(`Thinking process not found: ${thinkingId}`);
      }
      
      // 結果の内容を取得
      const content = typeof result === 'string' ? result : JSON.stringify(result);
      
      // 重要度を計算
      const importance = thinkingState.options.importance || this.config.defaultImportance;
      
      // 思考結果を記憶に保存
      const memoryId = await this.episodicMemory.store({
        content,
        type: MemoryType.SUMMARY,
        metadata: {
          thinking_id: thinkingId,
          importance,
          steps: thinkingState.steps.length,
          execution_time: thinkingState.totalTime,
          thinking_type: thinkingState.options.type || 'general'
        }
      });
      
      // 重要な思考結果は知識ベースにも保存
      if (importance >= 0.8) {
        await this.knowledgeBase.store({
          content,
          type: MemoryType.FACT,
          metadata: {
            thinking_id: thinkingId,
            importance,
            confidence: 0.7,
            source: 'thinking'
          }
        });
      }
      
      return memoryId;
    } catch (error) {
      console.error(`Failed to save thinking result: ${error.message}`);
      return null;
    }
  }

  /**
   * 親思考プロセスに通知する
   * @param {string} parentId 親思考プロセスID
   * @param {string} childId 子思考プロセスID
   * @param {Object} result 結果
   * @param {Object} error エラー
   * @returns {Promise<void>}
   * @private
   */
  async _notifyParentThinking(parentId, childId, result, error) {
    try {
      // 親思考プロセスの状態を取得
      const parentState = this.thinkingHistory.get(parentId);
      
      if (!parentState) {
        console.warn(`Parent thinking process not found: ${parentId}`);
        return;
      }
      
      // 子思考プロセスの結果を親に追加
      if (!parentState.childResults) {
        parentState.childResults = {};
      }
      
      parentState.childResults[childId] = { result, error };
      
      // 作業記憶に子思考プロセスの結果を保存
      await this.workingMemory.store({
        content: JSON.stringify({ result, error }),
        type: 'child_thinking_result',
        metadata: {
          parent_thinking_id: parentId,
          child_thinking_id: childId,
          importance: 0.7,
          status: error ? 'failed' : 'completed'
        }
      });
    } catch (error) {
      console.error(`Failed to notify parent thinking: ${error.message}`);
    }
  }
}
