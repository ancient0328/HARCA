---
title: "多階層記憶システム PostgreSQL統合設計 - スキーマ設計"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - スキーマ設計

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムのPostgreSQLデータベーススキーマ設計について詳細に記述します。中期記憶モジュール（エピソード記憶、ユーザープロファイル）および長期記憶モジュール（知識ベース、ルールエンジン）のテーブル構造、リレーションシップ、インデックス戦略について定義します。

## 2. データベース構成

### 2.1 スキーマ構成

```sql
-- スキーマ作成
CREATE SCHEMA short_term;  -- 短期記憶バックアップ用
CREATE SCHEMA mid_term;    -- 中期記憶用
CREATE SCHEMA long_term;   -- 長期記憶用
CREATE SCHEMA vector;      -- ベクトル検索用
CREATE SCHEMA system;      -- システム管理用
```

### 2.2 拡張機能

```sql
-- 必要な拡張機能のインストール
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID生成用
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- 暗号化機能用
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- クエリ統計用
CREATE EXTENSION IF NOT EXISTS "pg_cron";       -- スケジュールタスク用
CREATE EXTENSION IF NOT EXISTS "vector";        -- ベクトル検索用
```

## 3. 中期記憶スキーマ設計

### 3.1 エピソード記憶テーブル

#### 3.1.1 エピソードテーブル

```sql
CREATE TABLE mid_term.episodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    importance INTEGER DEFAULT 5,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_episodes_type ON mid_term.episodes(type);
CREATE INDEX idx_episodes_time_range ON mid_term.episodes(start_time, end_time);
CREATE INDEX idx_episodes_importance ON mid_term.episodes(importance);
CREATE INDEX idx_episodes_metadata ON mid_term.episodes USING GIN(metadata);
```

#### 3.1.2 エピソードイベントテーブル

```sql
CREATE TABLE mid_term.episode_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    episode_id UUID NOT NULL REFERENCES mid_term.episodes(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    importance INTEGER DEFAULT 5,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_episode_events_episode_id ON mid_term.episode_events(episode_id);
CREATE INDEX idx_episode_events_type ON mid_term.episode_events(type);
CREATE INDEX idx_episode_events_time ON mid_term.episode_events(event_time);
CREATE INDEX idx_episode_events_importance ON mid_term.episode_events(importance);
CREATE INDEX idx_episode_events_metadata ON mid_term.episode_events USING GIN(metadata);
```

#### 3.1.3 エピソード参加者テーブル

```sql
CREATE TABLE mid_term.episode_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    episode_id UUID NOT NULL REFERENCES mid_term.episodes(id) ON DELETE CASCADE,
    participant_id VARCHAR(255) NOT NULL,
    participant_type VARCHAR(50) NOT NULL,
    role VARCHAR(50),
    joined_at TIMESTAMPTZ NOT NULL,
    left_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_episode_participants_episode_id ON mid_term.episode_participants(episode_id);
CREATE INDEX idx_episode_participants_participant ON mid_term.episode_participants(participant_id, participant_type);
```

#### 3.1.4 エピソード関係テーブル

```sql
CREATE TABLE mid_term.episode_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_episode_id UUID NOT NULL REFERENCES mid_term.episodes(id) ON DELETE CASCADE,
    target_episode_id UUID NOT NULL REFERENCES mid_term.episodes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    strength FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_episode_relationship UNIQUE(source_episode_id, target_episode_id, relationship_type)
);

-- インデックス
CREATE INDEX idx_episode_relationships_source ON mid_term.episode_relationships(source_episode_id);
CREATE INDEX idx_episode_relationships_target ON mid_term.episode_relationships(target_episode_id);
CREATE INDEX idx_episode_relationships_type ON mid_term.episode_relationships(relationship_type);
```

### 3.2 ユーザープロファイルテーブル

#### 3.2.1 ユーザーテーブル

