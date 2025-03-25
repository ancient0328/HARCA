---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（時間ベース）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（時間ベース）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索での時間ベースのフィルタリングについて詳細に説明します。日付範囲によるフィルタリング、タイムスタンプによるフィルタリング、期間によるフィルタリングなど、時間に関連したフィルタリング手法について記述します。

## 2. 時間ベースフィルタリングの基本概念

### 2.1 時間データの重要性

HARCA記憶システムにおいて、時間情報は記憶の管理と検索において重要な役割を果たします：

1. **記憶の鮮度**: 最新の情報と古い情報を区別する
2. **時間的コンテキスト**: 特定の期間や時点に関連する記憶を検索する
3. **記憶の劣化モデル**: 時間経過に伴う記憶の重要性の変化をモデル化
4. **履歴追跡**: 記憶の変更履歴を追跡し、変化を分析する

### 2.2 時間データの種類

HARCA記憶システムでは、以下の時間関連データが各記憶アイテムに関連付けられています：

1. **作成日時（created_at）**: 記憶アイテムが最初に作成された日時
2. **更新日時（updated_at）**: 記憶アイテムが最後に更新された日時
3. **アクセス日時（accessed_at）**: 記憶アイテムが最後にアクセスされた日時
4. **有効期限（expires_at）**: 記憶アイテムが有効である期限（オプション）
5. **開始時刻と終了時刻（start_time, end_time）**: イベントやエピソードの期間
6. **タイムスタンプ配列**: 複数の時点での状態変化を記録（特定のユースケース）

### 2.3 PostgreSQLの日付・時刻データ型

PostgreSQLは以下の日付・時刻データ型をサポートしています：

| データ型 | 説明 | 使用例 |
|---------|------|-------|
| `DATE` | 日付のみ（時刻なし） | `'2025-03-24'` |
| `TIME` | 時刻のみ（日付なし） | `'14:30:00'` |
| `TIMESTAMP` | 日付と時刻 | `'2025-03-24 14:30:00'` |
| `TIMESTAMPTZ` | タイムゾーン付き日付と時刻 | `'2025-03-24 14:30:00+09:00'` |
| `INTERVAL` | 時間間隔 | `'2 days 3 hours'` |

HARCA記憶システムでは、タイムゾーンの問題を避けるため、基本的に`TIMESTAMPTZ`（タイムゾーン付きタイムスタンプ）を使用します。

## 3. 日付範囲によるフィルタリング

### 3.1 特定の日付範囲内の記憶アイテムの検索

```sql
-- 特定の日付範囲内に作成された知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.created_at,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.created_at >= '2025-01-01 00:00:00+09:00' AND
  k.created_at <= '2025-03-24 23:59:59+09:00'
ORDER BY 
  distance
LIMIT 10;
```

### 3.2 相対的な日付範囲によるフィルタリング

```sql
-- 過去30日以内に作成された知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.created_at,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY 
  distance
LIMIT 10;
```

### 3.3 日付関数を使用したフィルタリング

```sql
-- 特定の年月に作成された知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.created_at,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  EXTRACT(YEAR FROM k.created_at) = 2025 AND
  EXTRACT(MONTH FROM k.created_at) = 3
ORDER BY 
  distance
LIMIT 10;
```

### 3.4 BETWEEN演算子を使用した日付範囲フィルタリング

```sql
-- BETWEEN演算子を使用した日付範囲フィルタリング
SELECT 
  k.id,
  k.name,
  k.content,
  k.created_at,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.created_at BETWEEN '2025-01-01 00:00:00+09:00' AND '2025-03-24 23:59:59+09:00'
ORDER BY 
  distance
LIMIT 10;
```

## 4. タイムスタンプによるフィルタリング

### 4.1 最新の更新に基づくフィルタリング

```sql
-- 最近更新された知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.updated_at,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.updated_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY 
  distance
LIMIT 10;
```

### 4.2 最終アクセス日時に基づくフィルタリング

```sql
-- 長期間アクセスされていない知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.accessed_at,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.accessed_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
ORDER BY 
  distance
LIMIT 10;
```

### 4.3 作成日時と更新日時の比較によるフィルタリング

```sql
-- 作成後に更新されていない知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.created_at,
  k.updated_at,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.created_at = k.updated_at
ORDER BY 
  distance
LIMIT 10;
```

