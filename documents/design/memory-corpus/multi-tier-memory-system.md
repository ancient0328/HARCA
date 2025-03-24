---
title: "多階層記憶システム設計書"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
---

# 多階層記憶システム設計書

## 1. 概要

本設計書は、HARCAプロジェクトのPhase 3で実装する多階層記憶システムの詳細設計を記述したものです。多階層記憶システムは、人間の記憶システムに倣い、短期記憶（作業記憶）、中期記憶（エピソード記憶）、長期記憶（意味記憶）の3つの階層で構成されます。

## 2. 設計目標

1. **人間の記憶システムに倣った階層構造の実現**
   - 短期記憶：揮発性が高く、即時アクセス可能な一時的な情報の保存
   - 中期記憶：会話履歴やユーザー固有情報など、中程度の持続性を持つ情報の保存
   - 長期記憶：事実、ルール、知識など、長期的に保持すべき情報の保存

2. **効率的なメモリ管理**
   - 重要度に基づくメモリの保持/破棄の決定
   - 類似メモリの統合と重複排除
   - 記憶の強化・衰退メカニズムの実装

3. **高速な検索と取得**
   - 各階層に適したストレージ技術の活用
   - 効率的なインデックス構造の実装
   - キャッシュ戦略の最適化

4. **Sequential Thinking MCPとの統合**
   - 思考プロセスと記憶システムの連携
   - コンテキスト管理の強化
   - 知識活用の最適化

## 3. システムアーキテクチャ

### 3.1 全体構成

多階層記憶システムは以下のコンポーネントで構成されます：

```
memory-corpus/
├── src/
│   ├── index.js                 # エントリーポイント
│   ├── memory-model.js          # 基本メモリモデル（共通）
│   ├── memory-manager.js        # 基本メモリ管理機能（共通）
│   ├── memory-search.js         # 検索機能（共通）
│   ├── memory-optimizer.js      # 最適化機能（共通）
│   ├── short-term/              # 短期記憶モジュール
│   │   ├── index.js             # 短期記憶エントリーポイント
│   │   ├── working-memory.js    # 作業記憶実装
│   │   └── context-manager.js   # コンテキスト管理
│   ├── mid-term/                # 中期記憶モジュール
│   │   ├── index.js             # 中期記憶エントリーポイント
│   │   ├── episodic-memory.js   # エピソード記憶実装
│   │   └── user-profile.js      # ユーザープロファイル管理
│   └── long-term/               # 長期記憶モジュール
│       ├── index.js             # 長期記憶エントリーポイント
│       ├── semantic-memory.js   # 意味記憶実装
│       └── knowledge-base.js    # 知識ベース管理
└── tests/                       # テストディレクトリ
    ├── short-term/              # 短期記憶テスト
    ├── mid-term/                # 中期記憶テスト
    └── long-term/               # 長期記憶テスト
```

### 3.2 データフロー

1. **メモリ生成**
   - ユーザー入力、システム観察、外部ソースからのデータを元にメモリを生成
   - メモリタイプに応じて適切な階層に振り分け

2. **メモリ保存**
   - 短期記憶：Redis（インメモリ）
   - 中期記憶：PostgreSQL（リレーショナルDB）
   - 長期記憶：PostgreSQL + pgvector（ベクトルDB）

3. **メモリ検索・取得**
   - 階層横断検索：複数階層から関連メモリを検索
   - 階層内検索：特定階層内でのメモリ検索
   - コンテキスト検索：現在のコンテキストに関連するメモリ検索

4. **メモリ最適化**
   - 定期的な最適化処理の実行
   - 重要度評価と記憶の強化/衰退
   - 類似メモリの統合と重複排除

## 4. 各階層の詳細設計

### 4.1 短期記憶（作業記憶）

**目的**：
- 現在の会話コンテキストや一時的な情報を保持
- 即時アクセス可能な高速メモリの提供

**特徴**：
- 高揮発性（TTL: 30分〜2時間）
- 非常に高速なアクセス
- 容量制限あり（最新の100〜200アイテム）

**実装**：
- ストレージ：Redis
- データ構造：
  ```javascript
  {
    id: "wm_<uuid>",
    content: "記憶内容",
    type: "working_memory",
    context_id: "現在のコンテキストID",
    created_at: "2025-03-23T11:45:14+09:00",
    expires_at: "2025-03-23T13:45:14+09:00", // 2時間後
    priority: "high|medium|low",
    metadata: {
      source: "user_input|system_observation|external",
      session_id: "現在のセッションID"
    }
  }
  ```

