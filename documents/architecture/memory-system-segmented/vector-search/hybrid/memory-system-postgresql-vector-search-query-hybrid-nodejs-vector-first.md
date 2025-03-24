---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - ベクトルファースト）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - ベクトルファースト）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、ベクトルファースト段階的検索の実装について説明します。ベクトルファースト段階的検索とは、まずベクトル検索を実行し、その結果に対してキーワード検索や再ランキングを適用する手法です。

## 2. 前提条件

ベクトルファースト段階的検索の実装には、以下のモジュールが必要です：

- `db-config.js`：データベース接続設定
- `embedding-util.js`：埋め込み生成ユーティリティ
- `query-util.js`：クエリ前処理ユーティリティ

これらのモジュールの詳細については、[ハイブリッド検索（Node.js基本実装 - 設定）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-config.md)を参照してください。

## 3. ベクトルファースト段階的検索の実装

ベクトルファースト段階的検索では、まずベクトル検索を実行し、その結果に対してキーワード検索や再ランキングを適用します。以下に、ベクトルファースト段階的検索の実装を示します：

```javascript
// vector-first-search.js
const { db } = require('./db-config');
const { generateEmbedding } = require('./embedding-util');
const { preprocessQuery } = require('./query-util');

/**
 * ベクトルファースト段階的検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function vectorFirstSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,                // 最終結果の上限数
    vectorLimit: 100,         // ベクトル検索の中間結果上限
    reranking: true,          // 再ランキングを行うかどうか
    vectorWeight: 0.7,        // ベクトル検索の重み
    keywordWeight: 0.3,       // キーワード検索の重み
    schema: 'long_term',      // 検索対象スキーマ
    table: 'knowledge_items', // 検索対象テーブル
    vectorTable: 'knowledge_vectors', // ベクトルテーブル
    idColumn: 'id',           // ID列名
    contentColumn: 'content', // コンテンツ列名
    nameColumn: 'name',       // 名前列名
    vectorIdColumn: 'knowledge_id', // ベクトルテーブルのID列名
    embeddingColumn: 'embedding', // 埋め込み列名
    tsvColumn: 'content_tsv'  // tsvector列名
  };
  
  // オプションをマージ
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    // クエリの前処理
    const processedQuery = preprocessQuery(query);
    
    // クエリからベクトル埋め込みを生成
    const queryEmbedding = await generateEmbedding(query);
    
    // ステップ1: ベクトル検索を実行
    const vectorResults = await db.any(
      `SELECT 
        k.${mergedOptions.idColumn}, 
        k.${mergedOptions.nameColumn}, 
        k.${mergedOptions.contentColumn}, 
        kv.${mergedOptions.embeddingColumn} <=> $1 AS vector_distance 
      FROM 
        ${mergedOptions.schema}.${mergedOptions.table} k 
      JOIN 
        ${mergedOptions.schema}.${mergedOptions.vectorTable} kv 
        ON k.${mergedOptions.idColumn} = kv.${mergedOptions.vectorIdColumn} 
      ORDER BY 
        vector_distance 
      LIMIT $2`,
      [queryEmbedding, mergedOptions.vectorLimit]
    );
    
    // ベクトル検索結果がない場合は空の配列を返す
    if (vectorResults.length === 0) {
      return [];
    }
    
    // キーワードが抽出できない場合はベクトル検索結果をそのまま返す
    if (!processedQuery.tsquery || !mergedOptions.reranking) {
      return vectorResults.slice(0, mergedOptions.limit);
    }
    
    // ステップ2: ベクトル検索結果のIDを抽出
    const vectorResultIds = vectorResults.map(item => item[mergedOptions.idColumn]);
    
    // ステップ3: 抽出したIDに対してキーワード検索を実行
    const keywordResults = await db.any(
      `SELECT 
        k.${mergedOptions.idColumn}, 
        ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $1)) AS keyword_rank 
      FROM 
        ${mergedOptions.schema}.${mergedOptions.table} k 
      WHERE 
        k.${mergedOptions.idColumn} = ANY($2) 
        AND k.${mergedOptions.tsvColumn} @@ to_tsquery('english', $1)`,
      [processedQuery.tsquery, vectorResultIds]
    );
    
    // キーワードランクのマップを作成
    const keywordRankMap = new Map();
    keywordResults.forEach(item => {
      keywordRankMap.set(item[mergedOptions.idColumn], item.keyword_rank);
    });
    
    // ステップ4: 結果を再ランキング
    const rerankedResults = vectorResults.map(item => {
      const id = item[mergedOptions.idColumn];
      const keywordRank = keywordRankMap.has(id) ? keywordRankMap.get(id) : 0;
      
      // 組み合わせスコアを計算
      const combinedScore = 
        (item.vector_distance * mergedOptions.vectorWeight) + 
        ((1.0 - keywordRank) * mergedOptions.keywordWeight);
      
      return {
        ...item,
        keyword_rank: keywordRank,
        combined_score: combinedScore
      };
    });
    
    // 組み合わせスコアでソート
    rerankedResults.sort((a, b) => a.combined_score - b.combined_score);
    
    // 上位n件を返す
    return rerankedResults.slice(0, mergedOptions.limit);
  } catch (error) {
    console.error('ベクトルファースト段階的検索エラー:', error);
    throw error;
  }
}

module.exports = { vectorFirstSearch };
```

