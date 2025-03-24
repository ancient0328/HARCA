#!/usr/bin/env node
// integrations/windsurf/stdio-proxy.js - Windsurf用STDIOプロキシ

import fetch from 'node-fetch';
import readline from 'readline';
import fs from 'fs';

// デバッグログを有効化
const DEBUG = true;
const LOG_FILE = '/tmp/harca-windsurf-debug.log';

// デバッグログを記録する関数
function debugLog(message) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
    fs.appendFileSync(LOG_FILE, logMessage);
    console.error(logMessage);
  }
}

// ログファイルを初期化
if (DEBUG) {
  fs.writeFileSync(LOG_FILE, `=== HARCA Windsurf STDIO Proxy Debug Log - ${new Date().toISOString()} ===\n`);
  debugLog('Debug logging enabled');
}

// HARCA API URL
const API_URL = process.env.HARCA_API_URL || 'http://localhost:3700/api/windsurf';

// 標準入力からの読み取り
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

debugLog(`HARCA Windsurf STDIO Proxy started`);
debugLog(`API URL: ${API_URL}`);

/**
 * リクエストをHARCA APIに転送し、レスポンスを返す
 * @param {Object} request リクエスト
 * @returns {Promise<Object>} レスポンス
 */
async function forwardRequest(request) {
  try {
    debugLog(`Forwarding request: ${JSON.stringify(request)}`);
    
    // リクエストの種類に基づいてエンドポイントを決定
    let endpoint = '';
    let method = 'GET';
    let body = null;
    
    switch (request.command) {
      case 'analyzeCode':
        endpoint = '/analyze';
        method = 'POST';
        body = {
          code: request.params.code,
          language: request.params.language || 'javascript',
          rules: request.params.rules || [],
          options: request.params.options || { includeSummary: true }
        };
        break;
      case 'getCodeAnalysisRules':
        endpoint = '/rules';
        break;
      case 'getAnalysisOptions':
        endpoint = '/options';
        break;
      case 'checkHealth':
        endpoint = '/health';
        break;
      case 'sequentialThinking':
        endpoint = '/sequential-thinking';
        method = 'POST';
        body = {
          problem: request.params.problem,
          context: request.params.context || '',
          maxSteps: request.params.maxSteps || 10
        };
        break;
      default:
        // 未知のコマンドはMCP APIに転送
        debugLog(`Unknown command: ${request.command}`);
        return {
          error: {
            code: -32601,
            message: `Unknown command: ${request.command}`
          }
        };
    }
    
    // APIリクエストを実行
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }
    
    debugLog(`Sending API request to ${API_URL}${endpoint}`);
    const response = await fetch(`${API_URL}${endpoint}`, fetchOptions);
    const result = await response.json();
    debugLog(`API response: ${JSON.stringify(result)}`);
    
    return {
      result
    };
  } catch (error) {
    debugLog(`Error forwarding request: ${error.message}`);
    return {
      error: {
        code: -32000,
        message: `Error: ${error.message}`
      }
    };
  }
}

