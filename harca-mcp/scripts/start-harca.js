#!/usr/bin/env node

/**
 * HARCA統一起動スクリプト
 * 
 * このスクリプトは、HARCAサーバーを様々なAIエージェント（Windsurf Cascade, Cursor Compose, 
 * Cline, RooCode, Claude Desktop）との連携に最適化して起動します。
 * 
 * 使用方法:
 *   node scripts/start-harca.js [オプション]
 * 
 * オプション:
 *   --mode=<mode>         起動モード (http, stdio, docker) デフォルト: http
 *   --agent=<agent>       AIエージェント (windsurf, cursor, cline, roocode, claude) デフォルト: windsurf
 *   --port=<port>         HTTPモード時のポート番号 デフォルト: 3600 (Docker: 3700)
 *   --redis-url=<url>     Redisサーバーの接続URL デフォルト: redis://localhost:6379 (Docker: redis://redis:6379)
 *   --debug               デバッグモードを有効化
 *   --help                ヘルプメッセージを表示
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// ESモジュールでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// .envファイルの読み込み
dotenv.config({ path: resolve(rootDir, '.env') });

// コマンドライン引数のパース
const args = process.argv.slice(2);
const options = {
  mode: 'http',
  agent: 'windsurf',
  port: process.env.PORT || 3600,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  debug: false
};

// ヘルプメッセージ
function showHelp() {
  console.log(`
HARCA統一起動スクリプト

使用方法:
  node scripts/start-harca.js [オプション]

オプション:
  --mode=<mode>         起動モード (http, stdio, docker) デフォルト: http
  --agent=<agent>       AIエージェント (windsurf, cursor, cline, roocode, claude) デフォルト: windsurf
  --port=<port>         HTTPモード時のポート番号 デフォルト: 3600 (Docker: 3700)
  --redis-url=<url>     Redisサーバーの接続URL デフォルト: redis://localhost:6379 (Docker: redis://redis:6379)
  --debug               デバッグモードを有効化
  --help                このヘルプメッセージを表示
  `);
  process.exit(0);
}

// 引数のパース
for (const arg of args) {
  if (arg === '--help') {
    showHelp();
  } else if (arg === '--debug') {
    options.debug = true;
  } else if (arg.startsWith('--mode=')) {
    options.mode = arg.split('=')[1];
  } else if (arg.startsWith('--agent=')) {
    options.agent = arg.split('=')[1];
  } else if (arg.startsWith('--port=')) {
    options.port = arg.split('=')[1];
  } else if (arg.startsWith('--redis-url=')) {
    options.redisUrl = arg.split('=')[1];
  }
}

// 環境変数の設定
process.env.PORT = options.port;
process.env.REDIS_URL = options.redisUrl;
process.env.DEBUG = options.debug ? 'harca:*,mcp:*' : process.env.DEBUG || '';
process.env.NODE_OPTIONS = '--experimental-modules --es-module-specifier-resolution=node';

// AIエージェント固有の設定
const agentConfigs = {
  windsurf: {
    // Windsurf Cascadeに最適化された設定
    env: {
      WINDSURF_INTEGRATION: 'true',
      RESPONSE_FORMAT: 'json'
    }
  },
  cursor: {
    // Cursor Composeに最適化された設定
    env: {
      CURSOR_INTEGRATION: 'true',
      RESPONSE_FORMAT: 'json'
    }
  },
  cline: {
    // Clineに最適化された設定
    env: {
      CLINE_INTEGRATION: 'true',
      RESPONSE_FORMAT: 'plain'
    }
  },
  roocode: {
    // RooCodeに最適化された設定
    env: {
      ROOCODE_INTEGRATION: 'true',
      RESPONSE_FORMAT: 'json'
    }
  },
  claude: {
    // Claude Desktopに最適化された設定
    env: {
      CLAUDE_INTEGRATION: 'true',
      RESPONSE_FORMAT: 'json'
    }
  }
};

// 選択されたエージェントの設定を適用
if (agentConfigs[options.agent]) {
  Object.assign(process.env, agentConfigs[options.agent].env);
}

// メインエントリーポイント
if (import.meta.url.endsWith(process.argv[1])) {
  // メイン実行関数
  async function main() {
    try {
      // 指定されたポートで実行中のプロセスを確認・停止（HTTPモードの場合のみ）
      if (options.mode === 'http') {
        try {
          const result = execSync(`lsof -i :${options.port} | grep LISTEN | awk '{print $2}'`).toString().trim();
          
          if (result) {
            console.log(`ポート ${options.port} は既に使用されています。既存のプロセスを停止します...`);
            execSync(`kill ${result}`);
            // プロセスが完全に終了するまで少し待機
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log(`既存のプロセスを停止しました。新しいインスタンスを起動します...`);
          }
        } catch (error) {
          console.log(`ポート ${options.port} は利用可能です。`);
        }
      }
      
      // 起動モードに応じた処理
      switch (options.mode) {
        case 'http':
          startHttpMode();
          break;
        case 'stdio':
          startStdioMode();
          break;
        case 'docker':
          startDockerMode();
          break;
        default:
          console.error(`エラー: 不明な起動モード '${options.mode}'`);
          showHelp();
      }
    } catch (error) {
      console.error('起動エラー:', error);
      process.exit(1);
    }
  }
  
  // メイン関数を実行
  main();
}

// HTTPモードでの起動
function startHttpMode() {
  console.log(`HARCAサーバーをHTTPモードで起動します (ポート: ${options.port})`);
  console.log(`AIエージェント: ${options.agent}`);
  
  // データベースURLの設定
  const dbUrl = process.env.POSTGRES_CONNECTION_STRING || process.env.SUPABASE_CONNECTION_STRING;
  if (!dbUrl) {
    console.error('エラー: データベースURLが設定されていません。');
    console.error('環境変数POSTGRES_CONNECTION_STRINGまたはSUPABASE_CONNECTION_STRINGを設定するか、.envファイルに追加してください。');
    process.exit(1);
  }
  
  // 環境変数を設定してHTTPモードを指定
  process.env.HARCA_MODE = 'http';
  
  const serverProcess = spawn('node', ['index.js', dbUrl], {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit'
  });

  serverProcess.on('close', (code) => {
    console.log(`HARCAサーバーが終了しました (コード: ${code})`);
  });
}

// stdioモードでの起動
function startStdioMode() {
  console.log(`HARCAサーバーをstdioモードで起動します`);
  console.log(`AIエージェント: ${options.agent}`);
  
  // データベースURLの設定
  const dbUrl = process.env.POSTGRES_CONNECTION_STRING || process.env.SUPABASE_CONNECTION_STRING;
  if (!dbUrl) {
    console.error('エラー: データベースURLが設定されていません。');
    console.error('環境変数POSTGRES_CONNECTION_STRINGまたはSUPABASE_CONNECTION_STRINGを設定するか、.envファイルに追加してください。');
    process.exit(1);
  }
  
  const serverProcess = spawn('node', ['index.js', dbUrl], {
    cwd: rootDir,
    env: process.env,
    stdio: ['inherit', 'inherit', 'inherit']
  });

  serverProcess.on('close', (code) => {
    console.log(`HARCAサーバーが終了しました (コード: ${code})`);
  });
}

// Dockerモードでの起動
function startDockerMode() {
  console.log('HARCAサーバーをDockerモードで起動します');
  console.log(`AIエージェント: ${options.agent}`);
  
  const dockerComposeFile = resolve(rootDir, 'docker-compose.yml');
  
  // docker-compose.ymlの存在確認
  if (!fs.existsSync(dockerComposeFile)) {
    console.error('エラー: docker-compose.ymlが見つかりません');
    process.exit(1);
  }
  
  // 環境変数を設定（3700番台のポートを使用）
  process.env.PORT = '3700';
  process.env.REDIS_PORT = '3701';
  
  // Docker Composeコマンドの実行
  const dockerProcess = spawn('docker-compose', ['up'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env
  });

  dockerProcess.on('close', (code) => {
    console.log(`Docker環境が終了しました (コード: ${code})`);
  });
}
