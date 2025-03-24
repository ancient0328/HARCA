/**
 * HARCA ベクトルストアAPI テストクライアント
 * 
 * APIサーバーの各エンドポイントをテストするためのスクリプト
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

// Axiosのインターセプターを設定
axiosInstance.interceptors.request.use(request => {
  console.log(`リクエスト送信: ${request.method.toUpperCase()} ${request.url}`);
  return request;
});

axiosInstance.interceptors.response.use(
  response => {
    console.log(`レスポンス受信: ${response.status} ${response.statusText}`);
    return response;
  },
  error => {
    if (error.response) {
      console.error(`エラーレスポンス: ${error.response.status} ${error.response.statusText}`);
      console.error('エラーデータ:', error.response.data);
    } else if (error.request) {
      console.error('レスポンスが受信されませんでした');
      console.error('リクエスト:', error.request);
    } else {
      console.error('リクエスト設定エラー:', error.message);
    }
    return Promise.reject(error);
  }
);

// テスト結果保存ディレクトリ
const TEST_RESULTS_DIR = path.join(__dirname, 'test-results');
if (!fs.existsSync(TEST_RESULTS_DIR)) {
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
}

/**
 * テスト結果を保存する
 * @param {Object} results - テスト結果
 */
function saveTestResults(results) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filePath = path.join(TEST_RESULTS_DIR, `api-test-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.log(`テスト結果を保存しました: ${filePath}`);
}

/**
 * APIサーバーの動作をテストする
 */
async function testAPI() {
  console.log('ベクトルストアAPIのテストを開始します...');
  const testResults = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };
  
  try {
    // テスト1: ルートエンドポイント
    console.log('\nテスト1: ルートエンドポイント');
    try {
      console.log('ルートエンドポイントにリクエスト送信中...');
      const response = await axiosInstance.get(`/`);
      console.log('応答:', response.data);
      testResults.tests.push({
        name: 'ルートエンドポイント',
        status: 'passed',
        data: response.data
      });
      testResults.summary.passed++;
    } catch (err) {
      console.error('エラー:', err.message);
      testResults.tests.push({
        name: 'ルートエンドポイント',
        status: 'failed',
        error: err.message
      });
      testResults.summary.failed++;
    }
    testResults.summary.total++;
    
    // テスト2: 埋め込みエンドポイント
    console.log('\nテスト2: 埋め込みエンドポイント');
    try {
      console.log('埋め込みエンドポイントにリクエスト送信中...');
      const response = await axiosInstance.post(`/api/embed`, {
        text: 'これはテストテキストです。埋め込みベクトルに変換されます。',
        model: 'text-embedding-ada-002'
      });
      console.log('埋め込みベクトルの次元数:', response.data.dimensions);
      console.log('埋め込みベクトルの最初の5要素:', response.data.embedding.slice(0, 5));
      testResults.tests.push({
        name: '埋め込みエンドポイント',
        status: 'passed',
        dimensions: response.data.dimensions,
        model: response.data.model
      });
      testResults.summary.passed++;
    } catch (err) {
      console.error('エラー:', err.message);
      testResults.tests.push({
        name: '埋め込みエンドポイント',
        status: 'failed',
        error: err.message
      });
      testResults.summary.failed++;
    }
    testResults.summary.total++;
    
    // テスト3: 検索エンドポイント
    console.log('\nテスト3: 検索エンドポイント');
    try {
      console.log('検索エンドポイントにリクエスト送信中...');
      const documents = [
        { id: '1', text: '人工知能（AI）は、人間の知能を模倣するコンピュータシステムです。' },
        { id: '2', text: '機械学習は、AIの一分野で、データからパターンを学習します。' },
        { id: '3', text: 'ディープラーニングは、ニューラルネットワークを使用した機械学習の手法です。' }
      ];
      
      const response = await axiosInstance.post(`/api/search`, {
        query: '機械学習とは何ですか？',
        documents,
        topK: 2
      });
      
      console.log('検索結果:');
      response.data.results.forEach((result, index) => {
        console.log(`${index + 1}. ID: ${result.id}, スコア: ${result.score.toFixed(4)}`);
        console.log(`   テキスト: ${result.text}`);
      });
      
      testResults.tests.push({
        name: '検索エンドポイント',
        status: 'passed',
        results: response.data.results.length,
        topResult: response.data.results[0].id
      });
      testResults.summary.passed++;
    } catch (err) {
      console.error('エラー:', err.message);
      testResults.tests.push({
        name: '検索エンドポイント',
        status: 'failed',
        error: err.message
      });
      testResults.summary.failed++;
    }
    testResults.summary.total++;
    
    // テスト4: キャッシュ統計情報エンドポイント
    console.log('\nテスト4: キャッシュ統計情報エンドポイント');
    try {
      console.log('キャッシュ統計情報エンドポイントにリクエスト送信中...');
      const response = await axiosInstance.get(`/api/cache/stats`);
      console.log('キャッシュ統計情報:', response.data.stats);
      testResults.tests.push({
        name: 'キャッシュ統計情報エンドポイント',
        status: 'passed',
        stats: response.data.stats
      });
      testResults.summary.passed++;
    } catch (err) {
      console.error('エラー:', err.message);
      testResults.tests.push({
        name: 'キャッシュ統計情報エンドポイント',
        status: 'failed',
        error: err.message
      });
      testResults.summary.failed++;
    }
    testResults.summary.total++;
    
    // テスト5: キャッシュクリアエンドポイント
    console.log('\nテスト5: キャッシュクリアエンドポイント');
    try {
      console.log('キャッシュクリアエンドポイントにリクエスト送信中...');
      const response = await axiosInstance.post(`/api/cache/clear`, {
        model: 'text-embedding-ada-002'
      });
      console.log('応答:', response.data);
      testResults.tests.push({
        name: 'キャッシュクリアエンドポイント',
        status: 'passed',
        message: response.data.message
      });
      testResults.summary.passed++;
    } catch (err) {
      console.error('エラー:', err.message);
      testResults.tests.push({
        name: 'キャッシュクリアエンドポイント',
        status: 'failed',
        error: err.message
      });
      testResults.summary.failed++;
    }
    testResults.summary.total++;
    
    // テスト結果のサマリーを表示
    console.log('\nテスト結果サマリー:');
    console.log(`総テスト数: ${testResults.summary.total}`);
    console.log(`成功: ${testResults.summary.passed}`);
    console.log(`失敗: ${testResults.summary.failed}`);
    
    // テスト結果を保存
    saveTestResults(testResults);
    
  } catch (err) {
    console.error('テスト実行中にエラーが発生しました:', err);
  }
}

// テストを実行
testAPI().catch(err => {
  console.error('テスト実行エラー:', err);
  process.exit(1);
});
