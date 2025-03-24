---
title: "多階層記憶システム API設計"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム API設計

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、多階層記憶システムのAPI設計について詳細に記述します。このAPIは、短期記憶、中期記憶、長期記憶の各モジュールへのアクセスと操作を統一的に提供し、外部システムとの連携を可能にします。

## 2. API設計の基本方針

### 2.1 設計原則

1. **一貫性**: 各記憶モジュールに対して一貫したインターフェースを提供
2. **モジュール性**: 各記憶層の独立した操作と統合操作の両方をサポート
3. **拡張性**: 将来的な機能追加や変更に対応できる柔軟な設計
4. **セキュリティ**: 適切な認証と認可メカニズムの実装
5. **パフォーマンス**: 効率的なデータアクセスと操作の最適化

### 2.2 API形式

1. **RESTful API**: HTTPメソッドを活用した標準的なRESTfulインターフェース
2. **GraphQL API**: 複雑なクエリや関連データの効率的な取得に対応
3. **WebSocket API**: リアルタイム通知や継続的なデータストリームに対応

## 3. RESTful API仕様

### 3.1 エンドポイント構造

基本エンドポイント: `/api/v1/memory`

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/v1/memory/short-term` | GET, POST, PUT, DELETE | 短期記憶の操作 |
| `/api/v1/memory/mid-term` | GET, POST, PUT, DELETE | 中期記憶の操作 |
| `/api/v1/memory/long-term` | GET, POST, PUT, DELETE | 長期記憶の操作 |
| `/api/v1/memory/search` | GET | 階層的な記憶検索 |
| `/api/v1/memory/integrate` | POST | 記憶の統合操作 |
| `/api/v1/memory/promote` | POST | 記憶の昇格操作 |

### 3.2 短期記憶API

#### 3.2.1 短期記憶の取得

```
GET /api/v1/memory/short-term/{memoryId}
```

**リクエストパラメータ**:
- `memoryId`: 取得する短期記憶のID

**レスポンス**:
```json
{
  "id": "wm-uuid-string",
  "type": "OBSERVATION",
  "content": "記憶の内容",
  "created": "2025-03-23T12:34:56Z",
  "expires": "2025-03-23T14:34:56Z",
  "metadata": {
    "importance": 0.7,
    "confidence": 0.9,
    "workingMemoryType": "CONTEXT",
    "contextId": "ctx-uuid-string",
    "sessionId": "sess-uuid-string",
    "tags": ["tag1", "tag2"],
    "source": "user",
    "priority": "HIGH"
  }
}
```

#### 3.2.2 短期記憶の作成

```
POST /api/v1/memory/short-term
```

**リクエストボディ**:
```json
{
  "type": "OBSERVATION",
  "content": "記憶の内容",
  "metadata": {
    "importance": 0.7,
    "confidence": 0.9,
    "workingMemoryType": "CONTEXT",
    "contextId": "ctx-uuid-string",
    "sessionId": "sess-uuid-string",
    "tags": ["tag1", "tag2"],
    "source": "user",
    "priority": "HIGH"
  },
  "ttl": 7200
}
```

**レスポンス**:
```json
{
  "id": "wm-uuid-string",
  "created": "2025-03-23T12:34:56Z",
  "expires": "2025-03-23T14:34:56Z"
}
```

#### 3.2.3 短期記憶の更新

```
PUT /api/v1/memory/short-term/{memoryId}
```

**リクエストパラメータ**:
- `memoryId`: 更新する短期記憶のID

**リクエストボディ**:
```json
{
  "content": "更新された記憶の内容",
  "metadata": {
    "importance": 0.8,
    "tags": ["tag1", "tag2", "new-tag"]
  }
}
```

**レスポンス**:
```json
{
  "id": "wm-uuid-string",
  "updated": "2025-03-23T12:45:00Z"
}
```

#### 3.2.4 短期記憶の削除

```
DELETE /api/v1/memory/short-term/{memoryId}
```

**リクエストパラメータ**:
- `memoryId`: 削除する短期記憶のID

**レスポンス**:
```json
{
  "success": true,
  "deleted": "wm-uuid-string"
}
```

### 3.3 中期記憶API

#### 3.3.1 中期記憶の取得

```
GET /api/v1/memory/mid-term/{memoryId}
```

**リクエストパラメータ**:
- `memoryId`: 取得する中期記憶のID

**レスポンス**:
```json
{
  "id": "em-uuid-string",
  "type": "OBSERVATION",
  "content": "記憶の内容",
  "created": "2025-03-23T12:34:56Z",
  "expires": "2025-04-22T12:34:56Z",
  "metadata": {
    "importance": 0.8,
    "confidence": 0.9,
    "episodicMemoryType": "CONVERSATION",
    "userId": "user-uuid-string",
    "sessionId": "sess-uuid-string",
    "tags": ["tag1", "tag2"],
    "relatedMemories": ["mem-id-1", "mem-id-2"],
    "source": "user",
    "priority": "MEDIUM"
  },
  "accessCount": 5,
  "lastAccessed": "2025-03-23T13:45:00Z"
}
```

#### 3.3.2 中期記憶の作成

```
POST /api/v1/memory/mid-term
```

**リクエストボディ**:
```json
{
  "type": "OBSERVATION",
  "content": "記憶の内容",
  "metadata": {
    "importance": 0.8,
    "confidence": 0.9,
    "episodicMemoryType": "CONVERSATION",
    "userId": "user-uuid-string",
    "sessionId": "sess-uuid-string",
    "tags": ["tag1", "tag2"],
    "relatedMemories": ["mem-id-1", "mem-id-2"],
    "source": "user",
    "priority": "MEDIUM"
  },
  "expirationDays": 30
}
```

**レスポンス**:
```json
{
  "id": "em-uuid-string",
  "created": "2025-03-23T12:34:56Z",
  "expires": "2025-04-22T12:34:56Z"
}
```

### 3.4 長期記憶API

#### 3.4.1 長期記憶の取得

```
GET /api/v1/memory/long-term/{itemId}
```

**リクエストパラメータ**:
- `itemId`: 取得する長期記憶のID

**レスポンス**:
```json
{
  "id": "ki-uuid-string",
  "type": "FACT",
  "content": "知識の内容",
  "created": "2025-03-23T12:34:56Z",
  "updated": "2025-03-23T12:34:56Z",
  "metadata": {
    "importance": 0.9,
    "confidence": 0.95,
    "knowledgeArea": "technology",
    "source": "system",
    "sourceUrl": "https://example.com/source",
    "tags": ["tag1", "tag2"],
    "relatedItems": ["item-id-1", "item-id-2"],
    "version": "1.0"
  },
  "accessCount": 42,
  "lastAccessed": "2025-03-23T13:45:00Z"
}
```

#### 3.4.2 長期記憶の作成

```
POST /api/v1/memory/long-term
```

**リクエストボディ**:
```json
{
  "type": "FACT",
  "content": "知識の内容",
  "metadata": {
    "importance": 0.9,
    "confidence": 0.95,
    "knowledgeArea": "technology",
    "source": "system",
    "sourceUrl": "https://example.com/source",
    "tags": ["tag1", "tag2"],
    "relatedItems": ["item-id-1", "item-id-2"],
    "version": "1.0"
  }
}
```

**レスポンス**:
```json
{
  "id": "ki-uuid-string",
  "created": "2025-03-23T12:34:56Z"
}
```

### 3.5 検索API

#### 3.5.1 階層的記憶検索

```
GET /api/v1/memory/search
```

**クエリパラメータ**:
- `query`: 検索クエリ
- `contextId`: コンテキストID
- `userId`: ユーザーID
- `sessionId`: セッションID
- `memoryTypes`: 検索対象の記憶タイプ（カンマ区切り）
- `limit`: 結果の上限数
- `includeShortTerm`: 短期記憶を含めるかどうか（デフォルト: true）
- `includeMidTerm`: 中期記憶を含めるかどうか（デフォルト: true）
- `includeLongTerm`: 長期記憶を含めるかどうか（デフォルト: true）

**レスポンス**:
```json
{
  "results": [
    {
      "id": "wm-uuid-string",
      "type": "short_term",
      "content": "短期記憶の内容",
      "relevance": 0.95,
      "created": "2025-03-23T12:34:56Z"
    },
    {
      "id": "em-uuid-string",
      "type": "mid_term",
      "content": "中期記憶の内容",
      "relevance": 0.85,
      "created": "2025-03-22T10:15:30Z"
    },
    {
      "id": "ki-uuid-string",
      "type": "long_term",
      "content": "長期記憶の内容",
      "relevance": 0.75,
      "created": "2025-03-01T08:45:12Z"
    }
  ],
  "stats": {
    "shortTermCount": 1,
    "midTermCount": 1,
    "longTermCount": 1,
    "totalCount": 3
  }
}
```

### 3.6 記憶昇格API

#### 3.6.1 短期記憶から中期記憶への昇格

```
POST /api/v1/memory/promote/short-to-mid
```

**リクエストボディ**:
```json
{
  "memoryId": "wm-uuid-string",
  "options": {
    "removeFromShortTerm": false,
    "expirationDays": 30
  }
}
```

**レスポンス**:
```json
{
  "sourceId": "wm-uuid-string",
  "targetId": "em-uuid-string",
  "success": true
}
```

#### 3.6.2 中期記憶から長期記憶への昇格

```
POST /api/v1/memory/promote/mid-to-long
```

**リクエストボディ**:
```json
{
  "memoryId": "em-uuid-string",
  "options": {
    "generalizeContent": true
  }
}
```

**レスポンス**:
```json
{
  "sourceId": "em-uuid-string",
  "targetId": "ki-uuid-string",
  "success": true
}
```

## 4. GraphQL API仕様

### 4.1 スキーマ定義

```graphql
type Query {
  # 短期記憶のクエリ
  shortTermMemory(id: ID!): ShortTermMemory
  shortTermMemories(
    contextId: ID
    sessionId: ID
    type: MemoryType
    limit: Int = 10
    offset: Int = 0
  ): [ShortTermMemory!]!
  
  # 中期記憶のクエリ
  midTermMemory(id: ID!): MidTermMemory
  midTermMemories(
    userId: ID
    sessionId: ID
    type: MemoryType
    tags: [String!]
    limit: Int = 10
    offset: Int = 0
  ): [MidTermMemory!]!
  
  # 長期記憶のクエリ
  longTermMemory(id: ID!): LongTermMemory
  longTermMemories(
    type: KnowledgeType
    knowledgeArea: String
    tags: [String!]
    limit: Int = 10
    offset: Int = 0
  ): [LongTermMemory!]!
  
  # 統合検索
  searchMemories(
    query: String!
    contextId: ID
    userId: ID
    sessionId: ID
    includeShortTerm: Boolean = true
    includeMidTerm: Boolean = true
    includeLongTerm: Boolean = true
    limit: Int = 10
  ): SearchResult!
}

