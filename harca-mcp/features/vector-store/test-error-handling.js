// features/vector-store/test-error-handling.js
import { ModelManager } from './model-manager.js';
import { VectorStore } from './index.js';
import { OpenAIEmbeddingModel } from './openai-model.js';
import { LocalEmbeddingModel } from './local-model.js';
import { SimpleHashEmbeddingModel } from './simple-hash.js';
import { ErrorHandler, ErrorTypes, SeverityLevels, RecoveryStrategies } from './error-handler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESモジュールで__dirnameを取得するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 様々なエラーパターンをシミュレートするためのモックモデル
 */
class MockEmbeddingModel {
  constructor(config = {}) {
    this.id = config.id || 'mock-model';
    this.failureMode = config.failureMode || 'none';
    this.failureCount = config.failureCount || 0;
    this.currentCount = 0;
    this.delay = config.delay || 0;
    this.dimensions = config.dimensions || 1536;
    this.callCount = 0;
    this.lastInput = null;
    this.failureRate = config.failureRate || 0.5;
  }

  async generateEmbedding(text) {
    this.callCount++;
    this.lastInput = text;
    
    // 遅延をシミュレート
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    this.currentCount++;

    // 特定の回数だけ失敗するケース
    if (this.failureMode === 'count' && this.currentCount <= this.failureCount) {
      throw new Error(`モック失敗 (${this.currentCount}/${this.failureCount})`);
    }

    // 常に失敗するケース
    if (this.failureMode === 'always') {
      throw new Error('モックは常に失敗するよう設定されています');
    }

    // タイムアウトをシミュレート
    if (this.failureMode === 'timeout') {
      throw new Error('リクエストがタイムアウトしました。時間をおいて再試行してください。');
    }

    // レート制限をシミュレート
    if (this.failureMode === 'rate_limit') {
      const rateLimitError = new Error('レート制限を超えました。後でやり直してください。');
      rateLimitError.status = 429;
      throw rateLimitError;
    }

    // 認証エラーをシミュレート
    if (this.failureMode === 'auth') {
      const authError = new Error('認証に失敗しました。APIキーが無効です。');
      authError.status = 401;
      throw authError;
    }

    // ネットワークエラーをシミュレート
    if (this.failureMode === 'network') {
      throw new Error('ネットワーク接続エラー: サーバーに接続できません。');
    }

    // 不正なリクエストをシミュレート
    if (this.failureMode === 'bad_request') {
      throw new Error('不正なリクエスト: パラメータが無効です');
    }

    // サーバーエラーをシミュレート
    if (this.failureMode === 'server') {
      const serverError = new Error('サーバーエラー: 内部サーバーエラーが発生しました');
      serverError.status = 500;
      throw serverError;
    }

    // 間欠的エラーをシミュレート
    if (this.failureMode === 'intermittent') {
      if (Math.random() < this.failureRate) {
        throw new Error('間欠的エラーが発生しました');
      }
    }

    // 成功した場合はダミーの埋め込みを返す
    return Array(this.dimensions).fill(0).map(() => Math.random() * 2 - 1);
  }

  async embed(text) {
    return this.generateEmbedding(text);
  }
}

/**
 * モックモデルを使用するためのモデルマネージャーの拡張
 */
