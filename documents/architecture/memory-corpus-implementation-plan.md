---
title: "多階層記憶システム実装計画"
date: "2025-03-23"
author: "HARCA開発チーム"
status: "approved"
document_number: "ARCH-002"
related_documents: ["system-architecture-overview.md", "containerized-modular-monolith.md"]
---

# 多階層記憶システム実装計画

*作成日: 2025年3月23日*

## 概要

本ドキュメントは、HARCAプロジェクトのPhase 3で実装予定の「メモリコーパス」「知識ベース」による多階層記憶システムの詳細な実装計画を記述したものです。人間の記憶システムに倣った多階層記憶アーキテクチャを採用し、既存のRedis、PostgreSQL、pgvectorの基盤技術を活用して実装します。

## アーキテクチャ概要

多階層記憶システムは、以下の3つの階層で構成されます：

1. **短期記憶（作業記憶）**
   - **技術基盤**: Redis
   - **特性**: 高速アクセス、揮発性、容量制限
   - **用途**: 現在のコンテキスト、最近の対話履歴、一時的な情報

2. **中期記憶（エピソード記憶）**
   - **技術基盤**: PostgreSQL
   - **特性**: 構造化データ、関係性保持、中程度の永続性
   - **用途**: 会話履歴、ユーザー固有情報、タスク進捗状況

3. **長期記憶（意味記憶）**
   - **技術基盤**: PostgreSQL + pgvector
   - **特性**: 永続性、ベクトル検索、大容量
   - **用途**: メモリコーパス、知識ベース、学習した概念

## モジュール構成

多階層記憶システムは、以下のモジュールで構成されます：

```
/modules/memory-corpus/
├── index.js                 # メインエントリーポイント
├── memory-manager.js        # 記憶管理システム
├── short-term/              # 短期記憶モジュール
│   ├── index.js
│   ├── redis-memory.js
│   └── context-manager.js
├── mid-term/                # 中期記憶モジュール
│   ├── index.js
│   ├── postgres-memory.js
│   └── conversation-history.js
└── long-term/               # 長期記憶モジュール
    ├── index.js
    ├── vector-memory.js
    └── knowledge-base.js
```

## データモデル

### 短期記憶（Redis）

```javascript
// キー構造: memory:short-term:{userId}:{contextId}
{
  "id": "unique-memory-id",
  "type": "context", // context, conversation, temporary
  "content": "記憶内容",
  "metadata": {
    "source": "user-input",
    "timestamp": "2025-03-23T10:30:00Z",
    "importance": 0.8 // 0.0 ~ 1.0
  },
  "ttl": 3600 // 秒単位、デフォルト1時間
}
```

### 中期記憶（PostgreSQL）

```sql
CREATE TABLE mid_term_memories (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- conversation, user_preference, task
  content JSONB NOT NULL,
  metadata JSONB,
  importance FLOAT DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 1
);

CREATE INDEX idx_mid_term_memories_user_id ON mid_term_memories(user_id);
CREATE INDEX idx_mid_term_memories_type ON mid_term_memories(type);
CREATE INDEX idx_mid_term_memories_importance ON mid_term_memories(importance);
CREATE INDEX idx_mid_term_memories_created_at ON mid_term_memories(created_at);
CREATE INDEX idx_mid_term_memories_metadata ON mid_term_memories USING GIN (metadata);
```

### 長期記憶（PostgreSQL + pgvector）

```sql
CREATE TABLE long_term_memories (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255),
  type VARCHAR(50) NOT NULL, -- knowledge, concept, rule
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI Ada 002の埋め込みベクトル
  metadata JSONB,
  importance FLOAT DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 1,
  reinforcement_count INTEGER DEFAULT 0
);

CREATE INDEX idx_long_term_memories_user_id ON long_term_memories(user_id);
CREATE INDEX idx_long_term_memories_type ON long_term_memories(type);
CREATE INDEX idx_long_term_memories_importance ON long_term_memories(importance);
CREATE INDEX idx_long_term_memories_metadata ON long_term_memories USING GIN (metadata);
CREATE INDEX idx_long_term_memories_embedding ON long_term_memories USING hnsw (embedding vector_cosine_ops);
```

## 主要機能

### 1. 記憶の保存と取得

