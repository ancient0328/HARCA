// integrations/windsurf/code-analysis-bridge.js - Windsurfとコード分析機能の連携ブリッジ
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESモジュールで__dirnameを取得するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// コード分析プラグインのインポート
import codeAnalysisPlugin from '../../features/code-analysis/index.js';

/**
 * Windsurf向けコード分析ブリッジクラス
 * Windsurfからのリクエストを処理し、コード分析機能を提供します
 */
class CodeAnalysisBridge {
  constructor() {
    this.codeAnalysisPlugin = codeAnalysisPlugin;
    console.log('Windsurf向けコード分析ブリッジが初期化されました');
  }

  /**
   * コードを分析し、結果を返します
   * @param {Object} params リクエストパラメータ
   * @param {string} params.code 分析するコード
   * @param {string} params.language コードの言語
   * @param {Array<string>} params.rules 適用するルール（省略時はすべて）
   * @param {Object} params.options 追加オプション
   * @returns {Object} 分析結果
   */
  async analyzeCode(params) {
    try {
      const { code, language = 'javascript', rules = [], options = {} } = params;
      
      // コード分析を実行
      const results = await this.codeAnalysisPlugin.analyzeCode(code, language, rules);
      
      // Windsurf向けにレスポンスをフォーマット
      return this.formatResponseForWindsurf(results, options);
    } catch (error) {
      console.error('コード分析エラー:', error);
      return {
        success: false,
        error: error.message,
        message: 'コード分析中にエラーが発生しました'
      };
    }
  }

  /**
   * 利用可能なコード分析ルールを取得します
   * @returns {Object} ルール情報
   */
  getAvailableRules() {
    try {
      const ruleIds = this.codeAnalysisPlugin.getAvailableRules();
      const rules = ruleIds.map(ruleId => {
        const info = this.codeAnalysisPlugin.getRuleInfo(ruleId);
        return info || { id: ruleId };
      });
      
      return {
        success: true,
        rules
      };
    } catch (error) {
      console.error('ルール取得エラー:', error);
      return {
        success: false,
        error: error.message,
        message: 'ルール情報の取得中にエラーが発生しました'
      };
    }
  }

  /**
   * 分析結果をWindsurf向けにフォーマットします
   * @param {Object} results 分析結果
   * @param {Object} options フォーマットオプション
   * @returns {Object} フォーマットされた結果
   */
  formatResponseForWindsurf(results, options = {}) {
    // 基本情報
    const response = {
      success: true,
      language: results.language,
      metrics: {
        lines: results.lines,
        characters: results.characters
      }
    };
    
    // 詳細な分析結果
    if (results.advanced) {
      response.analysis = {};
      
      // 複雑度分析結果
      if (results.advanced.complexity) {
        response.analysis.complexity = {
          score: results.advanced.complexity.score,
          level: results.advanced.complexity.level,
          details: results.advanced.complexity.details,
          suggestions: results.advanced.complexity.suggestions
        };
      }
      
      // コメント率分析結果
      if (results.advanced.comments) {
        response.analysis.comments = {
          ratio: results.advanced.comments.ratio,
          level: results.advanced.comments.level,
          details: results.advanced.comments.details,
          suggestions: results.advanced.comments.suggestions
        };
      }
      
      // 命名規則分析結果
      if (results.advanced.naming) {
        response.analysis.naming = {
          score: results.advanced.naming.score,
          level: results.advanced.naming.level,
          issues: results.advanced.naming.issues,
          suggestions: results.advanced.naming.suggestions
        };
      }
      
      // 重複コード検出結果
      if (results.advanced.duplication) {
        response.analysis.duplication = {
          duplicates: results.advanced.duplication.duplicates,
          level: results.advanced.duplication.level,
          suggestions: results.advanced.duplication.suggestions
        };
      }
    }
    
    // サマリーを追加（オプション）
    if (options.includeSummary) {
      response.summary = this.generateSummary(results);
    }
    
    return response;
  }

  /**
   * 分析結果のサマリーを生成します
   * @param {Object} results 分析結果
   * @returns {Object} サマリー情報
   */
  generateSummary(results) {
    const summary = {
      overallQuality: 'medium',
      strengths: [],
      weaknesses: [],
      recommendations: []
    };
    
    // 分析結果がない場合は基本サマリーを返す
    if (!results.advanced) {
      summary.overallQuality = 'unknown';
      summary.recommendations.push('高度な分析を有効にして、より詳細な情報を取得してください');
      return summary;
    }
    
    // 複雑度分析のサマリー
    if (results.advanced.complexity) {
      const complexity = results.advanced.complexity;
      
      if (complexity.level === 'low') {
        summary.strengths.push('コードの複雑度が低く、理解しやすい構造になっています');
      } else if (complexity.level === 'high') {
        summary.weaknesses.push('コードの複雑度が高く、理解や保守が難しい可能性があります');
        summary.recommendations.push('複雑な関数を小さな関数に分割することを検討してください');
      }
    }
    
    // コメント率分析のサマリー
    if (results.advanced.comments) {
      const comments = results.advanced.comments;
      
      if (comments.level === 'good') {
        summary.strengths.push('適切なコメント率でコードが文書化されています');
      } else if (comments.level === 'low') {
        summary.weaknesses.push('コメントが少なく、コードの理解が難しい可能性があります');
        summary.recommendations.push('重要な部分にコメントを追加して、コードの意図を明確にしてください');
      } else if (comments.level === 'high') {
        summary.weaknesses.push('コメントが多すぎる可能性があります');
        summary.recommendations.push('自己説明的なコードを書き、必要なコメントに絞ることを検討してください');
      }
    }
    
    // 命名規則分析のサマリー
    if (results.advanced.naming) {
      const naming = results.advanced.naming;
      
      if (naming.level === 'good') {
        summary.strengths.push('変数や関数の命名が適切で、コードの可読性が高いです');
      } else if (naming.level === 'poor') {
        summary.weaknesses.push('変数や関数の命名に問題があり、コードの可読性が低下しています');
        summary.recommendations.push('命名規則に従った、意味のある名前を使用してください');
      }
    }
    
    // 重複コード検出のサマリー
    if (results.advanced.duplication) {
      const duplication = results.advanced.duplication;
      
      if (duplication.level === 'low') {
        summary.strengths.push('コードの重複が少なく、DRYの原則に従っています');
      } else if (duplication.level === 'high') {
        summary.weaknesses.push('コードの重複が多く、保守性に問題がある可能性があります');
        summary.recommendations.push('重複コードを関数やクラスに抽出して再利用することを検討してください');
      }
    }
    
    // 総合的な品質評価
    const strengthCount = summary.strengths.length;
    const weaknessCount = summary.weaknesses.length;
    
    if (strengthCount > weaknessCount * 2) {
      summary.overallQuality = 'high';
    } else if (weaknessCount > strengthCount * 2) {
      summary.overallQuality = 'low';
    } else {
      summary.overallQuality = 'medium';
    }
    
    return summary;
  }
}

export default CodeAnalysisBridge;
