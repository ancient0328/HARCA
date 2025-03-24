---
title: "多階層記憶システム PostgreSQL統合設計 - トランザクション管理"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - トランザクション管理

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムのPostgreSQLトランザクション管理戦略について詳細に記述します。データの一貫性と整合性を確保するための、トランザクション境界、分離レベル、エラー処理、およびリトライ戦略について定義します。

## 2. トランザクション管理原則

### 2.1 基本原則

- **ACID特性の保証**: 原子性、一貫性、分離性、耐久性を確保
- **最小スコープ**: トランザクションの範囲を必要最小限に保つ
- **適切な分離レベル**: ユースケースに応じた分離レベルの選択
- **デッドロック回避**: リソースアクセス順序の一貫性維持
- **明示的なトランザクション境界**: 暗黙的なトランザクションの使用を避ける

### 2.2 トランザクション境界の定義

各操作のトランザクション境界を明確に定義し、複数の操作が単一のトランザクションとして実行される必要がある場合を特定します。

| 操作タイプ | トランザクション境界 | 理由 |
|----------|-------------------|------|
| 単一エンティティ読み取り | 不要 | 読み取り専用操作 |
| 単一エンティティ書き込み | 単一操作 | 単一の原子的操作 |
| 複数エンティティ更新 | 複数操作 | データ整合性の確保 |
| エンティティ関係更新 | 複数操作 | 参照整合性の確保 |
| バッチ処理 | カスタム | パフォーマンスと整合性のバランス |

## 3. トランザクション実装戦略

### 3.1 Node.jsでのトランザクション実装

#### 3.1.1 pg-promiseを使用したトランザクション

```javascript
const pgp = require('pg-promise')();
const db = pgp('postgres://username:password@localhost:3730/harca_memory');

// 単一トランザクションでの複数操作
async function createEpisodeWithEvents(episodeData, events) {
  return db.tx(async t => {
    // エピソード作成
    const episode = await t.one(
      'INSERT INTO mid_term.episodes(type, title, description, start_time, importance, metadata) ' +
      'VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
      [episodeData.type, episodeData.title, episodeData.description, 
       episodeData.startTime, episodeData.importance, episodeData.metadata]
    );
    
    // イベント作成
    if (events && events.length > 0) {
      const eventQueries = events.map(event => {
        return t.none(
          'INSERT INTO mid_term.episode_events(episode_id, type, content, event_time, importance, metadata) ' +
          'VALUES($1, $2, $3, $4, $5, $6)',
          [episode.id, event.type, event.content, event.eventTime, 
           event.importance, event.metadata]
        );
      });
      
      await t.batch(eventQueries);
    }
    
    return episode.id;
  });
}
```

#### 3.1.2 Prismaを使用したトランザクション

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 単一トランザクションでの複数操作
async function createKnowledgeItemWithRelationships(itemData, relationships) {
  return prisma.$transaction(async (tx) => {
    // 知識アイテム作成
    const knowledgeItem = await tx.knowledgeItem.create({
      data: {
        type: itemData.type,
        name: itemData.name,
        content: itemData.content,
        confidence: itemData.confidence,
        importance: itemData.importance,
        source: itemData.source,
        isVerified: itemData.isVerified,
        metadata: itemData.metadata
      }
    });
    
    // 関係性作成
    if (relationships && relationships.length > 0) {
      for (const rel of relationships) {
        await tx.knowledgeRelationship.create({
          data: {
            sourceId: knowledgeItem.id,
            targetId: rel.targetId,
            relationshipType: rel.type,
            strength: rel.strength,
            metadata: rel.metadata
          }
        });
      }
    }
    
    return knowledgeItem.id;
  });
}
```

### 3.2 トランザクション分離レベル

PostgreSQLでサポートされている分離レベルと、HARCA多階層記憶システムでの使用ケース：

| 分離レベル | 説明 | 使用ケース |
|-----------|------|----------|
| READ UNCOMMITTED | 未コミットデータの読み取りを許可（PostgreSQLでは実質的にREAD COMMITTEDと同等） | 使用しない |
| READ COMMITTED | コミット済みデータのみ読み取り可能（デフォルト） | 一般的な読み取り操作 |
| REPEATABLE READ | トランザクション内で同じクエリは同じ結果を返す | レポート生成、一貫性の高い読み取り |
| SERIALIZABLE | 完全な分離、直列化可能なトランザクション | 重要な財務操作、整合性が極めて重要な場合 |

#### 3.2.1 操作別の推奨分離レベル

| 操作タイプ | 推奨分離レベル | 理由 |
|-----------|--------------|------|
| 単一エンティティ読み取り | READ COMMITTED | デフォルト、十分な一貫性 |
| 複数エンティティ読み取り | REPEATABLE READ | 読み取り一貫性の確保 |
| レポート生成 | REPEATABLE READ | 一貫したスナップショット |
| エンティティ作成/更新 | READ COMMITTED | 標準的な書き込み操作 |
| 重要なデータ更新 | SERIALIZABLE | 最高レベルの整合性 |

#### 3.2.2 分離レベル設定例

```javascript
// pg-promiseでの分離レベル設定
db.tx({isolation: pgp.txMode.isolation.serializable}, async t => {
  // 重要なトランザクション操作
});

