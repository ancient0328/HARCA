#!/usr/bin/env node
// scripts/setup-supabase.js - Supabase初期設定
const dotenv = require('dotenv');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 環境変数ロード
dotenv.config();

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

// SQLクエリの実行
async function executeQuery(pool, query) {
  try {
    await pool.query(query);
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

// メイン関数
async function setupSupabase() {
  console.log('HARCA Supabase Setup');
  console.log('--------------------');
  
  try {
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
    
    // 環境変数の保存
    let envContent = `SUPABASE_CONNECTION_STRING=${connectionString}\n`;
    if (existingEnv.OPENAI_API_KEY) {
      envContent += `OPENAI_API_KEY=${existingEnv.OPENAI_API_KEY}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('環境設定を保存しました。');
    
    // PostgreSQL接続
    console.log('Supabaseデータベースに接続しています...');
    const pool = new Pool({ connectionString });
    
    try {
      await pool.query('SELECT NOW()');
      console.log('データベース接続に成功しました。');
    } catch (error) {
      console.error('データベース接続に失敗しました:', error.message);
      rl.close();
      return;
    }
    
    // pgvector拡張のインストール
    console.log('pgvector拡張をインストールしています...');
    const pgvectorResult = await executeQuery(pool, 'CREATE EXTENSION IF NOT EXISTS vector;');
    
    if (pgvectorResult.success) {
      console.log('pgvector拡張のインストールに成功しました。');
    } else {
      console.error('pgvector拡張のインストールに失敗しました:', pgvectorResult.error.message);
      console.log('Supabase Studio から手動でインストールしてください。');
      console.log('SQL: CREATE EXTENSION IF NOT EXISTS vector;');
    }
    
    // code_vectors テーブル作成
    console.log('code_vectors テーブルを作成しています...');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS code_vectors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        embedding VECTOR(1536),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `;
    
    const tableResult = await executeQuery(pool, createTableSQL);
    
    if (tableResult.success) {
      console.log('code_vectors テーブルの作成に成功しました。');
    } else {
      console.error('code_vectors テーブルの作成に失敗しました:', tableResult.error.message);
      console.log('Supabase Studio から手動で作成してください。');
      console.log(`SQL: ${createTableSQL}`);
    }
    
    // ベクトル検索関数の作成
    console.log('ベクトル検索関数を作成しています...');
    const createFunctionSQL = `
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
    `;
    
    const functionResult = await executeQuery(pool, createFunctionSQL);
    
    if (functionResult.success) {
      console.log('ベクトル検索関数の作成に成功しました。');
    } else {
      console.error('ベクトル検索関数の作成に失敗しました:', functionResult.error.message);
      console.log('Supabase Studio から手動で作成してください。');
      console.log(`SQL: ${createFunctionSQL}`);
    }
    
    // インデックス作成（オプション）
    const createIndex = await question('大規模データセット用のインデックスを作成しますか？ (y/n): ');
    
    if (createIndex.toLowerCase() === 'y') {
      console.log('ベクトルインデックスを作成しています...');
      const createIndexSQL = `
        CREATE INDEX IF NOT EXISTS code_vectors_embedding_idx
        ON code_vectors
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `;
      
      const indexResult = await executeQuery(pool, createIndexSQL);
      
      if (indexResult.success) {
        console.log('ベクトルインデックスの作成に成功しました。');
      } else {
        console.error('ベクトルインデックスの作成に失敗しました:', indexResult.error.message);
        console.log('Supabase Studio から手動で作成してください。');
        console.log(`SQL: ${createIndexSQL}`);
      }
    }
    
    console.log('\nSupabaseの設定が完了しました。');
    console.log('HARCAサーバーを起動する準備ができました。');
    
    // 接続を閉じる
    await pool.end();
  } catch (error) {
    console.error('セットアップ中にエラーが発生しました:', error);
  } finally {
    rl.close();
  }
}

// スクリプト実行
setupSupabase().catch(error => {
  console.error('セットアップに失敗しました:', error);
  process.exit(1);
});
