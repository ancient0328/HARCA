---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - メタデータフィルタリング）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - メタデータフィルタリング）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、メタデータフィルタリングを用いた段階的検索の実装について説明します。メタデータフィルタリングを用いた段階的検索とは、メタデータによるフィルタリングを最初に適用し、その結果に対してベクトル検索やキーワード検索を適用する手法です。

## 2. 前提条件

メタデータフィルタリングを用いた段階的検索の実装には、以下のモジュールが必要です：

- `db-config.js`：データベース接続設定
- `embedding-util.js`：埋め込み生成ユーティリティ
- `query-util.js`：クエリ前処理ユーティリティ

これらのモジュールの詳細については、[ハイブリッド検索（Node.js基本実装 - 設定）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-config.md)を参照してください。

## 3. メタデータフィルタリングを用いた段階的検索の実装

メタデータフィルタリングを用いた段階的検索では、メタデータによるフィルタリングを最初に適用し、その結果に対してベクトル検索やキーワード検索を適用します。以下に、メタデータフィルタリングを用いた段階的検索の実装を示します：

```javascript
// metadata-first-search.js
const { db } = require('./db-config');
const { generateEmbedding } = require('./embedding-util');
const { preprocessQuery, extractMetadataFilters } = require('./query-util');

/**
 * メタデータフィルタリングを用いた段階的検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function metadataFirstSearch(query, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,                // 最終結果の上限数
    vectorWeight: 0.6,        // ベクトル検索の重み
    keywordWeight: 0.4,       // キーワード検索の重み
    useVector: true,          // ベクトル検索を使用するかどうか
    useKeyword: true,         // キーワード検索を使用するかどうか
    extractMetadata: true,    // クエリからメタデータを抽出するかどうか
    schema: 'long_term',      // 検索対象スキーマ
    table: 'knowledge_items', // 検索対象テーブル
    vectorTable: 'knowledge_vectors', // ベクトルテーブル
    idColumn: 'id',           // ID列名
    contentColumn: 'content', // コンテンツ列名
    nameColumn: 'name',       // 名前列名
    typeColumn: 'type',       // タイプ列名
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
    
    // クエリからメタデータフィルターを抽出（オプション）
    let metadataFilters = {};
    let cleanedQuery = query;
    
    if (mergedOptions.extractMetadata) {
      const extractionResult = extractMetadataFilters(query);
      metadataFilters = extractionResult.filters;
      cleanedQuery = extractionResult.cleanedQuery;
      
      // クリーニングされたクエリで前処理を再実行
      if (cleanedQuery !== query) {
        processedQuery.originalQuery = cleanedQuery;
        processedQuery.tsquery = preprocessQuery(cleanedQuery).tsquery;
      }
    }
    
    // クエリからベクトル埋め込みを生成（ベクトル検索を使用する場合のみ）
    let queryEmbedding = null;
    if (mergedOptions.useVector) {
      queryEmbedding = await generateEmbedding(cleanedQuery);
    }
    
    // フィルター条件の構築
    const filterConditions = [];
    const filterValues = [];
    let paramIndex = 1;
    
    // フィルターのパラメータ化
    Object.entries(metadataFilters).forEach(([key, value]) => {
      if (key === 'type') {
        // タイプによるフィルタリング
        filterConditions.push(`k.${mergedOptions.typeColumn} = $${paramIndex}`);
        filterValues.push(value);
        paramIndex++;
      } else {
        // メタデータによるフィルタリング（JSONBフィールドを想定）
        filterConditions.push(`k.${mergedOptions.metadataColumn}->>'${key}' = $${paramIndex}`);
        filterValues.push(value);
        paramIndex++;
      }
    });
    
    // フィルター条件の文字列
    const filterConditionStr = filterConditions.length > 0 
      ? `WHERE ${filterConditions.join(' AND ')}` 
      : '';
    
    // 検索クエリの構築
    let query = '';
    let queryParams = [];
    
    if (mergedOptions.useVector && mergedOptions.useKeyword && processedQuery.tsquery) {
      // ベクトル検索とキーワード検索の両方を使用
      query = `
        WITH filtered_items AS (
          SELECT 
            k.${mergedOptions.idColumn}
          FROM 
            ${mergedOptions.schema}.${mergedOptions.table} k
          ${filterConditionStr}
        )
        
        SELECT 
          k.${mergedOptions.idColumn}, 
          k.${mergedOptions.nameColumn}, 
          k.${mergedOptions.contentColumn},
          k.${mergedOptions.typeColumn},
          k.${mergedOptions.metadataColumn},
          kv.${mergedOptions.embeddingColumn} <=> $${paramIndex} AS vector_distance,
          ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $${paramIndex + 1})) AS keyword_rank,
          (kv.${mergedOptions.embeddingColumn} <=> $${paramIndex}) * $${paramIndex + 2} + 
          (1.0 - ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $${paramIndex + 1}))) * $${paramIndex + 3} AS combined_score
        FROM 
          filtered_items fi
        JOIN 
          ${mergedOptions.schema}.${mergedOptions.table} k ON k.${mergedOptions.idColumn} = fi.${mergedOptions.idColumn}
        JOIN 
          ${mergedOptions.schema}.${mergedOptions.vectorTable} kv ON kv.${mergedOptions.vectorIdColumn} = k.${mergedOptions.idColumn}
        WHERE 
          k.${mergedOptions.tsvColumn} @@ to_tsquery('english', $${paramIndex + 1})
        ORDER BY 
          combined_score
        LIMIT $${paramIndex + 4}
      `;
      queryParams = [
        ...filterValues,
        queryEmbedding,
        processedQuery.tsquery,
        mergedOptions.vectorWeight,
        mergedOptions.keywordWeight,
        mergedOptions.limit
      ];
    } else if (mergedOptions.useVector) {
      // ベクトル検索のみを使用
      query = `
        WITH filtered_items AS (
          SELECT 
            k.${mergedOptions.idColumn}
          FROM 
            ${mergedOptions.schema}.${mergedOptions.table} k
          ${filterConditionStr}
        )
        
        SELECT 
          k.${mergedOptions.idColumn}, 
          k.${mergedOptions.nameColumn}, 
          k.${mergedOptions.contentColumn},
          k.${mergedOptions.typeColumn},
          k.${mergedOptions.metadataColumn},
          kv.${mergedOptions.embeddingColumn} <=> $${paramIndex} AS vector_distance
        FROM 
          filtered_items fi
        JOIN 
          ${mergedOptions.schema}.${mergedOptions.table} k ON k.${mergedOptions.idColumn} = fi.${mergedOptions.idColumn}
        JOIN 
          ${mergedOptions.schema}.${mergedOptions.vectorTable} kv ON kv.${mergedOptions.vectorIdColumn} = k.${mergedOptions.idColumn}
        ORDER BY 
          vector_distance
        LIMIT $${paramIndex + 1}
      `;
      queryParams = [
        ...filterValues,
        queryEmbedding,
        mergedOptions.limit
      ];
    } else if (mergedOptions.useKeyword && processedQuery.tsquery) {
      // キーワード検索のみを使用
      query = `
        WITH filtered_items AS (
          SELECT 
            k.${mergedOptions.idColumn}
          FROM 
            ${mergedOptions.schema}.${mergedOptions.table} k
          ${filterConditionStr}
        )
        
        SELECT 
          k.${mergedOptions.idColumn}, 
          k.${mergedOptions.nameColumn}, 
          k.${mergedOptions.contentColumn},
          k.${mergedOptions.typeColumn},
          k.${mergedOptions.metadataColumn},
          ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $${paramIndex})) AS keyword_rank
        FROM 
          filtered_items fi
        JOIN 
          ${mergedOptions.schema}.${mergedOptions.table} k ON k.${mergedOptions.idColumn} = fi.${mergedOptions.idColumn}
        WHERE 
          k.${mergedOptions.tsvColumn} @@ to_tsquery('english', $${paramIndex})
        ORDER BY 
          keyword_rank DESC
        LIMIT $${paramIndex + 1}
      `;
      queryParams = [
        ...filterValues,
        processedQuery.tsquery,
        mergedOptions.limit
      ];
    } else {
      // フィルターのみを使用
      query = `
        SELECT 
          k.${mergedOptions.idColumn}, 
          k.${mergedOptions.nameColumn}, 
          k.${mergedOptions.contentColumn},
          k.${mergedOptions.typeColumn},
          k.${mergedOptions.metadataColumn}
        FROM 
          ${mergedOptions.schema}.${mergedOptions.table} k
        ${filterConditionStr}
        LIMIT $${paramIndex}
      `;
      queryParams = [
        ...filterValues,
        mergedOptions.limit
      ];
    }
    
    // クエリの実行
    return db.any(query, queryParams);
  } catch (error) {
    console.error('メタデータフィルタリングを用いた段階的検索エラー:', error);
    throw error;
  }
}

module.exports = { metadataFirstSearch };
```

