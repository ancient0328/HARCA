# バックエンドDockerローカル運用とCascade連携
バックエンドをDockerでローカル運用しつつ、フロントエンドでMCPを通じてWindsurf Cascadeや他のAI agent, IDEと接続する方法を提案する。

## 全体アーキテクチャ

```
[Windsurf Cascade] <-- MCP/STDIO --> [MCP Proxy/Bridge] <-- HTTP --> [Docker Container: HARCA Backend]
    (エディタ)                     　　　　　    (ローカルプロセス)         　　　     (PostgreSQL, Redis, HARCAサーバー)
```

## 実装アプローチ

### 1. Dockerコンテナ群（バックエンド）

Docker Composeでバックエンド一式を構築する：

```yaml
# docker-compose.yml
version: '3.8'

services:
  harca-server:
    build: .
    container_name: harca-server
    ports:
      - "3700:3700"  # HARCAのHTTP APIを公開
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/harca
      - REDIS_URL=redis://redis:6379
      - PORT=3700
    depends_on:
      - postgres
      - redis
    networks:
      - harca-network

  postgres:
    image: ankane/pgvector:latest
    container_name: harca-postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=harca
    networks:
      - harca-network

  redis:
    image: redis:alpine
    container_name: harca-redis
    volumes:
      - redis-data:/data
    networks:
      - harca-network

volumes:
  postgres-data:
  redis-data:

networks:
  harca-network:
    driver: bridge
```

### 2. MCP Proxy/Bridge（フロントエンド）

ホストマシン上で動作するスクリプトで、STDIOとHTTPの橋渡しを行う：

```javascript
// mcp-bridge.js
import readline from 'readline';
import fetch from 'node-fetch';
import fs from 'fs';

// デバッグ設定
const DEBUG = process.env.DEBUG === 'true';
const LOG_FILE = './mcp-bridge.log';

// バックエンドAPIのURL
const HARCA_API_URL = process.env.HARCA_API_URL || 'http://localhost:3700/api/mcp';

// STDIOインターフェース設定
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// デバッグログ
function debugLog(message) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
    fs.appendFileSync(LOG_FILE, logMessage);
  }
}

// リクエスト処理
rl.on('line', async (line) => {
  try {
    debugLog(`Received: ${line}`);
    
    // 空行はスキップ
    if (!line.trim()) return;
    
    // JSONパース
    const request = JSON.parse(line);
    const { method, params, id } = request;
    
    // initializeメソッドの特別処理
    if (method === 'initialize') {
      debugLog('Processing initialize request');
      const initializeResponse = {
        jsonrpc: "2.0",
        id: id || null,
        result: {
          serverInfo: {
            name: "HARCA-MCP-Bridge",
            version: "1.0.0"
          },
          capabilities: {}
        }
      };
      console.log(JSON.stringify(initializeResponse));
      return;
    }
    
    // notifications/initializedメソッドは無視
    if (method === 'notifications/initialized') {
      debugLog('Ignoring notifications/initialized');
      return;
    }
    
    // HTTPリクエストの送信
    debugLog(`Forwarding request to ${HARCA_API_URL}`);
    const response = await fetch(HARCA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    // レスポンスの処理
    const responseData = await response.json();
    debugLog(`Received response: ${JSON.stringify(responseData)}`);
    
    // JSONRPC 2.0の形式に整形
    const jsonRpcResponse = {
      jsonrpc: "2.0",
      id: id || null,
      result: responseData
    };
    
    // レスポンスを返送
    console.log(JSON.stringify(jsonRpcResponse));
  } catch (error) {
    debugLog(`Error: ${error.message}`);
    debugLog(error.stack);
    
    // エラーレスポンス
    const errorResponse = {
      jsonrpc: "2.0",
      id: id || null,
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`
      }
    };
    
    console.log(JSON.stringify(errorResponse));
  }
});

