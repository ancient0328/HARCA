// features/vector-store/error-handler.js - エラーハンドリングユーティリティ

/**
 * エラータイプの分類
 */
const ErrorTypes = {
  // 認証関連エラー
  AUTHENTICATION: 'authentication',
  
  // レート制限エラー
  RATE_LIMIT: 'rate_limit',
  
  // タイムアウトエラー
  TIMEOUT: 'timeout',
  
  // ネットワークエラー
  NETWORK: 'network',
  
  // 無効なリクエストエラー
  INVALID_REQUEST: 'invalid_request',
  
  // サーバーエラー
  SERVER: 'server',
  
  // モデル関連エラー
  MODEL: 'model',
  
  // 入力テキスト関連エラー
  INPUT: 'input',
  
  // その他のエラー
  UNKNOWN: 'unknown'
};

/**
 * エラーの重大度レベル
 */
const SeverityLevels = {
  // 致命的なエラー（回復不可能）
  FATAL: 'fatal',
  
  // 重大なエラー（回復可能だが即時対応が必要）
  CRITICAL: 'critical',
  
  // 警告（回復可能、一時的な問題の可能性）
  WARNING: 'warning',
  
  // 情報（正常動作に影響しない軽微な問題）
  INFO: 'info'
};

/**
 * エラーからの回復戦略
 */
const RecoveryStrategies = {
  // 即時再試行
  RETRY_IMMEDIATELY: 'retry_immediately',
  
  // 指数バックオフ付き再試行
  RETRY_WITH_BACKOFF: 'retry_with_backoff',
  
  // 別のモデルへのフォールバック
  FALLBACK_MODEL: 'fallback_model',
  
  // 一定時間後に再試行
  RETRY_AFTER_DELAY: 'retry_after_delay',
  
  // ユーザー介入が必要
  REQUIRE_USER_ACTION: 'require_user_action',
  
  // 回復不可能
  NO_RECOVERY: 'no_recovery'
};

/**
 * エラーハンドラークラス
 * エラーの分類、ログ記録、回復戦略の提案を行う
 */
class ErrorHandler {
  /**
   * エラーハンドラーの初期化
   * @param {Object} config - 設定オブジェクト
   */
  constructor(config = {}) {
    this.errorLog = [];
    this.maxLogSize = config.maxLogSize || 100;
    this.notifyErrors = config.notifyErrors !== false;
    this.errorPatterns = this.initializeErrorPatterns();
  }
  
  /**
   * エラーパターンの初期化
   * 各種エラーメッセージのパターンとそれに対応するエラータイプを定義
   * @returns {Array<Object>} エラーパターンの配列
   */
  initializeErrorPatterns() {
    return [
      // 認証エラー
      {
        pattern: /(api key|authentication|unauthorized|auth|invalid key|not authorized|認証|APIキー|無効なキー|権限がありません)/i,
        type: ErrorTypes.AUTHENTICATION,
        severity: SeverityLevels.CRITICAL,
        recovery: RecoveryStrategies.REQUIRE_USER_ACTION
      },
      
      // レート制限エラー
      {
        pattern: /(rate limit|too many requests|quota exceeded|ratelimit|レート制限|リクエスト数超過|クォータ超過)/i,
        type: ErrorTypes.RATE_LIMIT,
        severity: SeverityLevels.WARNING,
        recovery: RecoveryStrategies.RETRY_AFTER_DELAY
      },
      
      // タイムアウトエラー
      {
        pattern: /(timeout|timed out|request timed out|deadline exceeded|タイムアウト|時間切れ|リクエストがタイムアウト)/i,
        type: ErrorTypes.TIMEOUT,
        severity: SeverityLevels.WARNING,
        recovery: RecoveryStrategies.RETRY_WITH_BACKOFF
      },
      
      // ネットワークエラー
      {
        pattern: /(network|connection|econnrefused|socket|dns|fetch|unreachable|ネットワーク|接続|接続拒否|ソケット|到達不能)/i,
        type: ErrorTypes.NETWORK,
        severity: SeverityLevels.WARNING,
        recovery: RecoveryStrategies.RETRY_WITH_BACKOFF
      },
      
      // 無効なリクエストエラー
      {
        pattern: /(invalid request|bad request|parameter|invalid input|validation|不正なリクエスト|パラメータ|無効な入力|検証)/i,
        type: ErrorTypes.INVALID_REQUEST,
        severity: SeverityLevels.CRITICAL,
        recovery: RecoveryStrategies.NO_RECOVERY
      },
      
      // サーバーエラー
      {
        pattern: /(server error|5\d\d|internal server|service unavailable|サーバーエラー|内部サーバー|サービス利用不可)/i,
        type: ErrorTypes.SERVER,
        severity: SeverityLevels.WARNING,
        recovery: RecoveryStrategies.FALLBACK_MODEL
      },
      
      // モデル関連エラー
      {
        pattern: /(model|not found|unsupported|does not exist|no such model|モデル|見つかりません|サポートされていません|存在しません)/i,
        type: ErrorTypes.MODEL,
        severity: SeverityLevels.CRITICAL,
        recovery: RecoveryStrategies.FALLBACK_MODEL
      },
      
      // 入力テキスト関連エラー
      {
        pattern: /(content filter|inappropriate|text|content|token limit|too long|コンテンツフィルター|不適切|テキスト|コンテンツ|トークン制限|長すぎる)/i,
        type: ErrorTypes.INPUT,
        severity: SeverityLevels.WARNING,
        recovery: RecoveryStrategies.NO_RECOVERY
      }
    ];
  }
  
