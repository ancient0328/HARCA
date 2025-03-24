/**
 * Sequential Thinking統合モジュール
 * 
 * このモジュールは、Sequential Thinkingサービスの機能をHARCAサーバーに統合します。
 * ツール推奨、思考プロセス、ヘルスチェックなどの機能を提供します。
 */

import express from 'express';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import { defaultCache } from './utils/cache.js';
import { withRetry, getUserFriendlyMessage } from './utils/error-handler.js';
import { ToolRecommenderClient, defaultToolRecommender } from './tool-recommender.js';
import { router as apiRouter, initServer } from './api.js';

/**
 * Sequential Thinking統合クラス
 */
class SequentialThinkingIntegration {
  /**
   * SequentialThinkingIntegrationのコンストラクタ
   * @param {Object} options - 設定オプション
   * @param {Object} options.toolRecommender - ツール推奨クライアント
   * @param {Object} options.cache - キャッシュオブジェクト
   * @param {boolean} options.debug - デバッグモードを有効にするかどうか
   */
  constructor(options = {}) {
    this.toolRecommender = options.toolRecommender || defaultToolRecommender;
    this.cache = options.cache || defaultCache;
    this.debug = options.debug || config.debug;
    this.router = express.Router();
    
    // APIルーターの設定
    this.router.use(config.api.basePath, apiRouter);
    
    if (this.debug) {
      logger.debug('[SequentialThinking] 統合モジュール初期化完了');
    }
  }
  
  /**
   * HARCAサーバーにモジュールを登録
   * @param {Object} app - Expressアプリケーション
   * @param {Object} mcp - MCPサーバーインスタンス
   */
  register(app, mcp) {
    if (!app || !mcp) {
      throw new Error('アプリケーションとMCPサーバーは必須です');
    }
    
    // APIルーターの登録
    app.use(this.router);
    
    // MCPツールの登録
    this.registerMcpTools(mcp);
    
    logger.info('[SequentialThinking] HARCAサーバーに統合モジュールを登録しました');
    
    // 起動時にヘルスチェックを実行
    this.checkHealth();
    
    return this;
  }
  
  /**
   * MCPツールの登録
   * @param {Object} mcp - MCPサーバーインスタンス
   */
  registerMcpTools(mcp) {
    // sequentialThinkingツールの登録
    mcp.tool("sequentialThinking", "構造化された思考プロセスを通じて問題解決を行います",
      {
        properties: {
          thought: {
            type: 'string',
            description: '思考テキスト'
          },
          thoughtNumber: {
            type: 'number',
            description: '現在の思考番号'
          },
          totalThoughts: {
            type: 'number',
            description: '合計思考数'
          },
          nextThoughtNeeded: {
            type: 'boolean',
            description: '次の思考が必要かどうか'
          }
        },
        required: ['thought', 'thoughtNumber', 'totalThoughts', 'nextThoughtNeeded']
      },
      async (params) => {
        try {
          // キャッシュキーの生成
          const cacheKey = `sequential-thinking:process:${params.thought.substring(0, 100)}:${params.thoughtNumber}:${params.totalThoughts}`;
          
          // キャッシュから結果を取得
          const cachedResult = this.cache.get(cacheKey);
          if (cachedResult) {
            if (this.debug) {
              logger.debug(`[SequentialThinking] キャッシュから思考プロセス結果を取得: ${params.thoughtNumber}/${params.totalThoughts}`);
            }
            return cachedResult;
          }
          
          // MCPリクエストの作成
          const mcpRequest = {
            jsonrpc: '2.0',
            id: Date.now().toString(),
            method: 'mcp.runTool',
            params: {
              name: 'sequentialthinking',
              arguments: params
            }
          };
          
          // Sequential Thinkingサービスにリクエストを送信
          const response = await this.toolRecommender.sendRequestWithRetry(mcpRequest);
          
          if (!response.ok) {
            throw new Error(`Sequential Thinkingサービスがステータス ${response.status} を返しました`);
          }
          
          const result = await response.json();
          
          // エラーチェック
          if (result.error) {
            throw new Error(`Sequential Thinkingサービスエラー: ${result.error.message}`);
          }
          
          // レスポンスからコンテンツを抽出
          const content = result.result?.content?.[0]?.text;
          if (!content) {
            throw new Error('Sequential Thinkingサービスから無効なレスポンスを受信しました');
          }
          
          // JSONパース
          const parsedContent = JSON.parse(content);
          
          // 結果をキャッシュに保存
          this.cache.set(cacheKey, parsedContent);
          
          return parsedContent;
        } catch (error) {
          logger.error(`[SequentialThinking] 思考プロセスエラー: ${error.message}`);
          throw new Error(`思考プロセスエラー: ${getUserFriendlyMessage(error)}`);
        }
      }
    );
    
    // recommendToolsツールの登録
    mcp.tool("recommendTools", "思考テキストに基づいて最適なツールを推奨します",
      {
        properties: {
          thought: {
            type: 'string',
            description: '思考テキスト'
          },
          maxResults: {
            type: 'number',
            description: '返す推奨ツールの最大数'
          },
          minScore: {
            type: 'number',
            description: '推奨に含めるための最小スコア（0-1）'
          },
          userExperienceLevel: {
            type: 'number',
            description: 'ユーザーの経験レベル（1-10）'
          },
          includeUsageHints: {
            type: 'boolean',
            description: '使用ヒントを含めるかどうか'
          }
        },
        required: ['thought']
      },
      async (params) => {
        try {
          return await this.toolRecommender.recommendTools(params.thought, {
            maxResults: params.maxResults,
            minScore: params.minScore,
            userExperienceLevel: params.userExperienceLevel,
            includeUsageHints: params.includeUsageHints
          });
        } catch (error) {
          logger.error(`[SequentialThinking] ツール推奨エラー: ${error.message}`);
          throw new Error(`ツール推奨エラー: ${getUserFriendlyMessage(error)}`);
        }
      }
    );
    
    if (this.debug) {
      logger.debug('[SequentialThinking] MCPツールを登録しました');
    }
  }
  