// 起動メッセージ
debugLog('MCP Bridge started');
```

### 3. Windsurfの設定

Windsurf Cascadeの`mcp_config.json`に以下の設定を追加：

```json
{
  "mcpServers": {
    "harca-bridge": {
      "command": "node",
      "args": ["/path/to/mcp-bridge.js"],
      "env": {
        "HARCA_API_URL": "http://localhost:3700/api/mcp",
        "DEBUG": "true"
      },
      "protocol": "jsonrpc"
    }
  }
}
```

## 実装の詳細と注意点

### 1. HTTP API エンドポイントの追加

HARCAサーバー内に、MCPリクエストを処理するHTTP APIエンドポイントを追加：

```javascript
// core/server.js に追加
// HTTP APIの設定
app.post('/api/mcp', async (req, res) => {
  try {
    const { method, params } = req.body;
    
    // MCPメソッドに基づいて処理を振り分け
    if (method === 'tools/list' || method === 'getTools') {
      // ツール一覧を返す
      res.json({
        version: "1.0",
        tools: server.getTools()
      });
      return;
    }
    
    // ツール実行リクエスト（tool/execute または runTool）
    if (method === 'tool/execute' || method === 'runTool') {
      const { tool, arguments: args } = params;
      const result = await server.executeTool(tool, args);
      res.json(result);
      return;
    }
    
    // その他のメソッド
    res.json({ error: "Unsupported method" });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### 2. 起動スクリプト

以下の順序でシステムを起動：

```bash
#!/bin/bash
# start-harca-with-bridge.sh

# 1. DockerコンテナでHARCAバックエンドを起動
echo "Starting HARCA backend containers..."
docker-compose up -d

# 2. バックエンドの準備を待機
echo "Waiting for backend to be ready..."
sleep 5  # 簡易的な待機。実際はヘルスチェックが望ましい

# 3. MCPブリッジの起動
echo "Starting MCP bridge..."
node mcp-bridge.js
```

## このアプローチの利点

1. **責任の分離**
   - Dockerコンテナでデータ層とビジネスロジックを管理
   - STDIOプロキシは単純な仲介役として動作

2. **開発の柔軟性**
   - バックエンドの開発・再起動がCascadeに影響を与えない
   - 独立したテストと開発が可能

3. **配置の選択肢**
   - バックエンドコンテナは必要に応じてリモートサーバーに配置可能
   - STDIOプロキシはローカルマシンに必要

4. **デバッグの容易さ**
   - 詳細なログ記録により通信内容を確認可能
   - 各コンポーネントを個別にデバッグ可能

## 運用のベストプラクティス

1. **起動順序の管理**
   - バックエンドコンテナを先に起動し準備完了後にプロキシを起動
   - ヘルスチェックを実装して準備状態を確認

2. **エラーハンドリングの強化**
   - バックエンド一時的な停止や再起動時の対応
   - 接続の再試行ロジックの実装

3. **キャッシュの活用**
   - プロキシ層でのキャッシュ実装を検討
   - 一部の頻繁に使用されるリクエストの結果をキャッシュ



## 自社サーバーでのHARCA Docker運用における最適解分析

### なぜこれが最適解なのか

1. **アーキテクチャの優位性**
   - バックエンド（Docker）とフロントエンド（MCP Bridge）の明確な分離
   - 各コンポーネントが最適な形で動作（PostgreSQLはコンテナで、MCPブリッジはネイティブで）
   - Cascadeの要求（STDIO通信）と近代的なバックエンド運用（HTTP API）の両立

2. **実用的なコンポーネント構成**
   - デプロイの容易さ：自社サーバー上でDockerを運用する標準的な方法
   - スケーラビリティ：バックエンド部分を独立して水平/垂直スケーリング可能
   - セキュリティ：内部ネットワークでの閉じた通信

3. **運用上のメリット**
   - バックエンドの再起動/更新がフロントエンドに影響しない
   - コンポーネントごとの独立したログ管理と監視
   - 段階的な更新と移行が可能

### 自社サーバーでの具体的な実装

自社サーバー上で実装する場合は、以下の構成が考えられる：

```
[開発者PC]                         [自社サーバー]
Windsurf Cascade                   Docker環境
    |                                  |
    | (STDIO)                          |
    |                                  |
MCP Bridge --(HTTP)--> API Gateway --> HARCA Backend Container
                          |                |
                          +----> PostgreSQL Container
                          |                |
                          +----> Redis Container
```

### 自社サーバー向けの実装詳細

1. **API Gatewayの設定**：
   - 社内ネットワークからのみアクセス可能に制限
   - 適切な認証・認可の実装
   - レート制限とトラフィック管理

2. **MCP Bridgeの配布**：
   - 開発者用の標準パッケージとして配布
   - 自動更新の仕組み
   - 簡単なインストーラー

3. **モニタリングとログ管理**：
   - 集中ログ収集システムの構築
   - パフォーマンスメトリクスの収集
   - アラートシステムの実装

### 本番環境における配慮事項

1. **可用性の確保**：
   - コンテナの自動再起動設定
   - ロードバランシングの検討（複数インスタンス運用時）
   - データバックアップ戦略

2. **パフォーマンス最適化**：
   - PostgreSQLのチューニング
   - キャッシュ戦略の最適化
   - ネットワークレイテンシの最小化

3. **セキュリティ**：
   - 通信の暗号化
   - アクセス制御の厳格化
   - 定期的なセキュリティ監査

## 結論：実用的な最適解

このハイブリッドアプローチ（DockerバックエンドとMCPブリッジの組み合わせ）は、理論的な美しさと実用性のバランスが取れた解決策と考えられる。特に自社サーバー環境では、以下の理由からほぼ最適解か：

1. **実装の容易さ**：既存のDocker知識で実装・運用可能
2. **スケーラビリティ**：需要に応じた拡張が容易
3. **メンテナンス性**：コンポーネント単位の更新・管理
4. **開発者体験**：Cascadeとのシームレスな統合

このハイブリッドアプローチは、Dockerの利点（環境の一貫性、依存関係の分離）を活かしながら、CascadeとのSTDIO連携も実現できる実用的な方法ではないか。特に開発フェーズでは、バックエンドの変更をWindsurfに影響を与えず頻繁に行えるため、開発効率が大幅に向上すると期待できる。
一方で、プロキシ層を維持する必要があり、わずかな複雑性が増すことは考慮する必要があるが、その利点（分離、柔軟性、デバッグ容易性）はオーバーヘッドを十分に上回ると考えられる。
実際の実装では、MCP Bridgeの安定性と効率的な通信処理が鍵になると推測されるが、適切に実装すれば非常に堅牢なソリューションかもしれない。

