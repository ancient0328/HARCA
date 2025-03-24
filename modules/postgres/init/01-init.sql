-- PostgreSQL初期化スクリプト
-- テーブル構造の定義と初期設定

-- 拡張機能のインストール
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ベクトル検索のためのpgvectorをインストールするための準備
-- 注意: pgvectorはPostgreSQLのエクステンションとして別途インストールが必要

-- ユーザー権限の設定
ALTER USER harca WITH SUPERUSER;

-- スキーマの作成
CREATE SCHEMA IF NOT EXISTS harca;

-- 埋め込みベクトルを保存するテーブル
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    embedding JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- キャッシュメタデータを保存するテーブル
CREATE TABLE IF NOT EXISTS cache_metadata (
    key TEXT PRIMARY KEY,
    value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 使用統計を保存するテーブル
CREATE TABLE IF NOT EXISTS usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation TEXT NOT NULL,
    duration INTEGER,
    success BOOLEAN,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- モデル設定を保存するテーブル
CREATE TABLE IF NOT EXISTS model_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name TEXT NOT NULL UNIQUE,
    config JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata ON embeddings USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_cache_metadata_expires_at ON cache_metadata (expires_at);
CREATE INDEX IF NOT EXISTS idx_usage_stats_operation ON usage_stats (operation);
CREATE INDEX IF NOT EXISTS idx_usage_stats_created_at ON usage_stats (created_at);

-- 更新時間を自動的に更新する関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 更新時間トリガーの設定
CREATE TRIGGER update_embeddings_updated_at
BEFORE UPDATE ON embeddings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cache_metadata_updated_at
BEFORE UPDATE ON cache_metadata
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_model_configs_updated_at
BEFORE UPDATE ON model_configs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 初期データの挿入
INSERT INTO model_configs (model_name, config)
VALUES 
('openai-text-embedding-ada-002', '{"dimensions": 1536, "type": "openai", "maxInputLength": 8191}'),
('local-minilm-l6-v2', '{"dimensions": 384, "type": "local", "maxInputLength": 512}')
ON CONFLICT (model_name) DO NOTHING;

-- 権限の設定
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO harca;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO harca;