この実装では、以下の処理を行っています：

1. クエリの前処理
2. クエリからメタデータフィルターを抽出（オプション）
3. クエリからベクトル埋め込みを生成（ベクトル検索を使用する場合のみ）
4. フィルター条件の構築
5. 検索クエリの構築（ベクトル検索、キーワード検索、フィルターの組み合わせ）
6. クエリの実行と結果の返却

### 3.1 クエリからのメタデータフィルター抽出

クエリからメタデータフィルターを抽出するには、以下のような関数を実装します：

```javascript
// query-util.js
/**
 * クエリからメタデータフィルターを抽出する
 * @param {string} query - 検索クエリ
 * @returns {object} - 抽出されたフィルターとクリーニングされたクエリ
 */
function extractMetadataFilters(query) {
  const filters = {};
  
  // タイプフィルターの抽出パターン
  const typePattern = /type:(\w+)/gi;
  let typeMatch;
  while ((typeMatch = typePattern.exec(query)) !== null) {
    filters.type = typeMatch[1].toLowerCase();
  }
  
  // カテゴリフィルターの抽出パターン
  const categoryPattern = /category:(\w+)/gi;
  let categoryMatch;
  while ((categoryMatch = categoryPattern.exec(query)) !== null) {
    filters.category = categoryMatch[1].toLowerCase();
  }
  
  // 言語フィルターの抽出パターン
  const languagePattern = /language:(\w+)/gi;
  let languageMatch;
  while ((languageMatch = languagePattern.exec(query)) !== null) {
    filters.language = languageMatch[1].toLowerCase();
  }
  
  // 難易度フィルターの抽出パターン
  const difficultyPattern = /difficulty:(\w+)/gi;
  let difficultyMatch;
  while ((difficultyMatch = difficultyPattern.exec(query)) !== null) {
    filters.difficulty = difficultyMatch[1].toLowerCase();
  }
  
  // 日付フィルターの抽出パターン
  const datePattern = /date:(\d{4}-\d{2}-\d{2})/gi;
  let dateMatch;
  while ((dateMatch = datePattern.exec(query)) !== null) {
    filters.date = dateMatch[1];
  }
  
  // クエリからフィルターパターンを削除
  let cleanedQuery = query
    .replace(/type:\w+\s*/gi, '')
    .replace(/category:\w+\s*/gi, '')
    .replace(/language:\w+\s*/gi, '')
    .replace(/difficulty:\w+\s*/gi, '')
    .replace(/date:\d{4}-\d{2}-\d{2}\s*/gi, '')
    .trim();
  
  return {
    filters,
    cleanedQuery
  };
}
```

