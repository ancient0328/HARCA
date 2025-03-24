# HARCAセットアップガイド

## 1. プロジェクト概要

HARCAは「Holistic Architecture for Resource Connection and Assistance」の略称で、高度なコード分析とAIアシスタンス機能を提供する、Model Context Protocol (MCP)に完全対応したプラットフォームです。内部PostgreSQLを活用することで効率的かつ拡張性の高いシステムを実現しています。

主な特徴：
- 公式MCPパッケージ活用
- PostgreSQL統合によるベクトル検索
- 複数エディタ(Windsurf Cascade, VSCode, Cursor等)との連携
- Docker対応で環境非依存の実行環境
- プラグイン形式の機能拡張性
- Sequential Thinking統合による構造化思考プロセス

## 2. 技術スタック

- **言語**: JavaScript / Node.js (v18以上)
- **データベース**: PostgreSQL + pgvector
- **MCP実装**: @modelcontextprotocol/server-postgres
- **ベクトル生成**: OpenAI API (text-embedding-ada-002) またはローカルモデル
- **コンテナ化**: Docker & Docker Compose
- **通信手段**: STDIO (主要) / HTTP (オプション)
- **キャッシュ**: Redis (分散キャッシュ)

## 3. 前提条件

- Node.js 18.x 以上
- pnpm パッケージマネージャー（推奨）または npm
- Docker と Docker Compose
- Redis (オプション、分散キャッシュ用)

## 4. インストール手順

### 4.1 リポジトリのクローン

```bash
git clone https://github.com/your-username/HARCA.git
cd HARCA
```

### 4.2 依存関係のインストール

```bash
# pnpmを推奨
pnpm install

# または npmを使用する場合
npm install
```

主な依存関係：
- pg (PostgreSQL接続)
- dotenv (環境変数管理)
- express (HTTPサーバー)
- openai (OpenAI API - オプション)
- redis (Redis接続 - オプション)

### 4.3 プロジェクト構造の設定

以下の構造でプロジェクトを設定します：

```
HARCA/
├── core/                    # コアMCPサーバー
│   ├── server.js            # メインサーバー実装
│   └── proxy.js             # STDIO-HTTP変換プロキシ
├── plugins/                 # 機能拡張プラグイン
│   ├── vector-store/        # ベクトル検索実装
│   └── sequential-thinking/ # 構造化思考プロセス実装
├── integrations/            # エディタ連携
│   ├── windsurf/            # Windsurf連携
│   ├── cursor/              # Cursor連携
│   └── vscode/              # VSCode連携
├── scripts/                 # ユーティリティスクリプト
│   ├── setup-windsurf.js    # Windsurf設定スクリプト
│   ├── diagnose.js          # 診断スクリプト
│   ├── setup-postgres.js    # PostgreSQL初期設定
│   ├── create-log-entry.js  # プロジェクト記録作成
│   ├── update-master-document.js # マスタードキュメント更新
│   └── update-all-docs.js   # 一括ドキュメント更新
└── docker/                  # コンテナ化
    ├── Dockerfile           # HARCAサーバー用
    └── docker-compose.yml   # 環境構成
```

### 4.4 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、以下の環境変数を設定します：

```
# PostgreSQL接続情報
POSTGRES_CONNECTION_STRING=postgres://postgres:password@localhost:3730/postgres

# OpenAI API (オプション)
OPENAI_API_KEY=your-openai-api-key

# Redis設定 (オプション)
REDIS_URL=redis://localhost:3710
CACHE_TTL=3600
CACHE_PREFIX=harca:embedding:
ENABLE_MEMORY_CACHE=true
ENABLE_REDIS_CACHE=true
ENABLE_FILE_CACHE=true

# Sequential Thinking設定
USE_INTERNAL_SEQUENTIAL_THINKING_ENGINE=false
# SEQUENTIAL_THINKING_API_URL=http://harca-sequential-thinking:3800

# サーバー設定
VECTOR_STORE_API_PORT=3701
CACHE_DASHBOARD_PORT=3700
DEBUG=harca:*
```

## 5. Docker環境設定

### 5.1 Docker Compose構成

Docker Composeを使用して、マルチプラットフォームで動作する環境を提供します。

