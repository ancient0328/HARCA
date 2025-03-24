// features/vector-store/model-manager.js - 埋め込みモデルの管理クラス
import dotenv from 'dotenv';
import { ErrorHandler, ErrorTypes, SeverityLevels, RecoveryStrategies } from './error-handler.js';

// 環境変数読み込み
dotenv.config();

/**
 * 埋め込みモデルを管理するクラス
 * 様々なプロバイダーのモデルを一元管理し、最適なモデルを選択する機能を提供
 */
class ModelManager {
  /**
   * モデルマネージャーの初期化
   * @param {Object} config - 設定オブジェクト
   */
  constructor(config = {}) {
    // 利用可能なモデルの定義
    this.models = {
      // OpenAIモデル
      'openai-ada-002': {
        provider: 'openai',
        name: 'text-embedding-ada-002',
        dimensions: 1536,
        costPer1KTokens: 0.0001,
        performance: 'high',
        maxInputTokens: 8191,
        description: '汎用性の高い標準的な埋め込みモデル',
        deprecated: true // 非推奨（将来的に削除される可能性あり）
      },
      'openai-3-small': {
        provider: 'openai',
        name: 'text-embedding-3-small',
        dimensions: 1536,
        costPer1KTokens: 0.00002,
        performance: 'very-high',
        maxInputTokens: 8191,
        description: '高効率な最新の小型埋め込みモデル',
        recommended: true
      },
      'openai-3-large': {
        provider: 'openai',
        name: 'text-embedding-3-large',
        dimensions: 3072,
        costPer1KTokens: 0.00013,
        performance: 'highest',
        maxInputTokens: 8191,
        description: '最高性能の大型埋め込みモデル、次元数2倍'
      },
      
      // ローカルモデル
      'local-minilm': {
        provider: 'local',
        name: 'all-MiniLM-L6-v2',
        dimensions: 384,
        costPer1KTokens: 0,
        performance: 'medium',
        maxInputTokens: 256,
        description: '軽量で高速なローカル実行モデル'
      },
      'local-mpnet': {
        provider: 'local',
        name: 'all-mpnet-base-v2',
        dimensions: 768,
        costPer1KTokens: 0,
        performance: 'high',
        maxInputTokens: 384,
        description: 'バランスの取れた性能のローカル実行モデル'
      },
      
      // シンプルハッシュ（フォールバック）
      'simple-hash': {
        provider: 'simple',
        name: 'simple-hash',
        dimensions: 1536,
        costPer1KTokens: 0,
        performance: 'low',
        maxInputTokens: Infinity,
        description: 'APIやローカルモデルが利用できない場合のフォールバック',
        fallback: true
      }
    };
    
    // デフォルトモデルの設定
    this.defaultModel = config.defaultModel || process.env.DEFAULT_EMBEDDING_MODEL || 'openai-3-small';
    
    // 現在アクティブなモデル
    this.activeModel = this.defaultModel;
    
    // モデル選択の優先基準
    this.selectionCriteria = config.selectionCriteria || {
      prioritizeCost: process.env.PRIORITIZE_COST === 'true',
      prioritizePerformance: process.env.PRIORITIZE_PERFORMANCE === 'true' || true,
      prioritizeSpeed: process.env.PRIORITIZE_SPEED === 'true',
      offlineOnly: process.env.OFFLINE_ONLY === 'true'
    };
    
    // エラーハンドリング設定
    this.errorHandler = new ErrorHandler({
      maxLogSize: config.maxErrorLogSize || 100,
      notifyErrors: config.notifyErrors !== false
    });
    this.failedModels = new Map(); // 失敗したモデルとその回復時間を記録
    this.failureThreshold = config.failureThreshold || 3; // 何回連続で失敗したらフォールバックするか
    this.recoveryTimeMs = config.recoveryTimeMs || 5 * 60 * 1000; // 失敗したモデルを再試行するまでの時間（デフォルト5分）
    
    // モデル使用統計
    this.modelStats = {
      usageCount: {}, // 各モデルの使用回数
      errorCount: {}, // 各モデルのエラー回数
      totalTokens: {}, // 各モデルの処理トークン数
      lastUsed: {},   // 各モデルの最終使用時間
      errorTypes: {}  // エラータイプごとの発生回数
    };
    
    // 統計の初期化
    Object.keys(this.models).forEach(modelId => {
      this.modelStats.usageCount[modelId] = 0;
      this.modelStats.errorCount[modelId] = 0;
      this.modelStats.totalTokens[modelId] = 0;
      this.modelStats.lastUsed[modelId] = null;
      this.modelStats.errorTypes[modelId] = {};
      
      // 各エラータイプの初期化
      Object.values(ErrorTypes).forEach(type => {
        this.modelStats.errorTypes[modelId][type] = 0;
      });
    });
    
    console.log(`モデルマネージャーを初期化しました: デフォルトモデル=${this.defaultModel}`);
    
    // 環境に基づいて最適なモデルを自動選択
    const optimalModel = this.autoSelectModel();
    if (optimalModel !== this.activeModel) {
      this.setActiveModel(optimalModel);
    }
  }
  
