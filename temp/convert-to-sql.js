const fs = require('fs');

// JSONファイルを読み込む
const schema = JSON.parse(fs.readFileSync('/Users/ancient0328/Development/MCPserver/HARCA/temp/schema_20250318_130857.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('/Users/ancient0328/Development/MCPserver/HARCA/temp/data_20250318_130857.json', 'utf8'));

// SQLファイルを作成
let sql = '-- 自動生成されたSQLスクリプト (20250318_130857)\n\n';
sql += 'BEGIN;\n\n';

// pgvector拡張機能を有効化
sql += '-- pgvector拡張機能を有効化\n';
sql += 'CREATE EXTENSION IF NOT EXISTS vector;\n\n';

// 各テーブルのデータをSQLに変換
for (const tableName in data) {
  const tableData = data[tableName];
  const tableSchema = schema[tableName];
  
  if (tableData.length === 0) {
    sql += `-- テーブル ${tableName} にはデータがありません\n\n`;
    continue;
  }
  
  sql += `-- テーブル ${tableName} のデータ (${tableData.length}行)\n`;
  
  // テーブルが存在しない場合は作成
  sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
  const columnDefs = tableSchema.map(col => {
    let dataType = col.data_type;
    
    // USER-DEFINED型の処理
    if (dataType === 'USER-DEFINED') {
      // pgvectorの場合はvector型に変換
      if (col.udt_name === 'vector') {
        dataType = 'vector';
      } else {
        dataType = col.udt_name;
      }
    }
    
    let def = `  "${col.column_name}" ${dataType}`;
    if (col.character_maximum_length) {
      def += `(${col.character_maximum_length})`;
    }
    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }
    if (col.column_default) {
      def += ` DEFAULT ${col.column_default}`;
    }
    return def;
  });
  sql += columnDefs.join(',\n');
  sql += '\n);\n\n';
  
  // 既存のデータを削除
  sql += `TRUNCATE TABLE "${tableName}" CASCADE;\n\n`;
  
  // データのINSERT文を生成
  for (const row of tableData) {
    const columns = Object.keys(row);
    const values = columns.map(col => {
      const value = row[col];
      if (value === null) {
        return 'NULL';
      } else if (typeof value === 'string') {
        // 文字列内のシングルクォートをエスケープし、バイナリデータとして扱う
        return `E'${value.replace(/'/g, "''").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}'`;
      } else if (typeof value === 'object') {
        // オブジェクトや配列はJSON文字列に変換
        return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
      } else {
        return value;
      }
    });
    
    sql += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
  }
  
  sql += '\n';
}

sql += 'COMMIT;\n';

// SQLファイルに書き込む
fs.writeFileSync('/Users/ancient0328/Development/MCPserver/HARCA/temp/import_data_20250318_130857.sql', sql);
console.log(`SQLファイルを生成しました: /Users/ancient0328/Development/MCPserver/HARCA/temp/import_data_20250318_130857.sql`);
