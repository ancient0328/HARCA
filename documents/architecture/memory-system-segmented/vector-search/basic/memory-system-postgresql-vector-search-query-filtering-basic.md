---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング基本"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング基本

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索でのフィルタリングの基本概念について詳細に説明します。メタデータフィルタリングの重要性、フィルタリングとベクトル検索の組み合わせ方、およびパフォーマンスへの影響について記述します。

## 2. フィルタリングの基本概念

### 2.1 ベクトル検索におけるフィルタリングの役割

ベクトル検索は意味的類似性に基づいて結果を返しますが、多くの実用的なシナリオでは、特定の条件を満たす結果のみを対象にする必要があります。フィルタリングは以下の役割を果たします：

1. **検索範囲の絞り込み**: 特定の条件を満たすデータのみを対象に検索
2. **関連性の向上**: ユーザーのコンテキストに関連する結果のみを返す
3. **パフォーマンスの最適化**: 検索対象のデータ量を減らすことによる高速化
4. **セキュリティの確保**: アクセス権限に基づくデータフィルタリング

### 2.2 フィルタリングの種類

HARCA記憶システムで使用されるフィルタリングは、大きく以下のカテゴリに分類されます：

1. **メタデータフィルタリング**:
   - カテゴリ、タグ、タイプなどの属性による絞り込み
   - 数値範囲（重要度、信頼度など）による絞り込み
   - テキスト属性による部分一致検索

2. **時間ベースのフィルタリング**:
   - 作成日時、更新日時による絞り込み
   - 有効期限による絞り込み
   - 時間範囲（期間）による絞り込み

3. **関係性フィルタリング**:
   - 特定のエンティティとの関連性による絞り込み
   - グラフ関係（親子関係、参照関係など）による絞り込み
   - 共起関係による絞り込み

4. **コンテキストフィルタリング**:
   - ユーザーID/グループによる絞り込み
   - セッション/タスクコンテキストによる絞り込み
   - アクセス権限による絞り込み

## 3. フィルタリングとベクトル検索の組み合わせ方

### 3.1 フィルタリング適用のタイミング

ベクトル検索とフィルタリングを組み合わせる際、フィルタリングを適用するタイミングには主に3つのアプローチがあります：

1. **プリフィルタリング（Pre-filtering）**:
   - ベクトル検索の前にフィルタリングを適用
   - 検索対象のデータ量を減らすことでパフォーマンスを向上
   - SQLの`WHERE`句でフィルタリング条件を指定

2. **ポストフィルタリング（Post-filtering）**:
   - ベクトル検索の結果に対してフィルタリングを適用
   - 類似度が高い結果のみを取得した後にフィルタリング
   - アプリケーションレベルでフィルタリングを実装することも可能

3. **ハイブリッドアプローチ**:
   - 一部の条件はプリフィルタリングで、一部はポストフィルタリングで適用
   - 複雑な条件や計算コストの高い条件はポストフィルタリングで適用

### 3.2 プリフィルタリングの例

```sql
-- カテゴリと重要度によるプリフィルタリングを適用したベクトル検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.category,
  k.importance,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.category = 'technical' AND
  k.importance >= 0.7
ORDER BY 
  distance
LIMIT 10;
```

### 3.3 ポストフィルタリングの例

```sql
-- ベクトル検索結果に対してアプリケーションレベルでポストフィルタリングを適用
const results = await db.any(
  'SELECT ' +
  '  k.id, ' +
  '  k.name, ' +
  '  k.content, ' +
  '  k.category, ' +
  '  k.importance, ' +
  '  kv.embedding <=> $1 AS distance ' +
  'FROM ' +
  '  long_term.knowledge_items k ' +
  'JOIN ' +
  '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
  'ORDER BY ' +
  '  distance ' +
  'LIMIT 50',  // より多くの結果を取得
  [queryEmbedding]
);

// アプリケーションレベルでフィルタリング
const filteredResults = results.filter(item => 
  item.category === 'technical' && item.importance >= 0.7
).slice(0, 10);  // 上位10件を返す
```

### 3.4 ハイブリッドアプローチの例

