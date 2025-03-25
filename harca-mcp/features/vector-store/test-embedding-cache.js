// features/vector-store/test-embedding-cache.js - 埋め込みキャッシュのテスト
import { EmbeddingCache } from './embedding-cache.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESモジュールで__dirnameを取得するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * キャッシュのパフォーマンステスト
 * 様々な設定でのキャッシュヒット率とパフォーマンスを測定
 */
async function testCachePerformance() {
  console.log('=== 埋め込みキャッシュのパフォーマンステスト開始 ===');
  
  // テスト用のキャッシュディレクトリ
  const testCacheDir = path.join(process.cwd(), '.cache', 'test-embeddings');
  
  // テスト用のキャッシュディレクトリをクリア
  if (fs.existsSync(testCacheDir)) {
    fs.rmSync(testCacheDir, { recursive: true, force: true });
  }
  
  // テストデータの準備
  const testTexts = [];
  for (let i = 0; i < 100; i++) {
    testTexts.push(`これはテスト用のテキスト ${i} です。このテキストは埋め込みキャッシュのテストに使用されます。`);
  }
  
  // 重複テキストの追加（キャッシュヒット率テスト用）
  for (let i = 0; i < 50; i++) {
    const randomIndex = Math.floor(Math.random() * 100);
    testTexts.push(testTexts[randomIndex]);
  }
  
  // テスト用の埋め込みベクトル生成関数
  function generateMockEmbedding(text) {
    // 実際の埋め込みモデルの代わりに、テキストからハッシュベースの埋め込みを生成
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const embedding = [];
    for (let i = 0; i < 1536; i++) {
      // ハッシュの各文字を数値に変換して正規化
      const charIndex = i % hash.length;
      const value = (parseInt(hash[charIndex], 16) / 15) * 2 - 1; // -1から1の範囲に正規化
      embedding.push(value);
    }
    return embedding;
  }
  
  // 様々なTTL設定でのテスト
  const ttlSettings = [
    { name: '1分', ttl: 60 * 1000 },
    { name: '1時間', ttl: 60 * 60 * 1000 },
    { name: '1日', ttl: 24 * 60 * 60 * 1000 },
    { name: '1週間', ttl: 7 * 24 * 60 * 60 * 1000 },
    { name: '1ヶ月', ttl: 30 * 24 * 60 * 60 * 1000 }
  ];
  
  // 各TTL設定でのテスト結果
  const results = {};
  
  for (const ttlSetting of ttlSettings) {
    console.log(`\n--- TTL設定: ${ttlSetting.name} でのテスト ---`);
    
    // キャッシュの初期化
    const cache = new EmbeddingCache({
      cacheDir: path.join(testCacheDir, ttlSetting.name.replace(/\s/g, '-')),
      ttl: ttlSetting.ttl,
      useMemoryCache: true,
      useFileCache: true,
      useFrequencyBasedStrategy: true,
      frequencyThreshold: 2,
      memoryCacheSize: 50 // 意図的に小さく設定してファイルキャッシュも使用されるようにする
    });
    
    // 1回目の実行（キャッシュなし）
    console.log('1回目の実行（キャッシュなし）...');
    console.time('1回目の実行');
    for (const text of testTexts) {
      const embedding = generateMockEmbedding(text);
      await cache.set(text, embedding, 'mock-model');
    }
    console.timeEnd('1回目の実行');
    
    // キャッシュ統計の表示
    let stats = cache.getStats();
    console.log('キャッシュ統計（1回目）:', JSON.stringify(stats, null, 2));
    
    // 2回目の実行（キャッシュあり）
    console.log('2回目の実行（キャッシュあり）...');
    console.time('2回目の実行');
    for (const text of testTexts) {
      let embedding = await cache.get(text, 'mock-model');
      if (!embedding) {
        embedding = generateMockEmbedding(text);
        await cache.set(text, embedding, 'mock-model');
      }
    }
    console.timeEnd('2回目の実行');
    
    // キャッシュ統計の表示
    stats = cache.getStats();
    console.log('キャッシュ統計（2回目）:', JSON.stringify(stats, null, 2));
    
    // 結果の保存
    results[ttlSetting.name] = {
      hitRate: stats.total.hitRate,
      memoryHitRate: stats.memory ? stats.memory.hitRate : 'N/A',
      fileHitRate: stats.file ? stats.file.hitRate : 'N/A',
      totalSize: stats.total.size
    };
    
    // キャッシュの最適化
    console.log('キャッシュの最適化を実行...');
    cache.optimizeCache();
    
    // 3回目の実行（最適化後）
    console.log('3回目の実行（最適化後）...');
    console.time('3回目の実行');
    for (const text of testTexts) {
      let embedding = await cache.get(text, 'mock-model');
      if (!embedding) {
        embedding = generateMockEmbedding(text);
        await cache.set(text, embedding, 'mock-model');
      }
    }
    console.timeEnd('3回目の実行');
    
    // キャッシュ統計の表示
    stats = cache.getStats();
    console.log('キャッシュ統計（最適化後）:', JSON.stringify(stats, null, 2));
    
    // 結果の更新
    results[ttlSetting.name].optimizedHitRate = stats.total.hitRate;
    results[ttlSetting.name].optimizedMemoryHitRate = stats.memory ? stats.memory.hitRate : 'N/A';
    
    // キャッシュのクリア
    cache.clear();
  }
  
  // 結果のサマリー表示
  console.log('\n=== テスト結果サマリー ===');
  console.table(results);
  
  console.log('\n=== 埋め込みキャッシュのパフォーマンステスト完了 ===');
}

