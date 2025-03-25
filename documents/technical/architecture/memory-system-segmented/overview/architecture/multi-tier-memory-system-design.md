---
title: "多階層記憶システム詳細設計書"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム詳細設計書

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、HARCAプロジェクトの多階層記憶システムの詳細設計について記述します。多階層記憶システムは、短期記憶（作業記憶）、中期記憶（エピソード記憶）、長期記憶（意味記憶）の3つの層から構成され、それぞれ異なる特性と役割を持ちます。

### 1.1 目的

多階層記憶システムの目的は以下の通りです：

1. **コンテキスト理解の強化**：会話や操作の文脈を適切に保持し、理解を深める
2. **知識の効率的な管理**：異なる種類の情報を適切な記憶層に保存し、効率的にアクセスする
3. **思考プロセスの支援**：Sequential Thinking MCPと連携し、構造化された思考をサポートする
4. **ユーザー適応性の向上**：ユーザーの好みや行動パターンを学習し、適応する

### 1.2 システム構成

多階層記憶システムは以下のコンポーネントから構成されます：

1. **短期記憶（作業記憶）モジュール**
   - WorkingMemory：揮発性の高い一時的な情報を管理
   - ContextManager：現在のコンテキスト情報を管理

2. **中期記憶（エピソード記憶）モジュール**
   - EpisodicMemory：会話履歴やセッション情報を管理
   - UserProfile：ユーザー固有の情報や好みを管理

3. **長期記憶（意味記憶）モジュール**
   - KnowledgeBase：事実、概念、関係性などの知識を管理
   - RuleEngine：ルールや手順などの知識を管理

4. **統合モジュール**
   - MemorySystem：全体の記憶システムを統括
   - MemoryIntegration：記憶の統合と最適化を担当
   - SequentialThinkingIntegration：思考プロセスとの連携を担当

## 2. 記憶階層の詳細定義

### 2.1 短期記憶（作業記憶）

#### 2.1.1 特性

- **持続時間**: 数分〜数時間（デフォルト: 2時間）
- **容量**: 限定的（デフォルト: 最大200項目）
- **アクセス速度**: 非常に高速（ミリ秒単位）
- **揮発性**: 高い（システム再起動で消失）
- **ストレージ**: Redis（インメモリキャッシュ）

#### 2.1.2 主な用途

- 現在の会話コンテキスト
- ユーザーの直近の入力と出力
- 進行中の思考プロセス
- 一時的なメモや計算結果

#### 2.1.3 データ構造

```javascript
{
  id: "uuid-string",
  type: "OBSERVATION | THINKING | CONTEXT",
  content: "記憶の内容",
  created: "2025-03-23T12:34:56Z",
  expires: "2025-03-23T14:34:56Z",
  metadata: {
    importance: 0.7,
    confidence: 0.9,
    workingMemoryType: "CONTEXT | USER_INPUT | SYSTEM_OUTPUT | THINKING | TEMPORARY",
    contextId: "関連するコンテキストID",
    sessionId: "セッションID"
  }
}
```

### 2.2 中期記憶（エピソード記憶）

#### 2.2.1 特性

- **持続時間**: 数日〜数週間（デフォルト: 30日）
- **容量**: 中程度（セッションやユーザーごとに数千〜数万項目）
- **アクセス速度**: 中程度（数十ミリ秒〜数百ミリ秒）
- **揮発性**: 低い（永続化ストレージに保存）
- **ストレージ**: PostgreSQL（リレーショナルデータベース）

#### 2.2.2 主な用途

- 会話履歴
- ユーザーとの対話パターン
- セッション情報
- タスク履歴
- ユーザーの好みや設定

#### 2.2.3 データ構造

```javascript
{
  id: "uuid-string",
  type: "OBSERVATION | PREFERENCE | FEEDBACK",
  content: "記憶の内容",
  created: "2025-03-23T12:34:56Z",
  expires: "2025-04-22T12:34:56Z",
  metadata: {
    importance: 0.8,
    confidence: 0.9,
    episodicMemoryType: "CONVERSATION | USER_INTERACTION | SESSION | TASK | EVENT",
    userId: "ユーザーID",
    sessionId: "セッションID",
    tags: ["tag1", "tag2"],
    relatedMemories: ["関連記憶ID1", "関連記憶ID2"]
  }
}
```

### 2.3 長期記憶（意味記憶）

#### 2.3.1 特性

- **持続時間**: 数ヶ月〜数年（デフォルト: 10年）
- **容量**: 大規模（数百万〜数億項目）
- **アクセス速度**: 検索方法による（数百ミリ秒〜数秒）
- **揮発性**: 非常に低い（明示的に削除されない限り保持）
- **ストレージ**: PostgreSQL + pgvector（ベクトルデータベース）

#### 2.3.2 主な用途

