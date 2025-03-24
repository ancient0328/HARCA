/**
 * すべてのドキュメント更新スクリプト
 * 
 * 使用方法: pnpx node scripts/update-all-docs.js
 * 
 * このスクリプトはプロジェクト記録の作成とマスタードキュメントの更新を一括で行います。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// 定数
const PROJECT_RECORD_DIR = path.join(__dirname, '../../documents/project-record');
const MASTER_DOC_PATH = path.join(PROJECT_RECORD_DIR, 'HARCA-開発計画マスタードキュメント.md');
const README_VECTOR_STORE_PATH = path.join(__dirname, '../features/vector-store/README-vector-store-api.md');
const README_DISTRIBUTED_CACHE_PATH = path.join(__dirname, '../features/vector-store/README-distributed-cache.md');

// 現在の日時を取得
const now = new Date();
const dateStr = now.toISOString().split('T')[0];
const dateTimeStr = now.toISOString().replace(/:/g, '-').split('.')[0];

// ユーザー入力を取得するためのインターフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * ユーザーに質問をして回答を取得する
 * @param {string} question 質問文
 * @returns {Promise<string>} ユーザーの回答
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * プロジェクト記録を作成する
 * @param {Object} data 記録データ
 * @returns {string} 作成されたファイルのパス
 */
async function createProjectRecord(data) {
  // 最新のプロジェクト記録番号を取得
  const files = fs.readdirSync(PROJECT_RECORD_DIR);
  const recordFiles = files.filter(file => file.startsWith('project-record') && file.endsWith('.md'));
  const numbers = recordFiles.map(file => {
    const match = file.match(/project-record(\d+)\.md/);
    return match ? parseInt(match[1], 10) : 0;
  });
  
  const latestNumber = Math.max(...numbers, 0);
  const newNumber = latestNumber + 1;
  const newFileName = `project-record${newNumber}.md`;
  const newFilePath = path.join(PROJECT_RECORD_DIR, newFileName);

  // テンプレートを作成
  const content = `# プロジェクト記録 ${newNumber}

## 日付
${dateStr}

## 実装概要
${data.summary}

## 実装内容
${data.details}

## 実装者
${data.implementer}

## 関連ファイル
${data.relatedFiles}

## 今後の課題
${data.futureTasks}

## 備考
${data.notes}
`;

  // ファイルに書き込み
  fs.writeFileSync(newFilePath, content, 'utf8');
  console.log(`✅ プロジェクト記録が作成されました: ${newFilePath}`);

  return newFilePath;
}

/**
 * マスタードキュメントを更新する
 * @param {Object} data 更新データ
 */
