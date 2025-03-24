---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索基本）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索基本）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、基本的な段階的検索の実装について説明します。段階的検索とは、複数の検索手法を順次適用することで、検索精度と効率を両立させる手法です。

## 2. 前提条件

基本的な前提条件は[ハイブリッド検索（Node.js基本実装）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-basic.md)と同じです。以下のモジュールが必要です：

- `db-config.js`：データベース接続設定
- `embedding-util.js`：埋め込み生成ユーティリティ
- `query-util.js`：クエリ前処理ユーティリティ

## 3. 基本的な段階的検索の実装

### 3.1 キーワードファースト段階的検索

キーワード検索を最初に実行し、その結果に対してベクトル検索を適用する実装です：

```javascript
// staged-hybrid-search.js
const { db } = require('./db-config');
const { generateEmbedding } = require('./embedding-util');
const { preprocessQuery } = require('./query-util');

/**
 * キーワードファースト段階的検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function keywordFirstStagedSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,                // 最終結果の上限数
    intermediateLimit: 1000,  // 中間結果の上限数
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
    
    // tsqueryが空の場合は通常のベクトル検索を実行
    if (!processedQuery.tsquery) {
      const queryEmbedding = await generateEmbedding(query);
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
    
    // クエリからベクトル埋め込みを生成
    const queryEmbedding = await generateEmbedding(query);
    
    // 第一段階：キーワード検索
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
      [processedQuery.tsquery, mergedOptions.intermediateLimit]
    );
    
    // キーワード検索の結果がない場合は通常のベクトル検索を実行
    if (keywordResults.length === 0) {
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
    
    // キーワード検索結果のIDを抽出
    const keywordIds = keywordResults.map(item => item[mergedOptions.idColumn]);
    
    // 第二段階：キーワード検索結果に対してベクトル検索を実行
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
      WHERE 
        k.${mergedOptions.idColumn} IN ($2:csv)
      ORDER BY 
        vector_distance
      LIMIT $3`,
      [queryEmbedding, keywordIds, mergedOptions.limit]
    );
    
    // キーワードランクを結果に追加
    return vectorResults.map(vectorItem => {
      const keywordItem = keywordResults.find(
        item => item[mergedOptions.idColumn] === vectorItem[mergedOptions.idColumn]
      );
      return {
        ...vectorItem,
        keyword_rank: keywordItem ? keywordItem.keyword_rank : null
      };
    });
  } catch (error) {
    console.error('キーワードファースト段階的検索エラー:', error);
    throw error;
  }
}

