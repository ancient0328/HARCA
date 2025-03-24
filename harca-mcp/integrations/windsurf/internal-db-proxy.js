#!/usr/bin/env node
// integrations/windsurf/internal-db-proxy.js - 内部PostgreSQL接続用Windsurfプロキシ

import fetch from 'node-fetch';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// ESモジュールでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// .envファイルの読み込み
dotenv.config({ path: path.resolve(rootDir, '.env') });

// デバッグログを有効化
const DEBUG = process.env.DEBUG === 'true';
const LOG_FILE = '/tmp/harca-internal-db-proxy-debug.log';

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
  fs.writeFileSync(LOG_FILE, `=== HARCA Internal DB Proxy Debug Log - ${new Date().toISOString()} ===\n`);
  debugLog('Debug logging enabled');
}

// HARCA API URL - 内部PostgreSQLに接続するHARCAサーバー
const API_URL = process.env.HARCA_INTERNAL_API_URL || 'http://localhost:3700/api/windsurf';
debugLog(`API URL: ${API_URL}`);

// 標準入力からの読み取り
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

debugLog(`HARCA Internal DB Proxy started`);

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
    const method = request.method || '';
    
    if (method === 'initialize' || method === 'shutdown') {
      endpoint = '/lifecycle';
    } else if (method.startsWith('tools/')) {
      endpoint = '/tools';
    } else if (method === 'getTools') {
      endpoint = '/tools';
    } else if (method === 'textDocument/codeAction') {
      endpoint = '/codeAction';
    } else if (method === 'textDocument/completion') {
      endpoint = '/completion';
    } else if (method === 'textDocument/hover') {
      endpoint = '/hover';
    } else if (method === 'textDocument/definition') {
      endpoint = '/definition';
    } else if (method === 'textDocument/references') {
      endpoint = '/references';
    } else if (method === 'workspace/symbol') {
      endpoint = '/symbol';
    } else if (method === 'textDocument/documentSymbol') {
      endpoint = '/documentSymbol';
    } else if (method === 'textDocument/semanticTokens/full') {
      endpoint = '/semanticTokens';
    } else if (method === 'textDocument/formatting') {
      endpoint = '/formatting';
    } else if (method === 'textDocument/rangeFormatting') {
      endpoint = '/rangeFormatting';
    } else if (method === 'textDocument/onTypeFormatting') {
      endpoint = '/onTypeFormatting';
    } else if (method === 'textDocument/rename') {
      endpoint = '/rename';
    } else if (method === 'textDocument/prepareRename') {
      endpoint = '/prepareRename';
    } else if (method === 'textDocument/foldingRange') {
      endpoint = '/foldingRange';
    } else if (method === 'textDocument/selectionRange') {
      endpoint = '/selectionRange';
    } else if (method === 'textDocument/documentHighlight') {
      endpoint = '/documentHighlight';
    } else if (method === 'textDocument/documentLink') {
      endpoint = '/documentLink';
    } else if (method === 'textDocument/documentColor') {
      endpoint = '/documentColor';
    } else if (method === 'textDocument/colorPresentation') {
      endpoint = '/colorPresentation';
    } else if (method === 'textDocument/typeDefinition') {
      endpoint = '/typeDefinition';
    } else if (method === 'textDocument/implementation') {
      endpoint = '/implementation';
    } else if (method === 'textDocument/declaration') {
      endpoint = '/declaration';
    } else if (method === 'textDocument/signatureHelp') {
      endpoint = '/signatureHelp';
    } else if (method === 'textDocument/publishDiagnostics') {
      endpoint = '/publishDiagnostics';
    } else if (method === 'window/showMessage') {
      endpoint = '/showMessage';
    } else if (method === 'window/showMessageRequest') {
      endpoint = '/showMessageRequest';
    } else if (method === 'window/logMessage') {
      endpoint = '/logMessage';
    } else if (method === 'telemetry/event') {
      endpoint = '/telemetry';
    } else if (method === 'workspace/applyEdit') {
      endpoint = '/applyEdit';
    } else if (method === 'workspace/configuration') {
      endpoint = '/configuration';
    } else if (method === 'workspace/workspaceFolders') {
      endpoint = '/workspaceFolders';
    } else if (method === 'workspace/didChangeWorkspaceFolders') {
      endpoint = '/didChangeWorkspaceFolders';
    } else if (method === 'workspace/didChangeConfiguration') {
      endpoint = '/didChangeConfiguration';
    } else if (method === 'workspace/didChangeWatchedFiles') {
      endpoint = '/didChangeWatchedFiles';
    } else if (method === 'workspace/executeCommand') {
      endpoint = '/executeCommand';
    } else if (method === 'workspace/applyEdit') {
      endpoint = '/applyEdit';
    } else if (method === 'codeAction/resolve') {
      endpoint = '/codeActionResolve';
    } else if (method === 'completionItem/resolve') {
      endpoint = '/completionItemResolve';
    } else if (method === 'documentLink/resolve') {
      endpoint = '/documentLinkResolve';
    } else {
      endpoint = '/jsonrpc';
    }
    
    // 完全なURLを構築
    const url = `${API_URL}${endpoint}`;
    debugLog(`Forwarding to: ${url}`);
    
    // リクエストを送信
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    // レスポンスを解析
    const responseData = await response.json();
    debugLog(`Received response: ${JSON.stringify(responseData)}`);
    
    return responseData;
  } catch (error) {
    debugLog(`Error forwarding request: ${error.message}`);
    debugLog(`Error stack: ${error.stack}`);
    
    // エラーレスポンスを返す
    return {
      jsonrpc: "2.0",
      id: request.id || null,
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`,
      },
    };
  }
}

// 標準入力からのリクエストを処理
rl.on('line', async (line) => {
  try {
    // 空行は無視
    if (!line.trim()) return;
    
    debugLog(`Received raw input: ${line}`);
    
    // JSONパース
    let request;
    try {
      request = JSON.parse(line);
    } catch (parseError) {
      debugLog(`Error parsing JSON: ${parseError.message}`);
      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
        },
      }));
      return;
    }
    
    // リクエストIDとメソッドを取得
    const id = request.id;
    const method = request.method;
    const params = request.params;
    
    debugLog(`Processing request: id=${id}, method=${method}`);
    
    // 初期化リクエストの特別処理
    if (method === 'initialize') {
      debugLog('Processing initialize request');
      
      // 初期化レスポンスを返す
      const initializeResponse = {
        jsonrpc: "2.0",
        id,
        result: {
          capabilities: {
            textDocumentSync: 1,
            completionProvider: {
              resolveProvider: true,
              triggerCharacters: ['.', ':', '<', '"', "'", '/', '@', '*'],
            },
            hoverProvider: true,
            signatureHelpProvider: {
              triggerCharacters: ['(', ','],
            },
            declarationProvider: true,
            definitionProvider: true,
            typeDefinitionProvider: true,
            implementationProvider: true,
            referencesProvider: true,
            documentHighlightProvider: true,
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            codeActionProvider: {
              resolveProvider: true,
            },
            codeLensProvider: {
              resolveProvider: true,
            },
            documentFormattingProvider: true,
            documentRangeFormattingProvider: true,
            documentOnTypeFormattingProvider: {
              firstTriggerCharacter: '}',
              moreTriggerCharacter: [';', '\n'],
            },
            renameProvider: {
              prepareProvider: true,
            },
            documentLinkProvider: {
              resolveProvider: true,
            },
            colorProvider: true,
            foldingRangeProvider: true,
            declarationProvider: true,
            executeCommandProvider: {
              commands: [],
            },
            workspace: {
              workspaceFolders: {
                supported: true,
                changeNotifications: true,
              },
            },
            experimental: {
              toolingProvider: true,
            },
          },
          serverInfo: {
            name: "HARCA Internal DB Proxy",
            version: "1.0.0",
          },
        },
      };
      
      console.log(JSON.stringify(initializeResponse));
      debugLog(`Sent initialize response: ${JSON.stringify(initializeResponse)}`);
      return;
    }
    
    // ツール一覧リクエストの特別処理
    if (method === 'getTools' || request.command === 'getTools' || method === 'tools/list') {
      debugLog('Processing tools request');
      const toolsResponse = {
        jsonrpc: "2.0",
        id: id || null,
        result: {
          tools: [
            {
              name: "analyzeCode",
              description: "コードを分析し、複雑度、コメント率、命名規則、重複などの問題を検出します",
              parameters: {},
            },
            {
              name: "sequentialThinking",
              description: "構造化された思考プロセスを通じて問題解決を行います",
              parameters: {},
            },
            {
              name: "checkHealth",
              description: "HARCAサーバーの健全性を確認します",
              parameters: {},
            },
            {
              name: "getAnalysisOptions",
              description: "コード分析で利用可能なオプションの一覧を取得します",
              parameters: {},
            },
            {
              name: "getCodeAnalysisRules",
              description: "利用可能なコード分析ルールの一覧を取得します",
              parameters: {},
            },
          ],
        },
      };
      
      console.log(JSON.stringify(toolsResponse));
      debugLog(`Sent tools response: ${JSON.stringify(toolsResponse)}`);
      return;
    }
    
    // ツール呼び出しリクエストの特別処理
    if (method === 'tools/call') {
      debugLog('Processing tools/call request');
      
      // ツール名とパラメータを取得
      const toolName = params?.name;
      const toolParams = params?.parameters || {};
      
      debugLog(`Tool call: name=${toolName}, params=${JSON.stringify(toolParams)}`);
      
      // ツール呼び出しをHARCA APIに転送
      const toolResponse = await forwardRequest({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: toolName,
          parameters: toolParams,
        },
        id,
      });
      
      console.log(JSON.stringify(toolResponse));
      debugLog(`Sent tool response: ${JSON.stringify(toolResponse)}`);
      return;
    }
    
    // シャットダウンリクエストの特別処理
    if (method === 'shutdown') {
      debugLog('Processing shutdown request');
      
      // シャットダウンレスポンスを返す
      const shutdownResponse = {
        jsonrpc: "2.0",
        id,
        result: null,
      };
      
      console.log(JSON.stringify(shutdownResponse));
      debugLog(`Sent shutdown response: ${JSON.stringify(shutdownResponse)}`);
      return;
    }
    
    // 終了通知の特別処理
    if (method === 'exit') {
      debugLog('Processing exit notification');
      process.exit(0);
      return;
    }
    
    // その他のリクエストはHARCA APIに転送
    const response = await forwardRequest(request);
    console.log(JSON.stringify(response));
    debugLog(`Sent response: ${JSON.stringify(response)}`);
    
  } catch (error) {
    debugLog(`Error processing request: ${error.message}`);
    debugLog(`Error stack: ${error.stack}`);
    
    // エラーレスポンスを標準出力に書き込み
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`,
      },
    }));
  }
});

// 準備完了メッセージ
debugLog('HARCA Internal DB Proxy ready for requests');

// プロセス終了時の処理
process.on('SIGINT', () => {
  debugLog('Received SIGINT signal, shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  debugLog('Received SIGTERM signal, shutting down');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  debugLog(`Uncaught exception: ${error.message}`);
  debugLog(`Error stack: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  debugLog(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});
