/**
 * HARCA コード分析モジュール
 * コードの品質や構造を分析し、フィードバックを提供
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { registerAllRules } from './rules/index.js';

/**
 * コード分析クラス
 */
class CodeAnalyzer {
  /**
   * コンストラクタ
   */
  constructor() {
    // 分析ルールのマップ
    this.rules = new Map();
    
    // デフォルトの分析ルールを登録
    this.registerDefaultRules();
    
    console.log('コード分析モジュールが初期化されました');
  }
  
  /**
   * デフォルトの分析ルールを登録
   */
  registerDefaultRules() {
    // 外部ルールモジュールから全てのルールを登録
    registerAllRules(this);
  }
  
  /**
   * 分析ルールを登録
   * @param {string} id ルールID
   * @param {Object} rule ルールオブジェクト
   */
  registerRule(id, rule) {
    this.rules.set(id, rule);
  }
  
  /**
   * コード文字列を分析
   * @param {string} code コード文字列
   * @param {string} language 言語
   * @param {Array<string>} ruleIds 適用するルールID
   * @returns {Object} 分析結果
   */
  analyzeCodeString(code, language = 'javascript', ruleIds = []) {
    try {
      // 基本的な分析情報
      const basicInfo = {
        language,
        lines: code.split('\n').length,
        characters: code.length
      };
      
      // 適用するルールを決定
      const rulesToApply = this.determineRulesToApply(ruleIds);
      
      // 各ルールを適用
      const results = {};
      for (const [id, rule] of rulesToApply) {
        try {
          results[id] = rule.analyze(code, language);
        } catch (ruleError) {
          console.error(`ルール ${id} の実行中にエラーが発生しました:`, ruleError);
          results[id] = { error: ruleError.message };
        }
      }
      
      return {
        basicInfo,
        results
      };
    } catch (error) {
      console.error('コード分析エラー:', error);
      return {
        error: `コード分析エラー: ${error.message}`
      };
    }
  }
  
  /**
   * 単一ファイルを分析
   * @param {string} filePath ファイルパス
   * @param {Array<string>} ruleIds 適用するルールID
   * @returns {Object} 分析結果
   */
  analyzeFile(filePath, ruleIds = []) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが存在しません: ${filePath}`);
      }
      
      const code = fs.readFileSync(filePath, 'utf8');
      const language = path.extname(filePath).substring(1);
      
      const result = this.analyzeCodeString(code, language, ruleIds);
      return {
        ...result,
        filePath
      };
    } catch (error) {
      console.error(`ファイル ${filePath} の分析中にエラーが発生しました:`, error);
      return {
        error: `ファイル分析エラー: ${error.message}`,
        filePath
      };
    }
  }
  
  /**
   * プロジェクト全体を分析
   * @param {string} projectPath プロジェクトパス
   * @param {Object} options オプション
   * @returns {Object} 分析結果
   */
  analyzeProject(projectPath, options = {}) {
    const {
      extensions = ['.js', '.jsx', '.ts', '.tsx'],
      exclude = ['node_modules', 'dist', 'build', '.git'],
      maxFiles = 100,
      ruleIds = []
    } = options;
    
    try {
      if (!fs.existsSync(projectPath)) {
        throw new Error(`プロジェクトパスが存在しません: ${projectPath}`);
      }
      
      // ファイル一覧を取得
      const files = this.findFiles(projectPath, extensions, exclude, maxFiles);
      
      // 各ファイルを分析
      const fileResults = {};
      for (const file of files) {
        fileResults[file] = this.analyzeFile(file, ruleIds);
      }
      
      // プロジェクト全体の統計を計算
      const projectStats = this.calculateProjectStats(fileResults);
      
      return {
        projectPath,
        fileCount: files.length,
        stats: projectStats,
        files: fileResults
      };
    } catch (error) {
      console.error(`プロジェクト ${projectPath} の分析中にエラーが発生しました:`, error);
      return {
        error: `プロジェクト分析エラー: ${error.message}`,
        projectPath
      };
    }
  }
  
  /**
   * 適用するルールを決定
   * @param {Array<string>} ruleIds 適用するルールID
   * @returns {Map} 適用するルールのマップ
   */
  determineRulesToApply(ruleIds) {
    // 指定されたルールIDが空の場合は全てのルールを適用
    if (!ruleIds || ruleIds.length === 0) {
      return this.rules;
    }
    
    // 指定されたルールIDのみを適用
    const rulesToApply = new Map();
    for (const id of ruleIds) {
      const rule = this.rules.get(id);
      if (rule) {
        rulesToApply.set(id, rule);
      }
    }
    
    return rulesToApply;
  }
  
  /**
   * プロジェクト内のファイルを検索
   * @param {string} dir ディレクトリパス
   * @param {Array<string>} extensions 対象拡張子
   * @param {Array<string>} exclude 除外パターン
   * @param {number} maxFiles 最大ファイル数
   * @returns {Array<string>} ファイルパスの配列
   */
  findFiles(dir, extensions, exclude, maxFiles) {
    const files = [];
    
    const shouldExclude = (path) => {
      return exclude.some(pattern => path.includes(pattern));
    };
    
    const walk = (currentDir) => {
      if (shouldExclude(currentDir)) return;
      if (files.length >= maxFiles) return;
      
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        if (files.length >= maxFiles) break;
        
        const itemPath = path.join(currentDir, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          if (!shouldExclude(itemPath)) {
            walk(itemPath);
          }
        } else if (stats.isFile()) {
          const ext = path.extname(itemPath);
          if (extensions.includes(ext) && !shouldExclude(itemPath)) {
            files.push(itemPath);
          }
        }
      }
    };
    
    walk(dir);
    return files;
  }
  
  /**
   * プロジェクト全体の統計を計算
   * @param {Object} fileResults ファイル分析結果
   * @returns {Object} プロジェクト統計
   */
  calculateProjectStats(fileResults) {
    let totalLines = 0;
    let totalChars = 0;
    let totalFiles = 0;
    
    const ruleStats = {};
    
    for (const filePath in fileResults) {
      const result = fileResults[filePath];
      if (result.error) continue;
      
      totalFiles++;
      totalLines += result.basicInfo.lines;
      totalChars += result.basicInfo.characters;
      
      // ルール別の統計を集計
      for (const ruleId in result.results) {
        if (!ruleStats[ruleId]) {
          ruleStats[ruleId] = {
            issueCount: 0,
            fileCount: 0
          };
        }
        
        const ruleResult = result.results[ruleId];
        if (ruleResult.issues && ruleResult.issues.length > 0) {
          ruleStats[ruleId].issueCount += ruleResult.issues.length;
          ruleStats[ruleId].fileCount++;
        }
      }
    }
    
    return {
      totalFiles,
      totalLines,
      totalChars,
      ruleStats
    };
  }
}

export default CodeAnalyzer;