module.exports = { keywordFirstStagedSearch };
```

### 3.2 ベクトルファースト段階的検索

ベクトル検索を最初に実行し、その結果に対してキーワード検索を適用する実装です：

```javascript
// staged-hybrid-search.js（続き）
/**
 * ベクトルファースト段階的検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function vectorFirstStagedSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,                // 最終結果の上限数
    intermediateLimit: 1000,  // 中間結果の上限数
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
    
    // 第一段階：ベクトル検索
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
      [queryEmbedding, mergedOptions.intermediateLimit]
    );
    
    // ベクトル検索の結果がない場合は空の配列を返す
    if (vectorResults.length === 0) {
      return [];
    }
    
    // tsqueryが空の場合はベクトル検索結果をそのまま返す
    if (!processedQuery.tsquery) {
      return vectorResults.slice(0, mergedOptions.limit);
    }
    
    // ベクトル検索結果のIDを抽出
    const vectorIds = vectorResults.map(item => item[mergedOptions.idColumn]);
    
    // 第二段階：ベクトル検索結果に対してキーワード検索を実行
    const keywordResults = await db.any(
      `SELECT 
        k.${mergedOptions.idColumn},
        ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $1)) AS keyword_rank
      FROM 
        ${mergedOptions.schema}.${mergedOptions.table} k
      WHERE 
        k.${mergedOptions.idColumn} IN ($2:csv) AND
        k.${mergedOptions.tsvColumn} @@ to_tsquery('english', $1)
      ORDER BY 
        keyword_rank DESC`,
      [processedQuery.tsquery, vectorIds]
    );
    
    // ベクトル検索結果にキーワードランクを追加
    const results = vectorResults.map(vectorItem => {
      const keywordItem = keywordResults.find(
        item => item[mergedOptions.idColumn] === vectorItem[mergedOptions.idColumn]
      );
      return {
        ...vectorItem,
        keyword_rank: keywordItem ? keywordItem.keyword_rank : null
      };
    });
    
    // 結果を並べ替え：キーワードランクがあるものを優先し、その後ベクトル距離でソート
    results.sort((a, b) => {
      // まずキーワードランクの有無でソート
      if (a.keyword_rank !== null && b.keyword_rank === null) return -1;
      if (a.keyword_rank === null && b.keyword_rank !== null) return 1;
      
      // 両方キーワードランクがある場合はベクトル距離とキーワードランクの組み合わせでソート
      if (a.keyword_rank !== null && b.keyword_rank !== null) {
        return (a.vector_distance * 0.7 + (1.0 - a.keyword_rank) * 0.3) - 
               (b.vector_distance * 0.7 + (1.0 - b.keyword_rank) * 0.3);
      }
      
      // それ以外の場合はベクトル距離でソート
      return a.vector_distance - b.vector_distance;
    });
    
    // 上位n件を返す
    return results.slice(0, mergedOptions.limit);
  } catch (error) {
    console.error('ベクトルファースト段階的検索エラー:', error);
    throw error;
  }
}

module.exports = { keywordFirstStagedSearch, vectorFirstStagedSearch };
```

### 3.3 メタデータフィルタリング段階的検索

メタデータフィルタリングを最初に適用し、その後ハイブリッド検索を実行する実装です：

```javascript
// staged-hybrid-search.js（続き）
/**
 * メタデータフィルタリング段階的検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} metadataFilter - メタデータフィルタ条件
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function metadataFilteredStagedSearch(query, metadataFilter, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,                // 最終結果の上限数
    intermediateLimit: 1000,  // 中間結果の上限数
    vectorWeight: 0.6,        // ベクトル検索の重み
    keywordWeight: 0.4,       // キーワード検索の重み
    schema: 'long_term',      // 検索対象スキーマ
    table: 'knowledge_items', // 検索対象テーブル
    vectorTable: 'knowledge_vectors', // ベクトルテーブル
    idColumn: 'id',           // ID列名
    contentColumn: 'content', // コンテンツ列名
    nameColumn: 'name',       // 名前列名
    metadataColumn: 'metadata', // メタデータ列名
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
    
    // メタデータフィルタ条件をJSONB条件に変換
    const metadataConditions = [];
    Object.entries(metadataFilter).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // 配列の場合は要素のいずれかに一致
        metadataConditions.push(`${mergedOptions.metadataColumn}->>'${key}' IN ('${value.join("','")}')"`);
      } else if (typeof value === 'object' && value !== null) {
        // オブジェクトの場合は@>演算子を使用
        metadataConditions.push(`${mergedOptions.metadataColumn} @> '{"${key}": ${JSON.stringify(value)}}'::jsonb`);
      } else {
        // スカラー値の場合は単純な一致
        metadataConditions.push(`${mergedOptions.metadataColumn}->>'${key}' = '${value}'`);
      }
    });
    
    // メタデータ条件の結合
    const metadataWhereClause = metadataConditions.length > 0 ? 
      `WHERE ${metadataConditions.join(' AND ')}` : '';
    
    // 第一段階：メタデータフィルタリング
    const metadataFilteredIds = await db.any(
      `SELECT 
        ${mergedOptions.idColumn}
      FROM 
        ${mergedOptions.schema}.${mergedOptions.table}
      ${metadataWhereClause}
      LIMIT $1`,
      [mergedOptions.intermediateLimit]
    );
    
    // メタデータフィルタリングの結果がない場合は空の配列を返す
    if (metadataFilteredIds.length === 0) {
      return [];
    }
    
    // メタデータフィルタリング結果のIDを抽出
    const filteredIds = metadataFilteredIds.map(item => item[mergedOptions.idColumn]);
    
    // 第二段階：フィルタリングされた結果に対してハイブリッド検索を実行
    const hybridResults = await Promise.all([
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
        WHERE 
          k.${mergedOptions.idColumn} IN ($2:csv)
        ORDER BY 
          vector_distance 
        LIMIT $3`,
        [queryEmbedding, filteredIds, mergedOptions.limit * 2]
      ),
      
      // キーワード検索（tsqueryが空でない場合のみ）
      processedQuery.tsquery ? 
        db.any(
          `SELECT 
            k.${mergedOptions.idColumn}, 
            ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $1)) AS keyword_rank 
          FROM 
            ${mergedOptions.schema}.${mergedOptions.table} k 
          WHERE 
            k.${mergedOptions.idColumn} IN ($2:csv) AND
            k.${mergedOptions.tsvColumn} @@ to_tsquery('english', $1) 
          ORDER BY 
            keyword_rank DESC 
          LIMIT $3`,
          [processedQuery.tsquery, filteredIds, mergedOptions.limit * 2]
        ) : []
    ]);
    
    const [vectorResults, keywordResults] = hybridResults;
    
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
          [mergedOptions.idColumn]: item[mergedOptions.idColumn],
          vector_distance: null,
          keyword_rank: item.keyword_rank,
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
    console.error('メタデータフィルタリング段階的検索エラー:', error);
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

module.exports = {
  keywordFirstStagedSearch,
  vectorFirstStagedSearch,
  metadataFilteredStagedSearch
};
```

## 4. 使用例

### 4.1 基本的な使用例

```javascript
// staged-example.js
const {
  keywordFirstStagedSearch,
  vectorFirstStagedSearch,
  metadataFilteredStagedSearch
} = require('./staged-hybrid-search');

async function runExamples() {
  try {
    // キーワードファースト段階的検索の例
    console.log('キーワードファースト段階的検索の結果:');
    const keywordFirstResults = await keywordFirstStagedSearch('ニューラルネットワークの学習方法について教えて');
    console.log(keywordFirstResults);
    
    // ベクトルファースト段階的検索の例
    console.log('\nベクトルファースト段階的検索の結果:');
    const vectorFirstResults = await vectorFirstStagedSearch('ニューラルネットワークの学習方法について教えて');
    console.log(vectorFirstResults);
    
    // メタデータフィルタリング段階的検索の例
    console.log('\nメタデータフィルタリング段階的検索の結果:');
    const metadataFilteredResults = await metadataFilteredStagedSearch(
      'ニューラルネットワークの学習方法について教えて',
      { category: 'machine_learning', importance: { $gte: 0.7 } }
    );
    console.log(metadataFilteredResults);
  } catch (error) {
    console.error('エラー:', error);
  }
}

runExamples();
```

### 4.2 クエリタイプに基づく検索戦略の選択

```javascript
// query-based-strategy.js
const {
  keywordFirstStagedSearch,
  vectorFirstStagedSearch
} = require('./staged-hybrid-search');
const { preprocessQuery } = require('./query-util');

/**
 * クエリタイプに基づいて最適な検索戦略を選択する
 * @param {string} query - 検索クエリ
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function queryBasedStrategySearch(query, options = {}) {
  // クエリの前処理
  const processedQuery = preprocessQuery(query);
  
  // クエリタイプに基づいて検索戦略を選択
  if (processedQuery.isNaturalLanguage) {
    // 自然言語クエリの場合はベクトルファースト検索
    console.log('自然言語クエリを検出: ベクトルファースト検索を使用');
    return vectorFirstStagedSearch(query, options);
  } else if (processedQuery.wordCount <= 3) {
    // 短いキーワードクエリの場合はキーワードファースト検索
    console.log('短いキーワードクエリを検出: キーワードファースト検索を使用');
    return keywordFirstStagedSearch(query, options);
  } else {
    // 長いキーワードクエリの場合もベクトルファースト検索
    console.log('長いキーワードクエリを検出: ベクトルファースト検索を使用');
    return vectorFirstStagedSearch(query, options);
  }
}

// 使用例
async function runExample() {
  try {
    // 自然言語クエリの例
    console.log('自然言語クエリの検索結果:');
    const naturalLanguageResults = await queryBasedStrategySearch('ニューラルネットワークはどのように学習しますか？');
    console.log(naturalLanguageResults);
    
    // 短いキーワードクエリの例
    console.log('\n短いキーワードクエリの検索結果:');
    const shortKeywordResults = await queryBasedStrategySearch('機械学習 アルゴリズム');
    console.log(shortKeywordResults);
    
    // 長いキーワードクエリの例
    console.log('\n長いキーワードクエリの検索結果:');
    const longKeywordResults = await queryBasedStrategySearch('ディープラーニング ニューラルネットワーク 学習 最適化 手法');
    console.log(longKeywordResults);
  } catch (error) {
    console.error('エラー:', error);
  }
}

runExample();
```

## 5. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、基本的な段階的検索の実装について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索高度）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-staged-advanced.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.jsパフォーマンス最適化）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-performance.md)
