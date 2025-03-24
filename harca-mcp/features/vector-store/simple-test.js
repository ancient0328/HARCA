/**
 * HARCA ベクトルストアAPI 簡易テストクライアント
 */

const axios = require('axios');

// APIのベースURL
const API_BASE_URL = process.env.VECTOR_STORE_API_URL || 'http://localhost:3701';

/**
 * 簡易的なAPIテスト
 */
async function simpleTest() {
  console.log('ベクトルストアAPI簡易テストを開始します...');
  
  try {
    // テスト1: ルートエンドポイント
    console.log('\nテスト1: ルートエンドポイント');
    try {
      const response = await axios.get(`${API_BASE_URL}/`);
      console.log('応答:', response.data);
    } catch (err) {
      console.error('エラー:', err.message);
    }
    
    // テスト2: 埋め込みエンドポイント
    console.log('\nテスト2: 埋め込みエンドポイント');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/embed`, {
        text: 'これは簡易テストです。',
        model: 'text-embedding-ada-002'
      });
      console.log('埋め込みベクトルの次元数:', response.data.dimensions);
      console.log('埋め込みベクトルの最初の3要素:', response.data.embedding.slice(0, 3));
    } catch (err) {
      console.error('エラー:', err.message);
    }
    
    console.log('\nテスト完了');
    
  } catch (err) {
    console.error('テスト実行中にエラーが発生しました:', err);
  }
}

// テストを実行
simpleTest().catch(err => {
  console.error('テスト実行エラー:', err);
  process.exit(1);
});
