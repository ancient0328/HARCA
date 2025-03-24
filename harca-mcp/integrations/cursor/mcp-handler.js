import fetch from 'node-fetch';
import { EventEmitter } from 'events';

export class MCPHandler extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.tools = new Map();
  }

  /**
   * 初期化処理
   */
  async initialize() {
    // 利用可能なツールの登録
    this.registerTools();
  }

  /**
   * ツールを登録する
   * @param {string} name - ツール名
   * @param {Object} definition - ツール定義
   * @param {Function} handler - ツールのハンドラー関数
   */
  registerTool(name, definition, handler) {
    const normalizedTool = {
      name,
      description: definition.description,
      parameters: {
        type: 'object',
        properties: definition.parameters,
        required: definition.required || []
      },
      execute: handler
    };
    this.tools.set(name, normalizedTool);

    if (process.env.NODE_ENV === 'development') {
      console.log(`ツールを登録しました: ${name}`);
    }
    
    // ツール変更イベントを発行
    this.emit('toolsChanged', this.getTools());
  }

  /**
   * 利用可能なツールを登録する
   */
  registerTools() {
    // コード分析ツール
    this.registerTool('analyzeCode', {
      description: 'コードを分析し、複雑度、コメント率、命名規則、重複などの問題を検出します',
      parameters: {
        code: {
          type: 'string',
          description: '分析するコード'
        },
        language: {
          type: 'string',
          description: 'プログラミング言語'
        }
      },
      required: ['code', 'language']
    }, this.handleAnalyzeCode.bind(this));

    // ドキュメント生成ツール
    this.registerTool('generateDocs', {
      description: 'コードのドキュメントを生成します',
      parameters: {
        code: {
          type: 'string',
          description: 'ドキュメント化するコード'
        },
        format: {
          type: 'string',
          enum: ['markdown', 'jsdoc'],
          description: 'ドキュメントフォーマット'
        }
      },
      required: ['code', 'format']
    }, this.handleGenerateDocs.bind(this));
    
    // Sequential Thinkingツール
    this.registerTool('sequentialThinking', {
      description: '構造化された思考プロセスを通じて問題解決を行います',
      parameters: {
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
    }, this.handleSequentialThinking.bind(this));
  }

  /**
   * 利用可能なツールのリストを取得する
   * @returns {Array} ツールのリスト
   */
  getTools() {
    return Array.from(this.tools.values());
  }

  /**
   * MCPリクエストを処理する
   * @param {Object} request - MCPリクエスト
   * @returns {Promise<Object>} MCPレスポンス
   */
  async handleRequest(request) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('MCPリクエスト受信:', JSON.stringify(request, null, 2));
      }

      // リクエストの基本的な検証
      if (!this._validateRequest(request)) {
        return this._createErrorResponse(-32600, 'Invalid Request', request.id);
      }

      let response;
      
      // メソッドに基づいてハンドラーを呼び出す
      switch (request.method) {
        case 'mcp.listTools':
          response = await this.handleListTools(request);
          break;
        case 'mcp.executeTool':
          response = await this.handleExecuteTool(request);
          break;
        case 'mcp.initialize':
          response = this._createInitializeResponse(request.id);
          break;
        default:
          return this._createErrorResponse(
            -32601,
            'Method not found',
            request.id,
            `Method '${request.method}' not supported`
          );
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('MCPレスポンス送信:', JSON.stringify(response, null, 2));
      }
      
      return response;
    } catch (error) {
      console.error('MCPリクエスト処理エラー:', error);
      return this._createErrorResponse(
        -32603,
        'Internal error',
        request.id,
        error.message
      );
    }
  }

  /**
   * ツールリストを取得する
   * @param {Object} request - MCPリクエスト
   * @returns {Promise<Object>} MCPレスポンス
   */
  async handleListTools(request) {
    try {
      const tools = this.getTools().map(tool => ({
        name: tool.name.charAt(0).toLowerCase() + tool.name.slice(1),
        description: tool.description,
        parameters: tool.parameters
      }));

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: tools
      };
    } catch (error) {
      return this._createErrorResponse(
        -32603,
        'Error listing tools',
        request.id,
        error.message
      );
    }
  }

  /**
   * ツールを実行する
   * @param {Object} request - MCPリクエスト
   * @returns {Promise<Object>} MCPレスポンス
   */
  async handleExecuteTool(request) {
    try {
      const { name, arguments: args } = request.params;
      
      if (!name) {
        return this._createErrorResponse(
          -32602,
          'Invalid params',
          request.id,
          'Tool name is required'
        );
      }

      // ツール名を正規化（大文字小文字を区別しない）
      const normalizedName = name.toLowerCase();
      const tool = this.getTools().find(t => 
        t.name.toLowerCase() === normalizedName ||
        (t.name.charAt(0).toLowerCase() + t.name.slice(1)) === normalizedName
      );

      if (!tool) {
        return this._createErrorResponse(
          -32601,
          'Tool not found',
          request.id,
          `Tool '${name}' is not available`
        );
      }

      // パラメータのバリデーション
      if (!this._validateToolParameters(tool, args)) {
        return this._createErrorResponse(
          -32602,
          'Invalid parameters',
          request.id,
          `Invalid parameters for tool '${name}'`
        );
      }

      // ツールを実行
      const result = await tool.execute(args);
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };
    } catch (error) {
      return this._createErrorResponse(
        -32603,
        'Error executing tool',
        request.id,
        error.message
      );
    }
  }

  /**
   * リクエストを検証する
   * @private
   * @param {Object} request - 検証するリクエスト
   * @returns {boolean} 検証結果
   */
  _validateRequest(request) {
    return (
      request &&
      request.jsonrpc === '2.0' &&
      request.method &&
      typeof request.method === 'string'
    );
  }

  /**
   * ツールのパラメータを検証する
   * @private
   * @param {Object} tool - 検証するツール
   * @param {Object} params - 検証するパラメータ
   * @returns {boolean} 検証結果
   */
  _validateToolParameters(tool, params) {
    if (!tool.parameters || !tool.parameters.required) {
      return true;
    }

    return tool.parameters.required.every(param => 
      params && params.hasOwnProperty(param)
    );
  }

  /**
   * 初期化レスポンスを作成する
   * @private
   * @param {string|number} id - リクエストID
   * @returns {Object} 初期化レスポンス
   */
  _createInitializeResponse(id) {
    return {
      jsonrpc: '2.0',
      id,
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
  }

  /**
   * エラーレスポンスを作成する
   * @private
   * @param {number} code - エラーコード
   * @param {string} message - エラーメッセージ
   * @param {string|number} id - リクエストID
   * @param {*} [data] - 追加のエラーデータ
   * @returns {Object} エラーレスポンス
   */
  _createErrorResponse(code, message, id = null, data = null) {
    return {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        ...(data && { data })
      },
      id
    };
  }

  /**
   * コード分析を実行する
   * @private
   * @param {Object} params - 実行パラメータ
   * @returns {Promise<Object>} 実行結果
   */
  async handleAnalyzeCode(params) {
    // 実装は省略
    throw new Error('Not implemented');
  }

  /**
   * ドキュメント生成を実行する
   * @private
   * @param {Object} params - 実行パラメータ
   * @returns {Promise<Object>} 実行結果
   */
  async handleGenerateDocs(params) {
    // 実装は省略
    throw new Error('Not implemented');
  }

  /**
   * Sequential Thinkingを実行する
   * @private
   * @param {Object} params - 実行パラメータ
   * @returns {Promise<Object>} 実行結果
   */
  async handleSequentialThinking(params) {
    // 実装は省略
    throw new Error('Not implemented');
  }
}