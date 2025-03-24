/**
 * @fileoverview 長期記憶（ルールエンジン）モジュール
 * 
 * このファイルでは、ルールベースの推論を行うためのルールエンジンクラスを定義しています。
 * ルールエンジンは、知識ベースに保存されたルールを使用して推論を行います。
 */

import { v4 as uuidv4 } from 'uuid';
import { KnowledgeBase, KnowledgeType } from './knowledge-base.js';

/**
 * ルール条件演算子の列挙型
 * @enum {string}
 */
export const RuleOperator = {
  EQUALS: 'equals',           // 等しい
  NOT_EQUALS: 'not_equals',   // 等しくない
  GREATER_THAN: 'gt',         // より大きい
  LESS_THAN: 'lt',            // より小さい
  CONTAINS: 'contains',       // 含む
  NOT_CONTAINS: 'not_contains', // 含まない
  STARTS_WITH: 'starts_with', // で始まる
  ENDS_WITH: 'ends_with',     // で終わる
  MATCHES: 'matches',         // 正規表現にマッチする
  EXISTS: 'exists',           // 存在する
  NOT_EXISTS: 'not_exists'    // 存在しない
};

/**
 * ルールアクションタイプの列挙型
 * @enum {string}
 */
export const RuleActionType = {
  SET_VALUE: 'set_value',       // 値を設定
  INCREMENT: 'increment',       // 増加
  DECREMENT: 'decrement',       // 減少
  APPEND: 'append',             // 追加
  REMOVE: 'remove',             // 削除
  TRIGGER_EVENT: 'trigger_event', // イベントをトリガー
  EXECUTE_FUNCTION: 'execute_function' // 関数を実行
};

/**
 * ルールエンジンクラス
 */
export class RuleEngine {
  /**
   * RuleEngineのインスタンスを作成する
   * @param {Object} options 設定オプション
   */
  constructor(options = {}) {
    this.knowledgeBase = options.knowledgeBase || new KnowledgeBase(options);
    
    // 関数レジストリ
    this.functionRegistry = new Map();
    
    // イベントリスナー
    this.eventListeners = new Map();
    
    // デフォルト関数の登録
    this._registerDefaultFunctions();
  }

  /**
   * ルールを作成する
   * @param {Object} ruleData ルールデータ
   * @param {string} ruleData.name ルール名
   * @param {Array} ruleData.conditions 条件の配列
   * @param {Array} ruleData.actions アクションの配列
   * @param {Object} ruleData.metadata メタデータ
   * @returns {Promise<string>} ルールID
   */
  async createRule(ruleData) {
    // ルールの検証
    this._validateRule(ruleData);
    
    // ルールオブジェクトの作成
    const rule = {
      name: ruleData.name,
      description: ruleData.description || '',
      conditions: ruleData.conditions,
      actions: ruleData.actions,
      priority: ruleData.priority || 0,
      active: ruleData.active !== false, // デフォルトはtrue
      metadata: ruleData.metadata || {}
    };
    
    // 知識ベースに保存
    return this.knowledgeBase.store({
      content: JSON.stringify(rule),
      type: KnowledgeType.RULE,
      categories: ['rules', ...(ruleData.categories || [])],
      tags: ['rule', ...(ruleData.tags || [])],
      metadata: {
        rule_name: rule.name,
        rule_priority: rule.priority,
        rule_active: rule.active,
        ...rule.metadata
      }
    });
  }

  /**
   * ルールを取得する
   * @param {string} ruleId ルールID
   * @returns {Promise<Object|null>} ルールオブジェクト
   */
  async getRule(ruleId) {
    const knowledge = await this.knowledgeBase.get(ruleId);
    
    if (!knowledge || knowledge.type !== KnowledgeType.RULE) {
      return null;
    }
    
    try {
      return JSON.parse(knowledge.content);
    } catch (error) {
      console.error(`Error parsing rule: ${error.message}`);
      return null;
    }
  }

