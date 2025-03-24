#!/bin/bash
# HARCAデータベースバックアップスクリプト

# 設定
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="../backups"
BACKUP_FILE="${BACKUP_DIR}/harca_db_backup_${TIMESTAMP}.sql"

# バックアップディレクトリの作成
mkdir -p ${BACKUP_DIR}

# データベース接続情報
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5700}
DB_USER=${DB_USER:-harca}
DB_PASSWORD=${DB_PASSWORD:-harca_password}
DB_NAME=${DB_NAME:-harca_db}

# バックアップの実行
echo "HARCAデータベースのバックアップを開始します..."
PGPASSWORD=${DB_PASSWORD} pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F p > ${BACKUP_FILE}

# 結果の確認
if [ $? -eq 0 ]; then
  echo "バックアップが正常に完了しました: ${BACKUP_FILE}"
  echo "ファイルサイズ: $(du -h ${BACKUP_FILE} | cut -f1)"
else
  echo "バックアップに失敗しました。"
  exit 1
fi

# 圧縮（オプション）
if [ "$1" == "--compress" ]; then
  echo "バックアップファイルを圧縮しています..."
  gzip ${BACKUP_FILE}
  echo "圧縮完了: ${BACKUP_FILE}.gz"
fi

echo "バックアッププロセスが完了しました。"
