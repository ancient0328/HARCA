---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（コンテキスト）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（コンテキスト）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索でのコンテキストベースのフィルタリングについて詳細に説明します。コンテキストに基づいたフィルタリングは、ユーザーの現在の状況や会話の流れに関連する記憶を効率的に検索するために重要です。

## 2. コンテキストベースフィルタリングの基本概念

### 2.1 コンテキストの定義

HARCA記憶システムにおけるコンテキストとは、以下の要素を含む現在の状況や環境を指します：

1. **会話コンテキスト**: 現在進行中の会話の主題、目的、参加者
2. **タスクコンテキスト**: ユーザーが現在取り組んでいるタスクや目標
3. **環境コンテキスト**: ユーザーの現在の場所、時間帯、デバイス
4. **ユーザーコンテキスト**: ユーザーの設定、嗜好、過去の行動パターン
5. **アプリケーションコンテキスト**: 現在使用中のアプリケーションや機能

### 2.2 コンテキストデータの構造

HARCA記憶システムでは、コンテキストデータは以下のような構造で保存されます：

```javascript
// コンテキストデータの例
const contextData = {
  id: "ctx_12345",
  name: "プロジェクト計画会議",
  type: "conversation",
  created_at: "2025-03-24T10:30:00+09:00",
  updated_at: "2025-03-24T11:45:00+09:00",
  expires_at: "2025-03-24T23:59:59+09:00",
  metadata: {
    participants: ["user_1", "user_2", "user_3"],
    topic: "プロジェクトXの計画策定",
    location: "会議室A",
    related_projects: ["project_x", "project_y"],
    tags: ["計画", "予算", "スケジュール"]
  },
  entities: [
    { id: "ent_1", type: "project", name: "プロジェクトX" },
    { id: "ent_2", type: "document", name: "予算計画書" }
  ],
  references: [
    { id: "ref_1", type: "knowledge", knowledge_id: "k_12345" },
    { id: "ref_2", type: "episode", episode_id: "e_67890" }
  ]
};
```

### 2.3 コンテキストデータのデータベース表現

PostgreSQLでは、コンテキストデータは以下のようなテーブル構造で表現されます：

```sql
-- コンテキストテーブル
CREATE TABLE short_term.contexts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(1536)  -- コンテキストの埋め込みベクトル
);

-- コンテキストエンティティテーブル
CREATE TABLE short_term.context_entities (
  id UUID PRIMARY KEY,
  context_id UUID NOT NULL REFERENCES short_term.contexts(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- コンテキスト参照テーブル
CREATE TABLE short_term.context_references (
  id UUID PRIMARY KEY,
  context_id UUID NOT NULL REFERENCES short_term.contexts(id) ON DELETE CASCADE,
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 3. コンテキストIDによるフィルタリング

### 3.1 特定のコンテキストに関連する記憶アイテムの検索

```sql
-- 特定のコンテキストに関連する知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = 'knowledge'
WHERE 
  cr.context_id = '12345678-1234-1234-1234-123456789012'
ORDER BY 
  distance
LIMIT 10;
```

### 3.2 複数のコンテキストに関連する記憶アイテムの検索

```sql
-- 複数のコンテキストに関連する知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance,
  COUNT(DISTINCT cr.context_id) AS context_count
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = 'knowledge'
WHERE 
  cr.context_id IN (
    '12345678-1234-1234-1234-123456789012',
    '23456789-2345-2345-2345-234567890123',
    '34567890-3456-3456-3456-345678901234'
  )
GROUP BY 
  k.id, k.name, k.content, kv.embedding
ORDER BY 
  context_count DESC, distance
LIMIT 10;
```

## 4. コンテキストメタデータによるフィルタリング

### 4.1 コンテキストタイプによるフィルタリング

```sql
-- 特定のコンテキストタイプに関連する知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = 'knowledge'
JOIN 
  short_term.contexts c ON c.id = cr.context_id
WHERE 
  c.type = 'conversation'
