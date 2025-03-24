#!/bin/bash
# Dockerコンテナ内でSupabaseから内部PostgreSQLへのデータ移行を実行するスクリプト

# 設定
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
TEMP_DIR="./temp"
MIGRATION_LOG="${BACKUP_DIR}/migration_log_${TIMESTAMP}.log"

# ディレクトリの作成
mkdir -p ${BACKUP_DIR}
mkdir -p ${TEMP_DIR}

# Supabase接続情報
SUPABASE_HOST="db.ctoeobczdztvhobydzan.supabase.co"
SUPABASE_PORT="5432"
SUPABASE_USER="postgres"
SUPABASE_PASSWORD="CGR256ORmrUgfEXl"
SUPABASE_DB="postgres"
SUPABASE_SSLMODE="disable"
# IPv4を強制するためのホスト指定
SUPABASE_HOST_IP=$(host -t A ${SUPABASE_HOST} | grep "has address" | head -n 1 | awk '{print $NF}')
if [ -z "$SUPABASE_HOST_IP" ]; then
  SUPABASE_HOST_IP=${SUPABASE_HOST}  # IPアドレス解決に失敗した場合はホスト名を使用
fi
SUPABASE_CONNECTION_STRING="postgresql://${SUPABASE_USER}:${SUPABASE_PASSWORD}@${SUPABASE_HOST_IP}:${SUPABASE_PORT}/${SUPABASE_DB}?sslmode=${SUPABASE_SSLMODE}"

# 内部PostgreSQL接続情報
LOCAL_CONNECTION_STRING="postgres://harca:harca_password@postgres:3800/harca_db"
LOCAL_HOST="postgres"
LOCAL_PORT="3800"
LOCAL_USER="harca"
LOCAL_PASSWORD="harca_password"
LOCAL_DB="harca_db"

# ログ関数
log() {
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1" | tee -a ${MIGRATION_LOG}
}

# クリーンアップ関数
cleanup() {
  log "クリーンアップを実行しています..."
  # ネットワークからコンテナを切断
  docker network disconnect ${NETWORK_NAME} harca-postgres 2>/dev/null || true
  # ネットワークを削除
  docker network rm ${NETWORK_NAME} 2>/dev/null || true
  log "クリーンアップが完了しました"
}

# エラーハンドリング
handle_error() {
  log "エラーが発生しました: $1"
  cleanup
  exit 1
}

# スクリプト終了時のクリーンアップ
trap cleanup EXIT

log "データ移行プロセスを開始します"

# 既存のネットワークをクリーンアップ
cleanup

# 一時的なDockerネットワークを作成して、コンテナからSupabaseにアクセスできるようにする
NETWORK_NAME="supabase-migration-network"
docker network create ${NETWORK_NAME} || handle_error "ネットワーク作成に失敗しました"

# PostgreSQLコンテナをネットワークに接続
docker network connect ${NETWORK_NAME} harca-postgres || handle_error "PostgreSQLコンテナのネットワーク接続に失敗しました"

# Supabaseへの接続テスト
log "Supabaseへの接続テストを実行しています..."
docker run --rm --network=${NETWORK_NAME} postgres:15-alpine \
  pg_isready -h ${SUPABASE_HOST_IP} -p ${SUPABASE_PORT} -U ${SUPABASE_USER}

if [ $? -ne 0 ]; then
  log "警告: Supabaseへの接続テストに失敗しました。続行しますが、エクスポートが失敗する可能性があります。"
  log "接続情報: ホスト=${SUPABASE_HOST_IP}, ポート=${SUPABASE_PORT}, ユーザー=${SUPABASE_USER}"
fi

# Dockerコンテナ内でpg_dumpを実行してSupabaseからデータをエクスポート
log "Supabaseからのデータエクスポートを開始します..."
BACKUP_FILE="${BACKUP_DIR}/supabase_backup_${TIMESTAMP}.sql"

