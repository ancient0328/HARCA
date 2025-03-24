#!/bin/bash
# HARCAデータベース復元スクリプト

# 設定
BACKUP_DIR="../backups"

# データベース接続情報
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5700}
DB_USER=${DB_USER:-harca}
DB_PASSWORD=${DB_PASSWORD:-harca_password}
DB_NAME=${DB_NAME:-harca_db}

# バックアップファイルの指定
if [ -z "$1" ]; then
  echo "使用方法: $0 <バックアップファイル>"
  echo "例: $0 ${BACKUP_DIR}/harca_db_backup_20250317_120000.sql"
  exit 1
fi

BACKUP_FILE=$1

# ファイルの存在確認
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "エラー: バックアップファイル ${BACKUP_FILE} が見つかりません。"
  exit 1
fi

# 圧縮ファイルの場合は解凍
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  echo "圧縮ファイルを解凍しています..."
  gunzip -c ${BACKUP_FILE} > ${BACKUP_FILE%.gz}
  BACKUP_FILE=${BACKUP_FILE%.gz}
  echo "解凍完了: ${BACKUP_FILE}"
fi

# 復元前の確認
echo "警告: この操作により、データベース ${DB_NAME} の既存データが上書きされます。"
read -p "続行しますか？ (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "復元操作をキャンセルしました。"
  exit 0
fi

# データベースの復元
echo "データベース ${DB_NAME} を復元しています..."
PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f ${BACKUP_FILE}

# 結果の確認
if [ $? -eq 0 ]; then
  echo "データベースの復元が正常に完了しました。"
else
  echo "データベースの復元に失敗しました。"
  exit 1
fi

echo "復元プロセスが完了しました。"
