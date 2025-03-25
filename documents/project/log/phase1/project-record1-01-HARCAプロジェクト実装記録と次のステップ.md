# HARCA プロジェクト実装記録と次のステップ

## 実行済みの作業

### 1. Supabase環境設定

Supabaseプロジェクトを作成し、以下のSQLを実行してデータベースを設定しました。

```sql
-- pgvector拡張の有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- コードベクトルテーブル作成
CREATE TABLE IF NOT EXISTS code_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ベクトル検索関数の作成
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    code_vectors.id,
    code_vectors.content,
    code_vectors.metadata,
    1 - (code_vectors.embedding <=> query_embedding) AS similarity
  FROM code_vectors
  WHERE 1 - (code_vectors.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

### 2. プロジェクト初期設定

以下の手順でプロジェクトの初期設定を行いました。

```bash
# プロジェクトディレクトリの作成
mkdir -p harca-mcp/{core,plugins/vector-store,integrations/windsurf,scripts}
cd harca-mcp

# pnpmでプロジェクト初期化
pnpm init
```

正しい依存関係をインストールするため、以下のコマンドを実行する必要があります。

```bash
pnpm add @modelcontextprotocol/server-postgres pg openai dotenv express
pnpm add -D nodemon
```

package.jsonに以下の設定を追加予定：

```json
"scripts": {
  "start": "node core/server.js",
  "start:http": "node core/server.js --http",
  "setup:windsurf": "node scripts/setup-windsurf.js",
  "setup:supabase": "node scripts/setup-supabase.js",
  "diagnose": "node scripts/diagnose.js"
},
"engines": {
  "node": ">=22.0.0",
  "pnpm": ">=10.0.0"
}
```

## 次のステップ

### 1. 依存関係のインストール

以下のコマンドを実行して必要なパッケージをインストールします。

```bash
pnpm add @modelcontextprotocol/server-postgres pg openai dotenv express
pnpm add -D nodemon
```

### 2. 環境変数の設定

プロジェクトルートに`.env`ファイルを作成します。

```
SUPABASE_CONNECTION_STRING=postgres://postgres:your-password@your-project-id.supabase.co:5432/postgres
# 必要に応じてOpenAI APIキーを設定
# OPENAI_API_KEY=your-openai-api-key
```

### 3. コアファイルの実装

以下のファイルを作成・実装します。

#### core/server.js

```javascript
// core/server.js - メインMCPサーバー実装
const { McpServer } = require('@modelcontextprotocol/server-postgres');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// 環境変数読み込み
dotenv.config();

// PostgreSQL接続
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING
});

// MCPサーバー初期化
const server = new McpServer({
  name: "HARCA",
  version: "0.1.0",
  description: "Holistic Architecture for Resource Connection and Assistance",
  connectionString: process.env.SUPABASE_CONNECTION_STRING
});