### 4.4 有効期限に基づくフィルタリング

```sql
-- 有効期限が切れていない知識アイテムのベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.expires_at,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.expires_at IS NULL OR
  k.expires_at > CURRENT_TIMESTAMP
ORDER BY 
  distance
LIMIT 10;
```

## 5. 期間によるフィルタリング

### 5.1 特定の期間内のエピソードの検索

```sql
-- 特定の期間内のエピソードのベクトル検索
SELECT 
  e.id,
  e.title,
  e.description,
  e.start_time,
  e.end_time,
  ev.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  mid_term.episodes e
JOIN 
  mid_term.episode_vectors ev ON e.id = ev.episode_id
WHERE 
  e.start_time >= '2025-03-01 00:00:00+09:00' AND
  e.end_time <= '2025-03-24 23:59:59+09:00'
ORDER BY 
  distance
LIMIT 10;
```

### 5.2 期間の重複によるフィルタリング

```sql
-- 特定の期間と重複するエピソードのベクトル検索
SELECT 
  e.id,
  e.title,
  e.description,
  e.start_time,
  e.end_time,
  ev.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  mid_term.episodes e
JOIN 
  mid_term.episode_vectors ev ON e.id = ev.episode_id
WHERE 
  e.start_time <= '2025-03-24 23:59:59+09:00' AND
  e.end_time >= '2025-03-20 00:00:00+09:00'
ORDER BY 
  distance
LIMIT 10;
```

### 5.3 期間の長さによるフィルタリング

```sql
-- 特定の長さの期間を持つエピソードのベクトル検索
SELECT 
  e.id,
  e.title,
  e.description,
  e.start_time,
  e.end_time,
  (e.end_time - e.start_time) AS duration,
  ev.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  mid_term.episodes e
JOIN 
  mid_term.episode_vectors ev ON e.id = ev.episode_id
WHERE 
  (e.end_time - e.start_time) >= INTERVAL '1 hour' AND
  (e.end_time - e.start_time) <= INTERVAL '3 hours'
ORDER BY 
  distance
LIMIT 10;
```

### 5.4 特定の時点を含む期間によるフィルタリング

```sql
-- 特定の時点を含むエピソードのベクトル検索
SELECT 
  e.id,
  e.title,
  e.description,
  e.start_time,
  e.end_time,
  ev.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  mid_term.episodes e
JOIN 
  mid_term.episode_vectors ev ON e.id = ev.episode_id
WHERE 
  e.start_time <= '2025-03-22 15:00:00+09:00' AND
  e.end_time >= '2025-03-22 15:00:00+09:00'
ORDER BY 
  distance
LIMIT 10;
```

## 6. 時間ベースのフィルタリングの最適化

### 6.1 日付・時刻インデックスの作成

時間ベースのフィルタリングを高速化するために、適切なインデックスを作成します：

```sql
-- 作成日時のインデックス
CREATE INDEX idx_knowledge_items_created_at ON long_term.knowledge_items(created_at);

-- 更新日時のインデックス
CREATE INDEX idx_knowledge_items_updated_at ON long_term.knowledge_items(updated_at);

-- エピソードの期間インデックス
CREATE INDEX idx_episodes_start_time ON mid_term.episodes(start_time);
CREATE INDEX idx_episodes_end_time ON mid_term.episodes(end_time);
```

### 6.2 部分インデックスの活用

特定の条件に対して部分インデックスを作成することで、インデックスサイズを小さく保ちながら検索パフォーマンスを向上させることができます：

```sql
-- 有効期限が切れていないアイテムの部分インデックス
CREATE INDEX idx_knowledge_items_valid ON long_term.knowledge_items(created_at)
WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

-- 最近作成されたアイテムの部分インデックス
CREATE INDEX idx_knowledge_items_recent ON long_term.knowledge_items(created_at)
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days';
```

### 6.3 複合インデックスの活用

時間とその他の条件を組み合わせた検索を高速化するために、複合インデックスを作成します：

```sql
-- カテゴリと作成日時の複合インデックス
CREATE INDEX idx_knowledge_items_category_created_at 
ON long_term.knowledge_items(category, created_at);

-- 重要度と更新日時の複合インデックス
CREATE INDEX idx_knowledge_items_importance_updated_at 
ON long_term.knowledge_items(importance, updated_at);
```

