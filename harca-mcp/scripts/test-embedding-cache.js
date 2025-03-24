// scripts/test-embedding-cache.js - 埋め込みキャッシュとエラーハンドリングのテスト
const { OpenAIEmbeddingModel } = require('../features/vector-store/openai-model');
const { EmbeddingCache } = require('../features/vector-store/embedding-cache');
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
    console.log('埋め込みキャッシュとエラーハンドリングのテストを開始します...');
    
    // キャッシュの初期化
    console.log('\n1. キャッシュの初期化テスト');
    const cache = new EmbeddingCache({
      cacheDir: './.cache/test-embeddings',
      maxCacheSize: 10,
      ttl: 60 * 60 * 1000 // 1時間
    });
    
    // キャッシュ統計の表示
    console.log('キャッシュ統計:', cache.getStats());
    
    // OpenAI埋め込みモデルの初期化（キャッシュ有効）
    console.log('\n2. OpenAI埋め込みモデルの初期化（キャッシュ有効）');
    const openaiModel = new OpenAIEmbeddingModel({
      useCache: true,
      cache: {
        cacheDir: './.cache/test-embeddings',
        maxCacheSize: 10,
        ttl: 60 * 60 * 1000 // 1時間
      }
    });
    
    // 最初の埋め込み生成（キャッシュミス）
    console.log('\n3. 最初の埋め込み生成（キャッシュミス）');
    console.time('初回埋め込み生成');
    const embedding1 = await openaiModel.embed(sampleCode);
    console.timeEnd('初回埋め込み生成');
    
    console.log('埋め込みベクトルの次元数:', embedding1.length);
    console.log('埋め込みベクトルの一部:', embedding1.slice(0, 5));
    
    // キャッシュ統計の表示
    console.log('キャッシュ統計:', openaiModel.getCacheStats());
    
    // 2回目の埋め込み生成（キャッシュヒット）
    console.log('\n4. 2回目の埋め込み生成（キャッシュヒット）');
    console.time('2回目埋め込み生成');
    const embedding2 = await openaiModel.embed(sampleCode);
    console.timeEnd('2回目埋め込み生成');
    
    // キャッシュ統計の表示
    console.log('キャッシュ統計:', openaiModel.getCacheStats());
    
    // ベクトルの一致を確認
    const vectorsMatch = embedding1.length === embedding2.length && 
      embedding1.every((val, idx) => val === embedding2[idx]);
    
    console.log('ベクトルの一致:', vectorsMatch ? '一致' : '不一致');
    
    // エラーハンドリングのテスト
    console.log('\n5. エラーハンドリングのテスト');
    
    // APIキーを一時的に無効化してエラーを発生させる
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'invalid_key';
    
    // エラーハンドリングモデルの初期化
    const errorModel = new OpenAIEmbeddingModel({
      useCache: false,
      maxRetries: 2,
      retryDelay: 100
    });
    
    try {
      console.log('無効なAPIキーでの埋め込み生成を試行します...');
      console.time('フォールバック埋め込み生成');
      const fallbackEmbedding = await errorModel.embed('テストテキスト');
      console.timeEnd('フォールバック埋め込み生成');
      
      console.log('フォールバック埋め込みベクトルの次元数:', fallbackEmbedding.length);
      console.log('フォールバック埋め込みベクトルの一部:', fallbackEmbedding.slice(0, 5));
    } catch (error) {
      console.error('予期せぬエラー:', error);
    } finally {
      // APIキーを元に戻す
      process.env.OPENAI_API_KEY = originalApiKey;
    }
    
    // キャッシュクリアのテスト
    console.log('\n6. キャッシュクリアのテスト');
    const cleared = openaiModel.clearCache();
    console.log('キャッシュクリア結果:', cleared ? '成功' : '失敗');
    console.log('キャッシュ統計:', openaiModel.getCacheStats());
    
    console.log('\nテストが完了しました');
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
}

// スクリプト実行
main().catch(console.error);
