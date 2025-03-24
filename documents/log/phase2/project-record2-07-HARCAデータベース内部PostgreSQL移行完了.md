# HARCAデータベースの内部PostgreSQL移行完了

**日付**: 2025年3月18日
**担当者**: HARCA開発チーム

## 概要

本記録では、HARCAシステムのデータベースを外部Supabaseから内部PostgreSQLへの移行が完了したことを報告します。この移行により、システムの自立性と信頼性が向上し、ローカル開発環境でのテストやインターネット接続が制限された環境での運用が容易になりました。

## 移行内容

### 1. データベース移行

以下の手順でデータベースの移行を実施しました：

1. **Supabaseからのデータエクスポート**
   - `code_vectors`テーブルのデータ（5行）をエクスポート
   - JSONフォーマットでデータを保存

2. **内部PostgreSQLへのデータインポート**
   - Docker Composeで構築した内部PostgreSQLサーバーにデータをインポート
   - `pgvector`拡張機能を有効化し、ベクトルデータを適切に処理

3. **接続情報の更新**
   - 内部PostgreSQL接続文字列: `postgres://harca:harca_password@postgres:3800/harca_db`
   - HARCAサーバーIPアドレス: `172.21.0.5`
   - HARCAサーバーポート: `3700`

### 2. Windsurf連携

Windsurfとの連携方法を以下のように更新しました：

1. **従来の設定**
   ```
   pnpx @modelcontextprotocol/server-postgres postgres://postgres:CGR256ORmrUgfEXl@db.ctoeobczdztvhobydzan.supabase.co:5432/postgres
   ```

2. **新しい設定**
   - STDIOプロキシを使用した接続方式に変更
   - `internal-db-proxy.js`スクリプトを作成し、HARCAサーバーとWindsurf間の通信を仲介
   - `mcp_config.json`に以下の設定を追加：
   ```json
   "harca": {
     "command": "node",
     "args": [
       "/Users/ancient0328/Development/MCPserver/HARCA/harca-mcp/integrations/windsurf/internal-db-proxy.js"
     ],
     "env": {
       "HARCA_INTERNAL_API_URL": "http://localhost:3700/api/windsurf",
       "DEBUG": "true"
     },
     "protocol": "jsonrpc"
   }
   ```
   - デフォルトサーバーを`harca`に設定

## 実装の詳細

### 1. プロキシスクリプト

`internal-db-proxy.js`スクリプトは、以下の機能を提供します：

- HARCAサーバーのAPI（`http://localhost:3700/api/windsurf`）への接続
- JSONRPCプロトコルを使用した通信
- リクエストの転送とレスポンスの処理
- デバッグログの記録（`/tmp/harca-internal-db-proxy-debug.log`）

### 2. 設定の最適化

- 不要な設定（`harca-internal`、`harca-local`、`harca-internal-proxy`）を整理
- シンプルに`harca`という名前に統一
- デバッグモードを有効化し、問題発生時の調査を容易に

## 移行の利点

1. **システムの自立性と信頼性の向上**
   - 外部サービスへの依存を排除
   - インターネット接続が制限された環境でも動作可能

2. **ローカル開発環境でのテスト容易化**
   - 開発環境と本番環境の一貫性確保
   - テスト環境の構築と管理が容易

3. **データの所有権とプライバシーの確保**
   - データを自社環境内で管理
   - セキュリティリスクの低減

4. **HARCAの特有機能の活用**
   - カスタムベクトル検索
   - 分散キャッシュ
   - その他のHARCA固有の機能

## 追加の改善

移行完了後、以下の追加改善を実施しました：

### 1. ヘルスチェックの実装

- **問題の特定**
  - Docker Composeのヘルスチェック設定では `/health` エンドポイントを使用していたが、実装されていなかった
  - `harca-server` コンテナが `unhealthy` 状態になっていた

- **修正内容**
  - `server.js` にヘルスチェックエンドポイントを追加
  ```javascript
  // ヘルスチェックエンドポイント
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  ```
  - サーバーコンテナを再ビルドして再起動

- **結果**
  - `harca-server` コンテナのステータスが `healthy` に変更
  - Docker環境の安定性が向上
  - 自動復旧機能が適切に動作するようになった

### 2. 不要コンテナの整理

- 再起動を繰り返していた `claude-mcp-server` コンテナを削除
- 現在の実行環境は以下のコンテナで構成
  - `harca-server`: HARCAサーバー（正常動作中）
  - `harca-pgadmin`: PostgreSQL管理ツール（正常動作中）
  - `harca-redis`: Redisキャッシュサーバー（正常動作中）
  - `harca-postgres`: PostgreSQLデータベース（正常動作中）

## 今後の課題と展望

1. **パフォーマンスの最適化**
   - 内部PostgreSQLの設定チューニング
   - クエリの最適化

2. **バックアップ戦略の強化**
   - 定期的なバックアップの自動化
   - 障害復旧プロセスの確立

3. **モニタリングの強化**
   - データベースパフォーマンスの監視
   - 異常検知と通知の仕組み

4. **スケーラビリティの検証**
   - 大規模データセットでのパフォーマンス検証
   - 水平スケーリングの可能性検討

## まとめ

HARCAシステムのデータベースをSupabaseから内部PostgreSQLへの移行が完了し、Windsurfとの連携も正常に機能しています。これにより、システムの自立性と信頼性が向上し、HARCAの特有機能を最大限に活用できるようになりました。今後も継続的な改善を行い、システムの安定運用を実現していきます。
