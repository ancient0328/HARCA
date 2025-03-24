/**
 * @fileoverview モックロガー
 * テスト環境用のロガーモック
 */

const noop = () => {};

const logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop
};

export default logger;
