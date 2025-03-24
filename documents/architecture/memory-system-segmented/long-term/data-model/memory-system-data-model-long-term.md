---
title: "多階層記憶システム データモデル - 長期記憶"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム データモデル - 長期記憶

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムの長期記憶（Long-Term Memory）コンポーネントのデータモデルについて詳細に記述します。長期記憶は、システムの永続的な知識ベースとして機能し、長期間保持される構造化された情報を管理します。セマンティック記憶（概念や事実）と手続き記憶（ルールやプロセス）を含み、高度な検索と推論機能を提供します。

## 2. 長期記憶の基本構造

長期記憶は以下の主要コンポーネントで構成されます：

1. **知識ベース（Knowledge Base）**: 構造化された知識と概念を保持
2. **ルールエンジン（Rule Engine）**: 手続き的知識とルールを管理

## 3. データモデル詳細

### 3.1 知識ベース（Knowledge Base）

#### 3.1.1 KnowledgeItem スキーマ

```javascript
{
  id: String,                 // 一意のID (UUID v4)
  type: String,               // 知識タイプ（概念、事実、定義など）
  name: String,               // 名前
  content: Object,            // 知識内容
  description: String,        // 説明
  createdAt: Timestamp,       // 作成時刻
  updatedAt: Timestamp,       // 最終更新時刻
  source: String,             // 情報ソース
  confidence: Number,         // 信頼度（0.0-1.0）
  vector: Array<Number>,      // 埋め込みベクトル
  relations: [                // 関係性
    {
      relationType: String,   // 関係タイプ（is-a、has-a、part-ofなど）
      targetId: String,       // 関連知識アイテムID
      strength: Number,       // 関係の強さ（0.0-1.0）
      metadata: Object        // 関係メタデータ
    }
  ],
  metadata: {                 // メタデータ
    domain: String,           // ドメイン
    tags: Array<String>,      // タグリスト
    version: String,          // バージョン
    accessCount: Number,      // アクセス回数
    lastAccessedAt: Timestamp, // 最終アクセス時刻
    importance: Number,       // 重要度（1-10）
    visibility: String        // 可視性（public、private、shared）
  }
}
```

#### 3.1.2 KnowledgeItem タイプ

| タイプ | 説明 | 内容形式 |
|--------|------|----------|
| `concept` | 概念 | `{ definition: String, examples: Array<String>, attributes: Object }` |
| `fact` | 事実 | `{ statement: String, evidence: Array<Object>, context: Object }` |
| `definition` | 定義 | `{ term: String, meaning: String, usage: Array<String> }` |
| `procedure` | 手順 | `{ steps: Array<Object>, inputs: Object, outputs: Object }` |
| `reference` | 参照情報 | `{ source: String, content: Object, citation: String }` |

#### 3.1.3 PostgreSQL実装スキーマ

**テーブル定義**:

```sql
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  content JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(255),
  confidence FLOAT CHECK (confidence BETWEEN 0.0 AND 1.0),
  vector VECTOR(1536),
  metadata JSONB
);

CREATE TABLE knowledge_relations (
  id UUID PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES knowledge_base(id),
  target_id UUID NOT NULL REFERENCES knowledge_base(id),
  relation_type VARCHAR(50) NOT NULL,
  strength FLOAT CHECK (strength BETWEEN 0.0 AND 1.0),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, target_id, relation_type)
);

-- インデックス
CREATE INDEX idx_knowledge_base_type ON knowledge_base(type);
CREATE INDEX idx_knowledge_base_name ON knowledge_base(name);
CREATE INDEX idx_knowledge_base_content ON knowledge_base USING GIN (content);
CREATE INDEX idx_knowledge_base_metadata ON knowledge_base USING GIN (metadata);
CREATE INDEX idx_knowledge_base_vector ON knowledge_base USING ivfflat (vector vector_cosine_ops);

CREATE INDEX idx_knowledge_relations_source_id ON knowledge_relations(source_id);
CREATE INDEX idx_knowledge_relations_target_id ON knowledge_relations(target_id);
CREATE INDEX idx_knowledge_relations_relation_type ON knowledge_relations(relation_type);
```

### 3.2 ルールエンジン（Rule Engine）

#### 3.2.1 RuleItem スキーマ