**主要機能**：
- `WorkingMemory.store(data)`: 作業記憶の保存
- `WorkingMemory.retrieve(query)`: 作業記憶の取得
- `WorkingMemory.updateContext(contextId)`: コンテキスト更新
- `ContextManager.trackContext(data)`: コンテキスト追跡
- `ContextManager.getCurrentContext()`: 現在のコンテキスト取得

### 4.2 中期記憶（エピソード記憶）

**目的**：
- 会話履歴やユーザー固有情報の保持
- 中程度の持続性を持つ情報の管理

**特徴**：
- 中程度の揮発性（TTL: 1日〜30日）
- バランスの取れたアクセス速度と持続性
- 会話単位、セッション単位の記憶管理

**実装**：
- ストレージ：PostgreSQL
- データ構造：
  ```javascript
  {
    id: "em_<uuid>",
    content: "記憶内容",
    type: "episodic_memory",
    user_id: "ユーザーID",
    session_id: "セッションID",
    conversation_id: "会話ID",
    created_at: "2025-03-23T11:45:14+09:00",
    updated_at: "2025-03-23T11:45:14+09:00",
    expires_at: "2025-04-22T11:45:14+09:00", // 30日後
    priority: "high|medium|low",
    tags: ["tag1", "tag2"],
    metadata: {
      emotion: "positive|neutral|negative",
      importance: 0.75 // 0.0〜1.0
    }
  }
  ```

**主要機能**：
- `EpisodicMemory.store(data)`: エピソード記憶の保存
- `EpisodicMemory.retrieve(query)`: エピソード記憶の取得
- `EpisodicMemory.getConversationHistory(conversationId)`: 会話履歴取得
- `UserProfile.updateProfile(userId, data)`: ユーザープロファイル更新
- `UserProfile.getPreferences(userId)`: ユーザー設定取得

### 4.3 長期記憶（意味記憶）

**目的**：
- 事実、ルール、知識など長期的に保持すべき情報の管理
- 知識ベースとしての機能提供

**特徴**：
- 低揮発性（TTL: 90日〜無期限）
- 構造化された知識の保存
- 意味的関連性に基づく検索

**実装**：
- ストレージ：PostgreSQL + pgvector
- データ構造：
  ```javascript
  {
    id: "sm_<uuid>",
    content: "記憶内容",
    type: "semantic_memory",
    category: "fact|rule|concept|procedure",
    created_at: "2025-03-23T11:45:14+09:00",
    updated_at: "2025-03-23T11:45:14+09:00",
    expires_at: null, // 無期限
    confidence: 0.95, // 0.0〜1.0
    priority: "high|medium|low",
    tags: ["tag1", "tag2"],
    embedding: [0.1, 0.2, ...], // ベクトル埋め込み
    metadata: {
      source: "user_input|system_learning|external_knowledge",
      verification_status: "verified|unverified"
    }
  }
  ```

**主要機能**：
- `SemanticMemory.store(data)`: 意味記憶の保存
- `SemanticMemory.retrieve(query)`: 意味記憶の取得
- `SemanticMemory.semanticSearch(text, options)`: 意味的検索
- `KnowledgeBase.addKnowledge(data)`: 知識の追加
- `KnowledgeBase.queryKnowledge(query)`: 知識のクエリ

## 5. 記憶管理システム

### 5.1 記憶の重要度評価

**評価基準**：
- 使用頻度：アクセス回数、最終アクセス日時
- 関連性：現在のコンテキストとの関連度
- 明示的重要度：ユーザーやシステムによる重要度指定
- 情報の希少性：類似情報の存在有無

**実装**：
```javascript
// 重要度スコア計算（0.0〜1.0）
function calculateImportanceScore(memory, context) {
  const frequencyScore = calculateFrequencyScore(memory);
  const relevanceScore = calculateRelevanceScore(memory, context);
  const explicitScore = memory.metadata.importance || 0.5;
  const rarityScore = calculateRarityScore(memory);
  
  return (
    frequencyScore * 0.3 +
    relevanceScore * 0.3 +
    explicitScore * 0.2 +
    rarityScore * 0.2
  );
}
```

### 5.2 記憶の強化・衰退メカニズム

**強化条件**：
- 頻繁なアクセス
- 高い関連性
- 明示的な重要度指定

**衰退条件**：
- 長期間のアクセスなし
- 低い関連性
- 類似情報の存在