// ツール登録の例（詳細は別ファイルに実装）
server.tool("searchSimilarCode", 
  { query: String, limit: Number },
  async ({ query, limit = 5 }) => {
    // ベクトル検索実装
    const results = await vectorStore.searchSimilar(query, limit);
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);

// メインサーバー起動関数
async function startServer(transportType = 'stdio') {
  try {
    if (transportType === 'stdio') {
      await server.listen();  // STDIO通信モード
    } else {
      // HTTP通信モード（オプション）
      const express = require('express');
      const app = express();
      app.use(express.json());
      
      app.post('/api/mcp', async (req, res) => {
        const result = await server.handleRequest(req.body);
        res.json(result);
      });
      
      const port = process.env.PORT || 3000;
      app.listen(port, () => {
        console.log(`HTTP server listening on port ${port}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// エクスポート
module.exports = { server, startServer, pool };

// 直接実行された場合
if (require.main === module) {
  startServer(process.argv.includes('--http') ? 'http' : 'stdio');
}
```

#### plugins/vector-store/index.js

```javascript
// plugins/vector-store/index.js - ベクトル検索実装
const { Pool } = require('pg');
const { Configuration, OpenAIApi } = require('openai');

class VectorStore {
  constructor(config = {}) {
    // PostgreSQL接続設定
    this.pool = new Pool({
      connectionString: process.env.SUPABASE_CONNECTION_STRING
    });
    
    // OpenAI初期化（ベクトル生成用）
    if (process.env.OPENAI_API_KEY) {
      const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.openai = new OpenAIApi(configuration);
    }
    
    // 使用するベクトル生成方法
    this.embeddingMethod = config.embeddingMethod || 'openai';
    
    // ローカルモデルの初期化（オプション）
    if (this.embeddingMethod === 'local') {
      this.localModel = this.initLocalModel();
    }
  }
  
  // ローカル埋め込みモデル初期化（オプション）
  async initLocalModel() {
    // ここにローカルモデルの初期化コードを実装
    // 例: TensorFlow.js + Universal Sentence Encoder
    // コスト削減のため、OpenAI API代替として
  }
  
  // テキストからベクトルを生成
  async generateEmbedding(text) {
    if (this.embeddingMethod === 'openai') {
      // OpenAI API使用
      const response = await this.openai.createEmbedding({
        model: "text-embedding-ada-002",
        input: text,
      });
      return response.data.data[0].embedding;
    } else {
      // ローカルモデル使用
      return await this.localModel.embed(text);
    }
  }
  
  // コードをベクトル化して保存
  async indexCode(code, metadata) {
    try {
      // コードをベクトル化
      const embedding = await this.generateEmbedding(code);
      
      // PostgreSQLに直接保存
      const query = `
        INSERT INTO code_vectors (content, embedding, metadata, created_at)
        VALUES ($1, $2, $3, $4)
      `;
      
      await this.pool.query(query, [
        code,
        embedding,
        metadata,
        new Date()
      ]);
      
      return true;
    } catch (error) {
      console.error('Failed to index code:', error);
      return false;
    }
  }
  
  // 類似コード検索
  async searchSimilar(query, limit = 5) {
    try {
      // クエリをベクトル化
      const queryEmbedding = await this.generateEmbedding(query);
      
      // pgvectorで直接類似検索
      const result = await this.pool.query(
        'SELECT * FROM match_documents($1, $2, $3)',
        [queryEmbedding, 0.5, limit]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Failed to search similar code:', error);
      return [];
    }
  }
}

module.exports = { VectorStore };
```

#### integrations/windsurf/index.js

```javascript
// integrations/windsurf/index.js - Windsurf連携
const fs = require('fs');
const path = require('path');
const os = require('os');

class WindsurfIntegration {
  constructor() {
    this.configDir = path.join(os.homedir(), '.codeium', 'windsurf');
    this.configPath = path.join(this.configDir, 'mcp_config.json');
  }
  
  // Windsurfのポートを検出（自動検出サーバー用）
  async detectPort() {
    try {
      const portInfoPath = path.join(this.configDir, 'port.json');
      
      if (!fs.existsSync(portInfoPath)) {
        throw new Error('Windsurf port file not found');
      }
      
      const portInfo = JSON.parse(fs.readFileSync(portInfoPath, 'utf8'));
      
      if (!portInfo.port) {
        throw new Error('Invalid port information');
      }
      
      return portInfo.port;
    } catch (error) {
      console.error('Failed to detect Windsurf port:', error);
      throw error;
    }
  }
  
  // Windsurfの設定ファイルを更新（従来方式）
  async updateConfig(serverPath, connectionString) {
    try {
      // 設定ディレクトリ作成
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      
      // 既存設定の読み込み
      let config = { mcpServers: {} };
      if (fs.existsSync(this.configPath)) {
        try {
          config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        } catch (error) {
          console.warn('Failed to parse existing config, creating new one');
        }
      }
      
      // HARCA設定の追加/更新
      config.mcpServers = config.mcpServers || {};
      config.mcpServers.harca = {
        command: "node",
        args: [serverPath],
        env: {
          SUPABASE_CONNECTION_STRING: connectionString
        }
      };
      
      // 設定ファイル保存
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      
      return true;
    } catch (error) {
      console.error('Failed to update Windsurf config:', error);
      return false;
    }
  }
  
  // Windsurfの設定ファイルを更新（MCP設定方式）
  async updateMcpConfig(serverPath, connectionString) {
    try {
      // 設定ディレクトリ作成
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      
      // 既存設定の読み込み
      let config = { mcpServers: {} };
      if (fs.existsSync(this.configPath)) {
        try {
          config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        } catch (error) {
          console.warn('Failed to parse existing config, creating new one');
        }
      }
      
      // MCPサーバー設定の追加/更新（2種類の方法を提供）
      config.mcpServers = config.mcpServers || {};
      
      // 方法1: HARCAを直接実行
      config.mcpServers.harca = {
        command: "node",
        args: [serverPath],
        env: {
          SUPABASE_CONNECTION_STRING: connectionString
        }
      };
      
      // 方法2: Supabase MCP serverを直接使用
      config.mcpServers.supabase = {
        command: "pnpx",
        args: ["-y", "@modelcontextprotocol/server-postgres", connectionString]
      };
      
      // 設定ファイル保存
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      
      return true;
    } catch (error) {
      console.error('Failed to update Windsurf MCP config:', error);
      return false;
    }
  }
  
  // STDIOプロキシの設定を追加
  async setupStdioProxy(proxyPath) {
    try {
      let config = { mcpServers: {} };
      if (fs.existsSync(this.configPath)) {
        config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
      
      config.mcpServers = config.mcpServers || {};
      config.mcpServers['harca-proxy'] = {
        command: "node",
        args: [proxyPath]
      };
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      
      return true;
    } catch (error) {
      console.error('Failed to setup STDIO proxy:', error);
      return false;
    }
  }
}

module.exports = { WindsurfIntegration };
```

#### scripts/setup-windsurf.js

```javascript
// scripts/setup-windsurf.js - Windsurf設定スクリプト
#!/usr/bin/env node
const { WindsurfIntegration } = require('../integrations/windsurf');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

// 対話式インターフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// メイン関数
async function setupWindsurf() {
  console.log('HARCA for Windsurf Cascade Setup');
  console.log('--------------------------------');
  
  // Supabase接続文字列の取得
  const connectionString = await new Promise(resolve => {
    rl.question('Enter your Supabase connection string: ', answer => resolve(answer));
  });
  
  if (!connectionString || !connectionString.includes('postgres://')) {
    console.error('Error: Invalid connection string');
    rl.close();
    return;
  }
  
  // HARCA Server パスの決定
  const harcaPath = path.resolve(__dirname, '..', 'core', 'server.js');
  
  // .env ファイルの作成（ローカル環境用）
  const envPath = path.resolve(__dirname, '..', '.env');
  fs.writeFileSync(envPath, `SUPABASE_CONNECTION_STRING=${connectionString}\n`);
  
  console.log('Environment configuration saved');
  
  // Windsurf設定の更新
  const windsurfIntegration = new WindsurfIntegration();
  
  try {
    // MCP設定に変更
    const result = await windsurfIntegration.updateMcpConfig(harcaPath, connectionString);
    
    if (result) {
      console.log('Windsurf MCP configuration updated successfully');
      console.log('HARCA has been set up for use with Windsurf Cascade');
      console.log('\nPlease restart Windsurf to apply changes');
    } else {
      console.error('Failed to update Windsurf configuration');
    }
  } catch (error) {
    console.error('Error during setup:', error);
  }
  
  rl.close();
}

// スクリプト実行
setupWindsurf().catch(console.error);
```

#### scripts/setup-supabase.js

```javascript
// scripts/setup-supabase.js - Supabase初期設定
#!/usr/bin/env node
const { Pool } = require('pg');
const dotenv = require('dotenv');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// 環境変数ロード
dotenv.config();

// 対話式インターフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// メイン関数
async function setupSupabase() {
  console.log('HARCA Supabase Setup');
  console.log('--------------------');
  
  // Supabase情報の入力
  let connectionString = process.env.SUPABASE_CONNECTION_STRING;
  
  if (!connectionString) {
    connectionString = await new Promise(resolve => {
      rl.question('Enter your Supabase connection string: ', answer => resolve(answer));
    });
  }
  
  // 環境変数の保存
  const envPath = path.resolve(__dirname, '..', '.env');
  fs.writeFileSync(envPath, 
    `SUPABASE_CONNECTION_STRING=${connectionString}\n`
  );
  
  console.log('Environment configuration saved');
  
  // PostgreSQL接続
  const pool = new Pool({
    connectionString: connectionString
  });
  
  // テーブル作成
  console.log('Setting up Supabase database schema...');
  
  try {
    // pgvector拡張のインストール確認
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('Vector extension is enabled or already exists');
    
    // テーブル存在確認
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'code_vectors'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating code_vectors table...');
      
      // テーブル作成
      await pool.query(`
        CREATE TABLE IF NOT EXISTS code_vectors (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content TEXT NOT NULL,
          embedding VECTOR(1536),
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `);
      
      console.log('Table created successfully');
      
      // ベクトル検索関数作成
      console.log('Creating vector search function...');
      await pool.query(`
        CREATE OR REPLACE FUNCTION match_documents(
          query_embedding VECTOR(1536),
          match_threshold FLOAT,
          match_count INT
        )
        RETURNS TABLE (
          id UUID,
          content TEXT,
          metadata JSONB,
          similarity FLOAT
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RETURN QUERY
          SELECT
            code_vectors.id,
            code_vectors.content,
            code_vectors.metadata,
            1 - (code_vectors.embedding <=> query_embedding) AS similarity
          FROM code_vectors
          WHERE 1 - (code_vectors.embedding <=> query_embedding) > match_threshold
          ORDER BY similarity DESC
          LIMIT match_count;
        END;
        $$;
      `);
      
      console.log('Vector search function created successfully');
      
      // インデックス作成（オプション）
      console.log('Creating vector index (this may take a while)...');
      await pool.query(`
        CREATE INDEX ON code_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
      `);
      
      console.log('Vector index created successfully');
    } else {
      console.log('code_vectors table already exists, skipping creation');
    }
    
    console.log('Supabase setup completed successfully!');
  } catch (error) {
    console.error('Error setting up Supabase:', error);
  } finally {
    await pool.end();
    rl.close();
  }
}

// スクリプト実行
setupSupabase().catch(console.error);
```

#### scripts/diagnose.js

```javascript
// scripts/diagnose.js - 診断ツール
#!/usr/bin/env node
const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// 環境変数ロード
dotenv.config();

// 診断モジュール
class Diagnostics {
  constructor() {
    this.results = {
      system: {},
      database: {},
      windsurf: {},
      config: {}
    };
  }
  
  // 基本システム診断
  async checkSystem() {
    console.log('Checking system...');
    
    // Node.jsバージョン
    this.results.system.nodeVersion = process.version;
    console.log(`Node.js version: ${this.results.system.nodeVersion}`);
    
    // OSの情報
    this.results.system.os = {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch()
    };
    console.log(`OS: ${this.results.system.os.platform} ${this.results.system.os.release} (${this.results.system.os.arch})`);
    
    // 環境変数
    this.results.config.hasConnectionString = !!process.env.SUPABASE_CONNECTION_STRING;
    console.log(`Supabase connection string: ${this.results.config.hasConnectionString ? 'Found' : 'Not found'}`);
    
    // 依存パッケージ
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
      this.results.system.dependencies = packageJson.dependencies;
      console.log('Dependencies found');
    } catch (error) {
      console.error('Failed to read package.json:', error);
      this.results.system.dependencies = 'Error reading dependencies';
    }
  }
  
  // データベース接続診断
  async checkDatabase() {
    console.log('\nChecking database connection...');
    
    if (!process.env.SUPABASE_CONNECTION_STRING) {
      console.error('Error: Supabase connection string not found in environment variables');
      this.results.database.status = 'Error: No connection string';
      return;
    }
    
    const pool = new Pool({
      connectionString: process.env.SUPABASE_CONNECTION_STRING
    });
    
    try {
      // 接続テスト
      const res = await pool.query('SELECT version()');
      this.results.database.connected = true;
      this.results.database.version = res.rows[0].version;
      console.log(`Connected to database: ${this.results.database.version}`);
      
      // pgvector拡張確認
      try {
        await pool.query('SELECT * FROM pg_extension WHERE extname = \'vector\'');
        this.results.database.pgvector = true;
        console.log('pgvector extension is installed');
      } catch (error) {
        this.results.database.pgvector = false;
        console.error('pgvector extension is not installed!');
      }
      
      // テーブル確認
      try {
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'code_vectors'
          );
        `);
        
        this.results.database.hasCodeVectorsTable = tableCheck.rows[0].exists;
        console.log(`code_vectors table: ${this.results.database.hasCodeVectorsTable ? 'Found' : 'Not found'}`);
        
        if (this.results.database.hasCodeVectorsTable) {
          // 行数確認
          const countRes = await pool.query('SELECT COUNT(*) FROM code_vectors');
          this.results.database.codeVectorsCount = parseInt(countRes.rows[0].count);
          console.log(`code_vectors entries: ${this.results.database.codeVectorsCount}`);
        }
      } catch (error) {
        console.error('Error checking tables:', error);
        this.results.database.tableError = error.message;
      }
      
      // 検索関数確認
      try {
        const funcCheck = await pool.query(`
          SELECT * FROM pg_proc
          WHERE proname = 'match_documents'
        `);
        
        this.results.database.hasMatchFunction = funcCheck.rowCount > 0;
        console.log(`match_documents function: ${this.results.database.hasMatchFunction ? 'Found' : 'Not found'}`);
      } catch (error) {
        console.error('Error checking functions:', error);
        this.results.database.functionError = error.message;
      }
    } catch (error) {
      console.error('Failed to connect to database:', error);
      this.results.database.connected = false;
      this.results.database.error = error.message;
    } finally {
      await pool.end();
    }
  }
  
  // Windsurf設定診断
  async checkWindsurf() {
    console.log('\nChecking Windsurf integration...');
    
    const configDir = path.join(os.homedir(), '.codeium', 'windsurf');
    const mcpConfigPath = path.join(configDir, 'mcp_config.json');
    const portJsonPath = path.join(configDir, 'port.json');
    
    // 設定ディレクトリの確認
    this.results.windsurf.configDirExists = fs.existsSync(configDir);
    console.log(`Windsurf config directory: ${this.results.windsurf.configDirExists ? 'Found' : 'Not found'}`);
    
    if (this.results.windsurf.configDirExists) {
      // MCPconfig.jsonの確認
      this.results.windsurf.mcpConfigExists = fs.existsSync(mcpConfigPath);
      console.log(`Windsurf MCP config: ${this.results.windsurf.mcpConfigExists ? 'Found' : 'Not found'}`);
      
      if (this.results.windsurf.mcpConfigExists) {
        try {
          const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
          this.results.windsurf.mcpConfig = mcpConfig;
          
          // HARCAの設定確認
          this.results.windsurf.hasHarcaConfig = !!(mcpConfig.mcpServers && mcpConfig.mcpServers.harca);
          console.log(`HARCA configuration: ${this.results.windsurf.hasHarcaConfig ? 'Found' : 'Not found'}`);
          
          // Supabase MCPの設定確認
          this.results.windsurf.hasSupabaseConfig = !!(mcpConfig.mcpServers && mcpConfig.mcpServers.supabase);
          console.log(`Supabase MCP configuration: ${this.results.windsurf.hasSupabaseConfig ? 'Found' : 'Not found'}`);
        } catch (error) {
          console.error('Failed to parse MCP config:', error);
          this.results.windsurf.mcpConfigError = error.message;
        }
      }
      
      // port.jsonの確認
      this.results.windsurf.portJsonExists = fs.existsSync(portJsonPath);
      console.log(`Windsurf port.json: ${this.results.windsurf.portJsonExists ? 'Found' : 'Not found'}`);
      
      if (this.results.windsurf.portJsonExists) {
        try {
          const portInfo = JSON.parse(fs.readFileSync(portJsonPath, 'utf8'));
          this.results.windsurf.port = portInfo.port;
          console.log(`Windsurf port: ${this.results.windsurf.port}`);
        } catch (error) {
          console.error('Failed to parse port.json:', error);
          this.results.windsurf.portError = error.message;
        }
      }
    }
    
    // Windsurf実行確認
    this.checkWindsurfProcess();
  }
  
  // Windsurfプロセス確認
  checkWindsurfProcess() {
    exec('ps aux | grep windsurf | grep -v grep', (error, stdout, stderr) => {
      if (error) {
        console.log('Windsurf process not found');
        this.results.windsurf.running = false;
        return;
      }
      
      const lines = stdout.trim().split('\n');
      this.results.windsurf.running = lines.length > 0;
      console.log(`Windsurf process: ${this.results.windsurf.running ? 'Running' : 'Not found'}`);
    });
  }
  
  // 診断サマリー
  generateSummary() {
    console.log('\n=== Diagnostic Summary ===');
    
    // 全体状態評価
    let systemOk = !!this.results.system.nodeVersion;
    let dbOk = this.results.database.connected && this.results.database.pgvector && this.results.database.hasCodeVectorsTable;
    let windsurfOk = this.results.windsurf.configDirExists && this.results.windsurf.mcpConfigExists && 
                      (this.results.windsurf.hasHarcaConfig || this.results.windsurf.hasSupabaseConfig);
    
    console.log(`System: ${systemOk ? '✅ OK' : '❌ Issues found'}`);
    console.log(`Database: ${dbOk ?