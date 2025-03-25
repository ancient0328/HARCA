/**
 * VectorStoreクラスの機能テストスクリプト
 * 修正後のVectorStoreクラスが正常に動作するかを確認します
 */

import { VectorStore } from '../features/vector-store/index.js';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// テスト用のサンプルコード
const sampleCodes = [
  {
    content: `
    /**
     * PostgreSQL接続を初期化する関数
     * @param {Object} config - 設定オブジェクト
     * @returns {Pool} - PostgreSQLコネクションプール
     */
    function initializePostgresConnection(config) {
      const { host, port, user, password, database } = config;
      const connectionString = \`postgres://\${user}:\${password}@\${host}:\${port}/\${database}\`;
      return new Pool({ connectionString });
    }
    `,
    metadata: {
      type: 'function',
      language: 'javascript',
      topic: 'database',
      subtopic: 'postgresql',
      tags: ['connection', 'initialization']
    }
  },
  {
    content: `
    /**
     * Redis PubSubを使用してキャッシュ無効化イベントを発行する
     * @param {string} channel - イベントチャンネル
     * @param {Object} data - イベントデータ
     * @returns {Promise<void>}
     */
    async function publishCacheInvalidationEvent(channel, data) {
      const publisher = redis.createClient({ url: process.env.REDIS_URL });
      await publisher.connect();
      await publisher.publish(channel, JSON.stringify(data));
      await publisher.quit();
    }
    `,
    metadata: {
      type: 'function',
      language: 'javascript',
      topic: 'cache',
      subtopic: 'redis',
      tags: ['pubsub', 'invalidation']
    }
  }
];

// 検索クエリ
const searchQueries = [
  'PostgreSQL接続の初期化方法',
  'Redisを使ったキャッシュ無効化'
];

// タイムアウト設定（30秒）
const TEST_TIMEOUT = 30000;

/**
 * VectorStoreのテストを実行
 */
async function runTests() {
  console.log('VectorStoreクラスの機能テストを開始します...');
  
  // タイムアウトの設定
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('テストがタイムアウトしました'));
    }, TEST_TIMEOUT);
  });
  
  try {
    // VectorStoreのインスタンス化
    console.log('VectorStoreをインスタンス化します...');
    const vectorStore = new VectorStore({
      useCache: true,
      cache: {
        useMemoryCache: true,
        useFileCache: true
      },
      // シンプルハッシュモデルをデフォルトで使用（APIキーが不要）
      defaultModel: 'simple-hash'
    });
    
    // 状態情報の取得
    console.log('\n1. 状態情報の取得');
    const status = await Promise.race([
      vectorStore.getStatus(),
      timeoutPromise
    ]);
    console.log('状態情報:', JSON.stringify(status, null, 2));
    
    if (!status.postgresConnected) {
      console.error('PostgreSQL接続が確立されていません。環境変数を確認してください。');
      console.log('テストを中止します。');
      return;
    }
    
    // サンプルコードのインデックス化
    console.log('\n2. サンプルコードのインデックス化');
    const indexResults = [];
    
    for (const [index, sample] of sampleCodes.entries()) {
      console.log(`サンプル ${index + 1} をインデックス化しています...`);
      try {
        const result = await Promise.race([
          vectorStore.indexCode(sample.content, sample.metadata),
          timeoutPromise
        ]);
        indexResults.push(result);
        console.log(`結果: ${result.success ? '成功' : '失敗'} - ${result.message}`);
        
        if (!result.success) {
          console.error(`エラー: ${result.error}`);
        }
      } catch (error) {
        console.error(`インデックス化中にエラーが発生しました: ${error.message}`);
        indexResults.push({ success: false, error: error.message });
      }
    }
    
    // 検索テスト
    console.log('\n3. 検索テスト');
    
    for (const [index, query] of searchQueries.entries()) {
      console.log(`\nクエリ ${index + 1}: "${query}"`);
      
      try {
        const searchResults = await Promise.race([
          vectorStore.searchSimilarCode(query),
          timeoutPromise
        ]);
        
        console.log(`${searchResults.length}件の結果が見つかりました`);
        
        searchResults.forEach((result, i) => {
          console.log(`\n結果 ${i + 1} (類似度: ${result.similarity.toFixed(4)})`);
          console.log(`メタデータ: ${JSON.stringify(result.metadata)}`);
          console.log(`コンテンツ: ${result.content.substring(0, 100)}...`);
        });
      } catch (error) {
        console.error(`検索中にエラーが発生しました: ${error.message}`);
      }
    }
    
    // 埋め込みモデル情報
    console.log('\n4. 埋め込みモデル情報');
    const modelInfo = vectorStore.getActiveModelInfo();
    console.log('アクティブなモデル:', JSON.stringify(modelInfo, null, 2));
    
    const availableModels = vectorStore.getAvailableModels();
    console.log('利用可能なモデル:', JSON.stringify(availableModels, null, 2));
    
    // クリーンアップ
    if (vectorStore.cleanup && typeof vectorStore.cleanup === 'function') {
      console.log('\nリソースをクリーンアップしています...');
      await vectorStore.cleanup();
    }
    
    console.log('\nVectorStoreクラスの機能テストが完了しました');
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  } finally {
    // 強制終了
    console.log('テストを終了します');
    process.exit(0);
  }
}

// テストの実行
runTests().catch(error => {
  console.error('予期しないエラーが発生しました:', error);
  process.exit(1);
});
