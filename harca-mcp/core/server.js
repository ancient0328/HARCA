// core/server.js - メインMCPサーバー実装
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import { VectorStore } from '../features/vector-store/index.js';
import codeAnalysisPlugin from '../features/code-analysis/index.js';
import WindsurfApi from '../integrations/windsurf/api.js';
import { z } from 'zod';
import fetch from 'node-fetch';

// Cursor連携モジュールをインポート
import { CursorIntegration } from '../integrations/cursor/index.js';

// Sequential Thinking統合モジュールをESモジュールとしてインポート
let sequentialThinkingModule;

// ESモジュールで__dirnameを取得するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数読み込み
dotenv.config();

// PostgreSQL接続
let connectionString = process.env.POSTGRES_CONNECTION_STRING || process.env.SUPABASE_CONNECTION_STRING;

// 接続文字列が環境変数を含む場合は展開する
if (connectionString && connectionString.includes('${')) {
  // 環境変数を展開
  connectionString = connectionString.replace(/\${([^}]+)}/g, (match, varName) => {
    return process.env[varName] || '';
  });

  console.log('データベース接続文字列を展開しました');
}

// 接続文字列がない場合は開発用のデフォルト値を使用
if (!connectionString) {
  connectionString = 'postgres://postgres:postgres@localhost:3730/harca';
  console.log('デフォルトのデータベース接続文字列を使用します:', connectionString);
}

// ベクトルストアプラグインのロード
let vectorStore;

