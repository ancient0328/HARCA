/**
 * HARCA ベクトルストアAPI パフォーマンステストスクリプト
 * 
 * このスクリプトは、ベクトルストアAPIのパフォーマンスを測定し、結果をレポートします。
 * 以下の項目を測定します：
 * - 埋め込み生成の速度と安定性
 * - 検索操作の速度と精度
 * - 大量テキスト処理の性能
 * - 並列リクエスト処理の性能
 * - メモリ使用量
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESモジュールで__dirnameを取得するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// APIのベースURL
const API_BASE_URL = process.env.VECTOR_STORE_API_URL || 'http://localhost:3701';

// Axiosのデフォルト設定
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60秒でタイムアウト
  headers: {
    'Content-Type': 'application/json'
  }
});

// 結果保存用ディレクトリ
const RESULTS_DIR = path.join(__dirname, 'test-results');
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// テスト設定
const config = {
  // 基本テスト設定
  iterations: 5,                // 繰り返し回数
  warmupIterations: 2,          // ウォームアップ繰り返し回数
  
  // 埋め込みテスト設定
  embeddingTestSizes: [
    { name: '短いテキスト', length: 100 },
    { name: '中程度のテキスト', length: 1000 },
    { name: '長いテキスト', length: 5000 },
    { name: '非常に長いテキスト', length: 10000 }
  ],
  
  // 検索テスト設定
  searchTestSizes: [
    { name: '少数ドキュメント', count: 10, textLength: 200 },
    { name: '中程度ドキュメント', count: 50, textLength: 100 },
    { name: '多数ドキュメント', count: 200, textLength: 50 }
  ],
  
  // 並列テスト設定
  concurrencyLevels: [1, 5, 10, 20],
  
  // モデル設定
  models: ['text-embedding-ada-002']
};

/**
 * 指定された長さのランダムなテキストを生成
 * @param {number} length テキストの長さ
 * @returns {string} ランダムなテキスト
 */
function generateRandomText(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ,.。、！？!?';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

/**
 * 指定された数のランダムなドキュメントを生成
 * @param {number} count ドキュメント数
 * @param {number} textLength 各ドキュメントのテキスト長
 * @returns {Array<{id: string, text: string}>} ドキュメントの配列
 */
function generateRandomDocuments(count, textLength = 500) {
  const documents = [];
  
  for (let i = 0; i < count; i++) {
    documents.push({
      id: `doc-${i + 1}`,
      text: generateRandomText(textLength)
    });
  }
  
  return documents;
}

/**
 * 時間を測定する関数
 * @param {Function} fn 測定する関数
 * @returns {Promise<{result: any, time: number}>} 結果と実行時間（ミリ秒）
 */
async function measureTime(fn) {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const time = end - start;
  return { result, time };
}

/**
 * メモリ使用量を取得
 * @returns {Object} メモリ使用量情報
 */
function getMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  return {
    rss: Math.round(memoryUsage.rss / 1024 / 1024), // RSS（常駐セットサイズ）（MB）
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // 合計ヒープサイズ（MB）
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // 使用中ヒープサイズ（MB）
    external: Math.round(memoryUsage.external / 1024 / 1024) // 外部メモリ（MB）
  };
}

/**
 * 埋め込み生成のパフォーマンスをテスト
 * @param {string} model モデル名
 * @param {Object} sizeConfig テキストサイズ設定
 * @returns {Promise<Object>} テスト結果
 */
async function testEmbeddingPerformance(model, sizeConfig) {
  console.log(`\n[埋め込みテスト] モデル: ${model}, テキスト: ${sizeConfig.name}`);
  
  const text = generateRandomText(sizeConfig.length);
  const results = [];
  const memoryBefore = getMemoryUsage();
  
  // ウォームアップ
  for (let i = 0; i < config.warmupIterations; i++) {
    console.log(`  ウォームアップ ${i + 1}/${config.warmupIterations}...`);
    await axiosInstance.post('/api/embed', { text, model });
  }
  
  // 本測定
  for (let i = 0; i < config.iterations; i++) {
    console.log(`  反復 ${i + 1}/${config.iterations}...`);
    
    const { result, time } = await measureTime(async () => {
      return await axiosInstance.post('/api/embed', { text, model });
    });
    
    results.push({
      time,
      dimensions: result.data.dimensions,
      status: result.status
    });
  }
  
  const memoryAfter = getMemoryUsage();
  const times = results.map(r => r.time);
  
  return {
    model,
    textSize: sizeConfig,
    times,
    averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    stdDev: calculateStdDev(times),
    dimensions: results[0].dimensions,
    memoryBefore,
    memoryAfter,
    memoryDelta: {
      rss: memoryAfter.rss - memoryBefore.rss,
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed
    }
  };
}

