---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（最適化）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（最適化）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索のパフォーマンス最適化について詳細に説明します。ベクトル検索とフィルタリングの組み合わせを効率的に実行するための戦略、インデックス最適化、クエリチューニングなどについて記述します。

## 2. ベクトル検索最適化の基本原則

### 2.1 ベクトル検索のパフォーマンス課題

ベクトル検索には以下のようなパフォーマンス課題があります：

1. **計算コスト**: ベクトル間の距離計算は計算コストが高い
2. **スケーラビリティ**: データ量が増えるとパフォーマンスが低下する
3. **フィルタリングとの組み合わせ**: フィルタリングを追加するとインデックスの効率が低下する
4. **メモリ使用量**: 大量のベクトルデータはメモリ消費が大きい
5. **クエリ複雑性**: 複雑なクエリはプランナーの最適化を困難にする

### 2.2 最適化の基本アプローチ

ベクトル検索を最適化するための基本的なアプローチは以下の通りです：

1. **適切なインデックス選択**: ユースケースに適したベクトルインデックスを選択する
2. **事前フィルタリング**: 可能な限りベクトル検索前にデータセットを絞り込む
3. **結果キャッシング**: 頻繁に実行される検索結果をキャッシュする
4. **クエリチューニング**: 効率的なSQLクエリを設計する
5. **データベース設定最適化**: PostgreSQLの設定を最適化する

## 3. インデックス最適化

### 3.1 インデックスタイプの選択

pgvectorは以下の主要なインデックスタイプをサポートしています：

| インデックスタイプ | 特徴 | 適したユースケース |
|-----------------|------|------------------|
| **IVFFlat** | 中程度の精度、高速な検索 | 一般的なベクトル検索 |
| **HNSW** | 高精度、非常に高速な検索、メモリ使用量大 | 高精度が必要な検索 |

```sql
-- IVFFlatインデックスの作成
CREATE INDEX idx_knowledge_vectors_embedding_ivfflat 
ON long_term.knowledge_vectors USING ivfflat (embedding vector_l2_ops) 
WITH (lists = 100);

-- HNSWインデックスの作成
CREATE INDEX idx_knowledge_vectors_embedding_hnsw 
ON long_term.knowledge_vectors USING hnsw (embedding vector_l2_ops) 
WITH (m = 16, ef_construction = 64);
```

### 3.2 インデックスパラメータの最適化

#### IVFFlatパラメータの最適化

```sql
-- データ量に基づいたリスト数の最適化
-- リスト数 = √n（nはベクトルの総数）
CREATE INDEX idx_knowledge_vectors_embedding_ivfflat_optimized 
ON long_term.knowledge_vectors USING ivfflat (embedding vector_l2_ops) 
WITH (lists = 1000);  -- 100万ベクトルの場合
```

#### HNSWパラメータの最適化

```sql
-- 精度とパフォーマンスのバランスを取ったHNSWパラメータ
CREATE INDEX idx_knowledge_vectors_embedding_hnsw_optimized 
ON long_term.knowledge_vectors USING hnsw (embedding vector_l2_ops) 
WITH (m = 16, ef_construction = 128);  -- 高精度設定
```

### 3.3 フィルタリング用インデックスの最適化

フィルタリング条件に対するインデックスも最適化します：

```sql
-- メタデータフィルタリング用のGINインデックス
CREATE INDEX idx_knowledge_items_metadata 
ON long_term.knowledge_items USING GIN (metadata jsonb_path_ops);

-- カテゴリフィルタリング用のBツリーインデックス
CREATE INDEX idx_knowledge_items_category 
ON long_term.knowledge_items (category);

-- 時間ベースフィルタリング用のBツリーインデックス
CREATE INDEX idx_knowledge_items_created_at 
ON long_term.knowledge_items (created_at);
```

### 3.4 部分インデックスの活用

頻繁に使用されるフィルタリング条件に対して部分インデックスを作成します：

```sql
-- アクティブなアイテムのみの部分インデックス
CREATE INDEX idx_knowledge_items_active 
ON long_term.knowledge_items (id) 
WHERE status = 'active';

-- 高重要度アイテムのみの部分インデックス
CREATE INDEX idx_knowledge_items_high_importance 
ON long_term.knowledge_items (id) 
WHERE importance >= 0.8;
```

## 4. クエリ最適化戦略

### 4.1 事前フィルタリング戦略

ベクトル検索前にデータセットを絞り込むことで、検索対象を減らし、パフォーマンスを向上させます：

