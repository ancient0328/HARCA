/**
 * @fileoverview 長期記憶モジュールのエントリーポイント
 * 
 * このファイルでは、長期記憶（知識ベース）モジュールのエクスポートを行います。
 */

import { KnowledgeBase, KnowledgeType } from './knowledge-base.js';
import { RuleEngine, RuleOperator, RuleActionType } from './rule-engine.js';

export {
  KnowledgeBase,
  KnowledgeType,
  RuleEngine,
  RuleOperator,
  RuleActionType
};

/**
 * 長期記憶モジュールの初期化
 * @param {Object} options 設定オプション
 * @returns {Object} 初期化されたモジュールオブジェクト
 */
export function initializeLongTermMemory(options = {}) {
  const knowledgeBase = new KnowledgeBase(options);
  const ruleEngine = new RuleEngine({ 
    ...options, 
    knowledgeBase 
  });
  
  return {
    knowledgeBase,
    ruleEngine
  };
}
