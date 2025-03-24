/**
 * @fileoverview 長期記憶（知識ベース）モジュール
 * 
 * このファイルでは、事実、ルール、一般的な知識など、長期的に保持される
 * 情報を管理するための知識ベースクラスを定義しています。
 */

import { v4 as uuidv4 } from 'uuid';
import { Memory, MemoryType, MemoryPriority } from '../memory-model.js';
import { getDbClient, getCacheClient } from '../memory-manager.js';

/**
 * 知識タイプの列挙型
 * @enum {string}
 */
export const KnowledgeType = {
  FACT: 'fact',                // 事実
  RULE: 'rule',                // ルール
  CONCEPT: 'concept',          // 概念
  PROCEDURE: 'procedure',      // 手順
  RELATIONSHIP: 'relationship' // 関係
};

/**
 * 知識ベースクラス
 */
export class KnowledgeBase {
  /**
   * KnowledgeBaseのインスタンスを作成する
   * @param {Object} options 設定オプション
   */
  constructor(options = {}) {
    this.dbClient = options.dbClient || getDbClient(options.dbConfig);
    this.cacheClient = options.cacheClient || getCacheClient(options.cacheConfig);
    
    // キャッシュキープレフィックス
    this.cacheKeyPrefix = 'knowledge_base:';
    
    // キャッシュTTL（秒）
    this.cacheTTL = options.cacheTTL || 604800; // 1週間
    
    // デフォルト有効期限（ミリ秒）
    this.defaultExpiration = options.defaultExpiration || 10 * 365 * 24 * 60 * 60 * 1000; // 10年
    
    // 埋め込みモデル設定
    this.embeddingModel = options.embeddingModel || 'openai';
    this.embeddingConfig = options.embeddingConfig || {};
    
    // 検索設定
    this.searchConfig = {
      similarityThreshold: options.similarityThreshold || 0.7,
      maxResults: options.maxResults || 50,
      ...options.searchConfig
    };
  }

  /**
   * キャッシュキーを生成する
   * @param {string} id 知識ID
   * @returns {string} キャッシュキー
   * @private
   */
  _getCacheKey(id) {
    return `${this.cacheKeyPrefix}${id}`;
  }

  /**
   * カテゴリキャッシュキーを生成する
   * @param {string} category カテゴリ
   * @returns {string} カテゴリキャッシュキー
   * @private
   */
  _getCategoryCacheKey(category) {
    return `${this.cacheKeyPrefix}category:${category}`;
  }

  /**
   * 知識を保存する
   * @param {Object} data 知識データ
   * @param {string} data.content 知識内容
   * @param {string} [data.type] 知識タイプ
   * @param {Array} [data.categories] カテゴリ
   * @param {Array} [data.tags] タグ
   * @param {Object} [data.metadata] メタデータ
   * @returns {Promise<string>} 知識ID
   */
  async store(data) {
    // IDの生成
    const id = data.id || `kb_${uuidv4().replace(/-/g, '')}`;
    
    // 現在時刻
    const now = new Date();
    
    // 有効期限の計算
    const expiryDate = new Date(now.getTime() + this.defaultExpiration);
    
    // 埋め込みベクトルの生成
    const embedding = await this._generateEmbedding(data.content);
    
    // 知識オブジェクトの作成
    const knowledge = {
      id,
      content: data.content,
      type: data.type || KnowledgeType.FACT,
      categories: data.categories || [],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: data.expires_at || expiryDate.toISOString(),
      priority: data.priority || MemoryPriority.MEDIUM,
      tags: data.tags || [],
      metadata: {
        ...data.metadata || {},
        source: data.metadata?.source || 'system',
        confidence: data.metadata?.confidence || 1.0,
        verified: data.metadata?.verified || false
      },
      embedding
    };
    
    // データベースに保存
    await this.dbClient.saveMemory({
      ...knowledge,
      type: this._mapToMemoryType(knowledge.type)
    });
    
    // キャッシュに保存
    const cacheKey = this._getCacheKey(id);
    await this.cacheClient.set(cacheKey, knowledge, this.cacheTTL);
    
    // カテゴリ一覧に追加
    for (const category of knowledge.categories) {
      await this._addToCategory(category, id);
    }
    
    return id;
  }

  /**
   * 知識を取得する
   * @param {string} id 知識ID
   * @returns {Promise<Object|null>} 知識オブジェクト
   */
  async get(id) {
    // キャッシュから取得を試みる
    const cacheKey = this._getCacheKey(id);
    let knowledge = await this.cacheClient.get(cacheKey);
    
    if (knowledge) {
      return knowledge;
    }
    
    // データベースから取得
    const memory = await this.dbClient.getMemory(id);
    
    if (!memory) {
      return null;
    }
    
    // メモリを知識オブジェクトに変換
    knowledge = {
      ...memory,
      type: this._mapFromMemoryType(memory.type)
    };
    
    // キャッシュに保存
    await this.cacheClient.set(cacheKey, knowledge, this.cacheTTL);
    
    return knowledge;
  }