// MCPサーバー初期化関数
async function initServer(dbUrl = null, transportType = 'stdio') {
  try {
    // コマンドラインから渡されたDBURLがある場合は優先
    if (dbUrl && dbUrl !== '--http') {
      connectionString = dbUrl;
    }

    // 直接サーバーを初期化
    const sdkPath = path.resolve(__dirname, '../node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js');
    const serverModule = await import(sdkPath);
    const Server = serverModule.default || serverModule;

    const mcpPath = path.resolve(__dirname, '../node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js');
    const mcpModule = await import(mcpPath);
    const McpServer = mcpModule.default || mcpModule.McpServer;

    if (!McpServer) {
      throw new Error('MCPサーバーモジュールが見つかりません');
    }

    // Sequential Thinking統合モジュールをESモジュールとしてインポート
    try {
      sequentialThinkingModule = await import('../integrations/sequential-thinking/index.js')
        .then(module => {
          console.log('Sequential Thinking統合モジュールをロードしました');
          return { defaultSequentialThinking: module.defaultIntegration };
        })
        .catch((error) => {
          console.warn('Sequential Thinking統合モジュールのロードに失敗しました:', error.message);
          return null;
        });

      // 環境変数から設定を読み込む
      process.env.SEQUENTIAL_THINKING_URL = process.env.SEQUENTIAL_THINKING_URL || 'http://localhost:3740';

      console.log(`Sequential Thinking URL: ${process.env.SEQUENTIAL_THINKING_URL}`);
    } catch (error) {
      console.warn('Sequential Thinking統合モジュールのロードに失敗しました:', error.message);
      sequentialThinkingModule = null;
    }

    // MCPサーバー初期化
    const mcpServer = new McpServer({
      name: "HARCA",
      version: "1.0.0",
      description: "Highly Advanced Reasoning and Cognition Assistant",
      capabilities: {
        tools: {}
      }
    });

    // PostgreSQL接続
    try {
      // SKIP_DB_CONNECTION環境変数が設定されている場合はデータベース接続をスキップ
      if (process.env.SKIP_DB_CONNECTION === 'true') {
        console.log('データベース接続をスキップします（SKIP_DB_CONNECTION=true）');
        global.dbPool = null;
      } else {
        global.dbPool = new Pool({
          connectionString: connectionString
        });

        // 接続テスト
        const client = await global.dbPool.connect();
        client.release();
        console.log('データベース接続成功');
      }
    } catch (error) {
      console.error('データベース接続エラー:', error);
      // データベース接続エラーでもサーバーを起動する（開発モード）
      if (process.env.NODE_ENV === 'development' || process.env.IGNORE_DB_ERROR === 'true') {
        console.warn('開発モードまたはIGNORE_DB_ERROR=trueのため、データベース接続エラーを無視してサーバーを起動します');
        global.dbPool = null;
      } else {
        throw new Error(`データベース接続エラー: ${error.message}`);
      }
    }

    // ベクトルストアの初期化 - VectorStoreはコンストラクタで初期化されるため、
    // 新しいインスタンスを作成して設定を渡す
    if (global.dbPool) {
      vectorStore = new VectorStore({
        pool: global.dbPool,
        connectionString: connectionString
      });
    } else {
      console.warn('データベース接続がないため、ベクトルストアは初期化されません');
      vectorStore = null;
    }

    // ツール登録: コード分析
    mcpServer.tool("analyzeCode", "コードを分析し、複雑度、コメント率、命名規則などの問題を検出します",
      {
        code: z.string().describe("分析するコード"),
        language: z.string().optional().default("javascript").describe("コードの言語（javascript, python, javaなど）"),
        rules: z.array(z.string()).optional().describe("適用する分析ルール（空の場合はすべてのルールが適用されます）"),
        options: z.object({
          includeSummary: z.boolean().optional().default(true).describe("要約を含めるかどうか"),
          advanced: z.boolean().optional().default(false).describe("高度な分析を実行するかどうか")
        }).optional().describe("分析オプション")
      },
      async (params) => {
        try {
          const { code, language = "javascript", rules = [], options = {} } = params;
          const { includeSummary = true, advanced = false } = options;

          // 基本的な分析情報
          const basicAnalysis = {
            language,
            lines: code.split('\n').length,
            characters: code.length
          };

          // 高度な分析が不要な場合は基本分析のみ返す
          if (!advanced) {
            return basicAnalysis;
          }

          // プラグインを使用して高度な分析を実行
          const advancedAnalysis = await codeAnalysisPlugin.analyzeCode(code, language, rules);

          // 基本分析と高度な分析を統合
          return {
            ...basicAnalysis,
            advanced: advancedAnalysis
          };
        } catch (error) {
          console.error('コード分析エラー:', error);
          throw new Error(`分析エラー: ${error.message}`);
        }
      }
    );

    // ツール登録: 利用可能なコード分析ルールを取得
    mcpServer.tool("getCodeAnalysisRules", "利用可能なコード分析ルールの一覧を取得します",
      {},
      async () => {
        try {
          const rules = codeAnalysisPlugin.getAvailableRules();
          return {
            rules: rules.map(ruleId => {
              const info = codeAnalysisPlugin.getRuleInfo(ruleId);
              return info || { id: ruleId };
            })
          };
        } catch (error) {
          console.error('ルール取得エラー:', error);
          throw new Error(`ルール取得エラー: ${error.message}`);
        }
      }
    );

    // ツール登録: コード分析オプションを取得
    mcpServer.tool("getAnalysisOptions", "コード分析で利用可能なオプションの一覧を取得します",
      {},
      async () => {
        try {
          return {
            languages: ["javascript", "typescript", "python", "java", "go", "rust", "c", "cpp"],
            options: {
              advanced: {
                type: "boolean",
                default: false,
                description: "高度な分析を実行するかどうか"
              },
              rules: {
                type: "array",
                items: "string",
                description: "適用するルール（省略時はすべて）"
              }
            }
          };
        } catch (error) {
          console.error('オプション取得エラー:', error);
          throw new Error(`オプション取得エラー: ${error.message}`);
        }
      }
    );

    // ツール登録: サーバーヘルスチェック
    mcpServer.tool("checkHealth", "HARCAサーバーの健全性を確認します",
      {},
      async () => {
        try {
          // データベース接続テスト
          const dbResult = await global.dbPool.query('SELECT NOW()');

          // Sequential Thinkingサーバーの健全性チェック
          let sequentialThinkingStatus = "not-loaded";
          try {
            // 統合モジュールが利用可能な場合はそれを使用
            if (sequentialThinkingModule && sequentialThinkingModule.defaultSequentialThinking) {
              const isHealthy = await sequentialThinkingModule.defaultSequentialThinking.checkHealth();
              sequentialThinkingStatus = isHealthy ? "connected" : "error";
            } else {
              // 従来の方法でチェック
              const sequentialThinkingUrl = process.env.SEQUENTIAL_THINKING_URL || 'http://localhost:3740';
              try {
                const response = await fetch(sequentialThinkingUrl);
                if (response.ok) {
                  sequentialThinkingStatus = "connected";
                }
              } catch (dockerError) {
                // Dockerでの接続に失敗した場合、ローカル接続を試みる
                try {
                  const fallbackUrl = 'http://sequential-thinking:3740';
                  const fallbackResponse = await fetch(fallbackUrl);
                  if (fallbackResponse.ok) {
                    sequentialThinkingStatus = "connected";
                  }
                } catch (localError) {
                  console.warn('Sequential Thinkingサーバー接続エラー:', localError.message);
                  sequentialThinkingStatus = "error";
                }
              }
            }
          } catch (error) {
            console.warn('Sequential Thinkingサーバー接続エラー:', error.message);
            sequentialThinkingStatus = "error";
          }

          return {
            status: "healthy",
            timestamp: new Date().toISOString(),
            components: {
              database: dbResult.rows.length > 0 ? "connected" : "error",
              vectorStore: vectorStore ? "loaded" : "error",
              codeAnalysis: codeAnalysisPlugin ? "loaded" : "error",
              sequentialThinking: sequentialThinkingStatus
            }
          };
        } catch (error) {
          console.error('ヘルスチェックエラー:', error);
          return {
            status: "error",
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }
    );

    // Sequential Thinkingツール推奨機能の登録
    if (sequentialThinkingModule && sequentialThinkingModule.defaultSequentialThinking) {
      // 注：ここではMCPツールを登録しない
      // APIエンドポイントの登録は後で行う
      console.log('Sequential Thinking統合モジュールをロードしました');
    } else {
      console.warn('Sequential Thinking統合モジュールが利用できないため、関連ツールは登録されません');

      // 統合モジュールが利用できない場合は、基本的なツール推奨機能のみを登録
      if (transportType === 'http') {
        try {
          // ツール推奨機能の登録
          mcpServer.tool("recommendTools", "思考プロセスに基づいて最適なツールを推奨します",
            {
              properties: {
                thought: {
                  type: 'string',
                  description: 'ツール推奨の基となる思考テキスト'
                },
                maxResults: {
                  type: 'number',
                  description: '返す推奨ツールの最大数'
                },
                minScore: {
                  type: 'number',
                  description: '推奨に含めるための最小スコア（0-1）'
                }
              },
              required: ['thought']
            },
            async (params) => {
              try {
                // 統合モジュールがないため、ダミーの結果を返す
                return {
                  recommendations: [
                    {
                      toolName: "analyzeCode",
                      score: 0.9,
                      reason: "コード分析に最適なツールです",
                      usageHint: "analyzeCode({code: 'コード', language: 'javascript'})"
                    }
                  ]
                };
              } catch (error) {
                console.error('ツール推奨エラー:', error);
                throw new Error(`ツール推奨エラー: ${error.message}`);
              }
            }
          );
          console.log('基本的なツール推奨機能を登録しました');
        } catch (error) {
          console.warn('ツール推奨機能の登録に失敗しました:', error.message);
        }
      }
    }

    // Cursor統合モジュールの初期化
    const cursorIntegration = new CursorIntegration({});
    await cursorIntegration.initialize();
    
    // Sequential Thinkingツールを登録
    if (sequentialThinkingModule) {
      try {
        // CursorIntegrationのMCPハンドラーにSequential Thinkingツールを登録
        if (sequentialThinkingModule.defaultSequentialThinking && 
            typeof sequentialThinkingModule.defaultSequentialThinking.registerCursorTools === 'function') {
          sequentialThinkingModule.defaultSequentialThinking.registerCursorTools(cursorIntegration);
          console.log('Sequential Thinkingツールを登録しました');
        } else if (sequentialThinkingModule.defaultIntegration && 
                  typeof sequentialThinkingModule.defaultIntegration.registerCursorTools === 'function') {
          sequentialThinkingModule.defaultIntegration.registerCursorTools(cursorIntegration);
          console.log('Sequential Thinkingツールを登録しました');
        } else {
          console.warn('Sequential Thinkingモジュールに必要なメソッドが見つかりません');
        }
      } catch (error) {
        console.warn('Sequential Thinkingツールの登録に失敗しました:', error.message);
      }
    }

    // MCPエンドポイントの追加
    const app = express();

    // 基本的なミドルウェアの設定
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // HTTPモードの場合は追加の設定を行う
    if (transportType === 'http') {
      // 静的ファイルの提供
      app.use(express.static(path.join(__dirname, '../public')));

      // CORSの設定
      app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        if (req.method === 'OPTIONS') {
          return res.sendStatus(200);
        }
        next();
      });

      // ヘルスチェックエンドポイント
      app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
      });

      // Windsurfインテグレーション用のエンドポイント
      const windsurfApi = new WindsurfApi(app);

      // Sequential Thinking統合モジュールのAPIを設定（利用可能な場合）
      if (sequentialThinkingModule && sequentialThinkingModule.defaultSequentialThinking) {
        try {
          // APIルーターの登録
          sequentialThinkingModule.defaultSequentialThinking.register(app, mcpServer);
          console.log('Sequential Thinkingツールを登録しました');
        } catch (error) {
          console.warn('Sequential Thinking統合モジュールの登録に失敗しました:', error.message);
        }
      } else {
        console.warn('Sequential Thinking統合モジュールが利用できないため、関連ツールは登録されません');
      }
    }

    // SSEエンドポイントの追加
    app.get('/api/mcp/sse', (req, res) => {
      console.log('New SSE connection request received at /api/mcp/sse');
      cursorIntegration.sseHandler.handleSSEConnection(req, res);
    });

    // 標準的なSSEエンドポイントの追加（/sse）
    app.get('/sse', (req, res) => {
      console.log('New SSE connection request received at /sse');
      cursorIntegration.sseHandler.handleSSEConnection(req, res);
    });

    app.post('/api/mcp', async (req, res) => {
      try {
        // リクエストの形式を標準化
        const mcpRequest = req.body;
        
        // methodがそのままの場合は、mcp.executeTool形式に変換
        if (mcpRequest.method && !mcpRequest.method.startsWith('mcp.')) {
          const originalMethod = mcpRequest.method;
          mcpRequest.method = 'mcp.executeTool';
          mcpRequest.params = {
            toolName: originalMethod,
            params: mcpRequest.params || {}
          };
        }
        
        // リクエストのログ出力（開発モードのみ）
        if (process.env.NODE_ENV === 'development') {
          console.log('MCPリクエスト受信:', JSON.stringify(mcpRequest, null, 2));
        }
        
        // CursorIntegrationを使用してMCPリクエストを処理
        const result = await cursorIntegration.handleMCPRequest(mcpRequest);
        
        // レスポンスのログ出力（開発モードのみ）
        if (process.env.NODE_ENV === 'development') {
          console.log('MCPレスポンス送信:', JSON.stringify(result, null, 2));
        }
        
        res.json(result);
      } catch (error) {
        console.error('MCPリクエストエラー:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id || null,
          error: {
            code: -32603,
            message: `内部エラー: ${error.message}`
          }
        });
      }
    });
    
    // サーバーの起動
    const httpServer = http.createServer(app);

    // HTTPモードの場合のサーバー設定
    if (transportType === 'http') {
      // 終了時の処理のみ設定し、サーバーの起動はstart-harca.jsに任せる
      process.on('SIGINT', async () => {
        console.log('Shutting down HARCA server...');
        if (global.dbPool) {
          await global.dbPool.end();
        }
        httpServer.close();
        process.exit(0);
      });
    }

    return { server: mcpServer.server, pool: global.dbPool, httpServer };
  } catch (error) {
    console.error('サーバー初期化エラー:', error);
    process.exit(1);
  }
}

