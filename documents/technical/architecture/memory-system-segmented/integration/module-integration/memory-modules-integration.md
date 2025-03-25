---
title: "多階層記憶システム モジュール間連携設計"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム モジュール間連携設計

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、多階層記憶システムにおける短期記憶（作業記憶）、中期記憶（エピソード記憶）、長期記憶（知識ベース）の各モジュール間の連携設計について詳細に記述します。これらのモジュールが効果的に連携することで、情報の適切な保存、検索、活用が可能になります。

## 2. モジュール間連携の基本原則

### 2.1 情報の流れ

多階層記憶システムにおける情報の基本的な流れは以下の通りです：

1. **入力段階**: 新しい情報は通常、短期記憶（作業記憶）に最初に保存されます。
2. **処理段階**: 情報は重要度や関連性に基づいて処理され、必要に応じて中期記憶や長期記憶に移行します。
3. **検索段階**: 情報の検索時には、まず短期記憶、次に中期記憶、最後に長期記憶の順で検索が行われます。
4. **統合段階**: 複数の記憶層から取得された情報は統合され、コンテキストに応じた形で提供されます。

### 2.2 連携の原則

1. **一貫性の維持**: 異なる記憶層間で情報の一貫性を維持します。
2. **効率的な情報移行**: 重要度や頻度に基づいて、効率的に情報を適切な記憶層に移行します。
3. **コンテキスト保持**: 情報が移行する際にもコンテキストを保持し、関連性を維持します。
4. **冗長性の最小化**: 異なる記憶層間での不必要な重複を避けます。
5. **適応的な管理**: 使用パターンに基づいて記憶管理を適応的に調整します。

## 3. 記憶層間の情報移行

### 3.1 短期記憶から中期記憶への移行

#### 3.1.1 移行条件

以下の条件に基づいて、短期記憶から中期記憶への情報移行を行います：

1. **重要度**: 重要度スコアが閾値（デフォルト: 0.7）を超える情報
2. **アクセス頻度**: 短期間に複数回アクセスされた情報
3. **明示的なマーキング**: システムまたはユーザーによって明示的に「保存」とマークされた情報
4. **関連性**: 現在のタスクやコンテキストに高い関連性を持つ情報

#### 3.1.2 移行プロセス

```javascript
/**
 * 短期記憶から中期記憶への情報移行プロセス
 */
async function promoteToMidTermMemory(memoryId, options = {}) {
  // 短期記憶から情報を取得
  const memoryItem = await workingMemory.get(memoryId);
  if (!memoryItem) return null;
  
  // 移行条件の評価
  const shouldPromote = evaluatePromotionCriteria(memoryItem, options);
  if (!shouldPromote) return null;
  
  // 中期記憶用のデータ構造に変換
  const episodicMemoryData = convertToEpisodicMemory(memoryItem);
  
  // 中期記憶に保存
  const episodicMemoryId = await episodicMemory.store(episodicMemoryData);
  
  // 関連付け情報の更新
  await updateMemoryRelations(memoryId, episodicMemoryId, 'promoted_to_mid_term');
  
  // 短期記憶の情報を更新（オプションで削除も可能）
  if (options.removeFromShortTerm) {
    await workingMemory.delete(memoryId);
  } else {
    await workingMemory.update(memoryId, { 
      metadata: { 
        ...memoryItem.metadata,
        promotedToMidTerm: true,
        midTermMemoryId: episodicMemoryId
      }
    });
  }
  
  return episodicMemoryId;
}
```

### 3.2 中期記憶から長期記憶への移行

#### 3.2.1 移行条件

以下の条件に基づいて、中期記憶から長期記憶への情報移行を行います：

1. **重要度**: 非常に高い重要度（デフォルト: 0.9以上）を持つ情報
2. **持続的なアクセス**: 長期間にわたって定期的にアクセスされる情報
3. **一般化可能性**: 特定のセッションやコンテキストを超えて一般化可能な情報
4. **パターン認識**: 繰り返し出現するパターンや規則性を持つ情報

