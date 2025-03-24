/**
 * @fileoverview 知識ベースのデータモデル定義
 * 
 * このファイルでは、知識エンティティのデータモデルとそれに関連する
 * バリデーション、変換、操作のためのユーティリティ関数を定義しています。
 */

import { v4 as uuidv4 } from 'uuid';
import { isValidDate } from '../../utils/validation.js';

/**
 * 述語の列挙型
 * @enum {string}
 */
export const Predicate = {
  IS_A: 'is_a',                // 〜である
  HAS_PROPERTY: 'has_property', // 〜の特性を持つ
  PART_OF: 'part_of',          // 〜の一部である
  RELATED_TO: 'related_to',    // 〜に関連している
  DEPENDS_ON: 'depends_on',    // 〜に依存している
  CAUSES: 'causes',            // 〜を引き起こす
  PRECEDES: 'precedes',        // 〜の前に起こる
  FOLLOWS: 'follows',          // 〜の後に起こる
  SIMILAR_TO: 'similar_to',    // 〜に似ている
  OPPOSITE_OF: 'opposite_of',  // 〜の反対である
  INSTANCE_OF: 'instance_of',  // 〜のインスタンスである
  DEFINED_BY: 'defined_by'     // 〜によって定義される
};

/**
 * 知識の重要度の列挙型
 * @enum {string}
 */
export const Importance = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * 知識エンティティのスキーマ定義
 */
const knowledgeSchema = {
  id: {
    type: 'string',
    required: true,
    validate: (value) => value.startsWith('know_')
  },
  subject: {
    type: 'string',
    required: true,
    validate: (value) => value.length > 0 && value.length <= 500
  },
  predicate: {
    type: 'string',
    required: true,
    validate: (value) => Object.values(Predicate).includes(value)
  },
  object: {
    type: 'string',
    required: true,
    validate: (value) => value.length > 0 && value.length <= 500
  },
  confidence: {
    type: 'number',
    required: true,
    validate: (value) => value >= 0 && value <= 1
  },
  created_at: {
    type: 'string',
    required: true,
    validate: (value) => isValidDate(value)
  },
  updated_at: {
    type: 'string',
    required: true,
    validate: (value) => isValidDate(value)
  },
  source: {
    type: 'string',
    required: false,
    validate: (value) => value.length > 0 && value.length <= 200
  },
  references: {
    type: 'array',
    required: false,
    validate: (value) => Array.isArray(value) && value.every(ref => typeof ref === 'string')
  },
  metadata: {
    type: 'object',
    required: false,
    validate: (value) => typeof value === 'object' && value !== null
  }
};

/**
 * 知識エンティティクラス
 */
export class Knowledge {
  /**
   * 知識エンティティを作成する
   * @param {Object} data 知識データ
   * @param {string} data.subject 主語
   * @param {string} data.predicate 述語
   * @param {string} data.object 目的語
   * @param {number} data.confidence 確信度
   * @param {string} [data.source] 情報源
   * @param {Array<string>} [data.references=[]] 参照ドキュメント
   * @param {Object} [data.metadata={}] メタデータ
   * @param {string} [data.id] ID（省略時は自動生成）
   * @param {string} [data.created_at] 作成日時（省略時は現在時刻）
   * @param {string} [data.updated_at] 更新日時（省略時は現在時刻）
   * @returns {Knowledge} 知識エンティティ
   */
  constructor(data) {
    // IDの生成（指定がない場合）
    this.id = data.id || `know_${uuidv4().replace(/-/g, '')}`;
    
    // 必須フィールド
    this.subject = data.subject;
    this.predicate = data.predicate;
    this.object = data.object;
    this.confidence = data.confidence;
    
    // 日時関連フィールド
    const now = new Date();
    this.created_at = data.created_at || now.toISOString();
    this.updated_at = data.updated_at || now.toISOString();
    
    // オプションフィールド
    this.source = data.source || '';
    this.references = data.references || [];
    this.metadata = data.metadata || {};
    
    // バリデーション
    this.validate();
  }
  
