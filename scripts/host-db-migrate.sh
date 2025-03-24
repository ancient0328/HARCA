#!/bin/bash
# ホストマシンからSupabaseデータを取得し、内部PostgreSQLに移行するスクリプト

# 設定
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TEMP_DIR="${PROJECT_ROOT}/temp"
MIGRATION_LOG="${BACKUP_DIR}/migration_log_${TIMESTAMP}.log"

# ディレクトリの作成
mkdir -p ${BACKUP_DIR}
mkdir -p ${TEMP_DIR}

# Supabase接続情報
SUPABASE_CONNECTION_STRING="postgres://postgres:CGR256ORmrUgfEXl@db.ctoeobczdztvhobydzan.supabase.co:5432/postgres"
SUPABASE_HOST="db.ctoeobczdztvhobydzan.supabase.co"
SUPABASE_PORT="5432"
SUPABASE_USER="postgres"
SUPABASE_PASSWORD="CGR256ORmrUgfEXl"
SUPABASE_DB="postgres"

# 内部PostgreSQL接続情報
LOCAL_HOST="localhost"
LOCAL_PORT="3800"
LOCAL_USER="harca"
LOCAL_PASSWORD="harca_password"
LOCAL_DB="harca_db"
LOCAL_CONNECTION_STRING="postgres://${LOCAL_USER}:${LOCAL_PASSWORD}@${LOCAL_HOST}:${LOCAL_PORT}/${LOCAL_DB}"

# ログ関数
log() {
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1" | tee -a ${MIGRATION_LOG}
}

log "データ移行プロセスを開始します"

# Dockerコンテナが実行中か確認
if ! docker ps | grep -q "harca-postgres"; then
  log "エラー: PostgreSQLコンテナ (harca-postgres) が実行されていません。"
  log "docker-compose up -d postgres を実行してコンテナを起動してください。"
  exit 1
fi

# @modelcontextprotocol/server-postgresパッケージを使用してデータをエクスポート
log "Supabaseからのデータエクスポートを開始します..."
SCHEMA_FILE="${TEMP_DIR}/schema_${TIMESTAMP}.json"
DATA_FILE="${TEMP_DIR}/data_${TIMESTAMP}.json"