この実装では、以下の処理を行っています：

1. クエリの前処理とベクトル埋め込みの生成
2. ステップ1: ベクトル検索を実行
3. ベクトル検索結果がない場合は空の配列を返す
4. キーワードが抽出できない場合はベクトル検索結果をそのまま返す
5. ステップ2: ベクトル検索結果のIDを抽出
6. ステップ3: 抽出したIDに対してキーワード検索を実行
7. ステップ4: 結果を再ランキング
8. 上位n件を返す

### 3.1 再ランキングの詳細

ベクトルファースト段階的検索では、ベクトル検索とキーワード検索の両方のスコアを組み合わせて最終的なスコアを計算しています。組み合わせスコアは以下の式で計算されます：

```
組み合わせスコア = (ベクトル距離 * ベクトル重み) + ((1.0 - キーワードランク) * キーワード重み)
```

ここで、ベクトル距離は小さいほど良く、キーワードランクは大きいほど良いため、キーワードランクを1.0から引くことで、小さいほど良いスコアに変換しています。

## 4. ベクトルファースト段階的検索の最適化

ベクトルファースト段階的検索を最適化するには、以下の方法があります：

### 4.1 ベクトル検索の最適化

ベクトル検索のパフォーマンスを最適化するには、以下の方法があります：

1. **適切なインデックスの作成**：ベクトル列に対するIVFLATインデックスを作成することで、ベクトル検索のパフォーマンスを向上させることができます。

