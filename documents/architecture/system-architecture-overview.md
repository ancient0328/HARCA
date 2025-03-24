---
title: "コンテナ化モジュラーモノリスシステムアーキテクチャ概要"
date: "2025-03-23"
author: "HARCA開発チーム"
status: "approved"
document_number: "ARCH-000"
related_documents: ["containerized-modular-monolith.md"]
---

# コンテナ化モジュラーモノリス アーキテクチャと設計仕様書

## 1. プロジェクト概要

### 1.1 背景

コンテナ化モジュラーモノリス (Containerized Modular Monolith) は、高度なコード分析と AI アシスタンス機能を提供する、Modern Context Protocol (MCP) に完全対応したプラットフォームです。内部PostgreSQLを活用することで、効率的かつ拡張性の高いシステムを実現しています。

### 1.2 目的

- 高度なコード分析と AI アシスタンス機能を提供する
- 公式MCPパッケージを活用した安定したプロトコル対応
- PostgreSQLによるデータ永続化と高度なベクトル検索
- 複数エディタとの円滑な連携
- 個人開発者が短期間で構築・運用できる軽量設計

### 1.3 主要特徴

- 包括的なコード分析機能の提供
- PostgreSQL統合: PostgreSQLベースの永続データストレージとpgvectorによるベクトル検索
- エディタ連携: Windsurf Cascade, Cursor, VSCode, Clineなどとの連携
- Docker対応: 環境非依存の実行環境
- ベクトル検索: コード類似性検索とコンテキスト理解
- モジュール設計: プラグイン形式の機能拡張性
- Sequential Thinking: 構造化思考プロセスの統合

## 2. 技術スタック

### 2.1 主要技術

- 言語: JavaScript / Node.js (v18以上)
- データベース: PostgreSQL + pgvector
- MCP実装: @modelcontextprotocol/server-postgres
- ベクトル生成: OpenAI API (text-embedding-ada-002) / オプションでローカルモデル
- コンテナ化: Docker & Docker Compose
- 通信手段: STDIO (主要) / HTTP (オプション)
- キャッシュ: Redis, メモリキャッシュ, ファイルキャッシュ

### 2.2 依存パッケージ

- `@modelcontextprotocol/server-postgres`: MCP実装の中核
- `pg`: PostgreSQL接続用
- `openai`: ベクトル生成用（オプションで代替可能）
- `dotenv`: 環境変数管理
- `express`: HTTP APIサーバー（オプション）
- `redis`: 分散キャッシュ

### 2.3 開発ツール

- `typescript`: 型安全な開発（オプション）
- `eslint`: コード品質管理
- `jest`: テスト自動化
- `nodemon`: 開発時の自動再起動

## 3. システムアーキテクチャ

### 3.1 コアコンポーネント

1. **MCPサーバー**: Modern Context Protocolの実装
2. **ベクトルストア**: コード検索と類似性分析
3. **キャッシュシステム**: 階層型キャッシュ
4. **モデル管理**: 複数埋め込みモデルの管理
5. **エディタ連携**: 各種エディタとの接続
6. **Sequential Thinking**: 構造化思考プロセス

### 3.2 データフロー

1. エディタからのリクエスト受信
2. MCPプロトコルによるリクエスト解析
3. 適切なツール/機能の呼び出し
4. 結果の生成と返送
5. 必要に応じたデータの永続化

## 4. ポート設定

コンテナ化モジュラーモノリスプロジェクト内の各サービスは、一貫性を保ち、ポートの衝突を避けるために、すべて3700番台のポートを使用します。

### 4.1 ポート割り当て

| サービス | ポート | 説明 |
|---------|------|------|
| キャッシュダッシュボード | 3700 | 埋め込みキャッシュのパフォーマンスを監視するためのWebインターフェース |
| ベクトルストアAPI | 3701 | ベクトル検索APIエンドポイント |
| 管理コンソール | 3702 | システム管理用Webインターフェース |
| デバッグサーバー | 3703 | デバッグ情報提供用サーバー |
| テストサーバー | 3704 | 自動テスト実行用サーバー |
| モニタリングサービス | 3705 | システム監視サービス |
| ドキュメント生成サービス | 3706 | APIドキュメント生成サービス |
| 開発サーバー | 3707 | ローカル開発環境用サーバー |
| PostgreSQL | 3710 | データベースサーバー |
| Redis | 3720 | キャッシュサーバー |
| Sequential Thinking | 3800 | 構造化思考プロセスサーバー |
| 予備 | 3708-3799 | 将来の拡張用 |

### 4.2 環境変数

各サービスのポート番号は、対応する環境変数を通じて設定できます：

```
CACHE_DASHBOARD_PORT=3700
VECTOR_STORE_API_PORT=3701
ADMIN_CONSOLE_PORT=3702
DEBUG_SERVER_PORT=3703
TEST_SERVER_PORT=3704
MONITORING_SERVICE_PORT=3705
DOC_SERVICE_PORT=3706
DEV_SERVER_PORT=3707
POSTGRES_PORT=3710
REDIS_PORT=3720
SEQUENTIAL_THINKING_PORT=3800
```

## 5. エディタ連携

### 5.1 Windsurf Cascade 連携

Windsurf Cascadeとの連携は、STDIOプロキシを通じて実現されます。主な機能：

- Windsurfのポート自動検出
- 設定ファイルの自動更新
- STDIOプロキシの設定

### 5.2 Cursor 連携

Cursor エディタとの連携機能：

- 設定ファイルの自動更新
- MCP設定の管理
- 環境変数の設定

### 5.3 VSCode 連携

VSCode エディタとの連携機能：

- 設定ファイルの自動更新
- 拡張機能との連携
- デバッグ設定の管理

### 5.4 Cline 連携

Cline CLIとの連携機能：

- 設定ファイルの自動更新
- コマンドライン引数の処理
- 環境変数の設定

## 6. Sequential Thinking 統合

### 6.1 アーキテクチャ

Sequential Thinking MCPはDockerコンテナ化されたプラグインハイブリッドアプローチで統合されています：

- Dockerコンテナとして実装
- プラグインインターフェースによる抽象化
- 内部エンジンと外部サービスの柔軟な切り替え

### 6.2 主要機能

- 思考フレームワークの初期化（問題分解、原因分析、解決策生成、決定分析、検証）
- 思考プロセスの可視化（思考データ記録、可視化データ生成、統計情報生成）
- MCPサーバーへの可視化エンドポイント登録
- 外部サーバー連携（内部エンジンと外部サーバーの切り替え）

### 6.3 設定

- 内部エンジンモード: `USE_INTERNAL_SEQUENTIAL_THINKING_ENGINE=true`
- 外部サーバーURL: `SEQUENTIAL_THINKING_API_URL=http://harca-sequential-thinking:3800`

## 7. 開発環境の標準

コンテナ化モジュラーモノリスプロジェクトでは、以下の開発環境標準に従ってください：

1. パッケージマネージャーとして **pnpm** を使用
2. スクリプト実行には **pnpx** を使用
3. `package.json` のスクリプトセクションでは、直接 `node` コマンドを使用するか、`pnpm` 経由で実行

### 7.1 正しい使用例

```bash
# パッケージのインストール
pnpm install

# 開発サーバーの起動
pnpm dev

# スクリプトの実行
pnpx your-script.js

# テストの実行
pnpm test

``` 
