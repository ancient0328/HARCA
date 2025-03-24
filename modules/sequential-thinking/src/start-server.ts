/**
 * Sequential Thinking MCPサーバーの起動スクリプト
 * このスクリプトは、Sequential Thinking MCPサーバーをスタンドアロンモードで起動します
 */

import { SequentialThinkingServer as Server } from './index.js';
import { Server as HTTPServer } from 'node:http';
import chalk from 'chalk';

// 環境変数からポート番号を取得（デフォルトは3740）
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3740;
// デバッグモードの設定
const DEBUG = process.env.DEBUG === 'true';

// サーバーインスタンスの作成
const server = new Server({
  debug: DEBUG
});

// HTTPサーバーの作成
const httpServer = new HTTPServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const requestData = JSON.parse(body);
      
      if (DEBUG) {
        console.log(chalk.blue('📥 リクエスト:'), JSON.stringify(requestData, null, 2));
      }
      
      // JSONRPCリクエストの処理
      if (requestData.method === 'mcp.listTools') {
        // ツール一覧を返す
        const response = {
          jsonrpc: '2.0',
          id: requestData.id,
          result: {
            tools: [{
              name: 'sequentialthinking',
              description: '構造化された思考プロセスを通じて問題解決を支援するツール'
            }]
          }
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } else if (requestData.method === 'mcp.runTool') {
        // ツールの実行
        const { name, arguments: args } = requestData.params;
        
        if (name === 'sequentialthinking') {
          const result = server.processThought(args);
          
          const response = {
            jsonrpc: '2.0',
            id: requestData.id,
            result
          };
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } else {
          // 不明なツール
          const response = {
            jsonrpc: '2.0',
            id: requestData.id,
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`
            }
          };
          
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        }
      } else {
        // 不明なメソッド
        const response = {
          jsonrpc: '2.0',
          id: requestData.id,
          error: {
            code: -32601,
            message: `Method not found: ${requestData.method}`
          }
        };
        
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      }
    } catch (error) {
      // エラーレスポンス
      const response = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${error instanceof Error ? error.message : String(error)}`
        }
      };
      
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    }
  });
});

try {
  // サーバーの起動
  server.start(PORT);
  
  // HTTPサーバーの起動
  httpServer.listen(PORT, () => {
    console.log(chalk.green(`✅ Sequential Thinking MCPサーバーが起動しました - ポート: ${PORT}`));
    console.log(chalk.blue('📝 利用可能なツール:'));
    console.log(chalk.yellow('  - sequentialthinking: 構造化された思考プロセスを通じて問題解決を支援'));
    
    if (DEBUG) {
      console.log(chalk.magenta('🔍 デバッグモードが有効です'));
    }
    
    console.log(chalk.cyan('🔄 サーバーを停止するには Ctrl+C を押してください'));
  });
} catch (error) {
  console.error(chalk.red('❌ サーバーの起動に失敗しました:'), error);
  process.exit(1);
}

// シグナルハンドラの設定
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 サーバーを停止しています...'));
  try {
    await server.stop();
    httpServer.close();
    console.log(chalk.green('✅ サーバーが正常に停止しました'));
  } catch (error: unknown) {
    console.error(chalk.red('❌ サーバーの停止中にエラーが発生しました:'), error);
  } finally {
    process.exit(0);
  }
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n🛑 サーバーを停止しています...'));
  try {
    await server.stop();
    httpServer.close();
    console.log(chalk.green('✅ サーバーが正常に停止しました'));
  } catch (error: unknown) {
    console.error(chalk.red('❌ サーバーの停止中にエラーが発生しました:'), error);
  } finally {
    process.exit(0);
  }
});
