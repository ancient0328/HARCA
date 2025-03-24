---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - フィルタリング検索）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - フィルタリング検索）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、フィルタリング検索の実装について説明します。フィルタリング検索とは、ベクトル検索やキーワード検索に加えて、メタデータによるフィルタリングを組み合わせた検索手法です。

## 2. 前提条件

フィルタリング検索の実装には、以下のモジュールが必要です：

- `db-config.js`：データベース接続設定
- `embedding-util.js`：埋め込み生成ユーティリティ
- `query-util.js`：クエリ前処理ユーティリティ

これらのモジュールの詳細については、[ハイブリッド検索（Node.js基本実装 - 設定）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-config.md)を参照してください。

## 3. フィルタリング検索の実装

フィルタリング検索では、ベクトル検索やキーワード検索に加えて、メタデータによるフィルタリングを組み合わせます。以下に、フィルタリング検索の実装を示します：

```javascript
// filtered-hybrid-search.js
const { db } = require('./db-config');
const { generateEmbedding } = require('./embedding-util');
const { preprocessQuery } = require('./query-util');

/**
 * フィルタリングハイブリッド検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} filters - メタデータフィルター
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function filteredHybridSearch(query, filters = {}, options = {}) {
  // デフォルトオプション
  const defaultOptions = {
    limit: 10,                // 最終結果の上限数
    vectorWeight: 0.6,        // ベクトル検索の重み
    keywordWeight: 0.4,       // キーワード検索の重み
    useVector: true,          // ベクトル検索を使用するかどうか
    useKeyword: true,         // キーワード検索を使用するかどうか
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
    
    // クエリからベクトル埋め込みを生成（ベクトル検索を使用する場合のみ）
    let queryEmbedding = null;
    if (mergedOptions.useVector) {
      queryEmbedding = await generateEmbedding(query);
    }
    
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
      ? `WHERE ${filterConditions.join(' AND ')}` 
      : '';
    
    // 検索クエリの構築
    let query = '';
    let queryParams = [];
    
    if (mergedOptions.useVector && mergedOptions.useKeyword && processedQuery.tsquery) {
      // ベクトル検索とキーワード検索の両方を使用
      query = `
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
          ${mergedOptions.schema}.${mergedOptions.table} k
        JOIN 
          ${mergedOptions.schema}.${mergedOptions.vectorTable} kv 
          ON k.${mergedOptions.idColumn} = kv.${mergedOptions.vectorIdColumn}
        ${filterConditionStr}
        ${filterConditions.length > 0 ? 'AND' : 'WHERE'} 
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
        SELECT 
          k.${mergedOptions.idColumn}, 
          k.${mergedOptions.nameColumn}, 
          k.${mergedOptions.contentColumn},
          k.${mergedOptions.typeColumn},
          k.${mergedOptions.metadataColumn},
          kv.${mergedOptions.embeddingColumn} <=> $${paramIndex} AS vector_distance
        FROM 
          ${mergedOptions.schema}.${mergedOptions.table} k
        JOIN 
          ${mergedOptions.schema}.${mergedOptions.vectorTable} kv 
          ON k.${mergedOptions.idColumn} = kv.${mergedOptions.vectorIdColumn}
        ${filterConditionStr}
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
        SELECT 
          k.${mergedOptions.idColumn}, 
          k.${mergedOptions.nameColumn}, 
          k.${mergedOptions.contentColumn},
          k.${mergedOptions.typeColumn},
          k.${mergedOptions.metadataColumn},
          ts_rank(k.${mergedOptions.tsvColumn}, to_tsquery('english', $${paramIndex})) AS keyword_rank
        FROM 
          ${mergedOptions.schema}.${mergedOptions.table} k
        ${filterConditionStr}
        ${filterConditions.length > 0 ? 'AND' : 'WHERE'} 
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
    console.error('フィルタリングハイブリッド検索エラー:', error);
    throw error;
  }
}

