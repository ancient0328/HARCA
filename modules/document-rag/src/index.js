/**
 * Document RAG モジュールのメインエントリーポイント
 * 
 * このモジュールは、HARCAプロジェクトのドキュメントをRAG（Retrieval Augmented Generation）化するための
 * 機能を提供します。主要なクラスとユーティリティをエクスポートし、他のモジュールから簡単に利用できるようにします。
 * 
 * @module document-rag
 */
const DocumentProcessor = require('./document-processor');
const DocumentVectorStore = require('./document-vector-store');
const DocumentRAG = require('./document-rag');
const logger = require('./utils/logger');
const config = require('../config/default');

/**
 * モジュールの初期化
 * @param {Object} options - 初期化オプション
 * @returns {Object} 初期化されたDocumentRAGインスタンス
 */
function initialize(options = {}) {
  logger.info('Document RAGモジュールを初期化しています...');
  return new DocumentRAG(options);
}

/**
 * モジュールのヘルスチェック
 * @returns {Promise<boolean>} モジュールが正常に動作しているかどうか
 */
async function healthCheck() {
  try {
    logger.info('Document RAGモジュールのヘルスチェックを実行しています...');
    
    // ログディレクトリの確認
    const fs = require('fs').promises;
    const path = require('path');
    const logDir = path.dirname(config.logging.file);
    await fs.access(logDir);
    
    // ベクトルストアの接続確認
    const vectorStore = new DocumentVectorStore({
      namespace: config.vectorStore.namespace
    });
    await vectorStore.initialize();
    
    logger.info('Document RAGモジュールのヘルスチェックが成功しました');
    return true;
  } catch (error) {
    logger.error(`Document RAGモジュールのヘルスチェックに失敗しました: ${error.message}`);
    return false;
  }
}

module.exports = {
  // メインクラス
  DocumentRAG,
  
  // ユーティリティクラス
  DocumentProcessor,
  DocumentVectorStore,
  
  // 便利な関数
  initialize,
  healthCheck,
  
  // 設定
  config
};
