/**
 * @fileoverview メモリコーパスのデータモデル定義
 * 
 * このファイルでは、メモリエンティティのデータモデルとそれに関連する
 * バリデーション、変換、操作のためのユーティリティ関数を定義しています。
 */

import { v4 as uuidv4 } from 'uuid';

// バリデーション関数
const isValidDate = (date) => {
  if (!date) return false;
  return !isNaN(new Date(date).getTime());
};

/**
 * メモリタイプの列挙型
 * @enum {string}
 */
export const MemoryType = {
  OBSERVATION: 'observation',  // 観察結果
  FACT: 'fact',                // 事実
  RULE: 'rule',                // ルール
  PREFERENCE: 'preference',    // 好み
  INTERACTION: 'interaction',  // 対話履歴
  SUMMARY: 'summary'           // 要約
};

/**
 * メモリ優先度の列挙型
 * @enum {string}
 */
export const MemoryPriority = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * メモリエンティティのデフォルト有効期限（ミリ秒）
 * @type {Object}
 */
export const DEFAULT_EXPIRATION = {
  [MemoryType.OBSERVATION]: 30 * 24 * 60 * 60 * 1000,  // 30日
  [MemoryType.FACT]: 90 * 24 * 60 * 60 * 1000,         // 90日
  [MemoryType.RULE]: 180 * 24 * 60 * 60 * 1000,        // 180日
  [MemoryType.PREFERENCE]: 60 * 24 * 60 * 60 * 1000,   // 60日
  [MemoryType.INTERACTION]: 14 * 24 * 60 * 60 * 1000,  // 14日
  [MemoryType.SUMMARY]: 45 * 24 * 60 * 60 * 1000       // 45日
};

/**
 * メモリエンティティのスキーマ定義
 */
export const memorySchema = {
  id: {
    type: 'string',
    required: true,
    validate: (value) => value.startsWith('mem_')
  },
  content: {
    type: 'string',
    required: true,
    validate: (value) => value.length > 0 && value.length <= 10000
  },
  type: {
    type: 'string',
    required: true,
    validate: (value) => Object.values(MemoryType).includes(value)
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
  expires_at: {
    type: 'string',
    required: true,
    validate: (value) => isValidDate(value)
  },
  priority: {
    type: 'string',
    required: true,
    validate: (value) => Object.values(MemoryPriority).includes(value)
  },
  tags: {
    type: 'array',
    required: false,
    validate: (value) => Array.isArray(value) && value.every(tag => typeof tag === 'string')
  },
  metadata: {
    type: 'object',
    required: false,
    validate: (value) => typeof value === 'object' && value !== null
  }
};

/**
 * メモリエンティティクラス
 */
export class Memory {
  /**
   * メモリエンティティを作成する
   * @param {Object} data メモリデータ
   * @param {string} data.content 記憶の内容
   * @param {string} data.type 記憶の種類
   * @param {number} data.confidence 確信度
   * @param {string} [data.priority='medium'] 優先度
   * @param {Array<string>} [data.tags=[]] タグ
   * @param {Object} [data.metadata={}] メタデータ
   * @param {string} [data.id] ID（省略時は自動生成）
   * @param {string} [data.created_at] 作成日時（省略時は現在時刻）
   * @param {string} [data.updated_at] 更新日時（省略時は現在時刻）
   * @param {string} [data.expires_at] 有効期限（省略時はタイプに基づいて自動設定）
   * @returns {Memory} メモリエンティティ
   */
  constructor(data) {
    // IDの生成（指定がない場合）
    this.id = data.id || `mem_${uuidv4().replace(/-/g, '')}`;
    
    // 必須フィールド
    this.content = data.content;
    this.type = data.type;
    this.confidence = data.confidence;
    
    // 日時関連フィールド
    const now = new Date();
    this.created_at = data.created_at || now.toISOString();
    this.updated_at = data.updated_at || now.toISOString();
    
    // 有効期限の設定
    if (data.expires_at) {
      this.expires_at = data.expires_at;
    } else {
      const expirationMs = DEFAULT_EXPIRATION[this.type] || DEFAULT_EXPIRATION[MemoryType.OBSERVATION];
      const expirationDate = new Date(now.getTime() + expirationMs);
      this.expires_at = expirationDate.toISOString();
    }
    
    // オプションフィールド
    this.priority = data.priority || MemoryPriority.MEDIUM;
    this.tags = data.tags || [];
    this.metadata = data.metadata || {};
    
    // バリデーション
    this.validate();
  }
  
  /**
   * メモリエンティティのバリデーションを行う
   * @throws {Error} バリデーションエラー
   */
  validate() {
    for (const [field, schema] of Object.entries(memorySchema)) {
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
    
    return true;
  }
  
  /**
   * メモリエンティティを更新する
   * @param {Object} data 更新データ
   * @param {string} [data.content] 記憶の内容
   * @param {number} [data.confidence] 確信度
   * @param {string} [data.priority] 優先度
   * @param {Array<string>} [data.tags] タグ
   * @param {Object} [data.metadata] メタデータ
   * @returns {Memory} 更新されたメモリエンティティ
   */
  update(data) {
    // 更新可能なフィールドのみ更新
    if (data.content !== undefined) this.content = data.content;
    if (data.confidence !== undefined) this.confidence = data.confidence;
    if (data.priority !== undefined) this.priority = data.priority;
    if (data.tags !== undefined) this.tags = data.tags;
    if (data.metadata !== undefined) this.metadata = data.metadata;
    
    // 更新日時を現在時刻に設定
    this.updated_at = new Date().toISOString();
    
    // バリデーション
    this.validate();
    
    return this;
  }
  
  /**
   * メモリエンティティが有効期限切れかどうかを判定する
   * @returns {boolean} 有効期限切れの場合はtrue
   */
  isExpired() {
    const now = new Date();
    const expirationDate = new Date(this.expires_at);
    return now > expirationDate;
  }
  
  /**
   * メモリエンティティの有効期限を延長する
   * @param {number} days 延長する日数
   */
  extendExpiration(days) {
    const expirationDate = new Date(this.expires_at);
    expirationDate.setDate(expirationDate.getDate() + days);
    this.expires_at = expirationDate.toISOString();
  }
  
  /**
   * メモリエンティティをJSON形式に変換する
   * @returns {Object} JSON形式のメモリエンティティ
   */
  toJSON() {
    return {
      id: this.id,
      content: this.content,
      type: this.type,
      confidence: this.confidence,
      created_at: this.created_at,
      updated_at: this.updated_at,
      expires_at: this.expires_at,
      priority: this.priority,
      tags: this.tags,
      metadata: this.metadata
    };
  }
  
  /**
   * JSON形式のデータからメモリエンティティを作成する
   * @param {Object} json JSON形式のメモリデータ
   * @returns {Memory} メモリエンティティ
   */
  static fromJSON(json) {
    return new Memory(json);
  }
}
