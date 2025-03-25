# プロジェクト実装記録: PostgreSQL接続問題の解決とVectorStore機能の復旧

## 実装日
2025年3月25日

## 担当者
HARCA開発チーム

## 概要
HARCAプロジェクトにおけるPostgreSQL接続問題を診断し、VectorStoreクラスの修正を行った。環境変数の不一致やテーブル構造の相違などの問題を特定し、接続の安定性と互換性を向上させた。これにより、ベクトルストア機能が正常に動作するようになり、埋め込み生成とデータインデックス化が可能になった。

## 背景と目的
ベクトルストア機能が正常に動作せず、PostgreSQL接続エラーが発生していた。この問題を解決し、埋め込み生成とデータインデックス化機能を復旧させることが目的である。また、トラブルシューティングの知識を保存し、将来の参照に役立てることも目指した。

## 実装内容

### 1. 問題の診断
- 環境変数の不一致（`SUPABASE_CONNECTION_STRING`、`POSTGRES_CONNECTION_STRING`、`HARCA_POSTGRES_CONNECTION_STRING`）
- テーブル構造の不一致（`code_vectors`テーブルと`embeddings`テーブル）
- 接続設定の問題（ポート3730の設定が正しく反映されていない）

### 2. VectorStoreクラスの修正
```javascript
// PostgreSQL接続設定
try {
  // 複数の可能性のある接続文字列環境変数をチェック
  const connectionString = 
    process.env.POSTGRES_CONNECTION_STRING || 
    process.env.HARCA_POSTGRES_CONNECTION_STRING || 
    process.env.SUPABASE_CONNECTION_STRING;
  
  if (!connectionString) {
    throw new Error('PostgreSQL接続文字列が設定されていません');
  }
  
  console.log('PostgreSQL接続を初期化します...');
  this.pool = new Pool({ connectionString });
  
  // 接続テスト
  this.testConnection();
} catch (error) {
  console.error('PostgreSQL接続の初期化に失敗しました:', error.message);
  console.warn('ベクトルストアの機能は制限されます');
  this.pool = null;
}
```

### 3. 環境変数設定の統一
- `.env.example`ファイルを更新し、Docker環境変数との整合性を確保
- 複数の接続文字列オプションを提供
- ポート番号を3730に統一

### 4. 診断スクリプトの作成
- PostgreSQL接続状態確認用スクリプト（`check-postgres-connection.js`）を作成
- テーブル構造とレコード数の確認機能を実装

### 5. テストスクリプトの作成
- VectorStoreクラスの機能テスト用スクリプト（`test-vector-store.js`）を作成
- サンプルコードのインデックス化と検索テスト機能を実装
- タイムアウト処理とエラーハンドリングを追加

### 6. トラブルシューティング知識の保存
- PostgreSQL接続問題の診断と解決策をJSON形式で保存するスクリプト（`save-postgres-knowledge.js`）を作成
- 構造化されたデータとして検索可能な形式で記録

## 技術的詳細

### 診断結果
- PostgreSQLサーバーは正常に動作（ポート3730）
- pgvector拡張がインストール済み
- `embeddings`テーブルと`code_vectors`テーブルが存在
- `code_vectors`テーブルには5件のレコード

### テーブル互換性の確保
```javascript
// テーブル存在確認
const tableExistsQuery = `
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'embeddings'
  );
`;

const tableExists = await this.pool.query(tableExistsQuery);

if (tableExists.rows[0].exists) {
  // embeddingsテーブルを使用
  const query = `
    INSERT INTO embeddings (content, embedding, metadata)
    VALUES ($1, $2::jsonb, $3::jsonb)
    RETURNING id
  `;
  
  const result = await this.pool.query(query, [content, JSON.stringify(embedding), metadataString]);
} else {
  // code_vectorsテーブルを使用（後方互換性のため）
  const query = `
    INSERT INTO code_vectors (content, embedding, metadata)
    VALUES ($1, $2::vector, $3::jsonb)
    RETURNING id
  `;
  
  const result = await this.pool.query(query, [content, vectorString, metadataString]);
}
```

### テスト実行時の問題と解決策
テストスクリプト実行時に以下の問題が発生し、解決した：
- プロセス終了処理の欠如：`process.exit(0)`を追加
- タイムアウト処理の欠如：`Promise.race()`を使用してタイムアウト処理を追加
- エラーハンドリングの不足：try-catchブロックを追加
- リソースのクリーンアップ不足：`cleanup()`メソッドを呼び出す処理を追加

## 成果と効果
- PostgreSQL接続が正常に機能するようになった
- VectorStoreクラスのテストが成功し、機能が復旧した
- 環境変数設定が統一され、Docker環境との整合性が確保された
- トラブルシューティング知識が保存され、将来の参照が容易になった

## 今後の課題と展望
1. ファイルベースのストレージからPostgreSQLへの完全移行
   - 既存のファイルベースデータの抽出
   - PostgreSQLへのデータインポート
   - 移行検証と整合性チェック
   
2. テーブル構造の最適化
   - `embeddings`と`code_vectors`テーブルの統合または役割分担の明確化
   - インデックス最適化
   - メタデータフィルタリングの改善

3. キャッシュ戦略の改善
   - Redis、メモリ、ファイルキャッシュの役割分担の最適化
   - キャッシュ無効化メカニズムの改善
   - キャッシュヒット率の監視と分析

## 参考資料
- [PostgreSQL公式ドキュメント](https://www.postgresql.org/docs/)
- [pgvector拡張ドキュメント](https://github.com/pgvector/pgvector)
- [Node.js pg モジュールドキュメント](https://node-postgres.com/)

## 関連ファイル
- `/harca-mcp/features/vector-store/index.js`
- `/harca-mcp/scripts/check-postgres-connection.js`
- `/harca-mcp/scripts/test-vector-store.js`
- `/harca-mcp/features/vector-store/save-postgres-knowledge.js`
- `/.env.example`
