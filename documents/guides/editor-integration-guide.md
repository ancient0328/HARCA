# HARCA エディタ連携実装

## Windsurf Cascade 連携

Windsurf Cascadeとの円滑な連携を実現するモジュールです。

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
  
  // Windsurfの設定ファイルを更新
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

## Cursor 連携

Cursor エディタとの連携を実装します。

```javascript
// integrations/cursor/index.js - Cursor連携
const fs = require('fs');
const path = require('path');
const os = require('os');

class CursorIntegration {
  constructor() {
    this.configDir = path.join(os.homedir(), '.cursor');
    this.configPath = path.join(this.configDir, 'mcp_config.json');
  }
  
  // Cursorの設定ファイルを更新
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
      console.error('Failed to update Cursor config:', error);
      return false;
    }
  }
}

module.exports = { CursorIntegration };
```

## VSCode 連携

VSCode エディタとの連携を実装します。

```javascript
// integrations/vscode/index.js - VSCode連携
const fs = require('fs');
const path = require('path');
const os = require('os');

class VSCodeIntegration {
  constructor() {
    this.configDir = path.join(os.homedir(), '.vscode');
    this.configPath = path.join(this.configDir, 'mcp_config.json');
  }
  
  // VSCodeの設定ファイルを更新
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
      console.error('Failed to update VSCode config:', error);
      return false;
    }
  }
}

module.exports = { VSCodeIntegration };
```

## 設定スクリプト

各エディタの設定を行うためのユーティリティスクリプトです。

```javascript
// scripts/setup-editors.js - エディタ設定スクリプト
#!/usr/bin/env node
const { WindsurfIntegration } = require('../integrations/windsurf');
const { CursorIntegration } = require('../integrations/cursor');
const { VSCodeIntegration } = require('../integrations/vscode');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

// 対話式インターフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 利用可能なエディタ
const EDITORS = {
  'windsurf': {
    name: 'Windsurf Cascade',
    class: WindsurfIntegration
  },
  'cursor': {
    name: 'Cursor',
    class: CursorIntegration
  },
  'vscode': {
    name: 'VS Code',
    class: VSCodeIntegration
  }
};

// メイン関数
async function setupEditor(editorId) {
  console.log('HARCA Editor Integration Setup');
  console.log('--------------------------------');
  
  // エディタ選択
  if (!editorId || !EDITORS[editorId]) {
    console.log('Available editors:');
    Object.entries(EDITORS).forEach(([id, info]) => {
      console.log(`  ${id} - ${info.name}`);
    });
    
    editorId = await new Promise(resolve => {
      rl.question('Select editor to setup: ', answer => resolve(answer));
    });
    
    if (!EDITORS[editorId]) {
      console.error(`Error: Unknown editor "${editorId}"`);
      rl.close();
      return;
    }
  }
  
  const editorInfo = EDITORS[editorId];
  console.log(`Setting up ${editorInfo.name}...`);
  
  // Supabase接続文字列の取得
  let connectionString = process.env.SUPABASE_CONNECTION_STRING;
  if (!connectionString) {
    connectionString = await new Promise(resolve => {
      rl.question('Enter your Supabase connection string: ', answer => resolve(answer));
    });
  }
  
  if (!connectionString || !connectionString.includes('postgres://')) {
    console.error('Error: Invalid connection string');
    rl.close();
    return;
  }
  
  // HARCA Server パスの決定
  const harcaPath = path.resolve(__dirname, '..', 'core', 'server.js');
  
  // エディタ設定の更新
  const integration = new editorInfo.class();
  
  try {
    const result = await integration.updateConfig(harcaPath, connectionString);
    
    if (result) {
      console.log(`✅ ${editorInfo.name} configuration updated successfully`);
      console.log(`HARCA has been set up for use with ${editorInfo.name}`);
      console.log(`\nPlease restart ${editorInfo.name} to apply changes`);
    } else {
      console.error(`Failed to update ${editorInfo.name} configuration`);
    }
  } catch (error) {
    console.error('Error during setup:', error);
  }
  
  rl.close();
}

// コマンドライン引数があれば使用
const editorArg = process.argv[2];
setupEditor(editorArg).catch(console.error);
