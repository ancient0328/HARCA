---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - 基本設定"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - 基本設定

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索機能の基本設定について詳細に説明します。pgvector拡張機能のインストールと設定、ベクトルデータ型とテーブル設計、および基本的なベクトル操作について記述します。

## 2. pgvector拡張機能のインストール

### 2.1 前提条件

- PostgreSQL 12以上
- PostgreSQLの開発パッケージ（`postgresql-server-dev-*`）
- C++コンパイラ（GCCまたはClang）

### 2.2 ソースからのインストール

```bash
# リポジトリのクローン
git clone https://github.com/pgvector/pgvector.git

# ディレクトリに移動
cd pgvector

# ビルドとインストール
make
make install
```

### 2.3 パッケージマネージャーからのインストール

#### Ubuntuの場合

```bash
# PostgreSQL APTリポジトリの追加
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update

# pgvectorのインストール
sudo apt-get install postgresql-14-pgvector
```

#### macOSの場合（Homebrewを使用）

```bash
brew install pgvector
```

### 2.4 Dockerを使用したインストール

```dockerfile
# Dockerfile
FROM postgres:14

# pgvectorのインストール
RUN apt-get update && apt-get install -y \
    postgresql-server-dev-14 \
    build-essential \
    git \
    && git clone https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install \
    && cd .. \
    && rm -rf pgvector \
    && apt-get remove -y postgresql-server-dev-14 build-essential git \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
```

### 2.5 拡張機能の有効化

データベースに接続し、拡張機能を有効化します：