module.exports = { filteredHybridSearch };
```

この実装では、以下の処理を行っています：

1. クエリの前処理とベクトル埋め込みの生成（必要な場合）
2. フィルター条件の構築（タイプ、メタデータ、その他のカラム）
3. 検索クエリの構築（ベクトル検索、キーワード検索、フィルターの組み合わせ）
4. クエリの実行と結果の返却

### 3.1 フィルターの種類

フィルタリング検索では、以下の種類のフィルターを使用できます：

1. **タイプフィルター**：アイテムのタイプによるフィルタリング
2. **メタデータフィルター**：JSONBフィールドに格納されたメタデータによるフィルタリング
3. **その他のカラムフィルター**：その他のカラムによるフィルタリング

### 3.2 検索の組み合わせ

フィルタリング検索では、以下の検索の組み合わせを使用できます：

1. **ベクトル検索 + キーワード検索 + フィルター**：すべての検索を組み合わせる
2. **ベクトル検索 + フィルター**：ベクトル検索とフィルターを組み合わせる
3. **キーワード検索 + フィルター**：キーワード検索とフィルターを組み合わせる
4. **フィルターのみ**：フィルターのみを使用する

## 4. メタデータフィルタリングの最適化

メタデータフィルタリングを最適化するには、以下の方法があります：

### 4.1 JSONB インデックスの作成

メタデータフィールドがJSONB型の場合、特定のキーに対するインデックスを作成することで、検索パフォーマンスを向上させることができます：

```sql
-- メタデータの特定のキーに対するインデックスを作成
CREATE INDEX idx_knowledge_items_metadata_category ON long_term.knowledge_items USING GIN ((metadata -> 'category'));
CREATE INDEX idx_knowledge_items_metadata_source ON long_term.knowledge_items USING GIN ((metadata -> 'source'));
```

### 4.2 複合フィルタリングの最適化

複数のフィルター条件を組み合わせる場合、最も選択性の高いフィルターを最初に適用することで、パフォーマンスを向上させることができます：

```javascript
// optimized-filtered-hybrid-search.js
async function optimizedFilteredHybridSearch(query, filters = {}, options = {}) {
  // デフォルトオプションは同じ
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    // フィルターの選択性を評価
    const filterSelectivity = await evaluateFilterSelectivity(filters, mergedOptions);
    
    // 選択性の高い順にフィルターを並べ替え
    const sortedFilters = Object.entries(filters).sort((a, b) => {
      return filterSelectivity[a[0]] - filterSelectivity[b[0]];
    });
    
    // 並べ替えたフィルターを使用して検索を実行
    // （実装は省略）
  } catch (error) {
    console.error('最適化されたフィルタリングハイブリッド検索エラー:', error);
    throw error;
  }
}

/**
 * フィルターの選択性を評価する
 * @param {object} filters - メタデータフィルター
 * @param {object} options - 検索オプション
 * @returns {Promise<object>} - フィルターごとの選択性
 */
async function evaluateFilterSelectivity(filters, options) {
  const selectivity = {};
  const totalCount = await db.one(`SELECT COUNT(*) FROM ${options.schema}.${options.table}`, []);
  
  // 各フィルターの選択性を評価
  for (const [key, value] of Object.entries(filters)) {
    let query = '';
    if (key === 'type') {
      query = `SELECT COUNT(*) FROM ${options.schema}.${options.table} WHERE ${options.typeColumn} = $1`;
    } else if (key === 'metadata' && typeof value === 'object') {
      // メタデータの各キーの選択性を評価
      for (const [metaKey, metaValue] of Object.entries(value)) {
        query = `SELECT COUNT(*) FROM ${options.schema}.${options.table} WHERE ${options.metadataColumn}->>'${metaKey}' = $1`;
        const count = await db.one(query, [metaValue]);
        selectivity[`metadata.${metaKey}`] = parseFloat(count.count) / totalCount.count;
      }
      continue;
    } else {
      query = `SELECT COUNT(*) FROM ${options.schema}.${options.table} WHERE ${key} = $1`;
    }
    
    const count = await db.one(query, [value]);
    selectivity[key] = parseFloat(count.count) / totalCount.count;
  }
  
  return selectivity;
}
```

この最適化では、各フィルターの選択性（全体の何パーセントのレコードがフィルターに一致するか）を評価し、最も選択性の高いフィルター（一致するレコードが少ないフィルター）を最初に適用しています。

## 5. 使用例

以下の例では、フィルタリングハイブリッド検索を使用して検索を実行する方法を示します：

```javascript
// example.js
const { filteredHybridSearch } = require('./filtered-hybrid-search');

