---
title: "多階層記憶システム データモデル - 短期記憶"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム データモデル - 短期記憶

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムの短期記憶（Short-Term Memory）コンポーネントのデータモデルについて詳細に記述します。短期記憶は、システムの作業記憶（Working Memory）として機能し、現在のタスクや会話に関連する一時的な情報を保持します。

## 2. 短期記憶の基本構造

短期記憶は以下の主要コンポーネントで構成されます：

1. **作業記憶（Working Memory）**: 現在処理中のタスクや会話に関する一時的な情報を保持
2. **コンテキストマネージャー（Context Manager）**: 現在のコンテキスト（会話やタスクの文脈）を管理

## 3. データモデル詳細

### 3.1 作業記憶（Working Memory）

#### 3.1.1 WorkingMemoryItem スキーマ

```javascript
{
  id: String,                 // 一意のID (UUID v4)
  content: Object,            // 記憶内容（任意の形式）
  type: String,               // 記憶タイプ（会話、タスク、計算結果など）
  createdAt: Timestamp,       // 作成時刻
  expiresAt: Timestamp,       // 有効期限
  priority: Number,           // 優先度（1-10）
  contextId: String,          // 関連コンテキストID
  metadata: {                 // メタデータ
    source: String,           // 情報ソース
    confidence: Number,       // 信頼度（0.0-1.0）
    tags: Array<String>,      // タグリスト
    accessCount: Number,      // アクセス回数
    lastAccessedAt: Timestamp // 最終アクセス時刻
  }
}
```

#### 3.1.2 WorkingMemoryItem タイプ

| タイプ | 説明 | 内容形式 |
|--------|------|----------|
| `conversation` | 会話ターン | `{ role: String, content: String, timestamp: Timestamp }` |
| `task` | タスク情報 | `{ name: String, status: String, progress: Number, data: Object }` |
| `calculation` | 計算結果 | `{ input: Object, output: Object, method: String }` |
| `user_intent` | ユーザー意図 | `{ intent: String, confidence: Number, entities: Array<Object> }` |
| `system_state` | システム状態 | `{ component: String, state: Object, timestamp: Timestamp }` |
| `temporary_data` | 一時データ | 任意の形式 |

#### 3.1.3 Redis実装スキーマ

**キー構造**:
- 作業記憶アイテム: `harca:stm:wm:item:{id}`
- 作業記憶インデックス: `harca:stm:wm:index:{indexType}:{value}`
- 作業記憶カウンター: `harca:stm:wm:counter:{counterType}`

**ハッシュフィールド**:
```
harca:stm:wm:item:{id} = {
  content: JSON.stringify(content),
  type: String,
  createdAt: ISO8601 String,
  expiresAt: ISO8601 String,
  priority: Number,
  contextId: String,
  metadata: JSON.stringify(metadata)
}
```

**インデックス**:
- タイプ別: `harca:stm:wm:index:type:{type} = Set<id>`
- コンテキスト別: `harca:stm:wm:index:context:{contextId} = Set<id>`
- タグ別: `harca:stm:wm:index:tag:{tag} = Set<id>`
- 優先度別: `harca:stm:wm:index:priority:{priority} = Set<id>`

### 3.2 コンテキストマネージャー（Context Manager）

#### 3.2.1 Context スキーマ

```javascript
{
  id: String,                 // コンテキストID (UUID v4)
  name: String,               // コンテキスト名
  type: String,               // コンテキストタイプ（会話、タスク、セッションなど）
  createdAt: Timestamp,       // 作成時刻
  updatedAt: Timestamp,       // 最終更新時刻
  expiresAt: Timestamp,       // 有効期限
  parentContextId: String,    // 親コンテキストID（オプション）
  relatedContextIds: Array<String>, // 関連コンテキストIDリスト
  metadata: {                 // メタデータ
    status: String,           // 状態（アクティブ、一時停止、完了など）
    priority: Number,         // 優先度（1-10）
    tags: Array<String>,      // タグリスト
    source: String,           // コンテキスト作成ソース
    description: String       // コンテキスト説明
  }
}
```

