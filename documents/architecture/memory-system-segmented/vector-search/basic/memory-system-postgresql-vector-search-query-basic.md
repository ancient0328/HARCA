---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - 基本"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - 基本

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索の基本的なクエリパターンについて詳細に説明します。近似最近傍検索、距離測定方法の選択、結果の制限とオフセットなど、ベクトル検索の基本的な使用方法を記述します。

## 2. 基本的な近似最近傍検索

### 2.1 単純な最近傍検索

最も基本的なベクトル検索は、与えられたクエリベクトルに最も近い（類似した）ベクトルを見つける操作です。

```sql
-- コサイン類似度に基づく最近傍検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
ORDER BY 
  distance
LIMIT 10;
```

### 2.2 Node.jsでの実装

```javascript
const pgp = require('pg-promise')();
const db = pgp('postgres://username:password@localhost:3730/harca_memory');

// 基本的な最近傍検索
async function findNearestNeighbors(queryEmbedding, limit = 10) {
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
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $2',
    [queryEmbedding, limit]
  );
}
```

### 2.3 インデックスパラメータの調整

検索精度と速度のバランスを調整するために、インデックスパラメータを設定できます：

```sql
-- IVFFlatのprobes設定を調整
SET ivfflat.probes = 10;  -- デフォルトは1

-- HNSWのef_search設定を調整
SET hnsw.ef_search = 100;  -- デフォルトは40
```

Node.jsでの実装：

```javascript
// インデックスパラメータを調整した検索
async function findNearestNeighborsWithParams(queryEmbedding, limit = 10, indexType = 'ivfflat', params = {}) {
  return db.tx(async t => {
    // インデックスパラメータの設定
    if (indexType === 'ivfflat') {
      const probes = params.probes || 10;
      await t.none('SET ivfflat.probes = $1', [probes]);
    } else if (indexType === 'hnsw') {
      const efSearch = params.ef_search || 100;
      await t.none('SET hnsw.ef_search = $1', [efSearch]);
    }
    
    // ベクトル検索実行
    return t.any(
      'SELECT ' +
      '  k.id, ' +
      '  k.name, ' +
      '  k.content, ' +
      '  kv.embedding <=> $1 AS distance ' +
      'FROM ' +
      '  long_term.knowledge_items k ' +
      'JOIN ' +
      '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
      'ORDER BY ' +
      '  distance ' +
      'LIMIT $2',
      [queryEmbedding, limit]
    );
  });
}
```

## 3. 距離測定方法の選択

### 3.1 サポートされている距離測定方法

pgvectorは以下の3つの距離/類似度測定方法をサポートしています：

| 演算子 | 説明 | 使用例 | 適したユースケース |
|-------|------|-------|-----------------|
| `<->` | ユークリッド距離 | `embedding <-> '[0.1, 0.2, ...]'::vector` | 絶対的な距離が重要な場合 |
| `<=>` | コサイン距離 | `embedding <=> '[0.1, 0.2, ...]'::vector` | ベクトルの方向（意味）が重要な場合 |
| `<#>` | 内積の負数 | `embedding <#> '[0.1, 0.2, ...]'::vector` | 正規化されたベクトルでの類似度計算 |

### 3.2 距離測定方法の選択基準

| 距離測定方法 | 長所 | 短所 | 推奨用途 |
|------------|------|------|---------|
| ユークリッド距離 | 直感的、絶対的な距離を測定 | ベクトルの長さに影響される | 画像特徴量、座標データ |
| コサイン距離 | ベクトルの長さに影響されない、意味的類似性に適している | 絶対的な距離を考慮しない | テキスト埋め込み、意味検索 |
| 内積 | 計算が高速、正規化ベクトルに適している | 非正規化ベクトルでは意味が不明確 | 正規化済みベクトル、高速検索が必要な場合 |

### 3.3 各距離測定方法の使用例

#### 3.3.1 ユークリッド距離

```sql
-- ユークリッド距離による検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <-> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
ORDER BY 
  distance
LIMIT 10;
```

#### 3.3.2 コサイン距離

```sql
-- コサイン距離による検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
ORDER BY 
  distance
LIMIT 10;
```

#### 3.3.3 内積の負数

```sql
-- 内積の負数による検索
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <#> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
ORDER BY 
  distance
LIMIT 10;
```

### 3.4 Node.jsでの距離測定方法の実装