type Mutation {
  # 短期記憶の操作
  createShortTermMemory(input: CreateShortTermMemoryInput!): ShortTermMemoryResult!
  updateShortTermMemory(id: ID!, input: UpdateShortTermMemoryInput!): ShortTermMemoryResult!
  deleteShortTermMemory(id: ID!): DeleteResult!
  
  # 中期記憶の操作
  createMidTermMemory(input: CreateMidTermMemoryInput!): MidTermMemoryResult!
  updateMidTermMemory(id: ID!, input: UpdateMidTermMemoryInput!): MidTermMemoryResult!
  deleteMidTermMemory(id: ID!): DeleteResult!
  
  # 長期記憶の操作
  createLongTermMemory(input: CreateLongTermMemoryInput!): LongTermMemoryResult!
  updateLongTermMemory(id: ID!, input: UpdateLongTermMemoryInput!): LongTermMemoryResult!
  deleteLongTermMemory(id: ID!): DeleteResult!
  
  # 記憶昇格操作
  promoteToMidTerm(id: ID!, options: PromoteToMidTermOptions): PromotionResult!
  promoteToLongTerm(id: ID!, options: PromoteToLongTermOptions): PromotionResult!
}

# 型定義（一部抜粋）
type ShortTermMemory {
  id: ID!
  type: MemoryType!
  content: String!
  created: DateTime!
  expires: DateTime
  metadata: MemoryMetadata
}

