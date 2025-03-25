---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - キーワードファースト）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - キーワードファースト）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、キーワードファースト段階的検索の実装について説明します。キーワードファースト段階的検索とは、まずキーワード検索を実行し、その結果に対してベクトル検索を適用する手法です。

## 2. 前提条件

キーワードファースト段階的検索の実装には、以下のモジュールが必要です：

- `db-config.js`：データベース接続設定
- `embedding-util.js`：埋め込み生成ユーティリティ
- `query-util.js`：クエリ前処理ユーティリティ

これらのモジュールの詳細については、[ハイブリッド検索（Node.js基本実装 - 設定）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-config.md)を参照してください。

## 3. キーワードファースト段階的検索の実装

キーワードファースト段階的検索では、まずキーワード検索を実行し、その結果に対してベクトル検索を適用します。以下に、キーワードファースト段階的検索の実装を示します：

```javascript
// keyword-first-search.js
const { db } = require('./db-config');
const { generateEmbedding } = require('./embedding-util');
const { preprocessQuery } = require('./query-util');

/**
 * キーワードファースト段階的検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function keywordFirstSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,                // 最終結果の上限数
    keywordLimit: 100,        // キーワード検索の中間結果上限
    minKeywordResults: 5,     // キーワード検索の最小結果数（これ未満の場合はフォールバック）
    fallbackToVector: true,   // キーワード検索結果が少ない場合にベクトル検索にフォールバックするかどうか
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
      console.log('キーワードが抽出できませんでした。ベクトル検索を実行します。');
      return vectorOnlySearch(queryEmbedding, mergedOptions);
    }
    
    // ステップ1: キーワード検索を実行
    const keywordResults = await db.any(
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
    );
    
    // キーワード検索結果が少ない場合はフォールバック
    if (keywordResults.length < mergedOptions.minKeywordResults && mergedOptions.fallbackToVector) {
      console.log(`キーワード検索結果が少なすぎます（${keywordResults.length}件）。ベクトル検索を実行します。`);
      return vectorOnlySearch(queryEmbedding, mergedOptions);
    }
    
    // キーワード検索結果がない場合はベクトル検索を実行
    if (keywordResults.length === 0) {
      console.log('キーワード検索結果がありません。ベクトル検索を実行します。');
      return vectorOnlySearch(queryEmbedding, mergedOptions);
    }
    
    // ステップ2: キーワード検索結果のIDを抽出
    const keywordResultIds = keywordResults.map(item => item[mergedOptions.idColumn]);
    
    // ステップ3: 抽出したIDに対してベクトル検索を実行
    const finalResults = await db.any(
      `SELECT 
        k.${mergedOptions.idColumn}, 
        k.${mergedOptions.nameColumn}, 
        k.${mergedOptions.contentColumn}, 
        kv.${mergedOptions.embeddingColumn} <=> $1 AS vector_distance,
        ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $2)) AS keyword_rank
      FROM 
        ${mergedOptions.schema}.${mergedOptions.table} k 
      JOIN 
        ${mergedOptions.schema}.${mergedOptions.vectorTable} kv 
        ON k.${mergedOptions.idColumn} = kv.${mergedOptions.vectorIdColumn} 
      WHERE 
        k.${mergedOptions.idColumn} = ANY($3)
      ORDER BY 
        vector_distance 
      LIMIT $4`,
      [queryEmbedding, processedQuery.tsquery, keywordResultIds, mergedOptions.limit]
    );
    
    return finalResults;
  } catch (error) {
    console.error('キーワードファースト段階的検索エラー:', error);
    throw error;
  }
}

/**
 * ベクトル検索のみを実行する（フォールバック用）
 * @param {Array} queryEmbedding - クエリの埋め込みベクトル
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function vectorOnlySearch(queryEmbedding, options) {
  return db.any(
    `SELECT 
      k.${options.idColumn}, 
      k.${options.nameColumn}, 
      k.${options.contentColumn}, 
      kv.${options.embeddingColumn} <=> $1 AS vector_distance 
    FROM 
      ${options.schema}.${options.table} k 
    JOIN 
      ${options.schema}.${options.vectorTable} kv 
      ON k.${options.idColumn} = kv.${options.vectorIdColumn} 
    ORDER BY 
      vector_distance 
    LIMIT $2`,
    [queryEmbedding, options.limit]
  );
}

module.exports = { keywordFirstSearch };
```

この実装では、以下の処理を行っています：

1. クエリの前処理とベクトル埋め込みの生成
2. tsqueryが空の場合は通常のベクトル検索を実行
3. ステップ1: キーワード検索を実行
4. キーワード検索結果が少ない場合はベクトル検索にフォールバック
5. ステップ2: キーワード検索結果のIDを抽出
6. ステップ3: 抽出したIDに対してベクトル検索を実行
7. 最終結果を返す

## 4. キーワードファースト段階的検索の最適化

