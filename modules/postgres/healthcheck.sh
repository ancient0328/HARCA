#!/bin/bash
set -e

# PostgreSQLが起動しているか確認
pg_isready -U "${POSTGRES_USER:-harca}" -h localhost -p 3730 || exit 1

# pgvector拡張機能が利用可能か確認
psql -U "${POSTGRES_USER:-harca}" -d "${POSTGRES_DB:-harca_db}" -p 3730 -c "SELECT 'pgvector extension is available' FROM pg_extension WHERE extname = 'vector'" | grep "pgvector extension is available" || exit 1

# 正常終了
exit 0
