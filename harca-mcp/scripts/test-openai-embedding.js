// scripts/test-openai-embedding.js - OpenAI埋め込みモデルのテスト
const { OpenAIEmbeddingModel } = require('../features/vector-store/openai-model');
const { VectorStore } = require('../features/vector-store');
const dotenv = require('dotenv');

// 環境変数読み込み
dotenv.config();

// テスト用のサンプルコード
const sampleCode = `
function calculateFactorial(n) {
  if (n === 0 || n === 1) {
    return 1;
  } else {
    return n * calculateFactorial(n - 1);
  }
}

// 階乗計算のテスト
console.log(calculateFactorial(5)); // 120
`;

// メイン関数
async function main() {
  try {
    console.log('OpenAI埋め込みモデルのテストを開始します...');
    
    // OpenAI埋め込みモデルの初期化
    const openaiModel = new OpenAIEmbeddingModel();
    
    console.log('サンプルコードの埋め込みを生成します...');
    const embedding = await openaiModel.embed(sampleCode);
    
    console.log('埋め込みベクトルの次元数:', embedding.length);
    console.log('埋め込みベクトルの一部:', embedding.slice(0, 5));
    
    // ベクトルストアの初期化とテスト
    console.log('\nベクトルストアを使用したテスト...');
    const vectorStore = new VectorStore({ embeddingMethod: 'openai' });
    
    // サンプルコードのインデックス化
    console.log('サンプルコードをインデックス化します...');
    await vectorStore.indexCode(sampleCode, { 
      language: 'javascript', 
      description: 'factorial calculation function'
    });
    
    // 類似コードの検索
    console.log('\n類似コードを検索します...');
    const searchResults = await vectorStore.searchSimilarCode('recursive factorial function');
    
    console.log('検索結果:');
    console.log(JSON.stringify(searchResults, null, 2));
    
    // 接続を閉じる
    await vectorStore.close();
    
    console.log('\nテストが完了しました');
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
}

// スクリプト実行
main().catch(console.error);