ORDER BY 
  distance
LIMIT 10;
```

### 4.2 コンテキストタグによるフィルタリング

```sql
-- 特定のタグを持つコンテキストに関連する知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = 'knowledge'
JOIN 
  short_term.contexts c ON c.id = cr.context_id
WHERE 
  c.metadata @> '{"tags": ["計画"]}'::jsonb
ORDER BY 
  distance
LIMIT 10;
```

### 4.3 コンテキスト参加者によるフィルタリング

```sql
-- 特定の参加者を含むコンテキストに関連する知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = 'knowledge'
JOIN 
  short_term.contexts c ON c.id = cr.context_id
WHERE 
  c.metadata @> '{"participants": ["user_1"]}'::jsonb
ORDER BY 
  distance
LIMIT 10;
```

### 4.4 コンテキストエンティティによるフィルタリング

```sql
-- 特定のエンティティを含むコンテキストに関連する知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = 'knowledge'
JOIN 
  short_term.contexts c ON c.id = cr.context_id
JOIN 
  short_term.context_entities ce ON ce.context_id = c.id
WHERE 
  ce.entity_type = 'project' AND
  ce.entity_id = 'project_x'
ORDER BY 
  distance
LIMIT 10;
```

## 5. コンテキスト類似性によるフィルタリング

### 5.1 現在のコンテキストに類似したコンテキストの検索

```sql
-- 現在のコンテキストに類似したコンテキストの検索
SELECT 
  c.id,
  c.name,
  c.type,
  c.created_at,
  c.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  short_term.contexts c
WHERE 
  c.id != 'current_context_id'
ORDER BY 
  distance
LIMIT 10;
```

### 5.2 類似コンテキストに関連する記憶アイテムの検索

```sql
-- 現在のコンテキストに類似したコンテキストに関連する知識アイテムの検索
WITH similar_contexts AS (
  SELECT 
    c.id,
    c.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS context_distance
  FROM 
    short_term.contexts c
  WHERE 
    c.id != 'current_context_id'
  ORDER BY 
    context_distance
  LIMIT 5
)
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS knowledge_distance,
  sc.context_distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = 'knowledge'
JOIN 
  similar_contexts sc ON sc.id = cr.context_id
ORDER BY 
  (knowledge_distance * 0.7) + (sc.context_distance * 0.3)  -- コンテキスト類似性と知識類似性の重み付け
LIMIT 10;
```

## 6. コンテキスト時間的関連性によるフィルタリング

### 6.1 アクティブなコンテキストに関連する記憶アイテムの検索

```sql
-- 現在アクティブなコンテキストに関連する知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = 'knowledge'
JOIN 
  short_term.contexts c ON c.id = cr.context_id
WHERE 
  c.expires_at > CURRENT_TIMESTAMP OR
  c.expires_at IS NULL
ORDER BY 
  distance
LIMIT 10;
```

### 6.2 最近のコンテキストに関連する記憶アイテムの検索

```sql
-- 最近のコンテキストに関連する知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance,
  c.updated_at AS context_updated_at
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = 'knowledge'
JOIN 
  short_term.contexts c ON c.id = cr.context_id
WHERE 
  c.updated_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY 
  c.updated_at DESC, distance
LIMIT 10;
```

## 7. コンテキストベースフィルタリングの最適化

### 7.1 コンテキスト関連インデックスの作成

```sql
-- コンテキストメタデータのGINインデックス
CREATE INDEX idx_contexts_metadata ON short_term.contexts USING GIN (metadata);

-- コンテキスト参照のインデックス
CREATE INDEX idx_context_references_reference ON short_term.context_references (reference_type, reference_id);
CREATE INDEX idx_context_references_context ON short_term.context_references (context_id);

