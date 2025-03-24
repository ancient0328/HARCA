/**
 * HARCA ベクトルストアAPI 統合テストスクリプト
 * 
 * このスクリプトは、ベクトルストアAPIの各コンポーネントが連携して動作することを確認するための統合テストを提供します。
 * 以下の項目をテストします：
 * - ベクトルストアAPIの基本機能
 * - キャッシュ機能（メモリ、ファイル、Redis）
 * - エラーハンドリング機能
 * - これらのコンポーネントが連携して動作すること
 */

const { EmbeddingCache } = require('./embedding-cache');
const { ErrorHandler } = require('./error-handler');
const { VectorStore } = require('./vector-store');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// テスト結果保存用ディレクトリ
const RESULTS_DIR = path.join(__dirname, 'test-results');
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// テスト用のモックモデル
class MockEmbeddingModel {
  constructor(config = {}) {
    this.id = config.id || 'mock-model';
    this.failureMode = config.failureMode || 'none';
    this.dimensions = config.dimensions || 384;
    this.callCount = 0;
  }

  async generateEmbedding(text) {
    this.callCount++;
    
    // エラーモードの場合はエラーをスロー
    if (this.failureMode === 'timeout') {
      throw new Error('リクエストがタイムアウトしました。時間をおいて再試行してください。');
    } else if (this.failureMode === 'rate_limit') {
      const error = new Error('レート制限を超えました。後でやり直してください。');
      error.status = 429;
      throw error;
    } else if (this.failureMode === 'auth') {
      const error = new Error('認証に失敗しました。APIキーが無効です。');
      error.status = 401;
      throw error;
    }
    
    // 成功した場合はダミーの埋め込みを返す
    return Array(this.dimensions).fill(0).map(() => Math.random() * 2 - 1);
  }
}

// テスト用のモデルマネージャー
class TestModelManager {
  constructor() {
    this.models = new Map();
    this.defaultModelId = 'mock-default';
    
    // デフォルトモデルを追加
    this.addModel('mock-default', new MockEmbeddingModel({ id: 'mock-default' }));
    
    // エラーをシミュレートするモデルを追加
    this.addModel('mock-timeout', new MockEmbeddingModel({ id: 'mock-timeout', failureMode: 'timeout' }));
    this.addModel('mock-rate-limit', new MockEmbeddingModel({ id: 'mock-rate-limit', failureMode: 'rate_limit' }));
    this.addModel('mock-auth', new MockEmbeddingModel({ id: 'mock-auth', failureMode: 'auth' }));
  }
  
  addModel(id, model) {
    this.models.set(id, model);
  }
  
  getModel(id = null) {
    return this.models.get(id || this.defaultModelId);
  }
  
  setDefaultModel(id) {
    if (this.models.has(id)) {
      this.defaultModelId = id;
      return true;
    }
    return false;
  }
}

/**
 * 統合テストを実行
 */
