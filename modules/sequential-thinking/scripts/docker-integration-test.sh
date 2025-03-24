#!/bin/bash
# Sequential Thinking Docker統合テストスクリプト

set -e

echo "🔍 Sequential Thinking Dockerコンテナ統合テストを開始します..."

# 現在のディレクトリを保存
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(dirname "$SCRIPT_DIR")"
cd "$MODULE_DIR"

# コンテナが既に実行中の場合は停止
echo "🧹 既存のコンテナをクリーンアップしています..."
docker stop harca-sequential-thinking 2>/dev/null || true
docker rm harca-sequential-thinking 2>/dev/null || true

# イメージのビルド
echo "🏗️ Dockerイメージをビルドしています..."
docker build -t harca/sequential-thinking:test .

# コンテナの起動
echo "🚀 テスト用コンテナを起動しています..."
docker run -d --name harca-sequential-thinking -p 3740:3740 -e DEBUG=true harca/sequential-thinking:test

# コンテナの起動を待機
echo "⏳ サーバーの起動を待機しています..."
sleep 5

# ヘルスチェック
echo "🩺 ヘルスチェックを実行しています..."
if curl -s http://localhost:3740 > /dev/null; then
  echo "✅ サーバーが応答しています"
else
  echo "❌ サーバーが応答していません"
  docker logs harca-sequential-thinking
  docker stop harca-sequential-thinking
  docker rm harca-sequential-thinking
  exit 1
fi

# テストクライアントの実行
echo "🧪 テストクライアントを実行しています..."
NODE_ENV=test SERVER_URL=http://localhost:3740 node dist/test-client.js

# テスト結果の確認
TEST_EXIT_CODE=$?
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ テストが成功しました"
else
  echo "❌ テストが失敗しました"
  docker logs harca-sequential-thinking
fi

# コンテナの停止と削除
echo "🧹 テスト用コンテナをクリーンアップしています..."
docker stop harca-sequential-thinking
docker rm harca-sequential-thinking

# 元のディレクトリに戻る
cd - > /dev/null

# テスト結果に基づいて終了
exit $TEST_EXIT_CODE