```javascript
// 記憶の保存
async function storeMemory(userId, memoryType, content, options = {}) {
  const { tier, metadata = {}, importance = 0.5, ttl } = options;
  
  switch (tier) {
    case 'short-term':
      return await shortTermMemory.store(userId, memoryType, content, metadata, importance, ttl);
    case 'mid-term':
      return await midTermMemory.store(userId, memoryType, content, metadata, importance);
    case 'long-term':
      return await longTermMemory.store(userId, memoryType, content, metadata, importance);
    default:
      // 重要度に基づいて適切な階層を自動選択
      return await memoryManager.storeWithOptimalTier(userId, memoryType, content, metadata, importance);
  }
}

// 記憶の取得
async function retrieveMemory(userId, query, options = {}) {
  const { tier, limit = 10, threshold = 0.7, metadata = {} } = options;
  
  switch (tier) {
    case 'short-term':
      return await shortTermMemory.retrieve(userId, query, limit, metadata);
    case 'mid-term':
      return await midTermMemory.retrieve(userId, query, limit, metadata);
    case 'long-term':
      return await longTermMemory.retrieveSimilar(userId, query, threshold, limit, metadata);
    default:
      // 全階層から検索して最適な結果を返す
      return await memoryManager.retrieveFromAllTiers(userId, query, limit, threshold, metadata);
  }
}
```

### 2. 記憶の強化と衰退

```javascript
// 記憶の強化（重要度の増加、アクセスカウントの更新）
async function reinforceMemory(memoryId, reinforcementFactor = 0.1) {
  const memory = await memoryManager.getMemoryById(memoryId);
  
  if (!memory) return null;
  
  // 重要度の更新（上限1.0）
  const newImportance = Math.min(memory.importance + reinforcementFactor, 1.0);
  
  // 記憶の階層移動（必要に応じて）
  if (memory.tier === 'short-term' && newImportance > 0.7) {
    // 短期記憶から中期記憶への移動
    await memoryManager.moveTier(memoryId, 'short-term', 'mid-term');
  } else if (memory.tier === 'mid-term' && newImportance > 0.9) {
    // 中期記憶から長期記憶への移動
    await memoryManager.moveTier(memoryId, 'mid-term', 'long-term');
  } else {
    // 同じ階層内での重要度更新
    await memoryManager.updateImportance(memoryId, memory.tier, newImportance);
  }
  
  return await memoryManager.getMemoryById(memoryId);
}

// 記憶の衰退（定期的なバッチ処理）
async function decayMemories(userId, decayFactor = 0.05) {
  // 短期記憶の衰退（TTLベース、Redis自体の機能を活用）
  
  // 中期記憶の衰退
  const midTermMemories = await midTermMemory.getAllForUser(userId);
  for (const memory of midTermMemories) {
    const daysSinceLastAccess = daysBetween(new Date(), memory.last_accessed_at);
    const accessFactor = 1 / (memory.access_count + 1);
    const totalDecay = decayFactor * daysSinceLastAccess * accessFactor;
    
    const newImportance = Math.max(memory.importance - totalDecay, 0);
    
    if (newImportance < 0.2) {
      // 重要度が低すぎる場合は削除
      await midTermMemory.delete(memory.id);
    } else {
      await midTermMemory.updateImportance(memory.id, newImportance);
    }
  }
  
  // 長期記憶の衰退（より緩やかに）
  const longTermMemories = await longTermMemory.getAllForUser(userId);
  for (const memory of longTermMemories) {
    const monthsSinceLastAccess = monthsBetween(new Date(), memory.last_accessed_at);
    const accessFactor = 1 / (memory.access_count + memory.reinforcement_count + 1);
    const totalDecay = (decayFactor / 3) * monthsSinceLastAccess * accessFactor;
    
    const newImportance = Math.max(memory.importance - totalDecay, 0);
    
    if (newImportance < 0.1) {
      // 重要度が極めて低い場合は削除
      await longTermMemory.delete(memory.id);
    } else {
      await longTermMemory.updateImportance(memory.id, newImportance);
    }
  }
}
```

### 3. 記憶の統合と要約

