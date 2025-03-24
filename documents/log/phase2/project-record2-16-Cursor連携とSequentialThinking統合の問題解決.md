# Cursor連携とSequentialThinking統合の問題解決

## 概要
HARCAサーバーとCursorエディタの連携において、SequentialThinkingツールの統合問題を解決しました。Docker環境内でのサービス間通信の問題を修正し、MCPプロトコルに準拠した形式でSequentialThinkingサービスと通信できるようになりました。

## 問題点

### 1. SequentialThinkingツールの実行エラー
- エラーメッセージ: `Tool not found: sequentialThinking`
- CursorIntegrationからSequentialThinkingモジュールへの連携に不具合
- メソッド名の不一致: `processThinking`（存在しないメソッド）が呼び出されていた

### 2. Docker環境内でのサービス間通信問題
- HARCAサーバーがSequentialThinkingサービスに`localhost`経由でアクセスしようとしていた
- Docker内部では`localhost`ではなくサービス名を使用する必要がある
- 環境変数`SEQUENTIAL_THINKING_URL`が設定されていなかった

### 3. MCPプロトコルの不一致
- SequentialThinkingサービスは`mcp.runTool`メソッドを使用する必要がある
- HARCAサーバーが間違ったメソッド呼び出しを行っていた

## 解決策

### 1. メソッド名の修正
```javascript
// 修正前
const result = await defaultToolRecommender.processThinking(params);

// 修正後
const result = await defaultToolRecommender.processThought(params);
```

### 2. Docker環境内でのサービス間通信の修正
- docker-compose.ymlに環境変数を追加
```yaml
# HARCAサーバーの環境変数に追加
environment:
  # 既存の環境変数...
  # Sequential Thinkingサービス接続設定
  - SEQUENTIAL_THINKING_URL=http://sequential-thinking:3740
```

### 3. MCPプロトコル通信の修正
```javascript
// 修正前
body: JSON.stringify({
  jsonrpc: '2.0',
  id: '1',
  method: 'sequentialthinking',
  params
})

// 修正後
body: JSON.stringify({
  jsonrpc: '2.0',
  id: '1',
  method: 'mcp.runTool',
  params: {
    name: 'sequentialthinking',
    arguments: params
  }
})
```

## 技術的な考慮事項

### 1. Docker内部通信
- コンテナ間通信にはサービス名を使用する必要がある
- 環境変数を使用して設定を外部化することで柔軟性を確保
- ヘルスチェックにも正しいプロトコルとエンドポイントを使用する必要がある

### 2. MCPプロトコル準拠
- JSON-RPCフォーマットの正確な実装
- `mcp.listTools`と`mcp.runTool`メソッドの使用
- ツール名とパラメータの正しい構造化

### 3. エラーハンドリングとリトライ
- ネットワークエラー時の適切なリトライ処理
- 明確なエラーメッセージとログ記録
- サービス利用不可時のフォールバック処理

## 結果
- HARCAサーバーとSequentialThinkingサービス間の通信が正常に機能
- CursorエディタからSequentialThinkingツールが利用可能に
- すべてのMCPツールが正しく登録され実行可能に

## 今後の改善点
- HARCAサーバーのDockerfileに`curl`コマンドをインストール
- Sequential Thinkingサービスへのアクセス失敗時のフォールバック処理実装
- Sequential Thinkingサービスのログに表示される警告メッセージの解消
- 環境変数管理の一元化と`.env.example`ファイルの更新

## 実施日
2025年3月21日