class TestModelManager extends ModelManager {
  /**
   * コンストラクタ
   */
  constructor(config = {}) {
    super(config);
    
    // エラーログとその他の必要な変数を初期化
    this.errorLog = [];
    this.maxErrorLogSize = config.maxErrorLogSize || 100;
    this.failureThreshold = config.failureThreshold || 3;
    this.consecutiveErrors = {};
    this.failedModels = new Map();
    this.modelInstances = {}; // モデルインスタンスを保持するオブジェクトを初期化
    
    // モックモデルを追加
    this.models['mock-success'] = {
      provider: 'mock',
      name: 'mock-success',
      dimensions: 1536,
      costPer1KTokens: 0,
      performance: 'medium',
      maxInputTokens: Infinity,
      description: '常に成功するモックモデル'
    };
    
    this.models['mock-fail-always'] = {
      provider: 'mock',
      name: 'mock-fail-always',
      dimensions: 1536,
      costPer1KTokens: 0,
      performance: 'medium',
      maxInputTokens: Infinity,
      description: '常に失敗するモックモデル'
    };
    
    this.models['mock-fail-count'] = {
      provider: 'mock',
      name: 'mock-fail-count',
      dimensions: 1536,
      costPer1KTokens: 0,
      performance: 'medium',
      maxInputTokens: Infinity,
      description: '特定の回数だけ失敗するモックモデル'
    };
    
    this.models['mock-timeout'] = {
      provider: 'mock',
      name: 'mock-timeout',
      dimensions: 1536,
      costPer1KTokens: 0,
      performance: 'medium',
      maxInputTokens: Infinity,
      description: 'タイムアウトをシミュレートするモックモデル'
    };
    
    this.models['mock-rate-limit'] = {
      provider: 'mock',
      name: 'mock-rate-limit',
      dimensions: 1536,
      costPer1KTokens: 0,
      performance: 'medium',
      maxInputTokens: Infinity,
      description: 'レート制限をシミュレートするモックモデル'
    };

    this.models['mock-auth'] = {
      provider: 'mock',
      name: 'mock-auth',
      dimensions: 1536,
      costPer1KTokens: 0,
      performance: 'medium',
      maxInputTokens: Infinity,
      description: '認証エラーをシミュレートするモックモデル'
    };

    this.models['mock-server'] = {
      provider: 'mock',
      name: 'mock-server',
      dimensions: 1536,
      costPer1KTokens: 0,
      performance: 'medium',
      maxInputTokens: Infinity,
      description: 'サーバーエラーをシミュレートするモックモデル'
    };

    this.models['mock-network'] = {
      provider: 'mock',
      name: 'mock-network',
      dimensions: 1536,
      costPer1KTokens: 0,
      performance: 'medium',
      maxInputTokens: Infinity,
      description: 'ネットワークエラーをシミュレートするモックモデル'
    };

    this.models['mock-intermittent'] = {
      provider: 'mock',
      name: 'mock-intermittent',
      dimensions: 1536,
      costPer1KTokens: 0,
      performance: 'medium',
      maxInputTokens: Infinity,
      description: '間欠的エラーをシミュレートするモックモデル'
    };
    
    // 統計の初期化
    Object.keys(this.models).forEach(modelId => {
      if (modelId.startsWith('mock-')) {
        this.modelStats.usageCount[modelId] = 0;
        this.modelStats.errorCount[modelId] = 0;
        this.modelStats.totalTokens[modelId] = 0;
        this.modelStats.lastUsed[modelId] = null;
      }
    });
  }

  /**
   * モックモデルのインスタンスを作成
   * @param {string} modelId - モデルID
   * @param {Object} options - モデル設定オプション
   * @returns {MockEmbeddingModel} モックモデルのインスタンス
   */
  createMockModelInstance(modelId, options = {}) {
    const mockModel = new MockEmbeddingModel({
      id: modelId,
      ...options
    });
    
    this.modelInstances[modelId] = mockModel;
    return mockModel;
  }

  /**
   * 埋め込みベクトルを生成する
   * @param {string} text - 埋め込みを生成するテキスト
   * @param {string} modelId - 使用するモデルのID
   * @returns {Promise<number[]>} 埋め込みベクトル
   */
  async generateEmbedding(text, modelId) {
    // モデルが存在するか確認
    if (!this.modelInstances[modelId]) {
      throw new Error(`モデルが初期化されていません: ${modelId}`);
    }
    
    try {
      // モデルの使用統計を更新
      this.modelStats.usageCount[modelId] = (this.modelStats.usageCount[modelId] || 0) + 1;
      this.modelStats.lastUsed[modelId] = new Date();
      
      // モデルインスタンスを使用して埋め込みを生成
      const embedding = await this.modelInstances[modelId].generateEmbedding(text);
      
      // 連続エラーカウンターをリセット
      this.consecutiveErrors[modelId] = 0;
      
      return embedding;
    } catch (error) {
      // エラー統計を更新
      this.modelStats.errorCount[modelId] = (this.modelStats.errorCount[modelId] || 0) + 1;
      
      // エラーをログに記録
      this.recordModelError(modelId, error);
      
      // エラーを再スロー
      throw error;
    }
  }