```sql
-- ベクトル列のIVFLATインデックスを作成
CREATE INDEX idx_knowledge_vectors_embedding ON long_term.knowledge_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

2. **近似検索の使用**：大規模なデータセットでは、近似検索を使用することで、検索速度を向上させることができます。

```javascript
// approximate-vector-first-search.js
async function approximateVectorFirstSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    // 他のオプションは同じ
    useApproximate: true,     // 近似検索を使用するかどうか
    probeCount: 10            // 近似検索のプローブ数
  };
  
  // オプションをマージ
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    // クエリの前処理とベクトル埋め込みの生成
    const processedQuery = preprocessQuery(query);
    const queryEmbedding = await generateEmbedding(query);
    
    // 近似検索の設定
    if (mergedOptions.useApproximate) {
      await db.none('SET ivfflat.probes = $1', [mergedOptions.probeCount]);
    }
    
    // ベクトル検索を実行
    // 実装は省略（vectorFirstSearchと同様）
  } catch (error) {
    console.error('近似ベクトルファースト段階的検索エラー:', error);
    throw error;
  } finally {
    // 近似検索の設定をリセット
    if (mergedOptions.useApproximate) {
      await db.none('SET ivfflat.probes = 1');
    }
  }
}
```

### 4.2 再ランキングの最適化

再ランキングを最適化するには、以下の方法があります：

```javascript
// optimized-reranking.js
function optimizedReranking(vectorResults, keywordRankMap, options) {
  // ベクトル距離の正規化（0-1の範囲に変換）
  const vectorDistances = vectorResults.map(item => item.vector_distance);
  const minVectorDistance = Math.min(...vectorDistances);
  const maxVectorDistance = Math.max(...vectorDistances);
  const vectorDistanceRange = maxVectorDistance - minVectorDistance;
  
  // キーワードランクの正規化（0-1の範囲に変換）
  const keywordRanks = Array.from(keywordRankMap.values());
  const minKeywordRank = Math.min(...keywordRanks, 0);
  const maxKeywordRank = Math.max(...keywordRanks, 1);
  const keywordRankRange = maxKeywordRank - minKeywordRank;
  
  // 結果を再ランキング
  const rerankedResults = vectorResults.map(item => {
    const id = item[options.idColumn];
    const keywordRank = keywordRankMap.has(id) ? keywordRankMap.get(id) : 0;
    
    // 正規化されたスコアを計算
    const normalizedVectorDistance = vectorDistanceRange > 0 
      ? (item.vector_distance - minVectorDistance) / vectorDistanceRange 
      : 0;
    
    const normalizedKeywordRank = keywordRankRange > 0 
      ? (keywordRank - minKeywordRank) / keywordRankRange 
      : 0;
    
    // 組み合わせスコアを計算
    const combinedScore = 
      (normalizedVectorDistance * options.vectorWeight) + 
      ((1.0 - normalizedKeywordRank) * options.keywordWeight);
    
    return {
      ...item,
      keyword_rank: keywordRank,
      normalized_vector_distance: normalizedVectorDistance,
      normalized_keyword_rank: normalizedKeywordRank,
      combined_score: combinedScore
    };
  });
  
  // 組み合わせスコアでソート
  rerankedResults.sort((a, b) => a.combined_score - b.combined_score);
  
  return rerankedResults;
}
```

この最適化では、ベクトル距離とキーワードランクを正規化（0-1の範囲に変換）してから、組み合わせスコアを計算しています。これにより、ベクトル距離とキーワードランクのスケールの違いによる影響を軽減することができます。

## 5. 使用例

以下の例では、ベクトルファースト段階的検索を使用して検索を実行する方法を示します：

```javascript
// example.js
const { vectorFirstSearch } = require('./vector-first-search');

async function example() {
  try {
    // ベクトルファースト段階的検索の実行
    const results = await vectorFirstSearch('ニューラルネットワークの学習方法について教えて');
    
    // 結果の表示
    console.log(`検索結果: ${results.length}件`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.name}`);
      console.log(`  ベクトル距離: ${result.vector_distance}`);
      console.log(`  キーワードランク: ${result.keyword_rank || 'N/A'}`);
      console.log(`  組み合わせスコア: ${result.combined_score || 'N/A'}`);
      console.log(`  内容: ${result.content.substring(0, 100)}...`);
      console.log('---');
    });
  } catch (error) {
    console.error('エラー:', error);
  }
}

example();
```

### 5.1 カスタムオプションの使用例

ベクトルファースト段階的検索では、様々なオプションをカスタマイズすることができます：

```javascript
// custom-example.js
const { vectorFirstSearch } = require('./vector-first-search');

async function customExample() {
  try {
    // カスタムオプションを指定したベクトルファースト段階的検索
    const results = await vectorFirstSearch('機械学習アルゴリズムの比較', {
      limit: 5,                // 最終結果を5件に制限
      vectorLimit: 200,        // ベクトル検索の中間結果を200件に増加
      reranking: true,         // 再ランキングを行う
      vectorWeight: 0.8,       // ベクトル検索の重みを増加
      keywordWeight: 0.2,      // キーワード検索の重みを減少
      schema: 'long_term',     // 検索対象スキーマ
      table: 'knowledge_items' // 検索対象テーブル
    });
    
    // 結果の表示
    console.log(`検索結果: ${results.length}件`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.name} (スコア: ${result.combined_score ? result.combined_score.toFixed(4) : 'N/A'})`);
    });
  } catch (error) {
    console.error('エラー:', error);
  }
}

