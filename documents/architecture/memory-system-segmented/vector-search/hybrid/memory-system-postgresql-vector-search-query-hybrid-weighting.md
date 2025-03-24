---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（重み付け手法）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（重み付け手法）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索の重み付け手法について説明します。ベクトル検索とキーワード検索の結果を効果的に組み合わせるための様々な重み付けアルゴリズムを紹介します。

## 2. 重み付けハイブリッド検索の基本概念

### 2.1 重み付けの目的

ハイブリッド検索における重み付けの主な目的は以下の通りです：

1. **異なるスコアリングスケールの統一**: ベクトル距離とキーワードランクのスケールを調整
2. **検索タイプの重要度バランス**: ユースケースに応じてベクトル検索とキーワード検索の重要度を調整
3. **コンテキスト適応**: ユーザーの検索意図や状況に応じて重みを動的に調整
4. **結果の多様性確保**: 特定の検索タイプに偏らない結果セットの提供

### 2.2 スコア正規化の手法

異なるスケールのスコアを組み合わせるためには、まず正規化が必要です：

#### 2.2.1 線形正規化

```sql
-- ベクトル距離の線形正規化（0〜1の範囲に変換、0が最良）
(vector_distance - min_distance) / (max_distance - min_distance) AS normalized_vector_score

-- キーワードランクの線形正規化（0〜1の範囲に変換、1が最良）
(keyword_rank - min_rank) / (max_rank - min_rank) AS normalized_keyword_score
```

#### 2.2.2 ミンマックススケーリング

```sql
-- ベクトル距離のミンマックススケーリング
WITH vector_stats AS (
  SELECT MIN(vector_distance) AS min_dist, MAX(vector_distance) AS max_dist
  FROM vector_results
)
SELECT 
  id, 
  name,
  (vector_distance - min_dist) / NULLIF(max_dist - min_dist, 0) AS normalized_vector_score
FROM 
  vector_results, vector_stats;
```

#### 2.2.3 シグモイド関数による正規化

```sql
-- シグモイド関数によるベクトル距離の正規化
1.0 / (1.0 + exp(-10 * (0.5 - vector_distance))) AS sigmoid_vector_score
```

## 3. 線形重み付けハイブリッド検索

### 3.1 基本的な線形重み付け

最も単純な重み付け手法は、正規化されたスコアに線形の重みを適用する方法です：

```sql
-- 基本的な線形重み付けハイブリッド検索
WITH vector_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance
  FROM 
    long_term.knowledge_items k
  JOIN 
    long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
  ORDER BY 
    vector_distance
  LIMIT 100
),

keyword_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) AS keyword_rank
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.content_tsv @@ to_tsquery('english', 'neural & network')
  ORDER BY 
    keyword_rank DESC
  LIMIT 100
),

-- 両方の結果を結合
combined_results AS (
  SELECT 
    COALESCE(vr.id, kr.id) AS id,
    COALESCE(vr.name, kr.name) AS name,
    COALESCE(vr.content, kr.content) AS content,
    vr.vector_distance,
    kr.keyword_rank
  FROM 
    vector_results vr
  FULL OUTER JOIN 
    keyword_results kr ON vr.id = kr.id
)

-- 線形重み付けによるランキング
SELECT 
  id,
  name,
  content,
  vector_distance,
  keyword_rank,
  -- 線形重み付け（ベクトル:キーワード = 0.7:0.3）
  CASE 
    WHEN vector_distance IS NULL THEN 1.0  -- ベクトル検索にない場合は最大距離
    ELSE vector_distance 
  END * 0.7 +
  CASE 
    WHEN keyword_rank IS NULL THEN 0.0  -- キーワード検索にない場合は最小ランク
    ELSE (1.0 - keyword_rank)  -- キーワードランクは大きいほど良いので反転
  END * 0.3 AS combined_score
FROM 
  combined_results
ORDER BY 
  combined_score
LIMIT 10;
```

### 3.2 動的な重み付け

クエリの特性や検索結果の分布に基づいて、動的に重みを調整する方法です：

