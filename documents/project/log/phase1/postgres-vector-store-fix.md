# PostgreSQL ベクトルストア修正記録

## 日時
2025年3月25日

## 概要
HARCAプロジェクトにおけるPostgreSQL接続問題を診断し、VectorStoreクラスの修正を行いました。環境変数の不一致やテーブル構造の相違などの問題を特定し、接続の安定性と互換性を向上させました。

## 特定した問題

### 1. 環境変数の不一致
- VectorStoreクラスは`SUPABASE_CONNECTION_STRING`環境変数を使用
- Docker環境では`POSTGRES_CONNECTION_STRING`環境変数を定義
- `.env.example`では`HARCA_POSTGRES_CONNECTION_STRING`を定義

### 2. テーブル構造の不一致
- VectorStoreクラスは`code_vectors`テーブルを参照
- 初期化スクリプトでは`embeddings`テーブルを作成

### 3. 接続設定の問題
- PostgreSQLは3730ポートで実行されているが、設定が正しく反映されていない

## 実装した解決策

### 1. VectorStoreクラスの修正
- 複数の接続文字列環境変数をチェックするように変更
- 接続エラーの堅牢なハンドリングを追加
- テーブル存在確認と適切なテーブル選択ロジックを実装

### 2. .env.exampleの更新
- Docker環境変数との整合性を確保
- 複数の接続文字列オプションを提供
- ポート番号を3730に統一

### 3. 診断スクリプトの作成
- PostgreSQL接続状態確認用スクリプト
- テーブル構造とレコード数の確認機能

### 4. テストスクリプトの作成と実行
- VectorStoreクラスの機能テスト
- サンプルコードのインデックス化と検索テスト
- タイムアウト処理とエラーハンドリングの実装

## 診断結果
- PostgreSQLサーバーは正常に動作（ポート3730）
- pgvector拡張がインストール済み
- `embeddings`テーブルと`code_vectors`テーブルが存在
- `code_vectors`テーブルには5件のレコード

## トラブルシューティング知識の保存
- PostgreSQL接続問題の診断と解決策をJSON形式で保存
- 構造化されたデータとして検索可能な形式で記録
- 将来的に同様の問題が発生した場合の参照資料として活用可能

## 今後の課題
1. ファイルベースのストレージからPostgreSQLへの完全移行
2. テーブル構造の統一（`embeddings`と`code_vectors`の統合または明確な役割分担）
3. 埋め込みモデルの選択と設定の最適化
4. キャッシュ戦略の改善（Redis、メモリ、ファイルの適切な組み合わせ）

## 参考コード

### PostgreSQL接続設定の例
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
