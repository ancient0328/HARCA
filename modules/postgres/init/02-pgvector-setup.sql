-- pgvector拡張機能のセットアップスクリプト

-- pgvector拡張機能のインストール
CREATE EXTENSION IF NOT EXISTS vector;

-- 既存のembeddingsテーブルに対してベクトルカラムを追加
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- ベクトル検索用のインデックスを作成
-- IVFLATインデックスは大規模なデータセットに適しています
CREATE INDEX IF NOT EXISTS embedding_vector_idx ON embeddings USING ivfflat (embedding_vector vector_l2_ops) WITH (lists = 100);

-- JSON形式の埋め込みベクトルをvector型に変換するための関数
CREATE OR REPLACE FUNCTION convert_json_to_vector()
RETURNS TRIGGER AS $$
BEGIN
    -- embedding JSONBフィールドからベクトルデータを取得して変換
    IF NEW.embedding IS NOT NULL THEN
        NEW.embedding_vector = (
            SELECT array_agg(x::float)::vector
            FROM jsonb_array_elements_text(NEW.embedding) AS x
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 埋め込みベクトルが挿入または更新されたときに自動的に変換するトリガー
CREATE TRIGGER convert_embedding_json_to_vector
BEFORE INSERT OR UPDATE OF embedding ON embeddings
FOR EACH ROW
EXECUTE FUNCTION convert_json_to_vector();

-- ベクトル検索関数
CREATE OR REPLACE FUNCTION search_embeddings(
    query_vector vector,
    limit_val integer DEFAULT 10,
    metadata_filter jsonb DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    metadata jsonb
) AS $$
BEGIN
    IF metadata_filter IS NULL THEN
        RETURN QUERY
        SELECT e.id, e.content, 1 - (e.embedding_vector <-> query_vector) as similarity, e.metadata
        FROM embeddings e
        ORDER BY e.embedding_vector <-> query_vector
        LIMIT limit_val;
    ELSE
        RETURN QUERY
        SELECT e.id, e.content, 1 - (e.embedding_vector <-> query_vector) as similarity, e.metadata
        FROM embeddings e
        WHERE e.metadata @> metadata_filter
        ORDER BY e.embedding_vector <-> query_vector
        LIMIT limit_val;
    END IF;
END;
$$ LANGUAGE plpgsql;
