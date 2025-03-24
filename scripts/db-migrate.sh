#!/bin/bash
# Supabaseから内部PostgreSQLへのデータ移行スクリプト

# 設定
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
TEMP_DIR="./temp"
BACKUP_FILE="${BACKUP_DIR}/supabase_backup_${TIMESTAMP}.sql"
MIGRATION_LOG="${BACKUP_DIR}/migration_log_${TIMESTAMP}.log"

# ディレクトリの作成
mkdir -p ${BACKUP_DIR}
mkdir -p ${TEMP_DIR}

# Supabase接続情報
SUPABASE_HOST=${SUPABASE_HOST:-db.ctoeobczdztvhobydzan.supabase.co}
SUPABASE_PORT=${SUPABASE_PORT:-5432}
SUPABASE_USER=${SUPABASE_USER:-postgres}
SUPABASE_PASSWORD=${SUPABASE_PASSWORD:-CGR256ORmrUgfEXl}
SUPABASE_DB=${SUPABASE_DB:-postgres}

# 内部PostgreSQL接続情報
LOCAL_HOST=${LOCAL_HOST:-localhost}
LOCAL_PORT=${LOCAL_PORT:-3800}
LOCAL_USER=${LOCAL_USER:-harca}
LOCAL_PASSWORD=${LOCAL_PASSWORD:-harca_password}
LOCAL_DB=${LOCAL_DB:-harca_db}

# ログ関数
log() {
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1" | tee -a ${MIGRATION_LOG}
}

log "データ移行プロセスを開始します"
log "Supabaseからデータをエクスポートします"

# Supabaseからのデータエクスポート
log "Supabaseからのデータエクスポートを開始します..."
PGPASSWORD=${SUPABASE_PASSWORD} pg_dump -h ${SUPABASE_HOST} -p ${SUPABASE_PORT} -U ${SUPABASE_USER} -d ${SUPABASE_DB} -F p > ${BACKUP_FILE}

# エクスポート結果の確認
if [ $? -eq 0 ]; then
  log "Supabaseからのデータエクスポートが正常に完了しました: ${BACKUP_FILE}"
  log "ファイルサイズ: $(du -h ${BACKUP_FILE} | cut -f1)"
else
  log "エラー: Supabaseからのデータエクスポートに失敗しました。"
  exit 1
fi

# データの変換（必要に応じて）
log "データの変換処理を開始します..."
CONVERTED_FILE="${TEMP_DIR}/converted_data_${TIMESTAMP}.sql"

# ここでデータ変換処理を実装（テーブル名の変更、スキーマの調整など）
# 例: sed -e 's/old_table_name/new_table_name/g' ${BACKUP_FILE} > ${CONVERTED_FILE}
cp ${BACKUP_FILE} ${CONVERTED_FILE}

log "データの変換処理が完了しました"

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
PGPASSWORD=${LOCAL_PASSWORD} psql -h ${LOCAL_HOST} -p ${LOCAL_PORT} -U ${LOCAL_USER} -d ${LOCAL_DB} -f ${CONVERTED_FILE}

# インポート結果の確認
if [ $? -eq 0 ]; then
  log "内部PostgreSQLへのデータインポートが正常に完了しました。"
else
  log "エラー: 内部PostgreSQLへのデータインポートに失敗しました。"
  exit 1
fi

# データの整合性検証
log "データの整合性検証を開始します..."

# テーブル数の比較
SUPABASE_TABLES=$(PGPASSWORD=${SUPABASE_PASSWORD} psql -h ${SUPABASE_HOST} -p ${SUPABASE_PORT} -U ${SUPABASE_USER} -d ${SUPABASE_DB} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
LOCAL_TABLES=$(PGPASSWORD=${LOCAL_PASSWORD} psql -h ${LOCAL_HOST} -p ${LOCAL_PORT} -U ${LOCAL_USER} -d ${LOCAL_DB} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

log "Supabaseのテーブル数: ${SUPABASE_TABLES}"
log "内部PostgreSQLのテーブル数: ${LOCAL_TABLES}"

if [ "${SUPABASE_TABLES}" = "${LOCAL_TABLES}" ]; then
  log "テーブル数の検証: 成功"
else
  log "テーブル数の検証: 失敗（不一致）"
  log "警告: テーブル数が一致しません。手動での確認が必要です。"
fi

# 主要テーブルのレコード数比較
log "主要テーブルのレコード数を比較します..."

# embeddings テーブルの比較
SUPABASE_EMBEDDINGS=$(PGPASSWORD=${SUPABASE_PASSWORD} psql -h ${SUPABASE_HOST} -p ${SUPABASE_PORT} -U ${SUPABASE_USER} -d ${SUPABASE_DB} -t -c "SELECT COUNT(*) FROM embeddings;")
LOCAL_EMBEDDINGS=$(PGPASSWORD=${LOCAL_PASSWORD} psql -h ${LOCAL_HOST} -p ${LOCAL_PORT} -U ${LOCAL_USER} -d ${LOCAL_DB} -t -c "SELECT COUNT(*) FROM embeddings;")
log "embeddings テーブル: Supabase=${SUPABASE_EMBEDDINGS}, 内部PostgreSQL=${LOCAL_EMBEDDINGS}"

# cache_metadata テーブルの比較（存在する場合）
SUPABASE_CACHE=$(PGPASSWORD=${SUPABASE_PASSWORD} psql -h ${SUPABASE_HOST} -p ${SUPABASE_PORT} -U ${SUPABASE_USER} -d ${SUPABASE_DB} -t -c "SELECT COUNT(*) FROM cache_metadata;" 2>/dev/null || echo "0")
LOCAL_CACHE=$(PGPASSWORD=${LOCAL_PASSWORD} psql -h ${LOCAL_HOST} -p ${LOCAL_PORT} -U ${LOCAL_USER} -d ${LOCAL_DB} -t -c "SELECT COUNT(*) FROM cache_metadata;" 2>/dev/null || echo "0")
log "cache_metadata テーブル: Supabase=${SUPABASE_CACHE}, 内部PostgreSQL=${LOCAL_CACHE}"

log "データの整合性検証が完了しました"
log "データ移行プロセスが完了しました"

# 一時ファイルの削除（オプション）
if [ "$1" == "--cleanup" ]; then
  log "一時ファイルを削除しています..."
  rm -f ${CONVERTED_FILE}
  log "一時ファイルの削除が完了しました"
fi

log "移行ログは ${MIGRATION_LOG} に保存されました"
echo "データ移行が完了しました。詳細は ${MIGRATION_LOG} を参照してください。"
