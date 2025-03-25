/**
 * PostgreSQL接続トラブルシューティングの知見をJSONファイルに保存するスクリプト
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';

// __dirnameの代替（ESモジュールでは__dirnameが使えないため）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の設定
dotenv.config();

// 保存先ディレクトリとファイル
const KNOWLEDGE_DIR = path.join(__dirname, '..', '..', 'data', 'troubleshooting-knowledge');
const INDEX_FILE = path.join(KNOWLEDGE_DIR, 'postgres-index.json');

async function savePostgresKnowledge() {
  try {
    console.log('PostgreSQL接続トラブルシューティングの知見をJSONファイルに保存します...');
    
    // 保存先ディレクトリの作成
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
      console.log(`ディレクトリを作成しました: ${KNOWLEDGE_DIR}`);
    }
    
    // 今回のトラブルシューティング内容
    const troubleshootingData = {
      title: 'PostgreSQL接続問題の診断と解決',
      sections: [
        {
          title: '特定した問題',
          content: `
1. **環境変数の不一致**:
   - VectorStoreクラスは\`SUPABASE_CONNECTION_STRING\`環境変数を使用
   - Docker環境では\`POSTGRES_CONNECTION_STRING\`環境変数を定義
   - \`.env.example\`では\`HARCA_POSTGRES_CONNECTION_STRING\`を定義

2. **テーブル構造の不一致**:
   - VectorStoreクラスは\`code_vectors\`テーブルを参照
   - 初期化スクリプトでは\`embeddings\`テーブルを作成

3. **接続設定の問題**:
   - PostgreSQLは3730ポートで実行されているが、設定が正しく反映されていない
          `
        },
        {
          title: '実装した解決策',
          content: `
1. **VectorStoreクラスの修正**:
   - 複数の接続文字列環境変数をチェックするように変更
   - 接続エラーの堅牢なハンドリングを追加
   - テーブル存在確認と適切なテーブル選択ロジックを実装

2. **.env.exampleの更新**:
   - Docker環境変数との整合性を確保
   - 複数の接続文字列オプションを提供
   - ポート番号を3730に統一

3. **診断スクリプトの作成**:
   - PostgreSQL接続状態確認用スクリプト
   - テーブル構造とレコード数の確認機能
          `
        },
        {
          title: '診断結果',
          content: `
- PostgreSQLサーバーは正常に動作（ポート3730）
- pgvector拡張がインストール済み
- \`embeddings\`テーブルと\`code_vectors\`テーブルが存在
- \`code_vectors\`テーブルには5件のレコード
          `
        },
        {
          title: '推奨される次のステップ',
          content: `
1. 環境変数の設定: \`POSTGRES_CONNECTION_STRING=postgres://harca:harca_password@localhost:3730/harca_db\`
2. VectorStore機能のテスト実施
3. ファイルベースのストレージからPostgreSQLへの移行検討
          `
        },
        {
          title: 'コード修正例',
          content: `
\`\`\`javascript
// PostgreSQL接続設定
try {
  // 複数の可能性のある接続文字列環境変数をチェック
  const connectionString = 
    process.env.POSTGRES_CONNECTION_STRING || 
    process.env.HARCA_POSTGRES_CONNECTION_STRING || 
    process.env.SUPABASE_CONNECTION_STRING;
  
  if (!connectionString) {
    throw new Error('PostgreSQL接続文字列が設定されていません');
  }
  
  console.log('PostgreSQL接続を初期化します...');
  this.pool = new Pool({ connectionString });
  
  // 接続テスト
  this.testConnection();
} catch (error) {
  console.error('PostgreSQL接続の初期化に失敗しました:', error.message);
  console.warn('ベクトルストアの機能は制限されます');
  this.pool = null;
}
\`\`\`
          `
        },
        {
          title: 'テーブル互換性の確保',
          content: `
\`\`\`javascript
// テーブル存在確認
const tableExistsQuery = \`
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'embeddings'
  );
\`;

const tableExists = await this.pool.query(tableExistsQuery);

if (tableExists.rows[0].exists) {
  // embeddingsテーブルを使用
  const query = \`
    INSERT INTO embeddings (content, embedding, metadata)
    VALUES ($1, $2::jsonb, $3::jsonb)
    RETURNING id
  \`;
  
  const result = await this.pool.query(query, [content, JSON.stringify(embedding), metadataString]);
} else {
  // code_vectorsテーブルを使用（後方互換性のため）
  const query = \`
    INSERT INTO code_vectors (content, embedding, metadata)
    VALUES ($1, $2::vector, $3::jsonb)
    RETURNING id
  \`;
  
  const result = await this.pool.query(query, [content, vectorString, metadataString]);
}
\`\`\`
          `
        }
      ]
    };
    
    // 各セクションにIDを付与
    troubleshootingData.sections = troubleshootingData.sections.map(section => {
      const id = crypto.createHash('md5').update(section.title + section.content).digest('hex');
      return { ...section, id };
    });
    
    // 全体のデータ
    const knowledgeData = {
      id: crypto.createHash('md5').update(troubleshootingData.title).digest('hex'),
      title: troubleshootingData.title,
      description: 'PostgreSQL接続問題のトラブルシューティング情報',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      tags: ['postgresql', 'vector_store', 'connection_issue', 'pgvector', 'environment_variables', 'docker'],
      sections: troubleshootingData.sections.map(section => ({
        id: section.id,
        title: section.title
      }))
    };
    
    // インデックスファイルの更新
    let indexData = {};
    if (fs.existsSync(INDEX_FILE)) {
      try {
        const indexContent = fs.readFileSync(INDEX_FILE, 'utf8');
        indexData = JSON.parse(indexContent);
      } catch (error) {
        console.warn(`インデックスファイルの読み込みに失敗しました: ${error.message}`);
        indexData = { entries: [] };
      }
    } else {
      indexData = { entries: [] };
    }
    
    // 既存のエントリを確認
    const existingEntryIndex = indexData.entries.findIndex(entry => entry.id === knowledgeData.id);
    if (existingEntryIndex >= 0) {
      // 既存のエントリを更新
      indexData.entries[existingEntryIndex] = knowledgeData;
    } else {
      // 新しいエントリを追加
      indexData.entries.push(knowledgeData);
    }
    
    // インデックスファイルを保存
    fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf8');
    console.log(`インデックスファイルを更新しました: ${INDEX_FILE}`);
    
    // 各セクションを個別のファイルに保存
    for (const section of troubleshootingData.sections) {
      const sectionFile = path.join(KNOWLEDGE_DIR, `postgres-${section.id}.json`);
      fs.writeFileSync(sectionFile, JSON.stringify(section, null, 2), 'utf8');
      console.log(`セクションを保存しました: ${section.title}`);
    }
    
    console.log('PostgreSQL接続トラブルシューティングの知見を保存しました');
    return knowledgeData;
  } catch (error) {
    console.error('知見の保存中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * 知識ベースを検索する
 * @param {string} query 検索クエリ
 * @param {number} limit 結果の最大数
 * @returns {Promise<Array<Object>>} 検索結果
 */