```sql
CREATE TABLE mid_term.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) UNIQUE,
    username VARCHAR(255),
    email VARCHAR(255),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    interaction_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_users_external_id ON mid_term.users(external_id);
CREATE INDEX idx_users_last_seen ON mid_term.users(last_seen_at);
CREATE INDEX idx_users_metadata ON mid_term.users USING GIN(metadata);
```

#### 3.2.2 ユーザー設定テーブル

```sql
CREATE TABLE mid_term.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES mid_term.users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    source VARCHAR(50) DEFAULT 'explicit',
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_preference UNIQUE(user_id, category, key)
);

-- インデックス
CREATE INDEX idx_user_preferences_user_id ON mid_term.user_preferences(user_id);
CREATE INDEX idx_user_preferences_category ON mid_term.user_preferences(category);
```

#### 3.2.3 ユーザースキルテーブル

```sql
CREATE TABLE mid_term.user_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES mid_term.users(id) ON DELETE CASCADE,
    skill_name VARCHAR(255) NOT NULL,
    category VARCHAR(50),
    proficiency_level FLOAT NOT NULL DEFAULT 0.0,
    confidence FLOAT DEFAULT 0.5,
    last_demonstrated_at TIMESTAMPTZ,
    evidence_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_skill UNIQUE(user_id, skill_name)
);

-- インデックス
CREATE INDEX idx_user_skills_user_id ON mid_term.user_skills(user_id);
CREATE INDEX idx_user_skills_category ON mid_term.user_skills(category);
CREATE INDEX idx_user_skills_proficiency ON mid_term.user_skills(proficiency_level);
```

#### 3.2.4 ユーザー行動パターンテーブル

```sql
CREATE TABLE mid_term.user_behavior_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES mid_term.users(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL,
    pattern_name VARCHAR(255) NOT NULL,
    description TEXT,
    confidence FLOAT DEFAULT 0.5,
    occurrence_count INTEGER DEFAULT 1,
    first_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_pattern UNIQUE(user_id, pattern_type, pattern_name)
);

-- インデックス
CREATE INDEX idx_user_behavior_patterns_user_id ON mid_term.user_behavior_patterns(user_id);
CREATE INDEX idx_user_behavior_patterns_type ON mid_term.user_behavior_patterns(pattern_type);
CREATE INDEX idx_user_behavior_patterns_confidence ON mid_term.user_behavior_patterns(confidence);
```

## 4. 長期記憶スキーマ設計

### 4.1 知識ベーステーブル

#### 4.1.1 知識アイテムテーブル

```sql
CREATE TABLE long_term.knowledge_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    confidence FLOAT DEFAULT 0.5,
    importance INTEGER DEFAULT 5,
    source VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_knowledge_item UNIQUE(type, name)
);

-- インデックス
CREATE INDEX idx_knowledge_items_type ON long_term.knowledge_items(type);
CREATE INDEX idx_knowledge_items_name ON long_term.knowledge_items(name);
CREATE INDEX idx_knowledge_items_confidence ON long_term.knowledge_items(confidence);
CREATE INDEX idx_knowledge_items_importance ON long_term.knowledge_items(importance);
CREATE INDEX idx_knowledge_items_metadata ON long_term.knowledge_items USING GIN(metadata);
```

#### 4.1.2 知識関係テーブル

```sql
CREATE TABLE long_term.knowledge_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES long_term.knowledge_items(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES long_term.knowledge_items(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    strength FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_knowledge_relationship UNIQUE(source_id, target_id, relationship_type)
);

-- インデックス
CREATE INDEX idx_knowledge_relationships_source ON long_term.knowledge_relationships(source_id);
CREATE INDEX idx_knowledge_relationships_target ON long_term.knowledge_relationships(target_id);
CREATE INDEX idx_knowledge_relationships_type ON long_term.knowledge_relationships(relationship_type);
```

#### 4.1.3 知識カテゴリテーブル

