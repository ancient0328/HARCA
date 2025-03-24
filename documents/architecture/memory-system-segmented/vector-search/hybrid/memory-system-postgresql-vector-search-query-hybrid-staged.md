---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（段階的手法）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（段階的手法）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索の段階的手法について説明します。段階的ハイブリッド検索とは、複数の検索手法を順次適用することで、検索精度と効率を両立させる手法です。

## 2. 段階的ハイブリッド検索の基本概念

### 2.1 段階的検索の目的

段階的ハイブリッド検索の主な目的は以下の通りです：

1. **計算効率の向上**: 初期段階で検索範囲を絞り込むことで、計算コストを削減
2. **精度と再現率のバランス**: 異なる検索手法の長所を活かしながら短所を補完
3. **スケーラビリティの向上**: 大規模データセットに対しても効率的に検索を実行
4. **検索パイプラインの柔軟性**: 様々な検索手法を組み合わせて最適な検索パイプラインを構築

### 2.2 段階的検索の基本アーキテクチャ

HARCA記憶システムでは、以下のような段階的ハイブリッド検索アーキテクチャを採用しています：

```
[検索クエリ] → [クエリ分析]
                   ↓
             [初期フィルタリング]
                   ↓
             [第一段階検索]
                   ↓
             [中間結果フィルタリング]
                   ↓
             [第二段階検索]
                   ↓
             [最終結果ランキング]
                   ↓
             [最終検索結果]
```

## 3. キーワードファーストハイブリッド検索

### 3.1 キーワード検索による初期フィルタリング

まずキーワード検索を実行して候補を絞り込み、その後ベクトル検索を適用する方法です：

```sql
-- キーワード検索による初期フィルタリング
WITH keyword_filtered_ids AS (
  SELECT 
    k.id
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.content_tsv @@ to_tsquery('english', 'neural & network')
  ORDER BY 
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) DESC
  LIMIT 1000  -- 初期フィルタリングで上位1000件を選択
)

-- フィルタリングされた候補に対してベクトル検索を実行
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  keyword_filtered_ids kfi
JOIN 
  long_term.knowledge_items k ON k.id = kfi.id
JOIN 
  long_term.knowledge_vectors kv ON kv.knowledge_id = k.id
ORDER BY 
  distance
LIMIT 10;
```

### 3.2 キーワード検索結果の再ランキング

キーワード検索の結果をベクトル検索で再ランキングする方法です：

```sql
-- キーワード検索結果のベクトル再ランキング
WITH keyword_results AS (
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
  LIMIT 100  -- 上位100件のキーワード検索結果
)

-- キーワード検索結果をベクトル距離で再ランキング
SELECT 
  kr.id,
  kr.name,
  kr.content,
  kr.keyword_rank,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance,
  -- 組み合わせスコア（キーワードランクとベクトル距離の重み付け）
  (1.0 - kr.keyword_rank) * 0.3 + (kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector) * 0.7 AS combined_score
FROM 
  keyword_results kr
JOIN 
  long_term.knowledge_vectors kv ON kv.knowledge_id = kr.id
ORDER BY 
  combined_score
LIMIT 10;
```

## 4. ベクトルファーストハイブリッド検索

### 4.1 ベクトル検索による初期フィルタリング

まずベクトル検索を実行して候補を絞り込み、その後キーワード検索を適用する方法です：

```sql
-- ベクトル検索による初期フィルタリング
WITH vector_filtered_ids AS (
  SELECT 
    k.id
  FROM 
    long_term.knowledge_items k
  JOIN 
    long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
  WHERE 
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector < 0.3  -- ベクトル距離の閾値
  ORDER BY 
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector
  LIMIT 1000  -- 初期フィルタリングで上位1000件を選択
)

-- フィルタリングされた候補に対してキーワード検索を実行
SELECT 
  k.id,
  k.name,
  k.content,
  ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) AS rank
FROM 
  vector_filtered_ids vfi
JOIN 
  long_term.knowledge_items k ON k.id = vfi.id
WHERE 
  k.content_tsv @@ to_tsquery('english', 'neural & network')
ORDER BY 
  rank DESC
LIMIT 10;
```

### 4.2 ベクトル検索結果の再ランキング

ベクトル検索の結果をキーワード検索で再ランキングする方法です：

