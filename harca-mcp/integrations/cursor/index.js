import express from 'express';
import cors from 'cors';
import { MCPHandler } from './mcp-handler.js';
import { SSEHandler } from './sse-handler.js';

/**
 * Cursor統合クラス
 * CursorとHARCAサーバーの連携を管理する
 */
export class CursorIntegration {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.mcpHandler = new MCPHandler(config);
    this.sseHandler = new SSEHandler(this.mcpHandler);
  }

  /**
   * 初期化処理
   */
  async initialize() {
    try {
      // MCPハンドラーの初期化
      await this.mcpHandler.initialize();
      
      // SSEハンドラーの初期化
      await this.sseHandler.initialize();

      // CORSの設定
      this.app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400 // 24時間
      }));

      // JSONパーサーの設定
      this.app.use(express.json());

      // MCPエンドポイントの設定
      this.app.post('/api/mcp', async (req, res) => {
        try {
          const response = await this.mcpHandler.handleRequest(req.body);
          res.json(response);
        } catch (error) {
          console.error('MCPリクエスト処理エラー:', error);
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal error',
              data: error.message
            },
            id: req.body?.id || null
          });
        }
      });

      // SSEエンドポイントの設定（/api/mcp/sseに統一）
      this.app.get('/api/mcp/sse', async (req, res) => {
        try {
          await this.sseHandler.handleSSEConnection(req, res);
        } catch (error) {
          console.error('SSE接続エラー:', error);
          res.status(500).end();
        }
      });

      // ヘルスチェックエンドポイント
      this.app.get('/health', (req, res) => {
        res.json({
          status: 'ok',
          version: '2.0.0',
          timestamp: new Date().toISOString()
        });
      });

      // エラーハンドリング
      this.app.use((err, req, res, next) => {
        console.error('サーバーエラー:', err);
        res.status(500).json({
          error: 'Internal Server Error',
          message: err.message
        });
      });

      // サーバーの起動
      const port = process.env.PORT || 3700;
      this.app.listen(port, () => {
        console.log(`HARCA MCPサーバーが起動しました - http://localhost:${port}`);
        if (process.env.NODE_ENV === 'development') {
          console.log('開発モードで実行中');
        }
      });

      // ツール変更の通知を設定
      this.mcpHandler.on('toolsChanged', () => {
        this.sseHandler.notifyToolList(this.mcpHandler.getTools());
      });

    } catch (error) {
      console.error('初期化エラー:', error);
      throw error;
    }
  }

  /**
   * MCPリクエストを処理する
   * @param {Object} request - MCPリクエスト
   * @returns {Promise<Object>} MCPレスポンス
   */
  async handleMCPRequest(request) {
    return this.mcpHandler.handleRequest(request);
  }

  /**
   * ツールを登録する
   * @param {string} name - ツール名
   * @param {Object} definition - ツール定義
   * @param {Function} handler - ツールのハンドラー関数
   */
  registerTool(name, definition, handler) {
    this.mcpHandler.registerTool(name, definition, handler);
  }
}

// スタンドアロンモードでの起動
if (process.env.STANDALONE === 'true') {
  const config = {
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3700',
    sequentialThinkingUrl: process.env.SEQUENTIAL_THINKING_URL || 'http://localhost:3740'
  };

  const integration = new CursorIntegration(config);
  integration.initialize().catch(error => {
    console.error('スタンドアロンモード起動エラー:', error);
    process.exit(1);
  });
}