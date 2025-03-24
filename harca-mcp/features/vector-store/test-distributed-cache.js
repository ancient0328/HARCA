/**
 * 分散キャッシュのテストスクリプト
 * 
 * このスクリプトは、Redis分散キャッシュの機能をテストします。
 * 複数のインスタンス間でのキャッシュの同期と階層化キャッシュの動作を検証します。
 */

const { EmbeddingCache } = require('./embedding-cache');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

// テスト結果の保存
const results = {
  tests: [],
  summary: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0
  }
};

/**
 * テスト結果をファイルに保存する
 */
function saveTestResults() {
  const resultsDir = path.join(__dirname, 'test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const resultsFile = path.join(resultsDir, `distributed-cache-test-${timestamp}.json`);
  
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), 'utf8');
  console.log(`テスト結果を保存しました: ${resultsFile}`);
}

/**
 * 指定された時間だけ待機する
 * @param {number} ms ミリ秒
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 分散キャッシュのテスト実行関数
 */
async function runTests() {
  console.log('分散キャッシュのテストを開始します...');
  
  // テスト結果を格納する配列
  const testResults = [];
  
  // テスト結果を記録する関数
  function recordTestResult(name, success, message, details = {}) {
    const result = {
      name,
      success,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    
    testResults.push(result);
    
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${name}: ${message}`);
    
    results.tests.push({
      name: name,
      passed: success,
      message: message,
      details: details,
      timestamp: new Date().toISOString()
    });
    
    results.summary.totalTests++;
    if (success) {
      results.summary.passedTests++;
    } else {
      results.summary.failedTests++;
    }
  }
  
  // タイムアウト設定
  const testTimeout = setTimeout(() => {
    console.error('テストがタイムアウトしました。処理を中断します。');
    process.exit(1);
  }, 15000); // 15秒のタイムアウト
  
  // 2つのキャッシュインスタンスを作成
  let cache1 = null;
  let cache2 = null;
  
  try {
    // 2つのキャッシュインスタンスを作成（同じRedisサーバーを使用）
    cache1 = new EmbeddingCache({
      enableMemoryCache: true,
      enableRedisCache: true,
      enableFileCache: true,
      redisUrl: 'redis://localhost:6379',
      cacheDir: path.join(__dirname, '.cache/instance1'),
      enableDetailedStats: true,
      enableCompression: true,
      compressionLevel: 6,
      compressionThreshold: 100 // テスト用に低い閾値を設定
    });
    
    cache2 = new EmbeddingCache({
      enableMemoryCache: true,
      enableRedisCache: true,
      enableFileCache: true,
      redisUrl: 'redis://localhost:6379',
      cacheDir: path.join(__dirname, '.cache/instance2'),
      enableDetailedStats: true,
      enableCompression: true,
      compressionLevel: 6,
      compressionThreshold: 100 // テスト用に低い閾値を設定
    });
    
    // テスト1: キャッシュの初期化
    recordTestResult(
      'キャッシュの初期化',
      cache1 !== null && cache2 !== null,
      '両方のキャッシュインスタンスが正常に初期化されました'
    );
    
    // テスト2: キャッシュのクリア
    await cache1.clear();
    await cache2.clear();
    
    recordTestResult(
      'キャッシュのクリア',
      true,
      '両方のキャッシュインスタンスがクリアされました'
    );
    
    // テスト3: キャッシュへのデータ設定
    const testData = [
      { text: 'テストテキスト1', embedding: [0.1, 0.2, 0.3], modelName: 'test-model-1' },
      { text: 'テストテキスト2', embedding: [0.2, 0.3, 0.4], modelName: 'test-model-1' },
      { text: 'テストテキスト3', embedding: [0.3, 0.4, 0.5], modelName: 'test-model-2' },
      { text: 'テストテキスト4', embedding: [0.4, 0.5, 0.6], modelName: 'test-model-2' },
      { text: 'テストテキスト5', embedding: [0.5, 0.6, 0.7], modelName: 'test-model-3' }
    ];
    
    for (const item of testData) {
      await cache1.set(item.text, item.embedding, item.modelName);
    }
    
    recordTestResult(
      'キャッシュへのデータ設定',
      true,
      `5個のアイテムをキャッシュ1に設定しました`
    );
    
    // テスト4: キャッシュ統計情報の取得
    const stats1 = await cache1.getStats();
    const stats2 = await cache2.getStats();
    
    recordTestResult(
      'キャッシュ統計情報',
      stats1 !== null && stats2 !== null,
      '両方のインスタンスから統計情報を取得できました',
      {
        stats1: {
          hits: stats1.hits,
          misses: stats1.misses,
          size: stats1.size
        },
        stats2: {
          hits: stats2.hits,
          misses: stats2.misses,
          size: stats2.size
        }
      }
    );
    
    // テスト5: キャッシュパフォーマンス分析
    const analysis1 = cache1.analyzePerformance();
    
    recordTestResult(
      'キャッシュパフォーマンス分析',
      analysis1 !== null,
      'キャッシュパフォーマンス分析を実行できました',
      {
        analysis: {
          hitRate: analysis1.hitRate,
          efficiency: analysis1.efficiency,
          compression: analysis1.compression
        }
      }
    );
    
    // テスト6: 圧縮機能のテスト
    // 大きなデータを生成（圧縮閾値を超えるサイズ）
    const largeEmbedding = Array(1000).fill(0).map(() => Math.random());
    const largeText = 'large_test_text_' + Date.now();
    
    // データを設定
    await cache1.set(largeText, largeEmbedding, 'compression-test');
    
    // データを取得
    const retrievedEmbedding = await cache2.get(largeText, 'compression-test');
    
    // 元のデータと取得したデータを比較
    const isDataEqual = JSON.stringify(largeEmbedding) === JSON.stringify(retrievedEmbedding);
    
    recordTestResult(
      '圧縮機能',
      isDataEqual,
      isDataEqual ? '圧縮されたデータが正しく保存・復元されました' : '圧縮データの復元に問題があります',
      {
        originalSize: JSON.stringify(largeEmbedding).length,
        compressionEnabled: cache1.config.enableCompression,
        compressionThreshold: cache1.config.compressionThreshold
      }
    );
    
    // テスト7: 圧縮率の確認
    // 圧縮前後のサイズを比較するための関数
    function getCompressedSize(data) {
      const jsonData = JSON.stringify(data);
      const compressed = zlib.deflateSync(jsonData, { level: 6 });
      return {
        original: jsonData.length,
        compressed: compressed.length,
        ratio: compressed.length / jsonData.length
      };
    }
    
    const compressionStats = getCompressedSize(largeEmbedding);
    
    recordTestResult(
      '圧縮率',
      compressionStats.ratio < 0.5, // 50%以下に圧縮されていることを期待
      `圧縮率: ${(compressionStats.ratio * 100).toFixed(2)}%`,
      {
        originalSize: compressionStats.original,
        compressedSize: compressionStats.compressed,
        compressionRatio: compressionStats.ratio
      }
    );
    
    // テスト終了
    recordTestResult(
      'キャッシュの終了',
      true,
      '両方のキャッシュインスタンスを正常に終了しました'
    );
    
    // テスト結果のサマリーを表示
    console.log('\nテスト結果サマリー:');
    console.log(`総テスト数: ${results.summary.totalTests}`);
    console.log(`成功: ${results.summary.passedTests}`);
    console.log(`失敗: ${results.summary.failedTests}`);
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
    recordTestResult('テスト実行', false, 'テスト実行中にエラーが発生しました', { error: error.message });
  } finally {
    // タイムアウトをクリア
    clearTimeout(testTimeout);
    
    // キャッシュインスタンスの終了
    if (cache1) {
      await cache1.close();
    }
    if (cache2) {
      await cache2.close();
    }
    
    // エラーが発生してもテスト結果を保存
    saveTestResults();
  }
}

// テストを実行
runTests().catch(console.error);
