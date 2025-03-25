// PostgreSQL接続確認スクリプト
// このスクリプトは、PostgreSQL接続の状態を確認し、必要なテーブルが存在するかどうかを確認します

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// 利用可能な接続文字列をすべて試す
const connectionStrings = [
  process.env.POSTGRES_CONNECTION_STRING,
  process.env.HARCA_POSTGRES_CONNECTION_STRING,
  process.env.SUPABASE_CONNECTION_STRING
].filter(Boolean);

if (connectionStrings.length === 0) {
  console.error('エラー: PostgreSQL接続文字列が設定されていません');
  console.log('以下の環境変数のいずれかを設定してください:');
  console.log('- POSTGRES_CONNECTION_STRING');
  console.log('- HARCA_POSTGRES_CONNECTION_STRING');
  console.log('- SUPABASE_CONNECTION_STRING');
  process.exit(1);
}

// 各接続文字列を試す
async function testConnections() {
  console.log('PostgreSQL接続テストを開始します...');
  
  for (const connectionString of connectionStrings) {
    try {
      console.log(`接続文字列を試行: ${connectionString.replace(/:[^:]*@/, ':****@')}`);
      
      const pool = new Pool({ connectionString });
      const client = await pool.connect();
      
      console.log('✅ 接続成功!');
      
      // PostgreSQLバージョンの確認
      const versionResult = await client.query('SELECT version()');
      console.log(`PostgreSQLバージョン: ${versionResult.rows[0].version}`);
      
      // pgvector拡張の確認
      const pgvectorResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_extension WHERE extname = 'vector'
        );
      `).catch(() => ({ rows: [{ exists: false }] }));
      
      if (pgvectorResult.rows[0].exists) {
        console.log('✅ pgvector拡張がインストールされています');
      } else {
        console.error('❌ pgvector拡張がインストールされていません');
        console.log('pgvector拡張をインストールするには、以下のSQLコマンドを実行してください:');
        console.log('CREATE EXTENSION vector;');
      }
      
      // テーブルの確認
      const tables = ['embeddings', 'code_vectors'];
      
      for (const table of tables) {
        const tableResult = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          );
        `, [table]);
        
        if (tableResult.rows[0].exists) {
          console.log(`✅ ${table}テーブルが存在します`);
          
          // テーブル内のレコード数を確認
          const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
          console.log(`  - レコード数: ${countResult.rows[0].count}`);
          
          // テーブル構造の確認
          const columnsResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1
          `, [table]);
          
          console.log(`  - カラム構造:`);
          columnsResult.rows.forEach(row => {
            console.log(`    - ${row.column_name}: ${row.data_type}`);
          });
        } else {
          console.log(`❌ ${table}テーブルが存在しません`);
        }
      }
      
      // 接続を閉じる
      client.release();
      await pool.end();
      
      return true;
    } catch (error) {
      console.error(`❌ 接続エラー: ${error.message}`);
    }
  }
  
  console.error('❌ すべての接続文字列で接続に失敗しました');
  return false;
}

// メイン処理
async function main() {
  const success = await testConnections();
  
  if (!success) {
    console.log('\n接続問題を解決するためのヒント:');
    console.log('1. PostgreSQLサービスが実行中であることを確認してください');
    console.log('2. 接続文字列のホスト、ポート、ユーザー名、パスワードが正しいことを確認してください');
    console.log('3. ファイアウォールがPostgreSQLポートへのアクセスを許可していることを確認してください');
    console.log('4. Docker環境を使用している場合、コンテナ間のネットワーク設定を確認してください');
    process.exit(1);
  }
  
  console.log('\n✅ PostgreSQL接続テスト完了');
}

main().catch(error => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
});