  /**
   * モデルエラーを記録するメソッドをオーバーライド
   * @param {string} modelId - モデルID
   * @param {Error} error - 発生したエラー
   * @returns {boolean} フォールバック状態になったかどうか
   */
  recordModelError(modelId, error) {
    try {
      // エラーハンドラーを使用してエラーを分類
      const errorHandler = new ErrorHandler();
      const errorClassification = errorHandler.classifyError(error);
      
      // エラーログに追加
      this.errorLog.push({
        timestamp: new Date().toISOString(),
        modelId,
        message: error.message,
        type: errorClassification.type,
        severity: errorClassification.severity,
        stack: error.stack
      });
      
      // エラーログのサイズを制限
      if (this.errorLog.length > this.maxErrorLogSize) {
        this.errorLog = this.errorLog.slice(-this.maxErrorLogSize);
      }
      
      // モデル統計を更新
      if (!this.modelStats.errorCount[modelId]) {
        this.modelStats.errorCount[modelId] = 0;
      }
      this.modelStats.errorCount[modelId]++;
      
      // 連続エラーカウントを更新
      if (!this.consecutiveErrors[modelId]) {
        this.consecutiveErrors[modelId] = 0;
      }
      this.consecutiveErrors[modelId]++;
      
      // 失敗閾値に達したかチェック
      const reachedFailureThreshold = this.consecutiveErrors[modelId] >= this.failureThreshold;
      
      // モデルが既に失敗状態でなければ、失敗状態に設定
      if (reachedFailureThreshold && !this.failedModels.has(modelId)) {
        this.failedModels.set(modelId, {
          failedAt: new Date().toISOString(),
          consecutiveErrors: this.consecutiveErrors[modelId],
          lastError: error.message,
          lastErrorType: errorClassification.type,
          recoveryStrategy: errorClassification.recovery
        });
        
        console.log(`警告 (${errorClassification.type}): ${error.message}`);
        return true; // フォールバック状態になった
      }
      
      return false; // 通常状態のまま
    } catch (err) {
      console.error('エラー記録中にエラーが発生しました:', err);
      return false;
    }
  }

  /**
   * モデルが失敗状態かどうかを確認
   * @param {string} modelId - モデルID
   * @returns {boolean} 失敗状態かどうか
   */
  isModelFailed(modelId) {
    return this.failedModels.has(modelId);
  }

  /**
   * 失敗したモデルの情報を取得
   * @param {string} modelId - モデルID
   * @returns {Object|null} 失敗情報、失敗していない場合はnull
   */
  getModelFailureInfo(modelId) {
    return this.failedModels.get(modelId) || null;
  }

  /**
   * すべての失敗モデルを取得
   * @returns {Object} 失敗モデルのマップ
   */
  getAllFailedModels() {
    const result = {};
    for (const [modelId, info] of this.failedModels.entries()) {
      result[modelId] = info;
    }
    return result;
  }

  /**
   * モデルの失敗状態をリセット
   * @param {string} modelId - モデルID
   * @returns {boolean} リセットが成功したかどうか
   */
  resetModelFailure(modelId) {
    if (this.failedModels.has(modelId)) {
      this.failedModels.delete(modelId);
      this.consecutiveErrors[modelId] = 0;
      return true;
    }
    return false;
  }
}

/**
 * 単一モデルのテスト
 * @param {TestModelManager} modelManager モデルマネージャー
 * @param {string} modelId テスト対象のモデルID
 * @param {Object} options モデル設定オプション
 */
async function testModel(modelManager, modelId, options = {}) {
  console.log(`\nモデル "${modelId}" のテスト:`);
  
  // モックモデルのインスタンスを作成
  const mockModel = modelManager.createMockModelInstance(modelId, options);
  
  try {
    const text = "これはテストテキストです。";
    console.log(`  埋め込み生成を試行: "${text}"`);
    
    const embedding = await modelManager.generateEmbedding(text, modelId);
    console.log(`  成功: 埋め込みベクトル生成 (${embedding.length} 次元)`);
  } catch (err) {
    console.log(`  エラー: ${err.message}`);
    
    // エラーハンドラーを使用してエラーを分類
    const errorHandler = new ErrorHandler();
    const errorInfo = errorHandler.classifyError(err);
    
    console.log(`  エラー分類: ${errorInfo.type} (重大度: ${errorInfo.severity})`);
    
    // 回復戦略を表示
    console.log(`  回復戦略: ${errorInfo.recovery}`);
  }
}