async function searchKnowledge(query, limit = 5) {
  try {
    console.log(`知識ベースを検索: "${query}"`);
    
    // インデックスファイルの読み込み
    if (!fs.existsSync(INDEX_FILE)) {
      console.warn('インデックスファイルが存在しません');
      return [];
    }
    
    const indexContent = fs.readFileSync(INDEX_FILE, 'utf8');
    const indexData = JSON.parse(indexContent);
    
    // 全てのセクションを読み込む
    const allSections = [];
    for (const entry of indexData.entries) {
      for (const sectionInfo of entry.sections) {
        const sectionFile = path.join(KNOWLEDGE_DIR, `postgres-${sectionInfo.id}.json`);
        if (fs.existsSync(sectionFile)) {
          const sectionContent = fs.readFileSync(sectionFile, 'utf8');
          const section = JSON.parse(sectionContent);
          allSections.push({
            ...section,
            entryTitle: entry.title
          });
        }
      }
    }
    
    // 単純なキーワードマッチングによる検索
    const keywords = query.toLowerCase().split(/\s+/);
    
    const results = allSections
      .map(section => {
        const titleMatches = keywords.filter(keyword => 
          section.title.toLowerCase().includes(keyword)
        ).length;
        
        const contentMatches = keywords.filter(keyword => 
          section.content.toLowerCase().includes(keyword)
        ).length;
        
        const score = (titleMatches * 2) + contentMatches;
        
        return {
          ...section,
          score
        };
      })
      .filter(section => section.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    console.log(`${results.length}件の結果が見つかりました`);
    return results;
  } catch (error) {
    console.error('知識ベースの検索中にエラーが発生しました:', error);
    throw error;
  }
}

// スクリプトの実行
savePostgresKnowledge()
  .then(() => {
    console.log('処理が完了しました');
    // 検索テスト
    return searchKnowledge('PostgreSQL 接続 エラー');
  })
  .then(results => {
    console.log('検索結果:', JSON.stringify(results, null, 2));
  })
  .catch(error => {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  });
