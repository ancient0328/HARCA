---
title: "Sequential Thinking API仕様書"
date: "2025-03-23"
author: "HARCA開発チーム"
status: "approved"
document_number: "API-001"
related_documents: ["system-architecture-overview.md", "containerized-modular-monolith.md"]
---

# Sequential Thinking API仕様書

## 1. 概要

Sequential Thinking APIは、構造化された思考プロセスを提供するためのインターフェースです。このAPIを通じて、問題分解、原因分析、解決策生成、決定分析、検証などの思考フレームワークを利用できます。

## 2. 基本情報

- **ベースURL**: `http://harca-sequential-thinking:3800` (Docker環境内)
- **外部アクセスURL**: `http://localhost:3740` (ホストマシンからのアクセス)
- **プロトコル**: JSON-RPC 2.0
- **コンテンツタイプ**: `application/json`

## 3. 認証

現在、内部ネットワークでの使用を想定しているため、認証は実装されていません。将来的には、APIキーベースの認証を追加する予定です。

## 4. エンドポイント

### 4.1 MCP互換エンドポイント

#### 4.1.1 ツール一覧取得

- **メソッド**: `mcp.listTools`
- **リクエスト**:

```json
{
  "jsonrpc": "2.0",
  "method": "mcp.listTools",
  "id": 1
}
```

- **レスポンス**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "sequentialThinking",
        "description": "構造化された思考プロセスを通じて問題解決を行います",
        "parameters": {
          "properties": {
            "query": {
              "type": "string",
              "description": "解決したい問題や質問"
            },
            "context": {
              "type": "string",
              "description": "問題に関連するコンテキスト情報（オプション）"
            },
            "framework": {
              "type": "string",
              "enum": ["problem_decomposition", "root_cause_analysis", "solution_generation", "decision_analysis", "verification"],
              "description": "使用する思考フレームワーク（オプション）"
            }
          },
          "required": ["query"],
          "type": "object"
        }
      },
      {
        "name": "toolRecommendation",
        "description": "問題解決に適したツールを推奨します",
        "parameters": {
          "properties": {
            "query": {
              "type": "string",
              "description": "解決したい問題や質問"
            },
            "context": {
              "type": "string",
              "description": "問題に関連するコンテキスト情報（オプション）"
            },
            "availableTools": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "利用可能なツールのリスト（オプション）"
            }
          },
          "required": ["query"],
          "type": "object"
        }
      }
    ]
  }
}
```

#### 4.1.2 ツール実行

- **メソッド**: `mcp.runTool`
- **リクエスト**:

```json
{
  "jsonrpc": "2.0",
  "method": "mcp.runTool",
  "params": {
    "name": "sequentialThinking",
    "parameters": {
      "query": "Redisキャッシュのパフォーマンスを最適化するにはどうすればよいですか？",
      "context": "現在、キャッシュヒット率が70%程度で、レイテンシが高い状況です。",
      "framework": "problem_decomposition"
    }
  },
  "id": 2
}
```

- **レスポンス**:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "thinking_id": "st-2025032301",
    "framework": "problem_decomposition",
    "steps": [
      {
        "step": 1,
        "title": "問題の定義",
        "content": "Redisキャッシュのパフォーマンスが最適ではなく、キャッシュヒット率が70%程度で、レイテンシが高い状況です。"
      },
      {
        "step": 2,
        "title": "問題の分解",
        "content": "この問題は以下のサブ問題に分解できます：\n1. キャッシュヒット率が低い原因\n2. レイテンシが高い原因\n3. キャッシュ設定の最適化\n4. キャッシュ戦略の見直し"
      },
      // 省略...
    ],
    "conclusion": "Redisキャッシュのパフォーマンスを最適化するためには、キャッシュヒット率の向上とレイテンシの削減が必要です。キャッシュキーの設計見直し、TTLの最適化、メモリ設定の調整、接続プールの最適化、適切なデータ構造の選択などの対策が考えられます。",
    "next_steps": [
      "キャッシュアクセスパターンの分析",
      "メモリ使用状況のモニタリング",
      "キャッシュキー設計の見直し",
      "TTL設定の最適化実験"
    ]
  }
}
```

#### 4.1.3 ツール推奨

- **メソッド**: `mcp.runTool`
- **リクエスト**:

```json
{
  "jsonrpc": "2.0",
  "method": "mcp.runTool",
  "params": {
    "name": "toolRecommendation",
    "parameters": {
      "query": "ユーザーの行動履歴を分析して傾向を把握したい",
      "availableTools": ["dataAnalysis", "visualization", "prediction", "clustering"]
    }
  },
  "id": 3
}
```