// Prismaでの分離レベル設定
await prisma.$transaction(async (tx) => {
  // トランザクション操作
}, {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable
});
```

## 4. エラー処理とリトライ戦略

### 4.1 トランザクションエラータイプ

| エラータイプ | 説明 | 処理戦略 |
|------------|------|---------|
| 接続エラー | データベース接続の問題 | リトライ（指数バックオフ） |
| デッドロック | リソースの競合によるデッドロック | リトライ（即時または短い遅延） |
| 一意性制約違反 | 一意キーの重複 | アプリケーションロジックで処理 |
| 外部キー制約違反 | 参照整合性の問題 | アプリケーションロジックで処理 |
| クエリタイムアウト | 長時間実行クエリのタイムアウト | クエリ最適化、リトライ（条件付き） |
| サーバーエラー | データベースサーバーの問題 | リトライ（指数バックオフ） |

### 4.2 リトライ実装

#### 4.2.1 基本的なリトライロジック

```javascript
async function executeWithRetry(operation, maxRetries = 3, initialDelay = 100) {
  let retries = 0;
  
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (retries >= maxRetries || !isRetryableError(error)) {
        throw error;
      }
      
      const delay = initialDelay * Math.pow(2, retries);
      console.log(`Retrying operation after ${delay}ms (attempt ${retries + 1}/${maxRetries})`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
}

function isRetryableError(error) {
  // PostgreSQLエラーコードに基づいてリトライ可能かどうかを判断
  const retryableCodes = [
    '40001', // シリアル化失敗
    '40P01', // デッドロック検出
    '57P01', // 管理者によるシャットダウン
    '57P02', // クラッシュによるシャットダウン
    '57P03', // 接続不能
    '08006', // 接続障害
    '08001', // 接続拒否
    '08004', // 接続拒否
    'XX000'  // 内部エラー
  ];
  
  return error.code && retryableCodes.includes(error.code);
}
```

#### 4.2.2 トランザクション操作でのリトライ適用

```javascript
async function createEpisodeWithEventsRetry(episodeData, events) {
  return executeWithRetry(() => createEpisodeWithEvents(episodeData, events));
}
```

## 5. トランザクションパターン

### 5.1 単一エンティティ操作

単一のエンティティに対する操作は、通常、暗黙的なトランザクションで十分です。

```javascript
async function updateUserProfile(userId, profileData) {
  return db.none(
    'UPDATE mid_term.users SET username = $1, email = $2, metadata = $3, updated_at = NOW() ' +
    'WHERE id = $4',
    [profileData.username, profileData.email, profileData.metadata, userId]
  );
}
```

### 5.2 親子エンティティ操作

親エンティティとその子エンティティを同時に操作する場合、明示的なトランザクションが必要です。

```javascript
async function createRuleWithDependencies(ruleData, dependencies) {
  return db.tx(async t => {
    // ルール作成
    const rule = await t.one(
      'INSERT INTO long_term.rules(name, description, condition_expression, action_expression, priority, is_active, metadata) ' +
      'VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [ruleData.name, ruleData.description, ruleData.conditionExpression, 
       ruleData.actionExpression, ruleData.priority, ruleData.isActive, ruleData.metadata]
    );
    
    // 依存関係作成
    if (dependencies && dependencies.length > 0) {
      const dependencyQueries = dependencies.map(dep => {
        return t.none(
          'INSERT INTO long_term.rule_dependencies(source_rule_id, target_rule_id, dependency_type, metadata) ' +
          'VALUES($1, $2, $3, $4)',
          [rule.id, dep.targetRuleId, dep.dependencyType, dep.metadata]
        );
      });
      
      await t.batch(dependencyQueries);
    }
    
    return rule.id;
  });
}
```

### 5.3 複雑なエンティティグラフ操作

複数の関連エンティティを含む複雑なグラフ操作には、明示的なトランザクションと慎重な順序付けが必要です。

```javascript
async function createKnowledgeGraph(rootItem, relatedItems, relationships) {
  return db.tx(async t => {
    // ルートアイテム作成
    const root = await t.one(
      'INSERT INTO long_term.knowledge_items(type, name, content, confidence, importance, source, metadata) ' +
      'VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [rootItem.type, rootItem.name, rootItem.content, rootItem.confidence, 
       rootItem.importance, rootItem.source, rootItem.metadata]
    );
    
    // 関連アイテム作成
    const itemIds = {[rootItem.tempId]: root.id};
    
    for (const item of relatedItems) {
      const result = await t.one(
        'INSERT INTO long_term.knowledge_items(type, name, content, confidence, importance, source, metadata) ' +
        'VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [item.type, item.name, item.content, item.confidence, 
         item.importance, item.source, item.metadata]
      );
      
      itemIds[item.tempId] = result.id;
    }
    
    // 関係性作成
    for (const rel of relationships) {
      const sourceId = itemIds[rel.sourceTempId];
      const targetId = itemIds[rel.targetTempId];
      
      if (!sourceId || !targetId) {
        throw new Error(`Invalid relationship reference: ${rel.sourceTempId} -> ${rel.targetTempId}`);
      }
      
      await t.none(
        'INSERT INTO long_term.knowledge_relationships(source_id, target_id, relationship_type, strength, metadata) ' +
        'VALUES($1, $2, $3, $4, $5)',
        [sourceId, targetId, rel.type, rel.strength, rel.metadata]
      );
    }
    
    return {
      rootId: root.id,
      itemIds
    };
  });
}
```

### 5.4 バッチ処理

大量のデータを処理する場合、バッチ処理とチャンク処理を組み合わせたトランザクション戦略が効果的です。

```javascript
async function batchImportKnowledgeItems(items, batchSize = 100) {
  const results = [];
  
  // チャンクに分割
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    
    // チャンク単位でトランザクション実行
    const chunkResults = await db.tx(async t => {
      const insertQueries = chunk.map(item => {
        return t.one(
          'INSERT INTO long_term.knowledge_items(type, name, content, confidence, importance, source, metadata) ' +
          'VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          [item.type, item.name, item.content, item.confidence, 
           item.importance, item.source, item.metadata]
        );
      });
      
      return t.batch(insertQueries);
    });
    
    results.push(...chunkResults);
  }
  
  return results;
}
```

## 6. 特殊なトランザクションパターン

### 6.1 長時間実行トランザクション

長時間実行される操作は、単一の大きなトランザクションではなく、複数の小さなトランザクションに分割します。

```javascript
async function processLargeDataset(datasetId, processor) {
  // 処理状態の初期化
  await db.none(
    'INSERT INTO system.processing_jobs(dataset_id, status, progress, started_at) ' +
    'VALUES($1, $2, $3, NOW())',
    [datasetId, 'running', 0]
  );
  
  try {
    // データセットの総アイテム数を取得
    const { total } = await db.one(
      'SELECT COUNT(*) AS total FROM datasets WHERE id = $1',
      [datasetId]
    );
    
    const batchSize = 100;
    let processed = 0;
    
    // バッチ処理
    while (processed < total) {
      // 単一バッチをトランザクションとして処理
      await db.tx(async t => {
        const items = await t.any(
          'SELECT * FROM datasets WHERE id = $1 LIMIT $2 OFFSET $3',
          [datasetId, batchSize, processed]
        );
        
        for (const item of items) {
          await processor(item, t);
        }
        
        processed += items.length;
        
        // 進捗更新（トランザクション外で実行）
        await db.none(
          'UPDATE system.processing_jobs SET progress = $1, updated_at = NOW() ' +
          'WHERE dataset_id = $2',
          [Math.floor((processed / total) * 100), datasetId]
        );
      });
    }
    
    // 処理完了を記録
    await db.none(
      'UPDATE system.processing_jobs SET status = $1, progress = 100, completed_at = NOW() ' +
      'WHERE dataset_id = $2',
      ['completed', datasetId]
    );
    
    return { success: true, processed };
  } catch (error) {
    // エラー状態を記録
    await db.none(
      'UPDATE system.processing_jobs SET status = $1, error_message = $2, updated_at = NOW() ' +
      'WHERE dataset_id = $3',
      ['failed', error.message, datasetId]
    );
    
    throw error;
  }
}
```

### 6.2 分散トランザクション

複数のデータストア（PostgreSQLとRedis）にまたがる操作は、2相コミットの代わりに補償トランザクションパターンを使用します。

```javascript
async function transferMemoryFromShortToMidTerm(memoryId) {
  // 1. 短期記憶からデータ取得
  const shortTermData = await redisClient.hgetall(`harca:memory:short:item:${memoryId}`);
  
  if (!shortTermData || Object.keys(shortTermData).length === 0) {
    throw new Error(`Memory item ${memoryId} not found in short-term memory`);
  }
  
  try {
    // 2. 中期記憶にデータ保存
    const episodeId = await db.one(
      'INSERT INTO mid_term.episodes(type, title, description, start_time, importance, metadata) ' +
      'VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
      [shortTermData.type, shortTermData.content.title, shortTermData.content.description, 
       new Date(parseInt(shortTermData.createdAt)), parseInt(shortTermData.priority), 
       JSON.stringify(shortTermData.metadata)]
    );
    
    // 3. 短期記憶のデータを削除
    await redisClient.del(`harca:memory:short:item:${memoryId}`);
    
    // 4. インデックスからも削除
    await redisClient.srem(`harca:memory:short:idx:type:${shortTermData.type}`, memoryId);
    await redisClient.srem(`harca:memory:short:idx:context:${shortTermData.contextId}`, memoryId);
    await redisClient.zrem(`harca:memory:short:idx:priority:${shortTermData.priority}`, memoryId);
    await redisClient.zrem('harca:memory:short:idx:expiry', memoryId);
    
    return {
      success: true,
      sourceId: memoryId,
      targetId: episodeId
    };
  } catch (error) {
    // エラー発生時は短期記憶のデータを保持（削除しない）
    console.error('Failed to transfer memory to mid-term storage:', error);
    
    // エラーログ記録
    await db.none(
      'INSERT INTO system.logs(level, message, context, component) ' +
      'VALUES($1, $2, $3, $4)',
      ['error', 'Memory transfer failed', JSON.stringify({
        memoryId,
        error: error.message
      }), 'memory-transfer']
    );
    
    throw error;
  }
}
```

## 7. トランザクションモニタリングと最適化

### 7.1 トランザクションモニタリング

```javascript
// トランザクション実行時間の測定
async function monitorTransaction(operation, name) {
  const startTime = process.hrtime();
  
  try {
    const result = await operation();
    
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1000000;
    
    // メトリクス記録
    await db.none(
      'INSERT INTO system.metrics(metric_name, metric_value, dimensions) ' +
      'VALUES($1, $2, $3)',
      [`transaction.duration.${name}`, duration, JSON.stringify({
        operation: name,
        success: true
      })]
    );
    
    return result;
  } catch (error) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1000000;
    
    // エラーメトリクス記録
    await db.none(
      'INSERT INTO system.metrics(metric_name, metric_value, dimensions) ' +
      'VALUES($1, $2, $3)',
      [`transaction.duration.${name}`, duration, JSON.stringify({
        operation: name,
        success: false,
        errorCode: error.code,
        errorMessage: error.message
      })]
    );
    
    throw error;
  }
}