  /**
   * CursorIntegrationのMCPハンドラーにSequential Thinkingツールを登録
   * @param {Object} cursorIntegration - CursorIntegrationインスタンス
   */
  registerCursorTools(cursorIntegration) {
    if (!cursorIntegration || !cursorIntegration.mcpHandler) {
      throw new Error('CursorIntegrationとそのMCPハンドラーは必須です');
    }
    
    // sequentialThinkingツールの登録
    cursorIntegration.mcpHandler.tools.set('sequentialThinking', {
      name: 'sequentialThinking',
      description: '構造化された思考プロセスを通じて問題解決を行います',
      parameters: {
        type: 'object',
        properties: {
          thought: {
            type: 'string',
            description: '思考テキスト'
          },
          thoughtNumber: {
            type: 'number',
            description: '現在の思考番号'
          },
          totalThoughts: {
            type: 'number',
            description: '合計思考数'
          },
          nextThoughtNeeded: {
            type: 'boolean',
            description: '次の思考が必要かどうか'
          }
        },
        required: ['thought', 'thoughtNumber', 'totalThoughts', 'nextThoughtNeeded']
      }
    });
    
    // sequentialThinkingツールの実行ハンドラーを追加
    const originalExecuteTool = cursorIntegration.mcpHandler.handleExecuteTool.bind(cursorIntegration.mcpHandler);
    cursorIntegration.mcpHandler.handleExecuteTool = async function(request) {
      const { toolName, params } = request.params;
      
      if (toolName === 'sequentialThinking') {
        try {
          // Sequential Thinkingサービスにリクエストを送信
          const result = await defaultToolRecommender.processThought(params);
          return {
            jsonrpc: '2.0',
            id: request.id,
            result
          };
        } catch (error) {
          logger.error('[SequentialThinking] 処理エラー:', error);
          throw new Error(`Sequential Thinking処理エラー: ${getUserFriendlyMessage(error)}`);
        }
      }
      
      // 他のツールは元のハンドラーで処理
      return originalExecuteTool(request);
    };
    
    logger.info('[SequentialThinking] CursorIntegrationにツールを登録しました');
  }
  
  /**
   * Sequential Thinkingサービスの健全性をチェック
   * @returns {Promise<boolean>} サービスが利用可能かどうか
   */
  async checkHealth() {
    try {
      const isHealthy = await this.toolRecommender.checkHealth(true);
      
      if (isHealthy) {
        logger.info('[SequentialThinking] サービスは正常に動作しています');
      } else {
        logger.warn('[SequentialThinking] サービスは利用できません');
      }
      
      return isHealthy;
    } catch (error) {
      logger.error(`[SequentialThinking] ヘルスチェックエラー: ${error.message}`);
      return false;
    }
  }
  
  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.cache.clear();
    logger.info('[SequentialThinking] キャッシュをクリアしました');
  }
  
  /**
   * キャッシュの統計情報を取得
   * @returns {Object} キャッシュの統計情報
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

// デフォルトのSequential Thinking統合インスタンス
const defaultIntegration = new SequentialThinkingIntegration({
  debug: config.debug
});

export { SequentialThinkingIntegration, defaultIntegration };