```javascript
// 関連する記憶の統合
async function consolidateMemories(userId, memoryIds, options = {}) {
  const { newTier = 'long-term', newType = 'consolidated', newImportance = 0.8 } = options;
  
  // 統合対象の記憶を取得
  const memories = await Promise.all(
    memoryIds.map(id => memoryManager.getMemoryById(id))
  );
  
  // 記憶内容を結合
  const consolidatedContent = await memoryManager.generateConsolidatedContent(memories);
  
  // メタデータをマージ
  const mergedMetadata = {
    source: 'consolidation',
    original_memories: memoryIds,
    timestamp: new Date().toISOString(),
    ...options.metadata
  };
  
  // 新しい統合記憶を保存
  const newMemoryId = await storeMemory(
    userId,
    newType,
    consolidatedContent,
    {
      tier: newTier,
      metadata: mergedMetadata,
      importance: newImportance
    }
  );
  
  // 元の記憶の重要度を下げる（オプション）
  if (options.decreaseOriginalImportance) {
    for (const id of memoryIds) {
      const memory = await memoryManager.getMemoryById(id);
      if (memory) {
        await memoryManager.updateImportance(
          id,
          memory.tier,
          memory.importance * 0.7
        );
      }
    }
  }
  
  return newMemoryId;
}

// 会話履歴の要約
async function summarizeConversation(userId, conversationId, options = {}) {
  const { maxLength = 5000, targetTier = 'mid-term', importance = 0.7 } = options;
  
  // 会話履歴を取得
  const conversationMemories = await midTermMemory.getConversationHistory(
    userId,
    conversationId
  );
  
  // 会話内容を結合
  const fullConversation = conversationMemories
    .sort((a, b) => new Date(a.metadata.timestamp) - new Date(b.metadata.timestamp))
    .map(m => m.content)
    .join('\n');
  
  // 長すぎる場合は要約を生成
  let summaryContent;
  if (fullConversation.length > maxLength) {
    summaryContent = await memoryManager.generateSummary(fullConversation);
  } else {
    summaryContent = fullConversation;
  }
  
  // 要約を保存
  const summaryMetadata = {
    source: 'summary',
    original_conversation: conversationId,
    timestamp: new Date().toISOString(),
    ...options.metadata
  };
  
  return await storeMemory(
    userId,
    'conversation_summary',
    summaryContent,
    {
      tier: targetTier,
      metadata: summaryMetadata,
      importance
    }
  );
}
```

## Sequential Thinking MCPとの統合

Sequential Thinking MCPと多階層記憶システムを統合するための主要なインターフェースを以下に示します：

```javascript
// Sequential Thinkingコンテキストの保存
async function storeThinkingContext(userId, thinkingId, context, metadata = {}) {
  return await shortTermMemory.store(
    userId,
    'thinking_context',
    context,
    {
      thinking_id: thinkingId,
      ...metadata
    },
    0.8, // 高い重要度
    3600 // 1時間のTTL
  );
}

// 思考プロセスの保存
async function storeThinkingProcess(userId, thinkingId, process, metadata = {}) {
  return await midTermMemory.store(
    userId,
    'thinking_process',
    process,
    {
      thinking_id: thinkingId,
      ...metadata
    },
    0.7 // 中程度の重要度
  );
}

// 思考プロセスからの知識抽出
async function extractKnowledgeFromThinking(userId, thinkingId) {
  // 思考プロセスを取得
  const thinkingProcess = await midTermMemory.retrieveByMetadata(
    userId,
    { thinking_id: thinkingId, type: 'thinking_process' }
  );
  
  if (!thinkingProcess || thinkingProcess.length === 0) {
    return null;
  }
  
  // 知識を抽出
  const extractedKnowledge = await memoryManager.extractKnowledge(
    thinkingProcess[0].content
  );
  
  // 抽出した知識を長期記憶に保存
  const knowledgeIds = [];
  for (const knowledge of extractedKnowledge) {
    const id = await longTermMemory.store(
      userId,
      'extracted_knowledge',
      knowledge.content,
      {
        source: 'thinking_process',
        thinking_id: thinkingId,
        confidence: knowledge.confidence,
        ...knowledge.metadata
      },
      knowledge.importance || 0.6
    );
    knowledgeIds.push(id);
  }
  
  return knowledgeIds;
}

// 思考プロセスのための関連記憶取得
async function retrieveMemoriesForThinking(userId, query, thinkingContext, options = {}) {
  // コンテキストを考慮した検索
  const contextualQuery = memoryManager.enhanceQueryWithContext(query, thinkingContext);
  
  // 全階層から関連記憶を検索
  return await memoryManager.retrieveFromAllTiers(
    userId,
    contextualQuery,
    options.limit || 10,
    options.threshold || 0.7,
    options.metadata || {}
  );
}
```

## ドキュメントRAGとの統合

ドキュメントRAGと多階層記憶システムを統合するための主要なインターフェースを以下に示します：