```sql
-- ベクトル検索結果のキーワード再ランキング
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
  LIMIT 100  -- 上位100件のベクトル検索結果
)

-- ベクトル検索結果をキーワードランクで再ランキング
SELECT 
  vr.id,
  vr.name,
  vr.content,
  vr.vector_distance,
  CASE 
    WHEN k.content_tsv @@ to_tsquery('english', 'neural & network') THEN
      ts_rank(k.content_tsv, to_tsquery('english', 'neural & network'))
    ELSE 0
  END AS keyword_rank,
  -- 組み合わせスコア（ベクトル距離とキーワードランクの重み付け）
  vr.vector_distance * 0.7 + 
  (1.0 - CASE 
    WHEN k.content_tsv @@ to_tsquery('english', 'neural & network') THEN
      ts_rank(k.content_tsv, to_tsquery('english', 'neural & network'))
    ELSE 0
  END) * 0.3 AS combined_score
FROM 
  vector_results vr
JOIN 
  long_term.knowledge_items k ON k.id = vr.id
ORDER BY 
  combined_score
LIMIT 10;
```

## 5. 多段階フィルタリングハイブリッド検索

### 5.1 メタデータフィルタリングと段階的検索の組み合わせ

メタデータフィルタリングと段階的ハイブリッド検索を組み合わせる方法です：

```sql
-- メタデータフィルタリングと段階的ハイブリッド検索
WITH metadata_filtered_ids AS (
  -- メタデータによる初期フィルタリング
  SELECT 
    k.id
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.metadata @> '{"category": "machine_learning"}'::jsonb AND
    k.created_at > '2024-01-01'::timestamp
),

keyword_filtered_ids AS (
  -- メタデータでフィルタリングされた候補に対してキーワード検索
  SELECT 
    k.id,
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) AS keyword_rank
  FROM 
    metadata_filtered_ids mfi
  JOIN 
    long_term.knowledge_items k ON k.id = mfi.id
  WHERE 
    k.content_tsv @@ to_tsquery('english', 'neural & network')
  ORDER BY 
    keyword_rank DESC
  LIMIT 500  -- 中間段階で上位500件を選択
)

-- キーワードでフィルタリングされた候補に対してベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  kfi.keyword_rank,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance,
  -- 最終スコア（キーワードランクとベクトル距離の重み付け）
  (1.0 - kfi.keyword_rank) * 0.3 + (kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector) * 0.7 AS final_score
FROM 
  keyword_filtered_ids kfi
JOIN 
  long_term.knowledge_items k ON k.id = kfi.id
JOIN 
  long_term.knowledge_vectors kv ON kv.knowledge_id = k.id
ORDER BY 
  final_score
LIMIT 10;
```

### 5.2 段階的検索と閾値フィルタリングの組み合わせ

各段階で閾値を設定して検索範囲を絞り込む方法です：

```sql
-- 段階的検索と閾値フィルタリングの組み合わせ
WITH keyword_filtered_ids AS (
  -- キーワード検索による初期フィルタリング（閾値付き）
  SELECT 
    k.id,
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) AS keyword_rank
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.content_tsv @@ to_tsquery('english', 'neural & network') AND
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) > 0.1  -- キーワードランクの閾値
  ORDER BY 
    keyword_rank DESC
  LIMIT 500
),

vector_filtered_ids AS (
  -- キーワードでフィルタリングされた候補に対してベクトル検索（閾値付き）
  SELECT 
    kfi.id,
    kfi.keyword_rank,
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance
  FROM 
    keyword_filtered_ids kfi
  JOIN 
    long_term.knowledge_vectors kv ON kv.knowledge_id = kfi.id
  WHERE 
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector < 0.4  -- ベクトル距離の閾値
  ORDER BY 
    vector_distance
  LIMIT 100
)

-- 最終結果の取得と再ランキング
SELECT 
  k.id,
  k.name,
  k.content,
  vfi.keyword_rank,
  vfi.vector_distance,
  -- 最終スコア（キーワードランクとベクトル距離の重み付け）
  (1.0 - vfi.keyword_rank) * 0.3 + vfi.vector_distance * 0.7 AS final_score
FROM 
  vector_filtered_ids vfi
JOIN 
  long_term.knowledge_items k ON k.id = vfi.id
ORDER BY 
  final_score
LIMIT 10;
```

## 6. 適応的段階的ハイブリッド検索

### 6.1 クエリ分析に基づく検索パイプラインの選択

クエリの特性に基づいて最適な検索パイプラインを選択する方法です：

