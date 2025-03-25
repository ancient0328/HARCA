---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - インデックス"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - インデックス

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索機能のインデックス設計について詳細に説明します。pgvector拡張機能が提供するIVFFlatインデックスとHNSWインデックスの特徴、設定方法、および適切なインデックス選択のガイドラインについて記述します。

## 2. ベクトルインデックスの基本概念

### 2.1 近似最近傍探索（ANN）

ベクトル検索では、高次元空間内で最も近いベクトルを見つける「最近傍探索」が基本操作となります。しかし、高次元データに対する厳密な最近傍探索は計算コストが高く、大規模データセットでは実用的ではありません。

そこで、「近似最近傍探索（Approximate Nearest Neighbor Search, ANN）」が用いられます。ANNは、厳密な最近傍を保証しない代わりに、高速に「ほぼ最近傍」のベクトルを見つける手法です。

### 2.2 ベクトルインデックスの役割

ベクトルインデックスは、以下の役割を果たします：

1. **検索空間の削減**: 全データの走査を避け、有望な候補のみを検索
2. **検索速度の向上**: 線形探索と比較して大幅な高速化を実現
3. **スケーラビリティの確保**: データ量が増加しても性能を維持

### 2.3 インデックス選択の重要性

適切なインデックスの選択と設定は、以下の要素に大きく影響します：

1. **検索精度**: 真の最近傍をどれだけ正確に見つけられるか
2. **検索速度**: クエリ応答にかかる時間
3. **インデックス構築時間**: インデックスの作成にかかる時間
4. **メモリ使用量**: インデックスが使用するメモリ量
5. **更新効率**: データの追加・更新時のインデックス更新効率

## 3. pgvectorが提供するインデックスタイプ

pgvectorは、以下の2種類のインデックスをサポートしています：

1. **IVFFlat (Inverted File with Flat Compression)**: 比較的シンプルで構築が速い
2. **HNSW (Hierarchical Navigable Small World)**: 高精度だが構築に時間がかかる

## 4. IVFFlatインデックス

### 4.1 IVFFlatの仕組み

IVFFlatは、ベクトル空間を複数のクラスタ（リスト）に分割し、検索時には最も関連性の高いクラスタのみを探索する手法です。

1. **インデックス構築時**:
   - ベクトル空間をk-meansなどのクラスタリングアルゴリズムで複数のクラスタに分割
   - 各ベクトルを最も近いクラスタに割り当て

2. **検索時**:
   - クエリベクトルに最も近いクラスタを特定
   - それらのクラスタ内のベクトルのみを探索

### 4.2 IVFFlatインデックスの作成

```sql
-- IVFFlatインデックスの作成（コサイン類似度用）
CREATE INDEX ON long_term.knowledge_vectors 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- IVFFlatインデックスの作成（ユークリッド距離用）
CREATE INDEX ON mid_term.episode_vectors 
USING ivfflat (embedding vector_l2_ops) 
WITH (lists = 100);

-- IVFFlatインデックスの作成（内積用）
CREATE INDEX ON long_term.rule_vectors 
USING ivfflat (embedding vector_ip_ops) 
WITH (lists = 50);
```

### 4.3 IVFFlatパラメータの説明

| パラメータ | 説明 | 推奨値 | 影響 |
|----------|------|-------|------|
| `lists` | クラスタ（リスト）の数 | データ量の平方根程度（例：10万件なら約300） | 値が大きいほど精度が上がるが、速度が低下 |

### 4.4 IVFFlatの特性

| 特性 | 評価 | 説明 |
|------|------|------|
| 構築速度 | 速い | HNSWと比較して高速 |
| 検索速度 | 中程度 | HNSWより遅いが、線形探索より大幅に速い |
| 検索精度 | 中程度 | 適切な`lists`値と`probes`値で調整可能 |
| メモリ使用量 | 少ない | 比較的メモリ効率が良い |
| 更新効率 | 良い | 新しいデータの追加が比較的容易 |

### 4.5 検索時のパラメータ調整

IVFFlatインデックスを使用した検索では、`probes`パラメータで探索するクラスタ数を指定できます：

```sql
-- probesパラメータを指定した検索（より多くのクラスタを探索）
SET ivfflat.probes = 10;  -- デフォルトは1

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
```

`probes`の値を増やすと精度が向上しますが、速度は低下します。

## 5. HNSWインデックス

### 5.1 HNSWの仕組み

HNSW (Hierarchical Navigable Small World) は、多層グラフ構造を使用して効率的な近似最近傍探索を実現するアルゴリズムです。

