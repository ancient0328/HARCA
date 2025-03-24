/**
 * HARCA コード分析プラグイン
 * 外部からアクセスするためのインターフェースを提供
 */

import CodeAnalyzer from './analyzer.js';

// シングルトンインスタンスをエクスポート
const analyzer = new CodeAnalyzer();

// 公開API
export default {
  // 単一ファイルの分析
  analyzeFile: (filePath, ruleIds = []) => analyzer.analyzeFile(filePath, ruleIds),
  
  // コード文字列の分析
  analyzeCode: (code, language = 'javascript', ruleIds = []) => {
    return analyzer.analyzeCodeString(code, language, ruleIds);
  },
  
  // プロジェクト全体の分析
  analyzeProject: (projectPath, options = {}) => analyzer.analyzeProject(projectPath, options),
  
  // 利用可能なルールの取得
  getAvailableRules: () => Array.from(analyzer.rules.keys()),
  
  // 特定のルールの詳細情報を取得
  getRuleInfo: (ruleId) => {
    const rule = analyzer.rules.get(ruleId);
    return rule ? { id: ruleId, name: rule.name, description: rule.description } : null;
  }
};