```sql
-- pgvector拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- バージョン確認
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

## 3. ベクトルデータ型とテーブル設計

### 3.1 ベクトルデータ型

pgvectorは`vector`データ型を提供し、浮動小数点数の配列として高次元ベクトルを表現します。

```sql
-- vector型のカラムを持つテーブルの作成例
CREATE TABLE vector_items (
  id SERIAL PRIMARY KEY,
  embedding vector(384),  -- 384次元のベクトル
  content TEXT,
  metadata JSONB
);
```

ベクトルの次元数は、使用する埋め込みモデルによって異なります：

| 埋め込みモデル | 次元数 | 特徴 |
|--------------|------|------|
| OpenAI Ada 002 | 1536 | 高精度、汎用性が高い |
| OpenAI Ada 001 | 1024 | 旧バージョン |
| Cohere | 4096 | 非常に高次元、詳細な表現 |
| BERT | 768 | オープンソース、多言語対応 |
| MiniLM | 384 | 軽量、高速 |
| CLIP | 512 | マルチモーダル（テキスト・画像） |

### 3.2 HARCA記憶システム用のベクトルテーブル設計

HARCA多階層記憶システムでは、以下のようなベクトルテーブルを設計します：

#### 3.2.1 中期記憶（エピソード記憶）のベクトルテーブル

```sql
-- エピソード記憶のベクトルテーブル
CREATE TABLE mid_term.episode_vectors (
  id SERIAL PRIMARY KEY,
  episode_id INTEGER NOT NULL REFERENCES mid_term.episodes(id) ON DELETE CASCADE,
  embedding vector(1536),  -- OpenAI Ada 002を使用
  embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-ada-002',
  embedding_version VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- インデックス作成（後述）
CREATE INDEX ON mid_term.episode_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### 3.2.2 長期記憶（知識ベース）のベクトルテーブル

```sql
-- 知識ベースのベクトルテーブル
CREATE TABLE long_term.knowledge_vectors (
  id SERIAL PRIMARY KEY,
  knowledge_id INTEGER NOT NULL REFERENCES long_term.knowledge_items(id) ON DELETE CASCADE,
  embedding vector(1536),  -- OpenAI Ada 002を使用
  embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-ada-002',
  embedding_version VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- インデックス作成（後述）
CREATE INDEX ON long_term.knowledge_vectors USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

#### 3.2.3 長期記憶（ルールエンジン）のベクトルテーブル

```sql
-- ルールエンジンのベクトルテーブル
CREATE TABLE long_term.rule_vectors (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES long_term.rules(id) ON DELETE CASCADE,
  embedding vector(1536),  -- OpenAI Ada 002を使用
  embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-ada-002',
  embedding_version VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- インデックス作成（後述）
CREATE INDEX ON long_term.rule_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
```

### 3.3 ベクトルテーブルの設計原則

1. **参照整合性**: 親テーブルへの外部キー制約を設定し、CASCADE削除を使用
2. **メタデータ追跡**: 埋め込みモデルとバージョンを記録
3. **タイムスタンプ**: 作成日時と更新日時を記録
4. **インデックス**: 適切なベクトルインデックスを作成
5. **分離**: ベクトルデータを別テーブルに保存し、メインテーブルを軽量化

## 4. 基本的なベクトル操作

### 4.1 ベクトルの挿入

```sql
-- ベクトルデータの挿入
INSERT INTO long_term.knowledge_vectors (knowledge_id, embedding, embedding_model, embedding_version)
VALUES (
  123,  -- knowledge_id
  '[0.1, 0.2, 0.3, ..., 0.1536]'::vector,  -- embedding
  'text-embedding-ada-002',  -- embedding_model
  '2023-05'  -- embedding_version
);
```

### 4.2 ベクトル間の距離計算

pgvectorは以下の距離/類似度計算演算子をサポートしています：

| 演算子 | 説明 | 使用例 |
|-------|------|-------|
| `<->` | ユークリッド距離 | `embedding <-> '[0.1, 0.2, ...]'::vector` |
| `<=>` | コサイン距離 | `embedding <=> '[0.1, 0.2, ...]'::vector` |
| `<#>` | 内積の負数 | `embedding <#> '[0.1, 0.2, ...]'::vector` |

```sql
-- コサイン類似度に基づく検索（コサイン距離が小さいほど類似度が高い）
SELECT knowledge_id, embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM long_term.knowledge_vectors
ORDER BY distance
LIMIT 5;
```

### 4.3 ベクトル演算

```sql
-- ベクトルの加算
SELECT '[1, 2, 3]'::vector + '[4, 5, 6]'::vector;  -- [5, 7, 9]

-- ベクトルの減算
SELECT '[1, 2, 3]'::vector - '[4, 5, 6]'::vector;  -- [-3, -3, -3]

-- ベクトルのL2ノルム（長さ）
SELECT l2_norm('[3, 4]'::vector);  -- 5

-- ベクトルの正規化
SELECT vector_norm('[3, 4]'::vector);  -- [0.6, 0.8]
```

### 4.4 基本的なベクトル検索クエリ

```sql
-- 最も類似した知識アイテムを検索（コサイン類似度）
SELECT 
  k.id,
  k.name,
  k.content,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
ORDER BY 
  distance
LIMIT 10;

-- 最も類似したエピソードを検索（ユークリッド距離）
SELECT 
  e.id,
  e.title,
  e.description,
  ev.embedding <-> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  mid_term.episodes e
JOIN 
  mid_term.episode_vectors ev ON e.id = ev.episode_id
ORDER BY 
  distance
LIMIT 10;
```

## 5. Node.jsでの基本的なベクトル操作

### 5.1 pg-promiseを使用したベクトル操作

```javascript
const pgp = require('pg-promise')();
const db = pgp('postgres://username:password@localhost:3730/harca_memory');

// ベクトルの挿入
async function insertKnowledgeVector(knowledgeId, embedding, model = 'text-embedding-ada-002', version = '2023-05') {
  return db.none(
    'INSERT INTO long_term.knowledge_vectors(knowledge_id, embedding, embedding_model, embedding_version) ' +
    'VALUES($1, $2, $3, $4)',
    [knowledgeId, embedding, model, version]
  );
}

// ベクトル検索
async function searchSimilarKnowledge(queryEmbedding, limit = 10) {
  return db.any(
    'SELECT ' +
    '  k.id, ' +
    '  k.name, ' +
    '  k.content, ' +
    '  kv.embedding <=> $1 AS distance ' +
    'FROM ' +
    '  long_term.knowledge_items k ' +
    'JOIN ' +
    '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $2',
    [queryEmbedding, limit]
  );
}
```

### 5.2 Prismaを使用したベクトル操作

Prismaは現在、pgvectorの`vector`型を直接サポートしていないため、Raw SQLを使用する必要があります：

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ベクトルの挿入
async function insertKnowledgeVector(knowledgeId, embedding, model = 'text-embedding-ada-002', version = '2023-05') {
  // 文字列形式のベクトルに変換
  const vectorString = `[${embedding.join(',')}]`;
  
  return prisma.$executeRaw`
    INSERT INTO long_term.knowledge_vectors(knowledge_id, embedding, embedding_model, embedding_version)
    VALUES (${knowledgeId}, ${vectorString}::vector, ${model}, ${version})
  `;
}

// ベクトル検索
async function searchSimilarKnowledge(queryEmbedding, limit = 10) {
  // 文字列形式のベクトルに変換
  const vectorString = `[${queryEmbedding.join(',')}]`;
  
  return prisma.$queryRaw`
    SELECT
      k.id,
      k.name,
      k.content,
      kv.embedding <=> ${vectorString}::vector AS distance
    FROM
      long_term.knowledge_items k
    JOIN
      long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
    ORDER BY
      distance
    LIMIT ${limit}
  `;
}
```

## 6. 埋め込みベクトル生成

### 6.1 OpenAI APIを使用した埋め込み生成

```javascript
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// テキストからベクトル埋め込みを生成
async function generateEmbedding(text) {
  try {
    const response = await openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: text
    });
    
    return {
      embedding: response.data.data[0].embedding,
      model: 'text-embedding-ada-002',
      version: '2023-05'
    };
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// 知識アイテムの埋め込みを生成して保存
async function createKnowledgeItemWithEmbedding(knowledgeData) {
  // トランザクション内で実行
  return db.tx(async t => {
    // 1. 知識アイテムを作成
    const knowledgeItem = await t.one(
      'INSERT INTO long_term.knowledge_items(type, name, content, confidence, importance, source, metadata) ' +
      'VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [
        knowledgeData.type,
        knowledgeData.name,
        knowledgeData.content,
        knowledgeData.confidence,
        knowledgeData.importance,
        knowledgeData.source,
        knowledgeData.metadata
      ]
    );
    
    // 2. 埋め込みベクトルを生成
    // 埋め込み用のテキストを準備（名前と内容を結合）
    const embeddingText = `${knowledgeData.name} ${knowledgeData.content}`;
    const { embedding, model, version } = await generateEmbedding(embeddingText);
    
    // 3. 埋め込みベクトルを保存
    await t.none(
      'INSERT INTO long_term.knowledge_vectors(knowledge_id, embedding, embedding_model, embedding_version) ' +
      'VALUES($1, $2, $3, $4)',
      [knowledgeItem.id, embedding, model, version]
    );
    
    return knowledgeItem.id;
  });
}
```

### 6.2 オープンソースモデルを使用した埋め込み生成

```javascript
const { pipeline } = require('@huggingface/inference');

// Hugging Face APIキー
const hfToken = process.env.HUGGINGFACE_API_TOKEN;

// テキストからベクトル埋め込みを生成（MiniLMモデルを使用）
async function generateEmbeddingWithMiniLM(text) {
  try {
    const embeddingPipeline = pipeline('feature-extraction', 'sentence-transformers/all-MiniLM-L6-v2', { token: hfToken });
    const result = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
    
    return {
      embedding: result.data[0],
      model: 'all-MiniLM-L6-v2',
      version: '1.0.0'
    };
  } catch (error) {
    console.error('Error generating embedding with MiniLM:', error);
    throw error;
  }
}
```

## 7. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索機能の基本設定について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - インデックス](./memory-system-postgresql-vector-search-indexes.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - クエリパターン](./memory-system-postgresql-vector-search-query-patterns.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - Node.js統合](./memory-system-postgresql-vector-search-nodejs.md)
4. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索最適化](./memory-system-postgresql-vector-search-optimization.md)
