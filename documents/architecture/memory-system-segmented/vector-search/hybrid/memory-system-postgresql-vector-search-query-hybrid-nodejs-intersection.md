---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - 交差検索）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - 交差検索）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、交差ハイブリッド検索の実装について説明します。交差ハイブリッド検索とは、ベクトル検索とキーワード検索の両方に一致する結果のみを返す手法です。

## 2. 前提条件

交差ハイブリッド検索の実装には、以下のモジュールが必要です：

- `db-config.js`：データベース接続設定
- `embedding-util.js`：埋め込み生成ユーティリティ
- `query-util.js`：クエリ前処理ユーティリティ

これらのモジュールの詳細については、[ハイブリッド検索（Node.js基本実装 - 設定）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-config.md)を参照してください。

## 3. 交差ハイブリッド検索の実装

交差ハイブリッド検索では、ベクトル検索とキーワード検索の両方に一致する結果のみを返します。以下に、交差ハイブリッド検索の実装を示します：

```javascript
// intersection-hybrid-search.js
const { db } = require('./db-config');
const { generateEmbedding } = require('./embedding-util');
const { preprocessQuery } = require('./query-util');

/**
 * 交差ハイブリッド検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function intersectionHybridSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,                // 最終結果の上限数
    vectorWeight: 0.5,        // ベクトル検索の重み
    keywordWeight: 0.5,       // キーワード検索の重み
    intermediateLimit: 100,   // 中間結果の上限数
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
    
    // tsqueryが空の場合は通常のベクトル検索を実行
    if (!processedQuery.tsquery) {
      return db.any(
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
        [queryEmbedding, mergedOptions.limit]
      );
    }
    
    // 交差ハイブリッド検索（両方の検索結果の共通部分のみを取得）
    return db.any(
      `WITH vector_results AS (
        SELECT 
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
        LIMIT $2
      ),
      
      keyword_results AS (
        SELECT 
          k.${mergedOptions.idColumn},
          k.${mergedOptions.nameColumn},
          k.${mergedOptions.contentColumn},
          ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $3)) AS keyword_rank
        FROM 
          ${mergedOptions.schema}.${mergedOptions.table} k
        WHERE 
          k.${mergedOptions.tsvColumn} @@ to_tsquery('english', $3)
        ORDER BY 
          keyword_rank DESC
        LIMIT $2
      )
      
      SELECT 
        vr.${mergedOptions.idColumn},
        vr.${mergedOptions.nameColumn},
        vr.${mergedOptions.contentColumn},
        vr.vector_distance,
        kr.keyword_rank,
        (vr.vector_distance * $4) + ((1.0 - kr.keyword_rank) * $5) AS combined_score
      FROM 
        vector_results vr
      JOIN 
        keyword_results kr ON vr.${mergedOptions.idColumn} = kr.${mergedOptions.idColumn}
      ORDER BY 
        combined_score
      LIMIT $6`,
      [
        queryEmbedding,
        mergedOptions.intermediateLimit,
        processedQuery.tsquery,
        mergedOptions.vectorWeight,
        mergedOptions.keywordWeight,
        mergedOptions.limit
      ]
    );
  } catch (error) {
    console.error('交差ハイブリッド検索エラー:', error);
    throw error;
  }
}

module.exports = { intersectionHybridSearch };
```

この実装では、以下の処理を行っています：

1. クエリの前処理とベクトル埋め込みの生成
2. tsqueryが空の場合は通常のベクトル検索を実行
3. ベクトル検索とキーワード検索の結果を共通テーブル式（CTE）として取得
4. 両方の検索結果の共通部分（交差）を取得
5. 組み合わせスコアに基づいて結果をランキング
6. 上位n件の結果を返す

### 3.1 組み合わせスコアの計算

交差ハイブリッド検索では、ベクトル検索とキーワード検索の両方のスコアを組み合わせて最終的なスコアを計算しています。組み合わせスコアは以下の式で計算されます：

```
組み合わせスコア = (ベクトル距離 * ベクトル重み) + ((1.0 - キーワードランク) * キーワード重み)
```

ここで、ベクトル距離は小さいほど良く、キーワードランクは大きいほど良いため、キーワードランクを1.0から引くことで、小さいほど良いスコアに変換しています。

## 4. 交差ハイブリッド検索の最適化

交差ハイブリッド検索は、両方の検索に一致する結果のみを返すため、結果の精度が高くなる傾向がありますが、検索結果の数が少なくなる可能性もあります。以下に、交差ハイブリッド検索を最適化するための方法を示します：

### 4.1 SQLの最適化

交差ハイブリッド検索のSQLクエリを最適化するには、以下の方法があります：

