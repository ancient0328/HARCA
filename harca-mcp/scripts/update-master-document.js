/**
 * マスタードキュメント更新スクリプト
 * 
 * 使用方法: pnpx node scripts/update-master-document.js
 * 
 * このスクリプトはHARCA開発計画マスタードキュメントを更新します。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 定数
const PROJECT_RECORD_DIR = path.join(__dirname, '../../documents/project-record');
const MASTER_DOC_PATH = path.join(PROJECT_RECORD_DIR, 'HARCA-開発計画マスタードキュメント.md');

// 現在の日時を取得
const now = new Date();
const dateStr = now.toISOString().split('T')[0];

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
 * マスタードキュメントを更新する
 * @param {Object} data 更新データ
 */
async function updateMasterDocument(data) {
  // マスタードキュメントを読み込む
  let masterDoc = fs.readFileSync(MASTER_DOC_PATH, 'utf8');

  // 最終更新日を更新
  masterDoc = masterDoc.replace(/\*最終更新: .*\*/, `*最終更新: ${dateStr}*`);

  // 更新タイプに基づいて処理
  switch (data.updateType) {
    case 'milestone':
      // マイルストーンの追加
      const milestoneRegex = /### 完了したマイルストーン\n([\s\S]*?)(?=###|$)/;
      const milestoneMatch = masterDoc.match(milestoneRegex);
      
      if (milestoneMatch) {
        const newMilestone = `- ${data.milestone}（${dateStr}）\n`;
        const updatedSection = milestoneMatch[0].replace(/### 完了したマイルストーン\n/, `### 完了したマイルストーン\n${newMilestone}`);
        masterDoc = masterDoc.replace(milestoneRegex, updatedSection);
      }
      break;
    
    case 'schedule':
      // スケジュールの更新
      const scheduleRegex = new RegExp(`\\| Phase ${data.phase} \\| ${data.taskName} \\|.*\\|.*\\| [^|]* \\|`);
      const scheduleReplacement = `| Phase ${data.phase} | ${data.taskName} | ${data.startDate || '-'} | ${data.endDate || '-'} | ${data.status} |`;
      masterDoc = masterDoc.replace(scheduleRegex, scheduleReplacement);
      break;
    
    case 'phase':
      // フェーズステータスの更新
      const phaseRegex = new RegExp(`\\*\\*状態: .*\\*\\*`, 'g');
      let count = 0;
      masterDoc = masterDoc.replace(phaseRegex, (match) => {
        count++;
        if (count === parseInt(data.phase)) {
          return `**状態: ${data.phaseStatus}**`;
        }
        return match;
      });
      break;
    
    case 'risk':
      // リスク情報の更新
      if (data.riskAction === 'add') {
        const riskTableRegex = /\| リスク \| 影響度 \| 発生確率 \| 対策 \|\n\|-------|-------|---------|------\|([\s\S]*?)(?=\n\n|$)/;
        const riskTableMatch = masterDoc.match(riskTableRegex);
        
        if (riskTableMatch) {
          const newRisk = `\n| ${data.riskName} | ${data.impact} | ${data.probability} | ${data.countermeasure} |`;
          masterDoc = masterDoc.replace(riskTableRegex, riskTableMatch[0] + newRisk);
        }
      } else if (data.riskAction === 'update') {
        const riskRegex = new RegExp(`\\| ${data.riskName} \\|.*\\|.*\\|.*\\|`);
        const riskReplacement = `| ${data.riskName} | ${data.impact} | ${data.probability} | ${data.countermeasure} |`;
        masterDoc = masterDoc.replace(riskRegex, riskReplacement);
      }
      break;
    
    case 'custom':
      // カスタム更新（正規表現を使用）
      if (data.searchRegex && data.replacement) {
        const regex = new RegExp(data.searchRegex, 'g');
        masterDoc = masterDoc.replace(regex, data.replacement);
      }
      break;
  }

  // ファイルに書き込み
  fs.writeFileSync(MASTER_DOC_PATH, masterDoc, 'utf8');
  console.log(`✅ マスタードキュメントが更新されました: ${MASTER_DOC_PATH}`);
}

/**
 * メイン関数
 */
async function main() {
  console.log('🚀 マスタードキュメント更新ツール\n');
  
  try {
    // 更新タイプを選択
    const updateType = await askQuestion(
      '更新タイプを選択してください:\n' +
      '1. マイルストーン追加 (milestone)\n' +
      '2. スケジュール更新 (schedule)\n' +
      '3. フェーズステータス更新 (phase)\n' +
      '4. リスク情報更新 (risk)\n' +
      '5. カスタム更新 (custom)\n' +
      '選択 (1-5): '
    );
    
    const data = { updateType: '' };
    
    // 選択に基づいて処理
    switch (updateType) {
      case '1':
      case 'milestone':
        data.updateType = 'milestone';
        data.milestone = await askQuestion('追加するマイルストーン: ');
        break;
      
      case '2':
      case 'schedule':
        data.updateType = 'schedule';
        data.phase = await askQuestion('フェーズ番号: ');
        data.taskName = await askQuestion('タスク名: ');
        data.startDate = await askQuestion('開始日 (YYYY-MM-DD形式、変更しない場合は空欄): ');
        data.endDate = await askQuestion('終了日 (YYYY-MM-DD形式、変更しない場合は空欄): ');
        data.status = await askQuestion('ステータス (完了/進行中/未開始): ');
        break;
      
      case '3':
      case 'phase':
        data.updateType = 'phase';
        data.phase = await askQuestion('更新するフェーズ番号: ');
        data.phaseStatus = await askQuestion('新しいステータス (例: 完了, 進行中, 計画中): ');
        break;
      
      case '4':
      case 'risk':
        data.updateType = 'risk';
        data.riskAction = await askQuestion('アクション (add: 追加, update: 更新): ');
        data.riskName = await askQuestion('リスク名: ');
        data.impact = await askQuestion('影響度 (高/中/低): ');
        data.probability = await askQuestion('発生確率 (高/中/低): ');
        data.countermeasure = await askQuestion('対策: ');
        break;
      
      case '5':
      case 'custom':
        data.updateType = 'custom';
        data.searchRegex = await askQuestion('検索する正規表現: ');
        data.replacement = await askQuestion('置換テキスト: ');
        break;
      
      default:
        throw new Error('無効な選択です');
    }

    // マスタードキュメントを更新
    await updateMasterDocument(data);
    
    console.log('\n✨ 処理が完了しました');
    console.log(`📚 マスタードキュメント: ${MASTER_DOC_PATH}`);
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    rl.close();
  }
}

// スクリプトを実行
main();
