// features/vector-store/test-model-manager.js - モデルマネージャーのテスト
import { ModelManager } from './model-manager.js';
import { VectorStore } from './index.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

// ESモジュールで__dirnameを取得するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の読み込み - プロジェクトルートの.envファイルを指定
const envPath = resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });
console.log(`環境変数を読み込みました: ${envPath}`);
console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '設定済み' : '未設定'}`);

/**
 * モデルマネージャーの基本機能をテスト
 */
async function testModelManager() {
  console.log('=== モデルマネージャーのテスト開始 ===');
  
  // モデルマネージャーの初期化
  const modelManager = new ModelManager();
  
  // 利用可能なモデルの表示
  const availableModels = modelManager.getAvailableModels();
  console.log(`利用可能なモデル (${availableModels.length}): ${availableModels.join(', ')}`);
  
  // プロバイダー別のモデル表示
  const openaiModels = modelManager.getModelsByProvider('openai');
  console.log(`OpenAIモデル (${openaiModels.length}): ${openaiModels.join(', ')}`);
  
  const localModels = modelManager.getModelsByProvider('local');
  console.log(`ローカルモデル (${localModels.length}): ${localModels.join(', ')}`);
  
  // アクティブモデルの確認と変更
  console.log(`現在のアクティブモデル: ${modelManager.getActiveModel()}`);
  
  // 各モデルの詳細情報表示
  for (const modelId of availableModels) {
    const modelInfo = modelManager.getModelInfo(modelId);
    console.log(`\nモデル情報: ${modelId}`);
    console.log(`  プロバイダー: ${modelInfo.provider}`);
    console.log(`  名前: ${modelInfo.name}`);
    console.log(`  次元数: ${modelInfo.dimensions}`);
    console.log(`  コスト: ${modelInfo.costPer1KTokens} USD/1Kトークン`);
    console.log(`  パフォーマンス: ${modelInfo.performance}`);
    console.log(`  最大入力トークン: ${modelInfo.maxInputTokens}`);
    console.log(`  説明: ${modelInfo.description}`);
  }
  
  // モデル選択機能のテスト
  console.log('\n--- モデル選択機能のテスト ---');
  
  // コスト優先
  const costModel = modelManager.selectOptimalModel({ prioritizeCost: true });
  console.log(`コスト優先モデル: ${costModel}`);
  
  // パフォーマンス優先
  const perfModel = modelManager.selectOptimalModel({ prioritizePerformance: true });
  console.log(`パフォーマンス優先モデル: ${perfModel}`);
  
  // 速度優先
  const speedModel = modelManager.selectOptimalModel({ prioritizeSpeed: true });
  console.log(`速度優先モデル: ${speedModel}`);
  
  // オフラインモード
  const offlineModel = modelManager.selectOptimalModel({ offlineOnly: true });
  console.log(`オフラインモデル: ${offlineModel}`);
  
  // 次元数に基づくモデル選択
  const dim384Model = modelManager.getModelByDimensions(384);
  console.log(`384次元に最も近いモデル: ${dim384Model}`);
  
  const dim1536Model = modelManager.getModelByDimensions(1536);
  console.log(`1536次元に最も近いモデル: ${dim1536Model}`);
  
  const dim3072Model = modelManager.getModelByDimensions(3072);
  console.log(`3072次元に最も近いモデル: ${dim3072Model}`);
  
  // 環境に基づく自動選択
  const autoModel = modelManager.autoSelectModel();
  console.log(`自動選択モデル: ${autoModel}`);
  
  console.log('\n=== モデルマネージャーのテスト完了 ===\n');
}

/**
 * エラーハンドリングとフォールバックメカニズムのテスト
 */
async function testErrorHandling() {
  console.log('=== エラーハンドリングとフォールバックのテスト開始 ===');
  
  const modelManager = new ModelManager({
    failureThreshold: 2, // 2回失敗したらフォールバック
    recoveryTimeMs: 10000 // 10秒後に回復
  });
  
  // エラー記録のテスト
  console.log('\n--- エラー記録のテスト ---');
  
  const testError = new Error('テスト用エラー');
  const isFailed1 = modelManager.recordModelError('openai-ada-002', testError);
  console.log(`1回目のエラー記録: フォールバック状態=${isFailed1}`);
  
  const isFailed2 = modelManager.recordModelError('openai-ada-002', testError);
  console.log(`2回目のエラー記録: フォールバック状態=${isFailed2}`);
  
  // 失敗状態の確認
  console.log(`モデルの失敗状態: ${modelManager.isModelFailed('openai-ada-002')}`);
  
  // 失敗したモデルへの切り替え試行
  console.log('\n--- 失敗したモデルへの切り替え試行 ---');
  const switchResult = modelManager.setActiveModel('openai-ada-002');
  console.log(`失敗したモデルへの切り替え結果: ${switchResult}`);
  
  // 成功記録のテスト
  console.log('\n--- 成功記録のテスト ---');
  modelManager.recordModelSuccess('openai-ada-002');
  console.log(`成功記録後の失敗状態: ${modelManager.isModelFailed('openai-ada-002')}`);
  
  // 統計情報の確認
  console.log('\n--- モデル統計情報 ---');
  const stats = modelManager.getModelStatsById('openai-ada-002');
  console.log('統計情報:', stats);
  
  console.log('\n=== エラーハンドリングとフォールバックのテスト完了 ===\n');
}

/**
 * VectorStoreとの統合テスト
 */
async function testVectorStoreIntegration() {
  console.log('=== VectorStoreとの統合テスト開始 ===');
  
  // VectorStoreの初期化
  const vectorStore = new VectorStore({
    useCache: true,
    modelManager: {
      defaultModel: 'openai-3-small',
      failureThreshold: 2,
      recoveryTimeMs: 10000
    }
  });
  
  // 利用可能なモデルの表示
  console.log('\n--- 利用可能なモデル ---');
  const models = vectorStore.getAvailableModels();
  console.log(`モデル数: ${models.length}`);
  
  // アクティブモデルの情報表示
  console.log('\n--- アクティブモデル情報 ---');
  const activeModel = vectorStore.getActiveModelInfo();
  console.log(`ID: ${activeModel.id}`);
  console.log(`名前: ${activeModel.name}`);
  console.log(`プロバイダー: ${activeModel.provider}`);
  console.log(`次元数: ${activeModel.dimensions}`);
  
  // 埋め込み生成テスト
  console.log('\n--- 埋め込み生成テスト ---');
  try {
    const testText = 'これは埋め込みベクトル生成のテストです。';
    console.log(`テキスト: "${testText}"`);
    
    console.time('埋め込み生成');
    const embedding = await vectorStore.generateEmbedding(testText);
    console.timeEnd('埋め込み生成');
    
    console.log(`埋め込みベクトルの次元数: ${embedding.length}`);
    console.log(`最初の5要素: [${embedding.slice(0, 5).join(', ')}...]`);
    
    // 2回目の呼び出し（キャッシュ利用）
    console.log('\n--- キャッシュ利用テスト ---');
    console.time('キャッシュ利用');
    const cachedEmbedding = await vectorStore.generateEmbedding(testText);
    console.timeEnd('キャッシュ利用');
    
    console.log(`キャッシュ利用: ${JSON.stringify(embedding.slice(0, 3)) === JSON.stringify(cachedEmbedding.slice(0, 3))}`);
    
    // モデル切り替えテスト
    console.log('\n--- モデル切り替えテスト ---');
    
    // 利用可能なモデルから別のモデルを選択
    const availableModels = vectorStore.getAvailableModels();
    const alternativeModel = availableModels.find(model => 
      model.id !== activeModel.id && model.provider !== 'simple'
    );
    
    if (alternativeModel) {
      console.log(`切り替え先モデル: ${alternativeModel.id}`);
      const switchResult = vectorStore.changeEmbeddingModel(alternativeModel.id);
      console.log(`モデル切り替え結果: ${switchResult}`);
      
      if (switchResult) {
        console.time('新モデルでの埋め込み生成');
        const newEmbedding = await vectorStore.generateEmbedding(testText);
        console.timeEnd('新モデルでの埋め込み生成');
        
        console.log(`新モデルでの埋め込みベクトルの次元数: ${newEmbedding.length}`);
      }
    } else {
      console.log('切り替え可能な代替モデルが見つかりませんでした');
    }
    
    // ステータス情報の取得
    console.log('\n--- ステータス情報 ---');
    const status = await vectorStore.getStatus();
    console.log('ベクトルストア状態:', JSON.stringify(status, null, 2));
    
  } catch (error) {
    console.error('テスト中にエラーが発生しました:', error);
  }
  
  // クリーンアップ
  await vectorStore.cleanup();
  
  console.log('\n=== VectorStoreとの統合テスト完了 ===');
}

/**
 * メインテスト関数
 */
async function runTests() {
  try {
    // 基本機能テスト
    await testModelManager();
    
    // エラーハンドリングテスト
    await testErrorHandling();
    
    // VectorStore統合テスト
    await testVectorStoreIntegration();
    
    console.log('\n*** すべてのテストが完了しました ***');
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  }
}

// テストの実行
runTests();