```sql
-- 一部の条件はSQLで、複雑な条件はアプリケーションレベルで適用
const results = await db.any(
  'SELECT ' +
  '  k.id, ' +
  '  k.name, ' +
  '  k.content, ' +
  '  k.category, ' +
  '  k.importance, ' +
  '  k.metadata, ' +  // JSON形式のメタデータ
  '  kv.embedding <=> $1 AS distance ' +
  'FROM ' +
  '  long_term.knowledge_items k ' +
  'JOIN ' +
  '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
  'WHERE ' +
  '  k.category = $2 ' +  // 基本的な条件はSQLで
  'ORDER BY ' +
  '  distance ' +
  'LIMIT 30',
  [queryEmbedding, 'technical']
);

// 複雑な条件はアプリケーションレベルで適用
const filteredResults = results.filter(item => {
  // JSONメタデータから特定の条件をチェック
  const metadata = JSON.parse(item.metadata);
  return item.importance >= 0.7 && 
         metadata.tags.includes('ai') && 
         metadata.complexity <= userPreference.maxComplexity;
}).slice(0, 10);
```

## 4. パフォーマンスへの影響

### 4.1 フィルタリングがベクトル検索のパフォーマンスに与える影響

フィルタリングはベクトル検索のパフォーマンスに大きな影響を与える可能性があります：

1. **プリフィルタリングの影響**:
   - **メリット**: 検索対象のデータ量を減らすことで検索速度が向上
   - **デメリット**: インデックスの効率的な使用が妨げられる可能性がある
   - **注意点**: フィルタリング条件にインデックスが存在しない場合、全テーブルスキャンが発生する可能性

2. **ポストフィルタリングの影響**:
   - **メリット**: ベクトル検索のインデックスを最大限に活用できる
   - **デメリット**: 多くの結果を取得してからフィルタリングするため、メモリ使用量が増加
   - **注意点**: フィルタリング後に十分な結果が残らない場合、追加のクエリが必要になる可能性

### 4.2 効率的なフィルタリングのためのインデックス設計

フィルタリング条件に対して適切なインデックスを作成することで、パフォーマンスを大幅に向上させることができます：

```sql
-- カテゴリに対するインデックス
CREATE INDEX idx_knowledge_items_category ON long_term.knowledge_items(category);

-- 重要度に対するインデックス
CREATE INDEX idx_knowledge_items_importance ON long_term.knowledge_items(importance);

-- カテゴリと重要度の複合インデックス（頻繁に一緒に使用される場合）
CREATE INDEX idx_knowledge_items_category_importance 
ON long_term.knowledge_items(category, importance);
```

### 4.3 クエリプランの最適化

PostgreSQLのクエリプランナーが効率的な実行計画を選択できるように、統計情報を最新に保つことが重要です：

```sql
-- テーブルの統計情報を更新
ANALYZE long_term.knowledge_items;
ANALYZE long_term.knowledge_vectors;

-- クエリプランを確認
EXPLAIN ANALYZE
SELECT 
  k.id,
  k.name,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.category = 'technical' AND
  k.importance >= 0.7
ORDER BY 
  distance
LIMIT 10;
```

### 4.4 パフォーマンス最適化のガイドライン

| 最適化ポイント | 推奨アプローチ | 注意点 |
|--------------|--------------|-------|
| 高選択性のフィルタリング条件 | プリフィルタリング | 条件に合致するデータが少ない場合に効果的 |
| 低選択性のフィルタリング条件 | ポストフィルタリング | 条件に合致するデータが多い場合に効果的 |
| 複合フィルタリング条件 | 複合インデックスの使用 | 頻繁に使用される条件の組み合わせに対して作成 |
| 複雑なフィルタリング条件 | ハイブリッドアプローチ | 基本条件はSQL、複雑条件はアプリケーションで |
| 大規模データセット | パーティショニングの検討 | カテゴリや日付範囲でパーティション化 |

## 5. HARCA記憶システムにおけるフィルタリング戦略

### 5.1 中期記憶（エピソード記憶）のフィルタリング戦略

エピソード記憶では、時間ベースのフィルタリングが特に重要です：

```sql
-- 特定の期間内のエピソードを検索
SELECT 
  e.id,
  e.title,
  e.description,
  e.start_time,
  e.end_time,
  e.importance,
  ev.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  mid_term.episodes e
JOIN 
  mid_term.episode_vectors ev ON e.id = ev.episode_id
WHERE 
  e.start_time >= '2025-01-01 00:00:00' AND
  e.end_time <= '2025-03-01 23:59:59' AND
  e.importance >= 0.6
ORDER BY 
  distance
LIMIT 10;
```

### 5.2 長期記憶（知識ベース）のフィルタリング戦略

知識ベースでは、カテゴリや信頼度によるフィルタリングが一般的です：

