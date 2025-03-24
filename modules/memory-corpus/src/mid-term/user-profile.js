/**
 * @fileoverview ユーザープロファイル管理モジュール
 * 
 * このファイルでは、ユーザーの設定や嗜好、属性などを管理するための
 * UserProfileクラスを定義しています。
 */

import { v4 as uuidv4 } from 'uuid';
import { Memory, MemoryType, MemoryPriority } from '../memory-model.js';
import { getDbClient, getCacheClient } from '../memory-manager.js';
import { EpisodicMemory, EpisodicMemoryType } from './episodic-memory.js';

/**
 * ユーザープロファイル属性タイプの列挙型
 * @enum {string}
 */
export const ProfileAttributeType = {
  PREFERENCE: 'preference',    // 嗜好
  SETTING: 'setting',          // 設定
  DEMOGRAPHIC: 'demographic',  // 人口統計学的属性
  BEHAVIOR: 'behavior',        // 行動パターン
  CUSTOM: 'custom'             // カスタム属性
};

/**
 * ユーザープロファイルクラス
 */
export class UserProfile {
  /**
   * UserProfileのインスタンスを作成する
   * @param {Object} options 設定オプション
   */
  constructor(options = {}) {
    this.dbClient = options.dbClient || getDbClient(options.dbConfig);
    this.cacheClient = options.cacheClient || getCacheClient(options.cacheConfig);
    this.episodicMemory = options.episodicMemory || new EpisodicMemory(options);
    
    // キャッシュキープレフィックス
    this.cacheKeyPrefix = 'user_profile:';
    
    // キャッシュTTL（秒）
    this.cacheTTL = options.cacheTTL || 86400; // 1日
    
    // デフォルト有効期限（ミリ秒）
    this.defaultExpiration = options.defaultExpiration || 365 * 24 * 60 * 60 * 1000; // 1年
  }

  /**
   * キャッシュキーを生成する
   * @param {string} userId ユーザーID
   * @returns {string} キャッシュキー
   * @private
   */
  _getCacheKey(userId) {
    return `${this.cacheKeyPrefix}${userId}`;
  }

  /**
   * 属性キャッシュキーを生成する
   * @param {string} userId ユーザーID
   * @param {string} attributeType 属性タイプ
   * @returns {string} 属性キャッシュキー
   * @private
   */
  _getAttributeCacheKey(userId, attributeType) {
    return `${this.cacheKeyPrefix}${userId}:${attributeType}`;
  }

  /**
   * ユーザープロファイルを取得する
   * @param {string} userId ユーザーID
   * @returns {Promise<Object>} ユーザープロファイル
   */
  async getProfile(userId) {
    // キャッシュから取得を試みる
    const cacheKey = this._getCacheKey(userId);
    let profile = await this.cacheClient.get(cacheKey);
    
    if (profile) {
      return profile;
    }
    
    // データベースから取得
    const memories = await this.dbClient.listMemories({
      user_id: userId,
      type: MemoryType.PREFERENCE
    });
    
    // プロファイルを構築
    profile = {
      user_id: userId,
      attributes: {},
      created_at: null,
      updated_at: null
    };
    
    // 属性をタイプごとに整理
    for (const memory of memories) {
      try {
        const attribute = JSON.parse(memory.content);
        const type = attribute.type || ProfileAttributeType.CUSTOM;
        
        if (!profile.attributes[type]) {
          profile.attributes[type] = {};
        }
        
        profile.attributes[type][attribute.name] = {
          value: attribute.value,
          confidence: attribute.confidence || 1.0,
          updated_at: memory.updated_at,
          source: attribute.source || 'system'
        };
        
        // 作成日時と更新日時を追跡
        if (!profile.created_at || new Date(memory.created_at) < new Date(profile.created_at)) {
          profile.created_at = memory.created_at;
        }
        
        if (!profile.updated_at || new Date(memory.updated_at) > new Date(profile.updated_at)) {
          profile.updated_at = memory.updated_at;
        }
      } catch (error) {
        console.error(`Error parsing profile attribute: ${error.message}`);
      }
    }
    
    // キャッシュに保存
    await this.cacheClient.set(cacheKey, profile, this.cacheTTL);
    
    return profile;
  }

