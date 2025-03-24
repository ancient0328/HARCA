# HARCA (Holistic Architecture for Resource Connection and Assistance)

HARCAは、Model Context Protocol (MCP)に完全対応した、コード分析とAIアシスタンス統合のためのプラットフォームです。コード理解、分析、AIアシスタンスを統合し、より柔軟で拡張性のあるアーキテクチャを提供します。

## 概要

HARCAは以下の機能を提供します：

- **MCPサーバー実装**: Windsurf Cascade, Cursor, Cline, RooCodeなどのクライアントと連携
- **コード分析機能**: 複雑度、コメント率、命名規則、重複コード検出などの分析
- **ベクトルストアAPI**: コードの埋め込みベクトル生成と類似検索
- **多層キャッシュシステム**: メモリ、ファイル、Redisを組み合わせた高速キャッシュ
- **PostgreSQL統合**: 効率的なデータ管理とベクトル検索
- **Docker対応**: 簡単なデプロイと環境の一貫性

## 目次

1. [技術スタック](#技術スタック)
2. [前提条件](#前提条件)
3. [セットアップ](#セットアップ)
   - [基本セットアップ](#基本セットアップ)
   - [環境設定](#環境設定)
   - [Dockerを使用したセットアップ](#dockerを使用したセットアップ)
4. [使用方法](#使用方法)
   - [統一起動スクリプト](#統一起動スクリプト)
   - [従来の起動方法](#従来の起動方法)
   - [Windsurf Cascadeとの連携](#windsurf-cascadeとの連携)
5. [MCPツール](#mcpツール)
6. [プロジェクト構造](#プロジェクト構造)
7. [環境変数](#環境変数)
8. [トラブルシューティング](#トラブルシューティング)
9. [開発ステータス](#開発ステータス)
10. [開発者向け情報](#開発者向け情報)
11. [ライセンス](#ライセンス)

## 技術スタック

- **バックエンド**: Node.js v22.0.0以上
- **データベース**: PostgreSQL + pgvector（内部または外部Supabase）
- **キャッシュ**: Redis
- **コンテナ化**: Docker, Docker Compose
- **パッケージ管理**: pnpm（推奨）または npm

## 前提条件

- **Node.js**: v22.0.0以上
- **パッケージマネージャー**: pnpm 10.0.0以上（推奨）または npm 9.0.0以上
- **データベース**: PostgreSQL（内部）または Supabase（外部）
- **API**: OpenAI APIキー（埋め込みベクトル生成用）
- **オプション**: Docker & Docker Compose（コンテナ化実行用）
- **オプション**: Redis（分散キャッシュ用、Dockerを使用する場合は自動的に提供）

## セットアップ

詳細なセットアップ手順については、[HARCA セットアップガイド](./documents/HARCA_setup_guide.md)を参照してください。

### 基本セットアップ

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/harca.git
cd harca

# 依存関係のインストール（pnpmを推奨）
pnpm install
# または npmを使用する場合
npm install
```

### 環境設定

1. `.env.example`ファイルを`.env`にコピーして編集します：

```bash
cp .env.example .env
```

2. `.env`ファイルに必要な情報を設定します：

```
# 必須設定
DB_HOST=localhost
DB_PORT=3730
DB_USER=harca
DB_PASSWORD=harca_password
DB_NAME=harca_db
DB_SSL=false
OPENAI_API_KEY=your-openai-api-key

# Redis分散キャッシュの設定（オプション）
REDIS_URL=redis://localhost:3710
REDIS_CACHE_ENABLED=true
REDIS_CACHE_TTL=86400
REDIS_CACHE_PREFIX=harca
ENABLE_MEMORY_CACHE=true
ENABLE_FILE_CACHE=true
CACHE_DIR=.cache/embeddings

# HARCAモード設定
HARCA_MODE=http  # http または stdio
PORT=3700        # サーバーポート
```

3. データベースの設定（初回のみ）：

```bash
pnpm run setup:database
```

### Dockerを使用したセットアップ

```bash
# Dockerコンテナのビルドと起動
docker-compose up -d
```

Docker環境では、以下のサービスが起動します：

- **HARCAサーバー**: `http://localhost:3700`
- **PostgreSQLサーバー**: `localhost:3730`（内部ポート3730にマッピング）
- **Redisサーバー**: `localhost:3710`

## 使用方法

### 統一起動スクリプト

HARCAサーバーは統一起動スクリプトを使用して、様々なモードやAIエージェントとの連携に最適化して起動できます：

```bash
# 基本的な起動（pnpmを推奨）
pnpm run start:harca

# または npmを使用する場合
npm run start:harca

# 特定のモードで起動
pnpm run start:http    # HTTPモード
pnpm run start:stdio   # stdioモード
pnpm run start:docker  # Dockerモード

# 特定のAIエージェントとの連携に最適化して起動
pnpm run start:windsurf  # Windsurf Cascade用
pnpm run start:cursor    # Cursor Compose用
pnpm run start:cline     # Cline用
pnpm run start:roocode   # RooCode用
pnpm run start:claude    # Claude Desktop用

# カスタムオプションを指定して起動
node scripts/start-harca.js --mode=http --agent=windsurf --port=3700 --debug
```

### 従来の起動方法

以下の従来の起動方法も引き続きサポートしています：

#### サーバーの起動

```bash
# 開発モード（pnpmを推奨）
pnpm run dev
# または npmを使用する場合
npm run dev

# 本番モード（pnpmを推奨）
pnpm run start
# または npmを使用する場合
npm run start
```

#### Docker起動

```bash
# Docker環境の起動（pnpmを推奨）
pnpm run start:docker

# または npmを使用する場合
npm run start:docker

# または個別のコマンド（pnpmを推奨）
pnpm run docker:build  # イメージをビルド
pnpm run docker:up     # コンテナを起動
pnpm run docker:logs   # ログを表示
pnpm run docker:down   # コンテナを停止
```

### Windsurf Cascadeとの連携

Windsurf Cascadeと連携するには：

1. Windsurfの設定を開く
2. MCPサーバー設定で「新規サーバー追加」を選択
3. 以下の情報を入力：
   - 名前: `harca`
   - コマンド: `node`
   - 引数: `/path/to/HARCA/harca-mcp/integrations/windsurf/internal-db-proxy.js`
   - 環境変数:
     - `HARCA_INTERNAL_API_URL`: `http://localhost:3700/api/windsurf`
     - `DEBUG`: `true`
   - プロトコル: `jsonrpc`

または、セットアップスクリプトを使用して自動的に設定することもできます：

```bash
pnpm run setup:windsurf
```

**注意**: 2025年3月18日より、HARCAは内部PostgreSQLデータベースを使用するようになりました。以前のSupabaseへの直接接続設定（`pnpx @modelcontextprotocol/server-postgres postgres://...`）は非推奨となり、上記の新しい連携方法を使用してください。

#### 内部PostgreSQL接続情報

内部PostgreSQLデータベースは以下の設定で動作しています：

- **接続文字列**: `postgres://harca:harca_password@postgres:3730/harca_db`
- **ホスト**: `localhost` (Dockerコンテナ内では `postgres`)
- **ポート**: `3730`
- **ユーザー**: `harca`
- **パスワード**: `harca_password`
- **データベース名**: `harca_db`

この設定により、HARCAの特有機能（カスタムベクトル検索、分散キャッシュなど）を利用しながら、Windsurfとの連携が可能になります。

## MCPツール

HARCAは以下のMCPツールを提供します：

### 1. searchSimilarCode

コードの類似検索を行います。

**パラメータ**:
- `query`: 検索クエリ（文字列）
- `limit`: 返す結果の数（数値、デフォルト: 5）

### 2. indexCode

コードをインデックス化します。

**パラメータ**:
- `code`: インデックス化するコード（文字列）
- `metadata`: 関連メタデータ（オブジェクト）

### 3. analyzeCode

コードの品質と構造を分析し、複雑度、コメント率、命名規則、重複などの問題を検出します。

**パラメータ**:
- `code`: 分析するコード（文字列）
- `language`: コードの言語（文字列、オプション）
- `advanced`: 高度な分析を行うかどうか（ブール値、オプション）

### 4. getCodeAnalysisRules

利用可能なコード分析ルールの一覧を取得します。

### 5. getAnalysisOptions

コード分析で利用可能なオプションの一覧を取得します。

### 6. checkHealth

HARCAサーバーの健全性を確認します。

## プロジェクト構造

```
HARCA/
├── docker-compose.yml            # 全コンテナ（PostgreSQLとharca-mcp）の構成
├── postgres/                     # PostgreSQL関連ファイル
│   ├── init/                     # 初期化スクリプト
│   ├── data/                     # PostgreSQLデータ永続化ディレクトリ
│   └── postgres.conf             # PostgreSQL設定ファイル
├── harca-mcp/                    # HARCAアプリケーション
│   ├── Dockerfile                # HARCAアプリケーションのDockerfile
│   ├── core/                     # コアサーバー実装
│   ├── plugins/                  # MCPプラグイン
│   ├── integrations/             # 外部サービス連携
│   └── config/                   # 設定ファイル
├── scripts/                      # セットアップと管理スクリプト
│   ├── db-backup.sh              # データベースバックアップスクリプト
│   ├── db-migrate.sh             # データ移行スクリプト
│   └── db-restore.sh             # バックアップ復元スクリプト
└── documents/                    # プロジェクトドキュメント
    ├── project-record/           # プロジェクト記録
    └── ...
```

## 環境変数

主要な環境変数：

- **データベース設定**:
  - `DB_HOST`: データベースホスト（デフォルト: localhost）
  - `DB_PORT`: データベースポート（デフォルト: 3730）
  - `DB_USER`: データベースユーザー名
  - `DB_PASSWORD`: データベースパスワード
  - `DB_NAME`: データベース名
  - `DB_SSL`: SSLを使用するかどうか（true/false）

- **外部API**:
  - `OPENAI_API_KEY`: OpenAI APIキー

- **サーバー設定**:
  - `PORT`: サーバーポート（デフォルト: 3700）
  - `HARCA_MODE`: 動作モード（http/stdio）

- **キャッシュ設定**:
  - `REDIS_URL`: Redis接続URL
  - `REDIS_CACHE_ENABLED`: Redisキャッシュを有効にするかどうか
  - `ENABLE_MEMORY_CACHE`: メモリキャッシュを有効にするかどうか
  - `ENABLE_FILE_CACHE`: ファイルキャッシュを有効にするかどうか

詳細な環境変数の説明は[セットアップガイド](./documents/HARCA_setup_guide.md)を参照してください。

## トラブルシューティング

一般的な問題と解決策：

### 接続エラー

**問題**: データベース接続エラーが表示される

**解決策**: 環境変数が正しく設定されているか確認してください。Docker環境内と外部で異なる設定が必要な場合があります。

### Docker関連の問題

**問題**: Dockerコンテナが起動しない

**解決策**: 以下のコマンドでログを確認してください。

```bash
docker-compose logs
```

### Docker関連の問題

#### コンテナのヘルスチェックエラー

**症状**: `docker ps`コマンドで`harca-server`コンテナが`unhealthy`状態と表示される

**解決策**:
1. サーバーが`/health`エンドポイントを正しく実装しているか確認
2. 以下のコマンドでヘルスチェックエンドポイントをテスト:
   ```bash
   curl -v http://localhost:3700/health
   ```
3. 正常なレスポンスは以下のようになります:
   ```json
   {"status":"ok","timestamp":"2025-03-18T04:52:34.871Z"}
   ```
4. 問題が解決しない場合は、サーバーを再起動:
   ```bash
   docker-compose restart harca
   ```

#### 不要なコンテナの削除

古いコンテナや不要なコンテナを削除するには:

```bash
# すべてのコンテナを表示
docker ps -a

# 特定のコンテナを削除
docker rm -f <コンテナID>

# 停止しているすべてのコンテナを削除
docker container prune
```

### 診断ツールの実行

問題が解決しない場合は、診断ツールを実行してください：

```bash
pnpm run diagnose
# または npmを使用する場合
npm run diagnose
```

詳細なトラブルシューティングについては、[トラブルシューティングガイド](./documents/troubleshooting_guide.md)を参照してください。

## 開発ステータス

現在、HARCAはPhase 2の開発段階にあります。主な優先事項は以下の通りです：

1. **PostgreSQLの内部化とデータベース移行**（最高優先度）✅ 完了
2. **統一された起動スクリプトとDocker Compose対応**（高優先度）✅ 完了
3. **コード分析機能移植**（高優先度）✅ 完了
4. **Sequential Thinking MCP統合**（高優先度）✅ 完了
5. **基本的な管理ダッシュボードUI**（中〜高優先度）
6. **追加エディタ対応**（中優先度）
7. **最適化と拡張**（中〜低優先度）

詳細な開発計画については、[HARCA開発計画マスタードキュメント](./documents/project-record/HARCA-開発計画マスタードキュメント.md)を参照してください。

## 開発者向け情報

### ポート設定ガイドライン

HARCAシステムのポート設定に関するガイドライン：

- **HARCAサーバー**: 3700番（HTTPモード）
- **Redis**: 3710番
- **pgAdmin**: 3720番
- **PostgreSQL**: 3730番
- **Sequential Thinking**: 3740番

### コーディング規約

開発に参加する際は、[開発標準](./documents/harca-development-standards.md)に従ってください。

## ライセンス

[MIT License](./LICENSE)