### 6.4 日付範囲パーティショニングの活用

大量のデータを扱う場合、日付範囲によるテーブルパーティショニングを活用することで、検索パフォーマンスを向上させることができます：

```sql
-- 月単位でパーティショニングされたエピソードテーブルの作成
CREATE TABLE mid_term.episodes (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  importance FLOAT NOT NULL DEFAULT 0.5,
  -- その他のカラム
) PARTITION BY RANGE (start_time);

-- 月単位のパーティションの作成
CREATE TABLE mid_term.episodes_2025_01 PARTITION OF mid_term.episodes
FOR VALUES FROM ('2025-01-01 00:00:00+09:00') TO ('2025-02-01 00:00:00+09:00');

CREATE TABLE mid_term.episodes_2025_02 PARTITION OF mid_term.episodes
FOR VALUES FROM ('2025-02-01 00:00:00+09:00') TO ('2025-03-01 00:00:00+09:00');

CREATE TABLE mid_term.episodes_2025_03 PARTITION OF mid_term.episodes
FOR VALUES FROM ('2025-03-01 00:00:00+09:00') TO ('2025-04-01 00:00:00+09:00');
```

## 7. Node.jsでの時間ベースフィルタリング実装

### 7.1 日付範囲によるフィルタリング

```javascript
// 日付範囲によるフィルタリングを適用したベクトル検索
async function searchKnowledgeByDateRange(queryEmbedding, startDate, endDate, limit = 10) {
  return db.any(
    'SELECT ' +
    '  k.id, ' +
    '  k.name, ' +
    '  k.content, ' +
    '  k.created_at, ' +
    '  kv.embedding <=> $1 AS distance ' +
    'FROM ' +
    '  long_term.knowledge_items k ' +
    'JOIN ' +
    '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
    'WHERE ' +
    '  k.created_at >= $2 AND ' +
    '  k.created_at <= $3 ' +
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $4',
    [queryEmbedding, startDate, endDate, limit]
  );
}
```

### 7.2 相対的な日付範囲によるフィルタリング

```javascript
// 相対的な日付範囲によるフィルタリングを適用したベクトル検索
async function searchRecentKnowledge(queryEmbedding, daysAgo = 30, limit = 10) {
  return db.any(
    'SELECT ' +
    '  k.id, ' +
    '  k.name, ' +
    '  k.content, ' +
    '  k.created_at, ' +
    '  kv.embedding <=> $1 AS distance ' +
    'FROM ' +
    '  long_term.knowledge_items k ' +
    'JOIN ' +
    '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
    'WHERE ' +
    '  k.created_at >= CURRENT_TIMESTAMP - INTERVAL \'$2 days\' ' +
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $3',
    [queryEmbedding, daysAgo, limit]
  );
}
```

### 7.3 期間によるフィルタリング

```javascript
// 期間によるフィルタリングを適用したエピソード検索
async function searchEpisodesByTimeRange(queryEmbedding, startTime, endTime, limit = 10) {
  return db.any(
    'SELECT ' +
    '  e.id, ' +
    '  e.title, ' +
    '  e.description, ' +
    '  e.start_time, ' +
    '  e.end_time, ' +
    '  ev.embedding <=> $1 AS distance ' +
    'FROM ' +
    '  mid_term.episodes e ' +
    'JOIN ' +
    '  mid_term.episode_vectors ev ON e.id = ev.episode_id ' +
    'WHERE ' +
    '  e.start_time <= $3 AND ' +  // 期間が重複するエピソードを検索
    '  e.end_time >= $2 ' +
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $4',
    [queryEmbedding, startTime, endTime, limit]
  );
}
```

### 7.4 動的な時間ベースフィルタリング