- **レスポンス**:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "recommended_tools": [
      {
        "name": "dataAnalysis",
        "confidence": 0.95,
        "reason": "ユーザー行動履歴の基本的な分析に最適です。"
      },
      {
        "name": "clustering",
        "confidence": 0.85,
        "reason": "類似した行動パターンのユーザーグループを特定するのに役立ちます。"
      },
      {
        "name": "visualization",
        "confidence": 0.75,
        "reason": "分析結果を視覚化して傾向を把握しやすくします。"
      }
    ],
    "reasoning": "ユーザーの行動履歴を分析するタスクでは、まず基本的なデータ分析を行い、次に類似したパターンをクラスタリングして、最後に結果を視覚化するアプローチが効果的です。予測ツールは現時点では時期尚早と判断します。"
  }
}
```

### 4.2 拡張エンドポイント

#### 4.2.1 思考プロセス継続

- **メソッド**: `sequentialThinking.continue`
- **リクエスト**:

```json
{
  "jsonrpc": "2.0",
  "method": "sequentialThinking.continue",
  "params": {
    "thinking_id": "st-2025032301",
    "additional_input": "キャッシュサイズは1GBで、アクセス頻度の高いキーが多数あります。"
  },
  "id": 4
}
```

- **レスポンス**:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "thinking_id": "st-2025032301",
    "new_steps": [
      {
        "step": 5,
        "title": "追加情報の分析",
        "content": "キャッシュサイズが1GBで、アクセス頻度の高いキーが多数ある状況を考慮すると、メモリ管理とキー設計の最適化が特に重要になります。"
      },
      // 省略...
    ],
    "updated_conclusion": "Redisキャッシュのパフォーマンスを最適化するためには、1GBのメモリ制約の中でアクセス頻度の高いキーを優先的にキャッシュする戦略が必要です。LRU（Least Recently Used）ポリシーの調整、キーの有効期限の最適化、メモリフラグメンテーションの最小化が重要な対策となります。",
    "next_steps": [
      "maxmemory-policyをvolatile-lruに設定",
      "頻繁にアクセスされるキーのTTLを延長",
      "大きなオブジェクトの圧縮または分割を検討"
    ]
  }
}
```

#### 4.2.2 思考プロセス可視化

- **メソッド**: `sequentialThinking.visualize`
- **リクエスト**:

```json
{
  "jsonrpc": "2.0",
  "method": "sequentialThinking.visualize",
  "params": {
    "thinking_id": "st-2025032301",
    "format": "markdown"
  },
  "id": 5
}
```

- **レスポンス**:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "visualization": "# 思考プロセス: Redisキャッシュの最適化\n\n## 1. 問題の定義\nRedisキャッシュのパフォーマンスが最適ではなく、キャッシュヒット率が70%程度で、レイテンシが高い状況です。\n\n## 2. 問題の分解\nこの問題は以下のサブ問題に分解できます：\n1. キャッシュヒット率が低い原因\n2. レイテンシが高い原因\n3. キャッシュ設定の最適化\n4. キャッシュ戦略の見直し\n\n...",
    "metadata": {
      "thinking_id": "st-2025032301",
      "framework": "problem_decomposition",
      "steps_count": 5,
      "created_at": "2025-03-23T10:15:30Z",
      "updated_at": "2025-03-23T10:20:45Z"
    }
  }
}
```

## 5. エラーハンドリング

APIは、以下のようなエラーコードを返す場合があります：

| コード | メッセージ | 説明 |
|--------|------------|------|
| -32700 | Parse error | JSONのパースエラー |
| -32600 | Invalid Request | 不正なリクエスト |
| -32601 | Method not found | 存在しないメソッド |
| -32602 | Invalid params | 不正なパラメータ |
| -32603 | Internal error | 内部エラー |
| 40001 | Invalid thinking_id | 存在しない思考プロセスID |
| 40002 | Invalid framework | 存在しない思考フレームワーク |
| 40003 | Processing error | 思考プロセスの処理エラー |

エラーレスポンスの例：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": 40001,
    "message": "Invalid thinking_id: st-2025032399 not found"
  }
}
```

## 6. 使用例

### 6.1 問題分解の例

```javascript
// リクエスト
const request = {
  jsonrpc: "2.0",
  method: "mcp.runTool",
  params: {
    name: "sequentialThinking",
    parameters: {
      query: "新しいキャッシュ層の設計方法を教えてください",
      framework: "problem_decomposition"
    }
  },
  id: 1
};

// フェッチ例
fetch("http://localhost:3740", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(request)
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error("Error:", error));
```

### 6.2 ツール推奨の例

```javascript
// リクエスト
const request = {
  jsonrpc: "2.0",
  method: "mcp.runTool",
  params: {
    name: "toolRecommendation",
    parameters: {
      query: "大量のログデータから異常を検出したい",
      availableTools: ["logAnalysis", "anomalyDetection", "visualization", "alerting"]
    }
  },
  id: 2
};

// フェッチ例
fetch("http://localhost:3740", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(request)
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error("Error:", error));
```

## 7. 制限事項

- 現在のバージョンでは、同時に処理できる思考プロセスの数に制限があります（デフォルト: 10）
- 思考プロセスの結果は一時的に保存され、24時間後に自動的に削除されます
- リクエストのサイズは1MB以下に制限されています
- レスポンスタイムアウトは60秒に設定されています

## 8. 今後の拡張予定

- 認証機能の追加
- 思考プロセスの永続化
- より多様な思考フレームワークのサポート
- 多言語対応の強化
- パフォーマンスの最適化

## 更新履歴

| 日付 | 更新者 | 変更内容 |
|------|--------|----------|
| 2025-03-23 | HARCA開発チーム | 初版作成 |
