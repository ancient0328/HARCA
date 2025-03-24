# 知識ベースモジュール

## 概要

知識ベースモジュールは、HARCAシステムの多階層記憶システムにおける構造化知識を管理するコンポーネントです。このモジュールは、知識の管理、知識の関連付け、知識の更新・検証などの機能を提供します。

## 機能

- **知識管理**: 知識の作成、更新、削除、検証
- **知識関連付け**: エンティティ間の関連性の定義と管理
- **知識検索**: 構造化クエリによる検索、関連性探索
- **知識推論**: 既存知識からの新しい知識の導出

## アーキテクチャ

知識ベースモジュールは以下のコンポーネントで構成されています：

```
/modules/knowledge-base/
├── src/
│   ├── knowledge-model.js     # 知識のデータモデル定義
│   ├── knowledge-manager.js   # 知識の作成・更新・削除機能
│   ├── knowledge-graph.js     # 知識グラフの管理機能
│   ├── knowledge-search.js    # 知識の検索機能
│   └── index.js               # モジュールのエントリーポイント
├── tests/                     # テストファイル
└── README.md                  # このファイル
```

## データモデル

知識エンティティの基本構造：

```javascript
{
  id: "know_456789",                      // 一意のID
  subject: "HARCAアーキテクチャ",          // 主語
  predicate: "is_a",                      // 述語
  object: "コンテナ化モジュラーモノリス",   // 目的語
  confidence: 0.98,                       // 確信度（0.0〜1.0）
  created_at: "2025-03-23T09:38:14+09:00", // 作成日時
  updated_at: "2025-03-23T09:38:14+09:00", // 更新日時
  source: "architecture_document",        // 情報源
  references: ["DOC-ARCH-001"],           // 参照ドキュメント
  metadata: {                             // メタデータ
    domain: "system_architecture",
    importance: "high"
  }
}
```

## 使用方法

```javascript
const KnowledgeBase = require('./modules/knowledge-base');

// 知識ベースのインスタンス作成
const knowledgeBase = new KnowledgeBase({
  storageConfig: {
    type: 'postgres',
    connection: process.env.POSTGRES_CONNECTION_STRING
  },
  cacheConfig: {
    type: 'redis',
    connection: process.env.REDIS_CONNECTION_STRING
  }
});

// 知識の作成
const knowledge = await knowledgeBase.createKnowledge({
  subject: 'HARCAアーキテクチャ',
  predicate: 'is_a',
  object: 'コンテナ化モジュラーモノリス',
  confidence: 0.98,
  source: 'architecture_document',
  references: ['DOC-ARCH-001'],
  metadata: {
    domain: 'system_architecture',
    importance: 'high'
  }
});

// 知識の検索
const knowledgeItems = await knowledgeBase.searchKnowledge({
  subject: 'HARCAアーキテクチャ',
  limit: 10
});

// 関連知識の探索
const relatedKnowledge = await knowledgeBase.findRelatedKnowledge({
  entityId: 'know_456789',
  maxDepth: 2,
  minConfidence: 0.7
});
```

## 依存関係

- PostgreSQL: 知識の永続化
- Redis: キャッシュ
- Node.js: 実行環境

## 開発状況

- [x] 基本設計
- [ ] データモデル実装
- [ ] 知識管理機能実装
- [ ] 知識グラフ機能実装
- [ ] 知識検索機能実装
- [ ] テスト作成
- [ ] ドキュメント作成

## 関連ドキュメント

- [Phase 3実装計画書](/documents/development-phases/phase3/phase3-implementation-plan.md)
- [コンテナ化モジュラーモノリスアーキテクチャ](/documents/architecture/containerized-modular-monolith.md)
