# メモリコーパスモジュール

## 概要

メモリコーパスモジュールは、HARCAシステムの多階層記憶システムの中核コンポーネントです。このモジュールは、短期・長期記憶の管理、記憶の検索・取得、記憶の優先度付けなどの機能を提供します。

## 機能

- **記憶管理**: 記憶の作成、更新、削除、有効期限管理
- **記憶検索**: セマンティック検索、メタデータによるフィルタリング
- **記憶最適化**: 重複記憶の検出・統合、古い記憶の圧縮・要約
- **優先度管理**: 記憶の重要度に基づく優先度付け

## アーキテクチャ

メモリコーパスモジュールは以下のコンポーネントで構成されています：

```
/modules/memory-corpus/
├── src/
│   ├── memory-model.js      # 記憶のデータモデル定義
│   ├── memory-manager.js    # 記憶の作成・更新・削除機能
│   ├── memory-search.js     # 記憶の検索・取得機能
│   ├── memory-optimizer.js  # 記憶の最適化機能
│   └── index.js             # モジュールのエントリーポイント
├── tests/                   # テストファイル
└── README.md                # このファイル
```

## データモデル

メモリエンティティの基本構造：

```javascript
{
  id: "mem_123456",            // 一意のID
  content: "記憶の内容",        // 記憶の本文
  type: "observation",         // 記憶の種類（observation, fact, rule など）
  confidence: 0.85,            // 確信度（0.0〜1.0）
  created_at: "2025-03-23T09:38:14+09:00",  // 作成日時
  expires_at: "2025-04-23T09:38:14+09:00",  // 有効期限
  priority: "high",            // 優先度（high, medium, low）
  tags: ["tag1", "tag2"],      // タグ
  metadata: {                  // メタデータ
    source: "user_interaction",
    session_id: "sess_789012"
  }
}
```

## 使用方法

```javascript
const MemoryCorpus = require('./modules/memory-corpus');

// メモリコーパスのインスタンス作成
const memoryCorpus = new MemoryCorpus({
  storageConfig: {
    type: 'postgres',
    connection: process.env.POSTGRES_CONNECTION_STRING
  },
  cacheConfig: {
    type: 'redis',
    connection: process.env.REDIS_CONNECTION_STRING
  }
});

// 記憶の作成
const memory = await memoryCorpus.createMemory({
  content: 'ユーザーはAIエージェントの応答速度を重視している',
  type: 'observation',
  confidence: 0.85,
  priority: 'high',
  tags: ['user_preference', 'performance'],
  metadata: {
    source: 'user_interaction',
    session_id: 'sess_789012'
  }
});

// 記憶の検索
const memories = await memoryCorpus.searchMemories({
  query: '応答速度',
  filters: {
    type: 'observation',
    tags: ['user_preference']
  },
  limit: 10
});
```

## 依存関係

- PostgreSQL（pgvector拡張）: 記憶の永続化とベクトル検索
- Redis: キャッシュ
- Node.js: 実行環境

## 開発状況

- [x] 基本設計
- [ ] データモデル実装
- [ ] 記憶管理機能実装
- [ ] 記憶検索機能実装
- [ ] 記憶最適化機能実装
- [ ] テスト作成
- [ ] ドキュメント作成

## 関連ドキュメント

- [Phase 3実装計画書](/documents/development-phases/phase3/phase3-implementation-plan.md)
- [コンテナ化モジュラーモノリスアーキテクチャ](/documents/architecture/containerized-modular-monolith.md)
