# Sequential Thinking 統合モジュール

このモジュールは、Sequential Thinkingサービスの機能をHARCAサーバーに統合します。ツール推奨機能、思考プロセス、APIエンドポイントなどを提供します。

## 機能

- **ツール推奨**: ユーザーの思考テキストに基づいて最適なツールを推奨
- **思考プロセス**: 構造化された思考プロセスを通じて問題解決を支援
- **APIエンドポイント**: RESTful APIを通じてSequential Thinking機能にアクセス
- **ヘルスチェック**: サービスの健全性を確認
- **MCPツール統合**: `sequentialThinking`ツールをMCPエンドポイントで利用可能

## インストールと設定

### 環境変数

以下の環境変数を設定してください：

```
# Sequential Thinkingサービスの設定
SEQUENTIAL_THINKING_URL=http://sequential-thinking:3740
SEQUENTIAL_THINKING_TIMEOUT=5000
SEQUENTIAL_THINKING_RETRIES=3

# デバッグモード（オプション）
DEBUG=true
```

### ポート設定

HARCAプロジェクトのポート割り当て規則に従い、Sequential Thinkingサービスはポート3740を使用します：

- HARCA Server: ポート3700（HTTP）
- Redis: ポート3710
- pgAdmin: ポート3720
- PostgreSQL: ポート3730
- Sequential Thinking: ポート3740

## 使用方法

### モジュールのインポート

```javascript
// CommonJS
const { defaultSequentialThinking, toolRecommender } = require('./integrations/sequential-thinking');

// ESM
import { defaultSequentialThinking, toolRecommender } from './integrations/sequential-thinking/index.js';
```

### MCPツール

このモジュールは以下のMCPツールを提供します：

- `sequentialThinking`: 構造化された思考プロセスを実行するツール
- `recommendTools`: 思考テキストに基づいて適切なツールを推奨するツール

これらのツールは自動的にMCPハンドラーに登録され、Windsurf CascadeやCursorなどのクライアントから利用できます。

### ツール推奨機能の使用

```javascript
// 思考テキストに基づいてツールを推奨
const thought = 'データベースからユーザー情報を取得して、CSVファイルにエクスポートする必要があります。';
const options = {
  maxResults: 3,
  minScore: 0.4,
  userExperienceLevel: 5,
  includeUsageHints: true
};

const recommendations = await defaultSequentialThinking.recommendTools(thought, options);
console.log('推奨ツール:', recommendations);
```

### 思考プロセスの使用

```javascript
// 思考プロセスを実行
const thoughtData = {
  thought: 'まず、データベース接続の設定を確認します。',
  thoughtNumber: 1,
  totalThoughts: 5,
  nextThoughtNeeded: true
};

const result = await defaultSequentialThinking.processThought(thoughtData);
console.log('処理結果:', result);
```

### APIエンドポイント

以下のAPIエンドポイントが利用可能です：

- `GET /api/sequential-thinking/health` - サービスの健全性を確認
- `POST /api/sequential-thinking/recommend-tools` - ツール推奨を取得
- `POST /api/sequential-thinking/process` - 思考プロセスを実行

#### ツール推奨APIの例

```bash
curl -X POST http://localhost:3700/api/sequential-thinking/recommend-tools \
  -H "Content-Type: application/json" \
  -d '{
    "thought": "ウェブサイトからデータをスクレイピングして、JSONファイルに保存したいです。",
    "options": {
      "maxResults": 3,
      "minScore": 0.3
    }
  }'
```

#### 思考プロセスAPIの例

```bash
curl -X POST http://localhost:3700/api/sequential-thinking/process \
  -H "Content-Type: application/json" \
  -d '{
    "thought": "まず、データベース接続の設定を確認します。",
    "thoughtNumber": 1,
    "totalThoughts": 5,
    "nextThoughtNeeded": true
  }'
```

## テスト

統合モジュールのテストを実行するには、以下のコマンドを使用します：

```bash
node integrations/sequential-thinking/test-integration.js
```

## MCP対応ツール

このモジュールは、HARCAサーバーに以下のMCP対応ツールを登録します：

- `sequentialThinking` - 構造化された思考プロセスを通じて問題解決を行います
- `recommendTools` - 思考プロセスに基づいて最適なツールを推奨します

## トラブルシューティング

### サービスに接続できない場合

1. Sequential Thinkingサービスが実行中であることを確認
2. ポート3740が利用可能であることを確認
3. ネットワーク設定を確認（特にDockerコンテナ間通信）
4. ログを確認して詳細なエラーメッセージを確認

### APIエンドポイントが機能しない場合

1. HARCAサーバーが正しく起動していることを確認
2. Sequential Thinking統合モジュールが正しく初期化されていることを確認
3. APIエンドポイントのURLが正しいことを確認
4. サーバーログでエラーメッセージを確認

## 開発者向け情報

### モジュール構造

- `index.js` - メインエントリーポイント、統合クラスとデフォルトインスタンスを提供
- `tool-recommender.js` - ツール推奨機能を実装
- `api.js` - RESTful APIエンドポイントを実装
- `test-integration.js` - 統合テストスクリプト

### カスタマイズ

カスタムオプションで統合モジュールを初期化する例：

```javascript
const { SequentialThinkingIntegration } = require('./integrations/sequential-thinking');
const { ToolRecommenderClient } = require('./integrations/sequential-thinking/tool-recommender');

// カスタムツール推奨クライアントの作成
const customToolRecommender = new ToolRecommenderClient({
  baseUrl: 'http://custom-sequential-thinking:8080',
  timeout: 10000,
  retries: 5,
  debug: true
});

// カスタム統合モジュールの作成
const customSequentialThinking = new SequentialThinkingIntegration({
  toolRecommender: customToolRecommender,
  debug: true
});

// カスタム統合モジュールの初期化
await customSequentialThinking.initialize(app, server);
