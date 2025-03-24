#!/bin/bash

# HARCAサーバーをDocker環境で起動するスクリプト
# 使用方法: ./start-docker.sh [オプション]
# オプション:
#   --clean     コンテナとボリュームを削除してからビルド
#   --build     Dockerイメージを再ビルド
#   --help      このヘルプメッセージを表示

# カラー設定
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ロゴ表示
echo -e "${BLUE}"
echo "  _   _    _    ____   ____    _    "
echo " | | | |  / \  |  _ \ / ___|  / \   "
echo " | |_| | / _ \ | |_) | |     / _ \  "
echo " |  _  |/ ___ \|  _ <| |___ / ___ \ "
echo " |_| |_/_/   \_\_| \_\\\\____/_/   \_\\"
echo -e "${NC}"
echo "Docker環境起動スクリプト"
echo ""

# 環境変数の確認
if [ ! -f .env ]; then
  echo -e "${RED}エラー: .envファイルが見つかりません。${NC}"
  echo ".env.exampleをコピーして.envを作成し、必要な環境変数を設定してください。"
  exit 1
fi

# 引数の解析
CLEAN=false
BUILD=false

for arg in "$@"; do
  case $arg in
    --clean)
      CLEAN=true
      shift
      ;;
    --build)
      BUILD=true
      shift
      ;;
    --help)
      echo "使用方法: ./start-docker.sh [オプション]"
      echo "オプション:"
      echo "  --clean     コンテナとボリュームを削除してからビルド"
      echo "  --build     Dockerイメージを再ビルド"
      echo "  --help      このヘルプメッセージを表示"
      exit 0
      ;;
  esac
done

# クリーンアップ（--cleanオプション指定時）
if [ "$CLEAN" = true ]; then
  echo "コンテナとボリュームを削除しています..."
  docker-compose down -v
  echo "クリーンアップ完了"
fi

# ビルド（--buildオプション指定時）
if [ "$BUILD" = true ]; then
  echo "Dockerイメージをビルドしています..."
  docker-compose build
fi

# Dockerコンテナの起動
echo "HARCAサーバーを起動しています..."
docker-compose up -d

# 起動確認
echo ""
echo -e "${GREEN}HARCAサーバーが起動しました！${NC}"
echo "サーバーのステータスを確認するには: docker-compose ps"
echo "ログを表示するには: docker-compose logs -f"
echo ""
echo "サーバーURL: http://localhost:3700"
