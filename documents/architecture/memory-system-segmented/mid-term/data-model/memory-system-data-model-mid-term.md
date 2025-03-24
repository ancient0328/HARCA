---
title: "多階層記憶システム データモデル - 中期記憶"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム データモデル - 中期記憶

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムの中期記憶（Mid-Term Memory）コンポーネントのデータモデルについて詳細に記述します。中期記憶は、短期記憶よりも長い期間保持される情報を管理し、エピソード記憶（過去の会話や相互作用）とユーザープロファイル情報を保持します。

## 2. 中期記憶の基本構造

中期記憶は以下の主要コンポーネントで構成されます：

1. **エピソード記憶（Episodic Memory）**: 過去の会話やタスクの履歴を保持
2. **ユーザープロファイル（User Profile）**: ユーザーに関する情報を保持

## 3. データモデル詳細

### 3.1 エピソード記憶（Episodic Memory）

#### 3.1.1 EpisodeItem スキーマ

```javascript
{
  id: String,                 // 一意のID (UUID v4)
  type: String,               // エピソードタイプ（会話、タスク、問題解決など）
  content: Object,            // エピソード内容
  startTime: Timestamp,       // 開始時刻
  endTime: Timestamp,         // 終了時刻
  contextId: String,          // 関連コンテキストID
  participants: Array<String>, // 参加者（ユーザーID、システムなど）
  summary: String,            // エピソードの要約
  importance: Number,         // 重要度（1-10）
  relatedEpisodeIds: Array<String>, // 関連エピソードIDリスト
  metadata: {                 // メタデータ
    outcome: String,          // 結果（成功、失敗、未完了など）
    tags: Array<String>,      // タグリスト
    emotions: Object,         // 感情分析結果（オプション）
    location: String,         // 場所情報（オプション）
    accessCount: Number,      // アクセス回数
    lastAccessedAt: Timestamp // 最終アクセス時刻
  },
  vector: Array<Number>       // エピソード埋め込みベクトル（オプション）
}
```

#### 3.1.2 EpisodeItem タイプ

| タイプ | 説明 | 内容形式 |
|--------|------|----------|
| `conversation` | 会話エピソード | `{ turns: Array<Object>, topic: String, summary: String }` |
| `task` | タスク実行エピソード | `{ name: String, steps: Array<Object>, result: Object }` |
| `problem_solving` | 問題解決エピソード | `{ problem: String, approach: String, solution: Object }` |
| `learning` | 学習エピソード | `{ topic: String, materials: Array<Object>, insights: Array<String> }` |
| `interaction` | その他の相互作用 | 任意の形式 |

#### 3.1.3 PostgreSQL実装スキーマ

**テーブル定義**:

```sql
CREATE TABLE episodic_memory (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  context_id UUID,
  participants JSONB,
  summary TEXT,
  importance INTEGER CHECK (importance BETWEEN 1 AND 10),
  related_episode_ids UUID[],
  metadata JSONB,
  vector VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_episodic_memory_type ON episodic_memory(type);
CREATE INDEX idx_episodic_memory_context_id ON episodic_memory(context_id);
CREATE INDEX idx_episodic_memory_start_time ON episodic_memory(start_time);
CREATE INDEX idx_episodic_memory_importance ON episodic_memory(importance);
CREATE INDEX idx_episodic_memory_content ON episodic_memory USING GIN (content);
CREATE INDEX idx_episodic_memory_metadata ON episodic_memory USING GIN (metadata);
CREATE INDEX idx_episodic_memory_vector ON episodic_memory USING ivfflat (vector vector_cosine_ops);
```

### 3.2 ユーザープロファイル（User Profile）

#### 3.2.1 UserProfileItem スキーマ

```javascript
{
  userId: String,             // ユーザーID
  preferences: {              // ユーザー設定
    language: String,         // 言語設定
    theme: String,            // テーマ設定
    notificationSettings: Object, // 通知設定
    privacySettings: Object   // プライバシー設定
  },
  skills: {                   // スキル情報
    programmingLanguages: Array<Object>, // プログラミング言語スキル
    domains: Array<Object>,   // ドメイン知識
    tools: Array<Object>      // ツール習熟度
  },
  behavior: {                 // 行動パターン
    activeHours: Array<Object>, // アクティブ時間帯
    interactionFrequency: Object, // 相互作用頻度
    responsePatterns: Object  // 応答パターン
  },
  history: {                  // 履歴サマリー
    firstInteraction: Timestamp, // 初回相互作用時刻
    lastInteraction: Timestamp,  // 最終相互作用時刻
    totalInteractions: Number,   // 総相互作用回数
    completedTasks: Number    // 完了タスク数
  },
  metadata: {                 // メタデータ
    createdAt: Timestamp,     // プロファイル作成時刻
    updatedAt: Timestamp,     // 最終更新時刻
    version: String,          // プロファイルバージョン
    tags: Array<String>       // タグリスト
  }
}
```

#### 3.2.2 PostgreSQL実装スキーマ

**テーブル定義**:

```sql
CREATE TABLE user_profile (
  user_id VARCHAR(100) PRIMARY KEY,
  preferences JSONB,
  skills JSONB,
  behavior JSONB,
  history JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_user_profile_preferences ON user_profile USING GIN (preferences);
CREATE INDEX idx_user_profile_skills ON user_profile USING GIN (skills);
CREATE INDEX idx_user_profile_behavior ON user_profile USING GIN (behavior);
CREATE INDEX idx_user_profile_metadata ON user_profile USING GIN (metadata);
```

## 4. データ操作

### 4.1 エピソード記憶操作

#### 4.1.1 基本操作

| 操作 | 説明 | SQL |
|------|------|-----|
| 作成 | 新しいエピソードを作成 | `INSERT INTO episodic_memory (...) VALUES (...)` |
| 取得 | IDによるエピソードの取得 | `SELECT * FROM episodic_memory WHERE id = $1` |
| 更新 | 既存のエピソードを更新 | `UPDATE episodic_memory SET ... WHERE id = $1` |
| 削除 | エピソードを削除 | `DELETE FROM episodic_memory WHERE id = $1` |
| 検索 | 条件に基づくエピソードの検索 | `SELECT * FROM episodic_memory WHERE ...` |

#### 4.1.2 高度な操作

| 操作 | 説明 | 実装方法 |
|------|------|----------|
| ベクトル検索 | 意味的に類似したエピソードを検索 | `SELECT * FROM episodic_memory ORDER BY vector <-> $1 LIMIT $2` |
| 時系列検索 | 時間範囲に基づくエピソードの検索 | `SELECT * FROM episodic_memory WHERE start_time BETWEEN $1 AND $2` |
| 関連エピソード取得 | 関連するエピソードを取得 | `SELECT * FROM episodic_memory WHERE id = ANY($1::uuid[])` |
| 要約生成 | エピソードの要約を生成または更新 | Custom logic with LLM |
| 長期記憶への昇格 | 重要なエピソードを長期記憶に昇格 | Custom logic |

### 4.2 ユーザープロファイル操作

#### 4.2.1 基本操作

| 操作 | 説明 | SQL |
|------|------|-----|
| 作成 | 新しいユーザープロファイルを作成 | `INSERT INTO user_profile (...) VALUES (...)` |
| 取得 | ユーザーIDによるプロファイルの取得 | `SELECT * FROM user_profile WHERE user_id = $1` |
| 更新 | 既存のユーザープロファイルを更新 | `UPDATE user_profile SET ... WHERE user_id = $1` |
| 削除 | ユーザープロファイルを削除 | `DELETE FROM user_profile WHERE user_id = $1` |
| 検索 | 条件に基づくユーザープロファイルの検索 | `SELECT * FROM user_profile WHERE ...` |

#### 4.2.2 高度な操作

| 操作 | 説明 | 実装方法 |
|------|------|----------|
| プロファイル拡張 | 新しい情報でプロファイルを拡張 | `UPDATE user_profile SET ... = jsonb_set(...)` |
| 行動分析 | ユーザー行動パターンの分析と更新 | Custom analytics logic |
| 類似ユーザー検索 | 類似したプロファイルを持つユーザーを検索 | Custom similarity logic |
| プロファイルマージ | 複数のプロファイル情報をマージ | Custom merge logic |
| プロファイルバージョニング | プロファイルの変更履歴を管理 | Temporal tables or custom versioning |

## 5. インデックス戦略

### 5.1 エピソード記憶インデックス

#### 5.1.1 基本インデックス

- **タイプインデックス**: エピソードタイプによる検索を最適化
- **コンテキストインデックス**: 関連コンテキストによる検索を最適化
- **時間インデックス**: 時間範囲による検索を最適化
- **重要度インデックス**: 重要度による検索を最適化

#### 5.1.2 JSON/JSONB インデックス

- **内容インデックス**: JSONBコンテンツに対するGINインデックス
- **メタデータインデックス**: メタデータに対するGINインデックス
- **タグインデックス**: タグに対する検索を最適化

#### 5.1.3 ベクトルインデックス

- **IVFFlat**: 近似最近傍検索のためのIVFFlatインデックス
- **HNSW**: 高性能な近似最近傍検索のためのHNSWインデックス（オプション）

### 5.2 ユーザープロファイルインデックス

#### 5.2.1 基本インデックス

- **ユーザーIDインデックス**: プライマリキーインデックス
- **更新時刻インデックス**: 最近更新されたプロファイルの検索を最適化

#### 5.2.2 JSON/JSONB インデックス

- **設定インデックス**: ユーザー設定に対するGINインデックス
- **スキルインデックス**: スキル情報に対するGINインデックス
- **行動インデックス**: 行動パターンに対するGINインデックス
- **メタデータインデックス**: メタデータに対するGINインデックス

## 6. パフォーマンス最適化

### 6.1 クエリ最適化

- **パーティショニング**: 時間ベースのパーティショニングによるエピソード記憶の検索最適化
- **マテリアライズドビュー**: 頻繁に使用される集計クエリのためのマテリアライズドビュー
- **クエリプラン最適化**: 実行計画の分析と最適化

