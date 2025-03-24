/**
 * ドキュメント処理スクリプト
 * ドキュメントをRAG化するためのコマンドラインスクリプト
 */
const path = require('path');
const DocumentRAG = require('../src/document-rag');
const config = require('../config/default');

// 環境変数の読み込み
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../../harca-mcp/.env') });

// コマンドライン引数の解析
const args = process.argv.slice(2);
const sourceDir = args[0] || config.document.sourceDir;

async function main() {
  console.log(`ドキュメントRAG処理を開始します: ${sourceDir}`);
  
  try {
    // DocumentRAGインスタンスの初期化
    const documentRag = new DocumentRAG({
      sourceDir: sourceDir
    });
    
    // 処理の実行
    console.log('ドキュメントの処理とベクトル化を実行中...');
    const count = await documentRag.processAndStoreDocuments();
    
    console.log(`処理完了: ${count}件のドキュメントをRAG化しました`);
    
    // シャットダウン
    await documentRag.shutdown();
  } catch (error) {
    console.error(`エラーが発生しました: ${error.message}`);
    process.exit(1);
  }
}

// スクリプトの実行
main().catch(console.error);