#### 3.2.2 移行プロセス

```javascript
/**
 * 中期記憶から長期記憶への情報移行プロセス
 */
async function promoteToLongTermMemory(episodicMemoryId, options = {}) {
  // 中期記憶から情報を取得
  const episodicMemoryItem = await episodicMemory.get(episodicMemoryId);
  if (!episodicMemoryItem) return null;
  
  // 移行条件の評価
  const shouldPromote = evaluateLongTermPromotionCriteria(episodicMemoryItem, options);
  if (!shouldPromote) return null;
  
  // 長期記憶用のデータ構造に変換（一般化、抽象化を含む）
  const knowledgeItemData = convertToKnowledgeItem(episodicMemoryItem);
  
  // 埋め込みベクトルの生成
  knowledgeItemData.embedding = await knowledgeBase.generateEmbedding(knowledgeItemData.content);
  
  // 長期記憶に保存
  const knowledgeItemId = await knowledgeBase.store(knowledgeItemData);
  
  // 関連付け情報の更新
  await updateMemoryRelations(episodicMemoryId, knowledgeItemId, 'promoted_to_long_term');
  
  // 中期記憶の情報を更新
  await episodicMemory.update(episodicMemoryId, { 
    metadata: { 
      ...episodicMemoryItem.metadata,
      promotedToLongTerm: true,
      longTermMemoryId: knowledgeItemId
    }
  });
  
  return knowledgeItemId;
}
```

### 3.3 長期記憶から作業記憶への活性化

#### 3.3.1 活性化条件

以下の条件に基づいて、長期記憶の情報を作業記憶に活性化します：

1. **クエリ関連性**: 現在のクエリやタスクに高い関連性を持つ情報
2. **コンテキスト一致**: 現在のコンテキストに関連する情報
3. **予測的活性化**: 予測されるニーズに基づいて先行的に活性化される情報

#### 3.3.2 活性化プロセス

```javascript
/**
 * 長期記憶から作業記憶への情報活性化プロセス
 */
async function activateToWorkingMemory(query, context, options = {}) {
  // 長期記憶から関連情報を検索
  const relevantKnowledgeItems = await knowledgeBase.searchByText(query, {
    threshold: options.threshold || 0.7,
    limit: options.limit || 5,
    contextFilter: context
  });
  
  if (relevantKnowledgeItems.length === 0) return [];
  
  // 作業記憶に活性化
  const activatedMemoryIds = [];
  for (const item of relevantKnowledgeItems) {
    // 作業記憶用のデータ構造に変換
    const workingMemoryData = convertToWorkingMemory(item, context);
    
    // 作業記憶に保存
    const workingMemoryId = await workingMemory.store(workingMemoryData);
    
    // 関連付け情報の更新
    await updateMemoryRelations(item.id, workingMemoryId, 'activated_to_working_memory');
    
    activatedMemoryIds.push(workingMemoryId);
  }
  
  return activatedMemoryIds;
}
```

## 4. 記憶検索と統合

### 4.1 階層的検索プロセス

多階層記憶システムでの検索は、効率と関連性のバランスを取るために階層的に行われます：

```javascript
/**
 * 階層的記憶検索プロセス
 */
async function hierarchicalSearch(query, context, options = {}) {
  const results = {
    shortTerm: [],
    midTerm: [],
    longTerm: []
  };
  
  // 1. 短期記憶の検索
  results.shortTerm = await workingMemory.searchByText(query, {
    contextId: context.id,
    limit: options.shortTermLimit || 10
  });
  
  // 短期記憶で十分な結果が得られた場合は終了
  if (results.shortTerm.length >= options.sufficientResultCount || 5) {
    return integrateResults(results, context);
  }
  
  // 2. 中期記憶の検索
  results.midTerm = await episodicMemory.searchByText(query, {
    userId: context.userId,
    sessionId: context.sessionId,
    limit: options.midTermLimit || 10
  });
  
  // 短期+中期で十分な結果が得られた場合は終了
  if (results.shortTerm.length + results.midTerm.length >= options.sufficientResultCount || 10) {
    return integrateResults(results, context);
  }
  
  // 3. 長期記憶の検索
  results.longTerm = await knowledgeBase.searchByText(query, {
    threshold: options.threshold || 0.7,
    limit: options.longTermLimit || 10
  });
  
  // 結果の統合と返却
  return integrateResults(results, context);
}
```

