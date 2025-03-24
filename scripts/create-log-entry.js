#!/usr/bin/env node

/**
 * HARCA プロジェクト - ログエントリ作成スクリプト
 * 
 * このスクリプトは、HARCAプロジェクトの開発記録（ログエントリ）を
 * 適切なディレクトリ構造と命名規則に従って作成します。
 * 
 * 使用方法:
 *   pnpm run create-log-entry
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// 定数定義
const DOCUMENTS_ROOT = path.join(__dirname, '..', 'documents');
const LOG_ROOT = path.join(DOCUMENTS_ROOT, 'log');
const BACKUPS_ROOT = path.join(__dirname, '..', 'backups');

// 現在の日付を取得（YYYY-MM-DD形式）
const getCurrentDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// 現在のフェーズを取得
const getCurrentPhase = () => {
  // 現在のフェーズを決定するロジック（例：最新のフェーズディレクトリを探す）
  try {
    const phaseDirectories = fs.readdirSync(path.join(DOCUMENTS_ROOT, 'development-phases'))
      .filter(dir => dir.startsWith('phase'))
      .sort();
    
    if (phaseDirectories.length === 0) {
      return 'phase1';
    }
    
    return phaseDirectories[phaseDirectories.length - 1];
  } catch (error) {
    console.error('フェーズディレクトリの読み取りに失敗しました:', error);
    return 'phase1'; // デフォルトはフェーズ1
  }
};

// ユーザー入力を取得するための関数
const getUserInput = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

// ログエントリを作成する関数
const createLogEntry = async () => {
  try {
    // 現在のフェーズを取得
    const currentPhase = await getUserInput(`フェーズを指定してください (例: phase3) [${getCurrentPhase()}]: `) || getCurrentPhase();
    
    // ログディレクトリが存在することを確認
    const logPhaseDir = path.join(LOG_ROOT, currentPhase);
    if (!fs.existsSync(logPhaseDir)) {
      fs.mkdirSync(logPhaseDir, { recursive: true });
      console.log(`ディレクトリを作成しました: ${logPhaseDir}`);
    }
    
    // 既存のログエントリを取得して番号を決定
    const existingLogs = fs.readdirSync(logPhaseDir)
      .filter(file => file.startsWith(`project-record${currentPhase.replace('phase', '')}`))
      .sort();
    
    let nextNumber = 1;
    if (existingLogs.length > 0) {
      const lastLog = existingLogs[existingLogs.length - 1];
      const match = lastLog.match(/project-record\d+-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    // タイトルを取得
    const title = await getUserInput('ログエントリのタイトルを入力してください: ');
    if (!title) {
      console.error('タイトルは必須です。');
      return;
    }
    
    // ファイル名を生成
    const phaseNumber = currentPhase.replace('phase', '');
    const fileName = `project-record${phaseNumber}-${String(nextNumber).padStart(2, '0')}-${title.replace(/\s+/g, '-')}.md`;
    const filePath = path.join(logPhaseDir, fileName);
    
    // 関連ドキュメントを取得
    const relatedDocs = await getUserInput('関連ドキュメントをカンマ区切りで入力してください (省略可): ');
    const relatedDocsArray = relatedDocs ? relatedDocs.split(',').map(doc => doc.trim()) : [];
    
    // テンプレートを作成
    const template = `---
title: "${title}"
date: "${getCurrentDate()}"
author: "HARCA開発チーム"
status: "completed"
document_number: "LOG-P${phaseNumber}-${String(nextNumber).padStart(3, '0')}"
related_documents: [${relatedDocsArray.map(doc => `"${doc}"`).join(', ')}]
---

# ${title}

## 概要

ここに概要を記述してください。

## 実施内容

### 1. 項目1

ここに詳細を記述してください。

### 2. 項目2

ここに詳細を記述してください。

## 技術的詳細

### 実装方法

\`\`\`javascript
// コードサンプル
\`\`\`

### 設定変更

\`\`\`json
{
  "key": "value"
}
\`\`\`

## 結果と効果

- 効果1
- 効果2

## 今後の課題

- 課題1
- 課題2

## 参考情報

- [参考リンク1](URL)
- [参考リンク2](URL)
`;
    
    // ファイルを書き込み
    fs.writeFileSync(filePath, template);
    console.log(`ログエントリを作成しました: ${filePath}`);
    
    // エディタでファイルを開く（オプション）
    const openInEditor = await getUserInput('エディタでファイルを開きますか？ (y/n): ');
    if (openInEditor.toLowerCase() === 'y') {
      try {
        execSync(`code "${filePath}"`, { stdio: 'inherit' });
      } catch (error) {
        console.log(`ファイルを手動で開いてください: ${filePath}`);
      }
    }
    
    console.log('\n次のステップ:');
    console.log('1. ログエントリの内容を編集して保存してください');
    console.log('2. 必要に応じて `pnpm run update-master-document` を実行してマスタードキュメントを更新してください');
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
};

// スクリプトの実行
createLogEntry();