### 6.2 キャッシュ戦略

- **アプリケーションキャッシュ**: 頻繁にアクセスされるデータのメモリキャッシュ
- **Redis**: 二次キャッシュとしてのRedisの使用
- **キャッシュ無効化**: 効率的なキャッシュ無効化戦略

### 6.3 スケーリング戦略

- **読み取りレプリカ**: 読み取り操作のスケーリングのためのレプリケーション
- **シャーディング**: ユーザーIDに基づくシャーディング
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

- **暗号化**: 機密データの列レベル暗号化
- **アクセス制御**: ロールベースのアクセス制御
- **監査**: データアクセスと変更の監査ログ

### 8.2 プライバシー

- **データ最小化**: 必要最小限のデータのみを保存
- **匿名化**: 必要に応じたデータの匿名化
- **削除ポリシー**: プライバシー要求に応じたデータ削除ポリシー

## 9. 実装例

### 9.1 エピソード作成

```javascript
async function createEpisode(episode) {
  const id = uuidv4();
  const now = new Date();
  
  // エピソードの埋め込みベクトルを生成
  const vector = await generateEmbedding(episode.summary || JSON.stringify(episode.content));
  
  const episodeItem = {
    id,
    type: episode.type,
    content: episode.content,
    startTime: episode.startTime || now.toISOString(),
    endTime: episode.endTime,
    contextId: episode.contextId,
    participants: episode.participants || [],
    summary: episode.summary || '',
    importance: episode.importance || DEFAULT_IMPORTANCE,
    relatedEpisodeIds: episode.relatedEpisodeIds || [],
    metadata: {
      outcome: episode.metadata?.outcome || '',
      tags: episode.metadata?.tags || [],
      emotions: episode.metadata?.emotions || {},
      location: episode.metadata?.location || '',
      accessCount: 0,
      lastAccessedAt: now.toISOString()
    },
    vector
  };
  
  const query = `
    INSERT INTO episodic_memory (
      id, type, content, start_time, end_time, context_id, participants,
      summary, importance, related_episode_ids, metadata, vector,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    ) RETURNING *
  `;
  
  const values = [
    episodeItem.id,
    episodeItem.type,
    JSON.stringify(episodeItem.content),
    episodeItem.startTime,
    episodeItem.endTime,
    episodeItem.contextId,
    JSON.stringify(episodeItem.participants),
    episodeItem.summary,
    episodeItem.importance,
    episodeItem.relatedEpisodeIds,
    JSON.stringify(episodeItem.metadata),
    episodeItem.vector,
    now,
    now
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}
```

### 9.2 ユーザープロファイル更新

```javascript
async function updateUserProfile(userId, profileUpdates) {
  const now = new Date();
  
  // 現在のプロファイルを取得
  const currentProfileQuery = `
    SELECT * FROM user_profile WHERE user_id = $1
  `;
  
  const currentProfileResult = await pool.query(currentProfileQuery, [userId]);
  const currentProfile = currentProfileResult.rows[0];
  
  if (!currentProfile) {
    throw new Error(`User profile not found for user ID: ${userId}`);
  }
  
  // プロファイル更新を準備
  const updatedProfile = {
    preferences: profileUpdates.preferences 
      ? { ...currentProfile.preferences, ...profileUpdates.preferences }
      : currentProfile.preferences,
    skills: profileUpdates.skills
      ? { ...currentProfile.skills, ...profileUpdates.skills }
      : currentProfile.skills,
    behavior: profileUpdates.behavior
      ? { ...currentProfile.behavior, ...profileUpdates.behavior }
      : currentProfile.behavior,
    history: profileUpdates.history
      ? { ...currentProfile.history, ...profileUpdates.history }
      : currentProfile.history,
    metadata: {
      ...currentProfile.metadata,
      updatedAt: now.toISOString(),
      version: incrementVersion(currentProfile.metadata.version)
    }
  };
  
  // プロファイルを更新
  const updateQuery = `
    UPDATE user_profile
    SET
      preferences = $1,
      skills = $2,
      behavior = $3,
      history = $4,
      metadata = $5,
      updated_at = $6
    WHERE user_id = $7
    RETURNING *
  `;
  
  const updateValues = [
    JSON.stringify(updatedProfile.preferences),
    JSON.stringify(updatedProfile.skills),
    JSON.stringify(updatedProfile.behavior),
    JSON.stringify(updatedProfile.history),
    JSON.stringify(updatedProfile.metadata),
    now,
    userId
  ];
  
  const result = await pool.query(updateQuery, updateValues);
  return result.rows[0];
}
```

## 10. 結論

本ドキュメントでは、HARCA多階層記憶システムの中期記憶コンポーネントのデータモデルについて詳細に記述しました。エピソード記憶とユーザープロファイルの構造、操作、インデックス戦略、およびパフォーマンス最適化について定義しました。このデータモデルに基づいて、効率的で柔軟な中期記憶システムを実装することができます。
