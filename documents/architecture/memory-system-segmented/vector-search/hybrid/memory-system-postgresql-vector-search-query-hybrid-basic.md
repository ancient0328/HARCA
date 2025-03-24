---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（基本）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（基本）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索の基本概念について説明します。ハイブリッド検索とは、ベクトル検索（意味的類似性）とキーワード検索（テキスト一致）を組み合わせることで、より精度の高い検索結果を得るための手法です。

## 2. ハイブリッド検索の基本概念

### 2.1 ベクトル検索とキーワード検索の比較

| 検索タイプ | 長所 | 短所 | 適したユースケース |
|----------|------|------|-----------------|
| **ベクトル検索** | ・意味的類似性を捉えられる<br>・類義語や関連概念を検出できる<br>・言語の文脈を理解できる | ・計算コストが高い<br>・特定のキーワードの完全一致に弱い<br>・埋め込みモデルの品質に依存 | ・意味ベースの検索<br>・類似ドキュメントの検索<br>・自然言語クエリ |
| **キーワード検索** | ・正確なキーワード一致に強い<br>・計算効率が良い<br>・実装が容易 | ・意味的関連性を捉えられない<br>・同義語や関連語を検出できない<br>・文脈を理解できない | ・特定のキーワード検索<br>・タグベースの検索<br>・構造化データの検索 |

### 2.2 ハイブリッド検索の利点

ハイブリッド検索には以下の利点があります：

1. **精度と再現率の向上**: 意味的類似性と正確なキーワード一致の両方を活用
2. **多様な検索ニーズへの対応**: ユーザーの異なる検索意図に対応可能
3. **検索結果の説明可能性**: キーワード一致は検索結果の説明に役立つ
4. **ロバスト性の向上**: 一方の検索方法が失敗しても他方がバックアップとして機能

### 2.3 ハイブリッド検索の基本アーキテクチャ

HARCA記憶システムでは、以下のようなハイブリッド検索アーキテクチャを採用しています：

```
[検索クエリ] → [クエリ分析]
                   ↓
     ┌─────────────┴─────────────┐
     ↓                           ↓
[ベクトル検索]                [キーワード検索]
     ↓                           ↓
     └─────────────┬─────────────┘
                   ↓
             [結果の統合]
                   ↓
             [結果のランキング]
                   ↓
             [最終検索結果]
```

## 3. 基本的なハイブリッド検索パターン

### 3.1 並列ハイブリッド検索

最も基本的なアプローチは、ベクトル検索とキーワード検索を並列に実行し、結果を統合する方法です：

```sql
-- ベクトル検索
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
  LIMIT 50
),

-- キーワード検索
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
  LIMIT 50
)

-- 結果の統合（和集合）
SELECT 
  id, 
  name, 
  content,
  vector_distance,
  NULL AS keyword_rank,
  'vector' AS source
FROM 
  vector_results
WHERE 
  id NOT IN (SELECT id FROM keyword_results)

UNION ALL

SELECT 
  id, 
  name, 
  content,
  NULL AS vector_distance,
  keyword_rank,
  'keyword' AS source
FROM 
  keyword_results
WHERE 
  id NOT IN (SELECT id FROM vector_results)

UNION ALL

SELECT 
  vr.id, 
  vr.name, 
  vr.content,
  vr.vector_distance,
  kr.keyword_rank,
  'both' AS source
FROM 
  vector_results vr
JOIN 
  keyword_results kr ON vr.id = kr.id

ORDER BY 
  CASE 
    WHEN source = 'both' THEN 1
    WHEN source = 'vector' THEN 2
    WHEN source = 'keyword' THEN 3
  END,
  vector_distance,
  keyword_rank DESC
LIMIT 10;
```

### 3.2 交差ハイブリッド検索

ベクトル検索とキーワード検索の結果の交差部分のみを取得する方法です：

```sql
-- ベクトル検索
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

-- キーワード検索
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
)

-- 結果の統合（積集合）
SELECT 
  vr.id, 
  vr.name, 
  vr.content,
  vr.vector_distance,
  kr.keyword_rank
FROM 
  vector_results vr
JOIN 
  keyword_results kr ON vr.id = kr.id
ORDER BY 
  (vr.vector_distance * 0.5) + ((1.0 - kr.keyword_rank) * 0.5)  -- 両方のスコアを組み合わせる
LIMIT 10;
```

### 3.3 フィルタリングハイブリッド検索

一方の検索結果を使用して他方の検索結果をフィルタリングする方法です：

```sql
-- キーワード検索でフィルタリングしたベクトル検索
WITH keyword_filtered_ids AS (
  SELECT 
    k.id
  FROM 
    long_term.knowledge_items k
  WHERE 
    k.content_tsv @@ to_tsquery('english', 'neural & network')
)

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

または逆に：

```sql
-- ベクトル検索でフィルタリングしたキーワード検索
WITH vector_filtered_ids AS (
  SELECT 
    k.id
  FROM 
    long_term.knowledge_items k
  JOIN 
    long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
  WHERE 
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector < 0.3  -- 距離閾値
)

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