**実装**：
```javascript
// 記憶の強化（有効期限延長、優先度上昇）
async function reinforceMemory(memory, factor = 1.5) {
  // 有効期限の延長
  if (memory.expires_at) {
    const currentExpiry = new Date(memory.expires_at).getTime();
    const newExpiry = new Date(currentExpiry * factor);
    memory.expires_at = newExpiry.toISOString();
  }
  
  // 優先度の上昇
  if (memory.priority === 'low') {
    memory.priority = 'medium';
  } else if (memory.priority === 'medium') {
    memory.priority = 'high';
  }
  
  return await updateMemory(memory.id, memory);
}

// 記憶の衰退（有効期限短縮、優先度低下）
async function decayMemory(memory, factor = 0.7) {
  // 有効期限の短縮
  if (memory.expires_at) {
    const currentExpiry = new Date(memory.expires_at).getTime();
    const newExpiry = new Date(currentExpiry * factor);
    memory.expires_at = newExpiry.toISOString();
  }
  
  // 優先度の低下
  if (memory.priority === 'high') {
    memory.priority = 'medium';
  } else if (memory.priority === 'medium') {
    memory.priority = 'low';
  }
  
  return await updateMemory(memory.id, memory);
}
```

### 5.3 記憶の統合・要約機能

**統合条件**：
- 高い類似度（閾値: 0.92以上）
- 同一カテゴリ/タイプ
- 時間的近接性

**要約条件**：
- 特定カテゴリの記憶が閾値を超えた場合
- 長期間アクセスされていない類似記憶群

**実装**：
```javascript
// 類似記憶の統合
async function mergeMemories(memories) {
  if (memories.length < 2) return memories;
  
  // 最も信頼度の高いメモリを基準にする
  memories.sort((a, b) => b.confidence - a.confidence);
  const baseMemory = memories[0];
  
  // 統合メモリの作成
  const mergedMemory = {
    ...baseMemory,
    id: `merged_${baseMemory.id}`,
    content: enhanceContent(memories),
    confidence: calculateMergedConfidence(memories),
    metadata: {
      ...baseMemory.metadata,
      merged_from: memories.map(m => m.id),
      merge_date: new Date().toISOString()
    }
  };
  
  // 古いメモリの削除と新しいメモリの保存
  await bulkDeleteMemories(memories.map(m => m.id));
  return await createMemory(mergedMemory);
}

// 記憶の要約
async function summarizeMemories(memories, maxLength = 500) {
  const combinedContent = memories.map(m => m.content).join("\n\n");
  const summary = await summarizerService.summarize(combinedContent, { maxLength });
  
  return {
    content: summary,
    type: 'summary',
    confidence: calculateAverageConfidence(memories),
    metadata: {
      summarized_from: memories.map(m => m.id),
      summary_date: new Date().toISOString(),
      original_count: memories.length
    }
  };
}
```

## 6. Sequential Thinking MCPとの統合

### 6.1 思考プロセスと短期記憶の統合

**統合ポイント**：
- 思考コンテキストの短期記憶への保存
- 短期記憶からの思考コンテキスト取得
- リアルタイム連携

**API設計**：
```javascript
// 思考コンテキストの短期記憶への保存
async function storeThinkingContext(contextData) {
  const workingMemory = new WorkingMemory();
  return await workingMemory.store({
    content: JSON.stringify(contextData.steps),
    type: 'thinking_context',
    context_id: contextData.contextId,
    metadata: {
      thinking_id: contextData.thinkingId,
      step_count: contextData.steps.length,
      goal: contextData.goal
    }
  });
}

// 短期記憶からの思考コンテキスト取得
async function getThinkingContext(contextId) {
  const workingMemory = new WorkingMemory();
  const results = await workingMemory.retrieve({
    type: 'thinking_context',
    context_id: contextId
  });
  
  if (results.length === 0) return null;
  
  // 最新のコンテキストを返す
  results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return {
    contextId: contextId,
    steps: JSON.parse(results[0].content),
    thinkingId: results[0].metadata.thinking_id,
    goal: results[0].metadata.goal
  };
}
```

### 6.2 思考プロセスと中期記憶の統合

**統合ポイント**：
- 思考履歴の中期記憶への保存
- 中期記憶からの思考パターン取得
- ユーザー固有の思考パターン学習