```javascript
// 距離測定方法を指定した検索
async function findSimilarItems(queryEmbedding, distanceMethod = 'cosine', limit = 10) {
  let distanceOperator;
  
  switch (distanceMethod) {
    case 'euclidean':
      distanceOperator = '<->';
      break;
    case 'cosine':
      distanceOperator = '<=>';
      break;
    case 'inner_product':
      distanceOperator = '<#>';
      break;
    default:
      throw new Error(`Unsupported distance method: ${distanceMethod}`);
  }
  
  // 動的にSQLを構築
  const query = `
    SELECT 
      k.id,
      k.name,
      k.content,
      kv.embedding ${distanceOperator} $1 AS distance
    FROM 
      long_term.knowledge_items k
    JOIN 
      long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
    ORDER BY 
      distance
    LIMIT $2
  `;
  
  return db.any(query, [queryEmbedding, limit]);
}
```

## 4. 結果の制限とオフセット

### 4.1 結果数の制限

検索結果の数を制限するには、`LIMIT`句を使用します：

```sql
-- 上位5件の結果を取得
SELECT 
  k.id,
  k.name,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
ORDER BY 
  distance
LIMIT 5;
```

### 4.2 オフセットを使用したページング

ページングを実装するには、`OFFSET`句を使用します：

```sql
-- 2ページ目の結果を取得（1ページあたり10件）
SELECT 
  k.id,
  k.name,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
ORDER BY 
  distance
LIMIT 10 OFFSET 10;
```

### 4.3 効率的なページング実装

大量のデータに対するページングでは、`OFFSET`の使用は非効率になる場合があります。代わりに、前回の最後の結果を基準にするキーセットページングを使用できます：

```sql
-- キーセットページング（前回の最後の結果のdistanceを基準）
SELECT 
  k.id,
  k.name,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE
  (kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector) > 0.25  -- 前回の最後の結果のdistance
ORDER BY 
  distance
LIMIT 10;
```

### 4.4 Node.jsでのページング実装

```javascript
// 基本的なオフセットページング
async function findSimilarItemsWithPaging(queryEmbedding, page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;
  
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
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $2 OFFSET $3',
    [queryEmbedding, pageSize, offset]
  );
}

// キーセットページング
async function findSimilarItemsWithKeyset(queryEmbedding, lastDistance = null, pageSize = 10) {
  let query;
  let params;
  
  if (lastDistance === null) {
    // 最初のページ
    query = `
      SELECT 
        k.id,
        k.name,
        k.content,
        kv.embedding <=> $1 AS distance
      FROM 
        long_term.knowledge_items k
      JOIN 
        long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
      ORDER BY 
        distance
      LIMIT $2
    `;
    params = [queryEmbedding, pageSize];
  } else {
    // 2ページ目以降
    query = `
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
        (kv.embedding <=> $1) > $3
      ORDER BY 
        distance
      LIMIT $2
    `;
    params = [queryEmbedding, pageSize, lastDistance];
  }
  
  return db.any(query, params);
}
```

## 5. 類似度スコアの正規化と解釈

### 5.1 類似度スコアの範囲

各距離測定方法のスコア範囲：

| 距離測定方法 | スコア範囲 | 解釈 |
|------------|----------|------|
| ユークリッド距離 (`<->`) | [0, ∞) | 小さいほど類似（0が完全一致） |
| コサイン距離 (`<=>`) | [0, 2] | 小さいほど類似（0が完全一致） |
| 内積の負数 (`<#>`) | [-1, 1] | 小さいほど類似（-1が完全一致、正規化ベクトルの場合） |

### 5.2 類似度スコアの正規化

検索結果の類似度スコアを[0,1]の範囲に正規化する例：

```sql
-- コサイン類似度を[0,1]の範囲に正規化（1が完全一致）
SELECT 
  k.id,
  k.name,
  1 - (kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector) / 2 AS similarity
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
ORDER BY 
  similarity DESC
LIMIT 10;
```

### 5.3 類似度閾値の設定

類似度が一定の閾値を超える結果のみを取得する例：

```sql
-- 類似度が0.8以上（コサイン距離が0.4以下）の結果のみを取得
SELECT 
  k.id,
  k.name,
  1 - (kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector) / 2 AS similarity
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE
  (kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector) <= 0.4
ORDER BY 
  similarity DESC;
```

### 5.4 Node.jsでの類似度スコア処理

