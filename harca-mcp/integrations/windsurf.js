// integrations/windsurf.js - Windsurfインテグレーション
const fs = require('fs');
const path = require('path');
const os = require('os');

class WindsurfIntegration {
  constructor() {
    // Windsurfの設定ディレクトリ
    this.configDir = path.join(os.homedir(), '.codeium', 'windsurf');
    this.configFile = path.join(this.configDir, 'mcp_config.json');
  }
  
  // 現在の設定を確認
  checkCurrentConfig() {
    try {
      if (!fs.existsSync(this.configDir)) {
        return { exists: false };
      }
      
      if (!fs.existsSync(this.configFile)) {
        return { exists: false };
      }
      
      const configContent = fs.readFileSync(this.configFile, 'utf8');
      const config = JSON.parse(configContent);
      
      return {
        exists: true,
        config
      };
    } catch (error) {
      console.error('設定ファイルの確認中にエラーが発生しました:', error);
      return { exists: false };
    }
  }
  
  // 設定を更新
  async updateConfig(serverPath, connectionString, openaiApiKey = null) {
    try {
      // 設定ディレクトリが存在しない場合は作成
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      
      // 基本設定
      const config = {
        mcpServers: {
          supabase: {
            command: 'pnpx',
            args: ['@modelcontextprotocol/server-postgres', connectionString]
          }
        }
      };
      
      // 設定ファイルの書き込み
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      console.log(`Windsurf設定を保存しました: ${this.configFile}`);
      
      return true;
    } catch (error) {
      console.error('Windsurf設定の更新中にエラーが発生しました:', error);
      return false;
    }
  }
  
  // Windsurfの再起動（オプション）
  restartWindsurf() {
    console.log('Windsurfの再起動が必要です。');
    console.log('Windsurfを手動で再起動してください。');
  }
}

module.exports = { WindsurfIntegration };