**API設計**：
```javascript
// 思考履歴の中期記憶への保存
async function storeThinkingHistory(thinkingData) {
  const episodicMemory = new EpisodicMemory();
  return await episodicMemory.store({
    content: JSON.stringify(thinkingData.steps),
    type: 'thinking_history',
    user_id: thinkingData.userId,
    session_id: thinkingData.sessionId,
    conversation_id: thinkingData.conversationId,
    tags: ['thinking_history', ...thinkingData.tags],
    metadata: {
      thinking_id: thinkingData.thinkingId,
      goal: thinkingData.goal,
      outcome: thinkingData.outcome,
      duration_ms: thinkingData.durationMs
    }
  });
}

// 中期記憶からの思考パターン取得
async function getThinkingPatterns(userId, goal) {
  const episodicMemory = new EpisodicMemory();
  const results = await episodicMemory.retrieve({
    type: 'thinking_history',
    user_id: userId,
    metadata: {
      goal: { $similar: goal }
    }
  });
  
  return results.map(r => ({
    steps: JSON.parse(r.content),
    goal: r.metadata.goal,
    outcome: r.metadata.outcome,
    similarity: calculateSimilarity(goal, r.metadata.goal)
  }));
}
```

### 6.3 思考プロセスと長期記憶の統合

**統合ポイント**：
- 思考プロセスからの知識抽出
- 長期記憶を活用した思考支援
- 思考パターンの長期的学習

**API設計**：
```javascript
// 思考プロセスからの知識抽出
async function extractKnowledgeFromThinking(thinkingData) {
  // 知識抽出ロジック
  const extractedKnowledge = analyzeThinkingForKnowledge(thinkingData);
  
  // 抽出した知識を長期記憶に保存
  const semanticMemory = new SemanticMemory();
  const results = [];
  
  for (const knowledge of extractedKnowledge) {
    const result = await semanticMemory.store({
      content: knowledge.content,
      type: 'semantic_memory',
      category: knowledge.category,
      confidence: knowledge.confidence,
      tags: ['extracted_knowledge', ...knowledge.tags],
      metadata: {
        source: 'system_learning',
        extraction_date: new Date().toISOString(),
        thinking_id: thinkingData.thinkingId
      }
    });
    results.push(result);
  }
  
  return results;
}

// 長期記憶を活用した思考支援
async function enhanceThinkingWithKnowledge(goal, context) {
  const semanticMemory = new SemanticMemory();
  const relevantKnowledge = await semanticMemory.semanticSearch(goal, {
    limit: 10,
    threshold: 0.7,
    categories: ['fact', 'rule', 'procedure']
  });
  
  return {
    goal,
    context,
    relevantKnowledge,
    suggestedApproaches: generateApproaches(goal, relevantKnowledge)
  };
}
```

## 7. 実装計画

### 7.1 フェーズ1: 基盤実装（3日間）
- 基本データモデルの実装
- 各階層のストレージ接続設定
- 共通インターフェースの定義

### 7.2 フェーズ2: 階層別実装（7日間）
- 短期記憶モジュール実装（2日）
- 中期記憶モジュール実装（2日）
- 長期記憶モジュール実装（3日）

### 7.3 フェーズ3: 記憶管理システム実装（4日間）
- 重要度評価アルゴリズム実装（1日）
- 強化・衰退メカニズム実装（1日）
- 統合・要約機能実装（2日）

### 7.4 フェーズ4: Sequential Thinking統合（6日間）
- 思考プロセスと短期記憶の統合（2日）
- 思考プロセスと中期記憶の統合（2日）
- 思考プロセスと長期記憶の統合（2日）

### 7.5 フェーズ5: テストと最適化（3日間）
- 単体テスト実装
- 統合テスト実装
- パフォーマンス最適化

## 8. 技術的考慮事項

### 8.1 スケーラビリティ
- 水平スケーリングを考慮した設計
- 分散キャッシュの活用
- 非同期処理の導入

### 8.2 パフォーマンス
- インデックス最適化
- キャッシュ戦略
- バッチ処理の活用

### 8.3 セキュリティ
- データ暗号化
- アクセス制御
- 監査ログ

### 8.4 テスト戦略
- 単体テスト
- 統合テスト
- パフォーマンステスト
- 負荷テスト

## 9. 今後の展望

- **自己最適化機能**: 使用パターンに基づく自動最適化
- **分散記憶システム**: マルチノード環境での分散記憶
- **マルチモーダル記憶**: テキスト以外のデータ（画像、音声など）の記憶対応
- **プライバシー強化**: 忘却権の実装、プライバシー設定の詳細化

## 10. 結論

多階層記憶システムは、HARCAの中核機能として、人間の記憶システムに倣った階層的なアプローチで情報を管理します。短期記憶、中期記憶、長期記憶の3つの階層を組み合わせることで、効率的かつ効果的な記憶管理を実現し、Sequential Thinking MCPとの統合により、思考プロセスと記憶を連携させた高度な機能を提供します。