  /**
   * モデルのエラーを記録
   * @param {string} modelId - モデルID
   * @param {Error} error - 発生したエラー
   * @returns {boolean} モデルがフォールバック状態になったかどうか
   */
  recordModelError(modelId, error) {
    if (!this.models[modelId]) return false;
    
    // エラー統計を更新
    this.modelStats.errorCount[modelId] = (this.modelStats.errorCount[modelId] || 0) + 1;
    
    // エラーの分類と処理
    const errorResult = this.errorHandler.handleError(error, `モデル: ${modelId}`);
    const { classification } = errorResult;
    
    // エラータイプの統計を更新
    this.modelStats.errorTypes[modelId][classification.type] = 
      (this.modelStats.errorTypes[modelId][classification.type] || 0) + 1;
    
    // 失敗回数を更新
    if (this.failedModels.has(modelId)) {
      const failedInfo = this.failedModels.get(modelId);
      failedInfo.consecutiveFailures++;
      failedInfo.lastErrorType = classification.type;
      failedInfo.lastErrorSeverity = classification.severity;
      
      // 失敗回数が閾値を超えた場合、回復時間を設定
      if (failedInfo.consecutiveFailures >= this.failureThreshold) {
        // 重大度に基づいて回復時間を調整
        let recoveryTime = this.recoveryTimeMs;
        
        if (classification.severity === SeverityLevels.CRITICAL) {
          recoveryTime = this.recoveryTimeMs * 2; // 重大なエラーの場合は回復時間を2倍に
        } else if (classification.severity === SeverityLevels.WARNING) {
          recoveryTime = this.recoveryTimeMs / 2; // 警告レベルの場合は回復時間を半分に
        }
        
        // レート制限の場合は特別な処理
        if (classification.type === ErrorTypes.RATE_LIMIT) {
          recoveryTime = 60 * 1000; // レート制限は1分後に再試行
        }
        
        failedInfo.recoveryTime = Date.now() + recoveryTime;
        failedInfo.recoveryStrategy = errorResult.recommendedAction.action;
        
        console.warn(`モデル ${modelId} が ${failedInfo.consecutiveFailures} 回連続で失敗しました。エラータイプ: ${classification.type}, 重大度: ${classification.severity}`);
        console.warn(`${new Date(failedInfo.recoveryTime).toLocaleTimeString()} まで使用を停止します。推奨アクション: ${errorResult.recommendedAction.message}`);
        
        return true; // フォールバック状態になった
      }
    } else {
      this.failedModels.set(modelId, {
        consecutiveFailures: 1,
        recoveryTime: null,
        lastErrorType: classification.type,
        lastErrorSeverity: classification.severity,
        recoveryStrategy: null
      });
    }
    
    return false;
  }
  
  /**
   * モデルの成功を記録（連続失敗カウントをリセット）
   * @param {string} modelId - モデルID
   */
  recordModelSuccess(modelId) {
    if (!this.models[modelId]) return;
    
    // 失敗リストから削除
    if (this.failedModels.has(modelId)) {
      this.failedModels.delete(modelId);
    }
  }
  
