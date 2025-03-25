# ファイルベースストレージからPostgreSQLへの移行計画

## 概要

HARCAプロジェクトのベクトルストア機能において、現在のファイルベースのストレージからPostgreSQLベースのベクトルストアへの移行を計画します。この移行により、検索性能の向上、スケーラビリティの改善、および管理の簡素化が期待できます。

## 現状分析

### 現在のストレージ構成
- ファイルベースのベクトルストレージ
- Redisキャッシュ（分散キャッシュ）
- メモリ内キャッシュ
- ファイルキャッシュ

### 既存のPostgreSQL実装
- `code_vectors`テーブル：5件のレコードが存在
- `embeddings`テーブル：初期化スクリプトで作成
- pgvector拡張：インストール済み

## 移行目標

1. **データの完全性確保**：既存のファイルベースデータを損失なくPostgreSQLに移行
2. **パフォーマンス向上**：検索クエリの応答時間を改善
3. **スケーラビリティ確保**：大量のベクトルデータを効率的に管理
4. **システム統合**：キャッシュ層とのシームレスな統合
5. **ダウンタイム最小化**：サービス中断を最小限に抑える

## 移行ステップ

### 1. 準備フェーズ
- [x] PostgreSQL接続の安定化（完了）
- [x] テーブル構造の確認と最適化（完了）
- [ ] 既存データの分析（サイズ、構造、依存関係）
- [ ] バックアップ戦略の確立

### 2. データ抽出フェーズ
- [ ] ファイルベースのベクトルデータの抽出スクリプト作成
- [ ] メタデータの正規化
- [ ] データ整合性チェックの実装

### 3. データ変換フェーズ
- [ ] PostgreSQL形式へのデータ変換
- [ ] ベクトル形式の最適化（pgvector互換）
- [ ] メタデータのJSONB形式への変換

### 4. データロードフェーズ
- [ ] バッチ処理によるデータインポート
- [ ] インデックス作成の最適化
- [ ] 進捗モニタリングとエラーハンドリング

### 5. 検証フェーズ
- [ ] データ整合性の検証
- [ ] 検索機能のテスト
- [ ] パフォーマンス測定
- [ ] キャッシュ連携の確認

### 6. 切り替えフェーズ
- [ ] 読み取り操作のPostgreSQLへの切り替え
- [ ] 書き込み操作のPostgreSQLへの切り替え
- [ ] 古いファイルベースデータのアーカイブ

### 7. 最適化フェーズ
- [ ] クエリパフォーマンスの最適化
- [ ] インデックス戦略の調整
- [ ] キャッシュ戦略の最適化

## テーブル設計

### 統合テーブル案（`vector_embeddings`）

```sql
CREATE TABLE vector_embeddings (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,  -- OpenAI埋め込みモデルの次元数
  metadata JSONB NOT NULL,
  model_id VARCHAR(50) NOT NULL,    -- 使用した埋め込みモデルのID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50) DEFAULT 'unknown'  -- データソース（'code', 'document', 'knowledge'など）
);

-- 類似度検索用インデックス
CREATE INDEX vector_embeddings_embedding_idx ON vector_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- メタデータ検索用インデックス
CREATE INDEX vector_embeddings_metadata_idx ON vector_embeddings USING GIN (metadata);

-- ソース検索用インデックス
CREATE INDEX vector_embeddings_source_idx ON vector_embeddings (source);
```

## 移行スクリプト概要

```javascript
/**
 * ファイルベースのベクトルデータをPostgreSQLに移行するスクリプト
 */
async function migrateToPostgres() {
  // 1. ファイルベースのデータを読み込む
  const fileData = await loadFileBasedVectors();
  
  // 2. PostgreSQL接続を初期化
  const pool = new Pool({ connectionString: process.env.POSTGRES_CONNECTION_STRING });
  
  // 3. バッチ処理でデータを移行
  const batchSize = 100;
  const batches = chunkArray(fileData, batchSize);
  
  for (const [index, batch] of batches.entries()) {
    console.log(`バッチ ${index + 1}/${batches.length} を処理中...`);
    
    await processBatch(pool, batch);
    
    // 進捗報告
    const progress = ((index + 1) / batches.length * 100).toFixed(2);
    console.log(`進捗: ${progress}%`);
  }
  
  // 4. 検証
  await verifyMigration(pool, fileData);
  
  // 5. クリーンアップ
  await pool.end();
  console.log('移行が完了しました');
}
```

## リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| データ損失 | 高 | 移行前の完全バックアップ、検証プロセスの徹底 |
| パフォーマンス低下 | 中 | インデックス最適化、段階的移行、負荷テスト |
| ダウンタイム | 中 | オフピーク時の移行、並行運用期間の設定 |
| スキーマ不整合 | 中 | 事前のスキーマ検証、マッピングテストの実施 |
| リソース不足 | 低 | 事前のリソース見積もり、スケーリング計画 |

## タイムライン

| フェーズ | 予定期間 | 担当者 |
|---------|----------|--------|
| 準備 | 1週間 | ベクトルストアチーム |
| データ抽出 | 3日間 | データエンジニア |
| データ変換 | 2日間 | データエンジニア |
| データロード | 1-2日間 | インフラチーム |
| 検証 | 2-3日間 | QAチーム |
| 切り替え | 1日間 | インフラチーム + 開発チーム |
| 最適化 | 1週間 | パフォーマンスチーム |

## 成功基準

1. **データ整合性**: 移行前後でのデータ数と内容の一致
2. **パフォーマンス**: 検索クエリの応答時間が現状より20%以上改善
3. **安定性**: 移行後24時間のシステム安定稼働
4. **スケーラビリティ**: 10倍のデータ量でも性能低下が10%以内

## 移行後の評価計画

1. **パフォーマンスモニタリング**: クエリ応答時間、CPU/メモリ使用率
2. **ユーザー体験評価**: 検索結果の関連性、応答時間の体感
3. **システム安定性**: エラー率、ダウンタイム
4. **コスト効率**: ストレージコスト、運用コストの変化

## 結論

PostgreSQLベースのベクトルストアへの移行は、HARCAプロジェクトの検索機能とスケーラビリティを大幅に向上させる重要なステップです。計画的な移行と徹底した検証により、リスクを最小限に抑えながら、システムの性能と信頼性を向上させることができます。