```javascript
// optimized-intersection-hybrid-search.js
async function optimizedIntersectionHybridSearch(query, options = {}) {
  // デフォルトオプションは同じ
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    // クエリの前処理とベクトル埋め込みの生成
    const processedQuery = preprocessQuery(query);
    const queryEmbedding = await generateEmbedding(query);
    
    // tsqueryが空の場合は通常のベクトル検索を実行
    if (!processedQuery.tsquery) {
      // 通常のベクトル検索を実行（省略）
    }
    
    // 最適化された交差ハイブリッド検索
    // 1. まずキーワード検索を実行（通常、キーワード検索の方が高速）
    // 2. キーワード検索の結果に対してベクトル検索を実行
    return db.any(
      `WITH keyword_results AS (
        SELECT 
          k.${mergedOptions.idColumn}
        FROM 
          ${mergedOptions.schema}.${mergedOptions.table} k
        WHERE 
          k.${mergedOptions.tsvColumn} @@ to_tsquery('english', $1)
        LIMIT $2
      )
      
      SELECT 
        k.${mergedOptions.idColumn},
        k.${mergedOptions.nameColumn},
        k.${mergedOptions.contentColumn},
        kv.${mergedOptions.embeddingColumn} <=> $3 AS vector_distance,
        ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $1)) AS keyword_rank,
        (kv.${mergedOptions.embeddingColumn} <=> $3) * $4 + 
        (1.0 - ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $1))) * $5 AS combined_score
      FROM 
        keyword_results kr
      JOIN 
        ${mergedOptions.schema}.${mergedOptions.table} k ON k.${mergedOptions.idColumn} = kr.${mergedOptions.idColumn}
      JOIN 
        ${mergedOptions.schema}.${mergedOptions.vectorTable} kv ON kv.${mergedOptions.vectorIdColumn} = k.${mergedOptions.idColumn}
      ORDER BY 
        combined_score
      LIMIT $6`,
      [
        processedQuery.tsquery,
        mergedOptions.intermediateLimit,
        queryEmbedding,
        mergedOptions.vectorWeight,
        mergedOptions.keywordWeight,
        mergedOptions.limit
      ]
    );
  } catch (error) {
    console.error('最適化された交差ハイブリッド検索エラー:', error);
    throw error;
  }
}
```

この最適化では、以下の変更を行っています：

1. まずキーワード検索を実行し、その結果のIDのみを取得（通常、キーワード検索の方が高速）
2. キーワード検索の結果に対してベクトル検索を実行
3. 1つのクエリで両方のスコアを計算し、結果をランキング

### 4.2 フォールバック戦略

交差ハイブリッド検索では、両方の検索に一致する結果がない場合、結果が得られない可能性があります。このような場合に備えて、フォールバック戦略を実装することが重要です：

```javascript
// fallback-intersection-hybrid-search.js
async function fallbackIntersectionHybridSearch(query, options = {}) {
  // デフォルトオプションは同じ
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    // クエリの前処理とベクトル埋め込みの生成
    const processedQuery = preprocessQuery(query);
    const queryEmbedding = await generateEmbedding(query);
    
    // 交差ハイブリッド検索を実行
    const intersectionResults = await intersectionHybridSearch(query, options);
    
    // 結果が十分にある場合はそのまま返す
    if (intersectionResults.length >= mergedOptions.limit) {
      return intersectionResults;
    }
    
    // 結果が不十分な場合は並列ハイブリッド検索にフォールバック
    console.log(`交差ハイブリッド検索の結果が不十分です（${intersectionResults.length}件）。並列ハイブリッド検索にフォールバックします。`);
    
    // 並列ハイブリッド検索を実行（parallelHybridSearch関数は別途実装が必要）
    const parallelResults = await parallelHybridSearch(query, options);
    
    return parallelResults;
  } catch (error) {
    console.error('フォールバック交差ハイブリッド検索エラー:', error);
    throw error;
  }
}
```

このフォールバック戦略では、交差ハイブリッド検索の結果が不十分な場合に、並列ハイブリッド検索にフォールバックしています。

## 5. 使用例

以下の例では、交差ハイブリッド検索を使用して検索を実行する方法を示します：

```javascript
// example.js
const { intersectionHybridSearch } = require('./intersection-hybrid-search');

async function example() {
  try {
    // 交差ハイブリッド検索の実行
    const results = await intersectionHybridSearch('ニューラルネットワークの学習方法について教えて');
    
    // 結果の表示
    console.log(`検索結果: ${results.length}件`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.name}`);
      console.log(`  ベクトル距離: ${result.vector_distance}`);
      console.log(`  キーワードランク: ${result.keyword_rank}`);
      console.log(`  組み合わせスコア: ${result.combined_score}`);
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

交差ハイブリッド検索では、様々なオプションをカスタマイズすることができます：

```javascript
// custom-example.js
const { intersectionHybridSearch } = require('./intersection-hybrid-search');

async function customExample() {
  try {
    // カスタムオプションを指定した交差ハイブリッド検索
    const results = await intersectionHybridSearch('機械学習アルゴリズムの比較', {
      limit: 5,                // 最終結果を5件に制限
      vectorWeight: 0.3,       // ベクトル検索の重みを減少
      keywordWeight: 0.7,      // キーワード検索の重みを増加
      intermediateLimit: 200,  // 中間結果を200件に増加
      schema: 'long_term',     // 検索対象スキーマ
      table: 'knowledge_items' // 検索対象テーブル
    });
    
    // 結果の表示
    console.log(`検索結果: ${results.length}件`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.name} (スコア: ${result.combined_score.toFixed(4)})`);
    });
  } catch (error) {
    console.error('エラー:', error);
  }
}

customExample();
```

## 6. パフォーマンスに関する考慮事項

交差ハイブリッド検索は、両方の検索に一致する結果のみを返すため、結果の精度が高くなる傾向がありますが、以下の点に注意する必要があります：

1. **中間結果の上限**：`intermediateLimit`は、中間結果の上限を指定します。この値が小さすぎると、交差結果が少なくなる可能性があります。

2. **検索結果の数**：両方の検索に一致する結果がない場合、結果が得られない可能性があります。フォールバック戦略を実装することが重要です。

3. **インデックスの最適化**：ベクトル検索とキーワード検索の両方のパフォーマンスを最適化するために、適切なインデックスを作成する必要があります。

## 7. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、交差ハイブリッド検索の実装について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - フィルタリング検索）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-filtering.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - キーワードファースト）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-keyword-first.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - ベクトルファースト）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-vector-first.md)
