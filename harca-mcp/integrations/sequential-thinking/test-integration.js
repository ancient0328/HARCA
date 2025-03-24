/**
 * Sequential Thinking統合モジュールテスト
 * 
 * このスクリプトは、Sequential Thinking統合モジュールの機能をテストします。
 * 以下の機能をテストします：
 * - ヘルスチェック
 * - ツール推奨
 * - 思考プロセス
 * - キャッシュ機能
 * - エラーハンドリング
 */

import fetch from 'node-fetch';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import { defaultCache } from './utils/cache.js';
import { defaultToolRecommender } from './tool-recommender.js';
import { defaultIntegration } from './index.js';

// テスト設定
const TEST_CONFIG = {
  // テストするAPIエンドポイント
  apiEndpoints: true,
  
  // テストするツール推奨機能
  toolRecommendation: true,
  
  // テストする思考プロセス機能
  thoughtProcess: true,
  
  // テストするキャッシュ機能
  caching: true,
  
  // テストするエラーハンドリング
  errorHandling: true,
  
  // テストデータ
  testThought: 'ユーザーがファイルをアップロードしようとしていますが、エラーが発生しています。どのようなツールを使って問題を診断すべきでしょうか？',
  
  // サービスURL（デフォルトはconfigから取得）
  serviceUrl: process.env.SEQUENTIAL_THINKING_URL || 'http://localhost:3740',
  
  // APIベースURL
  apiBaseUrl: process.env.SEQUENTIAL_THINKING_API_URL || 'http://localhost:3740',
  
  // タイムアウト（ミリ秒）
  timeout: parseInt(process.env.SEQUENTIAL_THINKING_TIMEOUT || '5000', 10),
  
  // リトライ回数
  retries: parseInt(process.env.SEQUENTIAL_THINKING_RETRIES || '2', 10),
  
  // ヘルスチェックのテスト
  healthCheck: process.env.TEST_HEALTH_CHECK !== 'false',
  
  // ツール推奨のテスト
  toolRecommender: process.env.TEST_TOOL_RECOMMENDER !== 'false',
  
  // 思考プロセスのテスト
  sequentialThinking: process.env.TEST_SEQUENTIAL_THINKING !== 'false',
  
  // APIエンドポイントのテスト
  apiEndpoints: process.env.TEST_API_ENDPOINTS !== 'false',
  
  // キャッシュ機能のテスト
  cacheFeature: process.env.TEST_CACHE_FEATURE !== 'false',
  
  // エラーハンドリングのテスト
  errorHandling: process.env.TEST_ERROR_HANDLING !== 'false'
};

/**
 * テスト結果を表示
 * @param {string} testName テスト名
 * @param {boolean} success 成功したかどうか
 * @param {string} message メッセージ
 * @param {Object} details 詳細情報
 */
function displayTestResult(testName, success, message, details = null) {
  const status = success ? '✅ 成功' : '❌ 失敗';
  console.log(`\n[${status}] ${testName}`);
  console.log(`  ${message}`);
  
  if (details) {
    console.log('  詳細:');
    console.log('  ' + JSON.stringify(details, null, 2).replace(/\n/g, '\n  '));
  }
}

/**
 * ヘルスチェックをテスト
 */