```sql
CREATE TABLE long_term.knowledge_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    parent_id UUID REFERENCES long_term.knowledge_categories(id) ON DELETE SET NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_knowledge_categories_parent ON long_term.knowledge_categories(parent_id);
```

#### 4.1.4 知識アイテムカテゴリマッピングテーブル

```sql
CREATE TABLE long_term.knowledge_item_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_item_id UUID NOT NULL REFERENCES long_term.knowledge_items(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES long_term.knowledge_categories(id) ON DELETE CASCADE,
    relevance FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_knowledge_item_category UNIQUE(knowledge_item_id, category_id)
);

-- インデックス
CREATE INDEX idx_knowledge_item_categories_item ON long_term.knowledge_item_categories(knowledge_item_id);
CREATE INDEX idx_knowledge_item_categories_category ON long_term.knowledge_item_categories(category_id);
```

### 4.2 ルールエンジンテーブル

#### 4.2.1 ルールテーブル

```sql
CREATE TABLE long_term.rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    condition_expression TEXT NOT NULL,
    action_expression TEXT NOT NULL,
    priority INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_rules_name ON long_term.rules(name);
CREATE INDEX idx_rules_priority ON long_term.rules(priority);
CREATE INDEX idx_rules_is_active ON long_term.rules(is_active);
```

#### 4.2.2 ルール実行履歴テーブル

```sql
CREATE TABLE long_term.rule_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES long_term.rules(id) ON DELETE CASCADE,
    context_id VARCHAR(255),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    execution_result BOOLEAN NOT NULL,
    execution_time_ms INTEGER,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- インデックス
CREATE INDEX idx_rule_executions_rule_id ON long_term.rule_executions(rule_id);
CREATE INDEX idx_rule_executions_context_id ON long_term.rule_executions(context_id);
CREATE INDEX idx_rule_executions_triggered_at ON long_term.rule_executions(triggered_at);
CREATE INDEX idx_rule_executions_result ON long_term.rule_executions(execution_result);
```

#### 4.2.3 ルール依存関係テーブル

```sql
CREATE TABLE long_term.rule_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_rule_id UUID NOT NULL REFERENCES long_term.rules(id) ON DELETE CASCADE,
    target_rule_id UUID NOT NULL REFERENCES long_term.rules(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_rule_dependency UNIQUE(source_rule_id, target_rule_id, dependency_type)
);

-- インデックス
CREATE INDEX idx_rule_dependencies_source ON long_term.rule_dependencies(source_rule_id);
CREATE INDEX idx_rule_dependencies_target ON long_term.rule_dependencies(target_rule_id);
```

## 5. ベクトル検索スキーマ設計

### 5.1 埋め込みベクトルテーブル

```sql
CREATE TABLE vector.embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type VARCHAR(50) NOT NULL,
    source_id UUID NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    embedding vector(1536) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_embeddings_source ON vector.embeddings(source_type, source_id);
CREATE INDEX idx_embeddings_model ON vector.embeddings(model_name);
CREATE INDEX idx_embeddings_vector ON vector.embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 5.2 セマンティックキャッシュテーブル

```sql
CREATE TABLE vector.semantic_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT NOT NULL,
    query_embedding vector(1536) NOT NULL,
    result_ids JSONB NOT NULL,
    result_scores JSONB NOT NULL,
    hit_count INTEGER DEFAULT 1,
    last_hit_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_semantic_cache_query ON vector.semantic_cache USING GIN(to_tsvector('english', query_text));
