/**
 * ドキュメント検索スクリプト
 * RAGシステムを使用してドキュメントを検索するためのコマンドラインスクリプト
 */
const path = require('path');
const DocumentRAG = require('../src/document-rag');
const config = require('../config/default');

// 環境変数の読み込み
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../../harca-mcp/.env') });

// コマンドライン引数の解析
const args = process.argv.slice(2);
const query = args[0];
const topK = parseInt(args[1] || '3', 10);

if (!query) {
  console.error('使用方法: node search-documents.js "検索クエリ" [結果数]');
  process.exit(1);
}

async function main() {
  console.log(`検索クエリ: "${query}"`);
  console.log(`取得件数: ${topK}`);
  
  try {
    // DocumentRAGインスタンスの初期化
    const documentRag = new DocumentRAG();
    
    // 検索の実行
    console.log('検索を実行中...');
    const results = await documentRag.search(query, { topK });
    
    // 結果の表示
    console.log(`\n検索結果: ${results.length}件\n`);
    
    results.forEach((result, index) => {
      console.log(`[${index + 1}] スコア: ${result.score.toFixed(4)}`);
      console.log(`タイトル: ${result.metadata.title || 'タイトルなし'}`);
      console.log(`ソース: ${result.metadata.source}`);
      console.log(`内容:\n${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}`);
      console.log('-'.repeat(80));
    });
    
    // シャットダウン
    await documentRag.shutdown();
  } catch (error) {
    console.error(`エラーが発生しました: ${error.message}`);
    process.exit(1);
  }
}

// スクリプトの実行
main().catch(console.error);
