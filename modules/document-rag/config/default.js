/**
 * Document RAG モジュールのデフォルト設定
 */
const path = require('path');

// プロジェクトルートディレクトリの取得
const HARCA_ROOT = process.env.HARCA_ROOT || (() => {
  const rootPath = path.resolve(__dirname, '../../..');
  console.log(`HARCA_ROOT環境変数が設定されていません。デフォルト値を使用します: ${rootPath}`);
  return rootPath;
})();
const MODULE_ROOT = path.resolve(__dirname, '..');

module.exports = {
  // ドキュメント処理設定
  document: {
    // ドキュメントのソースディレクトリ（プロジェクトルートからの相対パス）
    sourceDir: path.join(HARCA_ROOT, 'docs'),
    
    // 対応するファイル形式
    supportedFormats: ['md', 'txt'],
    
    // チャンク設定
    chunkSize: 1000,
    chunkOverlap: 200,
    
    // メタデータ抽出設定
    extractMetadata: true,
    metadataFields: ['title', 'date', 'tags', 'category']
  },
  
  // ベクトル保存設定
  vectorStore: {
    // 名前空間（PostgreSQLのスキーマ名）
    namespace: 'document_vectors',
    
    // テーブル名
    tableName: 'document_embeddings',
    
    // インデックス設定
    createIndex: true,
    indexType: 'ivfflat',  // 'ivfflat' または 'hnsw'
    
    // 検索設定
    defaultTopK: 5,
    minScore: 0.7
  },
  
  // 埋め込みモデル設定
  embedding: {
    // 使用するモデル
    model: 'text-embedding-3-small',
    
    // フォールバックモデル（メインが利用できない場合）
    fallbackModel: 'text-embedding-ada-002',
    
    // 次元数
    dimensions: 1536
  },
  
  // キャッシュ設定
  cache: {
    // キャッシュプレフィックス
    prefix: 'harca:docs:embedding:',
    
    // TTL（秒）
    ttl: 86400 * 7,  // 7日間
    
    // キャッシュレベル
    useMemoryCache: true,
    useRedisCache: true,
    useFileCache: true,
    
    // ファイルキャッシュディレクトリ
    fileCacheDir: path.join(MODULE_ROOT, '.cache')
  },
  
  // 処理制限設定
  processing: {
    // 同時処理数の上限
    maxConcurrentProcessing: 2,
    
    // 処理間隔（ミリ秒）
    processingInterval: 100,
    
    // 一度に処理する最大ドキュメント数
    maxBatchSize: 10
  },
  
  // スケジュール設定
  schedule: {
    // 自動更新の有効化
    enableAutoUpdate: true,
    
    // 自動更新の時間（cron形式）
    updateCron: '0 3 * * *',  // 毎日3:00 AM
    
    // 最終更新時のタイムスタンプを保存するファイル
    lastUpdateFile: path.join(MODULE_ROOT, '.last_update')
  },
  
  // ログ設定
  logging: {
    // ログレベル
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    
    // ログファイル
    file: path.join(MODULE_ROOT, 'logs/document-rag.log'),
    
    // コンソールへの出力
    console: true
  }
};