```javascript
{
  id: String,                 // 一意のID (UUID v4)
  name: String,               // ルール名
  description: String,        // 説明
  condition: {                // 条件
    type: String,             // 条件タイプ（単純、複合）
    expression: String,       // 条件式
    parameters: Object        // 条件パラメータ
  },
  action: {                   // アクション
    type: String,             // アクションタイプ
    function: String,         // 実行関数
    parameters: Object        // アクションパラメータ
  },
  priority: Number,           // 優先度（1-10）
  status: String,             // 状態（有効、無効）
  createdAt: Timestamp,       // 作成時刻
  updatedAt: Timestamp,       // 最終更新時刻
  metadata: {                 // メタデータ
    author: String,           // 作成者
    version: String,          // バージョン
    tags: Array<String>,      // タグリスト
    executionCount: Number,   // 実行回数
    lastExecutedAt: Timestamp, // 最終実行時刻
    successRate: Number,      // 成功率（0.0-1.0）
    domain: String,           // 適用ドメイン
    dependencies: Array<String> // 依存ルールID
  }
}
```

#### 3.2.2 RuleItem 条件タイプ

| 条件タイプ | 説明 | 表現形式 |
|------------|------|----------|
| `simple` | 単純条件 | `{ field: String, operator: String, value: Any }` |
| `compound` | 複合条件 | `{ operator: String, conditions: Array<Condition> }` |
| `script` | スクリプト条件 | `{ script: String, language: String }` |
| `template` | テンプレート条件 | `{ template: String, variables: Object }` |
| `regex` | 正規表現条件 | `{ field: String, pattern: String, flags: String }` |

#### 3.2.3 RuleItem アクションタイプ

| アクションタイプ | 説明 | パラメータ形式 |
|------------------|------|----------------|
| `function` | 関数実行 | `{ name: String, args: Object }` |
| `http` | HTTP要求 | `{ method: String, url: String, headers: Object, body: Object }` |
| `database` | データベース操作 | `{ operation: String, table: String, data: Object }` |
| `notification` | 通知送信 | `{ channel: String, message: Object, recipients: Array<String> }` |
| `composite` | 複合アクション | `{ actions: Array<Action>, sequential: Boolean }` |

#### 3.2.4 PostgreSQL実装スキーマ

**テーブル定義**:

```sql
CREATE TABLE rule_engine (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  condition JSONB NOT NULL,
  action JSONB NOT NULL,
  priority INTEGER CHECK (priority BETWEEN 1 AND 10),
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

-- インデックス
CREATE INDEX idx_rule_engine_name ON rule_engine(name);
CREATE INDEX idx_rule_engine_status ON rule_engine(status);
CREATE INDEX idx_rule_engine_priority ON rule_engine(priority);
CREATE INDEX idx_rule_engine_condition ON rule_engine USING GIN (condition);
CREATE INDEX idx_rule_engine_action ON rule_engine USING GIN (action);
CREATE INDEX idx_rule_engine_metadata ON rule_engine USING GIN (metadata);
```

## 4. データ操作

### 4.1 知識ベース操作

#### 4.1.1 基本操作

| 操作 | 説明 | SQL |
|------|------|-----|
| 作成 | 新しい知識アイテムを作成 | `INSERT INTO knowledge_base (...) VALUES (...)` |
| 取得 | IDによる知識アイテムの取得 | `SELECT * FROM knowledge_base WHERE id = $1` |
| 更新 | 既存の知識アイテムを更新 | `UPDATE knowledge_base SET ... WHERE id = $1` |
| 削除 | 知識アイテムを削除 | `DELETE FROM knowledge_base WHERE id = $1` |
| 検索 | 条件に基づく知識アイテムの検索 | `SELECT * FROM knowledge_base WHERE ...` |

#### 4.1.2 関係操作

| 操作 | 説明 | SQL |
|------|------|-----|
| 関係作成 | 知識アイテム間の関係を作成 | `INSERT INTO knowledge_relations (...) VALUES (...)` |
| 関係取得 | 知識アイテムの関係を取得 | `SELECT * FROM knowledge_relations WHERE source_id = $1` |
| 関係更新 | 既存の関係を更新 | `UPDATE knowledge_relations SET ... WHERE id = $1` |
| 関係削除 | 関係を削除 | `DELETE FROM knowledge_relations WHERE id = $1` |
| 関係検索 | 条件に基づく関係の検索 | `SELECT * FROM knowledge_relations WHERE ...` |

#### 4.1.3 高度な操作