// 標準入力からのリクエストを処理
rl.on('line', async (line) => {
  try {
    // 空行は無視
    if (!line.trim()) return;
    
    debugLog(`Received raw input: ${line}`);
    
    // JSONをパース
    const request = JSON.parse(line);
    
    // デバッグ用：受信したリクエストを表示
    debugLog(`Parsed request: ${JSON.stringify(request, null, 2)}`);
    
    // JSONRPC 2.0形式のリクエストを処理
    const { id, method, params, jsonrpc } = request;
    
    debugLog(`Processing request - id: ${id}, method: ${method || request.command}`);
    
    // メソッドが指定されていない場合はエラー
    if (!method && !request.command) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: id || null,
        error: {
          code: -32600,
          message: "Invalid Request: method is required"
        }
      };
      debugLog(`Sending error response: ${JSON.stringify(errorResponse)}`);
      console.log(JSON.stringify(errorResponse));
      return;
    }
    
    // initializeメソッドの場合は成功レスポンスを返す
    if (method === 'initialize') {
      debugLog('Processing initialize request');
      const initializeResponse = {
        jsonrpc: "2.0",
        id: id || null,
        result: {
          serverInfo: {
            name: "HARCA-MCP",
            version: "1.0.0"
          },
          capabilities: {}
        }
      };
      debugLog(`Sending initialize response: ${JSON.stringify(initializeResponse)}`);
      console.log(JSON.stringify(initializeResponse));
      return;
    }
    
    // notifications/initializedメソッドは無視する
    if (method === 'notifications/initialized') {
      debugLog('Ignoring notifications/initialized request');
      return;
    }
    
    // getToolsメソッドの場合は直接レスポンスを返す
    if (method === 'getTools' || request.command === 'getTools' || method === 'tools/list') {
      debugLog('Processing tools request');
      const toolsResponse = {
        jsonrpc: "2.0",
        id: id || null,
        result: {
          version: "1.0",
          tools: [
            {
              name: 'analyzeCode',
              description: 'コードを分析し、複雑度、コメント率、命名規則、重複などの問題を検出します',
              parameters: {
                type: 'object',
                properties: {
                  code: {
                    type: 'string',
                    description: '分析するコード'
                  },
                  language: {
                    type: 'string',
                    description: 'コードの言語（javascript, python, javaなど）',
                    default: 'javascript'
                  },
                  rules: {
                    type: 'array',
                    description: '適用する分析ルール（空の場合はすべてのルールが適用されます）',
                    items: {
                      type: 'string'
                    },
                    default: []
                  },
                  options: {
                    type: 'object',
                    description: '分析オプション',
                    properties: {
                      includeSummary: {
                        type: 'boolean',
                        description: '要約を含めるかどうか',
                        default: true
                      },
                      advanced: {
                        type: 'boolean',
                        description: '高度な分析を実行するかどうか',
                        default: false
                      }
                    }
                  }
                },
                required: ['code']
              }
            },
            {
              name: 'getCodeAnalysisRules',
              description: '利用可能なコード分析ルールの一覧を取得します',
              parameters: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'getAnalysisOptions',
              description: 'コード分析で利用可能なオプションの一覧を取得します',
              parameters: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'checkHealth',
              description: 'HARCAサーバーの健全性を確認します',
              parameters: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'sequentialThinking',
              description: '構造化された思考プロセスを通じて問題解決を行います',
              parameters: {
                type: 'object',
                properties: {
                  problem: {
                    type: 'string',
                    description: '解決すべき問題'
                  },
                  context: {
                    type: 'string',
                    description: '関連するコンテキスト情報',
                    default: ''
                  },
                  maxSteps: {
                    type: 'number',
                    description: '最大思考ステップ数',
                    default: 10
                  }
                },
                required: ['problem']
              }
            }
          ]
        }
      };
      debugLog(`Sending getTools response: ${JSON.stringify(toolsResponse)}`);
      console.log(JSON.stringify(toolsResponse));
      return;
    }
    
    // tools/callメソッドの場合、ツール名を抽出して対応するコマンドに変換
    if (method === 'tools/call') {
      debugLog('Processing tools/call request');
      
      // ツール名とパラメータを取得
      const toolName = params?.name;
      const toolParams = params?.params || {};
      
      if (!toolName) {
        const errorResponse = {
          jsonrpc: "2.0",
          id: id || null,
          error: {
            code: -32602,
            message: "Invalid params: tool name is required"
          }
        };
        debugLog(`Sending error response: ${JSON.stringify(errorResponse)}`);
        console.log(JSON.stringify(errorResponse));
        return;
      }
      
      debugLog(`Tool call request for: ${toolName} with params: ${JSON.stringify(toolParams)}`);
      
      // ツール名に基づいてHARCAコマンドに変換
      let harcaCommand = '';
      
      switch (toolName) {
        case 'analyzeCode':
          harcaCommand = 'analyzeCode';
          break;
        case 'getCodeAnalysisRules':
          harcaCommand = 'getCodeAnalysisRules';
          break;
        case 'getAnalysisOptions':
          harcaCommand = 'getAnalysisOptions';
          break;
        case 'checkHealth':
          harcaCommand = 'checkHealth';
          break;
        case 'sequentialThinking':
          harcaCommand = 'sequentialThinking';
          break;
        default:
          const errorResponse = {
            jsonrpc: "2.0",
            id: id || null,
            error: {
              code: -32601,
              message: `Unknown tool: ${toolName}`
            }
          };
          debugLog(`Sending error response: ${JSON.stringify(errorResponse)}`);
          console.log(JSON.stringify(errorResponse));
          return;
      }
      
      // 修正したリクエストを作成
      const harcaRequest = {
        id,
        command: harcaCommand,
        params: toolParams
      };
      
      // リクエストを転送
      debugLog(`Forwarding request to HARCA API: ${JSON.stringify(harcaRequest)}`);
      const result = await forwardRequest(harcaRequest);
      
      // デバッグ用：送信するレスポンスを表示
      debugLog(`Raw API response: ${JSON.stringify(result)}`);
      
      // レスポンスを標準出力に書き込み
      const response = {
        jsonrpc: "2.0",
        id: id || null,
        ...(result.result ? { result: result.result } : { error: result.error })
      };
      
      debugLog(`Sending final response: ${JSON.stringify(response)}`);
      console.log(JSON.stringify(response));
    } else {
      // JSONRPCリクエストをHARCA形式に変換
      const harcaRequest = {
        id,
        command: method || request.command,
        params: params || request.params || {}
      };
      
      // リクエストを転送
      debugLog(`Forwarding request to HARCA API: ${JSON.stringify(harcaRequest)}`);
      const result = await forwardRequest(harcaRequest);
      
      // デバッグ用：送信するレスポンスを表示
      debugLog(`Raw API response: ${JSON.stringify(result)}`);
      
      // レスポンスを標準出力に書き込み
      const response = {
        jsonrpc: "2.0",
        id: id || null,
        ...(result.result ? { result: result.result } : { error: result.error })
      };
      
      debugLog(`Sending final response: ${JSON.stringify(response)}`);
      console.log(JSON.stringify(response));
    }
  } catch (error) {
    debugLog(`Error processing request: ${error.message}`);
    debugLog(`Error stack: ${error.stack}`);
    
    // エラーレスポンスを標準出力に書き込み
    const errorResponse = {
      jsonrpc: "2.0",
      id: request?.id || null,
      error: {
        code: -32000,
        message: `Error: ${error.message}`
      }
    };
    debugLog(`Sending error response: ${JSON.stringify(errorResponse)}`);
    console.log(JSON.stringify(errorResponse));
  }
});

// 準備完了メッセージ
debugLog('HARCA Windsurf STDIO Proxy ready for requests');

// 初期化完了を示すためのダミーリクエスト処理
setTimeout(() => {
  debugLog('Sending initialization test message');
  try {
    // 標準入力に直接書き込むことはできないので、代わりにgetToolsのレスポンスを標準出力に書き込む
    const initResponse = {
      jsonrpc: "2.0",
      id: "init",
      result: {
        message: "HARCA Windsurf STDIO Proxy initialized successfully"
      }
    };
    // 標準エラー出力にのみ書き込み（Windsurfには送信されない）
    debugLog(`Initialization complete: ${JSON.stringify(initResponse)}`);
  } catch (error) {
    debugLog(`Error during initialization: ${error.message}`);
  }
}, 1000);

// プロセス終了時の処理
process.on('SIGINT', () => {
  console.error('HARCA Windsurf STDIO Proxy shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('HARCA Windsurf STDIO Proxy shutting down');
  process.exit(0);
});