## 4. テキスト検索インデックスの設定

### 4.1 全文検索用のtsvectorカラムの追加

```sql
-- tsvectorカラムの追加
ALTER TABLE long_term.knowledge_items 
ADD COLUMN content_tsv tsvector;

-- 既存のデータに対してtsvectorを生成
UPDATE long_term.knowledge_items 
SET content_tsv = to_tsvector('english', name || ' ' || content);

-- トリガーの作成（新規データや更新時に自動的にtsvectorを生成）
CREATE OR REPLACE FUNCTION long_term.knowledge_items_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv := to_tsvector('english', NEW.name || ' ' || NEW.content);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_items_tsv_update
BEFORE INSERT OR UPDATE ON long_term.knowledge_items
FOR EACH ROW EXECUTE FUNCTION long_term.knowledge_items_tsv_trigger();
```

### 4.2 全文検索用のインデックスの作成

```sql
-- GINインデックスの作成（高速な全文検索用）
CREATE INDEX idx_knowledge_items_content_tsv 
ON long_term.knowledge_items USING GIN (content_tsv);
```

### 4.3 カスタム辞書と設定の作成

より高度な全文検索のために、カスタム辞書や設定を作成することもできます：

```sql
-- カスタム全文検索設定の作成
CREATE TEXT SEARCH CONFIGURATION harca_config (COPY = english);

-- シノニム辞書の作成
CREATE TEXT SEARCH DICTIONARY harca_synonyms (
  TEMPLATE = synonym,
  SYNONYMS = harca_synonyms
);

-- シノニムファイルの内容例（$SHAREDIR/tsearch_data/harca_synonyms.syn）:
-- AI, artificial intelligence
-- ML, machine learning
-- NLP, natural language processing

-- カスタム設定にシノニム辞書を追加
ALTER TEXT SEARCH CONFIGURATION harca_config
ALTER MAPPING FOR asciiword, asciihword, hword, hword_part, word
WITH harca_synonyms, english_stem;

-- カスタム設定を使用したtsvectorの生成
UPDATE long_term.knowledge_items 
SET content_tsv = to_tsvector('harca_config', name || ' ' || content);
```

## 5. 基本的なハイブリッド検索の実装例

### 5.1 単純な重み付けハイブリッド検索

```sql
-- 単純な重み付けハイブリッド検索
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
)

-- 結果の統合と重み付け
SELECT 
  COALESCE(vr.id, kr.id) AS id,
  COALESCE(vr.name, kr.name) AS name,
  COALESCE(vr.content, kr.content) AS content,
  COALESCE(vr.vector_distance, 1.0) AS vector_distance,
  COALESCE(kr.keyword_rank, 0.0) AS keyword_rank,
  -- 組み合わせスコア（ベクトル距離は小さいほど良い、キーワードランクは大きいほど良い）
  (COALESCE(vr.vector_distance, 1.0) * 0.6) + ((1.0 - COALESCE(kr.keyword_rank, 0.0)) * 0.4) AS combined_score
FROM 
  vector_results vr
FULL OUTER JOIN 
  keyword_results kr ON vr.id = kr.id
ORDER BY 
  combined_score
LIMIT 10;
```

### 5.2 閾値ベースのハイブリッド検索

```sql
-- 閾値ベースのハイブリッド検索
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
  WHERE
    kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector < 0.3  -- ベクトル距離の閾値
  ORDER BY 
    vector_distance
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
    k.content_tsv @@ to_tsquery('english', 'neural & network') AND
    ts_rank(k.content_tsv, to_tsquery('english', 'neural & network')) > 0.3  -- キーワードランクの閾値
  ORDER BY 
    keyword_rank DESC
)

-- 結果の統合（和集合）
SELECT id, name, content, vector_distance, NULL AS keyword_rank, 'vector' AS source
FROM vector_results
WHERE id NOT IN (SELECT id FROM keyword_results)

UNION ALL

SELECT id, name, content, NULL AS vector_distance, keyword_rank, 'keyword' AS source
FROM keyword_results
WHERE id NOT IN (SELECT id FROM vector_results)

UNION ALL

SELECT vr.id, vr.name, vr.content, vr.vector_distance, kr.keyword_rank, 'both' AS source
FROM vector_results vr
JOIN keyword_results kr ON vr.id = kr.id

ORDER BY 
  CASE 
    WHEN source = 'both' THEN 1
    WHEN source = 'vector' THEN 2
    WHEN source = 'keyword' THEN 3
  END,
  vector_distance,
  keyword_rank DESC
LIMIT 10;
```

