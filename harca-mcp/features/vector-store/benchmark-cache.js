/**
 * 分散キャッシュのパフォーマンスベンチマークスクリプト
 * 
 * このスクリプトは、分散キャッシュのパフォーマンスを測定し、結果をレポートします。
 * 以下の項目を測定します：
 * - 書き込み速度（セット操作）
 * - 読み取り速度（ゲット操作）
 * - キャッシュヒット率
 * - メモリ使用量
 * - Redis同期の遅延
 */

const { EmbeddingCache } = require('./embedding-cache');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 結果保存用ディレクトリ
const RESULTS_DIR = path.join(__dirname, 'benchmark-results');
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// ベンチマーク設定
const config = {
  testDataSize: 1000,        // テストデータのサイズ
  embeddingDimension: 384,   // 埋め込みベクトルの次元
  iterations: 3,             // 繰り返し回数
  modelNames: ['test-model-1', 'test-model-2', 'test-model-3'],
  cacheConfigs: [
    {
      name: 'メモリキャッシュのみ',
      config: {
        enableMemoryCache: true,
        enableRedisCache: false,
        enableFileCache: false,
        cacheDir: path.join(__dirname, '.cache/benchmark/memory')
      }
    },
    {
      name: 'Redisキャッシュのみ',
      config: {
        enableMemoryCache: false,
        enableRedisCache: true,
        enableFileCache: false,
        cacheDir: path.join(__dirname, '.cache/benchmark/redis')
      }
    },
    {
      name: 'ファイルキャッシュのみ',
      config: {
        enableMemoryCache: false,
        enableRedisCache: false,
        enableFileCache: true,
        cacheDir: path.join(__dirname, '.cache/benchmark/file')
      }
    },
    {
      name: '階層型キャッシュ（すべて有効）',
      config: {
        enableMemoryCache: true,
        enableRedisCache: true,
        enableFileCache: true,
        cacheDir: path.join(__dirname, '.cache/benchmark/hierarchical')
      }
    }
  ]
};

/**
 * ランダムな埋め込みベクトルを生成
 * @param {number} dimension ベクトルの次元
 * @returns {number[]} 埋め込みベクトル
 */
function generateRandomEmbedding(dimension) {
  return Array(dimension).fill(0).map(() => Math.random() * 2 - 1);
}

/**
 * ランダムなテキストを生成
 * @param {number} length テキストの長さ
 * @returns {string} ランダムなテキスト
 */
function generateRandomText(length = 50) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * テストデータを生成
 * @param {number} size データサイズ
 * @param {number} dimension 埋め込みベクトルの次元
 * @param {string[]} modelNames モデル名の配列
 * @returns {Array<{text: string, embedding: number[], modelName: string}>} テストデータ
 */
function generateTestData(size, dimension, modelNames) {
  const data = [];
  for (let i = 0; i < size; i++) {
    const modelName = modelNames[i % modelNames.length];
    data.push({
      text: generateRandomText(),
      embedding: generateRandomEmbedding(dimension),
      modelName
    });
  }
  return data;
}

/**
 * 時間を測定する関数
 * @param {Function} fn 測定する関数
 * @returns {Promise<{result: any, time: number}>} 結果と実行時間（ミリ秒）
 */
async function measureTime(fn) {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const time = Number(end - start) / 1000000; // ナノ秒からミリ秒に変換
  return { result, time };
}

/**
 * キャッシュの書き込みパフォーマンスをテスト
 * @param {EmbeddingCache} cache キャッシュインスタンス
 * @param {Array} testData テストデータ
 * @returns {Promise<{totalTime: number, operationsPerSecond: number}>} テスト結果
 */
async function testWritePerformance(cache, testData) {
  const results = [];
  
  for (const item of testData) {
    const { time } = await measureTime(async () => {
      return await cache.set(item.text, item.embedding, item.modelName);
    });
    results.push(time);
  }
  
  const totalTime = results.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / results.length;
  const operationsPerSecond = 1000 / averageTime;
  
  return {
    totalTime,
    averageTime,
    operationsPerSecond,
    operations: results.length
  };
}