```sql
-- 動的な重み付けハイブリッド検索
WITH vector_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance
  FROM 
    long_term.knowledge_items k
  JOIN 
    long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
  ORDER BY 
    vector_distance
  LIMIT 100
),

keyword_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) AS keyword_rank
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.content_tsv @@ to_tsquery('english', 'neural & network')
  ORDER BY 
    keyword_rank DESC
  LIMIT 100
),

-- 検索結果の統計情報を計算
stats AS (
  SELECT 
    (SELECT COUNT(*) FROM vector_results) AS vector_count,
    (SELECT COUNT(*) FROM keyword_results) AS keyword_count,
    (SELECT AVG(vector_distance) FROM vector_results) AS avg_vector_distance,
    (SELECT AVG(keyword_rank) FROM keyword_results) AS avg_keyword_rank
),

-- 両方の結果を結合
combined_results AS (
  SELECT 
    COALESCE(vr.id, kr.id) AS id,
    COALESCE(vr.name, kr.name) AS name,
    COALESCE(vr.content, kr.content) AS content,
    vr.vector_distance,
    kr.keyword_rank
  FROM 
    vector_results vr
  FULL OUTER JOIN 
    keyword_results kr ON vr.id = kr.id
)

-- 動的な重み付けによるランキング
SELECT 
  cr.id,
  cr.name,
  cr.content,
  cr.vector_distance,
  cr.keyword_rank,
  -- 検索結果の分布に基づいた動的な重み付け
  CASE 
    WHEN cr.vector_distance IS NULL THEN 1.0
    ELSE cr.vector_distance 
  END * 
  CASE 
    WHEN s.vector_count > s.keyword_count THEN 0.7  -- ベクトル検索の結果が多い場合
    ELSE 0.3  -- キーワード検索の結果が多い場合
  END +
  CASE 
    WHEN cr.keyword_rank IS NULL THEN 0.0
    ELSE (1.0 - cr.keyword_rank)
  END * 
  CASE 
    WHEN s.vector_count > s.keyword_count THEN 0.3  -- ベクトル検索の結果が多い場合
    ELSE 0.7  -- キーワード検索の結果が多い場合
  END AS combined_score
FROM 
  combined_results cr,
  stats s
ORDER BY 
  combined_score
LIMIT 10;
```

## 4. 非線形重み付けハイブリッド検索

### 4.1 指数関数的重み付け

スコアの差をより強調するために、指数関数的な重み付けを適用する方法です：

```sql
-- 指数関数的重み付けハイブリッド検索
WITH vector_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance
  FROM 
    long_term.knowledge_items k
  JOIN 
    long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
  ORDER BY 
    vector_distance
  LIMIT 100
),

keyword_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) AS keyword_rank
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.content_tsv @@ to_tsquery('english', 'neural & network')
  ORDER BY 
    keyword_rank DESC
  LIMIT 100
),

-- 両方の結果を結合
combined_results AS (
  SELECT 
    COALESCE(vr.id, kr.id) AS id,
    COALESCE(vr.name, kr.name) AS name,
    COALESCE(vr.content, kr.content) AS content,
    vr.vector_distance,
    kr.keyword_rank
  FROM 
    vector_results vr
  FULL OUTER JOIN 
    keyword_results kr ON vr.id = kr.id
)

-- 指数関数的重み付けによるランキング
SELECT 
  id,
  name,
  content,
  vector_distance,
  keyword_rank,
  -- 指数関数的重み付け
  CASE 
    WHEN vector_distance IS NULL THEN 1.0
    ELSE POWER(vector_distance, 2)  -- 二乗して差を強調
  END * 0.6 +
  CASE 
    WHEN keyword_rank IS NULL THEN 0.0
    ELSE POWER(1.0 - keyword_rank, 2)  -- 二乗して差を強調
  END * 0.4 AS combined_score
FROM 
  combined_results
ORDER BY 
  combined_score
LIMIT 10;
```

### 4.2 シグモイド関数による重み付け

シグモイド関数を使用して、スコアを非線形に変換する方法です：