  /**
   * ルールを更新する
   * @param {string} ruleId ルールID
   * @param {Object} ruleData 更新データ
   * @returns {Promise<Object|null>} 更新されたルール
   */
  async updateRule(ruleId, ruleData) {
    const currentRule = await this.getRule(ruleId);
    
    if (!currentRule) {
      return null;
    }
    
    // 更新データの適用
    const updatedRule = {
      ...currentRule,
      ...ruleData
    };
    
    // ルールの検証
    this._validateRule(updatedRule);
    
    // 知識ベースを更新
    await this.knowledgeBase.update(ruleId, {
      content: JSON.stringify(updatedRule),
      metadata: {
        rule_name: updatedRule.name,
        rule_priority: updatedRule.priority,
        rule_active: updatedRule.active,
        ...updatedRule.metadata
      }
    });
    
    return updatedRule;
  }

  /**
   * ルールを削除する
   * @param {string} ruleId ルールID
   * @returns {Promise<boolean>} 削除成功の場合はtrue
   */
  async deleteRule(ruleId) {
    return this.knowledgeBase.delete(ruleId);
  }

  /**
   * すべてのルールを取得する
   * @param {Object} options 検索オプション
   * @returns {Promise<Array>} ルールの配列
   */
  async getAllRules(options = {}) {
    const knowledgeItems = await this.knowledgeBase.getByType(KnowledgeType.RULE, options);
    
    const rules = [];
    for (const knowledge of knowledgeItems) {
      try {
        const rule = JSON.parse(knowledge.content);
        rules.push({
          id: knowledge.id,
          ...rule,
          metadata: {
            ...rule.metadata,
            created_at: knowledge.created_at,
            updated_at: knowledge.updated_at
          }
        });
      } catch (error) {
        console.error(`Error parsing rule: ${error.message}`);
      }
    }
    
    // 優先度でソート（高い順）
    return rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * アクティブなルールを取得する
   * @returns {Promise<Array>} アクティブなルールの配列
   */
  async getActiveRules() {
    const allRules = await this.getAllRules();
    return allRules.filter(rule => rule.active);
  }

  /**
   * ルールを評価する
   * @param {Object} context 評価コンテキスト
   * @returns {Promise<Array>} 実行されたアクションの配列
   */
  async evaluateRules(context) {
    // アクティブなルールを取得
    const activeRules = await this.getActiveRules();
    
    const executedActions = [];
    
    // 各ルールを評価
    for (const rule of activeRules) {
      const result = await this._evaluateRule(rule, context);
      
      if (result.matched) {
        executedActions.push({
          rule_id: rule.id,
          rule_name: rule.name,
          actions: result.actions
        });
      }
    }
    
    return executedActions;
  }

  /**
   * 関数を登録する
   * @param {string} name 関数名
   * @param {Function} func 関数
   */
  registerFunction(name, func) {
    if (typeof func !== 'function') {
      throw new Error(`Invalid function for name: ${name}`);
    }
    
    this.functionRegistry.set(name, func);
  }

  /**
   * イベントリスナーを登録する
   * @param {string} eventName イベント名
   * @param {Function} listener リスナー関数
   */
  addEventListener(eventName, listener) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    
    this.eventListeners.get(eventName).push(listener);
  }