log "Node.jsスクリプトを使用してSupabaseからデータをエクスポートします..."
cat > ${TEMP_DIR}/export-data.js << EOF
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function exportData() {
  // Supabaseに接続
  const client = new Client({
    connectionString: '${SUPABASE_CONNECTION_STRING}'
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
    console.log(\`\${tables.length}個のテーブルが見つかりました\`);
    
    // スキーマ情報を格納するオブジェクト
    const schema = {};
    // データを格納するオブジェクト
    const data = {};
    
    // 各テーブルのスキーマとデータを取得
    for (const table of tables) {
      console.log(\`テーブル \${table} の情報を取得中...\`);
      
      // テーブルのカラム情報を取得
      const columnsResult = await client.query(
        \`SELECT column_name, data_type, character_maximum_length, 
          is_nullable, column_default, udt_name
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = '\${table}'\`
      );
      
      schema[table] = columnsResult.rows;
      
      // テーブルのデータを取得
      const dataResult = await client.query(\`SELECT * FROM "\${table}"\`);
      data[table] = dataResult.rows;
      
      console.log(\`テーブル \${table}: \${dataResult.rows.length}行のデータを取得しました\`);
    }
    
    // スキーマ情報をファイルに保存
    fs.writeFileSync('${SCHEMA_FILE}', JSON.stringify(schema, null, 2));
    console.log(\`スキーマ情報を\${Object.keys(schema).length}個のテーブル分保存しました\`);
    
    // データをファイルに保存
    fs.writeFileSync('${DATA_FILE}', JSON.stringify(data, null, 2));
    console.log(\`データを保存しました\`);
    
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
EOF

# 必要なパッケージをインストールして実行
log "必要なNode.jsパッケージをインストールしています..."
cd ${TEMP_DIR}
npm init -y > /dev/null
npm install pg > /dev/null
log "Supabaseからのデータエクスポートを実行しています..."
node export-data.js

# エクスポート結果の確認
if [ $? -eq 0 ] && [ -f ${SCHEMA_FILE} ] && [ -f ${DATA_FILE} ]; then
  log "Supabaseからのデータエクスポートが正常に完了しました"
  log "スキーマファイル: ${SCHEMA_FILE}, サイズ: $(du -h ${SCHEMA_FILE} | cut -f1)"
  log "データファイル: ${DATA_FILE}, サイズ: $(du -h ${DATA_FILE} | cut -f1)"
else
  log "エラー: Supabaseからのデータエクスポートに失敗しました"
  exit 1
fi

# JSONデータをSQLに変換
log "JSONデータをSQLに変換しています..."
SQL_FILE="${TEMP_DIR}/import_data_${TIMESTAMP}.sql"

cat > ${TEMP_DIR}/convert-to-sql.js << EOF
const fs = require('fs');

// JSONファイルを読み込む
const schema = JSON.parse(fs.readFileSync('${SCHEMA_FILE}', 'utf8'));
const data = JSON.parse(fs.readFileSync('${DATA_FILE}', 'utf8'));

// SQLファイルを作成
let sql = '-- 自動生成されたSQLスクリプト (${TIMESTAMP})\n\n';
sql += 'BEGIN;\n\n';

// pgvector拡張機能を有効化
sql += '-- pgvector拡張機能を有効化\n';
sql += 'CREATE EXTENSION IF NOT EXISTS vector;\n\n';

// 各テーブルのデータをSQLに変換
for (const tableName in data) {
  const tableData = data[tableName];
  const tableSchema = schema[tableName];
  
  if (tableData.length === 0) {
    sql += \`-- テーブル \${tableName} にはデータがありません\n\n\`;
    continue;
  }
  
  sql += \`-- テーブル \${tableName} のデータ (\${tableData.length}行)\n\`;
  
  // テーブルが存在しない場合は作成
  sql += \`CREATE TABLE IF NOT EXISTS "\${tableName}" (\n\`;
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
    
    let def = \`  "\${col.column_name}" \${dataType}\`;
    if (col.character_maximum_length) {
      def += \`(\${col.character_maximum_length})\`;
    }
    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }
    if (col.column_default) {
      def += \` DEFAULT \${col.column_default}\`;
    }
    return def;
  });
  sql += columnDefs.join(',\n');
  sql += '\n);\n\n';
  
  // 既存のデータを削除
  sql += \`TRUNCATE TABLE "\${tableName}" CASCADE;\n\n\`;
  
  // データのINSERT文を生成
  for (const row of tableData) {
    const columns = Object.keys(row);
    const values = columns.map(col => {
      const value = row[col];
      if (value === null) {
        return 'NULL';
      } else if (typeof value === 'string') {
        // 文字列内のシングルクォートをエスケープし、バイナリデータとして扱う
        return \`E'\${value.replace(/'/g, "''").replace(/\\\\/g, "\\\\\\\\").replace(/\\n/g, "\\\\n").replace(/\\r/g, "\\\\r").replace(/\\t/g, "\\\\t")}'\`;
      } else if (typeof value === 'object') {
        // オブジェクトや配列はJSON文字列に変換
        return \`'\${JSON.stringify(value).replace(/'/g, "''")}'::jsonb\`;
      } else {
        return value;
      }
    });
    
    sql += \`INSERT INTO "\${tableName}" (\${columns.map(c => \`"\${c}"\`).join(', ')}) VALUES (\${values.join(', ')});\n\`;
  }
  
  sql += '\n';
}

sql += 'COMMIT;\n';

// SQLファイルに書き込む
fs.writeFileSync('${SQL_FILE}', sql);
console.log(\`SQLファイルを生成しました: ${SQL_FILE}\`);
EOF

node convert-to-sql.js

# 変換結果の確認
if [ $? -eq 0 ] && [ -f ${SQL_FILE} ]; then
  log "SQLファイルの生成が正常に完了しました: ${SQL_FILE}"
  log "SQLファイルサイズ: $(du -h ${SQL_FILE} | cut -f1)"
else
  log "エラー: SQLファイルの生成に失敗しました"
  exit 1
fi

# 内部PostgreSQLへのインポート前の確認
log "警告: この操作により、データベース ${LOCAL_DB} の既存データが上書きされる可能性があります。"
read -p "続行しますか？ (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  log "移行操作をキャンセルしました。"
  exit 0
fi

# pgvector拡張機能が有効化されているか確認
log "内部PostgreSQLでpgvector拡張機能が有効化されているか確認しています..."
PGVECTOR_ENABLED=$(docker exec harca-postgres psql -U ${LOCAL_USER} -d ${LOCAL_DB} -t -c "SELECT count(*) FROM pg_extension WHERE extname = 'vector';")
PGVECTOR_ENABLED=$(echo ${PGVECTOR_ENABLED} | tr -d '[:space:]')

if [ "${PGVECTOR_ENABLED}" != "1" ]; then
  log "pgvector拡張機能を有効化しています..."
  docker exec harca-postgres psql -U ${LOCAL_USER} -d ${LOCAL_DB} -c "CREATE EXTENSION IF NOT EXISTS vector;"
fi

# 内部PostgreSQLへのインポート
log "内部PostgreSQLへのデータインポートを開始します..."
docker exec -i harca-postgres psql -U ${LOCAL_USER} -d ${LOCAL_DB} < ${SQL_FILE}

# インポート結果の確認
if [ $? -eq 0 ]; then
  log "内部PostgreSQLへのデータインポートが正常に完了しました。"
else
  log "エラー: 内部PostgreSQLへのデータインポートに失敗しました。"
  exit 1
fi

# データの整合性検証
log "データの整合性検証を開始します..."

# JSONデータのテーブル数とインポート後のテーブル数を比較
JSON_TABLES=$(node -e "console.log(Object.keys(require('${SCHEMA_FILE}')).length)")
LOCAL_TABLES=$(docker exec harca-postgres psql -U ${LOCAL_USER} -d ${LOCAL_DB} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
LOCAL_TABLES=$(echo ${LOCAL_TABLES} | tr -d '[:space:]')

log "Supabaseのテーブル数: ${JSON_TABLES}"
log "内部PostgreSQLのテーブル数: ${LOCAL_TABLES}"

# テーブル内のレコード数を比較
for table in $(node -e "console.log(Object.keys(require('${SCHEMA_FILE}')).join(' '))")
do
  SUPABASE_RECORDS=$(node -e "console.log(require('${DATA_FILE}')['${table}'].length)")
  LOCAL_RECORDS=$(docker exec harca-postgres psql -U ${LOCAL_USER} -d ${LOCAL_DB} -t -c "SELECT COUNT(*) FROM \"${table}\";")
  LOCAL_RECORDS=$(echo ${LOCAL_RECORDS} | tr -d '[:space:]')
  log "テーブル ${table}: Supabase=${SUPABASE_RECORDS}行, 内部PostgreSQL=${LOCAL_RECORDS}行"
done

log "データ移行プロセスが完了しました"

# 一時ファイルの削除（オプション）
if [ "$1" == "--cleanup" ]; then
  log "一時ファイルを削除しています..."
  rm -f ${SCHEMA_FILE} ${DATA_FILE} ${SQL_FILE}
  rm -f ${TEMP_DIR}/export-data.js ${TEMP_DIR}/convert-to-sql.js
  rm -f ${TEMP_DIR}/package.json ${TEMP_DIR}/package-lock.json
  rm -rf ${TEMP_DIR}/node_modules
  log "一時ファイルの削除が完了しました"
fi

log "移行ログは ${MIGRATION_LOG} に保存されました"
echo "データ移行が完了しました。詳細は ${MIGRATION_LOG} を参照してください。"
