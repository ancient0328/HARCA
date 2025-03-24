// scripts/add-sample-data.js - サンプルデータ追加スクリプト
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { VectorStore } = require('../features/vector-store');

// 環境変数読み込み
dotenv.config();

// データベース接続とベクトルストアの初期化
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING
});
const vectorStore = new VectorStore();

// サンプルコードデータ
const sampleCodes = [
  {
    content: `
function calculateSum(a, b) {
  return a + b;
}

// 合計を計算
const result = calculateSum(5, 10);
console.log('合計:', result);
    `,
    metadata: {
      language: 'javascript',
      category: 'basic',
      description: '基本的な足し算関数'
    }
  },
  {
    content: `
class User {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
  
  greet() {
    return \`こんにちは、\${this.name}さん！あなたは\${this.age}歳です。\`;
  }
}

const user = new User('田中', 30);
console.log(user.greet());
    `,
    metadata: {
      language: 'javascript',
      category: 'oop',
      description: 'ユーザークラスの実装例'
    }
  },
  {
    content: `
async function fetchUserData(userId) {
  try {
    const response = await fetch(\`https://api.example.com/users/\${userId}\`);
    if (!response.ok) {
      throw new Error('ユーザーデータの取得に失敗しました');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('エラー:', error);
    return null;
  }
}

// 使用例
fetchUserData(123)
  .then(data => console.log('ユーザーデータ:', data))
  .catch(err => console.error('処理エラー:', err));
    `,
    metadata: {
      language: 'javascript',
      category: 'async',
      description: '非同期APIリクエスト関数'
    }
  }
];

// メイン実行関数
async function main() {
  try {
    console.log('サンプルデータの追加を開始します...');
    
    // 既存データの確認
    const checkQuery = 'SELECT COUNT(*) FROM code_vectors';
    const countResult = await pool.query(checkQuery);
    const existingCount = parseInt(countResult.rows[0].count, 10);
    
    console.log(`既存のコードベクトル数: ${existingCount}`);
    
    if (existingCount > 0) {
      console.log('既にデータが存在します。クリアしますか？ (Y/N)');
      // 注意: 実際の対話環境では、ユーザー入力を待つ処理が必要です
      // ここではサンプルとして自動的に続行します
      const clearData = true; // 実際の実装ではユーザー入力に基づいて設定
      
      if (clearData) {
        console.log('既存データをクリアします...');
        await pool.query('DELETE FROM code_vectors');
        console.log('データクリア完了');
      }
    }
    
    // サンプルデータの追加
    console.log('サンプルデータを追加しています...');
    
    for (const sample of sampleCodes) {
      console.log(`コード「${sample.metadata.description}」を追加中...`);
      const success = await vectorStore.indexCode(sample.content, sample.metadata);
      
      if (success) {
        console.log('追加成功');
      } else {
        console.error('追加失敗');
      }
    }
    
    // 結果の確認
    const verifyQuery = 'SELECT COUNT(*) FROM code_vectors';
    const verifyResult = await pool.query(verifyQuery);
    const newCount = parseInt(verifyResult.rows[0].count, 10);
    
    console.log(`追加後のコードベクトル数: ${newCount}`);
    console.log('サンプルデータの追加が完了しました');
    
  } catch (error) {
    console.error('サンプルデータ追加中にエラーが発生しました:', error);
  } finally {
    // 接続終了
    await pool.end();
    console.log('データベース接続を終了しました');
    process.exit(0);
  }
}

// スクリプト実行
main();
