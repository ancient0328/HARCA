/**
 * Sequential Thinking MCPサーバーのテストクライアント
 * このスクリプトは、Sequential Thinking MCPサーバーに接続し、基本的な機能をテストします
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import chalk from 'chalk';
import http from 'node:http';

// 環境変数からサーバーのURLを取得（デフォルトはlocalhost:3740）
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3740';

/**
 * HTTPリクエストを送信する関数
 */
async function sendRequest(url: string, method: string, data?: any): Promise<any> {
  const urlObj = new URL(url);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname || '/',
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (error) {
          resolve(responseData);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * テストクライアントクラス
 */
class TestClient {
  private serverUrl: string;
  
  /**
   * コンストラクタ
   * @param serverUrl サーバーのURL
   */
  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }
  
  /**
   * サーバーに接続し、利用可能なツールを取得
   */
  async connect(): Promise<void> {
    try {
      console.log(chalk.blue(`🔌 サーバーに接続しています: ${this.serverUrl}`));
      
      // 利用可能なツールを取得
      const response = await sendRequest(this.serverUrl, 'POST', {
        jsonrpc: '2.0',
        id: '1',
        method: 'mcp.listTools',
        params: {}
      });
      
      console.log(chalk.yellow('📋 利用可能なツール:'));
      if (response && response.result && response.result.tools) {
        response.result.tools.forEach((tool: any) => {
          console.log(chalk.cyan(`  - ${tool.name}: ${tool.description.split('\n')[0]}`));
        });
      } else {
        console.log(chalk.red('❌ ツール情報を取得できませんでした'));
        console.log('レスポンス:', response);
      }
      
      return Promise.resolve();
    } catch (error: unknown) {
      console.error(chalk.red('❌ サーバーへの接続に失敗しました:'), error);
      return Promise.reject(error);
    }
  }
  
  /**
   * Sequential Thinkingツールをテスト
   */
  async testSequentialThinking(): Promise<void> {
    try {
      console.log(chalk.blue('🧠 Sequential Thinkingツールをテストしています...'));
      
      // テスト用の思考データ
      const thoughtData = {
        thought: 'JavaScriptアプリケーションのパフォーマンスが低下しています。特に大量のデータを処理する際に遅延が発生し、ユーザー体験に影響を与えています。',
        nextThoughtNeeded: true,
        thoughtNumber: 1,
        totalThoughts: 5,
        includeToolRecommendations: true
      };
      
      // ツールを実行
      console.log(chalk.yellow('📤 リクエスト:'), thoughtData);
      const result = await sendRequest(this.serverUrl, 'POST', {
        jsonrpc: '2.0',
        id: '2',
        method: 'mcp.runTool',
        params: {
          name: 'sequentialthinking',
          arguments: thoughtData
        }
      });
      
      console.log(chalk.green('📥 レスポンス:'), result);
      
      return Promise.resolve();
    } catch (error: unknown) {
      console.error(chalk.red('❌ ツールの実行に失敗しました:'), error);
      return Promise.reject(error);
    }
  }
  
  /**
   * 切断
   */
  async disconnect(): Promise<void> {
    console.log(chalk.green('👋 サーバーから切断しました'));
    return Promise.resolve();
  }
}

/**
 * メイン関数
 */
async function main(): Promise<void> {
  const testClient = new TestClient(SERVER_URL);
  
  try {
    // サーバーに接続
    await testClient.connect();
    
    // Sequential Thinkingツールをテスト
    await testClient.testSequentialThinking();
    
    // 切断
    await testClient.disconnect();
    
    console.log(chalk.green('✅ テストが完了しました'));
  } catch (error: unknown) {
    console.error(chalk.red('❌ テスト中にエラーが発生しました:'), error);
  } finally {
    process.exit(0);
  }
}

// メイン関数の実行
main();