```sql
-- 事前フィルタリングを使用したベクトル検索
WITH filtered_items AS (
  SELECT k.id
  FROM long_term.knowledge_items k
  WHERE k.category = 'technology'
    AND k.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND k.status = 'active'
)
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  filtered_items fi
JOIN 
  long_term.knowledge_items k ON k.id = fi.id
JOIN 
  long_term.knowledge_vectors kv ON kv.knowledge_id = k.id
ORDER BY 
  distance
LIMIT 10;
```

### 4.2 ベクトル検索とフィルタリングの順序最適化

ベクトル検索とフィルタリングの実行順序を最適化します：

#### アプローチ1: 事前フィルタリング + ベクトル検索

```sql
-- 事前フィルタリング + ベクトル検索（小さなフィルタリング結果セットの場合に効果的）
WITH filtered_items AS (
  SELECT k.id
  FROM long_term.knowledge_items k
  WHERE k.category = 'technology'
    AND k.status = 'active'
    AND k.metadata @> '{"tags": ["AI"]}'::jsonb
)
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  filtered_items fi
JOIN 
  long_term.knowledge_items k ON k.id = fi.id
JOIN 
  long_term.knowledge_vectors kv ON kv.knowledge_id = k.id
ORDER BY 
  distance
LIMIT 10;
```

#### アプローチ2: ベクトル検索 + 事後フィルタリング

```sql
-- ベクトル検索 + 事後フィルタリング（フィルタリング結果セットが大きい場合に効果的）
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_vectors kv
JOIN 
  long_term.knowledge_items k ON k.id = kv.knowledge_id
WHERE 
  k.category = 'technology'
  AND k.status = 'active'
ORDER BY 
  distance
LIMIT 10;
```

#### アプローチ3: ハイブリッドアプローチ

```sql
-- ハイブリッドアプローチ（厳格なフィルタリング + 緩やかなフィルタリング）
WITH strict_filtered_items AS (
  SELECT k.id
  FROM long_term.knowledge_items k
  WHERE k.category = 'technology'
    AND k.status = 'active'
),
vector_search_results AS (
  SELECT 
    k.id,
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
  FROM 
    strict_filtered_items sfi
  JOIN 
    long_term.knowledge_items k ON k.id = sfi.id
  JOIN 
    long_term.knowledge_vectors kv ON kv.knowledge_id = k.id
  ORDER BY 
    distance
  LIMIT 100  -- 中間結果セット
)
SELECT 
  k.id,
  k.name,
  k.content,
  vsr.distance
FROM 
  vector_search_results vsr
JOIN 
  long_term.knowledge_items k ON k.id = vsr.id
WHERE 
  k.metadata @> '{"tags": ["AI"]}'::jsonb  -- 追加のフィルタリング
ORDER BY 
  vsr.distance
LIMIT 10;
```

### 4.3 LIMIT句の最適化

LIMIT句を効果的に使用して、処理するデータ量を減らします：

```sql
-- LIMIT句を使用した最適化
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_vectors kv
JOIN 
  long_term.knowledge_items k ON k.id = kv.knowledge_id
WHERE 
  k.category = 'technology'
ORDER BY 
  distance
LIMIT 10;  -- 必要な結果だけを取得
```

### 4.4 プロジェクション最適化

必要なカラムのみを選択して、データ転送量を減らします：

```sql
-- プロジェクション最適化
SELECT 
  k.id,
  k.name,  -- 必要なカラムのみを選択
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_vectors kv
JOIN 
  long_term.knowledge_items k ON k.id = kv.knowledge_id
WHERE 
  k.category = 'technology'
ORDER BY 
  distance
LIMIT 10;
```

## 5. データベース設定最適化

### 5.1 メモリ関連パラメータの最適化

```sql
-- 共有バッファの設定（システムメモリの25%程度）
ALTER SYSTEM SET shared_buffers = '4GB';

-- ワークメモリの設定（複雑なソート操作用）
ALTER SYSTEM SET work_mem = '64MB';

-- メンテナンスワークメモリの設定（インデックス構築用）
ALTER SYSTEM SET maintenance_work_mem = '1GB';

-- 効果的なキャッシュサイズの設定
ALTER SYSTEM SET effective_cache_size = '12GB';
```

### 5.2 クエリプランナー関連パラメータの最適化

```sql
-- パラレルクエリの設定
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers = 8;

-- クエリプランナーのコスト定数
ALTER SYSTEM SET random_page_cost = 1.1;  -- SSDの場合
ALTER SYSTEM SET seq_page_cost = 1.0;

-- 統計情報の詳細度
ALTER SYSTEM SET default_statistics_target = 500;
```

