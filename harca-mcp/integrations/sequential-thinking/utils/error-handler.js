/**
 * Sequential Thinking統合モジュールエラーハンドラー
 * 
 * このモジュールは、Sequential Thinking統合モジュールのエラーハンドリング機能を提供します。
 * エラーの分類、ログ記録、リトライ戦略などを実装します。
 */

import { config } from './config.js';
import { logger } from './logger.js';

// エラータイプの定義
const ErrorTypes = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  SERVICE: 'SERVICE_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  PARSE: 'PARSE_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * エラータイプを判別
 * @param {Error} error エラーオブジェクト
 * @returns {string} エラータイプ
 */
function determineErrorType(error) {
  if (!error) return ErrorTypes.UNKNOWN;
  
  const message = error.message || '';
  
  if (message.includes('ECONNREFUSED') || 
      message.includes('ENOTFOUND') || 
      message.includes('ECONNRESET') ||
      message.includes('network') ||
      error.name === 'FetchError') {
    return ErrorTypes.NETWORK;
  }
  
  if (message.includes('timeout') || 
      message.includes('timed out')) {
    return ErrorTypes.TIMEOUT;
  }
  
  if (message.includes('JSON') || 
      message.includes('parse') || 
      message.includes('Unexpected token')) {
    return ErrorTypes.PARSE;
  }
  
  if (message.includes('validation') || 
      message.includes('invalid') || 
      message.includes('required')) {
    return ErrorTypes.VALIDATION;
  }
  
  if (message.includes('service') || 
      message.includes('status') || 
      message.includes('500')) {
    return ErrorTypes.SERVICE;
  }
  
  return ErrorTypes.UNKNOWN;
}

/**
 * エラーをログに記録
 * @param {Error} error エラーオブジェクト
 * @param {string} context エラーが発生したコンテキスト
 */
function logError(error, context = '') {
  if (!error) return;
  
  const errorType = determineErrorType(error);
  const contextPrefix = context ? `[${context}] ` : '';
  
  switch (errorType) {
    case ErrorTypes.NETWORK:
      logger.error(`${contextPrefix}ネットワークエラー: ${error.message}`);
      break;
    case ErrorTypes.TIMEOUT:
      logger.error(`${contextPrefix}タイムアウトエラー: ${error.message}`);
      break;
    case ErrorTypes.SERVICE:
      logger.error(`${contextPrefix}サービスエラー: ${error.message}`);
      break;
    case ErrorTypes.VALIDATION:
      logger.warn(`${contextPrefix}バリデーションエラー: ${error.message}`);
      break;
    case ErrorTypes.PARSE:
      logger.error(`${contextPrefix}パースエラー: ${error.message}`);
      break;
    default:
      logger.error(`${contextPrefix}不明なエラー: ${error.message}`);
  }
  
  if (config.debug && error.stack) {
    logger.debug(`${contextPrefix}スタックトレース: ${error.stack}`);
  }
}

/**
 * リトライが必要かどうかを判断
 * @param {Error} error エラーオブジェクト
 * @returns {boolean} リトライすべきかどうか
 */
function shouldRetry(error) {
  if (!error) return false;
  
  const errorType = determineErrorType(error);
  
  // ネットワークエラーとタイムアウトエラーはリトライ可能
  return errorType === ErrorTypes.NETWORK || 
         errorType === ErrorTypes.TIMEOUT || 
         errorType === ErrorTypes.SERVICE;
}

/**
 * エラーメッセージをユーザーフレンドリーなメッセージに変換
 * @param {Error} error エラーオブジェクト
 * @returns {string} ユーザーフレンドリーなエラーメッセージ
 */