- 事実や概念の知識
- ルールや手順
- エンティティ間の関係
- 一般化された学習内容
- ドメイン固有の知識

#### 2.3.3 データ構造

```javascript
{
  id: "uuid-string",
  type: "FACT | RULE | CONCEPT",
  content: "記憶の内容",
  created: "2025-03-23T12:34:56Z",
  expires: "2035-03-23T12:34:56Z",
  embedding: [0.1, 0.2, ..., 0.n], // ベクトル埋め込み
  metadata: {
    importance: 0.9,
    confidence: 0.95,
    knowledgeType: "FACT | RULE | CONCEPT | PROCEDURE | RELATIONSHIP",
    domain: "ドメイン名",
    source: "情報源",
    tags: ["tag1", "tag2"],
    relatedConcepts: ["関連概念1", "関連概念2"]
  }
}
```

## 3. データモデルの詳細設計

### 3.1 共通データモデル

すべての記憶タイプに共通するデータモデルを以下のように定義します：

```javascript
class Memory {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.type = data.type || MemoryType.OBSERVATION;
    this.content = data.content || '';
    this.created = data.created || new Date().toISOString();
    this.expires = data.expires || null;
    this.metadata = data.metadata || {};
    this.embedding = data.embedding || null;
  }
}
```

### 3.2 メモリタイプの定義

```javascript
const MemoryType = {
  OBSERVATION: 'observation',  // 観察結果
  THINKING: 'thinking',        // 思考プロセス
  CONTEXT: 'context',          // コンテキスト情報
  PREFERENCE: 'preference',    // ユーザー設定
  FEEDBACK: 'feedback',        // フィードバック
  FACT: 'fact',                // 事実
  RULE: 'rule',                // ルール
  CONCEPT: 'concept'           // 概念
};
```

### 3.3 メモリ優先度の定義

```javascript
const MemoryPriority = {
  CRITICAL: 'critical',    // 重要度最高
  HIGH: 'high',            // 重要度高
  MEDIUM: 'medium',        // 重要度中
  LOW: 'low',              // 重要度低
  BACKGROUND: 'background' // バックグラウンド
};
```

### 3.4 データベーススキーマ

#### 3.4.1 短期記憶（Redis）

Redisはキーバリューストアのため、スキーマは以下のような形式で設計します：

- キー: `working_memory:{memoryId}`
- 値: シリアライズされたメモリオブジェクト
- TTL: 設定された有効期限に基づく

#### 3.4.2 中期記憶（PostgreSQL）

```sql
CREATE TABLE episodic_memories (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created TIMESTAMP WITH TIME ZONE NOT NULL,
  expires TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  user_id VARCHAR(100),
  session_id VARCHAR(100),
  importance REAL DEFAULT 0.5,
  confidence REAL DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_episodic_memories_type ON episodic_memories(type);
CREATE INDEX idx_episodic_memories_user_id ON episodic_memories(user_id);
CREATE INDEX idx_episodic_memories_session_id ON episodic_memories(session_id);
CREATE INDEX idx_episodic_memories_importance ON episodic_memories(importance);
CREATE INDEX idx_episodic_memories_created ON episodic_memories(created);
CREATE INDEX idx_episodic_memories_metadata ON episodic_memories USING GIN (metadata);
```

#### 3.4.3 長期記憶（PostgreSQL + pgvector）

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created TIMESTAMP WITH TIME ZONE NOT NULL,
  expires TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  embedding VECTOR(1536),
  importance REAL DEFAULT 0.5,
  confidence REAL DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_knowledge_base_type ON knowledge_base(type);
CREATE INDEX idx_knowledge_base_importance ON knowledge_base(importance);
CREATE INDEX idx_knowledge_base_metadata ON knowledge_base USING GIN (metadata);
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## 4. API設計

### 4.1 共通インターフェース

すべての記憶モジュールは以下の共通インターフェースを実装します：

```javascript
interface MemoryInterface {
  // 基本CRUD操作
  store(memoryData: Object): Promise<string>;
  get(memoryId: string): Promise<Object|null>;
  update(memoryId: string, updateData: Object): Promise<Object|null>;
  delete(memoryId: string): Promise<boolean>;
  
  // 検索操作
  search(query: Object): Promise<Array<Object>>;
  
  // メタデータ操作
  updateMetadata(memoryId: string, metadata: Object): Promise<boolean>;
}
```

### 4.2 短期記憶API

```javascript
interface WorkingMemoryAPI extends MemoryInterface {
  // コンテキスト操作
  setCurrentContext(contextId: string): Promise<boolean>;
  getCurrentContext(): Promise<Object|null>;
  
  // 一時的なメモリ操作
  storeTemporary(data: Object, ttl: number): Promise<string>;
  getTemporaryByType(type: string): Promise<Array<Object>>;
  
  // クリーンアップ
  clearExpired(): Promise<number>;
  clearByType(type: string): Promise<number>;
}
```