```javascript
// 正規化された類似度スコアを返す検索
async function findSimilarItemsWithNormalizedScore(queryEmbedding, limit = 10, threshold = 0.7) {
  // コサイン距離の閾値を計算（類似度0.7はコサイン距離0.6に相当）
  const distanceThreshold = 2 * (1 - threshold);
  
  return db.any(
    'SELECT ' +
    '  k.id, ' +
    '  k.name, ' +
    '  k.content, ' +
    '  1 - (kv.embedding <=> $1) / 2 AS similarity ' +
    'FROM ' +
    '  long_term.knowledge_items k ' +
    'JOIN ' +
    '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
    'WHERE ' +
    '  (kv.embedding <=> $1) <= $3 ' +
    'ORDER BY ' +
    '  similarity DESC ' +
    'LIMIT $2',
    [queryEmbedding, limit, distanceThreshold]
  );
}
```

## 6. HARCA記憶システムでの基本的なベクトル検索実装

### 6.1 中期記憶（エピソード記憶）の検索

```javascript
// エピソード記憶の検索
async function searchEpisodicMemory(queryText, limit = 10) {
  // 1. テキストからベクトル埋め込みを生成
  const { embedding } = await generateEmbedding(queryText);
  
  // 2. ベクトル検索を実行
  return db.any(
    'SELECT ' +
    '  e.id, ' +
    '  e.title, ' +
    '  e.description, ' +
    '  e.start_time, ' +
    '  e.importance, ' +
    '  1 - (ev.embedding <=> $1) / 2 AS similarity ' +
    'FROM ' +
    '  mid_term.episodes e ' +
    'JOIN ' +
    '  mid_term.episode_vectors ev ON e.id = ev.episode_id ' +
    'WHERE ' +
    '  (ev.embedding <=> $1) <= 0.6 ' +  // 類似度0.7以上
    'ORDER BY ' +
    '  similarity DESC ' +
    'LIMIT $2',
    [embedding, limit]
  );
}
```

### 6.2 長期記憶（知識ベース）の検索

```javascript
// 知識ベースの検索
async function searchKnowledgeBase(queryText, limit = 10) {
  // 1. テキストからベクトル埋め込みを生成
  const { embedding } = await generateEmbedding(queryText);
  
  // 2. ベクトル検索を実行
  return db.any(
    'SELECT ' +
    '  k.id, ' +
    '  k.type, ' +
    '  k.name, ' +
    '  k.content, ' +
    '  k.confidence, ' +
    '  k.importance, ' +
    '  1 - (kv.embedding <=> $1) / 2 AS similarity ' +
    'FROM ' +
    '  long_term.knowledge_items k ' +
    'JOIN ' +
    '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
    'WHERE ' +
    '  (kv.embedding <=> $1) <= 0.5 ' +  // 類似度0.75以上
    'ORDER BY ' +
    '  similarity DESC ' +
    'LIMIT $2',
    [embedding, limit]
  );
}
```

### 6.3 長期記憶（ルールエンジン）の検索

```javascript
// ルールエンジンの検索
async function searchRules(contextDescription, limit = 10) {
  // 1. コンテキスト記述からベクトル埋め込みを生成
  const { embedding } = await generateEmbedding(contextDescription);
  
  // 2. ベクトル検索を実行
  return db.any(
    'SELECT ' +
    '  r.id, ' +
    '  r.name, ' +
    '  r.description, ' +
    '  r.condition_expression, ' +
    '  r.action_expression, ' +
    '  r.priority, ' +
    '  r.is_active, ' +
    '  1 - (rv.embedding <=> $1) / 2 AS similarity ' +
    'FROM ' +
    '  long_term.rules r ' +
    'JOIN ' +
    '  long_term.rule_vectors rv ON r.id = rv.rule_id ' +
    'WHERE ' +
    '  r.is_active = true AND ' +
    '  (rv.embedding <=> $1) <= 0.7 ' +  // 類似度0.65以上
    'ORDER BY ' +
    '  similarity DESC, r.priority DESC ' +  // 類似度と優先度で並べ替え
    'LIMIT $2',
    [embedding, limit]
  );
}
```

## 7. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索の基本的なクエリパターンについて説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング](./memory-system-postgresql-vector-search-query-filtering.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索](./memory-system-postgresql-vector-search-query-hybrid.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - 高度な使用法](./memory-system-postgresql-vector-search-query-advanced.md)
4. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - Node.js統合](./memory-system-postgresql-vector-search-nodejs.md)
5. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索最適化](./memory-system-postgresql-vector-search-optimization.md)
