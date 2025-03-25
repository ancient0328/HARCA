/**
 * Redis PubSubトラブルシューティングの知見をJSONファイルに保存するスクリプト
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
const INDEX_FILE = path.join(KNOWLEDGE_DIR, 'index.json');

async function saveTroubleshootingKnowledge() {
  try {
    console.log('Redis PubSubトラブルシューティングの知見をJSONファイルに保存します...');
    
    // 保存先ディレクトリの作成
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
      console.log(`ディレクトリを作成しました: ${KNOWLEDGE_DIR}`);
    }
    
    // トラブルシューティングレポートの読み込み
    const reportPath = '/Users/ancient0328/Development/GitHub/HARCA/documents/project/log/phase1/troubleshooting-redis-pubsub.md';
    const reportContent = fs.readFileSync(reportPath, 'utf8');
    
    // レポートをセクションに分割
    const sections = splitReportIntoSections(reportContent);
    
    // インデックスファイルの初期化
    const index = {
      title: 'Redis PubSubトラブルシューティング知識ベース',
      description: 'Redis PubSubを使用した分散キャッシュシステムのトラブルシューティング情報',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      sections: []
    };
    
    // 各セクションを保存
    console.log(`${sections.length}個のセクションを保存します...`);
    
    for (const [idx, section] of sections.entries()) {
      const { title, content } = section;
      
      // セクションIDの生成
      const id = crypto.createHash('md5').update(`${title}-${idx}`).digest('hex');
      
      // メタデータの作成
      const metadata = {
        id,
        title,
        source: 'troubleshooting-redis-pubsub',
        category: 'distributed-cache',
        technology: ['redis', 'pubsub', 'caching'],
        date: new Date().toISOString(),
        sectionIndex: idx,
        wordCount: content.split(/\s+/).length,
        charCount: content.length
      };
      
      // セクションファイルの保存
      const sectionFile = path.join(KNOWLEDGE_DIR, `${id}.json`);
      const sectionData = {
        ...metadata,
        content
      };
      
      fs.writeFileSync(sectionFile, JSON.stringify(sectionData, null, 2), 'utf8');
      console.log(`セクション "${title}" を保存しました (ID: ${id})`);
      
      // インデックスに追加（コンテンツは含めない）
      index.sections.push({
        ...metadata,
        contentPreview: content.substring(0, 150) + (content.length > 150 ? '...' : '')
      });
    }
    
    // インデックスファイルの保存
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
    console.log(`インデックスファイルを保存しました: ${INDEX_FILE}`);
    
    console.log('すべてのセクションの保存が完了しました');
    
    // テスト検索を実行
    console.log('\n検索テスト:');
    const testQueries = [
      '無限ループ Redis PubSub',
      'キャッシュキー生成の不一致',
      '分散システムでのイベント伝播'
    ];
    
    for (const query of testQueries) {
      console.log(`\n検索クエリ: "${query}"`);
      const results = await searchKnowledge(query, 2);
      
      if (results.length > 0) {
        console.log('検索結果:');
        for (const [i, result] of results.entries()) {
          console.log(`${i + 1}. ${result.title} (スコア: ${result.score.toFixed(3)})`);
          console.log(`   ${result.contentPreview}`);
        }
      } else {
        console.log('検索結果がありません');
      }
    }
    
    console.log('\nトラブルシューティング知識の保存と検索テストが完了しました');
    
  } catch (error) {
    console.error('トラブルシューティング知識の保存中にエラーが発生しました:', error);
    console.error(error.stack);
  }
}

/**
 * マークダウンレポートをセクションに分割する
 * @param {string} reportContent レポートの内容
 * @returns {Array<{title: string, content: string}>} セクションの配列
 */
function splitReportIntoSections(reportContent) {
  const sections = [];
  const lines = reportContent.split('\n');
  
  let currentTitle = '';
  let currentContent = [];
  
  for (const line of lines) {
    // 新しいセクションの開始（## で始まる行）
    if (line.startsWith('## ')) {
      // 前のセクションがあれば保存
      if (currentTitle && currentContent.length > 0) {
        sections.push({
          title: currentTitle,
          content: currentContent.join('\n')
        });
      }
      
      // 新しいセクションの開始
      currentTitle = line.replace('## ', '');
      currentContent = [line];
    }
    // サブセクションの開始（### で始まる行）
    else if (line.startsWith('### ')) {
      // サブセクションも独立したセクションとして扱う
      if (currentTitle && currentContent.length > 0) {
        sections.push({
          title: currentTitle,
          content: currentContent.join('\n')
        });
      }
      
      // 新しいサブセクションの開始
      currentTitle = line.replace('### ', '');
      currentContent = [line];
    }
    // 通常の行
    else {
      currentContent.push(line);
    }
  }
  
  // 最後のセクションを追加
  if (currentTitle && currentContent.length > 0) {
    sections.push({
      title: currentTitle,
      content: currentContent.join('\n')
    });
  }
  
  // 全体のレポートも1つのセクションとして追加
  sections.unshift({
    title: 'Redis PubSubトラブルシューティングレポート（全体）',
    content: reportContent
  });
  
  return sections;
}

/**
 * 知識ベースを検索する
 * @param {string} query 検索クエリ
 * @param {number} limit 結果の最大数
 * @returns {Promise<Array<Object>>} 検索結果
 */
async function searchKnowledge(query, limit = 5) {
  try {
    // インデックスファイルの読み込み
    const indexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    
    // 検索クエリの単語を分割
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    // 各セクションのスコアを計算
    const results = indexData.sections.map(section => {
      // タイトルと内容のプレビューを結合してスコアリング
      const text = `${section.title} ${section.contentPreview}`.toLowerCase();
      
      // 単純なスコアリング: 各検索語の出現回数を数える
      let score = 0;
      for (const term of queryTerms) {
        const regex = new RegExp(term, 'gi');
        const matches = text.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      
      // タイトルに含まれる場合はスコアを高くする
      for (const term of queryTerms) {
        if (section.title.toLowerCase().includes(term)) {
          score += 5;
        }
      }
      
      // 技術タグに一致する場合もスコアを高くする
      for (const tech of section.technology) {
        if (queryTerms.includes(tech.toLowerCase())) {
          score += 3;
        }
      }
      
      return {
        ...section,
        score
      };
    });
    
    // スコアでソートして上位の結果を返す
    return results
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error('検索中にエラーが発生しました:', error);
    return [];
  }
}

// スクリプトの実行
saveTroubleshootingKnowledge()
  .then(() => {
    console.log('処理が完了しました');
    process.exit(0);
  })
  .catch(error => {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  });
