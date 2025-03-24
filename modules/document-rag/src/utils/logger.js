/**
 * ロガーユーティリティ
 * ドキュメントRAGモジュールのログ機能を提供する
 */
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const config = require('../../config/default');

// ログディレクトリの確保
const logDir = path.dirname(config.logging.file);
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log(`ロガー初期化: ログディレクトリを作成しました: ${logDir}`);
  } else {
    console.log(`ロガー初期化: ログディレクトリが存在します: ${logDir}`);
  }
} catch (error) {
  console.error(`ロガー初期化: ログディレクトリの確認/作成中にエラーが発生しました: ${logDir}`, error);
}

// ログフォーマットの定義
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}] document-rag: ${message}`;
});

// Winstonロガーの設定
const logger = winston.createLogger({
  level: config.logging.level || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    logFormat
  ),
  transports: [
    // ファイルへのログ出力
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// 開発環境ではコンソールにも出力
if (config.logging.console || process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  }));
}

module.exports = logger;