  /**
   * モデルが失敗状態かどうかを確認
   * @param {string} modelId - モデルID
   * @returns {boolean} 失敗状態の場合はtrue
   */
  isModelFailed(modelId) {
    if (!this.failedModels.has(modelId)) return false;
    
    const failedInfo = this.failedModels.get(modelId);
    
    // 回復時間が設定されていない場合は失敗状態ではない
    if (!failedInfo.recoveryTime) return false;
    
    // 回復時間を過ぎている場合は失敗状態を解除
    if (Date.now() > failedInfo.recoveryTime) {
      console.log(`モデル ${modelId} の回復時間が経過しました。再び利用可能になります。`);
      this.failedModels.delete(modelId);
      return false;
    }
    
    return true;
  }
  
  /**
   * 失敗したモデルの詳細情報を取得
   * @param {string} modelId - モデルID
   * @returns {Object|null} 失敗情報、存在しない場合はnull
   */
  getModelFailureInfo(modelId) {
    if (!this.failedModels.has(modelId)) return null;
    
    const failedInfo = this.failedModels.get(modelId);
    return {
      ...failedInfo,
      remainingTimeMs: failedInfo.recoveryTime ? Math.max(0, failedInfo.recoveryTime - Date.now()) : 0,
      isFailed: this.isModelFailed(modelId)
    };
  }
  
  /**
   * 失敗したすべてのモデルの情報を取得
   * @returns {Object} モデルIDをキー、失敗情報を値とするオブジェクト
   */
  getAllFailedModels() {
    const result = {};
    
    for (const [modelId, failedInfo] of this.failedModels.entries()) {
      if (this.isModelFailed(modelId)) {
        result[modelId] = {
          ...failedInfo,
          remainingTimeMs: Math.max(0, failedInfo.recoveryTime - Date.now())
        };
      }
    }
    
    return result;
  }
  
  /**
   * モデルの使用統計を取得
   * @returns {Object} モデル使用統計
   */
  getModelStats() {
    const stats = { ...this.modelStats };
    
    // 各モデルのエラー率を計算
    stats.errorRates = {};
    Object.keys(this.models).forEach(modelId => {
      stats.errorRates[modelId] = this.modelStats.usageCount[modelId] 
        ? this.modelStats.errorCount[modelId] / this.modelStats.usageCount[modelId] 
        : 0;
    });
    
    // 失敗状態のモデル情報を追加
    stats.failedModels = this.getAllFailedModels();
    
    return stats;
  }
  
  /**
   * 指定したモデルの使用統計を取得
   * @param {string} modelId - モデルID
   * @returns {Object|null} モデル使用統計、存在しない場合はnull
   */
  getModelStatsById(modelId) {
    if (!this.models[modelId]) return null;
    
    return {
      usageCount: this.modelStats.usageCount[modelId] || 0,
      errorCount: this.modelStats.errorCount[modelId] || 0,
      totalTokens: this.modelStats.totalTokens[modelId] || 0,
      lastUsed: this.modelStats.lastUsed[modelId],
      errorRate: this.modelStats.usageCount[modelId] 
        ? (this.modelStats.errorCount[modelId] || 0) / this.modelStats.usageCount[modelId] 
        : 0,
      errorTypes: this.modelStats.errorTypes[modelId] || {},
      failureInfo: this.getModelFailureInfo(modelId)
    };
  }
  
  /**
   * エラーをログに記録
   * @param {Error} error - 発生したエラー
   * @param {string} context - エラーが発生したコンテキスト
   */
  logError(error, context) {
    // エラーハンドラーを使用してエラーを処理
    this.errorHandler.handleError(error, context);
  }
  
  /**
   * エラーログを取得
   * @param {Object} filters - フィルタリング条件
   * @returns {Array<Object>} フィルタリングされたエラーログ
   */
  getErrorLog(filters = {}) {
    return this.errorHandler.getErrorLog(filters);
  }
  
  /**
   * エラーログの統計情報を取得
   * @returns {Object} エラーログの統計情報
   */
  getErrorStats() {
    return this.errorHandler.getErrorStats();
  }
  
