---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（メタデータ）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（メタデータ）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索でのメタデータによるフィルタリングについて詳細に説明します。カテゴリ、タグ、タイプなどの属性によるフィルタリング、数値範囲によるフィルタリング、複合フィルタリング条件の使用方法について記述します。

## 2. メタデータフィルタリングの基本

### 2.1 メタデータの種類と役割

HARCA記憶システムでは、以下のようなメタデータが各記憶アイテムに関連付けられています：

1. **カテゴリ属性**:
   - カテゴリ（technical, business, personal など）
   - タグ（複数のタグを持つことが可能）
   - タイプ（知識タイプ、エピソードタイプなど）

2. **数値属性**:
   - 重要度（importance）: 記憶の重要性を示す値（0.0〜1.0）
   - 信頼度（confidence）: 記憶の信頼性を示す値（0.0〜1.0）
   - 使用頻度（frequency）: 記憶が参照された頻度

3. **構造化メタデータ**:
   - JSON形式で保存される追加のメタデータ
   - 階層的なカテゴリ情報
   - 関連するエンティティの情報

### 2.2 メタデータテーブル設計

メタデータを効率的に検索するためのテーブル設計例：

```sql
-- 知識アイテムのメタデータテーブル
CREATE TABLE long_term.knowledge_metadata (
  knowledge_id UUID NOT NULL REFERENCES long_term.knowledge_items(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (knowledge_id, key)
);

-- タグ関連テーブル
CREATE TABLE long_term.knowledge_tags (
  knowledge_id UUID NOT NULL REFERENCES long_term.knowledge_items(id) ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  PRIMARY KEY (knowledge_id, tag)
);

-- インデックスの作成
CREATE INDEX idx_knowledge_metadata_key_value ON long_term.knowledge_metadata(key, value);
CREATE INDEX idx_knowledge_tags_tag ON long_term.knowledge_tags(tag);
```

## 3. カテゴリ、タグ、タイプによるフィルタリング

### 3.1 カテゴリによるフィルタリング

```sql
-- 特定のカテゴリに属する知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.category,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.category = 'technical'
ORDER BY 
  distance
LIMIT 10;
```

### 3.2 複数カテゴリによるフィルタリング

```sql
-- 複数のカテゴリに属する知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.category,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.category IN ('technical', 'scientific', 'educational')
ORDER BY 
  distance
LIMIT 10;
```

### 3.3 タグによるフィルタリング

```sql
-- 特定のタグを持つ知識アイテムのベクトル検索
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
  long_term.knowledge_tags kt ON k.id = kt.knowledge_id
WHERE 
  kt.tag = 'ai'
ORDER BY 
  distance
LIMIT 10;
```

### 3.4 複数タグによるフィルタリング

```sql
-- 複数のタグを持つ知識アイテムのベクトル検索（すべてのタグを持つ）
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.id IN (
    SELECT knowledge_id
    FROM long_term.knowledge_tags
    WHERE tag IN ('ai', 'machine-learning')
    GROUP BY knowledge_id
    HAVING COUNT(DISTINCT tag) = 2  -- タグの数と一致させる
  )
ORDER BY 
  distance
LIMIT 10;
```

### 3.5 タイプによるフィルタリング

```sql
-- 特定のタイプの知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.type,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.type = 'concept'
ORDER BY 
  distance
LIMIT 10;
```

## 4. 数値範囲によるフィルタリング

### 4.1 重要度によるフィルタリング

```sql
-- 重要度が特定の閾値以上の知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.importance,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.importance >= 0.7
ORDER BY 
  distance
LIMIT 10;
```

### 4.2 信頼度によるフィルタリング

```sql
-- 信頼度が特定の範囲内の知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.confidence,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.confidence BETWEEN 0.8 AND 1.0
ORDER BY 
  distance
LIMIT 10;
```

### 4.3 使用頻度によるフィルタリング

```sql
-- 使用頻度が高い知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.access_count,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.access_count > 10
ORDER BY 
  distance
LIMIT 10;
```

### 4.4 複数の数値条件の組み合わせ

```sql
-- 重要度と信頼度の両方でフィルタリングしたベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.importance,
  k.confidence,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.importance >= 0.7 AND
  k.confidence >= 0.8
ORDER BY 
  distance
LIMIT 10;
```

## 5. JSON形式のメタデータによるフィルタリング

### 5.1 JSONBデータ型の活用

PostgreSQLのJSONB型を使用して構造化メタデータを保存し、効率的に検索することができます：

```sql
-- JSONBメタデータを持つテーブル定義
ALTER TABLE long_term.knowledge_items ADD COLUMN metadata JSONB;

-- JSONBインデックスの作成
CREATE INDEX idx_knowledge_items_metadata ON long_term.knowledge_items USING GIN (metadata);
```

### 5.2 JSONパスによるフィルタリング

```sql
-- JSONBメタデータの特定のフィールドでフィルタリング
SELECT 
  k.id,
  k.name,
  k.content,
  k.metadata,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.metadata @> '{"source": "user_input"}'
ORDER BY 
  distance
LIMIT 10;
```