  /**
   * イベントをトリガーする
   * @param {string} eventName イベント名
   * @param {Object} data イベントデータ
   */
  triggerEvent(eventName, data = {}) {
    const listeners = this.eventListeners.get(eventName) || [];
    
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventName}: ${error.message}`);
      }
    }
  }

  /**
   * 単一のルールを評価する
   * @param {Object} rule ルール
   * @param {Object} context 評価コンテキスト
   * @returns {Promise<Object>} 評価結果
   * @private
   */
  async _evaluateRule(rule, context) {
    // すべての条件を評価
    const conditionsMatch = await this._evaluateConditions(rule.conditions, context);
    
    if (!conditionsMatch) {
      return { matched: false, actions: [] };
    }
    
    // アクションを実行
    const executedActions = await this._executeActions(rule.actions, context);
    
    return { matched: true, actions: executedActions };
  }

  /**
   * 条件を評価する
   * @param {Array} conditions 条件の配列
   * @param {Object} context 評価コンテキスト
   * @returns {Promise<boolean>} 条件がマッチする場合はtrue
   * @private
   */
  async _evaluateConditions(conditions, context) {
    if (!conditions || conditions.length === 0) {
      return true; // 条件がない場合は常にマッチ
    }
    
    // 論理演算子（デフォルトはAND）
    const logicalOperator = conditions.logicalOperator || 'AND';
    
    // 各条件を評価
    for (const condition of conditions) {
      // ネストされた条件グループ
      if (Array.isArray(condition)) {
        const nestedResult = await this._evaluateConditions(condition, context);
        
        if (logicalOperator === 'AND' && !nestedResult) {
          return false;
        }
        
        if (logicalOperator === 'OR' && nestedResult) {
          return true;
        }
        
        continue;
      }
      
      // 単一条件の評価
      const conditionResult = await this._evaluateCondition(condition, context);
      
      if (logicalOperator === 'AND' && !conditionResult) {
        return false;
      }
      
      if (logicalOperator === 'OR' && conditionResult) {
        return true;
      }
    }
    
    // 最終結果
    return logicalOperator === 'AND';
  }

  /**
   * 単一の条件を評価する
   * @param {Object} condition 条件
   * @param {Object} context 評価コンテキスト
   * @returns {Promise<boolean>} 条件がマッチする場合はtrue
   * @private
   */
  async _evaluateCondition(condition, context) {
    const { field, operator, value } = condition;
    
    // フィールド値の取得
    const fieldValue = this._getFieldValue(field, context);
    
    // 演算子に基づいて評価
    switch (operator) {
      case RuleOperator.EQUALS:
        return fieldValue === value;
        
      case RuleOperator.NOT_EQUALS:
        return fieldValue !== value;
        
      case RuleOperator.GREATER_THAN:
        return fieldValue > value;
        
      case RuleOperator.LESS_THAN:
        return fieldValue < value;
        
      case RuleOperator.CONTAINS:
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(value);
        }
        if (typeof fieldValue === 'string') {
          return fieldValue.includes(value);
        }
        return false;
        
      case RuleOperator.NOT_CONTAINS:
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(value);
        }
        if (typeof fieldValue === 'string') {
          return !fieldValue.includes(value);
        }
        return true;
        
      case RuleOperator.STARTS_WITH:
        return typeof fieldValue === 'string' && fieldValue.startsWith(value);
        
      case RuleOperator.ENDS_WITH:
        return typeof fieldValue === 'string' && fieldValue.endsWith(value);
        
      case RuleOperator.MATCHES:
        try {
          const regex = new RegExp(value);
          return regex.test(String(fieldValue));
        } catch (error) {
          console.error(`Invalid regex: ${value}`);
          return false;
        }
        
      case RuleOperator.EXISTS:
        return fieldValue !== undefined && fieldValue !== null;
        
      case RuleOperator.NOT_EXISTS:
        return fieldValue === undefined || fieldValue === null;
        
      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * アクションを実行する
   * @param {Array} actions アクションの配列
   * @param {Object} context 評価コンテキスト
   * @returns {Promise<Array>} 実行されたアクションの配列
   * @private
   */
  async _executeActions(actions, context) {
    if (!actions || actions.length === 0) {
      return [];
    }
    
    const executedActions = [];
    
    // 各アクションを実行
    for (const action of actions) {
      try {
        const result = await this._executeAction(action, context);
        executedActions.push({
          type: action.type,
          target: action.target,
          result
        });
      } catch (error) {
        console.error(`Error executing action: ${error.message}`);
        executedActions.push({
          type: action.type,
          target: action.target,
          error: error.message
        });
      }
    }
    
    return executedActions;
  }

  /**
   * 単一のアクションを実行する
   * @param {Object} action アクション
   * @param {Object} context 評価コンテキスト
   * @returns {Promise<any>} アクション実行結果
   * @private
   */
  async _executeAction(action, context) {
    const { type, target, value, options } = action;
    
    switch (type) {
      case RuleActionType.SET_VALUE:
        return this._setFieldValue(target, value, context);
        
      case RuleActionType.INCREMENT:
        const currentValue = this._getFieldValue(target, context) || 0;
        return this._setFieldValue(target, currentValue + (value || 1), context);
        
      case RuleActionType.DECREMENT:
        const currentVal = this._getFieldValue(target, context) || 0;
        return this._setFieldValue(target, currentVal - (value || 1), context);
        
      case RuleActionType.APPEND:
        const targetArray = this._getFieldValue(target, context) || [];
        if (!Array.isArray(targetArray)) {
          throw new Error(`Target ${target} is not an array`);
        }
        targetArray.push(value);
        return this._setFieldValue(target, targetArray, context);
        
      case RuleActionType.REMOVE:
        const array = this._getFieldValue(target, context);
        if (!Array.isArray(array)) {
          throw new Error(`Target ${target} is not an array`);
        }
        const newArray = array.filter(item => item !== value);
        return this._setFieldValue(target, newArray, context);
        
      case RuleActionType.TRIGGER_EVENT:
        this.triggerEvent(target, { ...options, value, context });
        return { triggered: true, event: target };
        
      case RuleActionType.EXECUTE_FUNCTION:
        return this._executeFunction(target, value, context, options);
        
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  /**
   * フィールド値を取得する
   * @param {string} field フィールドパス
   * @param {Object} context コンテキスト
   * @returns {any} フィールド値
   * @private
   */
  _getFieldValue(field, context) {
    // 特殊変数の処理
    if (field.startsWith('$')) {
      return this._getSpecialVariable(field, context);
    }
    
    // ドット記法でネストされたプロパティにアクセス
    const parts = field.split('.');
    let value = context;
    
    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      
      value = value[part];
    }
    
    return value;
  }

  /**
   * フィールド値を設定する
   * @param {string} field フィールドパス
   * @param {any} value 設定する値
   * @param {Object} context コンテキスト
   * @returns {Object} 更新されたコンテキスト
   * @private
   */
  _setFieldValue(field, value, context) {
    // 特殊変数の処理
    if (field.startsWith('$')) {
      throw new Error(`Cannot set special variable: ${field}`);
    }
    
    // ドット記法でネストされたプロパティにアクセス
    const parts = field.split('.');
    let target = context;
    
    // 最後のパーツを除くすべてのパーツをたどる
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      
      if (target[part] === undefined || target[part] === null) {
        target[part] = {};
      }
      
      target = target[part];
    }
    
    // 最後のパーツに値を設定
    const lastPart = parts[parts.length - 1];
    target[lastPart] = value;
    
    return context;
  }

  /**
   * 特殊変数を取得する
   * @param {string} variable 変数名
   * @param {Object} context コンテキスト
   * @returns {any} 変数値
   * @private
   */
  _getSpecialVariable(variable, context) {
    switch (variable) {
      case '$now':
        return new Date();
        
      case '$timestamp':
        return Date.now();
        
      case '$date':
        return new Date().toISOString().split('T')[0];
        
      case '$time':
        return new Date().toISOString().split('T')[1].split('.')[0];
        
      case '$random':
        return Math.random();
        
      case '$uuid':
        return uuidv4();
        
      default:
        if (variable.startsWith('$context.')) {
          const contextPath = variable.substring(9); // '$context.'の長さ
          return this._getFieldValue(contextPath, context);
        }
        
        return undefined;
    }
  }

  /**
   * 関数を実行する
   * @param {string} funcName 関数名
   * @param {any} value パラメータ値
   * @param {Object} context コンテキスト
   * @param {Object} options オプション
   * @returns {Promise<any>} 関数実行結果
   * @private
   */
  async _executeFunction(funcName, value, context, options = {}) {
    const func = this.functionRegistry.get(funcName);
    
    if (!func) {
      throw new Error(`Function not registered: ${funcName}`);
    }
    
    try {
      return await func(value, context, options);
    } catch (error) {
      throw new Error(`Error executing function ${funcName}: ${error.message}`);
    }
  }

  /**
   * ルールを検証する
   * @param {Object} rule ルール
   * @throws {Error} 検証エラー
   * @private
   */
  _validateRule(rule) {
    if (!rule.name) {
      throw new Error('Rule must have a name');
    }
    
    if (rule.conditions && !Array.isArray(rule.conditions)) {
      throw new Error('Conditions must be an array');
    }
    
    if (rule.actions && !Array.isArray(rule.actions)) {
      throw new Error('Actions must be an array');
    }
    
    // 条件の検証
    if (rule.conditions) {
      for (const condition of rule.conditions) {
        if (Array.isArray(condition)) {
          // ネストされた条件グループ
          continue;
        }
        
        if (!condition.field) {
          throw new Error('Condition must have a field');
        }
        
        if (!condition.operator) {
          throw new Error('Condition must have an operator');
        }
        
        if (condition.operator !== RuleOperator.EXISTS && 
            condition.operator !== RuleOperator.NOT_EXISTS && 
            condition.value === undefined) {
          throw new Error(`Condition with operator ${condition.operator} must have a value`);
        }
      }
    }
    
    // アクションの検証
    if (rule.actions) {
      for (const action of rule.actions) {
        if (!action.type) {
          throw new Error('Action must have a type');
        }
        
        if (!action.target) {
          throw new Error('Action must have a target');
        }
        
        if (action.type !== RuleActionType.TRIGGER_EVENT && 
            action.type !== RuleActionType.EXECUTE_FUNCTION && 
            action.value === undefined) {
          throw new Error(`Action with type ${action.type} must have a value`);
        }
      }
    }
  }

  /**
   * デフォルト関数を登録する
   * @private
   */
  _registerDefaultFunctions() {
    // 日付関連の関数
    this.registerFunction('formatDate', (date, context, options) => {
      const targetDate = date || new Date();
      const format = options.format || 'YYYY-MM-DD';
      
      // 簡易的なフォーマット処理
      const d = new Date(targetDate);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      
      return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
    });
    
    // 文字列関連の関数
    this.registerFunction('concat', (values, context, options) => {
      if (!Array.isArray(values)) {
        return String(values);
      }
      
      const separator = options.separator || '';
      return values.join(separator);
    });
    
    // 数値関連の関数
    this.registerFunction('sum', (values, context, options) => {
      if (!Array.isArray(values)) {
        return Number(values) || 0;
      }
      
      return values.reduce((sum, value) => sum + (Number(value) || 0), 0);
    });
    
    this.registerFunction('average', (values, context, options) => {
      if (!Array.isArray(values) || values.length === 0) {
        return 0;
      }
      
      const sum = values.reduce((sum, value) => sum + (Number(value) || 0), 0);
      return sum / values.length;
    });
    
    // ログ関数
    this.registerFunction('log', (message, context, options) => {
      const level = options.level || 'info';
      const prefix = options.prefix || 'RuleEngine';
      
      const logMessage = `[${prefix}] ${message}`;
      
      switch (level) {
        case 'error':
          console.error(logMessage);
          break;
        case 'warn':
          console.warn(logMessage);
          break;
        case 'debug':
          console.debug(logMessage);
          break;
        case 'info':
        default:
          console.info(logMessage);
          break;
      }
      
      return { logged: true, message: logMessage, level };
    });
  }
}