  /**
   * エラーログをクリア
   */
  clearErrorLog() {
    this.errorHandler.clearErrorLog();
  }
  
  /**
   * 失敗したモデルのリストをクリア
   */
  clearFailedModels() {
    this.failedModels.clear();
    console.log('失敗したモデルのリストをクリアしました。すべてのモデルが再び利用可能になります。');
  }
  
  /**
   * 特定のモデルの失敗状態をリセット
   * @param {string} modelId - モデルID
   * @returns {boolean} リセットが成功したかどうか
   */
  resetModelFailure(modelId) {
    if (!this.models[modelId]) return false;
    
    if (this.failedModels.has(modelId)) {
      this.failedModels.delete(modelId);
      console.log(`モデル ${modelId} の失敗状態をリセットしました。再び利用可能になります。`);
      return true;
    }
    
    return false;
  }
  
  /**
   * エラータイプに基づいて推奨される回復戦略を取得
   * @param {string} errorType - エラータイプ
   * @returns {string} 推奨される回復戦略
   */
  getRecommendedRecoveryStrategy(errorType) {
    switch (errorType) {
      case ErrorTypes.AUTHENTICATION:
        return RecoveryStrategies.REQUIRE_USER_ACTION;
        
      case ErrorTypes.RATE_LIMIT:
        return RecoveryStrategies.RETRY_AFTER_DELAY;
        
      case ErrorTypes.TIMEOUT:
      case ErrorTypes.NETWORK:
        return RecoveryStrategies.RETRY_WITH_BACKOFF;
        
      case ErrorTypes.SERVER:
        return RecoveryStrategies.FALLBACK_MODEL;
        
      case ErrorTypes.MODEL:
        return RecoveryStrategies.FALLBACK_MODEL;
        
      case ErrorTypes.INVALID_REQUEST:
      case ErrorTypes.INPUT:
        return RecoveryStrategies.NO_RECOVERY;
        
      default:
        return RecoveryStrategies.FALLBACK_MODEL;
    }
  }
  
  /**
   * 利用可能なすべてのモデルのリストを取得
   * @returns {Array} モデルIDのリスト
   */
  getAvailableModels() {
    return Object.keys(this.models);
  }
  
  /**
   * 特定のプロバイダーの利用可能なモデルを取得
   * @param {string} provider - プロバイダー名（'openai', 'local', 'simple'）
   * @returns {Array} 指定されたプロバイダーのモデルIDのリスト
   */
  getModelsByProvider(provider) {
    return Object.keys(this.models).filter(modelId => 
      this.models[modelId].provider === provider
    );
  }
  
  /**
   * 特定のモデルの情報を取得
   * @param {string} modelId - モデルID
   * @returns {Object|null} モデル情報オブジェクト、存在しない場合はnull
   */
  getModelInfo(modelId) {
    return this.models[modelId] || null;
  }
  
  /**
   * 現在アクティブなモデルを取得
   * @returns {string} アクティブなモデルのID
   */
  getActiveModel() {
    return this.activeModel;
  }
  
  /**
   * アクティブなモデルを設定
   * @param {string} modelId - 設定するモデルのID
   * @returns {boolean} 設定が成功したかどうか
   */
  setActiveModel(modelId) {
    // モデルが存在するか確認
    if (!this.models[modelId]) {
      console.error(`モデル ${modelId} は存在しません`);
      return false;
    }
    
    // モデルが失敗リストにあり、まだ回復時間が経過していない場合
    if (this.isModelFailed(modelId)) {
      const failedInfo = this.failedModels.get(modelId);
      const recoveryTime = new Date(failedInfo.recoveryTime);
      console.warn(`モデル ${modelId} は ${failedInfo.consecutiveFailures} 回連続で失敗しており、${recoveryTime.toLocaleTimeString()} まで利用できません`);
      return false;
    }
    
    // 非推奨モデルの警告
    if (this.models[modelId].deprecated) {
      console.warn(`モデル ${modelId} は非推奨です。将来的に削除される可能性があります。`);
      
      // 推奨モデルがあれば提案
      const recommendedModels = Object.keys(this.models).filter(id => this.models[id].recommended);
      if (recommendedModels.length > 0) {
        console.info(`代わりに ${recommendedModels.join(', ')} の使用を検討してください。`);
      }
    }
    
    this.activeModel = modelId;
    console.log(`アクティブモデルを変更しました: ${modelId}`);
    return true;
  }
  