```sql
-- クエリ分析に基づく検索パイプラインの選択
WITH query_analysis AS (
  SELECT 
    'neural network training techniques' AS original_query,
    array_length(string_to_array('neural network training techniques', ' '), 1) AS word_count,
    -- 自然言語クエリの特徴を検出（例：疑問詞の存在）
    CASE WHEN 'neural network training techniques' ~* '^(what|how|why|when|where|who|which)' THEN true ELSE false END AS is_natural_language
),

-- クエリ特性に基づいて検索パイプラインを選択
search_results AS (
  SELECT * FROM (
    -- 自然言語クエリの場合はベクトルファースト
    SELECT 
      k.id,
      k.name,
      k.content,
      kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance,
      CASE 
        WHEN k.content_tsv @@ to_tsquery('english', 'neural & network & training & techniques') THEN
          ts_rank(k.content_tsv, to_tsquery('english', 'neural & network & training & techniques'))
        ELSE 0
      END AS keyword_rank,
      'vector_first' AS pipeline
    FROM 
      long_term.knowledge_items k
    JOIN 
      long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
    WHERE 
      (SELECT is_natural_language FROM query_analysis) = true AND
      kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector < 0.5
    ORDER BY 
      vector_distance
    LIMIT 50
  
    UNION ALL
  
    -- 短いキーワードクエリの場合はキーワードファースト
    SELECT 
      k.id,
      k.name,
      k.content,
      kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance,
      ts_rank(k.content_tsv, to_tsquery('english', 'neural & network & training & techniques')) AS keyword_rank,
      'keyword_first' AS pipeline
    FROM 
      long_term.knowledge_items k
    JOIN 
      long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
    WHERE 
      (SELECT is_natural_language FROM query_analysis) = false AND
      (SELECT word_count FROM query_analysis) <= 3 AND
      k.content_tsv @@ to_tsquery('english', 'neural & network & training & techniques')
    ORDER BY 
      keyword_rank DESC
    LIMIT 50
  
    UNION ALL
  
    -- 長いキーワードクエリの場合は並列ハイブリッド
    SELECT 
      k.id,
      k.name,
      k.content,
      kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance,
      ts_rank(k.content_tsv, to_tsquery('english', 'neural & network & training & techniques')) AS keyword_rank,
      'parallel_hybrid' AS pipeline
    FROM 
      long_term.knowledge_items k
    JOIN 
      long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
    WHERE 
      (SELECT is_natural_language FROM query_analysis) = false AND
      (SELECT word_count FROM query_analysis) > 3 AND
      (
        k.content_tsv @@ to_tsquery('english', 'neural & network & training & techniques') OR
        kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector < 0.5
      )
    LIMIT 50
  ) AS combined_results
)

-- 最終結果のランキング
SELECT 
  id,
  name,
  content,
  vector_distance,
  keyword_rank,
  pipeline,
  -- パイプラインに応じた重み付け
  CASE 
    WHEN pipeline = 'vector_first' THEN vector_distance * 0.8 + (1.0 - keyword_rank) * 0.2
    WHEN pipeline = 'keyword_first' THEN vector_distance * 0.2 + (1.0 - keyword_rank) * 0.8
    WHEN pipeline = 'parallel_hybrid' THEN vector_distance * 0.5 + (1.0 - keyword_rank) * 0.5
  END AS final_score
FROM 
  search_results
ORDER BY 
  final_score
LIMIT 10;
```

### 6.2 検索結果の分析に基づく適応的検索

初期検索結果の分析に基づいて検索戦略を動的に調整する方法です：

```sql
-- 検索結果の分析に基づく適応的検索
WITH initial_keyword_results AS (
  -- 初期キーワード検索
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
  LIMIT 50
),

-- 初期検索結果の分析
result_analysis AS (
  SELECT 
    COUNT(*) AS result_count,
    AVG(keyword_rank) AS avg_rank,
    STDDEV(keyword_rank) AS rank_stddev
  FROM 
    initial_keyword_results
),

-- 分析結果に基づく適応的検索戦略
adaptive_search_results AS (
  -- 結果が少ない場合や分散が大きい場合はベクトル検索を重視
  SELECT 
    k.id,
    k.name,
    k.content,
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance,
    CASE 
      WHEN ikr.id IS NOT NULL THEN ikr.keyword_rank
      ELSE 0
    END AS keyword_rank,
    CASE
      WHEN (SELECT result_count FROM result_analysis) < 10 OR
           (SELECT rank_stddev FROM result_analysis) > 0.3 THEN 'vector_focused'
      ELSE 'balanced'
    END AS strategy
  FROM 
    long_term.knowledge_items k
  JOIN 
    long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
  LEFT JOIN
    initial_keyword_results ikr ON k.id = ikr.id
  WHERE 
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector < 0.5 OR
    ikr.id IS NOT NULL
  ORDER BY 
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector
  LIMIT 100
)

-- 最終結果のランキング
SELECT 
  id,
  name,
  content,
  vector_distance,
  keyword_rank,
  strategy,
  -- 戦略に応じた重み付け
  CASE 
    WHEN strategy = 'vector_focused' THEN vector_distance * 0.8 + (1.0 - keyword_rank) * 0.2
    WHEN strategy = 'balanced' THEN vector_distance * 0.5 + (1.0 - keyword_rank) * 0.5
  END AS final_score
FROM 
  adaptive_search_results
ORDER BY 
  final_score
LIMIT 10;
```

## 7. 段階的ハイブリッド検索の最適化

