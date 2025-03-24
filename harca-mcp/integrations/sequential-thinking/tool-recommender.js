/**
 * Sequential Thinking ツール推奨クライアント
 * 
 * このモジュールは、Sequential Thinkingサービスと通信し、
 * ユーザーの思考プロセスに基づいて最適なツールを推奨し、問題解決を支援します。
 */

import fetch from 'node-fetch';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import { defaultCache } from './utils/cache.js';
import { withRetry, getUserFriendlyMessage, logError, wrapError } from './utils/error-handler.js';

/**
 * Sequential Thinkingサービスとの通信を担当するクライアントクラス
 */
class ToolRecommenderClient {
  /**
   * ToolRecommenderClientのコンストラクタ
   * @param {Object} options - 設定オプション
   * @param {string} options.serviceUrl - Sequential ThinkingサービスのサービスURL
   * @param {number} options.timeout - リクエストタイムアウト（ミリ秒）
   * @param {number} options.retries - 失敗時の再試行回数
   * @param {boolean} options.debug - デバッグモードを有効にするかどうか
   * @param {Object} options.cache - キャッシュオブジェクト
   */
  constructor(options = {}) {
    this.serviceUrl = options.serviceUrl || config.service.url;
    this.timeout = options.timeout || config.service.timeout;
    this.retries = options.retries || config.service.retries;
    this.debug = options.debug || config.debug;
    this.cache = options.cache || defaultCache;
    this.healthCheckStatus = false;
    this.lastHealthCheck = 0;
    
    if (this.debug) {
      logger.debug(`[ToolRecommender] 初期化: URL=${this.serviceUrl}, タイムアウト=${this.timeout}ms, 再試行=${this.retries}`);
    }
  }
  
  /**
   * 思考テキストに基づいてツールを推奨
   * @param {string} thought - 思考テキスト
   * @param {Object} options - オプション
   * @returns {Promise<Array>} 推奨ツールのリスト
   */
  async getRecommendations(thought, options = {}) {
    if (!thought) {
      throw new Error('思考テキストが指定されていません');
    }
    
    // オプションのマージ
    const mergedOptions = {
      ...options
    };
    
    // キャッシュキーの生成
    const cacheKey = `recommendations:${thought}`;
    
    // キャッシュから結果を取得（有効な場合）
    if (this.cache.enabled && !mergedOptions.skipCache) {
      const cachedResult = this.cache.get(cacheKey);
      if (cachedResult) {
        if (this.debug) {
          logger.debug(`[ToolRecommender] キャッシュヒット: ${cacheKey}`);
        }
        return cachedResult;
      }
    }
    
    try {
      // JSON-RPCリクエストの準備
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'mcp.runTool',
        params: {
          name: 'sequentialthinking',
          arguments: {
            thought: thought,
            thoughtNumber: 1,
            totalThoughts: 1,
            nextThoughtNeeded: false,
            includeToolRecommendations: true
          }
        }
      };
      
      // リクエストオプションの準備
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(jsonRpcRequest),
        timeout: this.timeout
      };
      
      // Sequential Thinkingサービスにリクエストを送信（リトライ機能付き）
      const response = await withRetry(
        async () => {
          return await fetch(this.serviceUrl, requestOptions);
        },
        {
          retries: this.retries,
          context: 'ToolRecommender'
        }
      );
      
      if (!response.ok) {
        throw new Error(`Sequential Thinkingサービスがステータス ${response.status} を返しました`);
      }
      
      const data = await response.json();
      
      // レスポンスの検証
      if (data.error) {
        throw new Error(`JSON-RPCエラー: ${data.error.message}`);
      }
      
      if (!data.result || !data.result.content || !data.result.content[0] || !data.result.content[0].text) {
        throw new Error('Sequential Thinkingサービスからの応答が無効です');
      }
      
      // JSON文字列をパース
      const resultData = JSON.parse(data.result.content[0].text);
      