### 4.3 中期記憶API

```javascript
interface EpisodicMemoryAPI extends MemoryInterface {
  // 会話履歴操作
  getConversationHistory(sessionId: string, limit: number): Promise<Array<Object>>;
  addToConversation(sessionId: string, message: Object): Promise<string>;
  
  // ユーザー操作
  getUserMemories(userId: string, type: string): Promise<Array<Object>>;
  
  // セッション操作
  getSessionMemories(sessionId: string): Promise<Array<Object>>;
  
  // タスク操作
  getTaskHistory(userId: string, limit: number): Promise<Array<Object>>;
  addTaskRecord(taskData: Object): Promise<string>;
}
```

### 4.4 長期記憶API

```javascript
interface KnowledgeBaseAPI extends MemoryInterface {
  // ベクトル検索
  searchSimilar(text: string, limit: number): Promise<Array<Object>>;
  searchByEmbedding(embedding: Array<number>, limit: number): Promise<Array<Object>>;
  
  // 知識操作
  getFact(factId: string): Promise<Object|null>;
  getRule(ruleId: string): Promise<Object|null>;
  getConcept(conceptId: string): Promise<Object|null>;
  
  // 関係操作
  getRelatedConcepts(conceptId: string): Promise<Array<Object>>;
  addRelationship(sourceId: string, targetId: string, type: string): Promise<string>;
}
```

### 4.5 統合API

```javascript
interface MemorySystemAPI {
  // 記憶操作
  createMemory(memoryData: Object): Promise<string>;
  getMemory(memoryId: string): Promise<Object|null>;
  updateMemory(memoryId: string, updateData: Object): Promise<Object|null>;
  deleteMemory(memoryId: string): Promise<boolean>;
  
  // 検索操作
  searchMemories(query: Object): Promise<Array<Object>>;
  searchByText(text: string, options: Object): Promise<Array<Object>>;
  
  // 記憶強化・減衰
  strengthenMemory(memoryId: string): Promise<boolean>;
  decayMemories(): Promise<number>;
  
  // 記憶統合
  integrateMemories(options: Object): Promise<Array<string>>;
  
  // 思考プロセス連携
  storeThinkingProcess(processData: Object): Promise<string>;
  getRelevantMemoriesForThinking(context: Object): Promise<Array<Object>>;
}
```

## 5. 既存システムとの統合設計

### 5.1 Redis統合

短期記憶モジュールはRedisと統合し、以下の機能を実装します：

- **キャッシュ管理**: TTLベースの自動期限切れ
- **パブリッシュ/サブスクライブ**: リアルタイムイベント通知
- **トランザクション**: 複数操作の原子性保証
- **データ構造**: ハッシュ、リスト、セットの活用

```javascript
// Redis接続設定
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 3710,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  keyPrefix: 'harca:'
};

// Redis接続クライアント
const redisClient = new Redis(redisConfig);
```

### 5.2 PostgreSQL統合

中期記憶と長期記憶モジュールはPostgreSQLと統合し、以下の機能を実装します：

- **トランザクション**: ACID準拠の操作
- **インデックス**: 効率的な検索のための最適化
- **JSONBサポート**: 柔軟なメタデータ保存
- **イベントトリガー**: 自動化されたアクション

```javascript
// PostgreSQL接続設定
const pgConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 3730,
  database: process.env.PG_DATABASE || 'harca',
  user: process.env.PG_USER || 'harca',
  password: process.env.PG_PASSWORD,
  ssl: process.env.PG_SSL === 'true'
};

// PostgreSQLクライアント
const pgClient = new Pool(pgConfig);
```

### 5.3 pgvector統合

長期記憶モジュールはpgvectorと統合し、以下の機能を実装します：

- **ベクトル埋め込み**: OpenAI Ada 002モデルによる生成
- **類似度検索**: コサイン類似度に基づく検索
- **インデックス最適化**: IVFFlatインデックスの活用
- **フィルタリング**: メタデータとベクトル検索の組み合わせ

```javascript
// ベクトル検索クエリ例
const vectorSearchQuery = `
  SELECT id, content, metadata, 
         1 - (embedding <=> $1) AS similarity
  FROM knowledge_base
  WHERE metadata->>'domain' = $2
  ORDER BY similarity DESC
  LIMIT $3
`;
```

### 5.4 Sequential Thinking統合

Sequential Thinking MCPとの統合は以下の機能を実装します：

- **思考コンテキスト**: 短期記憶への思考ステップの保存
- **知識活用**: 長期記憶からの関連知識の取得
- **思考履歴**: 中期記憶への思考プロセスの記録
- **ルール適用**: 長期記憶のルールエンジンとの連携