```javascript
// 動的な時間ベースフィルタリング条件を構築するヘルパー関数
function buildTimeFilterConditions(filters = {}) {
  const conditions = [];
  const params = [];
  
  // クエリパラメータのインデックス（最初のパラメータはqueryEmbeddingのため2から開始）
  let paramIndex = 2;
  
  // 作成日時の範囲フィルター
  if (filters.createdAfter) {
    conditions.push(`k.created_at >= $${paramIndex++}`);
    params.push(filters.createdAfter);
  }
  
  if (filters.createdBefore) {
    conditions.push(`k.created_at <= $${paramIndex++}`);
    params.push(filters.createdBefore);
  }
  
  // 更新日時の範囲フィルター
  if (filters.updatedAfter) {
    conditions.push(`k.updated_at >= $${paramIndex++}`);
    params.push(filters.updatedAfter);
  }
  
  if (filters.updatedBefore) {
    conditions.push(`k.updated_at <= $${paramIndex++}`);
    params.push(filters.updatedBefore);
  }
  
  // 相対的な日付範囲フィルター
  if (filters.createdInLastDays) {
    conditions.push(`k.created_at >= CURRENT_TIMESTAMP - INTERVAL '${filters.createdInLastDays} days'`);
  }
  
  if (filters.updatedInLastDays) {
    conditions.push(`k.updated_at >= CURRENT_TIMESTAMP - INTERVAL '${filters.updatedInLastDays} days'`);
  }
  
  // 有効期限フィルター
  if (filters.onlyValid === true) {
    conditions.push(`(k.expires_at IS NULL OR k.expires_at > CURRENT_TIMESTAMP)`);
  }
  
  // WHERE句の構築
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return {
    whereClause,
    params,
    paramIndex
  };
}

// 動的時間ベースフィルタリングを使用したベクトル検索
async function searchKnowledgeWithTimeFilters(queryEmbedding, filters = {}, limit = 10) {
  const { whereClause, params, paramIndex } = buildTimeFilterConditions(filters);
  
  const query = `
    SELECT 
      k.id,
      k.name,
      k.content,
      k.created_at,
      k.updated_at,
      k.expires_at,
      kv.embedding <=> $1 AS distance
    FROM 
      long_term.knowledge_items k
    JOIN 
      long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
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

## 8. HARCA記憶システムにおける時間ベースフィルタリング戦略

### 8.1 中期記憶（エピソード記憶）の時間ベースフィルタリング

エピソード記憶では、時間的なコンテキストが特に重要です：

```sql
-- 最近のエピソードを検索し、時間的に近いものを優先
SELECT 
  e.id,
  e.title,
  e.description,
  e.start_time,
  e.end_time,
  ev.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - e.end_time)) / 86400 AS days_ago
FROM 
  mid_term.episodes e
JOIN 
  mid_term.episode_vectors ev ON e.id = ev.episode_id
WHERE 
  e.end_time >= CURRENT_TIMESTAMP - INTERVAL '90 days'
ORDER BY 
  distance * (1 + (days_ago * 0.01))  -- 時間的な近さを考慮したスコアリング
LIMIT 10;
```

### 8.2 長期記憶（知識ベース）の時間ベースフィルタリング

知識ベースでは、鮮度と関連性のバランスが重要です：

```sql
-- 最近更新された関連知識を検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.updated_at,
  k.importance,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  (k.expires_at IS NULL OR k.expires_at > CURRENT_TIMESTAMP)
ORDER BY 
  distance * (CASE 
    WHEN k.updated_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 0.8
    WHEN k.updated_at >= CURRENT_TIMESTAMP - INTERVAL '90 days' THEN 0.9
    ELSE 1.0
  END)  -- 最近更新されたアイテムを優先
LIMIT 10;
```

### 8.3 長期記憶（ルールエンジン）の時間ベースフィルタリング

ルールエンジンでは、アクティブな期間が重要です：

```sql
-- 現在アクティブなルールを検索
SELECT 
  r.id,
  r.name,
  r.description,
  r.active_from,
  r.active_until,
  r.priority,
  rv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.rules r
JOIN 
  long_term.rule_vectors rv ON r.id = rv.rule_id
WHERE 
  r.is_active = true AND
  (r.active_from IS NULL OR r.active_from <= CURRENT_TIMESTAMP) AND
  (r.active_until IS NULL OR r.active_until > CURRENT_TIMESTAMP)
ORDER BY 
  distance, r.priority DESC
LIMIT 10;
```

## 9. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索での時間ベースのフィルタリングについて説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（コンテキスト）](./memory-system-postgresql-vector-search-query-filtering-context.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（最適化）](./memory-system-postgresql-vector-search-query-filtering-optimization.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索](./memory-system-postgresql-vector-search-query-hybrid.md)
4. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - Node.js統合](./memory-system-postgresql-vector-search-nodejs.md)
