---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装について説明します。ベクトル検索とキーワード検索を組み合わせた基本的なハイブリッド検索の実装方法を紹介します。

## 2. 前提条件

### 2.1 必要なパッケージ

```javascript
// package.json
{
  "dependencies": {
    "pg-promise": "^11.0.0",    // PostgreSQLクライアント
    "openai": "^4.0.0",         // OpenAI APIクライアント（埋め込み生成用）
    "natural": "^6.2.0",        // 自然言語処理ライブラリ
    "dotenv": "^16.0.3"         // 環境変数管理
  }
}
```

### 2.2 データベース接続設定

```javascript
// db-config.js
const pgp = require('pg-promise')();

// 環境変数から接続情報を取得
require('dotenv').config();

const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 3730,
  database: process.env.POSTGRES_DB || 'harca_memory',
  user: process.env.POSTGRES_USER || 'harca_user',
  password: process.env.POSTGRES_PASSWORD || 'harca_password'
};

const db = pgp(dbConfig);

module.exports = { db, pgp };
```

### 2.3 埋め込み生成ユーティリティ

```javascript
// embedding-util.js
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * テキストからベクトル埋め込みを生成する
 * @param {string} text - 埋め込みを生成するテキスト
 * @returns {Promise<number[]>} - 生成された埋め込みベクトル
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('埋め込み生成エラー:', error);
    throw error;
  }
}

module.exports = { generateEmbedding };
```

## 3. 基本的なハイブリッド検索の実装

### 3.1 クエリ前処理ユーティリティ

```javascript
// query-util.js
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
const stopwords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as', 'of'];

/**
 * 検索クエリを前処理する
 * @param {string} query - 元の検索クエリ
 * @returns {object} - 前処理されたクエリ情報
 */
function preprocessQuery(query) {
  // クエリをトークン化
  const tokens = tokenizer.tokenize(query.toLowerCase());
  
  // ストップワードを除去
  const filteredTokens = tokens.filter(token => !stopwords.includes(token));
  
  // tsqueryフォーマットに変換（キーワード検索用）
  const tsquery = filteredTokens.join(' & ');
  
  // 自然言語クエリかどうかを判定
  const isNaturalLanguage = /^(what|how|why|when|where|who|which)/.test(query.toLowerCase());
  
  return {
    originalQuery: query,
    tokens: tokens,
    filteredTokens: filteredTokens,
    tsquery: tsquery,
    wordCount: filteredTokens.length,
    isNaturalLanguage: isNaturalLanguage
  };
}

module.exports = { preprocessQuery };
```

### 3.2 並列ハイブリッド検索の実装