```javascript
// Sequential Thinking統合例
async function integrateWithThinking(thinkingProcess) {
  // 短期記憶に思考コンテキストを保存
  const contextId = await workingMemory.storeThinkingContext(thinkingProcess);
  
  // 関連する長期記憶を検索
  const relevantKnowledge = await knowledgeBase.searchSimilar(
    thinkingProcess.currentStep.content,
    5
  );
  
  // 思考プロセスを中期記憶に記録
  await episodicMemory.addThinkingRecord({
    processId: thinkingProcess.id,
    step: thinkingProcess.currentStep,
    relevantKnowledge: relevantKnowledge.map(k => k.id)
  });
  
  return {
    contextId,
    relevantKnowledge
  };
}
```

## 6. 実装計画

### 6.1 短期記憶モジュール実装

1. Redis基盤の短期記憶サービス実装
   - Redis接続クライアントの設定
   - キャッシュ管理機能の実装
   - TTL管理の最適化

2. コンテキスト管理機能実装
   - コンテキストの作成・取得・更新機能
   - コンテキスト間の関係管理
   - コンテキスト切り替え機能

3. 揮発性メモリ管理機能実装
   - 一時的なメモリの保存・取得
   - 自動クリーンアップ機能
   - 容量制限管理

4. テストとパフォーマンス最適化
   - 単体テストの作成
   - 負荷テストの実施
   - キャッシュヒット率の最適化

### 6.2 中期記憶モジュール実装

1. PostgreSQL基盤の中期記憶サービス実装
   - データベーススキーマの作成
   - CRUD操作の実装
   - インデックス最適化

2. 会話履歴管理機能実装
   - 会話の記録・取得機能
   - セッション管理
   - 会話コンテキスト追跡

3. ユーザー固有情報管理機能実装
   - ユーザープロファイル管理
   - 好みと設定の追跡
   - ユーザー行動パターンの学習

4. テストとパフォーマンス最適化
   - 単体テストと統合テスト
   - クエリパフォーマンスの最適化
   - キャッシュ戦略の実装

### 6.3 長期記憶モジュール実装

1. ベクトルDB基盤の長期記憶サービス実装
   - pgvector拡張の設定
   - 埋め込みモデルの統合
   - ベクトル検索の最適化

2. メモリコーパス管理機能実装
   - 知識の分類と組織化
   - メタデータインデックスの最適化
   - 知識間の関係管理

3. 知識ベース管理機能実装
   - 事実、ルール、概念の管理
   - 知識の検証と更新
   - 知識グラフの構築

4. テストとパフォーマンス最適化
   - ベクトル検索の精度評価
   - スケーラビリティテスト
   - インデックス戦略の最適化

### 6.4 記憶管理システム実装

1. 記憶の重要度評価アルゴリズム実装
   - 重要度スコアリングモデル
   - コンテキスト依存の重要度調整
   - ユーザーフィードバックの統合

2. 記憶の強化・衰退メカニズム実装
   - アクセス頻度に基づく強化
   - 時間経過に基づく減衰
   - 重要度に基づく保持戦略

3. 記憶の統合・要約機能実装
   - 類似記憶の検出と統合
   - 冗長情報の削減
   - 知識の抽象化と一般化

4. テストと最適化
   - エンドツーエンドテスト
   - メモリ使用量の最適化
   - スケーラビリティの検証

## 7. リスクと対策

### 7.1 技術的リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Redis障害による短期記憶喪失 | 高 | 定期的なスナップショット、レプリケーション設定 |
| PostgreSQLのパフォーマンス低下 | 中 | クエリ最適化、適切なインデックス設計、定期的なVACUUM |
| ベクトル検索の精度問題 | 高 | 複数の埋め込みモデルのテスト、ハイブリッド検索の実装 |
| スケーラビリティの課題 | 中 | シャーディング戦略、読み取りレプリカの活用 |

### 7.2 実装リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 複雑な依存関係による開発遅延 | 中 | モジュール間の明確なインターフェース定義、段階的実装 |
| テストカバレッジ不足 | 高 | TDD手法の採用、自動化テスト戦略の強化 |
| 技術的負債の蓄積 | 中 | 定期的なコードレビュー、リファクタリングの計画的実施 |
| 環境差異による問題 | 低 | Docker化、環境設定の標準化 |

## 8. 結論

多階層記憶システムは、HARCAプロジェクトの中核機能として、コンテキスト理解と知識活用を大幅に強化します。短期記憶、中期記憶、長期記憶の各層が連携することで、人間の記憶システムに倣った柔軟かつ効率的な情報管理が可能になります。

本設計書に基づいて実装を進め、Sequential Thinking MCPとの統合により、より高度な思考プロセスと記憶の連携を実現します。また、継続的な改善とフィードバックを通じて、システムの精度と効率を向上させていきます。