function getUserFriendlyMessage(error) {
  if (!error) return '不明なエラーが発生しました。';
  
  const errorType = determineErrorType(error);
  
  switch (errorType) {
    case ErrorTypes.NETWORK:
      return 'Sequential Thinkingサービスに接続できませんでした。ネットワーク接続を確認してください。';
    case ErrorTypes.TIMEOUT:
      return 'Sequential Thinkingサービスからの応答がタイムアウトしました。後でもう一度お試しください。';
    case ErrorTypes.SERVICE:
      return 'Sequential Thinkingサービスでエラーが発生しました。サービスの状態を確認してください。';
    case ErrorTypes.VALIDATION:
      return 'リクエストパラメータが無効です。入力を確認してください。';
    case ErrorTypes.PARSE:
      return 'レスポンスの解析中にエラーが発生しました。サービスの互換性を確認してください。';
    default:
      return `エラーが発生しました: ${error.message}`;
  }
}

/**
 * 指数バックオフによる待機時間を計算
 * @param {number} attempt 試行回数（0から始まる）
 * @param {number} baseDelay 基本遅延時間（ミリ秒）
 * @param {number} maxDelay 最大遅延時間（ミリ秒）
 * @returns {number} 待機時間（ミリ秒）
 */
function calculateBackoff(attempt, baseDelay = config.service.retryDelay, maxDelay = 30000) {
  // 最初の試行は遅延なし
  if (attempt <= 0) return 0;
  
  // 指数バックオフ: baseDelay * 2^(attempt-1)
  const delay = baseDelay * Math.pow(2, attempt - 1);
  
  // ランダム要素を追加（ジッター）
  const jitter = Math.random() * 0.3 + 0.85; // 0.85〜1.15の範囲
  
  // 最大遅延を超えないように制限
  return Math.min(delay * jitter, maxDelay);
}

/**
 * 非同期関数をリトライ付きで実行
 * @param {Function} fn 実行する非同期関数
 * @param {Object} options オプション
 * @param {number} options.retries リトライ回数
 * @param {number} options.baseDelay 基本遅延時間（ミリ秒）
 * @param {string} options.context エラーログのコンテキスト
 * @returns {Promise<any>} 関数の実行結果
 */
async function withRetry(fn, options = {}) {
  const retries = options.retries || config.service.retries;
  const baseDelay = options.baseDelay || config.service.retryDelay;
  const context = options.context || 'RetryHandler';
  
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0 && config.debug) {
        logger.debug(`[${context}] 再試行 ${attempt}/${retries}`);
      }
      
      // 指数バックオフ（最初の試行は遅延なし）
      const delay = calculateBackoff(attempt, baseDelay);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // 関数の実行
      return await fn();
    } catch (error) {
      lastError = error;
      
      // エラーをログに記録
      logError(error, context);
      
      // リトライすべきでないエラーの場合は即座に失敗
      if (!shouldRetry(error)) {
        throw error;
      }
      
      if (config.debug) {
        logger.debug(`[${context}] 試行 ${attempt + 1}/${retries + 1} 失敗: ${error.message}`);
      }
    }
  }
  
  // すべての試行が失敗した場合
  throw new Error(`リクエスト失敗（${retries + 1}回試行後）: ${lastError.message}`);
}

/**
 * エラーをラップして追加情報を付与
 * @param {Error} error 元のエラー
 * @param {string} prefix エラーメッセージのプレフィックス
 * @param {Object} context エラーコンテキスト情報
 * @returns {Error} ラップされたエラー
 */
function wrapError(error, prefix = '', context = {}) {
  const errorType = determineErrorType(error);
  const originalMessage = error.message || 'エラーが発生しました';
  const friendlyMessage = getUserFriendlyMessage(error);
  
  // コンテキスト情報をログに記録
  logError(error, `${prefix} - ${JSON.stringify(context)}`);
  
  // 新しいエラーを作成
  const wrappedError = new Error(`${prefix}: ${friendlyMessage}`);
  
  // 元のエラー情報を保持
  wrappedError.originalError = error;
  wrappedError.errorType = errorType;
  wrappedError.context = context;
  
  return wrappedError;
}

export {
  ErrorTypes,
  determineErrorType,
  logError,
  shouldRetry,
  getUserFriendlyMessage,
  calculateBackoff,
  withRetry,
  wrapError
};