-- コンテキストエンティティのインデックス
CREATE INDEX idx_context_entities_entity ON short_term.context_entities (entity_type, entity_id);
CREATE INDEX idx_context_entities_context ON short_term.context_entities (context_id);
```

### 7.2 コンテキスト埋め込みベクトルのインデックス

```sql
-- コンテキスト埋め込みベクトルのIVFFlatインデックス
CREATE INDEX idx_contexts_embedding ON short_term.contexts USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
```

### 7.3 複合クエリの最適化

複雑なコンテキストベースのフィルタリングを含むクエリでは、クエリプランの最適化が重要です：

```sql
-- クエリプランの分析
EXPLAIN ANALYZE
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = 'knowledge'
JOIN 
  short_term.contexts c ON c.id = cr.context_id
WHERE 
  c.type = 'conversation' AND
  c.metadata @> '{"tags": ["計画"]}'::jsonb AND
  c.updated_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY 
  distance
LIMIT 10;
```

## 8. Node.jsでのコンテキストベースフィルタリング実装

### 8.1 現在のコンテキストに関連する記憶アイテムの検索

```javascript
// 現在のコンテキストに関連する知識アイテムの検索
async function searchKnowledgeByCurrentContext(queryEmbedding, contextId, limit = 10) {
  return db.any(
    'SELECT ' +
    '  k.id, ' +
    '  k.name, ' +
    '  k.content, ' +
    '  kv.embedding <=> $1 AS distance ' +
    'FROM ' +
    '  long_term.knowledge_items k ' +
    'JOIN ' +
    '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
    'JOIN ' +
    '  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = \'knowledge\' ' +
    'WHERE ' +
    '  cr.context_id = $2 ' +
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $3',
    [queryEmbedding, contextId, limit]
  );
}
```

### 8.2 コンテキストメタデータによるフィルタリング

```javascript
// コンテキストメタデータによるフィルタリングを適用した知識アイテムの検索
async function searchKnowledgeByContextMetadata(queryEmbedding, metadataFilter, limit = 10) {
  return db.any(
    'SELECT ' +
    '  k.id, ' +
    '  k.name, ' +
    '  k.content, ' +
    '  kv.embedding <=> $1 AS distance ' +
    'FROM ' +
    '  long_term.knowledge_items k ' +
    'JOIN ' +
    '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
    'JOIN ' +
    '  short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = \'knowledge\' ' +
    'JOIN ' +
    '  short_term.contexts c ON c.id = cr.context_id ' +
    'WHERE ' +
    '  c.metadata @> $2 ' +
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $3',
    [queryEmbedding, metadataFilter, limit]
  );
}
```

### 8.3 動的なコンテキストフィルタリング

```javascript
// 動的なコンテキストフィルタリング条件を構築するヘルパー関数
function buildContextFilterConditions(filters = {}) {
  const conditions = [];
  const params = [];
  
  // クエリパラメータのインデックス（最初のパラメータはqueryEmbeddingのため2から開始）
  let paramIndex = 2;
  
  // コンテキストIDによるフィルタリング
  if (filters.contextId) {
    conditions.push(`cr.context_id = $${paramIndex++}`);
    params.push(filters.contextId);
  }
  
  // コンテキストタイプによるフィルタリング
  if (filters.contextType) {
    conditions.push(`c.type = $${paramIndex++}`);
    params.push(filters.contextType);
  }
  
  // コンテキストメタデータによるフィルタリング
  if (filters.contextMetadata) {
    conditions.push(`c.metadata @> $${paramIndex++}`);
    params.push(filters.contextMetadata);
  }
  
  // コンテキスト時間的関連性によるフィルタリング
  if (filters.activeContextsOnly === true) {
    conditions.push(`(c.expires_at > CURRENT_TIMESTAMP OR c.expires_at IS NULL)`);
  }
  
  if (filters.recentContextsHours) {
    conditions.push(`c.updated_at >= CURRENT_TIMESTAMP - INTERVAL '${filters.recentContextsHours} hours'`);
  }
  
  // WHERE句の構築
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return {
    whereClause,
    params,
    paramIndex
  };
}