// 使用例
async function createEpisodeWithMonitoring(episodeData, events) {
  return monitorTransaction(
    () => createEpisodeWithEvents(episodeData, events),
    'createEpisodeWithEvents'
  );
}
```

### 7.2 トランザクション最適化

#### 7.2.1 トランザクション分析クエリ

```sql
-- 長時間実行トランザクションの特定
SELECT pid, 
       now() - xact_start AS duration, 
       query 
FROM pg_stat_activity 
WHERE state = 'active' 
  AND xact_start IS NOT NULL 
ORDER BY duration DESC 
LIMIT 10;

-- ブロックされているトランザクションの特定
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

#### 7.2.2 トランザクション最適化戦略

- **トランザクション時間の短縮**: 長時間実行トランザクションを複数の小さなトランザクションに分割
- **コネクションプール最適化**: 適切なプールサイズとタイムアウト設定
- **クエリ最適化**: インデックス活用、クエリプラン分析
- **バッチ処理**: 複数の操作をバッチ処理してネットワークラウンドトリップを削減
- **分離レベル調整**: 必要最小限の分離レベルを使用

## 8. 結論

本ドキュメントでは、HARCA多階層記憶システムのPostgreSQLトランザクション管理戦略について詳細に記述しました。適切なトランザクション境界、分離レベル、エラー処理、リトライ戦略を定義し、さまざまなトランザクションパターンを提示しました。これらの戦略を適用することで、データの一貫性と整合性を確保しつつ、効率的なデータベース操作を実現できます。
