/**
 * コード分析ルールのインデックス
 * 全ての分析ルールを登録するためのモジュール
 */

import complexityRule from './complexity-rule.js';
import commentsRule from './comments-rule.js';
import namingRule from './naming-rule.js';
import duplicationRule from './duplication-rule.js';

/**
 * 全てのルールをCodeAnalyzerに登録する
 * @param {Object} analyzer CodeAnalyzerインスタンス
 */
export function registerAllRules(analyzer) {
  // 複雑度分析ルールを登録
  analyzer.registerRule('complexity', complexityRule);
  // コメント率分析ルールを登録
  analyzer.registerRule('comments', commentsRule);
  // 命名規則分析ルールを登録
  analyzer.registerRule('naming', namingRule);
  // 重複コード検出ルールを登録
  analyzer.registerRule('duplication', duplicationRule);
}

/**
 * 重複コードを検出する
 * 注: この関数は将来的に duplication-rule.js に移動する予定
 * @param {Array<string>} codeBlocks コードブロックの配列
 * @param {number} minBlockSize 最小ブロックサイズ
 * @returns {Array<Object>} 重複箇所の情報
 */
export function detectDuplication(codeBlocks, minBlockSize = 3) {
  // 将来的に実装予定
  return [];
}
