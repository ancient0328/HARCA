---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - 並列検索）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - 並列検索）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、並列ハイブリッド検索の実装について説明します。並列ハイブリッド検索とは、ベクトル検索とキーワード検索を同時に実行し、その結果を統合する手法です。

## 2. 前提条件

並列ハイブリッド検索の実装には、以下のモジュールが必要です：

- `db-config.js`：データベース接続設定
- `embedding-util.js`：埋め込み生成ユーティリティ
- `query-util.js`：クエリ前処理ユーティリティ

これらのモジュールの詳細については、[ハイブリッド検索（Node.js基本実装 - 設定）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-config.md)を参照してください。

## 3. 並列ハイブリッド検索の実装

並列ハイブリッド検索では、ベクトル検索とキーワード検索を同時に実行し、それぞれの結果を統合します。以下に、並列ハイブリッド検索の実装を示します：

```javascript
// parallel-hybrid-search.js
const { db } = require('./db-config');
const { generateEmbedding } = require('./embedding-util');
const { preprocessQuery } = require('./query-util');

/**
 * 並列ハイブリッド検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function parallelHybridSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,                // 最終結果の上限数
    vectorWeight: 0.6,        // ベクトル検索の重み
    keywordWeight: 0.4,       // キーワード検索の重み
    vectorLimit: 50,          // ベクトル検索の中間結果上限
    keywordLimit: 50,         // キーワード検索の中間結果上限
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
    
    // 並列にベクトル検索とキーワード検索を実行
    const [vectorResults, keywordResults] = await Promise.all([
      // ベクトル検索
      db.any(
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
      ),
      
      // キーワード検索（tsqueryが空でない場合のみ）
      processedQuery.tsquery ? 
        db.any(
          `SELECT 
            k.${mergedOptions.idColumn}, 
            k.${mergedOptions.nameColumn}, 
            k.${mergedOptions.contentColumn}, 
            ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $1)) AS keyword_rank 
          FROM 
            ${mergedOptions.schema}.${mergedOptions.table} k 
          WHERE 
            k.${mergedOptions.tsvColumn} @@ to_tsquery('english', $1) 
          ORDER BY 
            keyword_rank DESC 
          LIMIT $2`,
          [processedQuery.tsquery, mergedOptions.keywordLimit]
        ) : []
    ]);
    
    // 結果をマージして重複を排除
    const resultMap = new Map();
    
    // ベクトル検索結果の追加
    vectorResults.forEach(item => {
      resultMap.set(item[mergedOptions.idColumn], {
        ...item,
        keyword_rank: null,
        source: 'vector'
      });
    });
    
    // キーワード検索結果の追加
    keywordResults.forEach(item => {
      if (resultMap.has(item[mergedOptions.idColumn])) {
        // 両方の検索で見つかった場合
        const existingItem = resultMap.get(item[mergedOptions.idColumn]);
        resultMap.set(item[mergedOptions.idColumn], {
          ...existingItem,
          keyword_rank: item.keyword_rank,
          source: 'both'
        });
      } else {
        // キーワード検索のみで見つかった場合
        resultMap.set(item[mergedOptions.idColumn], {
          ...item,
          vector_distance: null,
          source: 'keyword'
        });
      }
    });
    
    // 結果の配列に変換
    const results = Array.from(resultMap.values());
    
    // 結果のランキング
    results.sort((a, b) => {
      // まず検索ソースでソート
      const sourceOrder = { both: 1, vector: 2, keyword: 3 };
      if (sourceOrder[a.source] !== sourceOrder[b.source]) {
        return sourceOrder[a.source] - sourceOrder[b.source];
      }
      
      // 組み合わせスコアでソート
      const aScore = calculateCombinedScore(a, mergedOptions);
      const bScore = calculateCombinedScore(b, mergedOptions);
      return aScore - bScore;
    });
    
    // 上位n件を返す
    return results.slice(0, mergedOptions.limit);
  } catch (error) {
    console.error('並列ハイブリッド検索エラー:', error);
    throw error;
  }
}

/**
 * 組み合わせスコアを計算する
 * @param {object} item - 検索結果アイテム
 * @param {object} options - 検索オプション
 * @returns {number} - 計算された組み合わせスコア
 */
function calculateCombinedScore(item, options) {
  // ベクトル距離（小さいほど良い、nullの場合は最大値1.0）
  const vectorScore = item.vector_distance !== null ? 
    item.vector_distance * options.vectorWeight : 
    1.0 * options.vectorWeight;
  
  // キーワードランク（大きいほど良い、nullの場合は最小値0.0）
  // 1.0から引くことで、小さいほど良いスコアに変換
  const keywordScore = item.keyword_rank !== null ? 
    (1.0 - item.keyword_rank) * options.keywordWeight : 
    1.0 * options.keywordWeight;
  
  // 組み合わせスコア（小さいほど良い）
  return vectorScore + keywordScore;
}

module.exports = { parallelHybridSearch };
```