  /**
   * 現在アクティブなモデルの情報を取得
   * @returns {Object} アクティブなモデルの情報
   */
  getActiveModelInfo() {
    return this.models[this.activeModel];
  }
  
  /**
   * 指定された次元数に最も近いモデルを取得
   * @param {number} dimensions - 目標とする次元数
   * @returns {string} 最も近い次元数を持つモデルのID
   */
  getModelByDimensions(dimensions) {
    let closestModel = this.defaultModel;
    let minDiff = Infinity;
    
    for (const [modelId, modelInfo] of Object.entries(this.models)) {
      // 失敗したモデルはスキップ
      if (this.isModelFailed(modelId)) continue;
      
      const diff = Math.abs(modelInfo.dimensions - dimensions);
      if (diff < minDiff) {
        minDiff = diff;
        closestModel = modelId;
      }
    }
    
    return closestModel;
  }
  
  /**
   * 指定された基準に基づいて最適なモデルを選択
   * @param {Object} criteria - 選択基準
   * @returns {string} 選択されたモデルのID
   */
  selectOptimalModel(criteria = {}) {
    // デフォルト基準とマージ
    const mergedCriteria = { ...this.selectionCriteria, ...criteria };
    
    // 利用可能なプロバイダーを取得
    const providers = this.getAvailableProviders();
    
    // 候補モデルのリスト（失敗したモデルを除外）
    const candidateModels = Object.keys(this.models).filter(modelId => 
      !this.isModelFailed(modelId)
    );
    
    if (candidateModels.length === 0) {
      console.warn('すべてのモデルが失敗状態です。フォールバックモデルを使用します。');
      return 'simple-hash';
    }
    
    // オフラインモードの場合はローカルモデルまたはシンプルハッシュのみを考慮
    if (mergedCriteria.offlineOnly) {
      const offlineModels = candidateModels.filter(modelId => 
        this.models[modelId].provider !== 'openai'
      );
      
      if (offlineModels.length === 0) {
        return 'simple-hash'; // フォールバック
      }
      
      // パフォーマンス優先の場合
      if (mergedCriteria.prioritizePerformance) {
        const sortedByPerformance = this.sortModelsByPerformance(offlineModels);
        return sortedByPerformance[0];
      }
      
      // 速度優先の場合
      if (mergedCriteria.prioritizeSpeed) {
        return 'simple-hash'; // 最も高速
      }
      
      return offlineModels[0];
    }
    
    // OpenAIが利用可能かどうかで分岐
    if (providers.openai) {
      const openaiModels = candidateModels.filter(modelId => 
        this.models[modelId].provider === 'openai'
      );
      
      // OpenAIモデルが利用可能な場合
      if (openaiModels.length > 0) {
        // コスト優先の場合
        if (mergedCriteria.prioritizeCost) {
          const sortedByCost = this.sortModelsByCost(openaiModels);
          return sortedByCost[0];
        }
        
        // パフォーマンス優先の場合
        if (mergedCriteria.prioritizePerformance) {
          const sortedByPerformance = this.sortModelsByPerformance(openaiModels);
          return sortedByPerformance[0];
        }
        
        // 推奨モデルがあれば使用
        const recommended = openaiModels.find(modelId => this.models[modelId].recommended);
        if (recommended) {
          return recommended;
        }
        
        // デフォルトはOpenAIの最初のモデル
        return openaiModels[0];
      }
    }
    
    // ローカルモデルが利用可能な場合
    if (providers.local) {
      const localModels = candidateModels.filter(modelId => 
        this.models[modelId].provider === 'local'
      );
      
      if (localModels.length > 0) {
        // パフォーマンス優先の場合
        if (mergedCriteria.prioritizePerformance) {
          const sortedByPerformance = this.sortModelsByPerformance(localModels);
          return sortedByPerformance[0];
        }
        
        // 速度優先の場合
        if (mergedCriteria.prioritizeSpeed) {
          // 次元数が小さいモデルが高速
          const sortedByDimensions = localModels.sort((a, b) => 
            this.models[a].dimensions - this.models[b].dimensions
          );
          return sortedByDimensions[0];
        }
        
        return localModels[0];
      }
    }
    
    // フォールバック: シンプルハッシュ
    return 'simple-hash';
  }
  
