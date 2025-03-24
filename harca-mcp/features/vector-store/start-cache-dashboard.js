/**
 * キャッシュダッシュボードを起動するためのスクリプト
 */
const { CacheDashboard } = require('./cache-dashboard');
const { EmbeddingCache } = require('./embedding-cache');
const path = require('path');

// 環境変数のデフォルト値
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.CACHE_TTL = process.env.CACHE_TTL || '3600';
process.env.CACHE_PREFIX = process.env.CACHE_PREFIX || 'harca:embedding:';
process.env.ENABLE_MEMORY_CACHE = process.env.ENABLE_MEMORY_CACHE || 'true';
process.env.MEMORY_CACHE_MAX_ITEMS = process.env.MEMORY_CACHE_MAX_ITEMS || '1000';
process.env.ENABLE_REDIS_CACHE = process.env.ENABLE_REDIS_CACHE || 'true';
process.env.ENABLE_FILE_CACHE = process.env.ENABLE_FILE_CACHE || 'true';
process.env.FILE_CACHE_DIR = process.env.FILE_CACHE_DIR || path.join(__dirname, '.cache', 'dashboard');
process.env.ENABLE_CACHE_COMPRESSION = process.env.ENABLE_CACHE_COMPRESSION || 'true';
process.env.CACHE_COMPRESSION_LEVEL = process.env.CACHE_COMPRESSION_LEVEL || '6';
process.env.CACHE_COMPRESSION_THRESHOLD = process.env.CACHE_COMPRESSION_THRESHOLD || '100';
process.env.CACHE_DASHBOARD_PORT = process.env.CACHE_DASHBOARD_PORT || '3700'; // HARCA標準ポート設定に準拠

// キャッシュインスタンスの作成
const cache = new EmbeddingCache({
  enableMemoryCache: process.env.ENABLE_MEMORY_CACHE === 'true',
  memoryCacheMaxItems: parseInt(process.env.MEMORY_CACHE_MAX_ITEMS, 10),
  enableRedisCache: process.env.ENABLE_REDIS_CACHE === 'true',
  redisUrl: process.env.REDIS_URL,
  cacheTTL: parseInt(process.env.CACHE_TTL, 10),
  cachePrefix: process.env.CACHE_PREFIX,
  enableFileCache: process.env.ENABLE_FILE_CACHE === 'true',
  fileCacheDir: process.env.FILE_CACHE_DIR,
  enableCompression: process.env.ENABLE_CACHE_COMPRESSION === 'true',
  compressionLevel: parseInt(process.env.CACHE_COMPRESSION_LEVEL, 10),
  compressionThreshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD, 10)
});

// キャッシュダッシュボードの起動
const dashboard = new CacheDashboard(cache, {
  port: process.env.CACHE_DASHBOARD_PORT || 3700,
  updateInterval: process.env.CACHE_DASHBOARD_UPDATE_INTERVAL || 60000 // 1分ごとに更新
});

// テスト用のデータを生成
async function generateTestData() {
  console.log('テスト用のデータを生成しています...');
  
  // テスト用のデータ（大きなサイズのデータを含む）
  const testData = [
    { key: 'test:1', value: { text: 'これは小さなテストデータです。', vector: Array(5).fill(0.1) } },
    { key: 'test:2', value: { text: 'これは中程度のテストデータです。'.repeat(10), vector: Array(10).fill(0.2) } },
    { key: 'test:3', value: { text: 'これは大きなテストデータです。'.repeat(50), vector: Array(20).fill(0.3) } },
    { key: 'test:4', value: { text: 'これは非常に大きなテストデータです。'.repeat(100), vector: Array(50).fill(0.4) } },
    { key: 'test:5', value: { text: 'これは圧縮に適したテストデータです。'.repeat(200), vector: Array(100).fill(0.5) } }
  ];
  
  // データをキャッシュに保存
  for (const item of testData) {
    await cache.set(item.key, item.value);
    console.log(`キャッシュに保存: ${item.key}`);
    
    // 少し待機して、時系列データが分散するようにする
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // いくつかのキーに対してgetを実行してヒット率を生成
    if (Math.random() > 0.3) {
      await cache.get(item.key);
      console.log(`キャッシュから取得: ${item.key}`);
    }
  }
  
  console.log('テストデータの生成が完了しました');
}

// ダッシュボードの起動
dashboard.start().then(() => {
  console.log(`キャッシュダッシュボードを起動しました: http://localhost:${dashboard.port}`);
  
  // テストデータを生成（オプション）
  if (process.env.GENERATE_TEST_DATA === 'true') {
    generateTestData();
  }
}).catch(err => {
  console.error('キャッシュダッシュボードの起動に失敗しました:', err);
});

// プロセス終了時のクリーンアップ
process.on('SIGINT', async () => {
  console.log('キャッシュダッシュボードを終了しています...');
  await cache.close();
  process.exit(0);
});