この関数では、クエリから以下のようなパターンのメタデータフィルターを抽出しています：

- `type:article`：タイプフィルター
- `category:machine_learning`：カテゴリフィルター
- `language:japanese`：言語フィルター
- `difficulty:intermediate`：難易度フィルター
- `date:2025-03-24`：日付フィルター

抽出されたフィルターはオブジェクトとして返され、クエリからフィルターパターンを削除したクリーニングされたクエリも返されます。

## 4. メタデータフィルタリングの最適化

メタデータフィルタリングを最適化するには、以下の方法があります：

### 4.1 インデックスの最適化

メタデータフィルタリングのパフォーマンスを最適化するには、以下のようなインデックスを作成することが重要です：

```sql
-- タイプ列のインデックスを作成
CREATE INDEX idx_knowledge_items_type ON long_term.knowledge_items (type);

-- メタデータ列のJSONBインデックスを作成
CREATE INDEX idx_knowledge_items_metadata_category ON long_term.knowledge_items USING GIN ((metadata -> 'category'));
CREATE INDEX idx_knowledge_items_metadata_language ON long_term.knowledge_items USING GIN ((metadata -> 'language'));
CREATE INDEX idx_knowledge_items_metadata_difficulty ON long_term.knowledge_items USING GIN ((metadata -> 'difficulty'));
CREATE INDEX idx_knowledge_items_metadata_date ON long_term.knowledge_items USING GIN ((metadata -> 'date'));
```