キーワードファースト段階的検索を最適化するには、以下の方法があります：

### 4.1 キーワード検索の最適化

キーワード検索のパフォーマンスを最適化するには、以下の方法があります：

1. **適切なインデックスの作成**：tsvector列に対するGINインデックスを作成することで、キーワード検索のパフォーマンスを向上させることができます。

```sql
-- tsvector列のGINインデックスを作成
CREATE INDEX idx_knowledge_items_content_tsv ON long_term.knowledge_items USING GIN (content_tsv);
```

2. **クエリの前処理の最適化**：クエリから抽出するキーワードの品質を向上させることで、キーワード検索の精度を向上させることができます。

```javascript
// optimized-query-util.js
function optimizedPreprocessQuery(query) {
  // ストップワードの除去
  const stopwords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as'];
  const words = query.toLowerCase().split(/\s+/);
  const filteredWords = words.filter(word => !stopwords.includes(word));
  
  // 単語の重み付け
  const weightedWords = filteredWords.map(word => {
    // 長い単語は重要度が高い傾向がある
    const weight = word.length > 5 ? 'A' : 'B';
    return `${word}:${weight}`;
  });
  
  // tsqueryの形式に変換
  const tsquery = weightedWords.join(' & ');
  
  return {
    originalQuery: query,
    words: filteredWords,
    tsquery: tsquery
  };
}
```

### 4.2 中間結果の最適化

中間結果の数を最適化することで、パフォーマンスを向上させることができます：

```javascript
// optimized-keyword-first-search.js
async function optimizedKeywordFirstSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    // 他のオプションは同じ
    keywordLimit: 50,         // キーワード検索の中間結果上限を減少
    dynamicKeywordLimit: true // 動的に中間結果の上限を調整するかどうか
  };
  
  // オプションをマージ
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    // クエリの前処理とベクトル埋め込みの生成
    const processedQuery = preprocessQuery(query);
    const queryEmbedding = await generateEmbedding(query);
    
    // キーワード検索の中間結果上限を動的に調整
    if (mergedOptions.dynamicKeywordLimit) {
      // クエリの複雑さに基づいて中間結果の上限を調整
      const queryComplexity = processedQuery.words.length;
      mergedOptions.keywordLimit = Math.max(20, Math.min(200, queryComplexity * 20));
    }
    
    // 以下、keywordFirstSearchと同様の実装
    // 実装は省略
  } catch (error) {
    console.error('最適化されたキーワードファースト段階的検索エラー:', error);
    throw error;
  }
}
```

この最適化では、クエリの複雑さに基づいて中間結果の上限を動的に調整しています。

## 5. 使用例

以下の例では、キーワードファースト段階的検索を使用して検索を実行する方法を示します：

```javascript
// example.js
const { keywordFirstSearch } = require('./keyword-first-search');

async function example() {
  try {
    // キーワードファースト段階的検索の実行
    const results = await keywordFirstSearch('ニューラルネットワークの学習方法について教えて');
    
    // 結果の表示
    console.log(`検索結果: ${results.length}件`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.name}`);
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

### 5.1 カスタムオプションの使用例

キーワードファースト段階的検索では、様々なオプションをカスタマイズすることができます：

```javascript
// custom-example.js
const { keywordFirstSearch } = require('./keyword-first-search');

async function customExample() {
  try {
    // カスタムオプションを指定したキーワードファースト段階的検索
    const results = await keywordFirstSearch('機械学習アルゴリズムの比較', {
      limit: 5,                // 最終結果を5件に制限
      keywordLimit: 200,       // キーワード検索の中間結果を200件に増加
      minKeywordResults: 10,   // キーワード検索の最小結果数を10件に増加
      fallbackToVector: true,  // キーワード検索結果が少ない場合はベクトル検索にフォールバック
      schema: 'long_term',     // 検索対象スキーマ
      table: 'knowledge_items' // 検索対象テーブル
    });
    
    // 結果の表示
    console.log(`検索結果: ${results.length}件`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.name}`);
    });
  } catch (error) {
    console.error('エラー:', error);
  }
}

customExample();
```

## 6. フィルタリングとの組み合わせ

キーワードファースト段階的検索とフィルタリングを組み合わせることで、より精度の高い検索を実現することができます：

```javascript
// keyword-first-filtered-search.js
const { db } = require('./db-config');
const { generateEmbedding } = require('./embedding-util');
const { preprocessQuery } = require('./query-util');

