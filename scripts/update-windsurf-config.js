#!/usr/bin/env node
// scripts/update-windsurf-config.js - Windsurfの設定を内部PostgreSQL接続用に更新するスクリプト

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';
import { execSync } from 'child_process';

// ESモジュールでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Windsurfの設定ファイルパス
const getWindsurfConfigPath = () => {
  const homedir = os.homedir();
  
  // OSに応じた設定ファイルのパス
  const configPaths = {
    darwin: path.join(homedir, 'Library', 'Application Support', 'Windsurf', 'config.json'),
    linux: path.join(homedir, '.config', 'windsurf', 'config.json'),
    win32: path.join(homedir, 'AppData', 'Roaming', 'Windsurf', 'config.json')
  };
  
  return configPaths[os.platform()] || configPaths.darwin;
};

// メイン関数
async function updateWindsurfConfig() {
  console.log('Windsurfの設定を内部PostgreSQL接続用に更新します');
  console.log('------------------------------------------------');
  
  try {
    const configPath = getWindsurfConfigPath();
    console.log(`Windsurf設定ファイルのパス: ${configPath}`);
    
    // 設定ファイルが存在するか確認
    if (!fs.existsSync(configPath)) {
      console.error('エラー: Windsurfの設定ファイルが見つかりません。');
      console.error('Windsurfがインストールされているか確認してください。');
      return false;
    }
    
    // 設定ファイルの読み込み
    let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // 現在のMCPサーバー設定を表示
    const currentMcpCommand = config.mcpCommand || '';
    console.log(`現在のMCPサーバー設定: ${currentMcpCommand}`);
    
    // 新しいMCPサーバー設定
    const newMcpCommand = 'pnpx @modelcontextprotocol/client-http http://localhost:3700';
    
    // 設定を更新
    config.mcpCommand = newMcpCommand;
    
    // 設定ファイルのバックアップを作成
    const backupPath = `${configPath}.backup.${Date.now()}`;
    fs.copyFileSync(configPath, backupPath);
    console.log(`設定ファイルのバックアップを作成しました: ${backupPath}`);
    
    // 更新した設定を保存
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Windsurfの設定を更新しました: ${newMcpCommand}`);
    
    // HARCAサーバーの状態を確認
    try {
      const response = execSync('curl -s http://localhost:3700/api/windsurf/health');
      const healthCheck = JSON.parse(response.toString());
      
      if (healthCheck.status === 'ok') {
        console.log('HARCAサーバーは正常に動作しています。');
        console.log(`サービス: ${healthCheck.service}`);
        console.log(`タイムスタンプ: ${healthCheck.timestamp}`);
      } else {
        console.warn('警告: HARCAサーバーの応答が正常ではありません。');
      }
    } catch (error) {
      console.error('警告: HARCAサーバーに接続できません。サーバーが起動しているか確認してください。');
      console.error('コマンド: docker-compose up -d');
    }
    
    console.log('\n設定の更新が完了しました。');
    console.log('変更を適用するには、Windsurfを再起動してください。');
    return true;
  } catch (error) {
    console.error('エラー: 設定の更新に失敗しました。', error);
    return false;
  }
}

// スクリプト実行
updateWindsurfConfig().catch(error => {
  console.error('エラー:', error);
  process.exit(1);
});