```sql
-- 特定のカテゴリと信頼度を持つ知識を検索
SELECT 
  k.id,
  k.name,
  k.content,
  k.category,
  k.confidence,
  kv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.knowledge_items k
JOIN 
  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
WHERE 
  k.category IN ('technical', 'scientific') AND
  k.confidence >= 0.8
ORDER BY 
  distance
LIMIT 10;
```

### 5.3 長期記憶（ルールエンジン）のフィルタリング戦略

ルールエンジンでは、アクティブ状態や優先度によるフィルタリングが重要です：

```sql
-- アクティブで高優先度のルールを検索
SELECT 
  r.id,
  r.name,
  r.description,
  r.condition_expression,
  r.action_expression,
  r.priority,
  rv.embedding <=> '[0.1, 0.2, 0.3, ...]'::vector AS distance
FROM 
  long_term.rules r
JOIN 
  long_term.rule_vectors rv ON r.id = rv.rule_id
WHERE 
  r.is_active = true AND
  r.priority >= 7
ORDER BY 
  distance
LIMIT 10;
```

## 6. Node.jsでの基本的なフィルタリング実装

### 6.1 プリフィルタリングの実装

```javascript
// カテゴリと重要度によるプリフィルタリングを適用したベクトル検索
async function searchKnowledgeWithFilters(queryEmbedding, category, minImportance, limit = 10) {
  return db.any(
    'SELECT ' +
    '  k.id, ' +
    '  k.name, ' +
    '  k.content, ' +
    '  k.category, ' +
    '  k.importance, ' +
    '  kv.embedding <=> $1 AS distance ' +
    'FROM ' +
    '  long_term.knowledge_items k ' +
    'JOIN ' +
    '  long_term.knowledge_vectors kv ON k.id = kv.knowledge_id ' +
    'WHERE ' +
    '  k.category = $2 AND ' +
    '  k.importance >= $3 ' +
    'ORDER BY ' +
    '  distance ' +
    'LIMIT $4',
    [queryEmbedding, category, minImportance, limit]
  );
}
```

### 6.2 動的フィルタリング条件の構築

```javascript
// 動的なフィルタリング条件を構築するヘルパー関数
function buildFilterConditions(filters) {
  const conditions = [];
  const params = [];
  
  // クエリパラメータのインデックス（最初のパラメータはqueryEmbeddingのため2から開始）
  let paramIndex = 2;
  
  // カテゴリフィルター
  if (filters.category) {
    conditions.push(`k.category = $${paramIndex++}`);
    params.push(filters.category);
  }
  
  // 重要度フィルター
  if (filters.minImportance !== undefined) {
    conditions.push(`k.importance >= $${paramIndex++}`);
    params.push(filters.minImportance);
  }
  
  // 信頼度フィルター
  if (filters.minConfidence !== undefined) {
    conditions.push(`k.confidence >= $${paramIndex++}`);
    params.push(filters.minConfidence);
  }
  
  // 日付範囲フィルター
  if (filters.startDate) {
    conditions.push(`k.created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }
  
  if (filters.endDate) {
    conditions.push(`k.created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }
  
  // WHERE句の構築
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return {
    whereClause,
    params
  };
}

// 動的フィルタリングを使用したベクトル検索
async function searchKnowledgeWithDynamicFilters(queryEmbedding, filters = {}, limit = 10) {
  const { whereClause, params } = buildFilterConditions(filters);
  
  const query = `
    SELECT 
      k.id,
      k.name,
      k.content,
      k.category,
      k.importance,
      k.confidence,
      k.created_at,
      kv.embedding <=> $1 AS distance
    FROM 
      long_term.knowledge_items k
    JOIN 
      long_term.knowledge_vectors kv ON k.id = kv.knowledge_id
    ${whereClause}
    ORDER BY 
      distance
    LIMIT $${params.length + 2}
  `;
  
  // パラメータの配列を構築
  const allParams = [queryEmbedding, ...params, limit];
  
  return db.any(query, allParams);
}
```

## 7. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのベクトル検索でのフィルタリングの基本概念について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（メタデータ）](./memory-system-postgresql-vector-search-query-filtering-metadata.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（時間ベース）](./memory-system-postgresql-vector-search-query-filtering-time.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（コンテキスト）](./memory-system-postgresql-vector-search-query-filtering-context.md)
4. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - フィルタリング（最適化）](./memory-system-postgresql-vector-search-query-filtering-optimization.md)