### 5.3 ネストされたJSONフィールドによるフィルタリング

```sql
-- ネストされたJSONフィールドでフィルタリング
SELECT 
  k.id,
  k.name,
  k.content,
  k.metadata,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.metadata @> '{"details": {"level": "advanced"}}'
ORDER BY 
  distance
LIMIT 10;
```

### 5.4 JSON配列によるフィルタリング

```sql
-- JSON配列内の要素でフィルタリング
SELECT 
  k.id,
  k.name,
  k.content,
  k.metadata,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.metadata @> '{"tags": ["important"]}'
ORDER BY 
  distance
LIMIT 10;
```

## 6. 複合フィルタリング条件

### 6.1 カテゴリと数値属性の組み合わせ

```sql
-- カテゴリと重要度の組み合わせによるフィルタリング
SELECT 
  k.id,
  k.name,
  k.content,
  k.category,
  k.importance,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.category = 'technical' AND
  k.importance >= 0.7
ORDER BY 
  distance
LIMIT 10;
```

### 6.2 タグとJSONメタデータの組み合わせ

```sql
-- タグとJSONメタデータの組み合わせによるフィルタリング
SELECT 
  k.id,
  k.name,
  k.content,
  k.metadata,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  long_term.knowledge_tags kt ON k.id = kt.knowledge_id
WHERE 
  kt.tag = 'ai' AND
  k.metadata @> '{"complexity": "high"}'
ORDER BY 
  distance
LIMIT 10;
```

### 6.3 複数テーブルにまたがる複合条件

```sql
-- 複数テーブルにまたがる複合条件によるフィルタリング
SELECT 
  k.id,
  k.name,
  k.content,
  k.category,
  k.importance,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
JOIN 
  long_term.knowledge_tags kt ON k.id = kt.knowledge_id
JOIN 
  long_term.knowledge_metadata km ON k.id = km.knowledge_id
WHERE 
  k.category = 'technical' AND
  k.importance >= 0.7 AND
  kt.tag = 'ai' AND
  km.key = 'source' AND km.value = 'research_paper'
ORDER BY 
  distance
LIMIT 10;
```

## 7. Node.jsでのメタデータフィルタリング実装

### 7.1 基本的なメタデータフィルタリング

```javascript
// カテゴリによるフィルタリングを適用したベクトル検索
async function searchKnowledgeByCategory(queryEmbedding, category, limit = 10) {
  return db.any(
    'SELECT ' +
    '  k.id, ' +
    '  k.name, ' +
    '  k.content, ' +
    '  k.category, ' +
    '  kv.embedding <=> $1 AS distance ' +
    'FROM ' +
    '  long_term.knowledge_items k ' +
    'JOIN ' +
    '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
    'WHERE ' +
    '  k.category = $2 ' +
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $3',
    [queryEmbedding, category, limit]
  );
}
```

### 7.2 タグによるフィルタリング

```javascript
// タグによるフィルタリングを適用したベクトル検索
async function searchKnowledgeByTag(queryEmbedding, tag, limit = 10) {
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
    '  long_term.knowledge_tags kt ON k.id = kt.knowledge_id ' +
    'WHERE ' +
    '  kt.tag = $2 ' +
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $3',
    [queryEmbedding, tag, limit]
  );
}
```

### 7.3 複数タグによるフィルタリング

