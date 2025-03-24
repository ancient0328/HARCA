/**
 * HARCA MCP サーバー エントリーポイント
 * 
 * このファイルは、HARCAサーバーのメインエントリーポイントとして機能し、
 * core/server.jsの機能をインポートして実行します。
 * 
 * ESモジュール形式で統一されています。
 */

import { startServer } from './core/server.js';

// コマンドライン引数の解析
const args = process.argv.slice(2);

// 環境変数からモードを取得（デフォルトはstdio）
const mode = process.env.HARCA_MODE === 'http' ? 'http' : 'stdio';

// データベースURLを取得
const dbUrl = args.length > 0 
  ? args[0] 
  : process.env.POSTGRES_CONNECTION_STRING || process.env.SUPABASE_CONNECTION_STRING;

if (!dbUrl) {
  console.error('エラー: データベースURLが指定されていません');
  console.error('環境変数POSTGRES_CONNECTION_STRINGまたはSUPABASE_CONNECTION_STRINGを設定するか、コマンドライン引数として指定してください');
  process.exit(1);
}

// サーバー起動
startServer(mode, dbUrl).catch(error => {
  console.error('サーバー起動エラー:', error);
  process.exit(1);
});