  /**
   * 知識エンティティのバリデーションを行う
   * @throws {Error} バリデーションエラー
   */
  validate() {
    for (const [field, schema] of Object.entries(knowledgeSchema)) {
      // 必須フィールドのチェック
      if (schema.required && (this[field] === undefined || this[field] === null)) {
        throw new Error(`${field} is required`);
      }
      
      // 型チェック
      if (this[field] !== undefined && typeof this[field] !== schema.type && 
          !(schema.type === 'array' && Array.isArray(this[field]))) {
        throw new Error(`${field} must be of type ${schema.type}`);
      }
      
      // カスタムバリデーション
      if (this[field] !== undefined && schema.validate && !schema.validate(this[field])) {
        throw new Error(`${field} failed validation`);
      }
    }
  }
  
  /**
   * 知識エンティティを更新する
   * @param {Object} updateData 更新データ
   */
  update(updateData) {
    // 更新不可フィールド
    const immutableFields = ['id', 'created_at'];
    
    // 更新可能なフィールドのみを適用
    for (const [key, value] of Object.entries(updateData)) {
      if (!immutableFields.includes(key) && this[key] !== undefined) {
        this[key] = value;
      }
    }
    
    // 更新日時を設定
    this.updated_at = new Date().toISOString();
    
    // 再バリデーション
    this.validate();
  }
  
  /**
   * 知識エンティティの確信度を更新する
   * @param {number} newConfidence 新しい確信度
   * @param {string} reason 更新理由
   */
  updateConfidence(newConfidence, reason = '') {
    if (newConfidence < 0 || newConfidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
    
    const oldConfidence = this.confidence;
    this.confidence = newConfidence;
    this.updated_at = new Date().toISOString();
    
    // メタデータに更新履歴を追加
    if (!this.metadata.confidence_history) {
      this.metadata.confidence_history = [];
    }
    
    this.metadata.confidence_history.push({
      old_value: oldConfidence,
      new_value: newConfidence,
      updated_at: this.updated_at,
      reason
    });
  }
  
  /**
   * 知識エンティティをJSON形式に変換する
   * @returns {Object} JSON形式の知識エンティティ
   */
  toJSON() {
    return {
      id: this.id,
      subject: this.subject,
      predicate: this.predicate,
      object: this.object,
      confidence: this.confidence,
      created_at: this.created_at,
      updated_at: this.updated_at,
      source: this.source,
      references: this.references,
      metadata: this.metadata
    };
  }
  
  /**
   * 知識エンティティの文字列表現を取得する
   * @returns {string} 知識エンティティの文字列表現
   */
  toString() {
    return `${this.subject} ${this.predicate} ${this.object}`;
  }
  
  /**
   * JSON形式のデータから知識エンティティを作成する
   * @param {Object} json JSON形式の知識データ
   * @returns {Knowledge} 知識エンティティ
   */
  static fromJSON(json) {
    return new Knowledge(json);
  }
  
  /**
   * 知識エンティティが別の知識エンティティと矛盾するかどうかを判定する
   * @param {Knowledge} otherKnowledge 比較対象の知識エンティティ
   * @returns {boolean} 矛盾する場合はtrue
   */
  isContradictingWith(otherKnowledge) {
    // 同じ主語と述語を持つが、異なる目的語を持つ場合は矛盾の可能性がある
    if (this.subject === otherKnowledge.subject && 
        this.predicate === otherKnowledge.predicate && 
        this.object !== otherKnowledge.object) {
      
      // 特定の述語の場合は矛盾とみなす
      const contradictingPredicates = [
        Predicate.IS_A,
        Predicate.INSTANCE_OF,
        Predicate.DEFINED_BY
      ];
      
      if (contradictingPredicates.includes(this.predicate)) {
        return true;
      }
    }
    
    // 反対の関係を持つ場合も矛盾とみなす
    if (this.subject === otherKnowledge.subject && 
        this.object === otherKnowledge.object) {
      
      const oppositePredicates = [
        [Predicate.PRECEDES, Predicate.FOLLOWS],
        [Predicate.SIMILAR_TO, Predicate.OPPOSITE_OF]
      ];
      
      for (const [pred1, pred2] of oppositePredicates) {
        if ((this.predicate === pred1 && otherKnowledge.predicate === pred2) ||
            (this.predicate === pred2 && otherKnowledge.predicate === pred1)) {
          return true;
        }
      }
    }
    
    return false;
  }
}