```javascript
// 複数タグによるフィルタリングを適用したベクトル検索
async function searchKnowledgeByMultipleTags(queryEmbedding, tags, limit = 10) {
  // すべてのタグを持つアイテムを検索
  const tagsPlaceholders = tags.map((_, index) => `$${index + 3}`).join(', ');
  
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
    WHERE 
      k.id IN (
        SELECT knowledge_id
        FROM long_term.knowledge_tags
        WHERE tag IN (${tagsPlaceholders})
        GROUP BY knowledge_id
        HAVING COUNT(DISTINCT tag) = $2
      )
    ORDER BY 
      distance
    LIMIT $${tags.length + 3}
  `;
  
  return db.any(query, [queryEmbedding, tags.length, ...tags, limit]);
}
```

### 7.4 JSONメタデータによるフィルタリング

```javascript
// JSONメタデータによるフィルタリングを適用したベクトル検索
async function searchKnowledgeByJsonMetadata(queryEmbedding, metadataFilter, limit = 10) {
  return db.any(
    'SELECT ' +
    '  k.id, ' +
    '  k.name, ' +
    '  k.content, ' +
    '  k.metadata, ' +
    '  kv.embedding <=> $1 AS distance ' +
    'FROM ' +
    '  long_term.knowledge_items k ' +
    'JOIN ' +
    '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
    'WHERE ' +
    '  k.metadata @> $2 ' +
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $3',
    [queryEmbedding, JSON.stringify(metadataFilter), limit]
  );
}
```

### 7.5 動的なメタデータフィルタリング

```javascript
// 動的なメタデータフィルタリング条件を構築するヘルパー関数
function buildMetadataFilterConditions(filters = {}) {
  const conditions = [];
  const params = [];
  
  // クエリパラメータのインデックス（最初のパラメータはqueryEmbeddingのため2から開始）
  let paramIndex = 2;
  
  // カテゴリフィルター
  if (filters.category) {
    conditions.push(`k.category = $${paramIndex++}`);
    params.push(filters.category);
  }
  
  // タイプフィルター
  if (filters.type) {
    conditions.push(`k.type = $${paramIndex++}`);
    params.push(filters.type);
  }
  
  // 重要度フィルター
  if (filters.minImportance !== undefined) {
    conditions.push(`k.importance >= $${paramIndex++}`);
    params.push(filters.minImportance);
  }
  
  // 信頼度フィルター
  if (filters.minConfidence !== undefined) {
    conditions.push(`k.confidence >= $${paramIndex++}`);
    params.push(filters.minConfidence);
  }
  
  // JSONメタデータフィルター
  if (filters.metadata) {
    conditions.push(`k.metadata @> $${paramIndex++}`);
    params.push(JSON.stringify(filters.metadata));
  }
  
  // タグフィルター
  let tagJoin = '';
  if (filters.tags && filters.tags.length > 0) {
    if (filters.matchAllTags) {
      // すべてのタグにマッチするアイテムを検索
      const tagsPlaceholders = filters.tags.map((_, index) => `$${paramIndex + index}`).join(', ');
      conditions.push(`k.id IN (
        SELECT knowledge_id
        FROM long_term.knowledge_tags
        WHERE tag IN (${tagsPlaceholders})
        GROUP BY knowledge_id
        HAVING COUNT(DISTINCT tag) = $${paramIndex + filters.tags.length}
      )`);
      params.push(...filters.tags, filters.tags.length);
      paramIndex += filters.tags.length + 1;
    } else {
      // いずれかのタグにマッチするアイテムを検索
      tagJoin = 'JOIN long_term.knowledge_tags kt ON k.id = kt.knowledge_id';
      const tagsPlaceholders = filters.tags.map((_, index) => `$${paramIndex + index}`).join(', ');
      conditions.push(`kt.tag IN (${tagsPlaceholders})`);
      params.push(...filters.tags);
      paramIndex += filters.tags.length;
    }
  }
  
  // WHERE句の構築
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return {
    whereClause,
    tagJoin,
    params,
    paramIndex
  };
}

// 動的メタデータフィルタリングを使用したベクトル検索
async function searchKnowledgeWithMetadataFilters(queryEmbedding, filters = {}, limit = 10) {
  const { whereClause, tagJoin, params, paramIndex } = buildMetadataFilterConditions(filters);
  
  const query = `
    SELECT 
      k.id,
      k.name,
      k.content,
      k.category,
      k.type,
      k.importance,
      k.confidence,
      k.metadata,
      kv.embedding <=> $1 AS distance
    FROM 
      long_term.knowledge_items k
    JOIN 
      long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
    ${tagJoin}
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

## 8. HARCA記憶システムにおけるメタデータフィルタリング戦略

### 8.1 中期記憶（エピソード記憶）のメタデータフィルタリング

エピソード記憶では、エピソードタイプや参加者によるフィルタリングが重要です：

```sql
-- 特定のタイプと参加者を持つエピソードを検索
SELECT 
  e.id,
  e.title,
  e.description,
  e.type,
  e.importance,
  ev.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  mid_term.episodes e
JOIN 
  mid_term.episode_vectors ev ON e.id = ev.episode_id
JOIN 
  mid_term.episode_participants ep ON e.id = ep.episode_id
WHERE 
  e.type = 'conversation' AND
  ep.participant_id = 'user123'
ORDER BY 
  distance
LIMIT 10;
```

### 8.2 長期記憶（知識ベース）のメタデータフィルタリング

知識ベースでは、知識の種類や出典によるフィルタリングが一般的です：

```sql
-- 特定の知識タイプと出典を持つ知識を検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.type,
  k.source,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.type = 'concept' AND
  k.source = 'user_input' AND
  k.confidence >= 0.8
ORDER BY 
  distance
LIMIT 10;
```

### 8.3 長期記憶（ルールエンジン）のメタデータフィルタリング

ルールエンジンでは、ルールのスコープやコンテキストによるフィルタリングが重要です：

```sql
-- 特定のスコープとコンテキストを持つルールを検索
SELECT 
  r.id,
  r.name,
  r.description,
  r.scope,
  r.context,
  r.priority,
  rv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.rules r
JOIN 
  long_term.rule_vectors rv ON r.id = rv.rule_id
WHERE 
  r.scope = 'global' AND
  r.context @> '{"environment": "production"}' AND
  r.is_active = true
ORDER BY 
  distance, r.priority DESC
LIMIT 10;
```

## 9. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索でのメタデータによるフィルタリングについて説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（時間ベース）](./memory-system-postgresql-vector-search-query-filtering-time.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（コンテキスト）](./memory-system-postgresql-vector-search-query-filtering-context.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（最適化）](./memory-system-postgresql-vector-search-query-filtering-optimization.md)
4. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索](./memory-system-postgresql-vector-search-query-hybrid.md)
