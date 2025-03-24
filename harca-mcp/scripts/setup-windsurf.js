#!/usr/bin/env node
// scripts/setup-windsurf.js - Windsurf設定スクリプト
const { WindsurfIntegration } = require('../integrations/windsurf');
const path = require('path');
const readline = require('readline');
const fs = require('fs');
const os = require('os');

// 対話式インターフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 質問関数
function question(query) {
  return new Promise(resolve => {
    rl.question(query, answer => resolve(answer));
  });
}

// メイン関数
async function setupWindsurf() {
  console.log('HARCA for Windsurf Cascade Setup');
  console.log('--------------------------------');
  
  try {
    // Windsurfインテグレーションのインスタンス化
    const windsurfIntegration = new WindsurfIntegration();
    
    // 現在の設定を確認
    const currentConfig = windsurfIntegration.checkCurrentConfig();
    if (currentConfig.exists) {
      console.log('既存のHARCA設定が見つかりました。');
      const overwrite = await question('設定を上書きしますか？ (y/n): ');
      
      if (overwrite.toLowerCase() !== 'y') {
        console.log('セットアップをキャンセルしました。');
        rl.close();
        return;
      }
    }
    
    // HARCA Server パスの決定
    const harcaPath = path.resolve(__dirname, '..', 'core', 'server.js');
    console.log(`HARCA Server path: ${harcaPath}`);
    
    // 環境変数ファイルのパス
    const envPath = path.resolve(__dirname, '..', '.env');
    
    // 既存の環境変数を読み込む
    let existingEnv = {};
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length === 2) {
          existingEnv[parts[0].trim()] = parts[1].trim();
        }
      });
    }
    
    // Supabase接続文字列の取得
    let connectionString = existingEnv.SUPABASE_CONNECTION_STRING;
    if (!connectionString) {
      connectionString = await question('Supabase接続文字列を入力してください: ');
      
      if (!connectionString || !connectionString.includes('postgres://')) {
        console.error('エラー: 無効な接続文字列です');
        rl.close();
        return;
      }
    } else {
      console.log('既存のSupabase接続文字列が見つかりました。');
      const useExisting = await question('既存の接続文字列を使用しますか？ (y/n): ');
      
      if (useExisting.toLowerCase() !== 'y') {
        connectionString = await question('新しいSupabase接続文字列を入力してください: ');
        
        if (!connectionString || !connectionString.includes('postgres://')) {
          console.error('エラー: 無効な接続文字列です');
          rl.close();
          return;
        }
      }
    }
    
    // OpenAI API Keyの取得（オプション）
    let openaiApiKey = existingEnv.OPENAI_API_KEY;
    if (!openaiApiKey) {
      const useOpenAI = await question('OpenAI APIを使用しますか？ (y/n): ');
      
      if (useOpenAI.toLowerCase() === 'y') {
        openaiApiKey = await question('OpenAI API Keyを入力してください: ');
      }
    } else {
      console.log('既存のOpenAI API Keyが見つかりました。');
      const useExisting = await question('既存のAPI Keyを使用しますか？ (y/n): ');
      
      if (useExisting.toLowerCase() !== 'y') {
        const useOpenAI = await question('OpenAI APIを使用しますか？ (y/n): ');
        
        if (useOpenAI.toLowerCase() === 'y') {
          openaiApiKey = await question('新しいOpenAI API Keyを入力してください: ');
        } else {
          openaiApiKey = null;
        }
      }
    }
    
    // .env ファイルの作成（ローカル環境用）
    let envContent = `SUPABASE_CONNECTION_STRING=${connectionString}\n`;
    if (openaiApiKey) {
      envContent += `OPENAI_API_KEY=${openaiApiKey}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('環境設定を保存しました。');
    
    // Windsurf設定の更新
    const result = await windsurfIntegration.updateConfig(harcaPath, connectionString, openaiApiKey);
    
    if (result) {
      console.log('Windsurf設定を更新しました。');
      console.log('HARCAがWindsurf Cascadeで使用できるようになりました。');
      console.log('\n変更を適用するには、Windsurfを再起動してください。');
    } else {
      console.error('Windsurf設定の更新に失敗しました。');
    }
  } catch (error) {
    console.error('セットアップ中にエラーが発生しました:', error);
  } finally {
    rl.close();
  }
}

// スクリプト実行
setupWindsurf().catch(error => {
  console.error('セットアップに失敗しました:', error);
  process.exit(1);
});