  /**
   * モデルをコストでソート（低コスト順）
   * @param {Array} modelIds - ソートするモデルIDのリスト（省略時は全モデル）
   * @returns {Array} コスト順にソートされたモデルIDのリスト
   */
  sortModelsByCost(modelIds = null) {
    const modelsToSort = modelIds || Object.keys(this.models);
    
    return modelsToSort.sort((a, b) => 
      this.models[a].costPer1KTokens - this.models[b].costPer1KTokens
    );
  }
  
  /**
   * モデルをパフォーマンスでソート（高性能順）
   * @param {Array} modelIds - ソートするモデルIDのリスト（省略時は全モデル）
   * @returns {Array} パフォーマンス順にソートされたモデルIDのリスト
   */
  sortModelsByPerformance(modelIds = null) {
    const modelsToSort = modelIds || Object.keys(this.models);
    const performanceRanking = {
      'highest': 5,
      'very-high': 4,
      'high': 3,
      'medium': 2,
      'low': 1
    };
    
    return modelsToSort.sort((a, b) => 
      performanceRanking[this.models[b].performance] - performanceRanking[this.models[a].performance]
    );
  }
  
  /**
   * 指定されたモデルの次元数を標準の次元数（1536）に変換するための係数を取得
   * @param {string} modelId - モデルID
   * @returns {number} 変換係数
   */
  getDimensionConversionFactor(modelId) {
    const standardDimensions = 1536; // OpenAI Ada-002の次元数を標準とする
    const modelDimensions = this.models[modelId]?.dimensions || standardDimensions;
    
    return standardDimensions / modelDimensions;
  }
  
  /**
   * 環境変数に基づいて利用可能なプロバイダーを判定
   * @returns {Object} 各プロバイダーの利用可能状態
   */
  getAvailableProviders() {
    return {
      openai: !!process.env.OPENAI_API_KEY,
      local: process.env.USE_LOCAL_MODEL === 'true',
      simple: true // 常に利用可能
    };
  }
  
  /**
   * 現在の環境で最適なモデルを自動選択
   * @returns {string} 選択されたモデルのID
   */
  autoSelectModel() {
    const providers = this.getAvailableProviders();
    
    // OpenAIが利用可能で、コスト優先でない場合
    if (providers.openai && !this.selectionCriteria.prioritizeCost) {
      // パフォーマンス優先の場合は最新のOpenAIモデルを使用
      if (this.selectionCriteria.prioritizePerformance) {
        return 'openai-3-small'; // コストパフォーマンスの良いモデル
      }
      return 'openai-3-small'; // 標準モデル（非推奨のada-002から変更）
    }
    
    // ローカルモデルが利用可能な場合
    if (providers.local) {
      // パフォーマンス優先の場合
      if (this.selectionCriteria.prioritizePerformance) {
        return 'local-mpnet';
      }
      // 速度優先の場合
      if (this.selectionCriteria.prioritizeSpeed) {
        return 'local-minilm';
      }
      return 'local-mpnet'; // デフォルト
    }
    
    // フォールバック: シンプルハッシュ
    return 'simple-hash';
  }
  
  /**
   * モデルの使用を記録
   * @param {string} modelId - モデルID
   * @param {number} tokenCount - 処理したトークン数
   */
  recordModelUsage(modelId, tokenCount = 0) {
    if (!this.models[modelId]) return;
    
    this.modelStats.usageCount[modelId] = (this.modelStats.usageCount[modelId] || 0) + 1;
    this.modelStats.totalTokens[modelId] = (this.modelStats.totalTokens[modelId] || 0) + tokenCount;
    this.modelStats.lastUsed[modelId] = new Date();
  }
}

export { ModelManager };