### 7.1 段階的検索のパフォーマンス最適化

段階的検索のパフォーマンスを最適化するためのテクニックです：

1. **中間結果の制限**: 各段階で処理する候補数を適切に制限する
2. **インデックスの活用**: 各段階で使用するインデックスを最適化する
3. **並列処理**: 可能な場合は検索処理を並列化する
4. **キャッシング**: 頻繁に実行される検索パターンの結果をキャッシュする

```sql
-- 段階的検索のパフォーマンス最適化例
WITH RECURSIVE search_stages AS (
  -- 第一段階：メタデータフィルタリング（インデックス使用）
  SELECT 
    k.id,
    1 AS stage
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.metadata @> '{"category": "machine_learning"}'::jsonb
  LIMIT 10000  -- 大量の候補を効率的に処理
  
  UNION ALL
  
  -- 第二段階：キーワード検索（前段階の結果を使用）
  SELECT 
    k.id,
    ss.stage + 1
  FROM 
    search_stages ss
  JOIN 
    long_term.knowledge_items k ON k.id = ss.id
  WHERE 
    ss.stage = 1 AND
    k.content_tsv @@ to_tsquery('english', 'neural & network')
  LIMIT 1000
  
  UNION ALL
  
  -- 第三段階：ベクトル検索（前段階の結果を使用）
  SELECT 
    kv.knowledge_id,
    ss.stage + 1
  FROM 
    search_stages ss
  JOIN 
    long_term.knowledge_vectors kv ON kv.knowledge_id = ss.id
  WHERE 
    ss.stage = 2 AND
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector < 0.5
  ORDER BY 
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector
  LIMIT 100
)

-- 最終結果の取得
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS vector_distance
FROM 
  search_stages ss
JOIN 
  long_term.knowledge_items k ON k.id = ss.id
JOIN 
  long_term.knowledge_vectors kv ON kv.knowledge_id = k.id
WHERE 
  ss.stage = 3
ORDER BY 
  vector_distance
LIMIT 10;
```

### 7.2 段階的検索の精度最適化

段階的検索の精度を最適化するためのテクニックです：

1. **段階間の結果数調整**: 各段階で適切な数の候補を次段階に渡す
2. **閾値の最適化**: 各段階で使用する閾値を適切に設定する
3. **重み付けパラメータの調整**: 最終ランキングの重み付けパラメータを最適化する
4. **フィードバックループ**: ユーザーフィードバックに基づいて検索パラメータを調整する

```sql
-- 段階的検索の精度最適化例
WITH keyword_candidates AS (
  -- 第一段階：キーワード検索（十分な数の候補を確保）
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
  LIMIT 500  -- 十分な数の候補を確保
),

vector_candidates AS (
  -- 第二段階：ベクトル検索（十分な数の候補を確保）
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
  LIMIT 500  -- 十分な数の候補を確保
),

-- 両方の候補を結合
combined_candidates AS (
  SELECT 
    kc.id,
    kc.name,
    kc.content,
    kc.keyword_rank,
    NULL::float AS vector_distance,
    'keyword' AS source
  FROM 
    keyword_candidates kc
  WHERE 
    kc.id NOT IN (SELECT id FROM vector_candidates)
  
  UNION ALL
  
  SELECT 
    vc.id,
    vc.name,
    vc.content,
    NULL::float AS keyword_rank,
    vc.vector_distance,
    'vector' AS source
  FROM 
    vector_candidates vc
  WHERE 
    vc.id NOT IN (SELECT id FROM keyword_candidates)
  
  UNION ALL
  
  SELECT 
    kc.id,
    kc.name,
    kc.content,
    kc.keyword_rank,
    vc.vector_distance,
    'both' AS source
  FROM 
    keyword_candidates kc
  JOIN 
    vector_candidates vc ON kc.id = vc.id
)

-- 最終ランキング（重み付けパラメータの最適化）
SELECT 
  id,
  name,
  content,
  keyword_rank,
  vector_distance,
  source,
  -- 最適化された重み付け
  CASE 
    WHEN source = 'both' THEN
      COALESCE(vector_distance, 1.0) * 0.65 + (1.0 - COALESCE(keyword_rank, 0.0)) * 0.35
    WHEN source = 'vector' THEN
      vector_distance * 0.9 + 0.1  -- ペナルティを追加
    WHEN source = 'keyword' THEN
      (1.0 - keyword_rank) * 0.9 + 0.1  -- ペナルティを追加
  END AS optimized_score
FROM 
  combined_candidates
ORDER BY 
  optimized_score
LIMIT 10;
```

## 8. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索の段階的手法について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js実装）](./memory-system-postgresql-vector-search-query-hybrid-nodejs.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - Node.js統合](./memory-system-postgresql-vector-search-nodejs.md)