  /**
   * ユーザープロファイル属性を設定する
   * @param {string} userId ユーザーID
   * @param {string} name 属性名
   * @param {any} value 属性値
   * @param {Object} options オプション
   * @param {string} [options.type] 属性タイプ
   * @param {number} [options.confidence] 信頼度（0.0～1.0）
   * @param {string} [options.source] 情報ソース
   * @returns {Promise<string>} 属性ID
   */
  async setAttribute(userId, name, value, options = {}) {
    // 現在時刻
    const now = new Date();
    
    // 有効期限の計算
    const expiryDate = new Date(now.getTime() + this.defaultExpiration);
    
    // 属性データ
    const attributeData = {
      name,
      value,
      type: options.type || ProfileAttributeType.CUSTOM,
      confidence: options.confidence || 1.0,
      source: options.source || 'system',
      updated_at: now.toISOString()
    };
    
    // 既存の属性を検索
    const existingMemories = await this.dbClient.listMemories({
      user_id: userId,
      type: MemoryType.PREFERENCE,
      tags: [name, options.type || ProfileAttributeType.CUSTOM]
    });
    
    let memoryId;
    
    if (existingMemories.length > 0) {
      // 既存の属性を更新
      const existingMemory = existingMemories[0];
      memoryId = existingMemory.id;
      
      await this.dbClient.updateMemory(memoryId, {
        content: JSON.stringify(attributeData),
        updated_at: now.toISOString()
      });
    } else {
      // 新しい属性を作成
      memoryId = `attr_${uuidv4().replace(/-/g, '')}`;
      
      const memory = {
        id: memoryId,
        content: JSON.stringify(attributeData),
        type: MemoryType.PREFERENCE,
        user_id: userId,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        expires_at: expiryDate.toISOString(),
        priority: MemoryPriority.HIGH,
        tags: [name, options.type || ProfileAttributeType.CUSTOM],
        metadata: {
          attribute_type: options.type || ProfileAttributeType.CUSTOM,
          attribute_name: name
        }
      };
      
      await this.dbClient.saveMemory(memory);
    }
    
    // キャッシュを無効化
    await this.cacheClient.delete(this._getCacheKey(userId));
    await this.cacheClient.delete(this._getAttributeCacheKey(userId, options.type || ProfileAttributeType.CUSTOM));
    
    return memoryId;
  }

  /**
   * ユーザープロファイル属性を取得する
   * @param {string} userId ユーザーID
   * @param {string} name 属性名
   * @param {string} [type] 属性タイプ
   * @returns {Promise<Object|null>} 属性オブジェクト
   */
  async getAttribute(userId, name, type = ProfileAttributeType.CUSTOM) {
    // 属性キャッシュから取得を試みる
    const attributeCacheKey = this._getAttributeCacheKey(userId, type);
    let attributes = await this.cacheClient.get(attributeCacheKey);
    
    if (attributes && attributes[name]) {
      return attributes[name];
    }
    
    // プロファイル全体から取得を試みる
    const profile = await this.getProfile(userId);
    
    if (profile.attributes[type] && profile.attributes[type][name]) {
      return profile.attributes[type][name];
    }
    
    return null;
  }

  /**
   * 特定タイプのユーザープロファイル属性をすべて取得する
   * @param {string} userId ユーザーID
   * @param {string} type 属性タイプ
   * @returns {Promise<Object>} 属性オブジェクト
   */
  async getAttributesByType(userId, type) {
    // 属性キャッシュから取得を試みる
    const attributeCacheKey = this._getAttributeCacheKey(userId, type);
    let attributes = await this.cacheClient.get(attributeCacheKey);
    
    if (attributes) {
      return attributes;
    }
    
    // プロファイル全体から取得
    const profile = await this.getProfile(userId);
    
    attributes = profile.attributes[type] || {};
    
    // キャッシュに保存
    await this.cacheClient.set(attributeCacheKey, attributes, this.cacheTTL);
    
    return attributes;
  }

