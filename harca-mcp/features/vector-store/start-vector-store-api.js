/**
 * HARCA ベクトルストアAPIサーバー起動スクリプト
 */

const path = require('path');
const { VectorStoreAPI } = require('./vector-store-api');

// 環境変数のデフォルト値
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.CACHE_TTL = process.env.CACHE_TTL || '3600';
process.env.CACHE_PREFIX = process.env.CACHE_PREFIX || 'harca:embedding:';
process.env.ENABLE_MEMORY_CACHE = process.env.ENABLE_MEMORY_CACHE || 'true';
process.env.MEMORY_CACHE_MAX_ITEMS = process.env.MEMORY_CACHE_MAX_ITEMS || '1000';
process.env.ENABLE_REDIS_CACHE = process.env.ENABLE_REDIS_CACHE || 'true';
process.env.ENABLE_FILE_CACHE = process.env.ENABLE_FILE_CACHE || 'true';
process.env.FILE_CACHE_DIR = process.env.FILE_CACHE_DIR || path.join(__dirname, '.cache', 'api-embeddings');
process.env.ENABLE_PREFETCH = process.env.ENABLE_PREFETCH || 'true';
process.env.PREFETCH_THRESHOLD = process.env.PREFETCH_THRESHOLD || '0.7';
process.env.PREFETCH_MAX_ITEMS = process.env.PREFETCH_MAX_ITEMS || '5';
process.env.ENABLE_CACHE_COMPRESSION = process.env.ENABLE_CACHE_COMPRESSION || 'true';
process.env.CACHE_COMPRESSION_LEVEL = process.env.CACHE_COMPRESSION_LEVEL || '6';
process.env.CACHE_COMPRESSION_THRESHOLD = process.env.CACHE_COMPRESSION_THRESHOLD || '100';
process.env.VECTOR_STORE_API_PORT = process.env.VECTOR_STORE_API_PORT || '3701'; // HARCA標準ポート設定に準拠
process.env.DEFAULT_EMBEDDING_MODEL = process.env.DEFAULT_EMBEDDING_MODEL || 'text-embedding-ada-002';

// APIサーバーの初期化と起動
const api = new VectorStoreAPI({
  port: process.env.VECTOR_STORE_API_PORT,
  redisUrl: process.env.REDIS_URL,
  cacheTTL: parseInt(process.env.CACHE_TTL, 10),
  cachePrefix: process.env.CACHE_PREFIX,
  enableMemoryCache: process.env.ENABLE_MEMORY_CACHE === 'true',
  memoryCacheMaxItems: parseInt(process.env.MEMORY_CACHE_MAX_ITEMS, 10),
  enableRedisCache: process.env.ENABLE_REDIS_CACHE === 'true',
  enableFileCache: process.env.ENABLE_FILE_CACHE === 'true',
  fileCacheDir: process.env.FILE_CACHE_DIR,
  enablePrefetch: process.env.ENABLE_PREFETCH === 'true',
  prefetchThreshold: parseFloat(process.env.PREFETCH_THRESHOLD),
  prefetchMaxItems: parseInt(process.env.PREFETCH_MAX_ITEMS, 10),
  enableCacheCompression: process.env.ENABLE_CACHE_COMPRESSION === 'true',
  cacheCompressionLevel: parseInt(process.env.CACHE_COMPRESSION_LEVEL, 10),
  cacheCompressionThreshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD, 10)
});

// サーバー起動
api.start().catch(err => {
  console.error('APIサーバー起動エラー:', err);
  process.exit(1);
});

// プロセス終了時の処理
process.on('SIGINT', async () => {
  console.log('SIGINTを受信しました。サーバーを停止します...');
  await api.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERMを受信しました。サーバーを停止します...');
  await api.stop();
  process.exit(0);
});

console.log(`ベクトルストアAPIサーバーを起動しています...（ポート: ${process.env.VECTOR_STORE_API_PORT}）`);