type MidTermMemory {
  id: ID!
  type: MemoryType!
  content: String!
  created: DateTime!
  expires: DateTime
  metadata: MemoryMetadata
  accessCount: Int
  lastAccessed: DateTime
}

type LongTermMemory {
  id: ID!
  type: KnowledgeType!
  content: String!
  created: DateTime!
  updated: DateTime!
  metadata: KnowledgeMetadata
  accessCount: Int
  lastAccessed: DateTime
}

type SearchResult {
  results: [MemorySearchResult!]!
  stats: SearchStats!
}

type MemorySearchResult {
  id: ID!
  memoryType: MemoryLayerType!
  type: String!
  content: String!
  relevance: Float!
  created: DateTime!
}

enum MemoryLayerType {
  SHORT_TERM
  MID_TERM
  LONG_TERM
}

enum MemoryType {
  OBSERVATION
  THINKING
  CONTEXT
  PREFERENCE
  FEEDBACK
}

enum KnowledgeType {
  FACT
  RULE
  CONCEPT
  PROCEDURE
}
```

### 4.2 サンプルクエリ

#### 4.2.1 階層的記憶検索

```graphql
query SearchMemories {
  searchMemories(
    query: "検索クエリ"
    contextId: "ctx-uuid-string"
    userId: "user-uuid-string"
    limit: 10
  ) {
    results {
      id
      memoryType
      type
      content
      relevance
      created
    }
    stats {
      shortTermCount
      midTermCount
      longTermCount
      totalCount
    }
  }
}
```

#### 4.2.2 関連記憶の取得

```graphql
query GetMemoryWithRelated {
  midTermMemory(id: "em-uuid-string") {
    id
    type
    content
    created
    metadata {
      relatedMemories
    }
    # 関連記憶の取得
    relatedShortTermMemories: shortTermMemories(
      limit: 5
    ) @requires(fields: "metadata.relatedMemories") {
      id
      type
      content
    }
    relatedLongTermMemories: longTermMemories(
      limit: 5
    ) @requires(fields: "metadata.relatedMemories") {
      id
      type
      content
    }
  }
}
```

## 5. WebSocket API仕様

### 5.1 接続エンドポイント

```
ws://server-domain/api/v1/memory/events
```

### 5.2 イベントタイプ

| イベント | 説明 |
|---------|------|
| `memory.created` | 新しい記憶が作成された |
| `memory.updated` | 記憶が更新された |
| `memory.deleted` | 記憶が削除された |
| `memory.promoted` | 記憶が昇格された |
| `memory.expired` | 記憶が期限切れになった |

### 5.3 イベントペイロード例

```json
{
  "event": "memory.created",
  "timestamp": "2025-03-23T12:34:56Z",
  "data": {
    "memoryId": "wm-uuid-string",
    "memoryType": "short_term",
    "type": "OBSERVATION",
    "contextId": "ctx-uuid-string",
    "sessionId": "sess-uuid-string"
  }
}
```

## 6. 認証と認可

### 6.1 認証メカニズム

1. **APIキー認証**: シンプルなAPIキーベースの認証
2. **JWT認証**: JSON Web Tokenを使用した認証
3. **OAuth 2.0**: 外部システムとの連携のための認証

### 6.2 認可ポリシー

| ロール | 短期記憶 | 中期記憶 | 長期記憶 |
|-------|---------|---------|---------|
| システム管理者 | 読み取り/書き込み/削除 | 読み取り/書き込み/削除 | 読み取り/書き込み/削除 |
| アプリケーション | 読み取り/書き込み | 読み取り/書き込み | 読み取り |
| ユーザー | 読み取り（自分のみ） | 読み取り（自分のみ） | 読み取り（公開のみ） |

## 7. エラー処理

### 7.1 エラーレスポンス形式

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": {
      "field": "エラーが発生したフィールド",
      "reason": "詳細な理由"
    }
  }
}
```