/**
 * 検索のパフォーマンスをテスト
 * @param {string} model モデル名
 * @param {Object} sizeConfig ドキュメント数設定
 * @returns {Promise<Object>} テスト結果
 */
async function testSearchPerformance(model, sizeConfig) {
  console.log(`\n[検索テスト] モデル: ${model}, ドキュメント: ${sizeConfig.name}`);
  
  const documents = generateRandomDocuments(sizeConfig.count, sizeConfig.textLength || 100);
  const query = "テスト検索クエリ";
  const results = [];
  const memoryBefore = getMemoryUsage();
  
  // ウォームアップ
  for (let i = 0; i < config.warmupIterations; i++) {
    console.log(`  ウォームアップ ${i + 1}/${config.warmupIterations}...`);
    try {
      await axiosInstance.post('/api/search', { 
        query, 
        documents, 
        model,
        topK: 5
      });
    } catch (err) {
      console.log(`  ウォームアップ中にエラーが発生しました: ${err.message}`);
      // ウォームアップ中のエラーは無視して続行
    }
  }
  
  // 本測定
  for (let i = 0; i < config.iterations; i++) {
    console.log(`  反復 ${i + 1}/${config.iterations}...`);
    
    try {
      const { result, time } = await measureTime(async () => {
        return await axiosInstance.post('/api/search', { 
          query, 
          documents, 
          model,
          topK: 5
        });
      });
      
      results.push({
        time,
        resultCount: result.data.results.length,
        status: result.status
      });
    } catch (err) {
      console.log(`  エラーが発生しました: ${err.message}`);
      if (err.response) {
        console.log(`  ステータスコード: ${err.response.status}`);
        console.log(`  エラー詳細: ${JSON.stringify(err.response.data)}`);
      }
      
      // エラーが発生した場合は、このテストケースをスキップ
      return {
        model,
        documentSize: sizeConfig,
        error: err.message,
        skipped: true
      };
    }
  }
  
  // 結果が空の場合（すべてエラー）
  if (results.length === 0) {
    return {
      model,
      documentSize: sizeConfig,
      error: "すべての試行が失敗しました",
      skipped: true
    };
  }
  
  const memoryAfter = getMemoryUsage();
  const times = results.map(r => r.time);
  
  return {
    model,
    documentSize: sizeConfig,
    times,
    averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    stdDev: calculateStdDev(times),
    resultCount: results[0].resultCount,
    memoryBefore,
    memoryAfter,
    memoryDelta: {
      rss: memoryAfter.rss - memoryBefore.rss,
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed
    }
  };
}

/**
 * 並列リクエストのパフォーマンスをテスト
 * @param {string} model モデル名
 * @param {number} concurrency 並列度
 * @returns {Promise<Object>} テスト結果
 */
async function testConcurrentPerformance(model, concurrency) {
  console.log(`\n[並列テスト] モデル: ${model}, 並列度: ${concurrency}`);
  
  const text = generateRandomText(500);
  const memoryBefore = getMemoryUsage();
  
  try {
    // 並列リクエストを作成
    const requests = [];
    for (let i = 0; i < concurrency; i++) {
      requests.push(axiosInstance.post('/api/embed', { text, model }));
    }
    
    const start = performance.now();
    const responses = await Promise.all(requests);
    const end = performance.now();
    const totalTime = end - start;
    
    const memoryAfter = getMemoryUsage();
    const successCount = responses.filter(r => r.status === 200).length;
    
    return {
      model,
      concurrency,
      totalTime,
      averageTimePerRequest: totalTime / concurrency,
      requestsPerSecond: (concurrency / totalTime) * 1000,
      successRate: successCount / concurrency,
      memoryBefore,
      memoryAfter,
      memoryDelta: {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed
      }
    };
  } catch (err) {
    console.log(`  エラーが発生しました: ${err.message}`);
    return {
      model,
      concurrency,
      error: err.message,
      skipped: true
    };
  }
}

/**
 * 標準偏差を計算
 * @param {number[]} values 値の配列
 * @returns {number} 標準偏差
 */