### 4.2 結果統合プロセス

異なる記憶層から取得した結果を統合し、一貫性のある形で提供します：

```javascript
/**
 * 検索結果統合プロセス
 */
function integrateResults(results, context) {
  // 結果の重複排除
  const uniqueResults = deduplicateResults(results);
  
  // 結果のランキング（重要度、関連性、鮮度などに基づく）
  const rankedResults = rankResults(uniqueResults, context);
  
  // 結果のグループ化（トピックやカテゴリに基づく）
  const groupedResults = groupResults(rankedResults);
  
  // コンテキストに基づく結果の強調
  const highlightedResults = highlightContextualResults(groupedResults, context);
  
  return {
    integrated: highlightedResults,
    raw: results,
    stats: {
      shortTermCount: results.shortTerm.length,
      midTermCount: results.midTerm.length,
      longTermCount: results.longTerm.length,
      totalUniqueCount: uniqueResults.length
    }
  };
}
```

## 5. 記憶の強化と忘却

### 5.1 記憶強化メカニズム

記憶の強化は、アクセス頻度や重要度に基づいて行われます：

```javascript
/**
 * 記憶強化プロセス
 */
async function reinforceMemory(memoryId, memoryType, reinforcementFactor = 0.1) {
  let memory;
  let updateResult;
  
  // メモリタイプに応じた取得と更新
  switch (memoryType) {
    case 'short_term':
      memory = await workingMemory.get(memoryId);
      if (!memory) return false;
      
      // 重要度の増加（上限1.0）
      const newImportance = Math.min(1.0, memory.metadata.importance + reinforcementFactor);
      
      // TTLの延長
      const extendedTTL = memory.metadata.ttl * 1.5;
      
      updateResult = await workingMemory.update(memoryId, {
        metadata: {
          ...memory.metadata,
          importance: newImportance,
          lastAccessed: new Date().toISOString(),
          accessCount: (memory.metadata.accessCount || 0) + 1
        }
      });
      
      await workingMemory.extendExpiration(memoryId, extendedTTL);
      break;
      
    case 'mid_term':
      // 中期記憶の強化ロジック
      memory = await episodicMemory.get(memoryId);
      if (!memory) return false;
      
      updateResult = await episodicMemory.update(memoryId, {
        metadata: {
          ...memory.metadata,
          importance: Math.min(1.0, memory.metadata.importance + reinforcementFactor)
        },
        accessCount: (memory.accessCount || 0) + 1,
        lastAccessed: new Date().toISOString()
      });
      break;
      
    case 'long_term':
      // 長期記憶の強化ロジック
      memory = await knowledgeBase.get(memoryId);
      if (!memory) return false;
      
      updateResult = await knowledgeBase.update(memoryId, {
        metadata: {
          ...memory.metadata,
          importance: Math.min(1.0, memory.metadata.importance + reinforcementFactor)
        },
        accessCount: (memory.accessCount || 0) + 1,
        lastAccessed: new Date().toISOString()
      });
      break;
      
    default:
      return false;
  }
  
  return !!updateResult;
}
```

### 5.2 記憶忘却メカニズム

システムのパフォーマンスと関連性を維持するために、不要な記憶を忘却するメカニズムを実装します：

