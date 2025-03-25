# HARCA プロジェクト概要

## 1. プロジェクト概要

### 1.1 背景

HARCA (Holistic Architecture for Resource Connection and Assistance) は、高度なコード分析とAIアシスタンス機能を提供する、Modern Context Protocol (MCP) に完全対応したプラットフォームです。PostgreSQLを活用することで、効率的かつ拡張性の高いシステムを実現しています。

### 1.2 目的

- 包括的なコード分析機能の提供
- 公式MCPパッケージを活用した安定したプロトコル対応
- PostgreSQLによるデータ永続化と高度なベクトル検索
- 複数エディタとの円滑な連携
- 個人開発者が短期間で構築・運用できる軽量設計

### 1.3 主要特徴

- **公式MCPパッケージ活用**: `@modelcontextprotocol/server-postgres`を核とした実装
- **PostgreSQL統合**: PostgreSQLベースの永続データストレージとpgvectorによるベクトル検索
- **エディタ連携**: Windsurf Cascade, Cursor, VSCode, Clineなどとの連携
- **Docker対応**: 環境非依存の実行環境
- **ベクトル検索**: コード類似性検索とコンテキスト理解
- **モジュール設計**: プラグイン形式の機能拡張性

## 2. 技術スタック

### 2.1 主要技術

- **言語**: JavaScript / Node.js (v18以上)
- **データベース**: PostgreSQL + pgvector
- **MCP実装**: @modelcontextprotocol/server-postgres
- **ベクトル生成**: OpenAI API (text-embedding-ada-002) / オプションでローカルモデル
- **コンテナ化**: Docker & Docker Compose
- **通信手段**: STDIO (主要) / HTTP (オプション)

### 2.2 依存パッケージ

- `@modelcontextprotocol/server-postgres`: MCP実装の中核
- `pg`: PostgreSQL接続用
- `openai`: ベクトル生成用（オプションで代替可能）
- `dotenv`: 環境変数管理
- `express`: HTTP APIサーバー（オプション）

### 2.3 開発ツール

- `typescript`: 型安全な開発（オプション）
- `eslint`: コード品質管理
- `jest`: テスト自動化
- `nodemon`: 開発時の自動再起動

## 3. 開発計画

### 3.1 フェーズ1: 基盤構築（1週間）

- PostgreSQL環境設定
- MCPサーバー基本実装
- STDIOモード対応
- Windsurf連携基本機能

### 3.2 フェーズ2: コア機能実装（1週間）

- ベクトル検索実装
- コード分析ツール実装
- 基本的なリソース定義

### 3.3 フェーズ3: 拡張と最適化（1週間）

- 複数エディタ対応
- Docker環境構築
- エラー処理強化
- パフォーマンス最適化

### 3.4 フェーズ4: 仕上げと展開（1週間）

- ドキュメント整備
- インストール・設定スクリプト
- トラブルシューティングガイド
- パッケージ化