async function testHealthCheck() {
  try {
    console.log('\n🔍 ヘルスチェックのテスト...');
    
    // 直接ヘルスチェック
    const isHealthy = await defaultToolRecommender.checkHealth(true);
    
    displayTestResult(
      'ヘルスチェック',
      isHealthy,
      isHealthy 
        ? 'Sequential Thinkingサービスは正常に動作しています'
        : 'Sequential Thinkingサービスは利用できません'
    );
    
    // APIエンドポイントのテスト
    if (TEST_CONFIG.apiEndpoints) {
      try {
        const response = await fetch(`${TEST_CONFIG.apiBaseUrl}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'mcp.listTools',
            params: {}
          })
        });
        const result = await response.json();
        
        displayTestResult(
          'ヘルスチェックAPI',
          response.ok && result.result && Array.isArray(result.result.tools),
          response.ok && result.result && Array.isArray(result.result.tools)
            ? `APIエンドポイントは正常に応答しています: ${result.result.tools.length}ツールが利用可能`
            : `APIエンドポイントエラー: ${result.error || result}`,
          result
        );
      } catch (error) {
        displayTestResult(
          'ヘルスチェックAPI',
          false,
          `APIエンドポイントへの接続エラー: ${error.message}`
        );
      }
    }
    
    return isHealthy;
  } catch (error) {
    displayTestResult(
      'ヘルスチェック',
      false,
      `ヘルスチェックエラー: ${error.message}`
    );
    return false;
  }
}

/**
 * ツール推奨機能をテスト
 */
async function testToolRecommendation() {
  if (!TEST_CONFIG.toolRecommendation) {
    console.log('\n⏩ ツール推奨機能のテストをスキップします');
    return;
  }
  
  try {
    console.log('\n🔍 ツール推奨機能のテスト...');
    
    // 直接ツール推奨
    const recommendations = await defaultToolRecommender.getRecommendations(
      TEST_CONFIG.testThought,
      { availableTools: ['analyzeCode', 'checkHealth', 'sequentialThinking'] }
    );
    
    const success = Array.isArray(recommendations) && recommendations.length > 0;
    
    displayTestResult(
      'ツール推奨',
      success,
      success
        ? `${recommendations.length}件のツールが推奨されました`
        : 'ツールの推奨に失敗しました',
      success ? { recommendations } : null
    );
    
    // APIエンドポイントのテスト
    if (TEST_CONFIG.apiEndpoints) {
      try {
        const response = await fetch(`${TEST_CONFIG.apiBaseUrl}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'mcp.runTool',
            params: {
              name: 'sequentialthinking',
              arguments: {
                thought: TEST_CONFIG.testThought,
                thoughtNumber: 1,
                totalThoughts: 1,
                nextThoughtNeeded: false,
                includeToolRecommendations: true
              }
            }
          })
        });
        
        const result = await response.json();
        
        let success = false;
        let recommendations = [];
        
        if (result.result && result.result.content && result.result.content[0] && result.result.content[0].text) {
          try {
            const resultData = JSON.parse(result.result.content[0].text);
            success = resultData.toolRecommendations && Array.isArray(resultData.toolRecommendations);
            recommendations = resultData.toolRecommendations || [];
          } catch (parseError) {
            console.error('JSON解析エラー:', parseError);
          }
        }
        
        displayTestResult(
          'ツール推奨API',
          success,
          success
            ? `APIエンドポイントは正常に応答しています: ${recommendations.length}件のツールが推奨されました`
            : `APIエンドポイントエラー: ${result.error || JSON.stringify(result)}`,
          result
        );
      } catch (error) {
        displayTestResult(
          'ツール推奨API',
          false,
          `APIエンドポイントへの接続エラー: ${error.message}`
        );
      }
    }
  } catch (error) {
    displayTestResult(
      'ツール推奨',
      false,
      `ツール推奨エラー: ${error.message}`
    );
  }
}

/**
 * 思考プロセス機能をテスト
 */