```javascript
/**
 * 記憶忘却プロセス
 */
async function forgetMemory(options = {}) {
  // 短期記憶の忘却（TTLベース + 明示的なクリーンアップ）
  const shortTermResults = await forgetShortTermMemories({
    olderThan: options.shortTermOlderThan || '2h',
    importanceThreshold: options.shortTermImportanceThreshold || 0.3,
    exceptContextId: options.currentContextId
  });
  
  // 中期記憶の忘却（低重要度 + 長期間アクセスなし）
  const midTermResults = await forgetMidTermMemories({
    olderThan: options.midTermOlderThan || '30d',
    importanceThreshold: options.midTermImportanceThreshold || 0.2,
    notAccessedSince: options.midTermNotAccessedSince || '15d',
    userId: options.userId
  });
  
  // 長期記憶の忘却（非常に低い重要度 + 非常に長期間アクセスなし）
  const longTermResults = await forgetLongTermMemories({
    importanceThreshold: options.longTermImportanceThreshold || 0.1,
    notAccessedSince: options.longTermNotAccessedSince || '180d'
  });
  
  return {
    shortTerm: shortTermResults,
    midTerm: midTermResults,
    longTerm: longTermResults,
    total: shortTermResults.count + midTermResults.count + longTermResults.count
  };
}
```

## 6. 一貫性維持メカニズム

### 6.1 記憶間の関連付け

異なる記憶層間の関連性を維持するために、明示的な関連付けを管理します：

```javascript
/**
 * 記憶間の関連付け管理
 */
async function updateMemoryRelations(sourceId, targetId, relationType, options = {}) {
  // 関連付け情報の保存
  await memoryRelationStore.createRelation({
    sourceId,
    targetId,
    type: relationType,
    strength: options.strength || 1.0,
    metadata: options.metadata || {},
    created: new Date().toISOString()
  });
  
  // 関連メモリの相互参照更新
  await updateCrossReferences(sourceId, targetId, relationType);
}

/**
 * 関連メモリの相互参照更新
 */
async function updateCrossReferences(sourceId, targetId, relationType) {
  // ソースメモリの更新
  await updateMemoryReferences(sourceId, targetId, 'outgoing', relationType);
  
  // ターゲットメモリの更新
  await updateMemoryReferences(targetId, sourceId, 'incoming', relationType);
}
```

### 6.2 更新伝播メカニズム

一つの記憶層での更新が関連する他の記憶層にも伝播するメカニズムを実装します：

```javascript
/**
 * 記憶更新の伝播
 */
async function propagateMemoryUpdate(memoryId, memoryType, updateData) {
  // 更新対象のメモリを取得
  const memory = await getMemoryByTypeAndId(memoryType, memoryId);
  if (!memory) return false;
  
  // 関連するメモリIDを取得
  const relatedMemories = await getRelatedMemories(memoryId);
  
  // 更新データの準備
  const propagationData = preparePropagationData(updateData, memoryType);
  
  // 関連メモリの更新
  for (const related of relatedMemories) {
    await updateRelatedMemory(related.id, related.type, propagationData, related.relationType);
  }
  
  return true;
}
```

## 7. 実装計画

### 7.1 実装ステップ

1. **基本連携インターフェースの実装**
   - 記憶層間の情報移行メソッド
   - 階層的検索メソッド
   - 結果統合メソッド

2. **記憶強化・忘却メカニズムの実装**
   - 重要度ベースの強化ロジック
   - TTLと重要度ベースの忘却ロジック

3. **一貫性維持メカニズムの実装**
   - 関連付け管理
   - 更新伝播メカニズム

4. **最適化とスケーラビリティ対応**
   - バッチ処理の実装
   - 非同期処理の最適化

### 7.2 テスト計画

1. **単体テスト**
   - 各連携メソッドのテスト
   - エッジケースの検証

2. **統合テスト**
   - 複数記憶層間の連携テスト
   - 情報の流れの検証

3. **パフォーマンステスト**
   - 大規模データでの連携効率テスト
   - メモリ使用量とレイテンシテスト

## 8. 結論

多階層記憶システムのモジュール間連携設計により、短期記憶、中期記憶、長期記憶の各モジュールが効果的に連携し、情報の適切な保存、検索、活用が可能になります。情報の移行、検索、統合、強化、忘却の各プロセスを適切に設計・実装することで、HARCAプロジェクトの記憶システム全体の機能を強化します。