```sql
-- シグモイド関数による重み付けハイブリッド検索
WITH vector_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance
  FROM 
    long_term.knowledge_items k
  JOIN 
    long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
  ORDER BY 
    vector_distance
  LIMIT 100
),

keyword_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) AS keyword_rank
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.content_tsv @@ to_tsquery('english', 'neural & network')
  ORDER BY 
    keyword_rank DESC
  LIMIT 100
),

-- 両方の結果を結合
combined_results AS (
  SELECT 
    COALESCE(vr.id, kr.id) AS id,
    COALESCE(vr.name, kr.name) AS name,
    COALESCE(vr.content, kr.content) AS content,
    vr.vector_distance,
    kr.keyword_rank
  FROM 
    vector_results vr
  FULL OUTER JOIN 
    keyword_results kr ON vr.id = kr.id
)

-- シグモイド関数による重み付けランキング
SELECT 
  id,
  name,
  content,
  vector_distance,
  keyword_rank,
  -- シグモイド関数による重み付け
  CASE 
    WHEN vector_distance IS NULL THEN 0.5
    ELSE 1.0 / (1.0 + exp(10 * (vector_distance - 0.5)))  -- シグモイド関数
  END * 0.6 +
  CASE 
    WHEN keyword_rank IS NULL THEN 0.0
    ELSE 1.0 / (1.0 + exp(-10 * (keyword_rank - 0.5)))  -- シグモイド関数
  END * 0.4 AS combined_score
FROM 
  combined_results
ORDER BY 
  combined_score DESC  -- 大きいほど良いスコアに変換されているので降順
LIMIT 10;
```

## 5. コンテキスト適応型重み付け

### 5.1 クエリタイプに基づく重み付け

クエリの特性（キーワード数、自然言語の度合いなど）に基づいて重みを調整する方法です：

```sql
-- クエリタイプに基づく重み付けハイブリッド検索
WITH query_analysis AS (
  SELECT 
    'neural network training techniques' AS original_query,
    array_length(string_to_array('neural network training techniques', ' '), 1) AS word_count,
    -- 自然言語クエリの特徴を検出（例：疑問詞の存在）
    CASE WHEN 'neural network training techniques' ~* '^(what|how|why|when|where|who|which)' THEN true ELSE false END AS is_natural_language
),

vector_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance
  FROM 
    long_term.knowledge_items k
  JOIN 
    long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
  ORDER BY 
    vector_distance
  LIMIT 100
),

keyword_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network & training & techniques')) AS keyword_rank
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.content_tsv @@ to_tsquery('english', 'neural & network & training & techniques')
  ORDER BY 
    keyword_rank DESC
  LIMIT 100
),

-- 両方の結果を結合
combined_results AS (
  SELECT 
    COALESCE(vr.id, kr.id) AS id,
    COALESCE(vr.name, kr.name) AS name,
    COALESCE(vr.content, kr.content) AS content,
    vr.vector_distance,
    kr.keyword_rank
  FROM 
    vector_results vr
  FULL OUTER JOIN 
    keyword_results kr ON vr.id = kr.id
)

-- クエリタイプに基づく重み付けランキング
SELECT 
  cr.id,
  cr.name,
  cr.content,
  cr.vector_distance,
  cr.keyword_rank,
  -- クエリタイプに基づく動的な重み付け
  CASE 
    WHEN cr.vector_distance IS NULL THEN 1.0
    ELSE cr.vector_distance 
  END * 
  CASE 
    WHEN qa.is_natural_language THEN 0.8  -- 自然言語クエリの場合はベクトル検索を重視
    WHEN qa.word_count > 3 THEN 0.6  -- 単語数が多い場合はベクトル検索をやや重視
    ELSE 0.4  -- それ以外の場合はキーワード検索をやや重視
  END +
  CASE 
    WHEN cr.keyword_rank IS NULL THEN 0.0
    ELSE (1.0 - cr.keyword_rank)
  END * 
  CASE 
    WHEN qa.is_natural_language THEN 0.2  -- 自然言語クエリの場合はキーワード検索の重みを下げる
    WHEN qa.word_count > 3 THEN 0.4  -- 単語数が多い場合はキーワード検索の重みをやや下げる
    ELSE 0.6  -- それ以外の場合はキーワード検索の重みをやや上げる
  END AS combined_score
FROM 
  combined_results cr,
  query_analysis qa
ORDER BY 
  combined_score
LIMIT 10;
```

### 5.2 ユーザープロファイルに基づく重み付け

ユーザーの検索履歴や嗜好に基づいて重みを調整する方法です：