/**
 * キャッシュの読み取りパフォーマンスをテスト
 * @param {EmbeddingCache} cache キャッシュインスタンス
 * @param {Array} testData テストデータ
 * @returns {Promise<{totalTime: number, operationsPerSecond: number, hitRate: number}>} テスト結果
 */
async function testReadPerformance(cache, testData) {
  const results = [];
  let hits = 0;
  
  for (const item of testData) {
    const { result, time } = await measureTime(async () => {
      return await cache.get(item.text, item.modelName);
    });
    
    if (result) {
      hits++;
    }
    
    results.push(time);
  }
  
  const totalTime = results.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / results.length;
  const operationsPerSecond = 1000 / averageTime;
  const hitRate = hits / results.length;
  
  return {
    totalTime,
    averageTime,
    operationsPerSecond,
    operations: results.length,
    hits,
    hitRate
  };
}

/**
 * 分散キャッシュの同期遅延をテスト
 * @param {EmbeddingCache} cache1 キャッシュインスタンス1
 * @param {EmbeddingCache} cache2 キャッシュインスタンス2
 * @param {Array} testData テストデータ
 * @returns {Promise<{syncDelay: number, syncRate: number}>} テスト結果
 */
async function testSyncDelay(cache1, cache2, testData) {
  const sampleSize = Math.min(20, testData.length);
  const samples = testData.slice(0, sampleSize);
  const delays = [];
  let syncCount = 0;
  
  for (const item of samples) {
    // cache1にデータを設定
    await cache1.set(item.text, item.embedding, item.modelName);
    
    // 同期の遅延を測定
    const start = process.hrtime.bigint();
    let synced = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!synced && attempts < maxAttempts) {
      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // cache2からデータを取得
      const result = await cache2.get(item.text, item.modelName);
      if (result) {
        synced = true;
        syncCount++;
        const end = process.hrtime.bigint();
        const delay = Number(end - start) / 1000000; // ナノ秒からミリ秒に変換
        delays.push(delay);
      }
      
      attempts++;
    }
    
    if (!synced) {
      console.log(`同期失敗: ${item.text} (${item.modelName})`);
    }
  }
  
  const averageDelay = delays.length > 0 ? 
    delays.reduce((sum, delay) => sum + delay, 0) / delays.length : 
    Infinity;
  
  const syncRate = syncCount / sampleSize;
  
  return {
    averageDelay,
    syncRate,
    samples: sampleSize,
    syncedSamples: syncCount
  };
}

/**
 * ベンチマークを実行
 */
