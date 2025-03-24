#!/usr/bin/env node
/**
 * JSONデータをPostgreSQLにインポートするスクリプト
 * 
 * 使用方法:
 * node import-json-to-pg.js --file=<JSONファイルパス> --table=<テーブル名>
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { program } from 'commander';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// コマンドライン引数の設定
program
  .option('-f, --file <path>', 'インポートするJSONファイルのパス')
  .option('-t, --table <name>', 'インポート先のテーブル名')
  .option('-c, --config <path>', '設定ファイルのパス（オプション）')
  .option('--dry-run', 'データを実際にインポートせずに処理内容を表示')
  .parse(process.argv);

const options = program.opts();

// 必須引数のチェック
if (!options.file || !options.table) {
  console.error('エラー: ファイルパスとテーブル名は必須です');
  program.help();
  process.exit(1);
}

// データベース接続設定
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5700'),
  user: process.env.DB_USER || 'harca',
  password: process.env.DB_PASSWORD || 'harca_password',
  database: process.env.DB_NAME || 'harca_db',
  ssl: process.env.DB_SSL === 'true'
};

// 設定ファイルがある場合は読み込む
if (options.config) {
  try {
    const configData = JSON.parse(fs.readFileSync(options.config, 'utf8'));
    Object.assign(dbConfig, configData);
  } catch (error) {
    console.error(`設定ファイルの読み込みに失敗しました: ${error.message}`);
    process.exit(1);
  }
}

// JSONファイルの読み込み
async function loadJsonData(filePath) {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`JSONファイルの読み込みに失敗しました: ${error.message}`);
    process.exit(1);
  }
}

// PostgreSQLクライアントの作成
async function createClient() {
  const client = new pg.Client(dbConfig);
  try {
    await client.connect();
    console.log('PostgreSQLに接続しました');
    return client;
  } catch (error) {
    console.error(`PostgreSQLへの接続に失敗しました: ${error.message}`);
    process.exit(1);
  }
}

// テーブルのカラム情報を取得
async function getTableColumns(client, tableName) {
  try {
    const query = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `;
    const result = await client.query(query, [tableName]);
    return result.rows;
  } catch (error) {
    console.error(`テーブル情報の取得に失敗しました: ${error.message}`);
    process.exit(1);
  }
}

// データのインポート
async function importData(client, tableName, data, columns) {
  if (!Array.isArray(data)) {
    console.error('エラー: JSONデータは配列形式である必要があります');
    process.exit(1);
  }

  if (data.length === 0) {
    console.log('警告: インポートするデータがありません');
    return;
  }

  console.log(`${data.length}件のレコードをインポートします`);

  // カラム名のリスト
  const columnNames = columns.map(col => col.column_name);
  
  // バッチサイズ
  const BATCH_SIZE = 100;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    
    try {
      // トランザクション開始
      await client.query('BEGIN');
      
      for (const item of batch) {
        // データの検証と変換
        const values = [];
        const placeholders = [];
        
        let valueIndex = 1;
        for (const column of columnNames) {
          if (column in item) {
            let value = item[column];
            
            // JSONBデータ型の処理
            if (typeof value === 'object' && value !== null) {
              value = JSON.stringify(value);
            }
            
            values.push(value);
            placeholders.push(`$${valueIndex++}`);
          }
        }
        
        const columnsToInsert = columnNames.filter(col => col in item);
        
        if (columnsToInsert.length === 0) {
          console.warn(`警告: レコード#${i}にはテーブルのカラムと一致するフィールドがありません`);
          continue;
        }
        
        const query = `
          INSERT INTO ${tableName} (${columnsToInsert.join(', ')})
          VALUES (${placeholders.join(', ')})
          ON CONFLICT DO NOTHING
        `;
        
        if (options.dryRun) {
          console.log(`[DRY RUN] クエリ: ${query}`);
          console.log(`[DRY RUN] 値: ${values.join(', ')}`);
        } else {
          await client.query(query, values);
        }
        
        successCount++;
      }
      
      // トランザクションのコミット
      if (!options.dryRun) {
        await client.query('COMMIT');
      }
      
      console.log(`バッチ処理完了: ${i + 1}〜${Math.min(i + BATCH_SIZE, data.length)}/${data.length}`);
    } catch (error) {
      // エラー発生時はロールバック
      await client.query('ROLLBACK');
      console.error(`インポートエラー: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`インポート完了: 成功=${successCount}, 失敗=${errorCount}`);
}

// メイン処理
async function main() {
  console.log(`JSONファイル '${options.file}' から '${options.table}' テーブルへのインポートを開始します`);
  
  if (options.dryRun) {
    console.log('注意: ドライラン実行中 - 実際のデータは変更されません');
  }
  
  const data = await loadJsonData(options.file);
  const client = await createClient();
  
  try {
    const columns = await getTableColumns(client, options.table);
    
    if (columns.length === 0) {
      console.error(`エラー: テーブル '${options.table}' が存在しないか、カラムがありません`);
      process.exit(1);
    }
    
    console.log(`テーブル '${options.table}' のカラム情報を取得しました`);
    
    await importData(client, options.table, data, columns);
    
    console.log('インポートプロセスが完了しました');
  } finally {
    await client.end();
    console.log('PostgreSQL接続を終了しました');
  }
}

main().catch(error => {
  console.error(`予期しないエラーが発生しました: ${error.message}`);
  process.exit(1);
});