### 7.2 エラーコード

| コード | 説明 |
|-------|------|
| `MEMORY_NOT_FOUND` | 指定されたIDの記憶が見つからない |
| `INVALID_MEMORY_TYPE` | 無効な記憶タイプ |
| `INVALID_MEMORY_DATA` | 無効な記憶データ |
| `UNAUTHORIZED` | 認証エラー |
| `FORBIDDEN` | 権限エラー |
| `INTERNAL_ERROR` | 内部サーバーエラー |

## 8. パフォーマンス最適化

### 8.1 キャッシュ戦略

1. **レスポンスキャッシュ**: 頻繁にアクセスされるエンドポイントのレスポンスをキャッシュ
2. **データキャッシュ**: 頻繁にアクセスされる記憶データをキャッシュ
3. **クエリキャッシュ**: 複雑なクエリ結果をキャッシュ

### 8.2 ページネーションとフィルタリング

1. **カーソルベースのページネーション**: 大量のデータを効率的に取得
2. **フィルタリングオプション**: 必要なデータのみを取得するためのフィルタリング
3. **部分レスポンス**: 必要なフィールドのみを返すオプション

### 8.3 バッチ処理

1. **バルク操作**: 複数の記憶を一度に操作するためのエンドポイント
2. **非同期処理**: 時間のかかる操作を非同期で処理

## 9. 実装計画

### 9.1 実装ステップ

1. **基本RESTful APIの実装**
   - 各記憶層のCRUD操作
   - 検索API
   - 昇格API

2. **GraphQL APIの実装**
   - スキーマ定義
   - リゾルバー実装
   - クエリ最適化

3. **WebSocket APIの実装**
   - イベント発行メカニズム
   - 購読管理

4. **認証と認可の実装**
   - 認証メカニズム
   - 認可ポリシー

5. **最適化とスケーラビリティ対応**
   - キャッシュ実装
   - パフォーマンス最適化

### 9.2 テスト計画

1. **単体テスト**
   - 各エンドポイントのテスト
   - エラー処理のテスト

2. **統合テスト**
   - エンドツーエンドのAPIフローテスト
   - 認証・認可のテスト

3. **パフォーマンステスト**
   - 負荷テスト
   - レイテンシテスト

## 10. 結論

多階層記憶システムのAPI設計により、短期記憶、中期記憶、長期記憶の各モジュールへの統一的なアクセスと操作が可能になります。RESTful API、GraphQL API、WebSocket APIの組み合わせにより、様々なユースケースに対応できる柔軟なインターフェースを提供します。

適切な認証・認可メカニズムとパフォーマンス最適化により、セキュアで高速なAPIを実現し、HARCAプロジェクトの記憶システム全体の機能を強化します。