  /**
   * エラーを分類
   * @param {Error} error - 発生したエラー
   * @returns {Object} エラー分類情報
   */
  classifyError(error) {
    const errorMessage = error.message || error.toString();
    
    // エラーパターンとのマッチングを試行
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(errorMessage)) {
        return {
          type: pattern.type,
          severity: pattern.severity,
          recovery: pattern.recovery,
          message: errorMessage,
          original: error
        };
      }
    }
    
    // マッチするパターンがない場合は不明なエラーとして分類
    return {
      type: ErrorTypes.UNKNOWN,
      severity: SeverityLevels.WARNING,
      recovery: RecoveryStrategies.FALLBACK_MODEL,
      message: errorMessage,
      original: error
    };
  }
  
  /**
   * エラーを処理
   * @param {Error} error - 発生したエラー
   * @param {string} context - エラーが発生したコンテキスト
   * @returns {Object} 処理結果と推奨アクション
   */
  handleError(error, context = '') {
    // エラーの分類
    const classification = this.classifyError(error);
    
    // エラーログに記録
    this.logError(error, classification, context);
    
    // 重大度に基づく処理
    let recommendedAction;
    
    switch (classification.severity) {
      case SeverityLevels.FATAL:
        console.error(`致命的なエラー (${classification.type}): ${classification.message}`);
        recommendedAction = {
          action: 'abort',
          message: '回復不可能なエラーが発生しました。操作を中止します。'
        };
        break;
        
      case SeverityLevels.CRITICAL:
        console.error(`重大なエラー (${classification.type}): ${classification.message}`);
        recommendedAction = this.getRecoveryAction(classification);
        break;
        
      case SeverityLevels.WARNING:
        console.warn(`警告 (${classification.type}): ${classification.message}`);
        recommendedAction = this.getRecoveryAction(classification);
        break;
        
      case SeverityLevels.INFO:
        console.info(`情報 (${classification.type}): ${classification.message}`);
        recommendedAction = {
          action: 'continue',
          message: '処理を続行します。'
        };
        break;
        
      default:
        console.warn(`不明なエラー: ${classification.message}`);
        recommendedAction = this.getRecoveryAction(classification);
    }
    
    return {
      classification,
      recommendedAction,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 回復戦略に基づいた推奨アクションを取得
   * @param {Object} classification - エラー分類情報
   * @returns {Object} 推奨アクション
   */
  getRecoveryAction(classification) {
    switch (classification.recovery) {
      case RecoveryStrategies.RETRY_IMMEDIATELY:
        return {
          action: 'retry',
          delay: 0,
          message: '即時再試行します。'
        };
        
      case RecoveryStrategies.RETRY_WITH_BACKOFF:
        return {
          action: 'retry',
          delay: this.calculateBackoff(classification),
          message: '指数バックオフ付きで再試行します。'
        };
        
      case RecoveryStrategies.FALLBACK_MODEL:
        return {
          action: 'fallback',
          message: '代替モデルを使用します。'
        };
        
      case RecoveryStrategies.RETRY_AFTER_DELAY:
        let delay = 1000; // デフォルト1秒
        
        // レート制限の場合は長めの遅延
        if (classification.type === ErrorTypes.RATE_LIMIT) {
          delay = 60000; // 1分
        }
        
        return {
          action: 'retry',
          delay,
          message: `${delay / 1000}秒後に再試行します。`
        };
        
      case RecoveryStrategies.REQUIRE_USER_ACTION:
        return {
          action: 'user_action',
          message: 'ユーザーの対応が必要です。'
        };
        
      case RecoveryStrategies.NO_RECOVERY:
      default:
        return {
          action: 'abort',
          message: '回復戦略がありません。処理を中止します。'
        };
    }
  }
  
  /**
   * バックオフ時間を計算
   * @param {Object} classification - エラー分類情報
   * @param {number} retryCount - 再試行回数
   * @returns {number} バックオフ時間（ミリ秒）
   */
  calculateBackoff(classification, retryCount = 1) {
    const baseDelay = 1000; // 基本遅延（1秒）
    const maxDelay = 30000; // 最大遅延（30秒）
    
    // 指数バックオフ（2のretryCount乗 * 基本遅延）
    let delay = Math.min(Math.pow(2, retryCount) * baseDelay, maxDelay);
    
    // タイプに応じた調整
    if (classification.type === ErrorTypes.NETWORK) {
      delay = Math.min(delay * 1.5, maxDelay); // ネットワークエラーは少し長め
    }
    
    // ランダム要素を追加（ジッター）
    delay = delay * (0.5 + Math.random());
    
    return Math.floor(delay);
  }
  
  /**
   * エラーをログに記録
   * @param {Error} error - 発生したエラー
   * @param {Object} classification - エラー分類情報
   * @param {string} context - エラーが発生したコンテキスト
   */
  logError(error, classification, context) {
    // ログサイズの制限
    if (this.errorLog.length >= this.maxLogSize) {
      this.errorLog.shift(); // 最も古いエラーを削除
    }
    
    // エラー情報を記録
    this.errorLog.push({
      timestamp: new Date().toISOString(),
      message: error.message || error.toString(),
      stack: error.stack,
      type: classification.type,
      severity: classification.severity,
      context,
      metadata: {
        code: error.code,
        statusCode: error.statusCode || error.status,
        name: error.name
      }
    });
  }
  
  /**
   * エラーログを取得
   * @param {Object} filters - フィルタリング条件
   * @returns {Array<Object>} フィルタリングされたエラーログ
   */
  getErrorLog(filters = {}) {
    let filteredLog = [...this.errorLog];
    
    // タイプでフィルタリング
    if (filters.type) {
      filteredLog = filteredLog.filter(entry => entry.type === filters.type);
    }
    
    // 重大度でフィルタリング
    if (filters.severity) {
      filteredLog = filteredLog.filter(entry => entry.severity === filters.severity);
    }
    
    // 時間範囲でフィルタリング
    if (filters.since) {
      const sinceTime = new Date(filters.since).getTime();
      filteredLog = filteredLog.filter(entry => new Date(entry.timestamp).getTime() >= sinceTime);
    }
    
    // 最大件数の制限
    if (filters.limit && typeof filters.limit === 'number') {
      filteredLog = filteredLog.slice(-filters.limit);
    }
    
    return filteredLog;
  }
  
  /**
   * エラーログをクリア
   */
  clearErrorLog() {
    this.errorLog = [];
  }
  
  /**
   * エラーログの統計情報を取得
   * @returns {Object} エラーログの統計情報
   */
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      bySeverity: {},
      recentErrors: this.errorLog.slice(-5) // 最新の5件
    };
    
    // タイプ別の集計
    for (const entry of this.errorLog) {
      // タイプ別
      if (!stats.byType[entry.type]) {
        stats.byType[entry.type] = 0;
      }
      stats.byType[entry.type]++;
      
      // 重大度別
      if (!stats.bySeverity[entry.severity]) {
        stats.bySeverity[entry.severity] = 0;
      }
      stats.bySeverity[entry.severity]++;
    }
    
    return stats;
  }
}

export {
  ErrorHandler,
  ErrorTypes,
  SeverityLevels,
  RecoveryStrategies
};