### 5.3 pgvector特有の最適化

```sql
-- IVFFlatプローブ数の設定（検索精度とパフォーマンスのバランス）
SET ivfflat.probes = 10;

-- HNSWのef_searchパラメータの設定（検索精度とパフォーマンスのバランス）
SET hnsw.ef_search = 100;
```

## 6. クエリ実行計画の分析と最適化

### 6.1 EXPLAINコマンドの活用

```sql
-- クエリ実行計画の分析
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
WHERE 
  k.category = 'technology'
ORDER BY 
  distance
LIMIT 10;
```

### 6.2 実行計画の解釈と最適化

実行計画の結果を解釈し、以下のような最適化を検討します：

1. **シーケンシャルスキャン vs インデックススキャン**: 適切なインデックスが使用されているか確認
2. **ネステッドループ vs ハッシュ結合**: 結合方法が適切か確認
3. **ソート操作**: ソート操作が効率的に行われているか確認
4. **パラレル実行**: パラレル実行が活用されているか確認

### 6.3 統計情報の更新

定期的に統計情報を更新して、クエリプランナーが最適な実行計画を選択できるようにします：

```sql
-- テーブルの統計情報を更新
ANALYZE long_term.knowledge_items;
ANALYZE long_term.knowledge_vectors;

-- 特定のテーブルの詳細な統計情報を収集
ALTER TABLE long_term.knowledge_vectors ALTER COLUMN embedding SET STATISTICS 1000;
ANALYZE long_term.knowledge_vectors;
```

## 7. Node.jsでの最適化実装

### 7.1 効率的なクエリ構築

```javascript
// 効率的なクエリ構築関数
function buildOptimizedVectorSearchQuery(options = {}) {
  const {
    embedding,
    category,
    tags,
    status,
    createdAfter,
    importance,
    limit = 10,
    usePreFiltering = true
  } = options;
  
  // フィルタリング条件の構築
  const filters = [];
  const params = [embedding];
  let paramIndex = 2;
  
  if (category) {
    filters.push(`k.category = $${paramIndex++}`);
    params.push(category);
  }
  
  if (status) {
    filters.push(`k.status = $${paramIndex++}`);
    params.push(status);
  }
  
  if (createdAfter) {
    filters.push(`k.created_at >= $${paramIndex++}`);
    params.push(createdAfter);
  }
  
  if (importance) {
    filters.push(`k.importance >= $${paramIndex++}`);
    params.push(importance);
  }
  
  if (tags && tags.length > 0) {
    const tagsJson = JSON.stringify({ tags });
    filters.push(`k.metadata @> $${paramIndex++}`);
    params.push(tagsJson);
  }
  
  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  
  // 事前フィルタリングを使用するかどうかに基づいてクエリを構築
  let query;
  
  if (usePreFiltering && filters.length > 0) {
    // 事前フィルタリングアプローチ
    query = `
      WITH filtered_items AS (
        SELECT k.id
        FROM long_term.knowledge_items k
        ${whereClause}
      )
      SELECT 
        k.id,
        k.name,
        k.content,
        kv.embedding <=> $1 AS distance
      FROM 
        filtered_items fi
      JOIN 
        long_term.knowledge_items k ON k.id = fi.id
      JOIN 
        long_term.knowledge_vectors kv ON kv.knowledge_id = k.id
      ORDER BY 
        distance
      LIMIT $${paramIndex}
    `;
  } else {
    // 直接ベクトル検索アプローチ
    query = `
      SELECT 
        k.id,
        k.name,
        k.content,
        kv.embedding <=> $1 AS distance
      FROM 
        long_term.knowledge_vectors kv
      JOIN 
        long_term.knowledge_items k ON k.id = kv.knowledge_id
      ${whereClause}
      ORDER BY 
        distance
      LIMIT $${paramIndex}
    `;
  }
  
  params.push(limit);
  
  return { query, params };
}
```

### 7.2 最適化されたベクトル検索関数

```javascript
// 最適化されたベクトル検索関数
async function searchKnowledgeOptimized(options = {}) {
  const { query, params } = buildOptimizedVectorSearchQuery(options);
  
  // クエリの実行
  return db.any(query, params);
}
```

### 7.3 キャッシュを活用した検索