```yaml
# docker/docker-compose.yml
version: '3'

services:
  harca-server:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: harca-server
    restart: unless-stopped
    environment:
      - POSTGRES_CONNECTION_STRING=postgres://postgres:password@harca-postgres:3730/postgres
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=redis://harca-redis:3710
      # - SEQUENTIAL_THINKING_API_URL=http://harca-sequential-thinking:3800
      # - USE_INTERNAL_SEQUENTIAL_THINKING_ENGINE=false
    volumes:
      - ${HOME}/.codeium:/root/.codeium
      - ${HOME}/.harca:/root/.harca
    depends_on:
      - harca-postgres
      - harca-redis
      # - harca-sequential-thinking
    ports:
      - "3700-3707:3700-3707"
    networks:
      - harca-network

  harca-postgres:
    image: postgres:15-alpine
    container_name: harca-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_USER=postgres
      - POSTGRES_DB=postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "3730:3730"
    networks:
      - harca-network

  harca-redis:
    image: redis:alpine
    container_name: harca-redis
    restart: unless-stopped
    ports:
      - "3710:6379"
    volumes:
      - redis-data:/data
    networks:
      - harca-network

  # harca-sequential-thinking:
  #   build:
  #     context: ../mcp-sequentialthinking-tools
  #     dockerfile: Dockerfile
  #   container_name: harca-sequential-thinking
  #   restart: unless-stopped
  #   ports:
  #     - "3800:3800"
  #   networks:
  #     - harca-network
  #   volumes:
  #     - ./logs/sequential-thinking:/app/logs
  #   environment:
  #     - NODE_ENV=production
  #     - PORT=3800
  #     - DEBUG=sequentialthinking:*
  #   healthcheck:
  #     test: ["CMD", "curl", "-f", "http://localhost:3800/health"]
  #     interval: 30s
  #     timeout: 10s
  #     retries: 3

networks:
  harca-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
```

### 5.2 Dockerfile

```dockerfile
# docker/Dockerfile
FROM node:18-alpine

WORKDIR /app

# 依存関係を先にコピーしてインストール
COPY package*.json ./
RUN npm install

# ソースコードをコピー
COPY . .

# 実行権限付与
RUN chmod +x scripts/*.js

# コマンド
CMD ["node", "core/server.js"]
```

### 5.3 Sequential Thinking MCPサーバー用Dockerfile

```dockerfile
FROM node:22-alpine

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm install

# ソースコードのコピー
COPY . .

# ビルド
RUN npm run build

# ヘルスチェックのためのcurlをインストール
RUN apk --no-cache add curl

# ポートの公開
EXPOSE 3800

# 起動コマンド
CMD ["npm", "start"]
```

### 5.4 パッケージ設定

npm パッケージとして配布するための設定です。

