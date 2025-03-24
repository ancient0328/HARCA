/**
 * シンプルなロガーモジュール
 * 
 * このモジュールは、Sequential Thinking統合モジュール用のシンプルなロガー機能を提供します。
 * HARCAプロジェクト規約に準拠したログレベルとフォーマットを使用します。
 */

// ログレベル
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// 現在のログレベル（環境変数から取得、デフォルトはINFO）
const currentLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

// デバッグモードの判定
const isDebugMode = process.env.DEBUG === 'true';

/**
 * ロガーオブジェクト
 */
const logger = {
  /**
   * デバッグレベルのログを出力
   * @param {...any} args 出力する内容
   */
  debug: (...args) => {
    if (currentLevel <= LOG_LEVELS.DEBUG || isDebugMode) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * 情報レベルのログを出力
   * @param {...any} args 出力する内容
   */
  info: (...args) => {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * 警告レベルのログを出力
   * @param {...any} args 出力する内容
   */
  warn: (...args) => {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * エラーレベルのログを出力
   * @param {...any} args 出力する内容
   */
  error: (...args) => {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error('[ERROR]', ...args);
    }
  }
};

export { logger };
