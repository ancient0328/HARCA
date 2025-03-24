const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function exportData() {
  // Supabaseに接続
  const client = new Client({
    connectionString: 'postgres://postgres:CGR256ORmrUgfEXl@db.ctoeobczdztvhobydzan.supabase.co:5432/postgres'
  });
  
  try {
    console.log('Supabaseに接続しています...');
    await client.connect();
    console.log('接続成功');
    
    // テーブル一覧を取得
    const tablesResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    const tables = tablesResult.rows.map(row => row.tablename);
    console.log(`${tables.length}個のテーブルが見つかりました`);
    
    // スキーマ情報を格納するオブジェクト
    const schema = {};
    // データを格納するオブジェクト
    const data = {};
    
    // 各テーブルのスキーマとデータを取得
    for (const table of tables) {
      console.log(`テーブル ${table} の情報を取得中...`);
      
      // テーブルのカラム情報を取得
      const columnsResult = await client.query(
        `SELECT column_name, data_type, character_maximum_length, 
          is_nullable, column_default, udt_name
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = '${table}'`
      );
      
      schema[table] = columnsResult.rows;
      
      // テーブルのデータを取得
      const dataResult = await client.query(`SELECT * FROM "${table}"`);
      data[table] = dataResult.rows;
      
      console.log(`テーブル ${table}: ${dataResult.rows.length}行のデータを取得しました`);
    }
    
    // スキーマ情報をファイルに保存
    fs.writeFileSync('/Users/ancient0328/Development/MCPserver/HARCA/temp/schema_20250318_130857.json', JSON.stringify(schema, null, 2));
    console.log(`スキーマ情報を${Object.keys(schema).length}個のテーブル分保存しました`);
    
    // データをファイルに保存
    fs.writeFileSync('/Users/ancient0328/Development/MCPserver/HARCA/temp/data_20250318_130857.json', JSON.stringify(data, null, 2));
    console.log(`データを保存しました`);
    
    return { success: true, tableCount: tables.length };
  } catch (error) {
    console.error('エラーが発生しました:', error);
    return { success: false, error: error.message };
  } finally {
    await client.end();
    console.log('データベース接続を終了しました');
  }
}

exportData().then(result => {
  console.log('結果:', result);
  process.exit(result.success ? 0 : 1);
});