### 4.2 クエリの最適化

メタデータフィルタリングを用いた段階的検索のクエリを最適化するには、以下の方法があります：

```javascript
// optimized-metadata-first-search.js
async function optimizedMetadataFirstSearch(query, options = {}) {
  // デフォルトオプションは同じ
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    // クエリの前処理とメタデータフィルターの抽出
    // 実装は省略（metadataFirstSearchと同様）
    
    // フィルター条件の構築
    // 実装は省略（metadataFirstSearchと同様）
    
    // 最適化されたクエリの構築
    // 1. メタデータフィルタリングを最初に適用
    // 2. フィルタリング結果の数を確認
    // 3. 結果数に応じて検索戦略を選択
    
    // ステップ1: メタデータフィルタリングを適用
    const filteredCount = await db.one(
      `SELECT COUNT(*) FROM ${mergedOptions.schema}.${mergedOptions.table} k ${filterConditionStr}`,
      filterValues
    );
    
    // ステップ2: フィルタリング結果の数を確認
    const count = parseInt(filteredCount.count);
    
    // ステップ3: 結果数に応じて検索戦略を選択
    if (count === 0) {
      // フィルタリング結果がない場合は空の配列を返す
      return [];
    } else if (count <= 100) {
      // フィルタリング結果が少ない場合は、すべての結果に対してベクトル検索を実行
      // 実装は省略
    } else if (count <= 1000) {
      // フィルタリング結果が中程度の場合は、キーワード検索を先に適用
      // 実装は省略
    } else {
      // フィルタリング結果が多い場合は、より厳密なフィルタリングを提案
      console.log(`フィルタリング結果が多すぎます（${count}件）。より厳密なフィルタリングを検討してください。`);
      // 実装は省略
    }
  } catch (error) {
    console.error('最適化されたメタデータフィルタリングを用いた段階的検索エラー:', error);
    throw error;
  }
}
```

この最適化では、メタデータフィルタリングの結果数に応じて検索戦略を選択しています。結果数が少ない場合はすべての結果に対してベクトル検索を実行し、結果数が多い場合はより厳密なフィルタリングを提案しています。

## 5. 使用例

以下の例では、メタデータフィルタリングを用いた段階的検索を使用して検索を実行する方法を示します：

```javascript
// example.js
const { metadataFirstSearch } = require('./metadata-first-search');

async function example() {
  try {
    // メタデータフィルタリングを用いた段階的検索の実行
    const results = await metadataFirstSearch('type:article category:machine_learning ニューラルネットワークの学習方法について教えて');
    
    // 結果の表示
    console.log(`検索結果: ${results.length}件`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.name} (タイプ: ${result.type})`);
      console.log(`  カテゴリ: ${result.metadata.category}`);
      if (result.vector_distance !== undefined) {
        console.log(`  ベクトル距離: ${result.vector_distance}`);
      }
      if (result.keyword_rank !== undefined) {
        console.log(`  キーワードランク: ${result.keyword_rank}`);
      }
      if (result.combined_score !== undefined) {
        console.log(`  組み合わせスコア: ${result.combined_score}`);
      }
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