customExample();
```

## 6. フィルタリングとの組み合わせ

ベクトルファースト段階的検索とフィルタリングを組み合わせることで、より精度の高い検索を実現することができます：

```javascript
// vector-first-filtered-search.js
const { db } = require('./db-config');
const { generateEmbedding } = require('./embedding-util');
const { preprocessQuery } = require('./query-util');

/**
 * フィルタリング付きベクトルファースト段階的検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} filters - メタデータフィルター
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function vectorFirstFilteredSearch(query, filters = {}, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    // 他のオプションは同じ
    typeColumn: 'type',       // タイプ列名
    metadataColumn: 'metadata' // メタデータ列名
  };
  
  // オプションをマージ
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    // クエリの前処理とベクトル埋め込みの生成
    const processedQuery = preprocessQuery(query);
    const queryEmbedding = await generateEmbedding(query);
    
    // フィルター条件の構築
    const filterConditions = [];
    const filterValues = [];
    let paramIndex = 1;
    
    // フィルターのパラメータ化
    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'type') {
        // タイプによるフィルタリング
        filterConditions.push(`k.${mergedOptions.typeColumn} = $${paramIndex}`);
        filterValues.push(value);
        paramIndex++;
      } else if (key === 'metadata' && typeof value === 'object') {
        // メタデータによるフィルタリング（JSONBフィールドを想定）
        Object.entries(value).forEach(([metaKey, metaValue]) => {
          filterConditions.push(`k.${mergedOptions.metadataColumn}->>'${metaKey}' = $${paramIndex}`);
          filterValues.push(metaValue);
          paramIndex++;
        });
      } else {
        // その他のカラムによるフィルタリング
        filterConditions.push(`k.${key} = $${paramIndex}`);
        filterValues.push(value);
        paramIndex++;
      }
    });
    
    // フィルター条件の文字列
    const filterConditionStr = filterConditions.length > 0 
      ? `AND ${filterConditions.join(' AND ')}` 
      : '';
    
    // ステップ1: フィルタリング付きベクトル検索を実行
    const vectorResults = await db.any(
      `SELECT 
        k.${mergedOptions.idColumn}, 
        k.${mergedOptions.nameColumn}, 
        k.${mergedOptions.contentColumn}, 
        kv.${mergedOptions.embeddingColumn} <=> $${paramIndex} AS vector_distance 
      FROM 
        ${mergedOptions.schema}.${mergedOptions.table} k 
      JOIN 
        ${mergedOptions.schema}.${mergedOptions.vectorTable} kv 
        ON k.${mergedOptions.idColumn} = kv.${mergedOptions.vectorIdColumn} 
      WHERE 
        1=1 ${filterConditionStr}
      ORDER BY 
        vector_distance 
      LIMIT $${paramIndex + 1}`,
      [...filterValues, queryEmbedding, mergedOptions.vectorLimit]
    );
    
    // 以下、vectorFirstSearchと同様の実装
    // 実装は省略
  } catch (error) {
    console.error('フィルタリング付きベクトルファースト段階的検索エラー:', error);
    throw error;
  }
}

module.exports = { vectorFirstFilteredSearch };
```

## 7. パフォーマンスに関する考慮事項

ベクトルファースト段階的検索のパフォーマンスを最適化するには、以下の点に注意する必要があります：

1. **ベクトル検索の中間結果上限**：`vectorLimit`は、ベクトル検索の中間結果の上限を指定します。この値が大きすぎると、キーワード検索のパフォーマンスが低下する可能性があります。

2. **インデックスの最適化**：ベクトル検索とキーワード検索の両方のパフォーマンスを最適化するために、適切なインデックスを作成する必要があります。

3. **近似検索の使用**：大規模なデータセットでは、近似検索を使用することで、検索速度を向上させることができます。

4. **再ランキングの最適化**：ベクトル距離とキーワードランクを正規化してから、組み合わせスコアを計算することで、より適切なランキングを実現することができます。

## 8. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、ベクトルファースト段階的検索の実装について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - メタデータフィルタリング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-metadata-filtering.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - 再ランキング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-reranking.md)
