import { MCPHandler } from './mcp-handler.js';

export class SSEHandler {
  constructor(mcpHandler) {
    this.mcpHandler = mcpHandler;
    this.clients = new Map();
    this.connectionId = 0;
    this.KEEP_ALIVE_INTERVAL = 15000; // 15秒ごとにkeep-aliveを送信
    this.CLIENT_TIMEOUT = 60000; // 60秒のタイムアウト
  }

  /**
   * SSEハンドラーを初期化する
   * @returns {Promise<void>}
   */
  async initialize() {
    console.log('SSEハンドラーを初期化しました');
    
    // 定期的なクライアントの健全性チェック
    setInterval(() => {
      this._checkClientsHealth();
    }, this.KEEP_ALIVE_INTERVAL);
    
    return Promise.resolve();
  }

  /**
   * SSE接続を処理する
   * @param {Request} req - リクエストオブジェクト
   * @param {Response} res - レスポンスオブジェクト
   */
  handleSSEConnection(req, res) {
    // SSEヘッダーを設定
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });

    // 初期データを送信してバッファをフラッシュ
    res.write(':\n\n');

    // クライアントIDを生成
    const clientId = `client-${++this.connectionId}`;
    
    console.log(`新しいSSE接続が確立されました: ${clientId}`);

    // 初期化メッセージを送信
    const initMessage = {
      jsonrpc: '2.0',
      method: 'mcp.ready',
      params: {
        serverInfo: {
          name: 'HARCA-MCP',
          version: '2.0.0',
          transport: 'sse'
        },
        capabilities: {
          supportsNotifications: true,
          supportsCancellation: true,
          supportsProgress: true,
          supportedMethods: [
            'mcp.initialize',
            'mcp.executeTool',
            'mcp.listTools',
            'mcp.toolsChanged'
          ]
        }
      }
    };

    // クライアントを登録
    const client = {
      id: clientId,
      res,
      lastActivity: Date.now(),
      isInitialized: false,
      keepAliveInterval: null
    };
    this.clients.set(clientId, client);
    
    // 初期化メッセージを送信
    this._sendMessage(client, initMessage);
    client.isInitialized = true;
    
    // ツールリストを通知
    this.notifyToolList(client);

    // Keep-aliveメッセージを定期的に送信
    client.keepAliveInterval = setInterval(() => {
      try {
        if (!this._isClientConnected(client)) {
          this._removeClient(clientId);
          return;
        }
        res.write(': keepalive\n\n');
        client.lastActivity = Date.now();
      } catch (error) {
        console.error(`Keep-alive failed for client ${clientId}:`, error);
        this._removeClient(clientId);
      }
    }, this.KEEP_ALIVE_INTERVAL);

    // 接続が閉じられたときの処理
    req.on('close', () => {
      console.log(`SSE接続が閉じられました: ${clientId}`);
      this._removeClient(clientId);
    });

    // エラーハンドリング
    req.on('error', (error) => {
      console.error(`SSE connection error for client ${clientId}:`, error);
      this._removeClient(clientId);
    });

    // タイムアウト設定
    req.setTimeout(0); // タイムアウトを無効化
    res.setTimeout(0); // タイムアウトを無効化
  }

  /**
   * クライアントの健全性をチェックする
   * @private
   */
  _checkClientsHealth() {
    const now = Date.now();
    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastActivity > this.CLIENT_TIMEOUT) {
        console.log(`Client ${clientId} timed out`);
        this._removeClient(clientId);
      }
    }
  }

  /**
   * クライアントが接続されているかチェックする
   * @private
   * @param {Object} client - クライアントオブジェクト
   * @returns {boolean} 接続状態
   */
  _isClientConnected(client) {
    return !client.res.finished && !client.res.destroyed;
  }

  /**
   * ツールリストを通知する
   * @param {Object} client - クライアントオブジェクト
   */
  notifyToolList(client) {
    try {
      // ツールリストを取得
      const tools = this.mcpHandler.getTools();
      
      // ツールリスト通知メッセージを作成
      const notification = {
        jsonrpc: '2.0',
        method: 'mcp.toolsChanged',
        params: {
          tools
        }
      };
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`ツールリスト通知を送信 (${client.id}):`, JSON.stringify(notification, null, 2));
      }
      
      // 通知を送信
      this._sendMessage(client, notification);
    } catch (error) {
      console.error(`ツールリスト通知エラー (${client.id}):`, error);
    }
  }

  /**
   * すべてのクライアントにツールリストの変更を通知する
   */
  notifyAllToolsChanged() {
    for (const client of this.clients.values()) {
      this.notifyToolList(client);
    }
  }

  /**
   * MCPリクエストを処理する
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async handleMCPRequest(req, res) {
    try {
      const request = req.body;
      
      // リクエストの検証
      if (!request.jsonrpc || request.jsonrpc !== '2.0' || !request.method) {
        throw new Error('Invalid JSON-RPC 2.0 request');
      }

      let response;
      
      // 初期化リクエストの特別処理
      if (request.method === 'mcp.initialize') {
        response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            serverInfo: {
              name: 'HARCA-MCP',
              version: '2.0.0',
              transport: 'sse'
            },
            capabilities: {
              supportsNotifications: true,
              supportsCancellation: true,
              supportsProgress: true,
              supportedMethods: [
                'mcp.initialize',
                'mcp.executeTool',
                'mcp.listTools',
                'mcp.toolsChanged'
              ]
            }
          }
        };
      } else {
        // その他のリクエストをMCPハンドラーに転送
        response = await this.mcpHandler.handleRequest(request);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`MCPレスポンス送信: ${request.method}`, JSON.stringify(response, null, 2));
      }

      // 対応するクライアントにレスポンスを送信
      this.broadcast(response);

      // HTTPレスポンスも返す
      res.json(response);
    } catch (error) {
      console.error('Error processing MCP request:', error);
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error.message
        },
        id: req.body?.id || null
      };
      this.broadcast(errorResponse);
      res.status(500).json(errorResponse);
    }
  }

  /**
   * メッセージをクライアントに送信する
   * @private
   * @param {Object} client - クライアントオブジェクト
   * @param {Object} message - 送信するメッセージ
   */
  _sendMessage(client, message) {
    try {
      const data = `data: ${JSON.stringify(message)}\n\n`;
      client.res.write(data);
      client.lastActivity = Date.now();
    } catch (error) {
      console.error(`Error sending message to client ${client.id}:`, error);
      this._removeClient(client.id);
    }
  }

  /**
   * クライアントを削除する
   * @private
   * @param {string} clientId - クライアントID
   */
  _removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      if (client.keepAliveInterval) {
        clearInterval(client.keepAliveInterval);
      }
      try {
        if (this._isClientConnected(client)) {
          client.res.end();
        }
      } catch (error) {
        console.error(`Error closing connection for client ${clientId}:`, error);
      }
      this.clients.delete(clientId);
      console.log(`Client ${clientId} removed`);
    }
  }

  /**
   * メッセージをブロードキャストする
   * @param {Object} message - ブロードキャストするメッセージ
   */
  broadcast(message) {
    const now = Date.now();
    const timeout = 60000; // 60秒

    for (const [clientId, client] of this.clients.entries()) {
      try {
        // タイムアウトチェック
        if (now - client.lastActivity > timeout) {
          console.log(`Client ${clientId} timed out`);
          this._removeClient(clientId);
          continue;
        }

        this._sendMessage(client, message);
      } catch (error) {
        console.error(`Error broadcasting to client ${clientId}:`, error);
        this._removeClient(clientId);
      }
    }
  }
}