#### 3.2.2 Context タイプ

| タイプ | 説明 | 特性 |
|--------|------|------|
| `conversation` | 会話コンテキスト | 会話履歴、参加者、トピックを追跡 |
| `task` | タスクコンテキスト | タスク状態、進捗、依存関係を追跡 |
| `session` | セッションコンテキスト | ユーザーセッション情報を追跡 |
| `project` | プロジェクトコンテキスト | 複数のタスクや会話を含む大きなコンテキスト |
| `query` | クエリコンテキスト | 検索や問い合わせに関するコンテキスト |

#### 3.2.3 Redis実装スキーマ

**キー構造**:
- コンテキスト: `harca:stm:ctx:{id}`
- アクティブコンテキスト: `harca:stm:ctx:active:{userId}`
- コンテキストインデックス: `harca:stm:ctx:index:{indexType}:{value}`
- コンテキスト階層: `harca:stm:ctx:hierarchy:{parentId}`

**ハッシュフィールド**:
```
harca:stm:ctx:{id} = {
  name: String,
  type: String,
  createdAt: ISO8601 String,
  updatedAt: ISO8601 String,
  expiresAt: ISO8601 String,
  parentContextId: String,
  relatedContextIds: JSON.stringify(Array<String>),
  metadata: JSON.stringify(metadata)
}
```

**インデックス**:
- タイプ別: `harca:stm:ctx:index:type:{type} = Set<id>`
- タグ別: `harca:stm:ctx:index:tag:{tag} = Set<id>`
- 状態別: `harca:stm:ctx:index:status:{status} = Set<id>`
- ユーザー別: `harca:stm:ctx:index:user:{userId} = Set<id>`

## 4. データ操作

### 4.1 作業記憶操作

#### 4.1.1 基本操作

| 操作 | 説明 | Redis コマンド |
|------|------|---------------|
| 作成 | 新しい作業記憶アイテムを作成 | `HSET`, `SADD`, `EXPIRE` |
| 取得 | IDによる作業記憶アイテムの取得 | `HGETALL` |
| 更新 | 既存の作業記憶アイテムを更新 | `HSET` |
| 削除 | 作業記憶アイテムを削除 | `DEL`, `SREM` |
| 検索 | 条件に基づく作業記憶アイテムの検索 | `SINTER`, `SUNION`, `FT.SEARCH` |

#### 4.1.2 高度な操作

| 操作 | 説明 | 実装方法 |
|------|------|----------|
| バッチ取得 | 複数の作業記憶アイテムを一度に取得 | `HGETALL` with Lua script |
| 有効期限更新 | 作業記憶アイテムの有効期限を更新 | `EXPIRE` |
| 優先度更新 | 作業記憶アイテムの優先度を更新 | `HSET`, `SREM`, `SADD` |
| アクセス追跡 | 作業記憶アイテムのアクセスを追跡 | `HINCRBY`, `HSET` |
| 中期記憶への昇格 | 重要な作業記憶アイテムを中期記憶に昇格 | Custom logic |

### 4.2 コンテキスト操作

#### 4.2.1 基本操作

| 操作 | 説明 | Redis コマンド |
|------|------|---------------|
| 作成 | 新しいコンテキストを作成 | `HSET`, `SADD`, `EXPIRE` |
| 取得 | IDによるコンテキストの取得 | `HGETALL` |
| 更新 | 既存のコンテキストを更新 | `HSET` |
| 削除 | コンテキストを削除 | `DEL`, `SREM` |
| 検索 | 条件に基づくコンテキストの検索 | `SINTER`, `SUNION`, `FT.SEARCH` |

#### 4.2.2 高度な操作

| 操作 | 説明 | 実装方法 |
|------|------|----------|
| コンテキスト切り替え | アクティブコンテキストを切り替え | `SET` |
| コンテキスト階層取得 | コンテキスト階層を取得 | Recursive `HGETALL` |
| 関連コンテキスト更新 | 関連コンテキストを更新 | `HSET` |
| コンテキスト結合 | 複数のコンテキストを結合 | Custom logic |
| コンテキスト分割 | コンテキストを分割 | Custom logic |