```javascript
// hybrid-search.js
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
    console.error('ハイブリッド検索エラー:', error);
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

### 3.3 交差ハイブリッド検索の実装

```javascript
// hybrid-search.js（続き）
/**
 * 交差ハイブリッド検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function intersectionHybridSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,
    vectorWeight: 0.5,
    keywordWeight: 0.5,
    intermediateLimit: 100,
    schema: 'long_term',
    table: 'knowledge_items',
    vectorTable: 'knowledge_vectors',
    idColumn: 'id',
    contentColumn: 'content',
    nameColumn: 'name',
    vectorIdColumn: 'knowledge_id',
    embeddingColumn: 'embedding',
    tsvColumn: 'content_tsv'
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

module.exports = { parallelHybridSearch, intersectionHybridSearch };
```

### 3.4 フィルタリングハイブリッド検索の実装

```javascript
// hybrid-search.js（続き）
/**
 * キーワードでフィルタリングしたベクトル検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function keywordFilteredVectorSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,
    intermediateLimit: 1000,
    schema: 'long_term',
    table: 'knowledge_items',
    vectorTable: 'knowledge_vectors',
    idColumn: 'id',
    contentColumn: 'content',
    nameColumn: 'name',
    vectorIdColumn: 'knowledge_id',
    embeddingColumn: 'embedding',
    tsvColumn: 'content_tsv'
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
    
    // キーワードでフィルタリングしたベクトル検索
    return db.any(
      `WITH keyword_filtered_ids AS (
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
        kv.${mergedOptions.embeddingColumn} <=> $3 AS vector_distance
      FROM 
        keyword_filtered_ids kfi
      JOIN 
        ${mergedOptions.schema}.${mergedOptions.table} k ON k.${mergedOptions.idColumn} = kfi.${mergedOptions.idColumn}
      JOIN 
        ${mergedOptions.schema}.${mergedOptions.vectorTable} kv ON kv.${mergedOptions.vectorIdColumn} = k.${mergedOptions.idColumn}
      ORDER BY 
        vector_distance
      LIMIT $4`,
      [
        processedQuery.tsquery,
        mergedOptions.intermediateLimit,
        queryEmbedding,
        mergedOptions.limit
      ]
    );
  } catch (error) {
    console.error('キーワードフィルタリングベクトル検索エラー:', error);
    throw error;
  }
}

/**
 * ベクトルでフィルタリングしたキーワード検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function vectorFilteredKeywordSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,
    vectorThreshold: 0.3,
    intermediateLimit: 1000,
    schema: 'long_term',
    table: 'knowledge_items',
    vectorTable: 'knowledge_vectors',
    idColumn: 'id',
    contentColumn: 'content',
    nameColumn: 'name',
    vectorIdColumn: 'knowledge_id',
    embeddingColumn: 'embedding',
    tsvColumn: 'content_tsv'
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
    
    // ベクトルでフィルタリングしたキーワード検索
    return db.any(
      `WITH vector_filtered_ids AS (
        SELECT 
          k.${mergedOptions.idColumn}
        FROM 
          ${mergedOptions.schema}.${mergedOptions.table} k
        JOIN 
          ${mergedOptions.schema}.${mergedOptions.vectorTable} kv 
          ON k.${mergedOptions.idColumn} = kv.${mergedOptions.vectorIdColumn}
        WHERE 
          kv.${mergedOptions.embeddingColumn} <=> $1 < $2
        LIMIT $3
      )
      
      SELECT 
        k.${mergedOptions.idColumn},
        k.${mergedOptions.nameColumn},
        k.${mergedOptions.contentColumn},
        ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $4)) AS keyword_rank
      FROM 
        vector_filtered_ids vfi
      JOIN 
        ${mergedOptions.schema}.${mergedOptions.table} k ON k.${mergedOptions.idColumn} = vfi.${mergedOptions.idColumn}
      WHERE 
        k.${mergedOptions.tsvColumn} @@ to_tsquery('english', $4)
      ORDER BY 
        keyword_rank DESC
      LIMIT $5`,
      [
        queryEmbedding,
        mergedOptions.vectorThreshold,
        mergedOptions.intermediateLimit,
        processedQuery.tsquery,
        mergedOptions.limit
      ]
    );
  } catch (error) {
    console.error('ベクトルフィルタリングキーワード検索エラー:', error);
    throw error;
  }
}

module.exports = {
  parallelHybridSearch,
  intersectionHybridSearch,
  keywordFilteredVectorSearch,
  vectorFilteredKeywordSearch
};
```

## 4. 使用例

### 4.1 基本的な使用例

```javascript
// example.js
const {
  parallelHybridSearch,
  intersectionHybridSearch,
  keywordFilteredVectorSearch,
  vectorFilteredKeywordSearch
} = require('./hybrid-search');

async function runExamples() {
  try {
    // 並列ハイブリッド検索の例
    console.log('並列ハイブリッド検索の結果:');
    const parallelResults = await parallelHybridSearch('ニューラルネットワークの学習方法について教えて');
    console.log(parallelResults);
    
    // 交差ハイブリッド検索の例
    console.log('\n交差ハイブリッド検索の結果:');
    const intersectionResults = await intersectionHybridSearch('ニューラルネットワークの学習方法について教えて');
    console.log(intersectionResults);
    
    // キーワードフィルタリングベクトル検索の例
    console.log('\nキーワードフィルタリングベクトル検索の結果:');
    const keywordFilteredResults = await keywordFilteredVectorSearch('ニューラルネットワークの学習方法について教えて');
    console.log(keywordFilteredResults);
    
    // ベクトルフィルタリングキーワード検索の例
    console.log('\nベクトルフィルタリングキーワード検索の結果:');
    const vectorFilteredResults = await vectorFilteredKeywordSearch('ニューラルネットワークの学習方法について教えて');
    console.log(vectorFilteredResults);
  } catch (error) {
    console.error('エラー:', error);
  }
}

runExamples();
```

### 4.2 カスタムオプションの使用例

```javascript
// custom-example.js
const { parallelHybridSearch } = require('./hybrid-search');

async function runCustomExample() {
  try {
    // カスタムオプションを指定した並列ハイブリッド検索
    const customResults = await parallelHybridSearch('機械学習アルゴリズムの比較', {
      limit: 5,                // 最終結果を5件に制限
      vectorWeight: 0.7,       // ベクトル検索の重みを増加
      keywordWeight: 0.3,      // キーワード検索の重みを減少
      vectorLimit: 100,        // ベクトル検索の中間結果を100件に増加
      keywordLimit: 100,       // キーワード検索の中間結果を100件に増加
      schema: 'long_term',     // 検索対象スキーマ
      table: 'knowledge_items' // 検索対象テーブル
    });
    
    console.log('カスタムオプションを使用した検索結果:');
    console.log(customResults);
  } catch (error) {
    console.error('エラー:', error);
  }
}

runCustomExample();
```

## 5. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js基本実装について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的実装）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-staged.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型実装）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive.md)