async function example() {
  try {
    // フィルタリングハイブリッド検索の実行
    const results = await filteredHybridSearch(
      'ニューラルネットワークの学習方法について教えて',
      {
        type: 'article',
        metadata: {
          category: 'machine_learning',
          difficulty: 'intermediate'
        }
      }
    );
    
    // 結果の表示
    console.log(`検索結果: ${results.length}件`);
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ${result.name} (タイプ: ${result.type})`);
      console.log(`  カテゴリ: ${result.metadata.category}`);
      console.log(`  難易度: ${result.metadata.difficulty}`);
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

フィルタリングハイブリッド検索では、様々なオプションをカスタマイズすることができます：

```javascript
// custom-example.js
const { filteredHybridSearch } = require('./filtered-hybrid-search');

async function customExample() {
  try {
    // カスタムオプションを指定したフィルタリングハイブリッド検索
    const results = await filteredHybridSearch(
      '機械学習アルゴリズムの比較',
      {
        type: 'tutorial',
        metadata: {
          language: 'japanese'
        }
      },
      {
        limit: 5,                // 最終結果を5件に制限
        vectorWeight: 0.8,       // ベクトル検索の重みを増加
        keywordWeight: 0.2,      // キーワード検索の重みを減少
        useVector: true,         // ベクトル検索を使用
        useKeyword: true,        // キーワード検索を使用
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

## 6. 日本語検索のサポート

フィルタリングハイブリッド検索で日本語検索をサポートするには、以下の変更が必要です：

```javascript
// japanese-filtered-hybrid-search.js
const { db } = require('./db-config');
const { generateEmbedding } = require('./embedding-util');
const { preprocessJapaneseQuery } = require('./japanese-query-util');

/**
 * 日本語対応フィルタリングハイブリッド検索を実行する
 * @param {string} query - 検索クエリ
 * @param {object} filters - メタデータフィルター
 * @param {object} options - 検索オプション
 * @returns {Promise<Array>} - 検索結果
 */
async function japaneseFilteredHybridSearch(query, filters = {}, options = {}) {
  // デフォルトオプション（言語設定を追加）
  const defaultOptions = {
    // 他のオプションは同じ
    language: 'japanese', // 言語設定
    tsvColumn: 'content_ja_tsv' // 日本語用tsvector列名
  };
  
  // オプションをマージ
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    // 日本語クエリの前処理
    const processedQuery = await preprocessJapaneseQuery(query);
    
    // 以下、filteredHybridSearchと同様の実装
    // ただし、to_tsquery関数の第一引数を'english'から'japanese'に変更
    // 例: to_tsquery('japanese', $1)
    
    // 実装は省略
  } catch (error) {
    console.error('日本語対応フィルタリングハイブリッド検索エラー:', error);
    throw error;
  }
}

module.exports = { japaneseFilteredHybridSearch };
```

日本語検索をサポートするには、以下の追加モジュールが必要です：

```javascript
// japanese-query-util.js
const kuromoji = require('kuromoji');

// kuromojiトークナイザーの初期化
let tokenizer = null;
const initializeTokenizer = () => {
  return new Promise((resolve, reject) => {
    if (tokenizer) {
      resolve(tokenizer);
      return;
    }
    
    kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, _tokenizer) => {
      if (err) {
        reject(err);
        return;
      }
      tokenizer = _tokenizer;
      resolve(tokenizer);
    });
  });
};

/**
 * 日本語クエリを前処理する
 * @param {string} query - 検索クエリ
 * @returns {Promise<object>} - 前処理されたクエリ情報
 */
async function preprocessJapaneseQuery(query) {
  try {
    // kuromojiトークナイザーの初期化
    const tokenizer = await initializeTokenizer();
    
    // クエリのトークン化
    const tokens = tokenizer.tokenize(query);
    
    // 重要な品詞のみを抽出（名詞、動詞、形容詞など）
    const importantTokens = tokens.filter(token => {
      const pos = token.pos;
      return pos === '名詞' || pos === '動詞' || pos === '形容詞' || pos === '形容動詞';
    });
    
    // トークンの基本形を取得
    const baseforms = importantTokens.map(token => token.basic_form || token.surface_form);
    
    // 重複を排除
    const uniqueBaseforms = [...new Set(baseforms)];
    
    // tsqueryの形式に変換
    const tsquery = uniqueBaseforms.join(' & ');
    
    return {
      originalQuery: query,
      tokens: importantTokens,
      baseforms: uniqueBaseforms,
      tsquery: tsquery
    };
  } catch (error) {
    console.error('日本語クエリ前処理エラー:', error);
    throw error;
  }
}

module.exports = { preprocessJapaneseQuery };
```

また、PostgreSQLで日本語全文検索をサポートするには、以下のような設定が必要です：

```sql
-- 日本語全文検索用の設定
CREATE TEXT SEARCH CONFIGURATION japanese (COPY = simple);
CREATE TEXT SEARCH DICTIONARY japanese_dict (
    TEMPLATE = simple
);
ALTER TEXT SEARCH CONFIGURATION japanese
    ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part
    WITH japanese_dict;

-- 日本語用tsvector列の追加
ALTER TABLE long_term.knowledge_items
ADD COLUMN content_ja_tsv tsvector;

-- 日本語用tsvector列の更新関数
CREATE OR REPLACE FUNCTION update_japanese_tsv()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_ja_tsv = to_tsvector('japanese', NEW.content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
CREATE TRIGGER update_knowledge_items_ja_tsv
BEFORE INSERT OR UPDATE ON long_term.knowledge_items
FOR EACH ROW
EXECUTE FUNCTION update_japanese_tsv();

-- 日本語用tsvector列のインデックス
CREATE INDEX idx_knowledge_items_content_ja_tsv ON long_term.knowledge_items USING GIN (content_ja_tsv);
```

## 7. パフォーマンスに関する考慮事項

フィルタリングハイブリッド検索のパフォーマンスを最適化するには、以下の点に注意する必要があります：

1. **インデックスの作成**：フィルタリングに使用するカラムには、適切なインデックスを作成する必要があります。特に、メタデータフィールドがJSONB型の場合、特定のキーに対するインデックスを作成することが重要です。

2. **クエリの最適化**：複数のフィルター条件を組み合わせる場合、最も選択性の高いフィルターを最初に適用することで、パフォーマンスを向上させることができます。

3. **結果のキャッシュ**：頻繁に使用されるフィルター条件に対しては、結果をキャッシュすることで、パフォーマンスを向上させることができます。

4. **クエリプランの分析**：実際のクエリプランを分析し、ボトルネックを特定することが重要です。PostgreSQLの`EXPLAIN ANALYZE`コマンドを使用して、クエリプランを分析することができます。

## 8. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、フィルタリング検索の実装について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - キーワードファースト）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-keyword-first.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - ベクトルファースト）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-vector-first.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js段階的検索 - メタデータフィルタリング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-metadata-filtering.md)