// 動的コンテキストフィルタリングを使用した知識アイテムの検索
async function searchKnowledgeWithContextFilters(queryEmbedding, filters = {}, limit = 10) {
  const { whereClause, params, paramIndex } = buildContextFilterConditions(filters);
  
  const query = `
    SELECT 
      k.id,
      k.name,
      k.content,
      kv.embedding <=> $1 AS distance
    FROM 
      long_term.knowledge_items k
    JOIN 
      long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
    JOIN 
      short_term.context_references cr ON cr.reference_id = k.id AND cr.reference_type = 'knowledge'
    JOIN 
      short_term.contexts c ON c.id = cr.context_id
    ${whereClause}
    ORDER BY 
      distance
    LIMIT $${paramIndex}
  `;
  
  // パラメータの配列を構築
  const allParams = [queryEmbedding, ...params, limit];
  
  return db.any(query, allParams);
}
```

## 9. HARCA記憶システムにおけるコンテキストベースフィルタリング戦略

### 9.1 会話コンテキストの活用

会話の流れに基づいて関連する記憶アイテムを検索します：

```javascript
// 会話コンテキストに基づく記憶検索
async function searchMemoryByConversationContext(queryEmbedding, conversationId, limit = 10) {
  // 会話コンテキストの取得
  const conversationContext = await getConversationContext(conversationId);
  
  // 会話コンテキストに基づくフィルタリング条件の構築
  const filters = {
    contextId: conversationContext.id,
    activeContextsOnly: true
  };
  
  // コンテキストフィルタリングを適用した知識アイテムの検索
  return searchKnowledgeWithContextFilters(queryEmbedding, filters, limit);
}
```

### 9.2 タスクコンテキストの活用

ユーザーの現在のタスクに関連する記憶アイテムを検索します：

```javascript
// タスクコンテキストに基づく記憶検索
async function searchMemoryByTaskContext(queryEmbedding, taskId, limit = 10) {
  // タスクコンテキストの取得
  const taskContext = await getTaskContext(taskId);
  
  // タスクに関連するエンティティの取得
  const taskEntities = await getTaskEntities(taskId);
  
  // タスクコンテキストに基づくフィルタリング条件の構築
  const filters = {
    contextId: taskContext.id,
    activeContextsOnly: true
  };
  
  // コンテキストフィルタリングを適用した知識アイテムの検索
  const taskContextResults = await searchKnowledgeWithContextFilters(queryEmbedding, filters, limit);
  
  // タスクエンティティに関連する知識アイテムの検索
  const entityResults = await Promise.all(
    taskEntities.map(entity => 
      searchKnowledgeByEntity(queryEmbedding, entity.type, entity.id, limit)
    )
  );
  
  // 結果の統合と重複排除
  return mergeAndDeduplicate([taskContextResults, ...entityResults], 'id', limit);
}
```

### 9.3 ユーザーコンテキストの活用

ユーザーの設定や嗜好に基づいて記憶アイテムを検索します：

```javascript
// ユーザーコンテキストに基づく記憶検索
async function searchMemoryByUserContext(queryEmbedding, userId, limit = 10) {
  // ユーザープロファイルの取得
  const userProfile = await getUserProfile(userId);
  
  // ユーザーの嗜好に基づくメタデータフィルタの構築
  const metadataFilter = {
    tags: userProfile.preferences.interests
  };
  
  // ユーザーコンテキストに基づくフィルタリング条件の構築
  const filters = {
    contextMetadata: metadataFilter,
    activeContextsOnly: true,
    recentContextsHours: 72  // 最近3日間のコンテキスト
  };
  
  // コンテキストフィルタリングを適用した知識アイテムの検索
  return searchKnowledgeWithContextFilters(queryEmbedding, filters, limit);
}
```

## 10. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索でのコンテキストベースのフィルタリングについて説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（最適化）](./memory-system-postgresql-vector-search-query-filtering-optimization.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索](./memory-system-postgresql-vector-search-query-hybrid.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - Node.js統合](./memory-system-postgresql-vector-search-nodejs.md)