## 6. Node.jsでの基本的なハイブリッド検索の実装

### 6.1 並列ハイブリッド検索の実装

```javascript
// 並列ハイブリッド検索の実装
async function parallelHybridSearch(queryText, queryEmbedding, limit = 10) {
  // クエリテキストからtsqueryを生成
  const tsquery = queryText
    .split(' ')
    .filter(word => word.length > 0)
    .join(' & ');
  
  // 並列にベクトル検索とキーワード検索を実行
  const [vectorResults, keywordResults] = await Promise.all([
    // ベクトル検索
    db.any(
      'SELECT ' +
      '  k.id, ' +
      '  k.name, ' +
      '  k.content, ' +
      '  kv.embedding <=> $1 AS vector_distance ' +
      'FROM ' +
      '  long_term.knowledge_items k ' +
      'JOIN ' +
      '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
      'ORDER BY ' +
      '  vector_distance ' +
      'LIMIT 50',
      [queryEmbedding]
    ),
    
    // キーワード検索
    db.any(
      'SELECT ' +
      '  k.id, ' +
      '  k.name, ' +
      '  k.content, ' +
      '  ts_rank(k.content_tsv, to_tsquery(\'english\', $1)) AS keyword_rank ' +
      'FROM ' +
      '  long_term.knowledge_items k ' +
      'WHERE ' +
      '  k.content_tsv @@ to_tsquery(\'english\', $1) ' +
      'ORDER BY ' +
      '  keyword_rank DESC ' +
      'LIMIT 50',
      [tsquery]
    )
  ]);
  
  // 結果をマージして重複を排除
  const resultMap = new Map();
  
  // ベクトル検索結果の追加
  vectorResults.forEach(item => {
    resultMap.set(item.id, {
      ...item,
      keyword_rank: null,
      source: 'vector'
    });
  });
  
  // キーワード検索結果の追加
  keywordResults.forEach(item => {
    if (resultMap.has(item.id)) {
      // 両方の検索で見つかった場合
      const existingItem = resultMap.get(item.id);
      resultMap.set(item.id, {
        ...existingItem,
        keyword_rank: item.keyword_rank,
        source: 'both'
      });
    } else {
      // キーワード検索のみで見つかった場合
      resultMap.set(item.id, {
        ...item,
        vector_distance: null,
        source: 'keyword'
      });
    }
  });
  
  // 結果の配列に変換してソート
  const results = Array.from(resultMap.values());
  
  // ソート: 両方 > ベクトル > キーワード、その後それぞれのスコアでソート
  results.sort((a, b) => {
    // まず検索ソースでソート
    const sourceOrder = { both: 1, vector: 2, keyword: 3 };
    if (sourceOrder[a.source] !== sourceOrder[b.source]) {
      return sourceOrder[a.source] - sourceOrder[b.source];
    }
    
    // 次にベクトル距離でソート（小さいほど良い）
    if (a.vector_distance !== null && b.vector_distance !== null) {
      return a.vector_distance - b.vector_distance;
    }
    
    // 最後にキーワードランクでソート（大きいほど良い）
    if (a.keyword_rank !== null && b.keyword_rank !== null) {
      return b.keyword_rank - a.keyword_rank;
    }
    
    return 0;
  });
  
  // 上位n件を返す
  return results.slice(0, limit);
}
```

### 6.2 フィルタリングハイブリッド検索の実装

```javascript
// キーワードでフィルタリングしたベクトル検索
async function keywordFilteredVectorSearch(queryText, queryEmbedding, limit = 10) {
  // クエリテキストからtsqueryを生成
  const tsquery = queryText
    .split(' ')
    .filter(word => word.length > 0)
    .join(' & ');
  
  return db.any(
    'WITH keyword_filtered_ids AS (' +
    '  SELECT ' +
    '    k.id ' +
    '  FROM ' +
    '    long_term.knowledge_items k ' +
    '  WHERE ' +
    '    k.content_tsv @@ to_tsquery(\'english\', $1) ' +
    ') ' +
    'SELECT ' +
    '  k.id, ' +
    '  k.name, ' +
    '  k.content, ' +
    '  kv.embedding <=> $2 AS distance ' +
    'FROM ' +
    '  keyword_filtered_ids kfi ' +
    'JOIN ' +
    '  long_term.knowledge_items k ON k.id = kfi.id ' +
    'JOIN ' +
    '  long_term.knowledge_vectors kv ON kv.knowledge_id = k.id ' +
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $3',
    [tsquery, queryEmbedding, limit]
  );
}
```

## 7. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索の基本概念について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（高度な手法）](./memory-system-postgresql-vector-search-query-hybrid-advanced.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（実装）](./memory-system-postgresql-vector-search-query-hybrid-implementation.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - Node.js統合](./memory-system-postgresql-vector-search-nodejs.md)
