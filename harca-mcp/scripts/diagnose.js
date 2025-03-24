#!/usr/bin/env node
// scripts/diagnose.js - HARCA診断ツール
const { WindsurfIntegration } = require('../integrations/windsurf');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Pool } = require('pg');

// 環境変数ロード
dotenv.config();

class Diagnostics {
  constructor() {
    this.results = {
      system: {},
      database: {},
      windsurf: {},
      environment: {}
    };
  }
  
  // システム情報の確認
  async checkSystem() {
    console.log('システム情報を確認しています...');
    
    try {
      this.results.system.nodeVersion = process.version;
      this.results.system.platform = process.platform;
      this.results.system.arch = process.arch;
      this.results.system.homeDir = os.homedir();
      this.results.system.hostname = os.hostname();
      
      // パッケージ情報
      const packagePath = path.resolve(__dirname, '..', 'package.json');
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        this.results.system.packageVersion = packageJson.version;
        this.results.system.packageName = packageJson.name;
      } else {
        this.results.system.packageError = 'package.jsonが見つかりません';
      }
      
      console.log('システム情報の確認が完了しました。');
    } catch (error) {
      console.error('システム情報の確認中にエラーが発生しました:', error);
      this.results.system.error = error.message;
    }
  }
  
  // 環境変数の確認
  async checkEnvironment() {
    console.log('環境変数を確認しています...');
    
    try {
      const envPath = path.resolve(__dirname, '..', '.env');
      this.results.environment.envFileExists = fs.existsSync(envPath);
      
      // 接続文字列の確認（マスク処理）
      if (process.env.SUPABASE_CONNECTION_STRING) {
        const connStr = process.env.SUPABASE_CONNECTION_STRING;
        // 接続文字列をマスク
        const maskedConnStr = connStr.replace(/:[^:@]+@/, ':****@');
        this.results.environment.supabaseConnectionString = maskedConnStr;
        this.results.environment.hasConnectionString = true;
      } else {
        this.results.environment.hasConnectionString = false;
        this.results.environment.connectionStringError = 'Supabase接続文字列が設定されていません';
      }
      
      // OpenAI API Keyの確認
      this.results.environment.hasOpenAiKey = !!process.env.OPENAI_API_KEY;
      
      console.log('環境変数の確認が完了しました。');
    } catch (error) {
      console.error('環境変数の確認中にエラーが発生しました:', error);
      this.results.environment.error = error.message;
    }
  }
  
  // データベース接続の確認
  async checkDatabase() {
    console.log('データベース接続を確認しています...');
    
    try {
      if (!process.env.SUPABASE_CONNECTION_STRING) {
        this.results.database.error = 'Supabase接続文字列が設定されていません';
        return;
      }
      
      const pool = new Pool({
        connectionString: process.env.SUPABASE_CONNECTION_STRING
      });
      
      // 接続テスト
      try {
        const result = await pool.query('SELECT NOW()');
        this.results.database.connected = true;
        this.results.database.timestamp = result.rows[0].now;
      } catch (error) {
        this.results.database.connected = false;
        this.results.database.connectionError = error.message;
      }
      
      // pgvector拡張の確認
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'vector'
          );
        `);
        this.results.database.pgvectorEnabled = result.rows[0].exists;
      } catch (error) {
        this.results.database.pgvectorError = error.message;
      }
      
      // code_vectors テーブルの確認
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'code_vectors'
          );
        `);
        this.results.database.tableExists = result.rows[0].exists;
        
        if (this.results.database.tableExists) {
          const countResult = await pool.query('SELECT COUNT(*) FROM code_vectors');
          this.results.database.vectorCount = parseInt(countResult.rows[0].count);
        }
      } catch (error) {
        this.results.database.tableError = error.message;
      }
      
      // ベクトル検索関数の確認
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT 1 FROM pg_proc WHERE proname = 'match_documents'
          );
        `);
        this.results.database.searchFunctionExists = result.rows[0].exists;
      } catch (error) {
        this.results.database.functionError = error.message;
      }
      
      await pool.end();
      console.log('データベース接続の確認が完了しました。');
    } catch (error) {
      console.error('データベース接続の確認中にエラーが発生しました:', error);
      this.results.database.error = error.message;
    }
  }
  
  // Windsurf連携の確認
  async checkWindsurf() {
    console.log('Windsurf連携を確認しています...');
    
    try {
      const windsurfIntegration = new WindsurfIntegration();
      const configCheck = windsurfIntegration.checkCurrentConfig();
      
      this.results.windsurf.configExists = configCheck.exists;
      this.results.windsurf.configMessage = configCheck.message;
      
      if (configCheck.exists && configCheck.config) {
        this.results.windsurf.serverPath = configCheck.config.args[0];
        this.results.windsurf.hasConnectionString = !!configCheck.config.env.SUPABASE_CONNECTION_STRING;
        this.results.windsurf.hasOpenAiKey = !!configCheck.config.env.OPENAI_API_KEY;
      }
      
      // ポート検出の試行
      try {
        const port = await windsurfIntegration.detectPort();
        this.results.windsurf.portDetected = true;
        this.results.windsurf.port = port;
      } catch (error) {
        this.results.windsurf.portDetected = false;
        this.results.windsurf.portError = error.message;
      }
      
      console.log('Windsurf連携の確認が完了しました。');
    } catch (error) {
      console.error('Windsurf連携の確認中にエラーが発生しました:', error);
      this.results.windsurf.error = error.message;
    }
  }
  
  // ファイル構造の確認
  async checkFileStructure() {
    console.log('ファイル構造を確認しています...');
    
    try {
      const rootDir = path.resolve(__dirname, '..');
      this.results.files = {};
      
      // コアファイルの確認
      const serverPath = path.join(rootDir, 'core', 'server.js');
      this.results.files.serverExists = fs.existsSync(serverPath);
      
      // ベクトルストアプラグインの確認
      const vectorStorePath = path.join(rootDir, 'features', 'vector-store', 'index.js');
      this.results.files.vectorStoreExists = fs.existsSync(vectorStorePath);
      
      // Windsurf連携の確認
      const windsurfPath = path.join(rootDir, 'integrations', 'windsurf', 'index.js');
      this.results.files.windsurfIntegrationExists = fs.existsSync(windsurfPath);
      
      // スクリプトの確認
      const setupWindsurfPath = path.join(rootDir, 'scripts', 'setup-windsurf.js');
      this.results.files.setupWindsurfExists = fs.existsSync(setupWindsurfPath);
      
      const setupSupabasePath = path.join(rootDir, 'scripts', 'setup-supabase.js');
      this.results.files.setupSupabaseExists = fs.existsSync(setupSupabasePath);
      
      console.log('ファイル構造の確認が完了しました。');
    } catch (error) {
      console.error('ファイル構造の確認中にエラーが発生しました:', error);
      this.results.files.error = error.message;
    }
  }
  
  // 全診断の実行
  async runAll() {
    console.log('HARCA診断を開始します...');
    console.log('=======================');
    
    await this.checkSystem();
    await this.checkEnvironment();
    await this.checkDatabase();
    await this.checkWindsurf();
    await this.checkFileStructure();
    
    console.log('\n診断結果:');
    console.log('=========');
    console.log(JSON.stringify(this.results, null, 2));
    
    // 問題の概要
    this.summarizeIssues();
  }
  
  // 問題の概要を表示
  summarizeIssues() {
    console.log('\n診断概要:');
    console.log('=========');
    
    const issues = [];
    
    // データベース接続の問題
    if (this.results.database.connected === false) {
      issues.push('⚠️ データベース接続に失敗しました。Supabase接続文字列を確認してください。');
    }
    
    if (this.results.database.pgvectorEnabled === false) {
      issues.push('⚠️ pgvector拡張が有効になっていません。Supabase Studioで拡張を有効化してください。');
    }
    
    if (this.results.database.tableExists === false) {
      issues.push('⚠️ code_vectorsテーブルが存在しません。setup-supabase.jsを実行してください。');
    }
    
    if (this.results.database.searchFunctionExists === false) {
      issues.push('⚠️ ベクトル検索関数が存在しません。setup-supabase.jsを実行してください。');
    }
    
    // Windsurf連携の問題
    if (this.results.windsurf.configExists === false) {
      issues.push('⚠️ Windsurfの設定ファイルにHARCA設定がありません。setup-windsurf.jsを実行してください。');
    }
    
    if (this.results.windsurf.portDetected === false) {
      issues.push('⚠️ Windsurfのポート検出に失敗しました。Windsurfが起動しているか確認してください。');
    }
    
    // 環境変数の問題
    if (this.results.environment.hasConnectionString === false) {
      issues.push('⚠️ Supabase接続文字列が設定されていません。.envファイルを確認してください。');
    }
    
    if (this.results.environment.hasOpenAiKey === false) {
      issues.push('ℹ️ OpenAI API Keyが設定されていません。ベクトル生成にはAPIキーが必要です。');
    }
    
    // ファイル構造の問題
    if (!this.results.files.serverExists) {
      issues.push('⚠️ core/server.jsが見つかりません。コアサーバーファイルを作成してください。');
    }
    
    if (!this.results.files.vectorStoreExists) {
      issues.push('⚠️ features/vector-store/index.jsが見つかりません。ベクトルストアプラグインを作成してください。');
    }
    
    if (!this.results.files.windsurfIntegrationExists) {
      issues.push('⚠️ integrations/windsurf/index.jsが見つかりません。Windsurf連携モジュールを作成してください。');
    }
    
    // 問題がなければ成功メッセージ
    if (issues.length === 0) {
      console.log('✅ すべての診断項目が正常です。HARCAは正しく設定されています。');
    } else {
      console.log('以下の問題が見つかりました:');
      issues.forEach(issue => console.log(issue));
      
      console.log('\n推奨される対応:');
      if (issues.some(i => i.includes('Supabase'))) {
        console.log('1. node scripts/setup-supabase.js を実行してSupabaseを設定してください。');
      }
      if (issues.some(i => i.includes('Windsurf'))) {
        console.log('2. node scripts/setup-windsurf.js を実行してWindsurfとの連携を設定してください。');
      }
      if (issues.some(i => i.includes('.env'))) {
        console.log('3. プロジェクトルートに.envファイルを作成し、必要な環境変数を設定してください。');
      }
    }
  }
}

// メイン実行
async function main() {
  const diagnostics = new Diagnostics();
  await diagnostics.runAll();
}

// スクリプト実行
main().catch(error => {
  console.error('診断中にエラーが発生しました:', error);
  process.exit(1);
});