async function testThoughtProcess() {
  if (!TEST_CONFIG.thoughtProcess) {
    console.log('\n⏩ 思考プロセス機能のテストをスキップします');
    return;
  }
  
  try {
    console.log('\n🔍 思考プロセス機能のテスト...');
    
    // APIエンドポイントのテスト
    if (TEST_CONFIG.apiEndpoints) {
      try {
        const response = await fetch(`${TEST_CONFIG.apiBaseUrl}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'mcp.runTool',
            params: {
              name: 'sequentialthinking',
              arguments: {
                thought: TEST_CONFIG.testThought,
                thoughtNumber: 1,
                totalThoughts: 1,
                nextThoughtNeeded: false,
                includeToolRecommendations: false
              }
            }
          })
        });
        const result = await response.json();
        
        let success = false;
        
        if (result.result && result.result.content && result.result.content[0] && result.result.content[0].text) {
          try {
            const resultData = JSON.parse(result.result.content[0].text);
            success = resultData.thoughtNumber === 1;
          } catch (parseError) {
            console.error('JSON解析エラー:', parseError);
          }
        }
        
        displayTestResult(
          '思考プロセスAPI',
          success,
          success
            ? `思考プロセスAPIは正常に応答しています`
            : `思考プロセスAPIエラー: ${result.error || JSON.stringify(result)}`,
          result
        );
      } catch (error) {
        displayTestResult(
          '思考プロセスAPI',
          false,
          `思考プロセスAPIへの接続エラー: ${error.message}`
        );
      }
    }
  } catch (error) {
    displayTestResult(
      '思考プロセス',
      false,
      `思考プロセスエラー: ${error.message}`
    );
  }
}

/**
 * キャッシュ機能をテスト
 */
async function testCaching() {
  if (!TEST_CONFIG.caching) {
    console.log('\n⏩ キャッシュ機能のテストをスキップします');
    return;
  }
  
  try {
    console.log('\n🔍 キャッシュ機能のテスト...');
    
    // キャッシュをクリア
    defaultCache.clear();
    
    // キャッシュ統計の初期状態を取得
    const initialStats = defaultCache.getStats();
    
    // 1回目のリクエスト（キャッシュミス）
    console.log('  1回目のリクエスト（キャッシュミス）...');
    const startTime1 = Date.now();
    const result1 = await defaultToolRecommender.getRecommendations(
      TEST_CONFIG.testThought,
      { availableTools: ['analyzeCode', 'checkHealth', 'sequentialThinking'] }
    );
    const duration1 = Date.now() - startTime1;
    
    // 2回目のリクエスト（キャッシュヒット）
    console.log('  2回目のリクエスト（キャッシュヒット）...');
    const startTime2 = Date.now();
    const result2 = await defaultToolRecommender.getRecommendations(
      TEST_CONFIG.testThought,
      { availableTools: ['analyzeCode', 'checkHealth', 'sequentialThinking'] }
    );
    const duration2 = Date.now() - startTime2;
    
    // キャッシュ統計の最終状態を取得
    const finalStats = defaultCache.getStats();
    
    // 結果の検証
    const cacheWorking = duration2 < duration1 && finalStats.size > initialStats.size;
    
    displayTestResult(
      'キャッシュ機能',
      cacheWorking,
      cacheWorking
        ? `キャッシュは正常に動作しています: 1回目=${duration1}ms, 2回目=${duration2}ms`
        : 'キャッシュが正常に動作していません',
      {
        initialStats,
        finalStats,
        timings: {
          firstRequest: duration1,
          secondRequest: duration2,
          improvement: `${Math.round((1 - duration2 / duration1) * 100)}%`
        }
      }
    );
    
    // APIエンドポイントのテスト
    if (TEST_CONFIG.apiEndpoints) {
      try {
        // キャッシュ統計APIのテスト
        const clientStats = await defaultToolRecommender.getCacheStats();
        
        displayTestResult(
          'キャッシュ統計API',
          clientStats.success,
          clientStats.success
            ? 'キャッシュ統計APIは正常に応答しています'
            : `キャッシュ統計APIエラー: ${JSON.stringify(clientStats)}`,
          clientStats
        );
        
        // キャッシュクリアAPIのテスト
        const clientClear = await defaultToolRecommender.clearCache();
        
        displayTestResult(
          'キャッシュクリアAPI',
          clientClear.success,
          clientClear.success
            ? 'キャッシュクリアAPIは正常に応答しています'
            : `キャッシュクリアAPIエラー: ${JSON.stringify(clientClear)}`,
          clientClear
        );
      } catch (error) {
        displayTestResult(
          'キャッシュAPI',
          false,
          `APIエンドポイントへの接続エラー: ${error.message}`
        );
      }
    }
  } catch (error) {
    displayTestResult(
      'キャッシュ機能',
      false,
      `キャッシュテストエラー: ${error.message}`
    );
  }
}

/**
 * エラーハンドリングをテスト
 */
async function testErrorHandling() {
  if (!TEST_CONFIG.errorHandling) {
    console.log('\n⏩ エラーハンドリングのテストをスキップします');
    return;
  }
  
  try {
    console.log('\n🔍 エラーハンドリングのテスト...');
    
    // 無効なURLでツール推奨クライアントを作成
    const invalidClient = new (defaultToolRecommender.constructor)({
      serviceUrl: 'http://invalid-url-that-does-not-exist:12345',
      timeout: 1000, // 短いタイムアウト
      retries: 1
    });
    
    // エラーが発生することを期待
    try {
      await invalidClient.getRecommendations('テスト思考');
      displayTestResult(
        'エラーハンドリング',
        false,
        'エラーが発生しませんでした（エラーが発生することを期待していました）'
      );
    } catch (error) {
      // エラーが発生したことを確認
      displayTestResult(
        'エラーハンドリング',
        true,
        `期待通りエラーが発生しました: ${error.message}`
      );
    }
    
    // APIエンドポイントのテスト
    if (TEST_CONFIG.apiEndpoints) {
      try {
        // 無効なリクエストを送信（無効なメソッド名）
        const response = await fetch(`${TEST_CONFIG.apiBaseUrl}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'invalid.method',
            params: {}
          })
        });
        
        const result = await response.json();
        
        // JSON-RPCエラーを期待
        const hasJsonRpcError = result.error && result.error.code === -32601;
        
        displayTestResult(
          'APIエラーハンドリング',
          hasJsonRpcError,
          hasJsonRpcError
            ? '期待通りのJSON-RPCエラーレスポンスを受信しました'
            : '期待していないレスポンスを受信しました',
          result
        );
      } catch (error) {
        displayTestResult(
          'APIエラーハンドリング',
          false,
          `APIエンドポイントへの接続エラー: ${error.message}`
        );
      }
    }
  } catch (error) {
    displayTestResult(
      'エラーハンドリング',
      false,
      `エラーハンドリングテストエラー: ${error.message}`
    );
  }
}

/**
 * メイン関数
 */
async function main() {
  console.log('🚀 Sequential Thinking統合モジュールテストを開始します');
  console.log(`📡 サービスURL: ${TEST_CONFIG.serviceUrl}`);
  
  // ヘルスチェック
  const isHealthy = await testHealthCheck();
  
  if (isHealthy) {
    // ツール推奨機能のテスト
    await testToolRecommendation();
    
    // 思考プロセス機能のテスト
    await testThoughtProcess();
    
    // キャッシュ機能のテスト
    await testCaching();
  } else {
    console.log('\n⚠️ サービスが利用できないため、残りのテストをスキップします');
  }
  
  // エラーハンドリングのテスト（サービスの状態に関係なく実行）
  await testErrorHandling();
  
  console.log('\n🏁 テスト完了');
}

// メイン関数の実行
main().catch(error => {
  console.error('❌ テスト実行中にエラーが発生しました:', error);
  process.exit(1);
});