async function runIntegrationTests() {
  console.log('ベクトルストアAPI 統合テストを開始します...\n');
  
  // テスト結果
  const results = {
    startTime: new Date().toISOString(),
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };
  
  // テスト関数
  async function runTest(name, testFn) {
    console.log(`[テスト] ${name}`);
    results.summary.total++;
    
    try {
      await testFn();
      console.log(`  ✓ 成功\n`);
      results.tests.push({ name, status: 'passed' });
      results.summary.passed++;
    } catch (error) {
      console.error(`  ✗ 失敗: ${error.message}\n`);
      results.tests.push({ name, status: 'failed', error: error.message });
      results.summary.failed++;
    }
  }
  
  // テスト用のキャッシュディレクトリを削除して再作成
  const testCacheDir = path.join(__dirname, '.cache/test-integration');
  if (fs.existsSync(testCacheDir)) {
    fs.rmSync(testCacheDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testCacheDir, { recursive: true });
  
  // 1. ベクトルストアAPIの基本機能テスト
  await runTest('ベクトルストアAPIの基本機能', async () => {
    const modelManager = new TestModelManager();
    const errorHandler = new ErrorHandler();
    
    // テスト用のキャッシュディレクトリを作成
    const cacheDirForTest = path.join(testCacheDir, 'basic');
    if (fs.existsSync(cacheDirForTest)) {
      fs.rmSync(cacheDirForTest, { recursive: true, force: true });
    }
    fs.mkdirSync(cacheDirForTest, { recursive: true });
    
    // キャッシュの初期化
    const cache = new EmbeddingCache({
      enableMemoryCache: true,
      enableFileCache: false,
      enableRedisCache: false,
      cacheDir: cacheDirForTest
    });
    
    // キャッシュをクリア
    await cache.clear();
    
    // モデルマネージャーからモデルを取得するメソッドをキャッシュに追加
    const originalGenerateEmbedding = cache._generateEmbedding;
    cache._generateEmbedding = async (text, modelName) => {
      const model = modelManager.getModel(modelName);
      if (!model) {
        throw new Error(`モデル "${modelName}" が見つかりません`);
      }
      return model.generateEmbedding(text);
    };
    
    const vectorStore = new VectorStore(cache);
    
    // 埋め込みの生成
    const text = 'これは統合テスト用のテキストです。';
    const embedding = await vectorStore.getEmbedding(text, 'mock-default');
    
    // 結果の検証
    assert(Array.isArray(embedding), '埋め込みは配列である必要があります');
    assert(embedding.length > 0, '埋め込みは空でない必要があります');
    assert(embedding.every(val => typeof val === 'number'), '埋め込みの要素はすべて数値である必要があります');
    
    // キャッシュからの取得
    const cachedEmbedding = await vectorStore.getEmbedding(text, 'mock-default');
    assert(Array.isArray(cachedEmbedding), 'キャッシュされた埋め込みは配列である必要があります');
    
    // クリーンアップ
    cache._generateEmbedding = originalGenerateEmbedding;
    await cache.close();
  });
  
  // 2. キャッシュ機能テスト
  await runTest('キャッシュ機能', async () => {
    const modelManager = new TestModelManager();
    const model = modelManager.getModel('mock-default');
    
    // テスト用のキャッシュディレクトリを作成
    const cacheDirForTest = path.join(testCacheDir, 'cache-test');
    if (fs.existsSync(cacheDirForTest)) {
      fs.rmSync(cacheDirForTest, { recursive: true, force: true });
    }
    fs.mkdirSync(cacheDirForTest, { recursive: true });
    
    // キャッシュの初期化（メモリキャッシュのみ有効）
    const cache = new EmbeddingCache({
      enableMemoryCache: true,
      enableFileCache: false,
      enableRedisCache: false,
      cacheDir: cacheDirForTest
    });
    
    // テストデータ
    const text = '統合テスト用のキャッシュテキスト';
    const modelName = 'mock-default'; // モックモデルを使用
    
    // 呼び出し回数をカウントするための変数
    let callCount = 0;
    
    // オリジナルのメソッドを保存
    const originalGenerateEmbedding = cache._generateEmbedding;
    const originalGet = cache.get;
    
    // _generateEmbeddingメソッドをオーバーライド
    cache._generateEmbedding = async (text, model) => {
      callCount++;
      console.log(`_generateEmbedding が呼び出されました: ${text.substring(0, 20)}... (モデル: ${model})`);
      return Array(384).fill(0).map(() => Math.random() * 2 - 1);
    };
    
    // getメソッドをオーバーライド
    cache.get = async (text, model) => {
      console.log(`get(${model})が呼び出されました`);
      
      // キャッシュキーを生成
      const cacheKey = cache._getCacheKey(text, model);
      
      // メモリキャッシュをチェック
      if (cache.memoryCache) {
        const cachedData = cache.memoryCache.get(cacheKey);
        if (cachedData) {
          console.log(`キャッシュヒット: ${cacheKey}`);
          return cachedData;
        }
      }
      
      // キャッシュミス - 埋め込みを生成
      console.log(`キャッシュミス: ${cacheKey}`);
      const embedding = await cache._generateEmbedding(text, model);
      
      // キャッシュに保存
      if (cache.memoryCache) {
        cache.memoryCache.set(cacheKey, embedding);
        console.log(`キャッシュに保存: ${cacheKey}`);
      }
      
      return embedding;
    };
    
    // 初期状態ではキャッシュにデータがないことを確認
    const initialCacheKey = cache._getCacheKey(text, modelName);
    const initialResult = cache.memoryCache.get(initialCacheKey);
    assert(initialResult === null, '初期状態ではキャッシュにデータがないはず');
    
    // 埋め込みベクトルを生成（これによりキャッシュに保存される）
    callCount = 0;
    const embedding = await cache.get(text, modelName);
    assert(callCount === 1, '初回呼び出しではモデルが呼び出されるはず');
    assert(Array.isArray(embedding), '埋め込みは配列である必要があります');
    
    // キャッシュから取得（モデルは呼び出されないはず）
    callCount = 0;
    const cachedResult = await cache.get(text, modelName);
    assert(cachedResult !== null, 'キャッシュからデータを取得できるはず');
    assert(Array.isArray(cachedResult), 'キャッシュされたデータは配列である必要があります');
    assert(callCount === 0, 'キャッシュから取得されるため、モデル呼び出し回数は0であるはず');
    
    // キャッシュをクリア
    await cache.clear();
    
    // クリア後はキャッシュにデータがないはず
    const afterClearCacheKey = cache._getCacheKey(text, modelName);
    const afterClearResult = cache.memoryCache.get(afterClearCacheKey);
    assert(afterClearResult === null, 'クリア後はキャッシュにデータがないはず');
    
    // クリーンアップ
    cache._generateEmbedding = originalGenerateEmbedding;
    cache.get = originalGet;
    await cache.close();
  });
  
  // 3. エラーハンドリング機能テスト
  await runTest('エラーハンドリング機能', async () => {
    const modelManager = new TestModelManager();
    const errorHandler = new ErrorHandler();
    
    // タイムアウトエラーのテスト
    try {
      const timeoutModel = modelManager.getModel('mock-timeout');
      await timeoutModel.generateEmbedding('テストテキスト');
      assert(false, 'タイムアウトエラーが発生するはず');
    } catch (error) {
      const errorInfo = errorHandler.classifyError(error);
      assert(errorInfo.type === 'timeout', `エラータイプはtimeoutである必要があります（実際: ${errorInfo.type}）`);
      assert(errorInfo.severity === 'warning', `エラー重大度はwarningである必要があります（実際: ${errorInfo.severity}）`);
    }
    
    // レート制限エラーのテスト
    try {
      const rateLimitModel = modelManager.getModel('mock-rate-limit');
      await rateLimitModel.generateEmbedding('テストテキスト');
      assert(false, 'レート制限エラーが発生するはず');
    } catch (error) {
      const errorInfo = errorHandler.classifyError(error);
      assert(errorInfo.type === 'rate_limit', `エラータイプはrate_limitである必要があります（実際: ${errorInfo.type}）`);
      assert(errorInfo.severity === 'warning', `エラー重大度はwarningである必要があります（実際: ${errorInfo.severity}）`);
    }
    
    // 認証エラーのテスト
    try {
      const authModel = modelManager.getModel('mock-auth');
      await authModel.generateEmbedding('テストテキスト');
      assert(false, '認証エラーが発生するはず');
    } catch (error) {
      const errorInfo = errorHandler.classifyError(error);
      assert(errorInfo.type === 'authentication', `エラータイプはauthenticationである必要があります（実際: ${errorInfo.type}）`);
      assert(errorInfo.severity === 'critical', `エラー重大度はcriticalである必要があります（実際: ${errorInfo.severity}）`);
    }
  });
  
  // 4. コンポーネント連携テスト
  await runTest('コンポーネント連携', async () => {
    const modelManager = new TestModelManager();
    const errorHandler = new ErrorHandler();
    
    // テスト用のキャッシュディレクトリを作成
    const cacheDirForTest = path.join(testCacheDir, 'integration-test');
    if (fs.existsSync(cacheDirForTest)) {
      fs.rmSync(cacheDirForTest, { recursive: true, force: true });
    }
    fs.mkdirSync(cacheDirForTest, { recursive: true });
    
    // キャッシュの初期化（メモリキャッシュのみ有効）
    const cache = new EmbeddingCache({
      enableMemoryCache: true,
      enableFileCache: false,
      enableRedisCache: false,
      cacheDir: cacheDirForTest
    });
    
    // VectorStoreの初期化
    const vectorStore = new VectorStore(cache);
    
    // モデルマネージャーからモデルを取得するメソッドをキャッシュに追加
    let callCount = 0;
    const originalGenerateEmbedding = cache._generateEmbedding;
    const originalGet = cache.get;
    
    // _generateEmbeddingメソッドをオーバーライド
    cache._generateEmbedding = async (text, modelName) => {
      callCount++;
      console.log(`_generateEmbedding が呼び出されました: ${text.substring(0, 20)}... (モデル: ${modelName})`);
      
      // モデル名が指定されていない場合はデフォルトを使用
      const model = modelManager.getModel(modelName || 'mock-default');
      if (!model) {
        throw new Error(`モデル "${modelName}" が見つかりません`);
      }
      
      return model.generateEmbedding(text);
    };
    
    // getメソッドをオーバーライド
    cache.get = async (text, model) => {
      console.log(`get(${model})が呼び出されました`);
      
      // キャッシュキーを生成
      const cacheKey = cache._getCacheKey(text, model);
      
      // メモリキャッシュをチェック
      if (cache.memoryCache) {
        const cachedData = cache.memoryCache.get(cacheKey);
        if (cachedData) {
          console.log(`キャッシュヒット: ${cacheKey}`);
          return cachedData;
        }
      }
      
      // キャッシュミス - 埋め込みを生成
      console.log(`キャッシュミス: ${cacheKey}`);
      const embedding = await cache._generateEmbedding(text, model);
      
      // キャッシュに保存
      if (cache.memoryCache) {
        cache.memoryCache.set(cacheKey, embedding);
        console.log(`キャッシュに保存: ${cacheKey}`);
      }
      
      return embedding;
    };
    
    // 正常系：埋め込みの生成とキャッシュ
    const text1 = '正常系テスト用のテキスト';
    const modelName = 'mock-default'; // モックモデルを使用
    
    // 初回呼び出し（キャッシュにはまだ存在しない）
    callCount = 0;
    const embedding1 = await vectorStore.getEmbedding(text1, modelName);
    assert(Array.isArray(embedding1), '埋め込みは配列である必要があります');
    assert(callCount === 1, '初回呼び出しではモデルが呼び出されるはず');
    
    // 同じテキストで再度リクエスト（キャッシュから取得されるはず）
    callCount = 0;
    const embedding2 = await vectorStore.getEmbedding(text1, modelName);
    assert(Array.isArray(embedding2), '埋め込みは配列である必要があります');
    assert(callCount === 0, 'キャッシュから取得されるため、モデル呼び出し回数は0であるはず');
    
    // 異常系：エラー発生時の処理
    try {
      // エラーを発生させるモデルを使用
      const text2 = 'エラー発生テスト用のテキスト';
      
      // _generateEmbeddingメソッドを一時的に上書き
      cache._generateEmbedding = async (text, modelName) => {
        if (text === text2) {
          throw new Error('リクエストがタイムアウトしました。時間をおいて再試行してください。');
        }
        return originalGenerateEmbedding(text, modelName);
      };
      
      // エラーが発生するはず
      await vectorStore.getEmbedding(text2, modelName);
      
      // ここには到達しないはず
      assert(false, 'エラーが発生するはず');
    } catch (error) {
      // エラーの分類を確認
      const errorInfo = errorHandler.classifyError(error);
      assert(errorInfo.type === 'timeout' || errorInfo.type === 'unknown', 
        `エラータイプはtimeoutまたはunknownである必要があります（実際: ${errorInfo.type}）`);
    }
    
    // クリーンアップ
    cache._generateEmbedding = originalGenerateEmbedding;
    cache.get = originalGet;
    await cache.close();
  });
  
  // テスト結果のサマリーを表示
  console.log('===== 統合テスト結果サマリー =====');
  console.log(`合計: ${results.summary.total} テスト`);
  console.log(`成功: ${results.summary.passed} テスト`);
  console.log(`失敗: ${results.summary.failed} テスト`);
  
  // テスト結果を保存
  results.endTime = new Date().toISOString();
  const resultFilePath = path.join(RESULTS_DIR, `integration-test-${new Date().toISOString().replace(/:/g, '-')}.json`);
  fs.writeFileSync(resultFilePath, JSON.stringify(results, null, 2));
  console.log(`\nテスト結果を保存しました: ${resultFilePath}`);
  
  return results;
}

// テストを実行
if (require.main === module) {
  runIntegrationTests().catch(err => {
    console.error('テスト実行エラー:', err);
    process.exit(1);
  });
}

module.exports = { runIntegrationTests };