function calculateStdDev(values) {
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(value => {
    const diff = value - avg;
    return diff * diff;
  });
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * テスト結果を保存
 * @param {Object} results テスト結果
 */
function saveResults(results) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filePath = path.join(RESULTS_DIR, `performance-test-${timestamp}.json`);
  
  const resultsWithMeta = {
    timestamp,
    system: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024), // MB
      freeMemory: Math.round(os.freemem() / 1024 / 1024), // MB
      nodeVersion: process.version
    },
    config,
    results
  };
  
  fs.writeFileSync(filePath, JSON.stringify(resultsWithMeta, null, 2));
  console.log(`\nテスト結果を保存しました: ${filePath}`);
}

/**
 * パフォーマンステストを実行
 */
async function runPerformanceTests() {
  console.log('ベクトルストアAPIのパフォーマンステストを開始します...');
  console.log(`APIエンドポイント: ${API_BASE_URL}`);
  
  const results = {
    embedding: [],
    search: [],
    concurrent: []
  };
  
  try {
    // APIの状態を確認
    console.log('\nAPIサーバーの状態を確認しています...');
    try {
      const healthCheck = await axiosInstance.get('/');
      console.log(`APIサーバーは応答しています: ${healthCheck.status} ${healthCheck.statusText}`);
    } catch (err) {
      console.error(`APIサーバーに接続できません: ${err.message}`);
      return;
    }
    
    // 埋め込みテスト
    for (const model of config.models) {
      for (const sizeConfig of config.embeddingTestSizes) {
        try {
          const result = await testEmbeddingPerformance(model, sizeConfig);
          results.embedding.push(result);
        } catch (err) {
          console.error(`埋め込みテスト中にエラーが発生しました (${model}/${sizeConfig.name}): ${err.message}`);
          results.embedding.push({
            model,
            textSize: sizeConfig,
            error: err.message,
            skipped: true
          });
        }
      }
    }
    
    // 検索テスト
    for (const model of config.models) {
      for (const sizeConfig of config.searchTestSizes) {
        try {
          const result = await testSearchPerformance(model, sizeConfig);
          results.search.push(result);
        } catch (err) {
          console.error(`検索テスト中にエラーが発生しました (${model}/${sizeConfig.name}): ${err.message}`);
          results.search.push({
            model,
            documentSize: sizeConfig,
            error: err.message,
            skipped: true
          });
        }
      }
    }
    
    // 並列テスト
    for (const model of config.models) {
      for (const concurrency of config.concurrencyLevels) {
        try {
          const result = await testConcurrentPerformance(model, concurrency);
          results.concurrent.push(result);
        } catch (err) {
          console.error(`並列テスト中にエラーが発生しました (${model}/並列度 ${concurrency}): ${err.message}`);
          results.concurrent.push({
            model,
            concurrency,
            error: err.message,
            skipped: true
          });
        }
      }
    }
    
    // 結果のサマリーを表示
    console.log('\n===== パフォーマンステスト結果サマリー =====');
    
    console.log('\n[埋め込みテスト結果]');
    results.embedding.forEach(result => {
      if (result.skipped) {
        console.log(`${result.model} / ${result.textSize.name}: スキップ (${result.error})`);
      } else {
        console.log(`${result.model} / ${result.textSize.name}: ${result.averageTime.toFixed(2)}ms (±${result.stdDev.toFixed(2)}ms)`);
      }
    });
    
    console.log('\n[検索テスト結果]');
    results.search.forEach(result => {
      if (result.skipped) {
        console.log(`${result.model} / ${result.documentSize.name}: スキップ (${result.error})`);
      } else {
        console.log(`${result.model} / ${result.documentSize.name}: ${result.averageTime.toFixed(2)}ms (±${result.stdDev.toFixed(2)}ms)`);
      }
    });
    
    console.log('\n[並列テスト結果]');
    results.concurrent.forEach(result => {
      if (result.skipped) {
        console.log(`${result.model} / 並列度 ${result.concurrency}: スキップ (${result.error})`);
      } else {
        console.log(`${result.model} / 並列度 ${result.concurrency}: ${result.requestsPerSecond.toFixed(2)} req/s (成功率: ${(result.successRate * 100).toFixed(2)}%)`);
      }
    });
    
    // 結果を保存
    saveResults(results);
    
    console.log('\nパフォーマンステストが完了しました。');
    
  } catch (err) {
    console.error('テスト実行中にエラーが発生しました:', err);
  }
}

// テストを実行
if (import.meta.url === `file://${__filename}`) {
  runPerformanceTests().catch(err => {
    console.error('テスト実行エラー:', err);
    process.exit(1);
  });
}

export {
  runPerformanceTests,
  testEmbeddingPerformance,
  testSearchPerformance,
  testConcurrentPerformance
};