1. **インデックス構築時**:
   - 複数のレイヤーからなるグラフ構造を構築
   - 各レイヤーは「スモールワールドグラフ」として設計され、近いノード同士が接続
   - 上位レイヤーほど接続が疎になり、下位レイヤーほど密になる

2. **検索時**:
   - 最上位レイヤーから探索を開始
   - 各レイヤーで最も近いノードに移動し、下位レイヤーへ進む
   - 最下層で最終的な最近傍候補を見つける

### 5.2 HNSWインデックスの作成

```sql
-- HNSWインデックスの作成（コサイン類似度用）
CREATE INDEX ON long_term.knowledge_vectors 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- HNSWインデックスの作成（ユークリッド距離用）
CREATE INDEX ON mid_term.episode_vectors 
USING hnsw (embedding vector_l2_ops) 
WITH (m = 16, ef_construction = 64);

-- HNSWインデックスの作成（内積用）
CREATE INDEX ON long_term.rule_vectors 
USING hnsw (embedding vector_ip_ops) 
WITH (m = 16, ef_construction = 64);
```

### 5.3 HNSWパラメータの説明

| パラメータ | 説明 | 推奨値 | 影響 |
|----------|------|-------|------|
| `m` | 各ノードの最大接続数 | 8〜64（通常は16） | 値が大きいほど精度が上がるが、インデックスサイズが増加 |
| `ef_construction` | インデックス構築時の探索候補数 | 64〜512 | 値が大きいほど精度が上がるが、構築時間が増加 |

### 5.4 HNSWの特性

| 特性 | 評価 | 説明 |
|------|------|------|
| 構築速度 | 遅い | IVFFlatと比較して遅い |
| 検索速度 | 速い | 非常に高速な検索が可能 |
| 検索精度 | 高い | 高精度な近似最近傍検索が可能 |
| メモリ使用量 | 多い | グラフ構造のため、メモリ使用量が多い |
| 更新効率 | 低い | 新しいデータの追加時にインデックス再構築が必要な場合がある |

### 5.5 検索時のパラメータ調整

HNSWインデックスを使用した検索では、`ef_search`パラメータで探索候補数を指定できます：

```sql
-- ef_searchパラメータを指定した検索
SET hnsw.ef_search = 100;  -- デフォルトは40

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
```

`ef_search`の値を増やすと精度が向上しますが、速度は低下します。

## 6. インデックス選択ガイドライン

### 6.1 IVFFlatとHNSWの比較

| 特性 | IVFFlat | HNSW |
|------|---------|------|
| 構築速度 | 速い | 遅い |
| 検索速度 | 中程度 | 速い |
| 検索精度 | 中程度 | 高い |
| メモリ使用量 | 少ない | 多い |
| 更新効率 | 良い | 低い |
| 適したデータ量 | 小〜大規模 | 小〜中規模 |

### 6.2 HARCA記憶システムにおけるインデックス選択基準

以下の基準に基づいて、適切なインデックスを選択します：

1. **データ量と更新頻度**:
   - 大量のデータで頻繁な更新がある場合: IVFFlat
   - 中規模データで更新が少ない場合: HNSW

2. **検索性能の要件**:
   - 高速な検索が最優先: HNSW
   - バランスの取れた性能: IVFFlat

3. **リソース制約**:
   - メモリリソースが限られている場合: IVFFlat
   - 構築時間が制約される場合: IVFFlat

### 6.3 記憶モジュール別のインデックス推奨設定

| 記憶モジュール | 推奨インデックス | 理由 |
|--------------|----------------|------|
| 中期記憶（エピソード記憶） | IVFFlat | 更新頻度が比較的高く、データ量が中程度 |
| 長期記憶（知識ベース） | HNSW | 高精度な検索が重要で、更新頻度が低い |
| 長期記憶（ルールエンジン） | IVFFlat | データ量が少なく、バランスの取れた性能が必要 |

## 7. HARCA記憶システムにおけるインデックス実装

### 7.1 中期記憶（エピソード記憶）のインデックス

```sql
-- エピソード記憶のベクトルインデックス
CREATE INDEX idx_episode_vectors_embedding 
ON mid_term.episode_vectors 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- 検索時の設定
SET ivfflat.probes = 10;
```

### 7.2 長期記憶（知識ベース）のインデックス

```sql
-- 知識ベースのベクトルインデックス
CREATE INDEX idx_knowledge_vectors_embedding 
ON long_term.knowledge_vectors 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 検索時の設定
SET hnsw.ef_search = 100;
```