この実装では、以下の処理を行っています：

1. クエリの前処理とベクトル埋め込みの生成
2. ベクトル検索とキーワード検索を並列に実行
3. 検索結果のマージと重複の排除
4. 結果のランキング（検索ソースと組み合わせスコアに基づく）
5. 上位n件の結果を返す

### 3.1 組み合わせスコアの計算

並列ハイブリッド検索では、ベクトル検索とキーワード検索の結果を統合するために、組み合わせスコアを計算しています。組み合わせスコアは以下の式で計算されます：

```
組み合わせスコア = (ベクトル距離 * ベクトル重み) + ((1.0 - キーワードランク) * キーワード重み)
```

ここで、ベクトル距離は小さいほど良く、キーワードランクは大きいほど良いため、キーワードランクを1.0から引くことで、小さいほど良いスコアに変換しています。

## 4. 使用例

以下の例では、並列ハイブリッド検索を使用して検索を実行する方法を示します：

```javascript
// example.js
const { parallelHybridSearch } = require('./parallel-hybrid-search');

async function example() {
  try {
    // 並列ハイブリッド検索の実行
    const results = await parallelHybridSearch('ニューラルネットワークの学習方法について教えて');
    
    // 結果の表示
    console.log(`検索結果: ${results.length}件`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.name} (ソース: ${result.source})`);
      console.log(`  ベクトル距離: ${result.vector_distance}`);
      console.log(`  キーワードランク: ${result.keyword_rank}`);
      console.log(`  内容: ${result.content.substring(0, 100)}...`);
      console.log('---');
    });
  } catch (error) {
    console.error('エラー:', error);
  }
}

example();
```

### 4.1 カスタムオプションの使用例

並列ハイブリッド検索では、様々なオプションをカスタマイズすることができます：

```javascript
// custom-example.js
const { parallelHybridSearch } = require('./parallel-hybrid-search');

async function customExample() {
  try {
    // カスタムオプションを指定した並列ハイブリッド検索
    const results = await parallelHybridSearch('機械学習アルゴリズムの比較', {
      limit: 5,                // 最終結果を5件に制限
      vectorWeight: 0.7,       // ベクトル検索の重みを増加
      keywordWeight: 0.3,      // キーワード検索の重みを減少
      vectorLimit: 100,        // ベクトル検索の中間結果を100件に増加
      keywordLimit: 100,       // キーワード検索の中間結果を100件に増加
      schema: 'long_term',     // 検索対象スキーマ
      table: 'knowledge_items' // 検索対象テーブル
    });
    
    // 結果の表示
    console.log(`検索結果: ${results.length}件`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.name} (ソース: ${result.source})`);
    });
  } catch (error) {
    console.error('エラー:', error);
  }
}

customExample();
```

## 5. パフォーマンスに関する考慮事項

並列ハイブリッド検索は、ベクトル検索とキーワード検索を同時に実行するため、効率的に検索を行うことができます。ただし、以下の点に注意する必要があります：

1. **中間結果の上限**：`vectorLimit`と`keywordLimit`は、中間結果の上限を指定します。これらの値が大きすぎると、メモリ使用量が増加し、パフォーマンスが低下する可能性があります。

2. **データベースの負荷**：並列に複数のクエリを実行するため、データベースの負荷が増加する可能性があります。適切な接続プールの設定が重要です。

3. **インデックスの最適化**：ベクトル検索とキーワード検索の両方のパフォーマンスを最適化するために、適切なインデックスを作成する必要があります。

## 6. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、並列ハイブリッド検索の実装について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - 交差検索）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-intersection.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - フィルタリング検索）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-filtering.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - キーワードファースト）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-keyword-first.md)