```javascript
// Redisキャッシュを活用した検索
const redis = require('redis');
const { promisify } = require('util');
const client = redis.createClient();
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);

// キャッシュを活用したベクトル検索
async function searchKnowledgeWithCache(options = {}) {
  // キャッシュキーの生成
  const cacheKey = `vector_search:${JSON.stringify(options)}`;
  
  // キャッシュからの取得を試みる
  const cachedResult = await getAsync(cacheKey);
  if (cachedResult) {
    return JSON.parse(cachedResult);
  }
  
  // キャッシュにない場合は検索を実行
  const result = await searchKnowledgeOptimized(options);
  
  // 結果をキャッシュに保存（TTL: 10分）
  await setAsync(cacheKey, JSON.stringify(result), 'EX', 600);
  
  return result;
}
```

### 7.4 バッチ処理とストリーミング

大量のデータを処理する場合は、バッチ処理やストリーミングを活用します：

```javascript
// バッチ処理を使用した大量データの検索
async function searchKnowledgeBatched(options = {}, batchSize = 100) {
  const results = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const batchOptions = {
      ...options,
      limit: batchSize,
      offset: offset
    };
    
    const batchResults = await searchKnowledgeOptimized(batchOptions);
    
    if (batchResults.length === 0) {
      hasMore = false;
    } else {
      results.push(...batchResults);
      offset += batchSize;
      
      // 十分な結果が得られた場合は終了
      if (results.length >= options.limit) {
        results.length = options.limit;
        hasMore = false;
      }
    }
  }
  
  return results;
}
```

## 8. HARCA記憶システムにおける最適化戦略

### 8.1 階層的検索戦略

HARCA記憶システムでは、階層的な検索戦略を採用して、パフォーマンスを最適化します：

```javascript
// 階層的検索戦略
async function hierarchicalSearch(query, options = {}) {
  // 1. まず短期記憶（Redis）を検索
  const shortTermResults = await searchShortTermMemory(query, options);
  
  // 短期記憶で十分な結果が得られた場合はそれを返す
  if (shortTermResults.length >= options.limit) {
    return shortTermResults.slice(0, options.limit);
  }
  
  // 2. 次に中期記憶（PostgreSQL - 最近のデータ）を検索
  const midTermOptions = {
    ...options,
    createdAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)  // 過去30日
  };
  const midTermResults = await searchMidTermMemory(query, midTermOptions);
  
  // 短期記憶と中期記憶の結果を結合
  const combinedResults = [...shortTermResults, ...midTermResults];
  
  // 十分な結果が得られた場合はそれを返す
  if (combinedResults.length >= options.limit) {
    return combinedResults.slice(0, options.limit);
  }
  
  // 3. 最後に長期記憶（PostgreSQL - 全データ）を検索
  const longTermOptions = {
    ...options,
    limit: options.limit - combinedResults.length
  };
  const longTermResults = await searchLongTermMemory(query, longTermOptions);
  
  // すべての結果を結合して返す
  return [...combinedResults, ...longTermResults].slice(0, options.limit);
}
```

### 8.2 適応的検索戦略

ユーザーの行動パターンや検索結果のフィードバックに基づいて、検索戦略を適応的に調整します：

```javascript
// 適応的検索戦略
async function adaptiveSearch(query, options = {}) {
  // ユーザーの検索履歴を取得
  const userSearchHistory = await getUserSearchHistory(options.userId);
  
  // 検索履歴に基づいて最適な検索戦略を選択
  const searchStrategy = determineOptimalSearchStrategy(userSearchHistory);
  
  // 選択された戦略に基づいて検索オプションを調整
  const adaptedOptions = adaptSearchOptions(options, searchStrategy);
  
  // 適応的に調整された検索を実行
  return searchKnowledgeOptimized(adaptedOptions);
}
```

### 8.3 定期的な最適化メンテナンス

定期的な最適化メンテナンスを実行して、パフォーマンスを維持します：

```javascript
// 定期的な最適化メンテナンス
async function performOptimizationMaintenance() {
  // 1. 統計情報の更新
  await db.none('ANALYZE long_term.knowledge_items');
  await db.none('ANALYZE long_term.knowledge_vectors');
  
  // 2. インデックスの再構築
  await db.none('REINDEX INDEX idx_knowledge_vectors_embedding_ivfflat');
  
  // 3. テーブルのバキューム
  await db.none('VACUUM ANALYZE long_term.knowledge_items');
  await db.none('VACUUM ANALYZE long_term.knowledge_vectors');
  
  // 4. キャッシュの最適化
  await optimizeCache();
}
```

## 9. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索の最適化について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索](./memory-system-postgresql-vector-search-query-hybrid.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - Node.js統合](./memory-system-postgresql-vector-search-nodejs.md)