# 一時的なコンテナを使用してデータをエクスポート
docker run --rm --network=${NETWORK_NAME} \
  -v "$(pwd)/${BACKUP_DIR}:/backup" \
  postgres:15-alpine \
  pg_dump "${SUPABASE_CONNECTION_STRING}" \
  -f "/backup/$(basename ${BACKUP_FILE})" \
  -Fp \
  -v \
  --no-owner \
  --no-acl

# エクスポート結果の確認
if [ $? -eq 0 ]; then
  log "Supabaseからのデータエクスポートが正常に完了しました: ${BACKUP_FILE}"
  log "ファイルサイズ: $(du -h ${BACKUP_FILE} | cut -f1)"
else
  log "エラー: Supabaseからのデータエクスポートに失敗しました。"
  log "代替方法を試みます: psql経由での直接エクスポート..."
  
  # 代替方法: psqlを使用してテーブル一覧を取得し、各テーブルをCSVにエクスポート
  TABLES_FILE="${TEMP_DIR}/tables_list_${TIMESTAMP}.txt"
  
  docker run --rm --network=${NETWORK_NAME} \
    postgres:15-alpine \
    psql "${SUPABASE_CONNECTION_STRING}" \
    -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';" \
    -t > ${TABLES_FILE}
    
  if [ $? -eq 0 ] && [ -s ${TABLES_FILE} ]; then
    log "テーブル一覧の取得に成功しました。各テーブルをエクスポートします..."
    mkdir -p "${TEMP_DIR}/csv_export"
    
    while read -r table; do
      table=$(echo $table | tr -d ' ')
      if [ -n "$table" ]; then
        log "テーブル ${table} をエクスポートしています..."
        docker run --rm --network=${NETWORK_NAME} \
          postgres:15-alpine \
          psql "${SUPABASE_CONNECTION_STRING}" \
          -c "\COPY (SELECT * FROM ${table}) TO STDOUT WITH CSV HEADER" \
          > "${TEMP_DIR}/csv_export/${table}.csv"
          
        if [ $? -eq 0 ]; then
          log "テーブル ${table} のエクスポートに成功しました。"
        else
          log "警告: テーブル ${table} のエクスポートに失敗しました。"
        fi
      fi
    done < ${TABLES_FILE}
    
    log "CSVエクスポートが完了しました。内部PostgreSQLにインポートします..."
    CSV_EXPORT_SUCCESS=true
  else
    log "テーブル一覧の取得に失敗しました。"
    CSV_EXPORT_SUCCESS=false
  fi
  
  if [ "$CSV_EXPORT_SUCCESS" != "true" ]; then
    log "すべてのエクスポート方法が失敗しました。処理を中止します。"
    handle_error "データエクスポートに失敗しました"
  fi
fi

# データの変換（必要に応じて）
log "データの変換処理を開始します..."
CONVERTED_FILE="${TEMP_DIR}/converted_data_${TIMESTAMP}.sql"

if [ -f ${BACKUP_FILE} ]; then
  # SQLダンプファイルが存在する場合の処理
  cp ${BACKUP_FILE} ${CONVERTED_FILE}
  log "SQLダンプファイルの変換処理が完了しました"