### 7.3 長期記憶（ルールエンジン）のインデックス

```sql
-- ルールエンジンのベクトルインデックス
CREATE INDEX idx_rule_vectors_embedding 
ON long_term.rule_vectors 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 50);

-- 検索時の設定
SET ivfflat.probes = 5;
```

## 8. インデックス管理

### 8.1 インデックスの再構築

インデックスのパフォーマンスが低下した場合や、大量のデータ更新後には、インデックスの再構築が必要になることがあります：

```sql
-- インデックスの再構築
REINDEX INDEX idx_knowledge_vectors_embedding;
```

### 8.2 インデックスのモニタリング

インデックスのサイズや使用状況を監視するためのクエリ：

```sql
-- インデックスのサイズを確認
SELECT
  pg_size_pretty(pg_relation_size('idx_knowledge_vectors_embedding')) AS index_size;

-- インデックスの使用状況を確認
SELECT
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM
  pg_stat_user_indexes
WHERE
  indexrelname LIKE '%vectors%';
```

### 8.3 インデックスのメンテナンス計画

| メンテナンス作業 | 頻度 | 説明 |
|----------------|------|------|
| 統計情報の更新 | 週1回 | `ANALYZE`コマンドでクエリプランナーの統計を更新 |
| インデックスの再構築 | 月1回 | `REINDEX`コマンドでインデックスを再構築 |
| インデックスのモニタリング | 日次 | インデックスの使用状況と性能を監視 |
| パラメータの調整 | 必要に応じて | 検索パターンの変化に応じてパラメータを調整 |

## 9. Node.jsでのインデックスパラメータ設定

### 9.1 検索時のパラメータ設定

```javascript
const pgp = require('pg-promise')();
const db = pgp('postgres://username:password@localhost:3730/harca_memory');

// IVFFlatのprobes設定を変更して検索
async function searchSimilarKnowledgeWithIVFFlat(queryEmbedding, limit = 10, probes = 10) {
  return db.tx(async t => {
    // probes設定を変更
    await t.none('SET ivfflat.probes = $1', [probes]);
    
    // ベクトル検索実行
    return t.any(
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
  });
}

// HNSWのef_search設定を変更して検索
async function searchSimilarKnowledgeWithHNSW(queryEmbedding, limit = 10, efSearch = 100) {
  return db.tx(async t => {
    // ef_search設定を変更
    await t.none('SET hnsw.ef_search = $1', [efSearch]);
    
    // ベクトル検索実行
    return t.any(
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
  });
}
```

### 9.2 インデックスの作成と管理

```javascript
// インデックスの作成
async function createVectorIndex(tableName, columnName, indexType, distanceOp, params = {}) {
  let indexName = `idx_${tableName}_${columnName}`;
  let indexSql = '';
  
  if (indexType === 'ivfflat') {
    const lists = params.lists || 100;
    const opClass = distanceOp === 'cosine' ? 'vector_cosine_ops' : 
                   distanceOp === 'l2' ? 'vector_l2_ops' : 'vector_ip_ops';
    
    indexSql = `CREATE INDEX ${indexName} ON ${tableName} USING ivfflat (${columnName} ${opClass}) WITH (lists = ${lists})`;
  } else if (indexType === 'hnsw') {
    const m = params.m || 16;
    const efConstruction = params.ef_construction || 64;
    const opClass = distanceOp === 'cosine' ? 'vector_cosine_ops' : 
                   distanceOp === 'l2' ? 'vector_l2_ops' : 'vector_ip_ops';
    
    indexSql = `CREATE INDEX ${indexName} ON ${tableName} USING hnsw (${columnName} ${opClass}) WITH (m = ${m}, ef_construction = ${efConstruction})`;
  } else {
    throw new Error(`Unsupported index type: ${indexType}`);
  }
  
  return db.none(indexSql);
}

// インデックスの再構築
async function reindexVectorIndex(indexName) {
  return db.none(`REINDEX INDEX ${indexName}`);
}

// インデックスのサイズ確認
async function getIndexSize(indexName) {
  return db.one(
    'SELECT pg_size_pretty(pg_relation_size($1)) AS index_size',
    [indexName]
  );
}
```

## 10. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索機能のインデックス設計について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - クエリパターン](./memory-system-postgresql-vector-search-query-patterns.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索実装 - Node.js統合](./memory-system-postgresql-vector-search-nodejs.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索最適化](./memory-system-postgresql-vector-search-optimization.md)
