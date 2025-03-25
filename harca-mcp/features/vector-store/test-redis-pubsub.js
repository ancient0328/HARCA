/**
 * Redis PubSubイベントリスナーのテストスクリプト
 * 
 * このスクリプトは、Redis PubSubを使用したキャッシュ無効化イベントの
 * 伝播と処理をテストします。複数のキャッシュインスタンス間での
 * 同期機能を検証します。
 */

import { EmbeddingCache } from './embedding-cache.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESモジュールで__dirnameを取得するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// テスト結果の保存
const results = {
  tests: [],
  summary: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0
  }
};

/**
 * テスト結果をファイルに保存する
 */
function saveTestResults() {
  const resultsDir = path.join(__dirname, 'test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const resultsFile = path.join(resultsDir, `redis-pubsub-test-${timestamp}.json`);
  
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), 'utf8');
  console.log(`テスト結果を保存しました: ${resultsFile}`);
}

/**
 * 指定された時間だけ待機する
 * @param {number} ms ミリ秒
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Redis PubSubイベントリスナーのテスト実行関数
 */
async function runTests() {
  console.log('Redis PubSubイベントリスナーのテストを開始します...');
  
  // テスト結果を記録する関数
  function recordTestResult(name, success, message, details = {}) {
    const result = {
      name,
      success,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${name}: ${message}`);
    
    results.tests.push({
      name: name,
      passed: success,
      message: message,
      details: details,
      timestamp: new Date().toISOString()
    });
    
    results.summary.totalTests++;
    if (success) {
      results.summary.passedTests++;
    } else {
      results.summary.failedTests++;
    }
  }
  
  // タイムアウト設定
  const testTimeout = setTimeout(() => {
    console.error('テストがタイムアウトしました。処理を中断します。');
    process.exit(1);
  }, 10000); // 10秒のタイムアウト
  
  // 3つのキャッシュインスタンスを作成（同じRedisサーバーを使用）
  let instance1 = null;
  let instance2 = null;
  let instance3 = null;
  
  try {
    // インスタンス1: すべてのキャッシュを有効化
    instance1 = new EmbeddingCache({
      enableMemoryCache: true,
      enableRedisCache: true,
      enableFileCache: true,
      redisUrl: process.env.REDIS_URL || 'redis://localhost:3710',
      cacheDir: path.join(__dirname, '.cache/pubsub-test/instance1'),
      enableDetailedStats: true,
      instanceId: 'instance1'
    });
    
    // インスタンス2: メモリキャッシュとRedisキャッシュのみ有効化
    instance2 = new EmbeddingCache({
      enableMemoryCache: true,
      enableRedisCache: true,
      enableFileCache: false,
      redisUrl: process.env.REDIS_URL || 'redis://localhost:3710',
      cacheDir: path.join(__dirname, '.cache/pubsub-test/instance2'),
      enableDetailedStats: true,
      instanceId: 'instance2'
    });
    
    // インスタンス3: すべてのキャッシュを有効化（異なるディレクトリ）
    instance3 = new EmbeddingCache({
      enableMemoryCache: true,
      enableRedisCache: true,
      enableFileCache: true,
      redisUrl: process.env.REDIS_URL || 'redis://localhost:3710',
      cacheDir: path.join(__dirname, '.cache/pubsub-test/instance3'),
      enableDetailedStats: true,
      instanceId: 'instance3'
    });
    
    // テスト1: キャッシュインスタンスの初期化
    console.log('\n--- テスト1: キャッシュインスタンスの初期化 ---');
    recordTestResult(
      'キャッシュインスタンスの初期化',
      instance1 !== null && instance2 !== null && instance3 !== null,
      '3つのキャッシュインスタンスが正常に初期化されました'
    );
    
    // すべてのキャッシュをクリア
    console.log('すべてのキャッシュをクリアします...');
    await instance1.clear();
    await sleep(500); // PubSubメッセージが伝播するのを待つ
    
    // テスト2: キャッシュへのデータ設定
    console.log('\n--- テスト2: キャッシュへのデータ設定 ---');
    const testData = [
      { text: 'PubSubテスト1', embedding: [0.1, 0.2, 0.3], modelName: 'test-model-1' },
      { text: 'PubSubテスト2', embedding: [0.2, 0.3, 0.4], modelName: 'test-model-1' },
      { text: 'PubSubテスト3', embedding: [0.3, 0.4, 0.5], modelName: 'test-model-2' },
      { text: 'PubSubテスト4', embedding: [0.4, 0.5, 0.6], modelName: 'test-model-2' },
      { text: 'PubSubテスト5', embedding: [0.5, 0.6, 0.7], modelName: 'test-model-3' }
    ];
    
    // インスタンス1にデータを設定
    console.log('インスタンス1にデータを設定します...');
    for (const item of testData) {
      await instance1.set(item.text, item.embedding, item.modelName);
      console.log(`  設定: "${item.text}" (${item.modelName})`);
    }
    
    recordTestResult(
      'キャッシュへのデータ設定',
      true,
      `5個のアイテムをインスタンス1に設定しました`
    );
    
    // インスタンス2と3でデータを取得（Redisから取得されるはず）
    console.log('インスタンス2と3でデータを取得します...');
    let allDataRetrieved = true;
    for (const item of testData) {
      console.log(`  取得: "${item.text}" (${item.modelName})`);
      try {
        const embedding2 = await instance2.get(item.text, item.modelName);
        const embedding3 = await instance3.get(item.text, item.modelName);
        
        if (!embedding2 || !embedding3) {
          console.log(`    ❌ データ取得失敗: "${item.text}" (${item.modelName})`);
          allDataRetrieved = false;
          break;
        } else {
          console.log(`    ✅ データ取得成功: "${item.text}" (${item.modelName})`);
        }
      } catch (error) {
        console.error(`    ❌ データ取得エラー: "${item.text}" (${item.modelName})`, error.message);
        allDataRetrieved = false;
        break;
      }
    }
    
    recordTestResult(
      'Redisキャッシュからのデータ取得',
      allDataRetrieved,
      '他のインスタンスからすべてのデータを取得できました'
    );
    
    // テスト3: invalidateイベントのテスト
    console.log('\n--- テスト3: invalidateイベントのテスト ---');
    try {
      const keyToInvalidate = await instance1.generateKey(testData[0].text, testData[0].modelName);
      console.log(`キャッシュキー "${keyToInvalidate}" を無効化します...`);
      await instance1.delete(testData[0].text, testData[0].modelName);
      
      // PubSubメッセージが伝播するのを待つ
      console.log('PubSubメッセージが伝播するのを待っています...');
      await sleep(500);
      
      // インスタンス2と3でキャッシュが無効化されたか確認
      console.log('インスタンス2と3でキャッシュが無効化されたか確認します...');
      const instance2Data = await instance2.get(testData[0].text, testData[0].modelName);
      const instance3Data = await instance3.get(testData[0].text, testData[0].modelName);
      
      console.log(`  インスタンス2のデータ: ${instance2Data === null ? '無効化済み' : '有効'}`);
      console.log(`  インスタンス3のデータ: ${instance3Data === null ? '無効化済み' : '有効'}`);
      
      recordTestResult(
        'invalidateイベントの伝播',
        instance2Data === null && instance3Data === null,
        'invalidateイベントが他のインスタンスに正しく伝播されました',
        {
          invalidatedKey: keyToInvalidate,
          instance2HasData: instance2Data !== null,
          instance3HasData: instance3Data !== null
        }
      );
    } catch (error) {
      console.error('invalidateイベントのテスト中にエラーが発生しました:', error);
      recordTestResult(
        'invalidateイベントの伝播',
        false,
        `エラー: ${error.message}`
      );
    }
    
    // テスト4: clearModelイベントのテスト
    console.log('\n--- テスト4: clearModelイベントのテスト ---');
    try {
      await instance1.clearModelCache('test-model-1');
      
      // PubSubメッセージが伝播するのを待つ
      console.log('PubSubメッセージが伝播するのを待っています...');
      await sleep(500);
      
      // インスタンス2と3でモデルのキャッシュが無効化されたか確認
      console.log('インスタンス2と3でモデルのキャッシュが無効化されたか確認します...');
      const model1Item = testData[1]; // test-model-1の残りのアイテム
      const model1Instance2 = await instance2.get(model1Item.text, model1Item.modelName);
      const model1Instance3 = await instance3.get(model1Item.text, model1Item.modelName);
      
      // test-model-2のアイテムは残っているはず
      const model2Item = testData[2]; // test-model-2のアイテム
      const model2Instance2 = await instance2.get(model2Item.text, model2Item.modelName);
      const model2Instance3 = await instance3.get(model2Item.text, model2Item.modelName);
      
      console.log(`  インスタンス2のモデル1データ: ${model1Instance2 === null ? '無効化済み' : '有効'}`);
      console.log(`  インスタンス3のモデル1データ: ${model1Instance3 === null ? '無効化済み' : '有効'}`);
      console.log(`  インスタンス2のモデル2データ: ${model2Instance2 === null ? '無効化済み' : '有効'}`);
      console.log(`  インスタンス3のモデル2データ: ${model2Instance3 === null ? '無効化済み' : '有効'}`);
      
      recordTestResult(
        'clearModelイベントの伝播',
        model1Instance2 === null && model1Instance3 === null && model2Instance2 !== null && model2Instance3 !== null,
        'clearModelイベントが他のインスタンスに正しく伝播されました',
        {
          clearedModel: 'test-model-1',
          model1ClearedFromInstance2: model1Instance2 === null,
          model1ClearedFromInstance3: model1Instance3 === null,
          model2StillInInstance2: model2Instance2 !== null,
          model2StillInInstance3: model2Instance3 !== null
        }
      );
    } catch (error) {
      console.error('clearModelイベントのテスト中にエラーが発生しました:', error);
      recordTestResult(
        'clearModelイベントの伝播',
        false,
        `エラー: ${error.message}`
      );
    }
    
    // テスト5: bulkDeleteイベントのテスト
    console.log('\n--- テスト5: bulkDeleteイベントのテスト ---');
    try {
      // パターンに一致するキーを一括削除
      const pattern = 'PubSubテスト*:test-model-2';
      await instance1.bulkDelete(pattern);
      
      // PubSubメッセージが伝播するのを待つ
      console.log('PubSubメッセージが伝播するのを待っています...');
      await sleep(500);
      
      // インスタンス2と3でパターンに一致するキャッシュが無効化されたか確認
      console.log('インスタンス2と3でパターンに一致するキャッシュが無効化されたか確認します...');
      const model2Item1 = testData[2]; // test-model-2のアイテム1
      const model2Item2 = testData[3]; // test-model-2のアイテム2
      
      const model2Item1Instance2 = await instance2.get(model2Item1.text, model2Item1.modelName);
      const model2Item1Instance3 = await instance3.get(model2Item1.text, model2Item1.modelName);
      const model2Item2Instance2 = await instance2.get(model2Item2.text, model2Item2.modelName);
      const model2Item2Instance3 = await instance3.get(model2Item2.text, model2Item2.modelName);
      
      // test-model-3のアイテムは残っているはず
      const model3Item = testData[4]; // test-model-3のアイテム
      const model3Instance2 = await instance2.get(model3Item.text, model3Item.modelName);
      const model3Instance3 = await instance3.get(model3Item.text, model3Item.modelName);
      
      console.log(`  インスタンス2のモデル2アイテム1データ: ${model2Item1Instance2 === null ? '無効化済み' : '有効'}`);
      console.log(`  インスタンス3のモデル2アイテム1データ: ${model2Item1Instance3 === null ? '無効化済み' : '有効'}`);
      console.log(`  インスタンス2のモデル2アイテム2データ: ${model2Item2Instance2 === null ? '無効化済み' : '有効'}`);
      console.log(`  インスタンス3のモデル2アイテム2データ: ${model2Item2Instance3 === null ? '無効化済み' : '有効'}`);
      console.log(`  インスタンス2のモデル3データ: ${model3Instance2 === null ? '無効化済み' : '有効'}`);
      console.log(`  インスタンス3のモデル3データ: ${model3Instance3 === null ? '無効化済み' : '有効'}`);
      
      recordTestResult(
        'bulkDeleteイベントの伝播',
        model2Item1Instance2 === null && model2Item1Instance3 === null &&
        model2Item2Instance2 === null && model2Item2Instance3 === null &&
        model3Instance2 !== null && model3Instance3 !== null,
        'bulkDeleteイベントが他のインスタンスに正しく伝播されました',
        {
          pattern: pattern,
          model2ItemsDeleted: model2Item1Instance2 === null && model2Item1Instance3 === null &&
                             model2Item2Instance2 === null && model2Item2Instance3 === null,
          model3ItemsPreserved: model3Instance2 !== null && model3Instance3 !== null
        }
      );
    } catch (error) {
      console.error('bulkDeleteイベントのテスト中にエラーが発生しました:', error);
      recordTestResult(
        'bulkDeleteイベントの伝播',
        false,
        `エラー: ${error.message}`
      );
    }
    
    // テスト6: clearイベントのテスト
    console.log('\n--- テスト6: clearイベントのテスト ---');
    try {
      // インスタンス3に新しいデータを設定
      const newItem = { text: 'PubSubテスト新規', embedding: [0.8, 0.9, 1.0], modelName: 'test-model-4' };
      await instance3.set(newItem.text, newItem.embedding, newItem.modelName);
      
      // インスタンス1と2で取得できることを確認
      const newItemInstance1 = await instance1.get(newItem.text, newItem.modelName);
      const newItemInstance2 = await instance2.get(newItem.text, newItem.modelName);
      
      const newItemRetrieved = newItemInstance1 !== null && newItemInstance2 !== null;
      
      // すべてのキャッシュをクリア
      await instance1.clear();
      
      // PubSubメッセージが伝播するのを待つ
      console.log('PubSubメッセージが伝播するのを待っています...');
      await sleep(500);
      
      // すべてのインスタンスでキャッシュがクリアされたか確認
      const clearedInstance1 = await instance1.get(newItem.text, newItem.modelName);
      const clearedInstance2 = await instance2.get(newItem.text, newItem.modelName);
      const clearedInstance3 = await instance3.get(newItem.text, newItem.modelName);
      
      console.log(`  インスタンス1のデータ: ${clearedInstance1 === null ? 'クリア済み' : '有効'}`);
      console.log(`  インスタンス2のデータ: ${clearedInstance2 === null ? 'クリア済み' : '有効'}`);
      console.log(`  インスタンス3のデータ: ${clearedInstance3 === null ? 'クリア済み' : '有効'}`);
      
      recordTestResult(
        'clearイベントの伝播',
        newItemRetrieved && clearedInstance1 === null && clearedInstance2 === null && clearedInstance3 === null,
        'clearイベントが他のインスタンスに正しく伝播されました',
        {
          newItemRetrievedBeforeClear: newItemRetrieved,
          allInstancesCleared: clearedInstance1 === null && clearedInstance2 === null && clearedInstance3 === null
        }
      );
    } catch (error) {
      console.error('clearイベントのテスト中にエラーが発生しました:', error);
      recordTestResult(
        'clearイベントの伝播',
        false,
        `エラー: ${error.message}`
      );
    }
    
    // テスト7: 統計情報の確認
    console.log('\n--- テスト7: 統計情報の確認 ---');
    try {
      const stats1 = await instance1.getStats();
      const stats2 = await instance2.getStats();
      const stats3 = await instance3.getStats();
      
      console.log(`  インスタンス1の統計情報: ${JSON.stringify(stats1)}`);
      console.log(`  インスタンス2の統計情報: ${JSON.stringify(stats2)}`);
      console.log(`  インスタンス3の統計情報: ${JSON.stringify(stats3)}`);
      
      recordTestResult(
        '同期統計情報',
        stats1.syncs && stats2.syncs && stats3.syncs,
        '同期統計情報が正しく記録されています',
        {
          instance1Syncs: {
            memory: stats1.syncs.memory,
            file: stats1.syncs.file,
            total: stats1.syncs.total
          },
          instance2Syncs: {
            memory: stats2.syncs.memory,
            file: stats2.syncs.file,
            total: stats2.syncs.total
          },
          instance3Syncs: {
            memory: stats3.syncs.memory,
            file: stats3.syncs.file,
            total: stats3.syncs.total
          }
        }
      );
    } catch (error) {
      console.error('統計情報の確認中にエラーが発生しました:', error);
      recordTestResult(
        '同期統計情報',
        false,
        `エラー: ${error.message}`
      );
    }
    
    // テスト終了
    clearTimeout(testTimeout);
    
    // 結果のサマリーを表示
    console.log('\n=== テスト結果サマリー ===');
    console.log(`総テスト数: ${results.summary.totalTests}`);
    console.log(`成功: ${results.summary.passedTests}`);
    console.log(`失敗: ${results.summary.failedTests}`);
    
    // テスト結果を保存
    saveTestResults();
    
    console.log('\n=== Redis PubSubイベントリスナーのテスト完了 ===');
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
    clearTimeout(testTimeout);
    
    // テスト結果を保存
    saveTestResults();
    
    process.exit(1);
  } finally {
    // リソースのクリーンアップ
    if (instance1) {
      await instance1.close();
    }
    if (instance2) {
      await instance2.close();
    }
    if (instance3) {
      await instance3.close();
    }
  }
}

// テストを実行
runTests().catch(error => {
  console.error('テスト実行中に予期しないエラーが発生しました:', error);
  process.exit(1);
});
