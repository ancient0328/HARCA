#!/usr/bin/env node

/**
 * HARCA プロジェクト - ドキュメント構造検証スクリプト
 * 
 * このスクリプトは、HARCAプロジェクトのドキュメントが
 * 規定のディレクトリ構造と命名規則に従っているかを検証します。
 * 
 * 使用方法:
 *   pnpm run validate-docs
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 定数定義
const DOCUMENTS_ROOT = path.join(__dirname, '..', 'documents');

// 期待されるディレクトリ構造
const EXPECTED_DIRECTORIES = [
  'api',
  'architecture',
  'decisions',
  'development-phases',
  'development-phases/phase1',
  'development-phases/phase2',
  'development-phases/phase3',
  'development-phases/phase4',
  'development-phases/phase5',
  'guides',
  'log',
  'log/phase1',
  'log/phase2',
  'log/phase3',
  'roadmap',
  'templates'
];

// 命名規則パターン
const NAMING_PATTERNS = {
  'log/phase1': /^project-record1-\d{2}-.*\.md$/,
  'log/phase2': /^project-record2-\d{2}-.*\.md$/,
  'log/phase3': /^project-record3-\d{2}-.*\.md$/,
  'development-phases/phase1': /^.*\.md$/,
  'development-phases/phase2': /^.*\.md$/,
  'development-phases/phase3': /^.*\.md$/
};

// メタデータ要件
const REQUIRED_METADATA = [
  'title',
  'date',
  'author',
  'status',
  'document_number'
];

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

// ディレクトリ構造を検証する関数
const validateDirectoryStructure = () => {
  console.log('ディレクトリ構造を検証しています...');
  
  const missingDirectories = [];
  
  for (const dir of EXPECTED_DIRECTORIES) {
    const dirPath = path.join(DOCUMENTS_ROOT, dir);
    if (!fs.existsSync(dirPath)) {
      missingDirectories.push(dir);
    }
  }
  
  if (missingDirectories.length > 0) {
    console.error('以下のディレクトリが見つかりません:');
    missingDirectories.forEach(dir => console.error(`- ${dir}`));
    
    return false;
  }
  
  console.log('✓ ディレクトリ構造は正常です');
  return true;
};

// ファイルの命名規則を検証する関数
const validateFileNaming = () => {
  console.log('ファイルの命名規則を検証しています...');
  
  let hasErrors = false;
  const invalidFiles = {};
  
  for (const [dir, pattern] of Object.entries(NAMING_PATTERNS)) {
    const dirPath = path.join(DOCUMENTS_ROOT, dir);
    if (!fs.existsSync(dirPath)) {
      continue;
    }
    
    const files = fs.readdirSync(dirPath);
    const invalidFilesInDir = files.filter(file => {
      // ディレクトリはスキップ
      if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
        return false;
      }
      // 隠しファイルはスキップ
      if (file.startsWith('.')) {
        return false;
      }
      // パターンに一致しないファイルを検出
      return !pattern.test(file);
    });
    
    if (invalidFilesInDir.length > 0) {
      hasErrors = true;
      invalidFiles[dir] = invalidFilesInDir;
    }
  }
  
  if (hasErrors) {
    console.error('以下のファイルが命名規則に従っていません:');
    for (const [dir, files] of Object.entries(invalidFiles)) {
      console.error(`\nディレクトリ: ${dir}`);
      console.error('期待される命名パターン:', NAMING_PATTERNS[dir]);
      files.forEach(file => console.error(`- ${file}`));
    }
    
    return false;
  }
  
  console.log('✓ ファイルの命名規則は正常です');
  return true;
};

// ファイルのメタデータを検証する関数
const validateFileMetadata = () => {
  console.log('ファイルのメタデータを検証しています...');
  
  let hasErrors = false;
  const filesWithMissingMetadata = [];
  
  // 検証対象のディレクトリ
  const targetDirs = [
    'log/phase1',
    'log/phase2',
    'log/phase3',
    'architecture',
    'decisions',
    'roadmap'
  ];
  
  for (const dir of targetDirs) {
    const dirPath = path.join(DOCUMENTS_ROOT, dir);
    if (!fs.existsSync(dirPath)) {
      continue;
    }
    
    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.md') && !file.startsWith('.'));
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // メタデータセクションを抽出
      const metadataMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!metadataMatch) {
        filesWithMissingMetadata.push({
          path: path.relative(DOCUMENTS_ROOT, filePath),
          missingFields: ['メタデータセクション全体']
        });
        continue;
      }
      
      const metadataSection = metadataMatch[1];
      const missingFields = [];
      
      // 必須メタデータフィールドを確認
      for (const field of REQUIRED_METADATA) {
        if (!metadataSection.includes(`${field}:`)) {
          missingFields.push(field);
        }
      }
      
      if (missingFields.length > 0) {
        filesWithMissingMetadata.push({
          path: path.relative(DOCUMENTS_ROOT, filePath),
          missingFields
        });
      }
    }
  }
  
  if (filesWithMissingMetadata.length > 0) {
    hasErrors = true;
    console.error('以下のファイルにメタデータが不足しています:');
    
    filesWithMissingMetadata.forEach(item => {
      console.error(`\nファイル: ${item.path}`);
      console.error('不足しているフィールド:', item.missingFields.join(', '));
    });
    
    return false;
  }
  
  console.log('✓ ファイルのメタデータは正常です');
  return true;
};

// 問題を自動修正する関数
const fixIssues = async (createMissingDirs = false, fixNaming = false, addMetadata = false) => {
  // 不足しているディレクトリを作成
  if (createMissingDirs) {
    console.log('不足しているディレクトリを作成しています...');
    
    for (const dir of EXPECTED_DIRECTORIES) {
      const dirPath = path.join(DOCUMENTS_ROOT, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`ディレクトリを作成しました: ${dir}`);
      }
    }
  }
  
  // 命名規則の問題を修正（対話的に）
  if (fixNaming) {
    console.log('命名規則の問題を修正しています...');
    
    for (const [dir, pattern] of Object.entries(NAMING_PATTERNS)) {
      const dirPath = path.join(DOCUMENTS_ROOT, dir);
      if (!fs.existsSync(dirPath)) {
        continue;
      }
      
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        // ディレクトリまたは隠しファイルはスキップ
        if (fs.statSync(filePath).isDirectory() || file.startsWith('.')) {
          continue;
        }
        
        if (!pattern.test(file)) {
          console.log(`\n問題のあるファイル: ${path.join(dir, file)}`);
          console.log('期待される命名パターン:', pattern);
          
          const newName = await getUserInput('新しいファイル名を入力してください (スキップする場合は空欄): ');
          if (newName && newName !== file) {
            const newPath = path.join(dirPath, newName);
            fs.renameSync(filePath, newPath);
            console.log(`ファイル名を変更しました: ${file} -> ${newName}`);
          }
        }
      }
    }
  }
  
  // メタデータの問題を修正
  if (addMetadata) {
    // この部分は複雑なため、実装は省略
    console.log('メタデータの自動修正は複雑なため、手動での修正をお勧めします。');
  }
};

// メイン関数
const main = async () => {
  console.log('HARCA プロジェクト ドキュメント構造検証\n');
  
  let hasErrors = false;
  
  // ディレクトリ構造の検証
  const dirStructureValid = validateDirectoryStructure();
  if (!dirStructureValid) hasErrors = true;
  
  console.log(''); // 空行
  
  // ファイル命名規則の検証
  const fileNamingValid = validateFileNaming();
  if (!fileNamingValid) hasErrors = true;
  
  console.log(''); // 空行
  
  // ファイルメタデータの検証
  const metadataValid = validateFileMetadata();
  if (!metadataValid) hasErrors = true;
  
  // 問題が見つかった場合、修正オプションを提供
  if (hasErrors) {
    console.log('\n問題が見つかりました。自動修正を試みますか？');
    const shouldFix = await getUserInput('修正を実行しますか？ (y/n): ');
    
    if (shouldFix.toLowerCase() === 'y') {
      const createDirs = await getUserInput('不足しているディレクトリを作成しますか？ (y/n): ');
      const fixNames = await getUserInput('ファイル名の問題を修正しますか？ (y/n): ');
      
      await fixIssues(
        createDirs.toLowerCase() === 'y',
        fixNames.toLowerCase() === 'y',
        false // メタデータの自動修正は複雑なため無効
      );
      
      console.log('\n修正後に再検証しています...');
      validateDirectoryStructure();
      validateFileNaming();
      validateFileMetadata();
    }
  } else {
    console.log('\n✓ すべての検証に合格しました！ドキュメント構造は規定に従っています。');
  }
};

// スクリプトの実行
main();