      if (!resultData.toolRecommendations) {
        throw new Error('ツール推奨が見つかりません');
      }
      
      const recommendations = resultData.toolRecommendations;
      
      if (this.debug) {
        logger.debug(`[ToolRecommender] 推奨ツール数: ${recommendations.length}`);
      }
      
      // キャッシュに結果を保存
      if (this.cache.enabled) {
        this.cache.set(cacheKey, recommendations);
      }
      
      return recommendations;
    } catch (error) {
      // エラーをラップして再スロー
      throw wrapError(error, 'ツール推奨エラー', {
        thought: thought.substring(0, 100) + (thought.length > 100 ? '...' : '')
      });
    }
  }
  
  /**
   * 思考プロセスを実行
   * @param {string} thought - 思考テキスト
   * @param {Object} options - オプション
   * @param {number} options.thoughtNumber - 思考番号
   * @param {number} options.totalThoughts - 思考の総数
   * @param {boolean} options.nextThoughtNeeded - 次の思考が必要かどうか
   * @param {boolean} options.includeToolRecommendations - ツール推奨を含めるかどうか
   * @param {string} options.action - 実行するアクション（getCacheStats, clearCache）
   * @returns {Promise<Object>} 思考プロセスの結果
   */
  async processThought(thought, options = {}) {
    // アクションパラメータを確認
    if (options.action === 'getCacheStats') {
      return this.getCacheStats();
    } else if (options.action === 'clearCache') {
      return this.clearCache();
    }
    
    try {
      // JSON-RPCリクエストの準備
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'mcp.runTool',
        params: {
          name: 'sequentialthinking',
          arguments: {
            thought,
            thoughtNumber: options.thoughtNumber || 1,
            totalThoughts: options.totalThoughts || 1,
            nextThoughtNeeded: options.nextThoughtNeeded !== undefined ? options.nextThoughtNeeded : false,
            includeToolRecommendations: options.includeToolRecommendations !== undefined ? options.includeToolRecommendations : false
          }
        }
      };
      
      // リクエストオプションの準備
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(jsonRpcRequest),
        timeout: this.timeout
      };
      
      // Sequential Thinkingサービスにリクエストを送信（リトライ機能付き）
      const response = await withRetry(
        async () => {
          return await fetch(this.serviceUrl, requestOptions);
        },
        {
          retries: this.retries,
          context: 'ToolRecommender'
        }
      );
      
      if (!response.ok) {
        throw new Error(`サービスが異常なステータスを返しました: ${response.status}`);
      }
      
      const data = await response.json();
      
      // レスポンスの検証
      if (data.error) {
        throw new Error(`JSON-RPCエラー: ${data.error.message}`);
      }
      
      if (!data.result || !data.result.content || !data.result.content[0] || !data.result.content[0].text) {
        throw new Error('無効なレスポンス形式');
      }
      
      return JSON.parse(data.result.content[0].text);
    } catch (error) {
      // エラーをラップして再スロー
      throw wrapError(error, '思考プロセスエラー', {
        thought: thought.substring(0, 100) + (thought.length > 100 ? '...' : '')
      });
    }
  }
  
  /**
   * キャッシュ統計を取得
   * @returns {Promise<Object>} キャッシュ統計
   */
  async getCacheStats() {
    try {
      const stats = this.cache.getStats();
      return {
        success: true,
        stats
      };
    } catch (error) {
      return {
        success: false,
        error: getUserFriendlyMessage(error)
      };
    }
  }
  
  /**
   * キャッシュをクリア
   * @returns {Promise<Object>} クリア結果
   */
  async clearCache() {
    try {
      this.cache.clear();
      return {
        success: true,
        message: 'キャッシュがクリアされました'
      };
    } catch (error) {
      return {
        success: false,
        error: getUserFriendlyMessage(error)
      };
    }
  }
  
  /**
   * リクエストを送信し、必要に応じて再試行する
   * @param {Object} mcpRequest - MCPリクエスト
   * @returns {Promise<Response>} fetchレスポンス
   */
  async sendRequestWithRetry(mcpRequest) {
    return withRetry(
      async () => {
        return await fetch(`${this.serviceUrl}/api/sequential-thinking`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mcpRequest),
          timeout: this.timeout
        });
      },
      {
        retries: this.retries,
        context: 'ToolRecommender'
      }
    );
  }
  
  /**
   * サービスの健全性を確認
   * @param {boolean} verbose - 詳細なログを出力するかどうか
   * @returns {Promise<boolean>} サービスが正常に動作しているかどうか
   */
  async checkHealth(verbose = false) {
    try {
      // JSON-RPCリクエストの準備
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'mcp.listTools',
        params: {}
      };
      
      // リクエストオプションの準備
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(jsonRpcRequest),
        timeout: this.timeout
      };
      
      // Sequential Thinkingサービスにリクエストを送信（リトライ機能付き）
      const response = await withRetry(
        async () => {
          return await fetch(this.serviceUrl, requestOptions);
        },
        {
          retries: this.retries,
          context: 'ToolRecommender'
        }
      );
      
      if (!response.ok) {
        if (verbose) {
          logger.warn(`[ToolRecommender] サービスが異常なステータスを返しました: ${response.status}`);
        }
        return false;
      }
      
      const data = await response.json();
      
      // レスポンスの検証
      if (data.error) {
        if (verbose) {
          logger.warn(`[ToolRecommender] JSON-RPCエラー: ${data.error.message}`);
        }
        return false;
      }
      
      // ツール一覧が返されているかを確認
      const isHealthy = data.result && 
                        Array.isArray(data.result.tools) && 
                        data.result.tools.some(tool => tool.name === 'sequentialthinking');
      
      if (verbose) {
        if (isHealthy) {
          logger.info(`[ToolRecommender] サービスは正常に動作しています: ${this.serviceUrl}`);
        } else {
          logger.warn(`[ToolRecommender] サービスは異常に動作しています: ${this.serviceUrl}`);
        }
      }
      
      return isHealthy;
    } catch (error) {
      if (verbose) {
        logger.error(`[ToolRecommender] ヘルスチェックエラー: ${getUserFriendlyMessage(error)}`);
      }
      return false;
    }
  }
  
  /**
   * キャッシュキーを生成する
   * @param {string} operation - 操作名
   * @param {string} thought - 思考テキスト
   * @param {Object} options - オプション
   * @returns {string} キャッシュキー
   */
  generateCacheKey(operation, thought, options) {
    // 思考テキストのハッシュ値を計算（単純化のため最初の100文字を使用）
    const thoughtHash = thought.substring(0, 100);
    
    // オプションから重要なパラメータを抽出
    const { maxResults, minScore, userExperienceLevel } = options;
    
    // キャッシュキーを生成
    return `sequential-thinking:${operation}:${thoughtHash}:${maxResults}:${minScore}:${userExperienceLevel}`;
  }
  
  /**
   * キャッシュをクリアする
   */
  clearCache() {
    this.cache.clear();
    if (this.debug) {
      logger.debug('[ToolRecommender] キャッシュをクリアしました');
    }
  }
  
  /**
   * キャッシュの統計情報を取得する
   * @returns {Object} キャッシュの統計情報
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

// デフォルトのツール推奨クライアント
const defaultToolRecommender = new ToolRecommenderClient({
  serviceUrl: process.env.SEQUENTIAL_THINKING_URL || 'http://localhost:3740',
  timeout: parseInt(process.env.SEQUENTIAL_THINKING_TIMEOUT || '5000', 10),
  retries: parseInt(process.env.SEQUENTIAL_THINKING_RETRIES || '2', 10),
  debug: process.env.DEBUG === 'true',
  cache: defaultCache
});

export { ToolRecommenderClient, defaultToolRecommender };
