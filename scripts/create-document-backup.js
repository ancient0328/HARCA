#!/usr/bin/env node

/**
 * HARCA プロジェクト - ドキュメントバックアップスクリプト
 * 
 * このスクリプトは、HARCAプロジェクトのドキュメントを
 * 適切なディレクトリ構造でバックアップします。
 * 
 * 使用方法:
 *   pnpm run backup-documents
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 定数定義
const DOCUMENTS_ROOT = path.join(__dirname, '..', 'documents');
const BACKUPS_ROOT = path.join(__dirname, '..', 'backups');

// 現在の日時を取得（YYYYMMDD_HHMMSS形式）
const getTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

// ディレクトリが存在しない場合は作成
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`ディレクトリを作成しました: ${dirPath}`);
  }
};

// ドキュメントをバックアップする関数
const backupDocuments = () => {
  try {
    // タイムスタンプを取得
    const timestamp = getTimestamp();
    
    // バックアップディレクトリを作成
    const backupDir = path.join(BACKUPS_ROOT, 'documents', `backup_${timestamp}`);
    ensureDirectoryExists(backupDir);
    
    // バックアップログファイルを作成
    const logFilePath = path.join(BACKUPS_ROOT, `document_backup_log_${timestamp}.log`);
    let logContent = `# ドキュメントバックアップログ - ${timestamp}\n\n`;
    
    console.log(`ドキュメントのバックアップを開始します...`);
    
    // rsyncコマンドを使用してドキュメントをバックアップ
    try {
      const rsyncCommand = `rsync -av --exclude=".DS_Store" "${DOCUMENTS_ROOT}/" "${backupDir}/"`;
      console.log(`実行コマンド: ${rsyncCommand}`);
      
      const output = execSync(rsyncCommand, { encoding: 'utf8' });
      logContent += `## バックアップ詳細\n\n\`\`\`\n${output}\`\`\`\n\n`;
      
      console.log(`バックアップが完了しました: ${backupDir}`);
    } catch (error) {
      logContent += `## エラー\n\n\`\`\`\n${error.message}\`\`\`\n\n`;
      console.error(`バックアップ中にエラーが発生しました:`, error);
      
      // rsyncが失敗した場合はcp -rを試みる
      try {
        console.log(`代替方法でバックアップを試みます...`);
        const cpCommand = `cp -r "${DOCUMENTS_ROOT}/"* "${backupDir}/"`;
        console.log(`実行コマンド: ${cpCommand}`);
        
        execSync(cpCommand, { encoding: 'utf8' });
        logContent += `## 代替バックアップ\n\n代替方法でバックアップを実行しました。\n\n`;
        
        console.log(`代替バックアップが完了しました: ${backupDir}`);
      } catch (cpError) {
        logContent += `## 代替バックアップエラー\n\n\`\`\`\n${cpError.message}\`\`\`\n\n`;
        console.error(`代替バックアップ中にエラーが発生しました:`, cpError);
      }
    }
    
    // バックアップサイズを取得
    try {
      const duOutput = execSync(`du -sh "${backupDir}"`, { encoding: 'utf8' });
      logContent += `## バックアップサイズ\n\n\`\`\`\n${duOutput}\`\`\`\n\n`;
    } catch (error) {
      console.log(`バックアップサイズの取得に失敗しました:`, error);
    }
    
    // ログファイルを書き込み
    fs.writeFileSync(logFilePath, logContent);
    console.log(`バックアップログを作成しました: ${logFilePath}`);
    
    // 古いバックアップを管理（オプション）
    manageOldBackups();
    
    return {
      success: true,
      backupDir,
      logFilePath
    };
  } catch (error) {
    console.error(`バックアッププロセス全体でエラーが発生しました:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 古いバックアップを管理する関数
const manageOldBackups = () => {
  try {
    const documentsBackupDir = path.join(BACKUPS_ROOT, 'documents');
    if (!fs.existsSync(documentsBackupDir)) {
      return;
    }
    
    // バックアップディレクトリの一覧を取得
    const backupDirs = fs.readdirSync(documentsBackupDir)
      .filter(dir => dir.startsWith('backup_'))
      .map(dir => ({
        name: dir,
        path: path.join(documentsBackupDir, dir),
        timestamp: dir.replace('backup_', '')
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // 新しい順にソート
    
    // 最大保持数（例：直近10個のバックアップを保持）
    const MAX_BACKUPS = 10;
    
    if (backupDirs.length > MAX_BACKUPS) {
      console.log(`古いバックアップを削除します（${MAX_BACKUPS}個を超えるバックアップ）...`);
      
      // 古いバックアップを削除
      backupDirs.slice(MAX_BACKUPS).forEach(backup => {
        try {
          execSync(`rm -rf "${backup.path}"`);
          console.log(`古いバックアップを削除しました: ${backup.name}`);
        } catch (error) {
          console.error(`バックアップの削除に失敗しました ${backup.name}:`, error);
        }
      });
    }
  } catch (error) {
    console.error(`古いバックアップの管理中にエラーが発生しました:`, error);
  }
};

// スクリプトの実行
backupDocuments();
