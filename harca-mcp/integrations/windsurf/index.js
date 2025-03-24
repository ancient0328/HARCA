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
        throw new Error('Windsurf port file not found. Is Windsurf running?');
      }
      
      const portInfo = JSON.parse(fs.readFileSync(portInfoPath, 'utf8'));
      
      if (!portInfo.port) {
        throw new Error('Invalid port information in Windsurf config');
      }
      
      console.log(`Detected Windsurf port: ${portInfo.port}`);
      return portInfo.port;
    } catch (error) {
      console.error('Failed to detect Windsurf port:', error);
      throw error;
    }
  }
  
  // Windsurfの設定ファイルを更新
  async updateConfig(serverPath, connectionString, openaiApiKey = null) {
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
      
      // 環境変数の設定
      const env = {
        SUPABASE_CONNECTION_STRING: connectionString
      };
      
      // OpenAI API Keyが提供されていれば追加
      if (openaiApiKey) {
        env.OPENAI_API_KEY = openaiApiKey;
      }
      
      // HARCA設定の追加/更新
      config.mcpServers = config.mcpServers || {};
      config.mcpServers.harca = {
        command: "node",
        args: [serverPath],
        env: env
      };
      
      // 設定ファイル保存
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log(`Updated Windsurf config at: ${this.configPath}`);
      
      return true;
    } catch (error) {
      console.error('Failed to update Windsurf config:', error);
      return false;
    }
  }
  
  // STDIOプロキシの設定を追加（HTTP APIサーバーと連携する場合）
  async setupStdioProxy(proxyPath, apiUrl) {
    try {
      let config = { mcpServers: {} };
      if (fs.existsSync(this.configPath)) {
        config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
      
      config.mcpServers = config.mcpServers || {};
      config.mcpServers['harca-proxy'] = {
        command: "node",
        args: [proxyPath],
        env: {
          HARCA_API_URL: apiUrl || 'http://localhost:3000/api/mcp'
        }
      };
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log(`Added STDIO proxy configuration to Windsurf config`);
      
      return true;
    } catch (error) {
      console.error('Failed to setup STDIO proxy:', error);
      return false;
    }
  }
  
  // 現在の設定を確認
  checkCurrentConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        return { exists: false, message: 'Windsurf config file not found' };
      }
      
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      
      if (!config.mcpServers || !config.mcpServers.harca) {
        return { 
          exists: false, 
          hasConfig: true,
          message: 'HARCA configuration not found in Windsurf config' 
        };
      }
      
      return { 
        exists: true, 
        config: config.mcpServers.harca,
        message: 'HARCA configuration found in Windsurf config' 
      };
    } catch (error) {
      console.error('Error checking Windsurf config:', error);
      return { 
        exists: false, 
        error: error.message,
        message: 'Error checking Windsurf configuration' 
      };
    }
  }
  
  // 設定を削除
  removeConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        return { success: false, message: 'Windsurf config file not found' };
      }
      
      let config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      
      if (!config.mcpServers || !config.mcpServers.harca) {
        return { 
          success: false, 
          message: 'HARCA configuration not found in Windsurf config' 
        };
      }
      
      // HARCA設定を削除
      delete config.mcpServers.harca;
      
      // プロキシ設定も削除
      if (config.mcpServers['harca-proxy']) {
        delete config.mcpServers['harca-proxy'];
      }
      
      // 設定ファイル保存
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      
      return { 
        success: true, 
        message: 'HARCA configuration removed from Windsurf config' 
      };
    } catch (error) {
      console.error('Error removing Windsurf config:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Error removing HARCA configuration' 
      };
    }
  }
}

module.exports = { WindsurfIntegration };