```json
// package.json
{
  "name": "harca",
  "version": "0.1.0",
  "description": "Holistic Architecture for Resource Connection and Assistance",
  "main": "core/server.js",
  "scripts": {
    "start": "node core/server.js",
    "start:http": "node core/server.js --http",
    "setup:windsurf": "node scripts/setup-windsurf.js",
    "setup:postgres": "node scripts/setup-postgres.js",
    "docker:build": "docker-compose -f docker/docker-compose.yml build",
    "docker:start": "docker-compose -f docker/docker-compose.yml up -d",
    "docker:stop": "docker-compose -f docker/docker-compose.yml down"
  },
  "bin": {
    "harca-setup-windsurf": "./scripts/setup-windsurf.js",
    "harca-setup-postgres": "./scripts/setup-postgres.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk-postgres": "^latest",
    "pg": "^latest",
    "openai": "^latest",
    "dotenv": "^latest",
    "express": "^latest"
  },
  "devDependencies": {
    "nodemon": "^latest",
    "eslint": "^latest"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## 6. PostgreSQL環境設定

### 6.1 PostgreSQLの初期化

Docker環境では、起動時に自動的に以下のSQLスクリプトが実行されます：

```sql
-- init-scripts/01-init-vector.sql
-- pgvector拡張を有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- コードベクトルテーブル作成
CREATE TABLE IF NOT EXISTS code_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ベクトル検索関数の作成
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    code_vectors.id,
    code_vectors.content,
    code_vectors.metadata,
    1 - (code_vectors.embedding <=> query_embedding) AS similarity
  FROM code_vectors
  WHERE 1 - (code_vectors.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- インデックス作成（オプション - 大規模データセット用）
CREATE INDEX ON code_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

または、セットアップスクリプトを使用して自動的に設定することもできます：

```bash
# pnpmを推奨
pnpm run setup:postgres

# または npmを使用する場合
npm run setup:postgres
```

### 6.2 PostgreSQL直接接続の実装

HARCAは直接PostgreSQL接続を使用します。これにより、より柔軟なデータベース操作が可能になります：

```javascript
// core/database.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('実行されたクエリ', { text, duration, rows: res.rowCount });
  return res;
}

module.exports = {
  query,
  pool,
};
```

## 7. Sequential Thinking MCP統合

### 7.1 Sequential Thinking MCPサーバーの準備

Sequential Thinking MCPサーバーは、Docker環境で自動的に起動されます。手動で起動する場合は以下の手順で行います：

```bash
# Sequential Thinking MCPサーバーのソースコードをクローン
git clone https://github.com/your-username/mcp-sequentialthinking-tools.git
cd mcp-sequentialthinking-tools

# 依存関係のインストール
npm install

# ビルド
npm run build

# 起動
npm start
```

### 7.2 Sequential Thinking MCPプラグインの設定

HARCAサーバーとSequential Thinking MCPサーバーを連携させるには、以下の環境変数を設定します：

```
# 内部エンジンを使用する場合
USE_INTERNAL_SEQUENTIAL_THINKING_ENGINE=true

# 外部サーバーを使用する場合
USE_INTERNAL_SEQUENTIAL_THINKING_ENGINE=false
# SEQUENTIAL_THINKING_API_URL=http://harca-sequential-thinking:3800
```

Docker環境では、これらの設定は自動的に行われます。

## 8. HARCA実行オプション

HARCAはいくつかの実行モードをサポートしています：

### 8.1 直接実行（開発時）

```bash
# 基本実行（STDIOモード）
pnpm start

# 開発モード（自動再起動付き）
pnpx nodemon core/server.js

# HTTPモード（WebAPI用）
pnpm run start:http
```

### 8.2 Docker実行（推奨）

```bash
# 環境変数設定
export OPENAI_API_KEY=your-openai-api-key

# Docker起動
pnpm run docker:start
```

### 8.3 グローバルインストール

```bash
# グローバルインストール
pnpm install -g ./

# コマンド実行
harca-setup-windsurf
harca-setup-postgres
```

## 9. トラブルシューティング

### 9.1 一般的な問題と解決策

#### "request failed" エラーへの対処

MCPサーバーとの通信に失敗する "request failed" エラーの主な原因と解決策です。

**エラー原因と診断方法**

| エラーパターン | 考えられる原因 | 診断方法 |
|--------------|--------------|---------|
| 接続時の "request failed" | CSRFトークン不一致 | ログでトークン送信と検証部分を確認 |
| "request failed" + CORS エラー | CORSポリシー違反 | ブラウザのコンソールで詳細確認 |
| ポート接続エラー | Windsurfの動的ポート変更 | ポート検出ログを確認 |
| ツール実行の "request failed" | ツール実行時の例外 | サーバーログで詳細を確認 |

**解決手順**

1. **STDIO通信モードの使用**:
   - STDIOモードはCORS/CSRFの問題が発生しないため、最も安定しています
   - 設定例: `"command": "pnpm", "args": ["start"]` または `"command": "node", "args": ["path/to/harca/core/server.js"]`

2. **Windsurfポート検出の確認**:
   - `~/.codeium/windsurf/port.json` ファイルが存在するか確認
   - デバッグログで正しいポートが検出されているか確認

3. **CORS設定の確認**:
   - HARCAにWindsurfのオリジン (`http://localhost:<port>`) が許可リストに追加されているか確認
   - ブラウザのネットワークタブでCORSヘッダーを確認

4. **CSRFトークンの更新**:
   - Windsurfを再起動して新しいトークンを生成
   - HARCAを再起動してトークンを初期化

5. **一時ファイルのクリア**:
   - `~/.codeium/windsurf/mcp_config.json` を確認
   - `~/.harca` ディレクトリ内の一時ファイルをクリア

### 9.2 起動エラー

#### 依存関係エラー

```
Error: Cannot find module 'xxx'
```

**解決方法**:
1. `pnpm install` を実行して依存関係を再インストール
2. 特定のパッケージが見つからない場合は個別にインストール: `pnpm add xxx`
3. `package.json` の依存関係リストを確認

#### パッケージマネージャーの問題

```
Command not found: npm
```

または

```
Error: This project is configured to use pnpm
```

**解決方法**:
1. HARCAプロジェクトでは**pnpm**を使用します。npmやyarnは使用しないでください
2. pnpmがインストールされていない場合は、`npm install -g pnpm`でインストール
3. スクリプト実行には`pnpx`を使用します（`npx`ではなく）
4. `.npmrc`ファイルが存在し、正しく設定されているか確認

#### ポートの競合

```
Error: listen EADDRINUSE: address already in use :::3700
```

**解決方法**:
1. 使用中のポートを確認: `lsof -i :3700`
2. 競合するプロセスを終了: `kill -9 <PID>`
3. 別のポートを使用するよう環境変数を設定: `CACHE_DASHBOARD_PORT=3710`

### 9.3 PostgreSQL関連の問題

#### 接続エラー

```
Error: Failed to connect to PostgreSQL: connection error
```

**解決方法**:
1. `POSTGRES_CONNECTION_STRING` が正しいか確認
2. PostgreSQLサーバーが稼働中か確認
3. IPアドレス制限が設定されていないか確認
4. SSL接続問題の場合は、接続文字列に `?sslmode=no-verify` を追加

#### テーブル不存在エラー

```
Error: relation "code_vectors" does not exist
```

**解決方法**:
1. PostgreSQLで必要なテーブルを作成
2. `pnpm run setup:postgres` を実行してSQL文を生成
3. 生成されたSQL文をPostgreSQLで実行

#### pgvector拡張エラー

```
Error: extension "vector" is not available
```

**解決方法**:
1. PostgreSQLで `CREATE EXTENSION IF NOT EXISTS vector;` を実行
2. pgvector拡張がインストールされているか確認

### 9.4 Docker環境の問題

#### Dockerコンテナ起動エラー

```
Error: No such file or directory: docker-compose
```

**解決方法**:
1. Docker Composeがインストールされているか確認
2. Docker Desktopが起動しているか確認
3. `docker-compose`ではなく`docker compose`コマンドを使用（Docker Compose V2の場合）

#### 環境変数が反映されない

```
Error: Environment variable not set
```

**解決方法**:
1. `.env`ファイルが正しい場所にあるか確認
2. Dockerコンテナ内で環境変数が設定されているか確認: `docker exec -it harca-server env`
3. `docker-compose.yml`ファイルで環境変数が正しく参照されているか確認

### 9.5 Sequential Thinking MCP関連の問題

#### 接続エラー

```
Error: Failed to connect to Sequential Thinking MCP server
```

**解決方法**:
1. Sequential Thinking MCPサーバーが起動しているか確認
2. `SEQUENTIAL_THINKING_API_URL`が正しく設定されているか確認
3. ネットワーク接続を確認
4. 内部エンジンモードに切り替え: `USE_INTERNAL_SEQUENTIAL_THINKING_ENGINE=true`

#### 内部エンジンエラー

```
Error: Internal Sequential Thinking engine failed to initialize
```

**解決方法**:
1. 必要なモジュールがインストールされているか確認
2. ログで詳細なエラーメッセージを確認
3. 外部サーバーモードに切り替え: `USE_INTERNAL_SEQUENTIAL_THINKING_ENGINE=false`

## 10. よくある質問

**Q**: HARCAサーバーとWindsurfの連携方法は？
**A**: `pnpm run setup:windsurf`コマンドを実行すると、Windsurfの設定ファイルが自動的に更新されます。その後、Windsurfを再起動すると連携が有効になります。

**Q**: ローカルの埋め込みモデルを使用するには？
**A**: `models/embedding_model/`ディレクトリにTensorFlow.jsモデルを配置し、環境変数`USE_LOCAL_EMBEDDING_MODEL=true`を設定します。

**Q**: プロジェクト記録を作成するには？
**A**: `pnpm run create-log-entry`コマンドを実行して、新しいプロジェクト記録を作成できます。作成後、`pnpm run update-master-document`を実行して、マスタードキュメントを更新してください。

**Q**: Sequential Thinking MCPサーバーを個別に起動するには？
**A**: `/Users/ancient0328/Development/MCPserver/mcp_format_etc/mcp-sequentialthinking-tools-main`に移動し、`npm run build`と`npm start`コマンドを実行します。

## 11. サポートとリソース

問題が解決しない場合は、以下のリソースを参照してください：

- プロジェクトのIssueトラッカー: [GitHub Issues](https://github.com/your-username/HARCA/issues)
- ドキュメント: `/Users/ancient0328/Development/MCPserver/HARCA/documents/`
- コミュニティフォーラム: [HARCA Community](https://community.harca.dev)

## 12. ライセンス

HARCAは[MITライセンス](LICENSE)の下で公開されています。
