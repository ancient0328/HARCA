# HARCA Sequential Thinking MCP Server

構造化された思考プロセスを通じて問題解決を支援するMCPサーバーモジュールです。複雑な問題を段階的に分析し、理解を深めながら思考を発展させることができます。

## 機能

- 複雑な問題を管理可能なステップに分解
- 理解が深まるにつれて思考を修正・改良
- 代替的な思考経路への分岐
- 思考の総数を動的に調整
- 解決策の仮説を生成・検証
- コンテキスト分析に基づくツール推奨機能

## ツール

### sequentialthinking

構造化された思考プロセスを通じて問題解決を支援するツールです。

**入力パラメータ:**
- `thought` (string): 現在の思考ステップ
- `nextThoughtNeeded` (boolean): さらに思考ステップが必要かどうか
- `thoughtNumber` (integer): 現在の思考番号
- `totalThoughts` (integer): 必要な思考の見積もり総数
- `isRevision` (boolean, オプション): これが以前の思考を修正するかどうか
- `revisesThought` (integer, オプション): どの思考が再考されているか
- `branchFromThought` (integer, オプション): 分岐点の思考番号
- `branchId` (string, オプション): 分岐識別子
- `needsMoreThoughts` (boolean, オプション): より多くの思考が必要かどうか
- `includeToolRecommendations` (boolean, オプション): ツール推奨を含めるかどうか

## ツール推奨機能

Sequential Thinkingモジュールには、ユーザーの思考プロセスに基づいて最適なツールを推奨する機能が含まれています。

### 主要コンポーネント

- **ToolMetadataManager**: ツールのメタデータを管理
- **ContextAnalyzer**: ユーザーの思考を分析し、関連するコンテキストを特定
- **ToolRecommender**: コンテキスト分析結果とツールメタデータを組み合わせて最適なツールを推奨

### テスト方法

ツール推奨機能のテストは以下のコマンドで実行できます：

```bash
# ビルド後に実行
pnpm build
pnpm run test:tool-recommender
```

## 使用シナリオ

Sequential Thinkingツールは以下のような場面で活用できます：
- 複雑な問題を段階的に分解する
- 修正の余地を残した計画や設計
- 軌道修正が必要な可能性のある分析
- 最初は全体像が明確でない問題
- 複数のステップによる解決が必要な問題
- 文脈を維持する必要があるタスク
- 無関係な情報をフィルタリングする状況

## 設定方法

### 開発環境での実行

```bash
# 依存関係のインストール
cd modules/sequential-thinking
pnpm install

# ビルド
pnpm build

# サーバー実行
pnpm run start:server

# クライアントテスト（別ターミナルで）
pnpm run test:client
```

### Docker環境での実行

HARCAプロジェクトの規約に従い、ポート3740を使用します。

```bash
# イメージのビルド
pnpm run docker:build

# コンテナの実行（デバッグモード有効）
pnpm run docker:run

# コンテナの停止と削除
pnpm run docker:stop
```

### Docker Composeでの実行

```bash
# コンテナの起動
pnpm run docker:compose:up

# コンテナの停止
pnpm run docker:compose:down
```

## CI/CD パイプライン

Sequential ThinkingモジュールはGitHub Actionsを使用したCI/CDパイプラインを実装しています。

### パイプラインの構成

- **ビルドとテスト**: プルリクエストとブランチプッシュ時に自動実行
- **Dockerイメージのビルドとプッシュ**: `main`と`develop`ブランチへのプッシュ時に実行
- **開発環境へのデプロイ**: `develop`ブランチへのマージ後に自動実行
- **本番環境へのデプロイ**: `main`ブランチへのマージ後に手動承認後に実行

### 統合テスト

Dockerコンテナの統合テストを実行するには：

```bash
# 統合テストの実行
pnpm run docker:test
```

### CI/CDパイプラインのカスタマイズ

CI/CDパイプラインの設定は `.github/workflows/ci-cd.yml` ファイルで管理されています。
環境変数やデプロイ設定は、プロジェクトの要件に合わせて調整できます。

### Kubernetes デプロイメント

開発環境と本番環境のKubernetesマニフェストは以下のディレクトリに配置されています：

- 開発環境: `k8s/dev/sequential-thinking.yaml`
- 本番環境: `k8s/prod/sequential-thinking.yaml`

### HARCAシステムとの統合

HARCAシステムのMCP設定ファイルに以下を追加します：

```json
{
  "mcpServers": {
    "sequentialthinking": {
      "command": "node",
      "args": [
        "/path/to/HARCA/modules/sequential-thinking/dist/start-server.js"
      ],
      "port": 3740
    }
  }
}
```

または、Docker環境の場合：

```json
{
  "mcpServers": {
    "sequentialthinking": {
      "url": "http://localhost:3740"
    }
  }
}
```

## デバッグモード

デバッグ情報を表示するには、環境変数 `DEBUG=true` を設定します：

```bash
DEBUG=true pnpm run start:server
```

または、Docker環境の場合：

```bash
docker run -p 3740:3740 -e DEBUG=true --name harca-sequential-thinking harca/sequential-thinking:latest
```

## ポート設定

HARCAプロジェクトの規約に従い、Sequential Thinkingサーバーはポート3740を使用します。
ポート番号を変更する場合は、環境変数 `PORT` を設定します：

```bash
PORT=3750 pnpm run start:server
```

## ライセンス

このMCPサーバーモジュールはMITライセンスの下で提供されています。