// メインサーバー起動関数
async function startServer(transportType = 'stdio', dbUrl) {
  try {
    const { server: mcpServer, pool, httpServer } = await initServer(dbUrl, transportType);

    console.log(`Starting HARCA server in ${transportType} mode...`);

    if (transportType === 'stdio') {
      // コマンドライン引数としてデータベースURLを渡す
      await mcpServer.listen([dbUrl]);
      console.log('HARCA server started in STDIO mode');

      // 終了時の処理
      process.on('SIGINT', async () => {
        console.log('Shutting down HARCA server...');
        if (pool) {
          await pool.end();
        }
        process.exit(0);
      });
    } else if (transportType === 'http') {
      // HTTPモードの場合はstart-harca.jsがサーバーを起動するため、
      // ここでは何もしない（httpServerオブジェクトは返すだけ）
      console.log('HARCA server initialized in HTTP mode');
    }
  } catch (error) {
    console.error('サーバー起動エラー:', error);
    process.exit(1);
  }
}

// メインエントリーポイント
if (import.meta.url === import.meta.main || process.argv.includes('--http')) {
  // コマンドライン引数の処理
  const args = process.argv.slice(2);
  const transportType = args.includes('--http') ? 'http' : 'stdio';
  const dbUrl = args.find(arg => !arg.startsWith('--')) || null;

  // サーバー起動
  startServer(transportType, dbUrl).catch(error => {
    console.error('サーバー起動に失敗しました:', error);
    process.exit(1);
  });
}

export { initServer, startServer };