/**
 * 様々なキャッシュ戦略のテスト
 */
async function testCacheStrategies() {
  console.log('\n=== キャッシュ戦略テスト開始 ===');
  
  // テスト用のキャッシュディレクトリ
  const strategyCacheDir = path.join(process.cwd(), '.cache', 'strategy-test');
  
  // テスト用のキャッシュディレクトリをクリア
  if (fs.existsSync(strategyCacheDir)) {
    fs.rmSync(strategyCacheDir, { recursive: true, force: true });
  }
  
  // テストデータの準備（アクセス頻度に偏りのあるデータセット）
  const frequentTexts = [];
  const infrequentTexts = [];
  
  // 頻繁にアクセスされるテキスト（20個）
  for (let i = 0; i < 20; i++) {
    frequentTexts.push(`これは頻繁にアクセスされるテキスト ${i} です。`);
  }
  
  // あまりアクセスされないテキスト（80個）
  for (let i = 0; i < 80; i++) {
    infrequentTexts.push(`これはあまりアクセスされないテキスト ${i} です。`);
  }
  
  // テスト用の埋め込みベクトル生成関数
  function generateMockEmbedding(text) {
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const embedding = [];
    for (let i = 0; i < 1536; i++) {
      const charIndex = i % hash.length;
      const value = (parseInt(hash[charIndex], 16) / 15) * 2 - 1;
      embedding.push(value);
    }
    return embedding;
  }
  
  // 異なる戦略でのテスト
  const strategies = [
    { name: 'LRUのみ', useFrequencyBasedStrategy: false },
    { name: '頻度ベース', useFrequencyBasedStrategy: true, frequencyThreshold: 3 },
    { name: '頻度ベース（低しきい値）', useFrequencyBasedStrategy: true, frequencyThreshold: 2 },
    { name: '頻度ベース（高しきい値）', useFrequencyBasedStrategy: true, frequencyThreshold: 5 }
  ];
  
  const strategyResults = {};
  
  for (const strategy of strategies) {
    console.log(`\n--- 戦略: ${strategy.name} でのテスト ---`);
    
    // キャッシュの初期化
    const cache = new EmbeddingCache({
      cacheDir: path.join(strategyCacheDir, strategy.name.replace(/\s/g, '-')),
      useMemoryCache: true,
      useFileCache: true,
      useFrequencyBasedStrategy: strategy.useFrequencyBasedStrategy,
      frequencyThreshold: strategy.frequencyThreshold || 3,
      memoryCacheSize: 30 // 意図的に小さく設定（頻繁にアクセスされるテキストは20個）
    });
    
    // 初期データの設定
    console.log('初期データの設定...');
    for (const text of [...frequentTexts, ...infrequentTexts]) {
      const embedding = generateMockEmbedding(text);
      await cache.set(text, embedding, 'mock-model');
    }
    
    // アクセスパターンのシミュレーション
    console.log('アクセスパターンのシミュレーション...');
    for (let i = 0; i < 5; i++) { // 5回の繰り返し
      // 頻繁にアクセスされるテキストは毎回アクセス
      for (const text of frequentTexts) {
        await cache.get(text, 'mock-model');
      }
      
      // あまりアクセスされないテキストはランダムに20%だけアクセス
      for (const text of infrequentTexts) {
        if (Math.random() < 0.2) {
          await cache.get(text, 'mock-model');
        }
      }
    }
    
    // キャッシュの最適化
    console.log('キャッシュの最適化...');
    cache.optimizeCache();
    
    // テスト実行
    console.log('テスト実行...');
    console.time('頻繁にアクセスされるテキスト');
    for (const text of frequentTexts) {
      await cache.get(text, 'mock-model');
    }
    console.timeEnd('頻繁にアクセスされるテキスト');
    
    console.time('あまりアクセスされないテキスト');
    for (const text of infrequentTexts) {
      await cache.get(text, 'mock-model');
    }
    console.timeEnd('あまりアクセスされないテキスト');
    
    // キャッシュ統計の表示
    const stats = cache.getStats();
    console.log('キャッシュ統計:', JSON.stringify(stats, null, 2));
    
    // 結果の保存
    strategyResults[strategy.name] = {
      totalHitRate: stats.total.hitRate,
      memoryHitRate: stats.memory ? stats.memory.hitRate : 'N/A',
      fileHitRate: stats.file ? stats.file.hitRate : 'N/A',
      memorySize: stats.memory ? stats.memory.size : 0,
      fileSize: stats.file ? stats.file.size : 0
    };
    
    // キャッシュのクリア
    cache.clear();
  }
  
  // 結果のサマリー表示
  console.log('\n=== 戦略テスト結果サマリー ===');
  console.table(strategyResults);
  
  console.log('\n=== キャッシュ戦略テスト完了 ===');
}

/**
 * メインテスト関数
 */
async function runTests() {
  try {
    await testCachePerformance();
    await testCacheStrategies();
    console.log('\nすべてのテストが完了しました。');
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  }
}

// テストの実行
runTests();