| 操作 | 説明 | 実装方法 |
|------|------|----------|
| ベクトル検索 | 意味的に類似した知識を検索 | `SELECT * FROM knowledge_base ORDER BY vector <-> $1 LIMIT $2` |
| グラフ探索 | 知識グラフの探索 | 再帰的クエリまたはグラフアルゴリズム |
| 知識拡張 | 既存の知識を新しい情報で拡張 | Custom merge logic |
| 知識検証 | 知識の信頼性を検証 | Custom validation logic |
| 知識推論 | 既存の知識から新しい知識を推論 | Custom inference logic |

### 4.2 ルールエンジン操作

#### 4.2.1 基本操作

| 操作 | 説明 | SQL |
|------|------|-----|
| 作成 | 新しいルールを作成 | `INSERT INTO rule_engine (...) VALUES (...)` |
| 取得 | IDによるルールの取得 | `SELECT * FROM rule_engine WHERE id = $1` |
| 更新 | 既存のルールを更新 | `UPDATE rule_engine SET ... WHERE id = $1` |
| 削除 | ルールを削除 | `DELETE FROM rule_engine WHERE id = $1` |
| 検索 | 条件に基づくルールの検索 | `SELECT * FROM rule_engine WHERE ...` |

#### 4.2.2 高度な操作

| 操作 | 説明 | 実装方法 |
|------|------|----------|
| ルール評価 | 条件に基づいてルールを評価 | Custom evaluation logic |
| ルール実行 | ルールのアクションを実行 | Custom execution logic |
| 競合解決 | 競合するルール間の優先順位付け | Priority-based resolution |
| ルール依存性分析 | ルール間の依存関係を分析 | Dependency graph analysis |
| ルールチェーン | 複数のルールを連鎖的に実行 | Rule chaining algorithm |

## 5. インデックス戦略

### 5.1 知識ベースインデックス

#### 5.1.1 基本インデックス

- **タイプインデックス**: 知識タイプによる検索を最適化
- **名前インデックス**: 名前による検索を最適化
- **ソースインデックス**: 情報ソースによる検索を最適化
- **信頼度インデックス**: 信頼度による検索を最適化

#### 5.1.2 JSON/JSONB インデックス

- **内容インデックス**: JSONBコンテンツに対するGINインデックス
- **メタデータインデックス**: メタデータに対するGINインデックス
- **タグインデックス**: タグに対する検索を最適化

#### 5.1.3 ベクトルインデックス

- **IVFFlat**: 近似最近傍検索のためのIVFFlatインデックス
- **HNSW**: 高性能な近似最近傍検索のためのHNSWインデックス（オプション）

### 5.2 ルールエンジンインデックス

#### 5.2.1 基本インデックス

- **名前インデックス**: ルール名による検索を最適化
- **状態インデックス**: ルール状態による検索を最適化
- **優先度インデックス**: 優先度による検索を最適化

#### 5.2.2 JSON/JSONB インデックス

- **条件インデックス**: 条件に対するGINインデックス
- **アクションインデックス**: アクションに対するGINインデックス
- **メタデータインデックス**: メタデータに対するGINインデックス

## 6. パフォーマンス最適化

### 6.1 クエリ最適化

- **クエリプラン最適化**: 実行計画の分析と最適化
- **部分インデックス**: 特定の条件に基づく部分インデックス
- **マテリアライズドビュー**: 頻繁に使用される集計クエリのためのマテリアライズドビュー

### 6.2 キャッシュ戦略

- **アプリケーションキャッシュ**: 頻繁にアクセスされる知識とルールのメモリキャッシュ
- **Redis**: 二次キャッシュとしてのRedisの使用
- **キャッシュ無効化**: 効率的なキャッシュ無効化戦略

### 6.3 スケーリング戦略

- **読み取りレプリカ**: 読み取り操作のスケーリングのためのレプリケーション
- **シャーディング**: ドメインまたはタイプに基づくシャーディング
- **接続プーリング**: データベース接続の効率的な管理

## 7. データ整合性と耐障害性

### 7.1 データ整合性

- **トランザクション**: 関連する操作のためのトランザクション
- **制約**: 適切なデータ制約の実装
- **バージョニング**: 楽観的ロックによる競合解決

### 7.2 耐障害性

- **バックアップ**: 定期的なバックアップスケジュール
- **ポイントインタイムリカバリ**: WALアーカイブによるポイントインタイムリカバリ
- **フェイルオーバー**: 高可用性のための自動フェイルオーバー

## 8. セキュリティ考慮事項

### 8.1 データ保護

- **暗号化**: 機密知識の列レベル暗号化
- **アクセス制御**: ロールベースのアクセス制御
- **監査**: データアクセスと変更の監査ログ

### 8.2 プライバシー