async function updateMasterDocument(data) {
  // マスタードキュメントを読み込む
  let masterDoc = fs.readFileSync(MASTER_DOC_PATH, 'utf8');

  // 最終更新日を更新
  masterDoc = masterDoc.replace(/\*最終更新: .*\*/, `*最終更新: ${dateStr}*`);

  // 完了したマイルストーンに追加
  if (data.summary) {
    const completedMilestoneRegex = /### 完了したマイルストーン\n([\s\S]*?)(?=###|$)/;
    const completedMilestoneMatch = masterDoc.match(completedMilestoneRegex);
    
    if (completedMilestoneMatch) {
      const newMilestone = `- ${data.summary}（${dateStr}）\n`;
      const updatedSection = completedMilestoneMatch[0].replace(/### 完了したマイルストーン\n/, `### 完了したマイルストーン\n${newMilestone}`);
      masterDoc = masterDoc.replace(completedMilestoneRegex, updatedSection);
    }
  }

  // 開発スケジュールの状態を更新
  if (data.phase && data.taskName) {
    const scheduleRegex = new RegExp(`\\| Phase ${data.phase} \\| ${data.taskName} \\|.*\\|.*\\| [^|]* \\|`);
    const scheduleReplacement = `| Phase ${data.phase} | ${data.taskName} | ${data.startDate || '-'} | ${dateStr} | ${data.status || '完了'} |`;
    masterDoc = masterDoc.replace(scheduleRegex, scheduleReplacement);
  }

  // フェーズステータスの更新
  if (data.phase && data.phaseStatus) {
    const phaseStatusRegex = new RegExp(`## Phase ${data.phase}:.*\\n\\n\\*\\*状態:.*\\*\\*`, 'g');
    const phaseStatusReplacement = `## Phase ${data.phase}:.*\\n\\n\\*\\*状態: ${data.phaseStatus}\\*\\*`;
    masterDoc = masterDoc.replace(phaseStatusRegex, phaseStatusReplacement);
  }

  // ファイルに書き込み
  fs.writeFileSync(MASTER_DOC_PATH, masterDoc, 'utf8');
  console.log(`✅ マスタードキュメントが更新されました: ${MASTER_DOC_PATH}`);
}

/**
 * READMEファイルの開発ステータスセクションを更新する
 * @param {Object} data 更新データ
 */
async function updateReadmeFiles(data) {
  if (data.updateReadme) {
    // Vector Store APIのREADMEを更新
    if (fs.existsSync(README_VECTOR_STORE_PATH)) {
      let readmeContent = fs.readFileSync(README_VECTOR_STORE_PATH, 'utf8');
      
      // 開発ステータスセクションを更新
      if (data.phase === '2') {
        const phaseRegex = /### Phase 2 \(.*\)/;
        const phaseReplacement = `### Phase 2 (更新: ${dateStr})`;
        readmeContent = readmeContent.replace(phaseRegex, phaseReplacement);
      }
      
      fs.writeFileSync(README_VECTOR_STORE_PATH, readmeContent, 'utf8');
      console.log(`✅ Vector Store APIのREADMEが更新されました: ${README_VECTOR_STORE_PATH}`);
    }
    
    // 分散キャッシュのREADMEを更新
    if (fs.existsSync(README_DISTRIBUTED_CACHE_PATH)) {
      let readmeContent = fs.readFileSync(README_DISTRIBUTED_CACHE_PATH, 'utf8');
      
      // 最新のベンチマーク結果セクションを更新
      const benchmarkRegex = /最新のベンチマーク結果（.*実施）/;
      const benchmarkReplacement = `最新のベンチマーク結果（${dateStr}実施）`;
      readmeContent = readmeContent.replace(benchmarkRegex, benchmarkReplacement);
      
      fs.writeFileSync(README_DISTRIBUTED_CACHE_PATH, readmeContent, 'utf8');
      console.log(`✅ 分散キャッシュのREADMEが更新されました: ${README_DISTRIBUTED_CACHE_PATH}`);
    }
  }
}

/**
 * メイン関数
 */
async function main() {
  console.log('🚀 ドキュメント一括更新ツール\n');
  
  try {
    console.log('このツールはプロジェクト記録の作成とマスタードキュメントの更新を一括で行います。');
    console.log('必要な情報を入力してください。\n');
    
    // ユーザーから情報を収集
    const data = {
      summary: await askQuestion('実装概要: '),
      details: await askQuestion('実装内容 (複数行の場合は\\nで区切ってください): '),
      implementer: await askQuestion('実装者: '),
      relatedFiles: await askQuestion('関連ファイル (複数の場合は\\nで区切ってください): '),
      futureTasks: await askQuestion('今後の課題: '),
      notes: await askQuestion('備考: '),
      phase: await askQuestion('フェーズ番号 (例: 1, 2, 3): '),
      taskName: await askQuestion('タスク名 (開発スケジュールの項目名と一致させてください): '),
      startDate: await askQuestion('開始日 (YYYY-MM-DD形式、不明な場合は空欄): '),
      status: await askQuestion('ステータス (完了/進行中/未開始): '),
      phaseStatus: await askQuestion('フェーズ全体のステータス (例: 完了, 進行中, 計画中): '),
      updateReadme: (await askQuestion('READMEファイルも更新しますか？ (y/n): ')).toLowerCase() === 'y'
    };

    // 改行を処理
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'string') {
        data[key] = data[key].replace(/\\n/g, '\n');
      }
    });

    // プロジェクト記録を作成
    const recordPath = await createProjectRecord(data);
    
    // マスタードキュメントを更新
    await updateMasterDocument(data);
    
    // READMEファイルを更新
    await updateReadmeFiles(data);
    
    console.log('\n✨ すべての処理が完了しました');
    console.log(`📝 プロジェクト記録: ${recordPath}`);
    console.log(`📚 マスタードキュメント: ${MASTER_DOC_PATH}`);
    
    if (data.updateReadme) {
      console.log(`📘 Vector Store API README: ${README_VECTOR_STORE_PATH}`);
      console.log(`📘 分散キャッシュ README: ${README_DISTRIBUTED_CACHE_PATH}`);
    }
    
    console.log('\n注意: 必要に応じて手動で内容を確認・調整してください。');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    rl.close();
  }
}

// スクリプトを実行
main();
