/**
 * キャッシュパフォーマンステスト
 * 
 * このスクリプトは、EmbeddingCacheの最適化後のパフォーマンスを測定するためのものです。
 * 様々なシナリオでのキャッシュヒット率、レスポンス時間、メモリ使用量などを計測します。
 */

const fs = require('fs');
const path = require('path');
const { EmbeddingCache } = require('./embedding-cache');
const { performance } = require('perf_hooks');

// テスト用のサンプルデータ
const generateSampleData = (count) => {
  const samples = [];
  for (let i = 0; i < count; i++) {
    samples.push(`テストテキスト${i}: これはEmbeddingCacheのパフォーマンスを測定するためのサンプルテキストです。`);
  }
  return samples;
};

// テスト用のダミー埋め込みベクトル生成
const generateDummyEmbedding = (text) => {
  // テキストの長さに基づいて簡易的な埋め込みベクトルを生成
  const vector = [];
  for (let i = 0; i < 384; i++) {
    // テキストの文字コードを使用して疑似的なベクトルを生成
    const charSum = text.split('').reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
    vector.push(Math.sin(i * 0.1 + charSum * 0.01));
  }
  return vector;
};

// パフォーマンステスト実行関数
async function runPerformanceTest() {
  console.log('キャッシュパフォーマンステストを開始します...');
  
  // テスト設定
  const testConfig = {
    sampleCount: 1000,            // テストサンプル数
    repeatedQueries: 200,         // 繰り返しクエリ数
    randomQueries: 500,           // ランダムクエリ数
    prefetchThreshold: 0.85,      // プリフェッチしきい値
    maxPrefetchItems: 10,         // 最大プリフェッチアイテム数
    cacheDir: path.join(__dirname, 'test-cache'), // テスト用キャッシュディレクトリ
  };
  
  // テスト用キャッシュディレクトリの準備
  if (!fs.existsSync(testConfig.cacheDir)) {
    fs.mkdirSync(testConfig.cacheDir, { recursive: true });
  }
  
  // キャッシュインスタンスの作成
  const cache = new EmbeddingCache({
    cacheDir: testConfig.cacheDir,
    memoryLimit: 100 * 1024 * 1024, // 100MB
    fileLimit: 200 * 1024 * 1024,   // 200MB
    prefetchThreshold: testConfig.prefetchThreshold,
    maxPrefetchItems: testConfig.maxPrefetchItems,
    enableDetailedStats: true,
  });
  
  // サンプルデータの生成
  console.log(`${testConfig.sampleCount}個のサンプルデータを生成しています...`);
  const samples = generateSampleData(testConfig.sampleCount);
  
  // 1. 初期キャッシュ構築テスト
  console.log('\n1. 初期キャッシュ構築テスト');
  console.log('----------------------------');
  const startBuildTime = performance.now();
  
  for (let i = 0; i < samples.length; i++) {
    const text = samples[i];
    const embedding = generateDummyEmbedding(text);
    await cache.set(text, embedding, 'test-model');
    
    if (i % 100 === 0) {
      process.stdout.write(`${Math.round((i / samples.length) * 100)}% 完了...\r`);
    }
  }
  
  const endBuildTime = performance.now();
  console.log('100% 完了!                  ');
  console.log(`キャッシュ構築時間: ${((endBuildTime - startBuildTime) / 1000).toFixed(2)}秒`);
  console.log(`平均設定時間: ${((endBuildTime - startBuildTime) / samples.length).toFixed(2)}ミリ秒/アイテム`);
  
  // メモリ使用量の記録
  const memoryUsage = process.memoryUsage();
  console.log(`メモリ使用量: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB (ヒープ使用)`);
  
  // 2. キャッシュヒット率テスト（同一クエリの繰り返し）
  console.log('\n2. キャッシュヒット率テスト（同一クエリの繰り返し）');
  console.log('---------------------------------------------------');
  
  let totalHitTime = 0;
  let hits = 0;
  
  // 最初の数個のサンプルを繰り返しクエリ
  for (let i = 0; i < testConfig.repeatedQueries; i++) {
    const sampleIndex = i % 20; // 最初の20個のサンプルを繰り返し使用
    const text = samples[sampleIndex];
    
    const startQueryTime = performance.now();
    const result = await cache.get(text, 'test-model');
    const endQueryTime = performance.now();
    
    if (result) {
      hits++;
      totalHitTime += (endQueryTime - startQueryTime);
    }
    
    if (i % 50 === 0) {
      process.stdout.write(`${Math.round((i / testConfig.repeatedQueries) * 100)}% 完了...\r`);
    }
  }
  
  console.log('100% 完了!                  ');
  console.log(`ヒット率: ${((hits / testConfig.repeatedQueries) * 100).toFixed(2)}%`);
  console.log(`平均ヒット時間: ${(totalHitTime / hits).toFixed(2)}ミリ秒`);
  
  // 3. ランダムアクセスパターンテスト
  console.log('\n3. ランダムアクセスパターンテスト');
  console.log('--------------------------------');
  
  let randomHits = 0;
  let totalRandomTime = 0;
  
  for (let i = 0; i < testConfig.randomQueries; i++) {
    // ランダムなサンプルを選択（80%は既存データから、20%は新規データ）
    let text;
    if (Math.random() < 0.8) {
      const randomIndex = Math.floor(Math.random() * samples.length);
      text = samples[randomIndex];
    } else {
      // 新規データ
      text = `新規テキスト${i}: これは以前にキャッシュされていないランダムなテキストです。`;
    }
    
    const startRandomTime = performance.now();
    const result = await cache.get(text, 'test-model');
    const endRandomTime = performance.now();
    
    if (result) {
      randomHits++;
      totalRandomTime += (endRandomTime - startRandomTime);
    } else {
      // キャッシュミスの場合は、ダミー埋め込みを設定
      const embedding = generateDummyEmbedding(text);
      await cache.set(text, embedding, 'test-model');
    }
    
    if (i % 50 === 0) {
      process.stdout.write(`${Math.round((i / testConfig.randomQueries) * 100)}% 完了...\r`);
    }
  }
  
  console.log('100% 完了!                  ');
  console.log(`ランダムアクセスヒット率: ${((randomHits / testConfig.randomQueries) * 100).toFixed(2)}%`);
  if (randomHits > 0) {
    console.log(`平均ランダムヒット時間: ${(totalRandomTime / randomHits).toFixed(2)}ミリ秒`);
  }
  
  // 4. プリフェッチ効果テスト
  console.log('\n4. プリフェッチ効果テスト');
  console.log('------------------------');
  
  // 類似したテキストのグループを生成
  const similarGroups = [];
  for (let i = 0; i < 10; i++) {
    const baseText = `グループ${i}のベーステキスト: これは類似テキストグループのベースとなるテキストです。`;
    const group = [baseText];
    
    // 類似テキストを5つ追加
    for (let j = 1; j <= 5; j++) {
      group.push(`グループ${i}の類似テキスト${j}: これは${baseText.substring(10)}に似たテキストです。`);
    }
    
    similarGroups.push(group);
  }
  
  // 各グループのベーステキストをキャッシュに設定
  for (const group of similarGroups) {
    const baseText = group[0];
    const embedding = generateDummyEmbedding(baseText);
    await cache.set(baseText, embedding, 'test-model');
  }
  
  // 類似テキストのヒット率をテスト
  let prefetchHits = 0;
  const totalSimilarQueries = similarGroups.length * 5; // 各グループ5つの類似テキスト
  
  console.log('類似テキストのプリフェッチ効果をテストしています...');
  
  // 各グループのベーステキストにアクセスしてプリフェッチをトリガー
  for (const group of similarGroups) {
    const baseText = group[0];
    await cache.get(baseText, 'test-model');
    
    // 少し待機してプリフェッチが完了するのを待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 類似テキストのヒット率をチェック
    for (let i = 1; i < group.length; i++) {
      const similarText = group[i];
      const result = await cache.get(similarText, 'test-model');
      
      if (result) {
        prefetchHits++;
      }
    }
  }
  
  console.log(`プリフェッチ後の類似テキストヒット率: ${((prefetchHits / totalSimilarQueries) * 100).toFixed(2)}%`);
  
  // 5. キャッシュ分析レポート生成
  console.log('\n5. キャッシュ分析レポート');
  console.log('-----------------------');
  
  const report = cache.generatePerformanceReport();
  console.log(report);
  
  // 6. クリーンアップ
  console.log('\nテスト完了。キャッシュ統計情報:');
  console.log(`メモリキャッシュエントリ数: ${cache.getMemoryCacheSize()}`);
  console.log(`ファイルキャッシュエントリ数: ${cache.getFileCacheSize()}`);
  
  // テスト用キャッシュディレクトリの削除（オプション）
  // fs.rmSync(testConfig.cacheDir, { recursive: true, force: true });
  
  return {
    buildTime: (endBuildTime - startBuildTime) / 1000,
    hitRate: (hits / testConfig.repeatedQueries) * 100,
    randomHitRate: (randomHits / testConfig.randomQueries) * 100,
    prefetchHitRate: (prefetchHits / totalSimilarQueries) * 100,
    memoryCacheSize: cache.getMemoryCacheSize(),
    fileCacheSize: cache.getFileCacheSize(),
  };
}

// テスト実行
runPerformanceTest()
  .then(results => {
    console.log('\n=== テスト結果サマリー ===');
    console.log(`キャッシュ構築時間: ${results.buildTime.toFixed(2)}秒`);
    console.log(`繰り返しクエリヒット率: ${results.hitRate.toFixed(2)}%`);
    console.log(`ランダムアクセスヒット率: ${results.randomHitRate.toFixed(2)}%`);
    console.log(`プリフェッチ効果ヒット率: ${results.prefetchHitRate.toFixed(2)}%`);
    console.log(`メモリキャッシュサイズ: ${results.memoryCacheSize}エントリ`);
    console.log(`ファイルキャッシュサイズ: ${results.fileCacheSize}エントリ`);
  })
  .catch(error => {
    console.error('テスト実行中にエラーが発生しました:', error);
  });