- **データ最小化**: 必要最小限のデータのみを保存
- **可視性制御**: 知識アイテムの可視性レベル（public、private、shared）
- **データ削除ポリシー**: プライバシー要求に応じたデータ削除ポリシー

## 9. 実装例

### 9.1 知識アイテム作成

```javascript
async function createKnowledgeItem(knowledge) {
  const id = uuidv4();
  const now = new Date();
  
  // 知識の埋め込みベクトルを生成
  const vector = await generateEmbedding(
    `${knowledge.name} ${knowledge.description} ${JSON.stringify(knowledge.content)}`
  );
  
  const knowledgeItem = {
    id,
    type: knowledge.type,
    name: knowledge.name,
    content: knowledge.content,
    description: knowledge.description,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    source: knowledge.source || 'system',
    confidence: knowledge.confidence || 1.0,
    vector,
    metadata: {
      domain: knowledge.metadata?.domain || 'general',
      tags: knowledge.metadata?.tags || [],
      version: '1.0.0',
      accessCount: 0,
      lastAccessedAt: now.toISOString(),
      importance: knowledge.metadata?.importance || 5,
      visibility: knowledge.metadata?.visibility || 'private'
    }
  };
  
  const query = `
    INSERT INTO knowledge_base (
      id, type, name, content, description, created_at, updated_at,
      source, confidence, vector, metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    ) RETURNING *
  `;
  
  const values = [
    knowledgeItem.id,
    knowledgeItem.type,
    knowledgeItem.name,
    JSON.stringify(knowledgeItem.content),
    knowledgeItem.description,
    now,
    now,
    knowledgeItem.source,
    knowledgeItem.confidence,
    knowledgeItem.vector,
    JSON.stringify(knowledgeItem.metadata)
  ];
  
  const result = await pool.query(query, values);
  
  // 関係を作成（存在する場合）
  if (knowledge.relations && knowledge.relations.length > 0) {
    await createKnowledgeRelations(knowledgeItem.id, knowledge.relations);
  }
  
  return result.rows[0];
}

async function createKnowledgeRelations(sourceId, relations) {
  const now = new Date();
  
  for (const relation of relations) {
    const id = uuidv4();
    
    const query = `
      INSERT INTO knowledge_relations (
        id, source_id, target_id, relation_type, strength,
        metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) ON CONFLICT (source_id, target_id, relation_type)
      DO UPDATE SET
        strength = $5,
        metadata = $6,
        updated_at = $8
      RETURNING *
    `;
    
    const values = [
      id,
      sourceId,
      relation.targetId,
      relation.relationType,
      relation.strength || 1.0,
      JSON.stringify(relation.metadata || {}),
      now,
      now
    ];
    
    await pool.query(query, values);
  }
}
```

### 9.2 ルール作成

```javascript
async function createRule(rule) {
  const id = uuidv4();
  const now = new Date();
  
  const ruleItem = {
    id,
    name: rule.name,
    description: rule.description,
    condition: rule.condition,
    action: rule.action,
    priority: rule.priority || 5,
    status: rule.status || 'active',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    metadata: {
      author: rule.metadata?.author || 'system',
      version: '1.0.0',
      tags: rule.metadata?.tags || [],
      executionCount: 0,
      lastExecutedAt: null,
      successRate: 1.0,
      domain: rule.metadata?.domain || 'general',
      dependencies: rule.metadata?.dependencies || []
    }
  };
  
  const query = `
    INSERT INTO rule_engine (
      id, name, description, condition, action, priority,
      status, created_at, updated_at, metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
    ) RETURNING *
  `;
  
  const values = [
    ruleItem.id,
    ruleItem.name,
    ruleItem.description,
    JSON.stringify(ruleItem.condition),
    JSON.stringify(ruleItem.action),
    ruleItem.priority,
    ruleItem.status,
    now,
    now,
    JSON.stringify(ruleItem.metadata)
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}
```

### 9.3 知識ベクトル検索

```javascript
async function searchSimilarKnowledge(query, limit = 10) {
  // クエリテキストの埋め込みベクトルを生成
  const queryVector = await generateEmbedding(query);
  
  const searchQuery = `
    SELECT
      id, type, name, description, content, source, confidence,
      metadata,
      1 - (vector <=> $1) AS similarity
    FROM
      knowledge_base
    WHERE
      metadata->>'visibility' = 'public' OR
      metadata->>'visibility' = 'shared'
    ORDER BY
      vector <=> $1
    LIMIT $2
  `;
  
  const result = await pool.query(searchQuery, [queryVector, limit]);
  return result.rows;
}
```