## 5. インデックス戦略

### 5.1 作業記憶インデックス

#### 5.1.1 基本インデックス

- **タイプインデックス**: タイプ別に作業記憶アイテムをインデックス化
- **コンテキストインデックス**: コンテキストID別に作業記憶アイテムをインデックス化
- **タグインデックス**: タグ別に作業記憶アイテムをインデックス化
- **優先度インデックス**: 優先度別に作業記憶アイテムをインデックス化

#### 5.1.2 Redis Search インデックス

```
FT.CREATE idx:wm ON HASH PREFIX 1 harca:stm:wm:item: SCHEMA
  type TEXT SORTABLE
  content TEXT
  contextId TAG
  priority NUMERIC SORTABLE
  createdAt NUMERIC SORTABLE
  expiresAt NUMERIC SORTABLE
  metadata.tags TAG
  metadata.source TEXT
  metadata.confidence NUMERIC SORTABLE
```

### 5.2 コンテキストインデックス

#### 5.2.1 基本インデックス

- **タイプインデックス**: タイプ別にコンテキストをインデックス化
- **タグインデックス**: タグ別にコンテキストをインデックス化
- **状態インデックス**: 状態別にコンテキストをインデックス化
- **ユーザーインデックス**: ユーザーID別にコンテキストをインデックス化

#### 5.2.2 Redis Search インデックス

```
FT.CREATE idx:ctx ON HASH PREFIX 1 harca:stm:ctx: SCHEMA
  name TEXT SORTABLE
  type TEXT SORTABLE
  parentContextId TAG
  createdAt NUMERIC SORTABLE
  updatedAt NUMERIC SORTABLE
  expiresAt NUMERIC SORTABLE
  metadata.status TEXT SORTABLE
  metadata.priority NUMERIC SORTABLE
  metadata.tags TAG
  metadata.source TEXT
```

## 6. パフォーマンス最適化

### 6.1 キャッシュ戦略

- **頻繁にアクセスされるアイテム**: メモリ内キャッシュを使用
- **バッチ操作**: パイプラインとLuaスクリプトを使用して複数の操作を最適化
- **インデックス最適化**: 必要なインデックスのみを維持し、不要なインデックスを削除

### 6.2 メモリ管理

- **TTL管理**: すべての短期記憶アイテムに適切なTTLを設定
- **優先度ベースの削除**: メモリ圧迫時に低優先度アイテムを先に削除
- **圧縮**: 大きなデータの圧縮を検討

### 6.3 スケーリング戦略

- **Redis Cluster**: 大規模なデータセットに対応するためのクラスタリング
- **シャーディング**: ユーザーまたはコンテキストに基づくシャーディング
- **レプリケーション**: 高可用性のためのレプリケーション

## 7. データ整合性と耐障害性

### 7.1 データ整合性

- **トランザクション**: 関連する操作にRedisトランザクションを使用
- **バージョニング**: 更新操作のためのオプティミスティックロック
- **整合性チェック**: 定期的なデータ整合性チェックと修復

### 7.2 耐障害性

- **持続性**: Redis AOF（Append-Only File）とRDB（Redis Database）スナップショットを使用
- **バックアップ**: 定期的なバックアップスケジュール
- **障害復旧**: 自動フェイルオーバーと復旧手順

## 8. セキュリティ考慮事項

### 8.1 データ保護

- **暗号化**: 機密データの暗号化
- **アクセス制御**: Redisのアクセス制御リスト（ACL）を使用したきめ細かいアクセス制御
- **認証**: 強力なパスワードと認証メカニズム

### 8.2 プライバシー

- **データ最小化**: 必要最小限のデータのみを保存
- **データ匿名化**: 必要に応じて個人識別情報を匿名化
- **データ削除**: 不要になったデータの適切な削除

## 9. 実装例

### 9.1 作業記憶アイテム作成