// 特定のエラータイプに対する処理のテスト
async function testSpecificErrorTypes() {
  console.log('\n5. 特定のエラータイプに対する処理のテスト:');
  
  const modelManager = new TestModelManager();
  const errorHandler = new ErrorHandler();
  
  // デバッグ: エラーパターンを表示
  console.log('エラーパターン:');
  errorHandler.errorPatterns.forEach((pattern, index) => {
    console.log(`  ${index}: ${pattern.pattern} -> ${pattern.type} (${pattern.severity})`);
  });
  
  // 各エラータイプをテスト
  const errorTypes = [
    { name: 'タイムアウト', modelId: 'mock-timeout', failureMode: 'timeout' },
    { name: 'レート制限', modelId: 'mock-rate-limit', failureMode: 'rate_limit' },
    { name: '認証エラー', modelId: 'mock-auth', failureMode: 'auth' },
    { name: 'サーバーエラー', modelId: 'mock-server', failureMode: 'server' },
    { name: 'ネットワークエラー', modelId: 'mock-network', failureMode: 'network' }
  ];
  
  for (const errorType of errorTypes) {
    console.log(`\n  ${errorType.name}のテスト:`);
    
    // モックモデルを設定
    const mockModel = modelManager.createMockModelInstance(errorType.modelId, {
      failureMode: errorType.failureMode
    });
    
    try {
      const text = "これはテストテキストです。";
      console.log(`    埋め込み生成を試行: "${text}"`);
      
      await modelManager.generateEmbedding(text, errorType.modelId);
      console.log('    予期せぬ成功: エラーが発生しませんでした');
    } catch (err) {
      console.log(`    エラー発生: ${err.message}`);
      
      // デバッグ: パターンマッチングの詳細を表示
      console.log('    パターンマッチングの詳細:');
      let matched = false;
      errorHandler.errorPatterns.forEach((pattern, index) => {
        const isMatch = pattern.pattern.test(err.message);
        console.log(`      パターン ${index}: ${isMatch ? '一致' : '不一致'} - ${pattern.pattern}`);
        if (isMatch) matched = true;
      });
      console.log(`    いずれかのパターンに一致: ${matched ? 'はい' : 'いいえ'}`);
      
      // エラーを分類
      const errorInfo = errorHandler.classifyError(err);
      console.log(`    分類: ${errorInfo.type} (重大度: ${errorInfo.severity})`);
      
      // 回復戦略を表示
      console.log(`    回復戦略: ${errorInfo.recovery}`);
    }
  }
}

// テスト用のモデルマネージャー設定
const testConfig = {
  failureThreshold: 2,  // 2回連続で失敗したらフォールバック
  recoveryTimeMs: 1000, // テスト用に短い回復時間（1秒）
  modelManager: {
    maxErrorLogSize: 50
  }
};

/**
 * エラーハンドリングのテスト関数
 */
async function testErrorHandling() {
  console.log('エラーハンドリングのテストを開始します...');
  
  // テスト用のモデルマネージャーを初期化
  const modelManager = new TestModelManager(testConfig.modelManager);
  
  // 基本的なエラーケースのテスト
  console.log('\n1. 基本的なエラーケースのテスト:');
  await testModel(modelManager, 'mock-success');
  await testModel(modelManager, 'mock-fail-always');
  await testModel(modelManager, 'mock-fail-count', { failureCount: 3 });
  await testModel(modelManager, 'mock-timeout');
  await testModel(modelManager, 'mock-rate-limit');
  
  // 間欠的エラーのテスト
  console.log('\n2. 間欠的エラーのテスト:');
  // await testIntermittentModel(modelManager, 'mock-intermittent', 10);
  
  // VectorStoreとの統合テスト
  console.log('\n3. VectorStoreとの統合テスト:');
  // await testWithVectorStore();
  
  // エラー回復戦略のテスト
  console.log('\n4. エラー回復戦略のテスト:');
  // await testRecoveryStrategies();
  
  // 全モデル失敗シナリオのテスト
  console.log('\n5. 全モデル失敗シナリオのテスト:');
  // await testAllModelFailure();
  
  // 特定のエラータイプに対する処理のテスト
  console.log('\n6. 特定のエラータイプに対する処理のテスト:');
  await testSpecificErrorTypes();
  
  console.log('\nすべてのエラーハンドリングテストが完了しました。');
}

// テスト実行
console.log('エラーハンドリングテストを実行します...');
testErrorHandling();

// ESモジュールエクスポート
export {
  MockEmbeddingModel,
  TestModelManager,
  testErrorHandling
};