/**
 * フィルタリング付きキーワードファースト段階的検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} filters - メタデータフィルター
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function keywordFirstFilteredSearch(query, filters = {}, options = {}) {
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
    
    // tsqueryが空の場合はフィルタリング付きベクトル検索を実行
    if (!processedQuery.tsquery) {
      console.log('キーワードが抽出できませんでした。フィルタリング付きベクトル検索を実行します。');
      return filteredVectorOnlySearch(queryEmbedding, filters, mergedOptions);
    }
    
    // ステップ1: フィルタリング付きキーワード検索を実行
    const keywordResults = await db.any(
      `SELECT 
        k.${mergedOptions.idColumn}, 
        k.${mergedOptions.nameColumn}, 
        k.${mergedOptions.contentColumn}, 
        ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $${paramIndex})) AS keyword_rank 
      FROM 
        ${mergedOptions.schema}.${mergedOptions.table} k 
      WHERE 
        k.${mergedOptions.tsvColumn} @@ to_tsquery('english', $${paramIndex}) 
        ${filterConditionStr}
      ORDER BY 
        keyword_rank DESC 
      LIMIT $${paramIndex + 1}`,
      [...filterValues, processedQuery.tsquery, mergedOptions.keywordLimit]
    );
    
    // キーワード検索結果が少ない場合はフォールバック
    if (keywordResults.length < mergedOptions.minKeywordResults && mergedOptions.fallbackToVector) {
      console.log(`キーワード検索結果が少なすぎます（${keywordResults.length}件）。フィルタリング付きベクトル検索を実行します。`);
      return filteredVectorOnlySearch(queryEmbedding, filters, mergedOptions);
    }
    
    // キーワード検索結果がない場合はフィルタリング付きベクトル検索を実行
    if (keywordResults.length === 0) {
      console.log('キーワード検索結果がありません。フィルタリング付きベクトル検索を実行します。');
      return filteredVectorOnlySearch(queryEmbedding, filters, mergedOptions);
    }
    
    // ステップ2: キーワード検索結果のIDを抽出
    const keywordResultIds = keywordResults.map(item => item[mergedOptions.idColumn]);
    
    // ステップ3: 抽出したIDに対してベクトル検索を実行
    const finalResults = await db.any(
      `SELECT 
        k.${mergedOptions.idColumn}, 
        k.${mergedOptions.nameColumn}, 
        k.${mergedOptions.contentColumn}, 
        kv.${mergedOptions.embeddingColumn} <=> $${paramIndex} AS vector_distance,
        ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $${paramIndex + 1})) AS keyword_rank
      FROM 
        ${mergedOptions.schema}.${mergedOptions.table} k 
      JOIN 
        ${mergedOptions.schema}.${mergedOptions.vectorTable} kv 
        ON k.${mergedOptions.idColumn} = kv.${mergedOptions.vectorIdColumn} 
      WHERE 
        k.${mergedOptions.idColumn} = ANY($${paramIndex + 2})
      ORDER BY 
        vector_distance 
      LIMIT $${paramIndex + 3}`,
      [...filterValues, queryEmbedding, processedQuery.tsquery, keywordResultIds, mergedOptions.limit]
    );
    
    return finalResults;
  } catch (error) {
    console.error('フィルタリング付きキーワードファースト段階的検索エラー:', error);
    throw error;
  }
}

/**
 * フィルタリング付きベクトル検索のみを実行する（フォールバック用）
 * @param {Array} queryEmbedding - クエリの埋め込みベクトル
 * @param {object} filters - メタデータフィルター
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function filteredVectorOnlySearch(queryEmbedding, filters, options) {
  // フィルター条件の構築
  // 実装は省略（keywordFirstFilteredSearchと同様）
  
  return db.any(
    `SELECT 
      k.${options.idColumn}, 
      k.${options.nameColumn}, 
      k.${options.contentColumn}, 
      kv.${options.embeddingColumn} <=> $${paramIndex} AS vector_distance 
    FROM 
      ${options.schema}.${options.table} k 
    JOIN 
      ${options.schema}.${options.vectorTable} kv 
      ON k.${options.idColumn} = kv.${options.vectorIdColumn} 
    WHERE 
      1=1 ${filterConditionStr}
    ORDER BY 
      vector_distance 
    LIMIT $${paramIndex + 1}`,
    [...filterValues, queryEmbedding, options.limit]
  );
}

module.exports = { keywordFirstFilteredSearch };
```

## 7. パフォーマンスに関する考慮事項

キーワードファースト段階的検索のパフォーマンスを最適化するには、以下の点に注意する必要があります：

1. **キーワード検索の中間結果上限**：`keywordLimit`は、キーワード検索の中間結果の上限を指定します。この値が大きすぎると、ベクトル検索のパフォーマンスが低下する可能性があります。

2. **インデックスの最適化**：キーワード検索とベクトル検索の両方のパフォーマンスを最適化するために、適切なインデックスを作成する必要があります。

3. **クエリの前処理**：クエリから抽出するキーワードの品質を向上させることで、キーワード検索の精度を向上させることができます。

4. **フォールバック戦略**：キーワード検索結果が少ない場合にベクトル検索にフォールバックする戦略は、検索の精度とパフォーマンスのバランスを取るために重要です。

## 8. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、キーワードファースト段階的検索の実装について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - ベクトルファースト）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-vector-first.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - メタデータフィルタリング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-metadata-filtering.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis.md)