  /**
   * ユーザープロファイル属性を削除する
   * @param {string} userId ユーザーID
   * @param {string} name 属性名
   * @param {string} [type] 属性タイプ
   * @returns {Promise<boolean>} 削除成功の場合はtrue
   */
  async deleteAttribute(userId, name, type = ProfileAttributeType.CUSTOM) {
    // 既存の属性を検索
    const existingMemories = await this.dbClient.listMemories({
      user_id: userId,
      type: MemoryType.PREFERENCE,
      tags: [name, type]
    });
    
    if (existingMemories.length === 0) {
      return false;
    }
    
    // 属性を削除
    for (const memory of existingMemories) {
      await this.dbClient.deleteMemory(memory.id);
    }
    
    // キャッシュを無効化
    await this.cacheClient.delete(this._getCacheKey(userId));
    await this.cacheClient.delete(this._getAttributeCacheKey(userId, type));
    
    return true;
  }

  /**
   * ユーザーの行動からプロファイル属性を推論する
   * @param {string} userId ユーザーID
   * @returns {Promise<Object>} 推論された属性
   */
  async inferAttributes(userId) {
    // ユーザーの会話履歴を取得
    const conversations = await this.episodicMemory.getUserConversations(userId, {
      limit: 100,
      sort: { created_at: -1 }
    });
    
    // 推論された属性
    const inferences = {};
    
    // 会話履歴から属性を推論するロジック
    // （実際の実装ではAIモデルを使用するなど、より高度な推論を行う）
    
    // 例：会話の頻度から活動レベルを推定
    if (conversations.length > 0) {
      const now = new Date();
      const conversationDates = conversations.map(c => new Date(c.created_at));
      const latestConversation = new Date(Math.max(...conversationDates));
      
      // 最新の会話からの経過日数
      const daysSinceLastConversation = (now - latestConversation) / (1000 * 60 * 60 * 24);
      
      // 活動レベルの推定
      let activityLevel;
      if (daysSinceLastConversation < 1) {
        activityLevel = 'high';
      } else if (daysSinceLastConversation < 7) {
        activityLevel = 'medium';
      } else {
        activityLevel = 'low';
      }
      
      // 推論結果を保存
      await this.setAttribute(userId, 'activity_level', activityLevel, {
        type: ProfileAttributeType.BEHAVIOR,
        confidence: 0.7,
        source: 'inference'
      });
      
      inferences.activity_level = {
        value: activityLevel,
        confidence: 0.7
      };
    }
    
    // 例：会話内容から興味を推定
    // （実際の実装ではより高度な分析を行う）
    
    return inferences;
  }

  /**
   * ユーザープロファイルを更新する
   * @param {string} userId ユーザーID
   * @param {Object} attributes 更新する属性
   * @returns {Promise<Object>} 更新されたプロファイル
   */
  async updateProfile(userId, attributes = {}) {
    for (const [type, typeAttributes] of Object.entries(attributes)) {
      for (const [name, value] of Object.entries(typeAttributes)) {
        await this.setAttribute(userId, name, value, {
          type,
          confidence: value.confidence || 1.0,
          source: value.source || 'system'
        });
      }
    }
    
    return this.getProfile(userId);
  }

  /**
   * ユーザープロファイルをマージする
   * @param {string} targetUserId ターゲットユーザーID
   * @param {string} sourceUserId ソースユーザーID
   * @param {Object} options マージオプション
   * @returns {Promise<Object>} マージされたプロファイル
   */
  async mergeProfiles(targetUserId, sourceUserId, options = {}) {
    // ソースプロファイルを取得
    const sourceProfile = await this.getProfile(sourceUserId);
    
    // ターゲットプロファイルを取得
    const targetProfile = await this.getProfile(targetUserId);
    
    // 属性をマージ
    for (const [type, typeAttributes] of Object.entries(sourceProfile.attributes)) {
      for (const [name, attribute] of Object.entries(typeAttributes)) {
        // ターゲットに同じ属性が存在するか確認
        const targetAttribute = targetProfile.attributes[type] && targetProfile.attributes[type][name];
        
        // マージ戦略
        if (!targetAttribute || 
            (options.overwriteExisting === true) || 
            (attribute.confidence > (targetAttribute.confidence || 0))) {
          
          await this.setAttribute(targetUserId, name, attribute.value, {
            type,
            confidence: attribute.confidence,
            source: `merged_from_${sourceUserId}`
          });
        }
      }
    }
    
    return this.getProfile(targetUserId);
  }
}