```javascript
async function createWorkingMemoryItem(item) {
  const id = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_TTL);
  
  const memoryItem = {
    id,
    content: item.content,
    type: item.type,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    priority: item.priority || DEFAULT_PRIORITY,
    contextId: item.contextId,
    metadata: {
      source: item.metadata?.source || 'system',
      confidence: item.metadata?.confidence || 1.0,
      tags: item.metadata?.tags || [],
      accessCount: 0,
      lastAccessedAt: now.toISOString()
    }
  };
  
  const pipeline = redisClient.pipeline();
  
  // Store the item
  pipeline.hset(
    `harca:stm:wm:item:${id}`,
    'content', JSON.stringify(memoryItem.content),
    'type', memoryItem.type,
    'createdAt', memoryItem.createdAt,
    'expiresAt', memoryItem.expiresAt,
    'priority', memoryItem.priority,
    'contextId', memoryItem.contextId,
    'metadata', JSON.stringify(memoryItem.metadata)
  );
  
  // Set expiration
  const ttlMs = expiresAt.getTime() - now.getTime();
  pipeline.expire(`harca:stm:wm:item:${id}`, Math.floor(ttlMs / 1000));
  
  // Add to indexes
  pipeline.sadd(`harca:stm:wm:index:type:${memoryItem.type}`, id);
  pipeline.sadd(`harca:stm:wm:index:context:${memoryItem.contextId}`, id);
  pipeline.sadd(`harca:stm:wm:index:priority:${memoryItem.priority}`, id);
  
  for (const tag of memoryItem.metadata.tags) {
    pipeline.sadd(`harca:stm:wm:index:tag:${tag}`, id);
  }
  
  await pipeline.exec();
  return memoryItem;
}
```

### 9.2 コンテキスト作成

```javascript
async function createContext(context) {
  const id = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONTEXT_DEFAULT_TTL);
  
  const contextItem = {
    id,
    name: context.name,
    type: context.type,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    parentContextId: context.parentContextId || '',
    relatedContextIds: context.relatedContextIds || [],
    metadata: {
      status: context.metadata?.status || 'active',
      priority: context.metadata?.priority || DEFAULT_PRIORITY,
      tags: context.metadata?.tags || [],
      source: context.metadata?.source || 'system',
      description: context.metadata?.description || ''
    }
  };
  
  const pipeline = redisClient.pipeline();
  
  // Store the context
  pipeline.hset(
    `harca:stm:ctx:${id}`,
    'name', contextItem.name,
    'type', contextItem.type,
    'createdAt', contextItem.createdAt,
    'updatedAt', contextItem.updatedAt,
    'expiresAt', contextItem.expiresAt,
    'parentContextId', contextItem.parentContextId,
    'relatedContextIds', JSON.stringify(contextItem.relatedContextIds),
    'metadata', JSON.stringify(contextItem.metadata)
  );
  
  // Set expiration
  const ttlMs = expiresAt.getTime() - now.getTime();
  pipeline.expire(`harca:stm:ctx:${id}`, Math.floor(ttlMs / 1000));
  
  // Add to indexes
  pipeline.sadd(`harca:stm:ctx:index:type:${contextItem.type}`, id);
  pipeline.sadd(`harca:stm:ctx:index:status:${contextItem.metadata.status}`, id);
  
  for (const tag of contextItem.metadata.tags) {
    pipeline.sadd(`harca:stm:ctx:index:tag:${tag}`, id);
  }
  
  // Add to hierarchy if parent exists
  if (contextItem.parentContextId) {
    pipeline.sadd(`harca:stm:ctx:hierarchy:${contextItem.parentContextId}`, id);
  }
  
  await pipeline.exec();
  return contextItem;
}
```

## 10. 結論

本ドキュメントでは、HARCA多階層記憶システムの短期記憶コンポーネントのデータモデルについて詳細に記述しました。作業記憶とコンテキストマネージャーの構造、操作、インデックス戦略、およびパフォーマンス最適化について定義しました。このデータモデルに基づいて、効率的で柔軟な短期記憶システムを実装することができます。