CREATE INDEX idx_semantic_cache_embedding ON vector.semantic_cache USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX idx_semantic_cache_last_hit ON vector.semantic_cache(last_hit_at);
```

## 6. 短期記憶バックアップスキーマ設計

### 6.1 作業記憶バックアップテーブル

```sql
CREATE TABLE short_term.working_memory_backup (
    id UUID PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    context_id VARCHAR(255),
    priority INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    backup_time TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_working_memory_backup_type ON short_term.working_memory_backup(type);
CREATE INDEX idx_working_memory_backup_context ON short_term.working_memory_backup(context_id);
CREATE INDEX idx_working_memory_backup_expires ON short_term.working_memory_backup(expires_at);
```

### 6.2 コンテキストバックアップテーブル

```sql
CREATE TABLE short_term.context_backup (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    backup_time TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_context_backup_type ON short_term.context_backup(type);
CREATE INDEX idx_context_backup_expires ON short_term.context_backup(expires_at);
```

## 7. システム管理スキーマ設計

### 7.1 マイグレーション履歴テーブル

```sql
CREATE TABLE system.migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version VARCHAR(50) NOT NULL,
    description TEXT,
    checksum VARCHAR(64) NOT NULL
);
```

### 7.2 システムメトリクステーブル

```sql
CREATE TABLE system.metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value FLOAT NOT NULL,
    dimensions JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_metrics_name ON system.metrics(metric_name);
CREATE INDEX idx_metrics_recorded_at ON system.metrics(recorded_at);
CREATE INDEX idx_metrics_dimensions ON system.metrics USING GIN(dimensions);
```

### 7.3 システムログテーブル

```sql
CREATE TABLE system.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    component VARCHAR(255),
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_logs_level ON system.logs(level);
CREATE INDEX idx_logs_component ON system.logs(component);
CREATE INDEX idx_logs_logged_at ON system.logs(logged_at);
CREATE INDEX idx_logs_context ON system.logs USING GIN(context);
```

## 8. データベースビュー

### 8.1 アクティブエピソードビュー

```sql
CREATE VIEW mid_term.active_episodes AS
SELECT e.*
FROM mid_term.episodes e
WHERE e.is_active = TRUE
AND (e.end_time IS NULL OR e.end_time > NOW());
```

### 8.2 ユーザープロファイル統合ビュー

```sql
CREATE VIEW mid_term.user_profile_view AS
SELECT 
    u.id,
    u.external_id,
    u.username,
    u.email,
    u.first_seen_at,
    u.last_seen_at,
    u.interaction_count,
    u.metadata AS user_metadata,
    (
        SELECT jsonb_object_agg(up.key, up.value)
        FROM mid_term.user_preferences up
        WHERE up.user_id = u.id
    ) AS preferences,
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'skill_name', us.skill_name,
                'category', us.category,
                'proficiency_level', us.proficiency_level,
                'confidence', us.confidence
            )
        )
        FROM mid_term.user_skills us
        WHERE us.user_id = u.id
    ) AS skills,
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'pattern_type', ubp.pattern_type,
                'pattern_name', ubp.pattern_name,
                'confidence', ubp.confidence,
                'occurrence_count', ubp.occurrence_count
            )
        )
        FROM mid_term.user_behavior_patterns ubp
        WHERE ubp.user_id = u.id
    ) AS behavior_patterns
FROM mid_term.users u;
```

### 8.3 知識グラフビュー

```sql
CREATE VIEW long_term.knowledge_graph_view AS
SELECT 
    kr.id AS relationship_id,
    kr.relationship_type,
    kr.strength,
    source.id AS source_id,
    source.type AS source_type,
    source.name AS source_name,
    target.id AS target_id,
    target.type AS target_type,
    target.name AS target_name
FROM long_term.knowledge_relationships kr
JOIN long_term.knowledge_items source ON kr.source_id = source.id
JOIN long_term.knowledge_items target ON kr.target_id = target.id;
```

## 9. 結論

本ドキュメントでは、HARCA多階層記憶システムのPostgreSQLデータベーススキーマ設計について詳細に記述しました。中期記憶モジュール（エピソード記憶、ユーザープロファイル）および長期記憶モジュール（知識ベース、ルールエンジン）のテーブル構造、リレーションシップ、インデックス戦略を定義しました。このスキーマ設計に基づいて、効率的で拡張性のある多階層記憶システムを実装することができます。