  /**
   * 知識を更新する
   * @param {string} id 知識ID
   * @param {Object} data 更新データ
   * @returns {Promise<Object|null>} 更新された知識
   */
  async update(id, data) {
    // 現在の知識を取得
    const knowledge = await this.get(id);
    
    if (!knowledge) {
      return null;
    }
    
    // 更新データの適用
    const updatedKnowledge = {
      ...knowledge,
      ...data,
      id: knowledge.id, // IDは変更不可
      updated_at: new Date().toISOString()
    };
    
    // 内容が変更された場合は埋め込みを再生成
    if (data.content && data.content !== knowledge.content) {
      updatedKnowledge.embedding = await this._generateEmbedding(data.content);
    }
    
    // カテゴリが変更された場合は更新
    if (data.categories && !this._areArraysEqual(data.categories, knowledge.categories)) {
      // 古いカテゴリから削除
      for (const category of knowledge.categories) {
        if (!data.categories.includes(category)) {
          await this._removeFromCategory(category, id);
        }
      }
      
      // 新しいカテゴリに追加
      for (const category of data.categories) {
        if (!knowledge.categories.includes(category)) {
          await this._addToCategory(category, id);
        }
      }
    }
    
    // データベースに保存
    await this.dbClient.updateMemory(id, {
      ...updatedKnowledge,
      type: this._mapToMemoryType(updatedKnowledge.type)
    });
    
    // キャッシュを更新
    const cacheKey = this._getCacheKey(id);
    await this.cacheClient.set(cacheKey, updatedKnowledge, this.cacheTTL);
    
    return updatedKnowledge;
  }

  /**
   * 知識を削除する
   * @param {string} id 知識ID
   * @returns {Promise<boolean>} 削除成功の場合はtrue
   */
  async delete(id) {
    // 現在の知識を取得
    const knowledge = await this.get(id);
    
    if (!knowledge) {
      return false;
    }
    
    // データベースから削除
    const success = await this.dbClient.deleteMemory(id);
    
    if (success) {
      // キャッシュから削除
      const cacheKey = this._getCacheKey(id);
      await this.cacheClient.delete(cacheKey);
      
      // カテゴリ一覧から削除
      for (const category of knowledge.categories) {
        await this._removeFromCategory(category, id);
      }
    }
    
    return success;
  }

  /**
   * テキストクエリに基づいて知識を検索する
   * @param {string} query 検索クエリ
   * @param {Object} options 検索オプション
   * @returns {Promise<Array>} 知識の配列
   */
  async search(query, options = {}) {
    // クエリの埋め込みベクトルを生成
    const queryEmbedding = await this._generateEmbedding(query);
    
    // 検索オプションの設定
    const searchOptions = {
      ...this.searchConfig,
      ...options,
      embedding: queryEmbedding,
      types: options.types ? options.types.map(type => this._mapToMemoryType(type)) : 
        [MemoryType.FACT, MemoryType.RULE]
    };
    
    // ベクトル検索を実行
    const results = await this.dbClient.searchMemoriesByVector(searchOptions);
    
    // 結果を知識オブジェクトに変換
    return results.map(memory => ({
      ...memory,
      type: this._mapFromMemoryType(memory.type),
      similarity: memory.similarity || 0
    }));
  }

  /**
   * カテゴリに基づいて知識を取得する
   * @param {string} category カテゴリ
   * @param {Object} options 検索オプション
   * @returns {Promise<Array>} 知識の配列
   */
  async getByCategory(category, options = {}) {
    // カテゴリキャッシュキーから知識IDを取得
    const categoryCacheKey = this._getCategoryCacheKey(category);
    let ids = await this.cacheClient.get(categoryCacheKey) || [];
    
    if (ids.length === 0) {
      // キャッシュにない場合はデータベースから検索
      const memories = await this.dbClient.listMemories({
        categories: category,
        types: [MemoryType.FACT, MemoryType.RULE]
      }, options);
      
      // 結果をキャッシュに保存
      ids = memories.map(memory => memory.id);
      if (ids.length > 0) {
        await this.cacheClient.set(categoryCacheKey, ids, this.cacheTTL);
      }
      
      // 結果を知識オブジェクトに変換
      return memories.map(memory => ({
        ...memory,
        type: this._mapFromMemoryType(memory.type)
      }));
    }
    
    // キャッシュから個々の知識を取得
    const knowledgeItems = [];
    for (const id of ids) {
      const knowledge = await this.get(id);
      if (knowledge) {
        knowledgeItems.push(knowledge);
      }
    }
    
    return knowledgeItems;
  }