メタデータフィルタリングを用いた段階的検索では、様々なオプションをカスタマイズすることができます：

```javascript
// custom-example.js
const { metadataFirstSearch } = require('./metadata-first-search');

async function customExample() {
  try {
    // カスタムオプションを指定したメタデータフィルタリングを用いた段階的検索
    const results = await metadataFirstSearch(
      'type:tutorial language:japanese 機械学習アルゴリズムの比較',
      {
        limit: 5,                // 最終結果を5件に制限
        vectorWeight: 0.8,       // ベクトル検索の重みを増加
        keywordWeight: 0.2,      // キーワード検索の重みを減少
        useVector: true,         // ベクトル検索を使用
        useKeyword: true,        // キーワード検索を使用
        extractMetadata: true,   // クエリからメタデータを抽出
        schema: 'long_term',     // 検索対象スキーマ
        table: 'knowledge_items' // 検索対象テーブル
      }
    );
    
    // 結果の表示
    console.log(`検索結果: ${results.length}件`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.name} (タイプ: ${result.type}, 言語: ${result.metadata.language})`);
    });
  } catch (error) {
    console.error('エラー:', error);
  }
}

customExample();
```

## 6. 明示的なフィルターとの組み合わせ

クエリからのメタデータフィルター抽出と明示的なフィルターを組み合わせることで、より柔軟な検索を実現することができます：

```javascript
// combined-metadata-search.js
const { metadataFirstSearch } = require('./metadata-first-search');

/**
 * クエリからのメタデータフィルター抽出と明示的なフィルターを組み合わせた検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} explicitFilters - 明示的なフィルター
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function combinedMetadataSearch(query, explicitFilters = {}, options = {}) {
  try {
    // クエリからメタデータフィルターを抽出
    const extractionResult = extractMetadataFilters(query);
    const queryFilters = extractionResult.filters;
    const cleanedQuery = extractionResult.cleanedQuery;
    
    // 明示的なフィルターとクエリからのフィルターを組み合わせる
    // 明示的なフィルターが優先される
    const combinedFilters = { ...queryFilters, ...explicitFilters };
    
    // メタデータフィルタリングを用いた段階的検索を実行
    return metadataFirstSearch(cleanedQuery, {
      ...options,
      extractMetadata: false, // 既にメタデータを抽出済みなので、再抽出しない
      filters: combinedFilters
    });
  } catch (error) {
    console.error('組み合わせメタデータ検索エラー:', error);
    throw error;
  }
}
```

この実装では、クエリからのメタデータフィルター抽出と明示的なフィルターを組み合わせています。明示的なフィルターが優先されるため、クエリからのフィルターと競合する場合は明示的なフィルターが使用されます。

## 7. パフォーマンスに関する考慮事項

メタデータフィルタリングを用いた段階的検索のパフォーマンスを最適化するには、以下の点に注意する必要があります：

1. **インデックスの作成**：メタデータフィルタリングに使用するカラムには、適切なインデックスを作成する必要があります。特に、メタデータフィールドがJSONB型の場合、特定のキーに対するインデックスを作成することが重要です。

2. **フィルタリング結果の数の確認**：フィルタリング結果の数を確認し、結果数に応じて検索戦略を選択することで、パフォーマンスを向上させることができます。

3. **クエリの最適化**：複数のフィルター条件を組み合わせる場合、最も選択性の高いフィルターを最初に適用することで、パフォーマンスを向上させることができます。

4. **結果のキャッシュ**：頻繁に使用されるフィルター条件に対しては、結果をキャッシュすることで、パフォーマンスを向上させることができます。

## 8. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、メタデータフィルタリングを用いた段階的検索の実装について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - 再ランキング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-reranking.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js実装 - パフォーマンス最適化）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-performance-optimization.md)