```javascript
// ドキュメントから抽出した知識の保存
async function storeDocumentKnowledge(userId, documentId, knowledge, metadata = {}) {
  return await longTermMemory.store(
    userId,
    'document_knowledge',
    knowledge.content,
    {
      document_id: documentId,
      source: 'document',
      ...metadata,
      ...knowledge.metadata
    },
    knowledge.importance || 0.6
  );
}

// ドキュメント検索結果のキャッシュ
async function cacheDocumentSearchResult(userId, query, results, metadata = {}) {
  const cacheKey = `document_search:${userId}:${hash(query)}`;
  
  return await shortTermMemory.storeRaw(
    cacheKey,
    JSON.stringify(results),
    {
      query,
      ...metadata
    },
    0.5, // 中程度の重要度
    3600 // 1時間のTTL
  );
}

// キャッシュされた検索結果の取得
async function getCachedDocumentSearchResult(userId, query) {
  const cacheKey = `document_search:${userId}:${hash(query)}`;
  const cached = await shortTermMemory.retrieveRaw(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  return null;
}

// ドキュメント検索と記憶検索の統合
async function integratedSearch(userId, query, options = {}) {
  // 並列で検索を実行
  const [documentResults, memoryResults] = await Promise.all([
    // ドキュメント検索（キャッシュ確認）
    (async () => {
      const cached = await getCachedDocumentSearchResult(userId, query);
      if (cached) return cached;
      
      const results = await documentRag.search(query, options.documentOptions || {});
      await cacheDocumentSearchResult(userId, query, results);
      return results;
    })(),
    
    // 記憶検索
    memoryManager.retrieveFromAllTiers(
      userId,
      query,
      options.limit || 10,
      options.threshold || 0.7,
      options.metadata || {}
    )
  ]);
  
  // 結果のマージとランキング
  return memoryManager.mergeAndRankResults(documentResults, memoryResults, query);
}
```

## テスト計画

多階層記憶システムのテストは、以下の観点から実施します：

1. **単体テスト**
   - 各記憶階層の基本機能（保存、取得、更新、削除）
   - 記憶管理システムの機能（強化、衰退、統合、要約）
   - Sequential Thinkingとの統合機能
   - ドキュメントRAGとの統合機能

2. **統合テスト**
   - 階層間の記憶移動
   - 複数階層からの統合検索
   - Sequential Thinkingとの連携フロー
   - ドキュメントRAGとの連携フロー

3. **パフォーマンステスト**
   - 大量データ時の検索性能
   - 並列リクエスト時の応答性能
   - メモリ使用量
   - CPU使用率

4. **耐久テスト**
   - 長時間運用時の安定性
   - 記憶の衰退メカニズムの動作確認
   - エラー復旧メカニズムの検証

## 実装スケジュール

多階層記憶システムの実装は、以下のスケジュールで進めます：

1. **多階層記憶システムの設計** (2025/3/23〜3/26)
   - 記憶階層の定義
   - データモデルの設計
   - API設計
   - 既存システムとの統合設計

2. **短期記憶モジュール実装** (2025/3/27〜3/29)
   - Redis基盤の短期記憶サービス実装
   - コンテキスト管理機能実装
   - 揮発性メモリ管理機能実装
   - テストとパフォーマンス最適化

3. **中期記憶モジュール実装** (2025/3/30〜4/2)
   - PostgreSQL基盤の中期記憶サービス実装
   - 会話履歴管理機能実装
   - ユーザー固有情報管理機能実装
   - テストとパフォーマンス最適化

4. **長期記憶モジュール実装** (2025/4/3〜4/7)
   - ベクトルDB基盤の長期記憶サービス実装
   - メモリコーパス管理機能実装
   - 知識ベース管理機能実装
   - テストとパフォーマンス最適化

5. **記憶管理システム実装** (2025/4/8〜4/12)
   - 記憶の重要度評価アルゴリズム実装
   - 記憶の強化・衰退メカニズム実装
   - 記憶の統合・要約機能実装
   - テストと最適化

## 結論

本実装計画に基づき、HARCAプロジェクトのPhase 3で「メモリコーパス」「知識ベース」による多階層記憶システムを実装します。既存の基盤技術（Redis、PostgreSQL、pgvector）を活用し、人間の記憶システムに倣った階層構造を持つ記憶システムを構築することで、コンテキスト理解と知識活用を大幅に強化します。

また、Sequential Thinking MCPとドキュメントRAGとの統合により、思考プロセスと記憶、知識ベースを連携させることで、より高度な問題解決能力を実現します。