  /**
   * タグに基づいて知識を取得する
   * @param {Array} tags タグの配列
   * @param {Object} options 検索オプション
   * @returns {Promise<Array>} 知識の配列
   */
  async getByTags(tags, options = {}) {
    // データベースから検索
    const memories = await this.dbClient.listMemories({
      tags: { $all: tags },
      types: [MemoryType.FACT, MemoryType.RULE]
    }, options);
    
    // 結果を知識オブジェクトに変換
    return memories.map(memory => ({
      ...memory,
      type: this._mapFromMemoryType(memory.type)
    }));
  }

  /**
   * 知識タイプに基づいて知識を取得する
   * @param {string} type 知識タイプ
   * @param {Object} options 検索オプション
   * @returns {Promise<Array>} 知識の配列
   */
  async getByType(type, options = {}) {
    // データベースから検索
    const memories = await this.dbClient.listMemories({
      type: this._mapToMemoryType(type)
    }, options);
    
    // 結果を知識オブジェクトに変換
    return memories.map(memory => ({
      ...memory,
      type: this._mapFromMemoryType(memory.type)
    }));
  }

  /**
   * 知識を検証する
   * @param {string} id 知識ID
   * @param {boolean} verified 検証状態
   * @param {Object} metadata 追加のメタデータ
   * @returns {Promise<Object|null>} 更新された知識
   */
  async verifyKnowledge(id, verified = true, metadata = {}) {
    return this.update(id, {
      metadata: {
        verified,
        verification_date: new Date().toISOString(),
        ...metadata
      }
    });
  }

  /**
   * 知識の信頼度を更新する
   * @param {string} id 知識ID
   * @param {number} confidence 信頼度（0.0～1.0）
   * @returns {Promise<Object|null>} 更新された知識
   */
  async updateConfidence(id, confidence) {
    return this.update(id, {
      metadata: {
        confidence: Math.max(0, Math.min(1, confidence))
      }
    });
  }

  /**
   * 知識を強化する（優先度を上げる）
   * @param {string} id 知識ID
   * @returns {Promise<Object|null>} 更新された知識
   */
  async reinforceKnowledge(id) {
    const knowledge = await this.get(id);
    
    if (!knowledge) {
      return null;
    }
    
    // 優先度を上げる（上限あり）
    const newPriority = Math.min(MemoryPriority.VERY_HIGH, knowledge.priority + 1);
    
    return this.update(id, {
      priority: newPriority,
      metadata: {
        ...knowledge.metadata,
        reinforcement_count: (knowledge.metadata.reinforcement_count || 0) + 1,
        last_reinforced: new Date().toISOString()
      }
    });
  }

  /**
   * 知識を衰退させる（優先度を下げる）
   * @param {string} id 知識ID
   * @returns {Promise<Object|null>} 更新された知識
   */
  async decayKnowledge(id) {
    const knowledge = await this.get(id);
    
    if (!knowledge) {
      return null;
    }
    
    // 優先度を下げる（下限あり）
    const newPriority = Math.max(MemoryPriority.VERY_LOW, knowledge.priority - 1);
    
    return this.update(id, {
      priority: newPriority,
      metadata: {
        ...knowledge.metadata,
        decay_count: (knowledge.metadata.decay_count || 0) + 1,
        last_decayed: new Date().toISOString()
      }
    });
  }

  /**
   * 知識間の関連性を設定する
   * @param {string} sourceId ソース知識ID
   * @param {string} targetId ターゲット知識ID
   * @param {string} relationType 関連タイプ
   * @param {Object} metadata 関連メタデータ
   * @returns {Promise<string>} 関連ID
   */
  async createRelationship(sourceId, targetId, relationType, metadata = {}) {
    // ソース知識とターゲット知識の存在確認
    const sourceKnowledge = await this.get(sourceId);
    const targetKnowledge = await this.get(targetId);
    
    if (!sourceKnowledge || !targetKnowledge) {
      throw new Error('Source or target knowledge not found');
    }
    
    // 関連IDの生成
    const relationId = `rel_${uuidv4().replace(/-/g, '')}`;
    
    // 現在時刻
    const now = new Date();
    
    // 関連オブジェクトの作成
    const relationship = {
      id: relationId,
      content: JSON.stringify({
        source_id: sourceId,
        target_id: targetId,
        type: relationType,
        ...metadata
      }),
      type: KnowledgeType.RELATIONSHIP,
      categories: ['relationships'],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      tags: ['relationship', relationType],
      metadata: {
        source_id: sourceId,
        target_id: targetId,
        relation_type: relationType,
        ...metadata
      }
    };
    
    // 関連を保存
    await this.store(relationship);
    
    // ソース知識とターゲット知識のメタデータを更新
    await this.update(sourceId, {
      metadata: {
        ...sourceKnowledge.metadata,
        relationships: [
          ...(sourceKnowledge.metadata.relationships || []),
          { id: relationId, target_id: targetId, type: relationType }
        ]
      }
    });
    
    await this.update(targetId, {
      metadata: {
        ...targetKnowledge.metadata,
        relationships: [
          ...(targetKnowledge.metadata.relationships || []),
          { id: relationId, source_id: sourceId, type: relationType }
        ]
      }
    });
    
    return relationId;
  }