async function runBenchmark() {
  console.log('分散キャッシュのパフォーマンスベンチマークを開始します...');
  
  const results = {
    timestamp: new Date().toISOString(),
    config: config,
    benchmarks: []
  };
  
  // テストデータを生成
  console.log(`${config.testDataSize}件のテストデータを生成しています...`);
  const testData = generateTestData(
    config.testDataSize,
    config.embeddingDimension,
    config.modelNames
  );
  
  // 各キャッシュ設定でベンチマークを実行
  for (const cacheConfig of config.cacheConfigs) {
    console.log(`\n[${cacheConfig.name}] のベンチマークを実行中...`);
    
    const benchmarkResults = {
      name: cacheConfig.name,
      iterations: [],
      average: {}
    };
    
    // 複数回の繰り返しでベンチマークを実行
    for (let i = 0; i < config.iterations; i++) {
      console.log(`  イテレーション ${i + 1}/${config.iterations}`);
      
      // キャッシュインスタンスを作成
      const cache1 = new EmbeddingCache({
        ...cacheConfig.config,
        enableDetailedStats: true
      });
      
      const cache2 = cacheConfig.config.enableRedisCache ? 
        new EmbeddingCache({
          ...cacheConfig.config,
          cacheDir: `${cacheConfig.config.cacheDir}_instance2`,
          enableDetailedStats: true
        }) : null;
      
      // キャッシュをクリア
      await cache1.clear();
      if (cache2) {
        await cache2.clear();
      }
      
      // 書き込みパフォーマンスをテスト
      console.log('  書き込みパフォーマンスをテスト中...');
      const writeResults = await testWritePerformance(cache1, testData);
      console.log(`    平均書き込み時間: ${writeResults.averageTime.toFixed(2)}ms`);
      console.log(`    書き込み操作/秒: ${writeResults.operationsPerSecond.toFixed(2)}`);
      
      // 読み取りパフォーマンスをテスト
      console.log('  読み取りパフォーマンスをテスト中...');
      const readResults = await testReadPerformance(cache1, testData);
      console.log(`    平均読み取り時間: ${readResults.averageTime.toFixed(2)}ms`);
      console.log(`    読み取り操作/秒: ${readResults.operationsPerSecond.toFixed(2)}`);
      console.log(`    ヒット率: ${(readResults.hitRate * 100).toFixed(2)}%`);
      
      // 同期遅延をテスト（Redisキャッシュが有効な場合のみ）
      let syncResults = null;
      if (cacheConfig.config.enableRedisCache && cache2) {
        console.log('  同期遅延をテスト中...');
        syncResults = await testSyncDelay(cache1, cache2, testData);
        console.log(`    平均同期遅延: ${syncResults.averageDelay.toFixed(2)}ms`);
        console.log(`    同期成功率: ${(syncResults.syncRate * 100).toFixed(2)}%`);
      }
      
      // キャッシュ統計を取得
      const stats = await cache1.getStats();
      
      // パフォーマンス分析を実行
      const analysis = await cache1.analyzePerformance();
      
      // リソースを解放
      await cache1.close();
      if (cache2) {
        await cache2.close();
      }
      
      // 結果を保存
      benchmarkResults.iterations.push({
        write: writeResults,
        read: readResults,
        sync: syncResults,
        stats: stats,
        analysis: analysis
      });
    }
    
    // 平均値を計算
    const avgWrite = {
      averageTime: benchmarkResults.iterations.reduce((sum, iter) => sum + iter.write.averageTime, 0) / config.iterations,
      operationsPerSecond: benchmarkResults.iterations.reduce((sum, iter) => sum + iter.write.operationsPerSecond, 0) / config.iterations
    };
    
    const avgRead = {
      averageTime: benchmarkResults.iterations.reduce((sum, iter) => sum + iter.read.averageTime, 0) / config.iterations,
      operationsPerSecond: benchmarkResults.iterations.reduce((sum, iter) => sum + iter.read.operationsPerSecond, 0) / config.iterations,
      hitRate: benchmarkResults.iterations.reduce((sum, iter) => sum + iter.read.hitRate, 0) / config.iterations
    };
    
    let avgSync = null;
    if (benchmarkResults.iterations[0].sync) {
      avgSync = {
        averageDelay: benchmarkResults.iterations.reduce((sum, iter) => sum + iter.sync.averageDelay, 0) / config.iterations,
        syncRate: benchmarkResults.iterations.reduce((sum, iter) => sum + iter.sync.syncRate, 0) / config.iterations
      };
    }
    
    benchmarkResults.average = {
      write: avgWrite,
      read: avgRead,
      sync: avgSync
    };
    
    // 結果を表示
    console.log(`\n[${cacheConfig.name}] の平均結果:`);
    console.log(`  平均書き込み時間: ${avgWrite.averageTime.toFixed(2)}ms`);
    console.log(`  平均書き込み操作/秒: ${avgWrite.operationsPerSecond.toFixed(2)}`);
    console.log(`  平均読み取り時間: ${avgRead.averageTime.toFixed(2)}ms`);
    console.log(`  平均読み取り操作/秒: ${avgRead.operationsPerSecond.toFixed(2)}`);
    console.log(`  平均ヒット率: ${(avgRead.hitRate * 100).toFixed(2)}%`);
    
    if (avgSync) {
      console.log(`  平均同期遅延: ${avgSync.averageDelay.toFixed(2)}ms`);
      console.log(`  平均同期成功率: ${(avgSync.syncRate * 100).toFixed(2)}%`);
    }
    
    results.benchmarks.push(benchmarkResults);
  }
  
  // 結果をファイルに保存
  const resultFile = path.join(RESULTS_DIR, `benchmark-${new Date().toISOString().replace(/:/g, '-')}.json`);
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(`\nベンチマーク結果を保存しました: ${resultFile}`);
}

// ベンチマークを実行
runBenchmark().catch(err => {
  console.error('ベンチマーク実行中にエラーが発生しました:', err);
});