### 9.4 ルール評価

```javascript
async function evaluateRules(context) {
  // アクティブなルールを優先度順に取得
  const rulesQuery = `
    SELECT *
    FROM rule_engine
    WHERE status = 'active'
    ORDER BY priority DESC
  `;
  
  const rulesResult = await pool.query(rulesQuery);
  const rules = rulesResult.rows;
  
  const matchedRules = [];
  
  for (const rule of rules) {
    const condition = JSON.parse(rule.condition);
    const isMatch = await evaluateCondition(condition, context);
    
    if (isMatch) {
      matchedRules.push(rule);
    }
  }
  
  return matchedRules;
}

async function evaluateCondition(condition, context) {
  switch (condition.type) {
    case 'simple':
      return evaluateSimpleCondition(condition, context);
    case 'compound':
      return evaluateCompoundCondition(condition, context);
    case 'script':
      return evaluateScriptCondition(condition, context);
    case 'template':
      return evaluateTemplateCondition(condition, context);
    case 'regex':
      return evaluateRegexCondition(condition, context);
    default:
      throw new Error(`Unknown condition type: ${condition.type}`);
  }
}
```

## 10. 知識グラフ構造

### 10.1 グラフモデル

長期記憶の知識ベースは、知識グラフとして構造化されています。このグラフモデルでは：

- **ノード**: 知識アイテム（概念、事実、定義など）
- **エッジ**: 知識アイテム間の関係（is-a、has-a、part-ofなど）

### 10.2 関係タイプ

| 関係タイプ | 説明 | 例 |
|------------|------|-----|
| `is-a` | 概念階層関係 | 「犬はほ乳類である」 |
| `has-a` | 所有関係 | 「車はエンジンを持つ」 |
| `part-of` | 部分-全体関係 | 「車輪は自転車の一部である」 |
| `related-to` | 一般的な関連 | 「プログラミングはコンピュータに関連している」 |
| `causes` | 因果関係 | 「雨は濡れた地面を引き起こす」 |
| `precedes` | 時間的順序 | 「朝食は昼食に先行する」 |
| `contradicts` | 矛盾関係 | 「この事実はその主張と矛盾する」 |
| `similar-to` | 類似関係 | 「オレンジはみかんに似ている」 |

### 10.3 グラフ探索アルゴリズム

知識グラフを効率的に探索するために、以下のアルゴリズムを実装します：

1. **幅優先探索（BFS）**: 関連する知識の広範な探索
2. **深さ優先探索（DFS）**: 特定の知識パスの深い探索
3. **最短経路探索**: 二つの知識アイテム間の関連性を見つける
4. **パターンマッチング**: 特定のパターンに一致するサブグラフを見つける

### 10.4 グラフ実装例

```javascript
async function findRelatedKnowledge(knowledgeId, maxDepth = 2) {
  const result = {
    nodes: [],
    edges: []
  };
  
  const visitedNodes = new Set();
  const queue = [{ id: knowledgeId, depth: 0 }];
  
  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    
    if (visitedNodes.has(id) || depth > maxDepth) {
      continue;
    }
    
    visitedNodes.add(id);
    
    // ノード情報を取得
    const nodeQuery = `
      SELECT id, type, name, description, metadata
      FROM knowledge_base
      WHERE id = $1
    `;
    
    const nodeResult = await pool.query(nodeQuery, [id]);
    
    if (nodeResult.rows.length > 0) {
      result.nodes.push(nodeResult.rows[0]);
      
      // エッジ情報を取得
      const edgesQuery = `
        SELECT id, source_id, target_id, relation_type, strength, metadata
        FROM knowledge_relations
        WHERE source_id = $1 OR target_id = $1
      `;
      
      const edgesResult = await pool.query(edgesQuery, [id]);
      
      for (const edge of edgesResult.rows) {
        result.edges.push(edge);
        
        const nextId = edge.source_id === id ? edge.target_id : edge.source_id;
        
        if (!visitedNodes.has(nextId)) {
          queue.push({ id: nextId, depth: depth + 1 });
        }
      }
    }
  }
  
  return result;
}
```

## 11. 結論

本ドキュメントでは、HARCA多階層記憶システムの長期記憶コンポーネントのデータモデルについて詳細に記述しました。知識ベースとルールエンジンの構造、操作、インデックス戦略、およびパフォーマンス最適化について定義しました。また、知識グラフの構造と探索アルゴリズムについても説明しました。このデータモデルに基づいて、効率的で柔軟な長期記憶システムを実装することができます。
