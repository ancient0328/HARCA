---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - 設定）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - 設定）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装に必要な基本設定について説明します。データベース接続設定、埋め込み生成ユーティリティ、クエリ前処理ユーティリティなど、ハイブリッド検索の実装に必要な基本的なコンポーネントを紹介します。

## 2. 必要なパッケージ

ハイブリッド検索の実装に必要なパッケージは以下の通りです：

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

これらのパッケージをインストールするには、以下のコマンドを実行します：

```bash
pnpm add pg-promise openai natural dotenv
```

## 3. データベース接続設定

ハイブリッド検索の実装には、PostgreSQLデータベースへの接続が必要です。以下のモジュールでは、環境変数を使用してデータベース接続情報を管理します：

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

この設定では、環境変数が設定されていない場合のデフォルト値も指定しています。実際の環境では、`.env`ファイルまたは環境変数を適切に設定してください。

### 3.1 環境変数の設定例

```
# .env.example
POSTGRES_HOST=localhost
POSTGRES_PORT=3730
POSTGRES_DB=harca_memory
POSTGRES_USER=harca_user
POSTGRES_PASSWORD=harca_password
OPENAI_API_KEY=your_openai_api_key
```

## 4. 埋め込み生成ユーティリティ

ベクトル検索を実行するには、テキストから埋め込みベクトルを生成する必要があります。以下のモジュールでは、OpenAI APIを使用して埋め込みを生成します：

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

このモジュールでは、OpenAIのAda 002モデルを使用して埋め込みを生成しています。他の埋め込みモデルを使用する場合は、`model`パラメータを適切に変更してください。

## 5. クエリ前処理ユーティリティ

効果的なハイブリッド検索を実現するには、検索クエリを適切に前処理する必要があります。以下のモジュールでは、自然言語処理ライブラリを使用してクエリを前処理します：

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

このモジュールでは、以下の処理を行っています：

1. クエリをトークン化（単語に分割）
2. ストップワード（冠詞、前置詞など）を除去
3. PostgreSQLのtsquery形式に変換
4. クエリが自然言語形式かどうかを判定
5. クエリの単語数をカウント

これらの情報は、後続のハイブリッド検索処理で使用されます。

## 6. 日本語対応

上記の例では英語のクエリを前提としていますが、日本語のクエリにも対応するには、以下のような修正が必要です：

```javascript
// query-util-ja.js
const { tokenize } = require('kuromoji');
const japaneseStopwords = ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ', 'ある', 'いる', 'も', 'する', 'から', 'な', 'こと', 'として', 'い', 'や', 'れる', 'など', 'なっ', 'ない', 'この', 'ため', 'その', 'あっ', 'よう', 'また', 'もの', 'という', 'あり', 'まで', 'られ', 'なる', 'へ', 'か', 'だ', 'これ', 'によって', 'により', 'おり', 'より', 'による', 'ず', 'なり', 'られる', 'において', 'ば', 'なかっ', 'なく', 'しかし', 'について', 'せ', 'だっ', 'その後', 'できる', 'それ', 'う', 'ので', 'なお', 'のみ', 'でき', 'き', 'つ', 'における', 'および', 'いう', 'さらに', 'でも', 'ら', 'たり', 'その他', 'に関する', 'たち', 'ます', 'ん', 'なら', 'に対して', '特に', 'せる', '及び', 'これら', 'とき', 'では', 'にて', 'ほか', 'ながら', 'うち', 'そして', 'とともに', 'ただし', 'かつて', 'それぞれ', 'または', 'お', 'ほど', 'ものの', 'に対する', 'ほとんど', 'と共に', 'といった', 'です', 'とも', 'ところ', 'ここ'];

// kuromoji初期化
let tokenizer;
const initializeTokenizer = () => {
  return new Promise((resolve, reject) => {
    if (tokenizer) {
      resolve(tokenizer);
      return;
    }
    
    tokenize({
      dicPath: 'node_modules/kuromoji/dict'
    }, (err, t) => {
      if (err) {
        reject(err);
        return;
      }
      tokenizer = t;
      resolve(tokenizer);
    });
  });
};

/**
 * 日本語検索クエリを前処理する
 * @param {string} query - 元の検索クエリ
 * @returns {Promise<object>} - 前処理されたクエリ情報
 */
async function preprocessJapaneseQuery(query) {
  // tokenizer初期化
  const t = await initializeTokenizer();
  
  // クエリをトークン化
  const tokens = t.tokenize(query);
  
  // 基本形を抽出し、ストップワードを除去
  const filteredTokens = tokens
    .map(token => token.basic_form)
    .filter(token => !japaneseStopwords.includes(token));
  
  // tsqueryフォーマットに変換（キーワード検索用）
  const tsquery = filteredTokens.join(' & ');
  
  // 自然言語クエリかどうかを判定
  const isNaturalLanguage = /^(何|どう|なぜ|いつ|どこ|誰|どの)/.test(query);
  
  return {
    originalQuery: query,
    tokens: tokens.map(token => token.surface_form),
    filteredTokens: filteredTokens,
    tsquery: tsquery,
    wordCount: filteredTokens.length,
    isNaturalLanguage: isNaturalLanguage
  };
}

module.exports = { preprocessJapaneseQuery };
```

このモジュールでは、kuromoji.jsを使用して日本語のトークン化を行っています。実際の実装では、`kuromoji`パッケージをインストールする必要があります：

```bash
pnpm add kuromoji
```

## 7. 使用例

以下の例では、作成したモジュールを使用して検索クエリを前処理する方法を示します：

```javascript
// example.js
const { preprocessQuery } = require('./query-util');
const { generateEmbedding } = require('./embedding-util');

async function example() {
  try {
    // クエリの前処理
    const query = 'How do neural networks learn?';
    const processedQuery = preprocessQuery(query);
    console.log('前処理されたクエリ:', processedQuery);
    
    // 埋め込みの生成
    const embedding = await generateEmbedding(query);
    console.log('埋め込みベクトルの長さ:', embedding.length);
    console.log('埋め込みベクトルの最初の5要素:', embedding.slice(0, 5));
  } catch (error) {
    console.error('エラー:', error);
  }
}

example();
```

## 8. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装に必要な基本設定について説明しました。次のドキュメントでは、これらの基本コンポーネントを使用して実際のハイブリッド検索を実装する方法について説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - 並列検索）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-parallel.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - 交差検索）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-intersection.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js基本実装 - フィルタリング検索）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-filtering.md)