  /**
   * 知識の関連を取得する
   * @param {string} knowledgeId 知識ID
   * @returns {Promise<Array>} 関連の配列
   */
  async getRelationships(knowledgeId) {
    const knowledge = await this.get(knowledgeId);
    
    if (!knowledge || !knowledge.metadata.relationships) {
      return [];
    }
    
    const relationships = [];
    
    for (const relation of knowledge.metadata.relationships) {
      const relationKnowledge = await this.get(relation.id);
      if (relationKnowledge) {
        relationships.push({
          ...relation,
          details: relationKnowledge
        });
      }
    }
    
    return relationships;
  }

  /**
   * 埋め込みベクトルを生成する
   * @param {string} text テキスト
   * @returns {Promise<Array>} 埋め込みベクトル
   * @private
   */
  async _generateEmbedding(text) {
    // 実際の実装では、OpenAIやその他の埋め込みモデルを使用
    // ここではダミーの埋め込みを返す
    return new Array(1536).fill(0).map(() => Math.random() - 0.5);
  }

  /**
   * 知識タイプをメモリタイプにマッピングする
   * @param {string} knowledgeType 知識タイプ
   * @returns {string} メモリタイプ
   * @private
   */
  _mapToMemoryType(knowledgeType) {
    const mapping = {
      [KnowledgeType.FACT]: MemoryType.FACT,
      [KnowledgeType.RULE]: MemoryType.RULE,
      [KnowledgeType.CONCEPT]: MemoryType.FACT,
      [KnowledgeType.PROCEDURE]: MemoryType.RULE,
      [KnowledgeType.RELATIONSHIP]: MemoryType.FACT
    };
    
    return mapping[knowledgeType] || MemoryType.FACT;
  }

  /**
   * メモリタイプを知識タイプにマッピングする
   * @param {string} memoryType メモリタイプ
   * @returns {string} 知識タイプ
   * @private
   */
  _mapFromMemoryType(memoryType) {
    const mapping = {
      [MemoryType.FACT]: KnowledgeType.FACT,
      [MemoryType.RULE]: KnowledgeType.RULE
    };
    
    return mapping[memoryType] || KnowledgeType.FACT;
  }

  /**
   * カテゴリに知識IDを追加する
   * @param {string} category カテゴリ
   * @param {string} knowledgeId 知識ID
   * @returns {Promise<void>}
   * @private
   */
  async _addToCategory(category, knowledgeId) {
    const categoryCacheKey = this._getCategoryCacheKey(category);
    let ids = await this.cacheClient.get(categoryCacheKey) || [];
    
    // 既に存在する場合は追加しない
    if (!ids.includes(knowledgeId)) {
      ids.push(knowledgeId);
      await this.cacheClient.set(categoryCacheKey, ids, this.cacheTTL);
    }
  }

  /**
   * カテゴリから知識IDを削除する
   * @param {string} category カテゴリ
   * @param {string} knowledgeId 知識ID
   * @returns {Promise<void>}
   * @private
   */
  async _removeFromCategory(category, knowledgeId) {
    const categoryCacheKey = this._getCategoryCacheKey(category);
    let ids = await this.cacheClient.get(categoryCacheKey) || [];
    
    // IDを削除
    ids = ids.filter(id => id !== knowledgeId);
    
    if (ids.length > 0) {
      await this.cacheClient.set(categoryCacheKey, ids, this.cacheTTL);
    } else {
      await this.cacheClient.delete(categoryCacheKey);
    }
  }

  /**
   * 2つの配列が等しいかどうかを確認する
   * @param {Array} arr1 配列1
   * @param {Array} arr2 配列2
   * @returns {boolean} 等しい場合はtrue
   * @private
   */
  _areArraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) {
      return false;
    }
    
    const sortedArr1 = [...arr1].sort();
    const sortedArr2 = [...arr2].sort();
    
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
  }
}