```sql
-- ユーザープロファイルに基づく重み付けハイブリッド検索
WITH user_profile AS (
  SELECT 
    'user_123' AS user_id,
    0.7 AS vector_preference,  -- ユーザーのベクトル検索への嗜好度
    0.3 AS keyword_preference  -- ユーザーのキーワード検索への嗜好度
),

vector_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance
  FROM 
    long_term.knowledge_items k
  JOIN 
    long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
  ORDER BY 
    vector_distance
  LIMIT 100
),

keyword_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) AS keyword_rank
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.content_tsv @@ to_tsquery('english', 'neural & network')
  ORDER BY 
    keyword_rank DESC
  LIMIT 100
),

-- 両方の結果を結合
combined_results AS (
  SELECT 
    COALESCE(vr.id, kr.id) AS id,
    COALESCE(vr.name, kr.name) AS name,
    COALESCE(vr.content, kr.content) AS content,
    vr.vector_distance,
    kr.keyword_rank
  FROM 
    vector_results vr
  FULL OUTER JOIN 
    keyword_results kr ON vr.id = kr.id
)

-- ユーザープロファイルに基づく重み付けランキング
SELECT 
  cr.id,
  cr.name,
  cr.content,
  cr.vector_distance,
  cr.keyword_rank,
  -- ユーザープロファイルに基づく重み付け
  CASE 
    WHEN cr.vector_distance IS NULL THEN 1.0
    ELSE cr.vector_distance 
  END * up.vector_preference +
  CASE 
    WHEN cr.keyword_rank IS NULL THEN 0.0
    ELSE (1.0 - cr.keyword_rank)
  END * up.keyword_preference AS combined_score
FROM 
  combined_results cr,
  user_profile up
ORDER BY 
  combined_score
LIMIT 10;
```

## 6. 多段階重み付けハイブリッド検索

### 6.1 二段階重み付け

まず基本的な重み付けを行い、その後メタデータに基づいて再重み付けする方法です：

```sql
-- 二段階重み付けハイブリッド検索
WITH vector_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    k.metadata,
    k.importance,
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance
  FROM 
    long_term.knowledge_items k
  JOIN 
    long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
  ORDER BY 
    vector_distance
  LIMIT 100
),

keyword_results AS (
  SELECT 
    k.id,
    k.name,
    k.content,
    k.metadata,
    k.importance,
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) AS keyword_rank
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.content_tsv @@ to_tsquery('english', 'neural & network')
  ORDER BY 
    keyword_rank DESC
  LIMIT 100
),

-- 第一段階：基本的な重み付け
first_stage_results AS (
  SELECT 
    COALESCE(vr.id, kr.id) AS id,
    COALESCE(vr.name, kr.name) AS name,
    COALESCE(vr.content, kr.content) AS content,
    COALESCE(vr.metadata, kr.metadata) AS metadata,
    COALESCE(vr.importance, kr.importance) AS importance,
    vr.vector_distance,
    kr.keyword_rank,
    -- 基本的な重み付け
    CASE 
      WHEN vr.vector_distance IS NULL THEN 1.0
      ELSE vr.vector_distance 
    END * 0.6 +
    CASE 
      WHEN kr.keyword_rank IS NULL THEN 0.0
      ELSE (1.0 - kr.keyword_rank)
    END * 0.4 AS first_stage_score
  FROM 
    vector_results vr
  FULL OUTER JOIN 
    keyword_results kr ON vr.id = kr.id
)

-- 第二段階：メタデータに基づく再重み付け
SELECT 
  id,
  name,
  content,
  vector_distance,
  keyword_rank,
  first_stage_score,
  -- メタデータに基づく再重み付け
  first_stage_score * 
  CASE 
    WHEN metadata @> '{"tags": ["important"]}'::jsonb THEN 0.8  -- 重要タグがある場合
    ELSE 1.0
  END *
  CASE 
    WHEN importance >= 0.8 THEN 0.8  -- 重要度が高い場合
    WHEN importance >= 0.5 THEN 0.9  -- 重要度が中程度の場合
    ELSE 1.0  -- 重要度が低い場合
  END AS final_score
FROM 
  first_stage_results
ORDER BY 
  final_score
LIMIT 10;
```

## 7. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索の重み付け手法について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（段階的手法）](./memory-system-postgresql-vector-search-query-hybrid-staged.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js実装）](./memory-system-postgresql-vector-search-query-hybrid-nodejs.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - Node.js統合](./memory-system-postgresql-vector-search-nodejs.md)
