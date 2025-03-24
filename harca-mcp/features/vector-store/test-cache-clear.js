/**
 * HARCA ベクトルストアAPI キャッシュクリアテスト
 * 
 * キャッシュクリアエンドポイントのテスト専用スクリプト
 */

const axios = require('axios');

// APIのベースURL
const API_BASE_URL = process.env.VECTOR_STORE_API_URL || 'http://localhost:3701';

// Axiosのデフォルト設定
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 120秒でタイムアウト（長めに設定）
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

// 特定のモデルのキャッシュをクリアするテスト
async function testClearModelCache() {
  console.log('特定のモデルのキャッシュクリアをテストします...');
  try {
    const response = await axiosInstance.post('/api/cache/clear', {
      model: 'text-embedding-ada-002'
    });
    console.log('キャッシュクリアレスポンス:', response.data);
    return true;
  } catch (error) {
    console.error('キャッシュクリアテスト中にエラーが発生しました:', error.message);
    return false;
  }
}

// すべてのキャッシュをクリアするテスト
async function testClearAllCache() {
  console.log('すべてのキャッシュクリアをテストします...');
  try {
    const response = await axiosInstance.post('/api/cache/clear', {});
    console.log('キャッシュクリアレスポンス:', response.data);
    return true;
  } catch (error) {
    console.error('キャッシュクリアテスト中にエラーが発生しました:', error.message);
    return false;
  }
}

// メインテスト関数
async function runTests() {
  console.log('キャッシュクリアテストを開始します...');
  
  // テスト1: 特定のモデルのキャッシュをクリア
  const modelCacheResult = await testClearModelCache();
  
  // テスト2: すべてのキャッシュをクリア
  const allCacheResult = await testClearAllCache();
  
  console.log('\nテスト結果サマリー:');
  console.log(`モデルキャッシュクリア: ${modelCacheResult ? '成功' : '失敗'}`);
  console.log(`すべてのキャッシュクリア: ${allCacheResult ? '成功' : '失敗'}`);
  
  process.exit(modelCacheResult && allCacheResult ? 0 : 1);
}

// テストを実行
runTests().catch(err => {
  console.error('テスト実行エラー:', err);
  process.exit(1);
});