else
  # CSVファイルからSQLを生成する処理
  log "CSVファイルからSQLを生成しています..."
  
  echo "-- 自動生成されたSQLスクリプト (${TIMESTAMP})" > ${CONVERTED_FILE}
  echo "BEGIN;" >> ${CONVERTED_FILE}
  
  for csv_file in ${TEMP_DIR}/csv_export/*.csv; do
    table_name=$(basename ${csv_file} .csv)
    log "テーブル ${table_name} のSQLを生成しています..."
    
    # テーブル構造の取得
    docker run --rm --network=${NETWORK_NAME} \
      postgres:15-alpine \
      psql "${SUPABASE_CONNECTION_STRING}" \
      -c "\d ${table_name}" \
      -t > "${TEMP_DIR}/table_structure_${table_name}.txt"
      
    # CSVからSQLのINSERT文を生成
    echo "-- ${table_name} テーブルのデータ" >> ${CONVERTED_FILE}
    echo "-- CSVファイルから生成されたINSERT文" >> ${CONVERTED_FILE}
    
    # ここでCSVからINSERT文を生成するロジックを実装
    # 簡易的な実装として、CSVファイルを内部PostgreSQLにCOPYコマンドでインポートする方法を採用
    echo "-- ${table_name} テーブルのデータはCOPYコマンドでインポートされます" >> ${CONVERTED_FILE}
  done
  
  echo "COMMIT;" >> ${CONVERTED_FILE}
  log "SQLの生成が完了しました"
fi

# 内部PostgreSQLへのインポート前の確認
log "警告: この操作により、データベース ${LOCAL_DB} の既存データが上書きされる可能性があります。"
read -p "続行しますか？ (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  log "移行操作をキャンセルしました。"
  exit 0
fi

# 内部PostgreSQLへのインポート
log "内部PostgreSQLへのデータインポートを開始します..."

if [ -f ${CONVERTED_FILE} ]; then
  # SQLファイルを使用したインポート
  docker exec -i harca-postgres psql -U ${LOCAL_USER} -d ${LOCAL_DB} < ${CONVERTED_FILE}
  IMPORT_RESULT=$?
else
  # CSVファイルを使用したインポート
  IMPORT_RESULT=0
  for csv_file in ${TEMP_DIR}/csv_export/*.csv; do
    table_name=$(basename ${csv_file} .csv)
    log "テーブル ${table_name} のデータをインポートしています..."
    
    # テーブルが存在するか確認し、存在しない場合は作成
    docker exec harca-postgres psql -U ${LOCAL_USER} -d ${LOCAL_DB} -c "
      CREATE TABLE IF NOT EXISTS ${table_name} (LIKE ${table_name} INCLUDING ALL);
    " 2>/dev/null
    
    # CSVデータをインポート
    cat ${csv_file} | docker exec -i harca-postgres psql -U ${LOCAL_USER} -d ${LOCAL_DB} -c "
      COPY ${table_name} FROM STDIN WITH CSV HEADER;
    "
    
    if [ $? -ne 0 ]; then
      log "警告: テーブル ${table_name} のインポートに失敗しました。"
      IMPORT_RESULT=1
    fi
  done
fi

# インポート結果の確認
if [ ${IMPORT_RESULT} -eq 0 ]; then
  log "内部PostgreSQLへのデータインポートが正常に完了しました。"
else
  log "エラー: 内部PostgreSQLへのデータインポートに失敗しました。"
  handle_error "データインポートに失敗しました"
fi

# データの整合性検証
log "データの整合性検証を開始します..."

# テーブル数の比較
SUPABASE_TABLES=$(docker run --rm --network=${NETWORK_NAME} postgres:15-alpine psql "${SUPABASE_CONNECTION_STRING}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
LOCAL_TABLES=$(docker exec harca-postgres psql -U ${LOCAL_USER} -d ${LOCAL_DB} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

log "Supabaseのテーブル数: ${SUPABASE_TABLES}"
log "内部PostgreSQLのテーブル数: ${LOCAL_TABLES}"

log "データ移行プロセスが完了しました"

# 一時ファイルの削除（オプション）
if [ "$1" == "--cleanup" ]; then
  log "一時ファイルを削除しています..."
  rm -f ${CONVERTED_FILE}
  rm -rf ${TEMP_DIR}/csv_export
  rm -f ${TEMP_DIR}/tables_list_*.txt
  rm -f ${TEMP_DIR}/table_structure_*.txt
  log "一時ファイルの削除が完了しました"
fi

log "移行ログは ${MIGRATION_LOG} に保存されました"
echo "データ移行が完了しました。詳細は ${MIGRATION_LOG} を参照してください。"
