/**
 * @fileoverview 知識マネージャー
 * 
 * このファイルでは、知識エンティティの作成、取得、更新、削除などの
 * 基本的なCRUD操作を提供する知識マネージャークラスを定義しています。
 */

import { Knowledge } from './knowledge-model.js';
import { getDbClient } from '../../db/db-client.js';
import { getCacheClient } from '../../cache/cache-client.js';
import logger from '../../utils/logger.js';

/**
 * 知識マネージャークラス
 */
export class KnowledgeManager {
  /**
   * KnowledgeManagerのインスタンスを作成する
   * @param {Object} options 設定オプション
   * @param {Object} options.dbConfig データベース設定
   * @param {Object} options.cacheConfig キャッシュ設定
   */
  constructor(options = {}) {
    this.dbClient = getDbClient(options.dbConfig);
    this.cacheClient = getCacheClient(options.cacheConfig);
    
    // キャッシュキープレフィックス
    this.cacheKeyPrefix = 'knowledge:';
    
    // キャッシュTTL（秒）
    this.cacheTTL = options.cacheTTL || 3600; // デフォルト1時間
    
    logger.info('KnowledgeManager initialized');
  }
  
  /**
   * 知識IDに基づくキャッシュキーを生成する
   * @param {string} knowledgeId 知識ID
   * @returns {string} キャッシュキー
   * @private
   */
  _getCacheKey(knowledgeId) {
    return `${this.cacheKeyPrefix}${knowledgeId}`;
  }
  
  /**
   * 新しい知識を作成する
   * @param {Object} knowledgeData 知識データ
   * @returns {Promise<Knowledge>} 作成された知識
   */
  async createKnowledge(knowledgeData) {
    try {
      // 知識インスタンスの作成
      const knowledge = new Knowledge(knowledgeData);
      
      // 矛盾する知識がないか確認
      const potentialConflicts = await this.findPotentialConflicts(knowledge);
      if (potentialConflicts.length > 0) {
        logger.warn(`Created knowledge may conflict with existing knowledge: ${knowledge.toString()}`);
        
        // メタデータに潜在的な矛盾を記録
        knowledge.metadata.potential_conflicts = potentialConflicts.map(k => k.id);
      }
      
      // データベースに保存
      await this.dbClient.knowledge.insert(knowledge.toJSON());
      
      // キャッシュに保存
      const cacheKey = this._getCacheKey(knowledge.id);
      await this.cacheClient.set(cacheKey, JSON.stringify(knowledge.toJSON()), this.cacheTTL);
      
      logger.info(`Knowledge created: ${knowledge.id}`);
      return knowledge;
    } catch (error) {
      logger.error(`Failed to create knowledge: ${error.message}`);
      throw new Error(`Failed to create knowledge: ${error.message}`);
    }
  }
  
  /**
   * IDにより知識を取得する
   * @param {string} knowledgeId 知識ID
   * @returns {Promise<Knowledge|null>} 取得した知識、存在しない場合はnull
   */
  async getKnowledge(knowledgeId) {
    try {
      // キャッシュから取得を試みる
      const cacheKey = this._getCacheKey(knowledgeId);
      const cachedData = await this.cacheClient.get(cacheKey);
      
      if (cachedData) {
        logger.debug(`Knowledge cache hit: ${knowledgeId}`);
        return Knowledge.fromJSON(JSON.parse(cachedData));
      }
      
      // データベースから取得
      const knowledgeData = await this.dbClient.knowledge.findOne({ id: knowledgeId });
      
      if (!knowledgeData) {
        logger.debug(`Knowledge not found: ${knowledgeId}`);
        return null;
      }
      
      // 知識インスタンスの作成
      const knowledge = Knowledge.fromJSON(knowledgeData);
      
      // キャッシュに保存
      await this.cacheClient.set(cacheKey, JSON.stringify(knowledge.toJSON()), this.cacheTTL);
      
      logger.debug(`Knowledge retrieved from database: ${knowledgeId}`);
      return knowledge;
    } catch (error) {
      logger.error(`Failed to get knowledge ${knowledgeId}: ${error.message}`);
      throw new Error(`Failed to get knowledge: ${error.message}`);
    }
  }
  
  /**
   * 知識を更新する
   * @param {string} knowledgeId 知識ID
   * @param {Object} updateData 更新データ
   * @returns {Promise<Knowledge|null>} 更新された知識、存在しない場合はnull
   */
  async updateKnowledge(knowledgeId, updateData) {
    try {
      // 現在の知識を取得
      const currentKnowledge = await this.getKnowledge(knowledgeId);
      
      if (!currentKnowledge) {
        logger.warn(`Cannot update non-existent knowledge: ${knowledgeId}`);
        return null;
      }
      
      // 更新前の状態を保存
      const previousState = currentKnowledge.toJSON();
      
      // 知識を更新
      currentKnowledge.update(updateData);
      
      // 更新履歴をメタデータに追加
      if (!currentKnowledge.metadata.update_history) {
        currentKnowledge.metadata.update_history = [];
      }
      
      currentKnowledge.metadata.update_history.push({
        updated_at: currentKnowledge.updated_at,
        changes: Object.entries(updateData).reduce((acc, [key, value]) => {
          if (previousState[key] !== value) {
            acc[key] = {
              from: previousState[key],
              to: value
            };
          }
          return acc;
        }, {})
      });
      
      // 矛盾する知識がないか確認
      const potentialConflicts = await this.findPotentialConflicts(currentKnowledge);
      if (potentialConflicts.length > 0) {
        logger.warn(`Updated knowledge may conflict with existing knowledge: ${currentKnowledge.toString()}`);
        
        // メタデータに潜在的な矛盾を記録
        currentKnowledge.metadata.potential_conflicts = potentialConflicts.map(k => k.id);
      }
      
      // データベースを更新
      await this.dbClient.knowledge.update(
        { id: knowledgeId },
        { $set: currentKnowledge.toJSON() }
      );
      
      // キャッシュを更新
      const cacheKey = this._getCacheKey(knowledgeId);
      await this.cacheClient.set(cacheKey, JSON.stringify(currentKnowledge.toJSON()), this.cacheTTL);
      
      logger.info(`Knowledge updated: ${knowledgeId}`);
      return currentKnowledge;
    } catch (error) {
      logger.error(`Failed to update knowledge ${knowledgeId}: ${error.message}`);
      throw new Error(`Failed to update knowledge: ${error.message}`);
    }
  }
  
  /**
   * 知識を削除する
   * @param {string} knowledgeId 知識ID
   * @returns {Promise<boolean>} 削除成功の場合はtrue
   */
  async deleteKnowledge(knowledgeId) {
    try {
      // データベースから削除
      const result = await this.dbClient.knowledge.remove({ id: knowledgeId });
      
      if (result.deletedCount === 0) {
        logger.warn(`Cannot delete non-existent knowledge: ${knowledgeId}`);
        return false;
      }
      
      // キャッシュから削除
      const cacheKey = this._getCacheKey(knowledgeId);
      await this.cacheClient.del(cacheKey);
      
      logger.info(`Knowledge deleted: ${knowledgeId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete knowledge ${knowledgeId}: ${error.message}`);
      throw new Error(`Failed to delete knowledge: ${error.message}`);
    }
  }
  
  /**
   * 条件に基づいて知識を一括取得する
   * @param {Object} query 検索クエリ
   * @param {Object} options 検索オプション
   * @param {number} options.limit 取得上限数
   * @param {number} options.skip スキップ数
   * @param {Object} options.sort ソート条件
   * @returns {Promise<Array<Knowledge>>} 取得した知識の配列
   */
  async listKnowledge(query = {}, options = {}) {
    try {
      // デフォルトオプション
      const finalOptions = {
        limit: options.limit || 100,
        skip: options.skip || 0,
        sort: options.sort || { updated_at: -1 }
      };
      
      // データベースから取得
      const knowledgeData = await this.dbClient.knowledge.find(
        query,
        finalOptions
      );
      
      // 知識インスタンスに変換
      const knowledgeItems = knowledgeData.map(data => Knowledge.fromJSON(data));
      
      logger.debug(`Listed ${knowledgeItems.length} knowledge items`);
      return knowledgeItems;
    } catch (error) {
      logger.error(`Failed to list knowledge: ${error.message}`);
      throw new Error(`Failed to list knowledge: ${error.message}`);
    }
  }
  
  /**
   * 主語に基づいて知識を検索する
   * @param {string} subject 検索対象の主語
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Knowledge>>} 検索結果
   */
  async findBySubject(subject, options = {}) {
    return this.listKnowledge({ subject }, options);
  }
  
  /**
   * 目的語に基づいて知識を検索する
   * @param {string} object 検索対象の目的語
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Knowledge>>} 検索結果
   */
  async findByObject(object, options = {}) {
    return this.listKnowledge({ object }, options);
  }
  
  /**
   * 述語に基づいて知識を検索する
   * @param {string} predicate 検索対象の述語
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Knowledge>>} 検索結果
   */
  async findByPredicate(predicate, options = {}) {
    return this.listKnowledge({ predicate }, options);
  }
  
  /**
   * 主語と述語の組み合わせに基づいて知識を検索する
   * @param {string} subject 検索対象の主語
   * @param {string} predicate 検索対象の述語
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Knowledge>>} 検索結果
   */
  async findBySubjectAndPredicate(subject, predicate, options = {}) {
    return this.listKnowledge({ subject, predicate }, options);
  }
  
  /**
   * 知識の矛盾を検出する
   * @param {Knowledge} knowledge 検証対象の知識
   * @returns {Promise<Array<Knowledge>>} 矛盾する可能性のある知識の配列
   */
  async findPotentialConflicts(knowledge) {
    try {
      // 同じ主語と述語を持つ知識を検索
      const sameSubjectPredicate = await this.findBySubjectAndPredicate(
        knowledge.subject,
        knowledge.predicate
      );
      
      // 自分自身を除外
      const otherKnowledge = sameSubjectPredicate.filter(k => k.id !== knowledge.id);
      
      // 矛盾する知識を検出
      const conflicts = otherKnowledge.filter(k => knowledge.isContradictingWith(k));
      
      return conflicts;
    } catch (error) {
      logger.error(`Failed to find potential conflicts: ${error.message}`);
      throw new Error(`Failed to find potential conflicts: ${error.message}`);
    }
  }
  
  /**
   * 知識の確信度を更新する
   * @param {string} knowledgeId 知識ID
   * @param {number} newConfidence 新しい確信度
   * @param {string} reason 更新理由
   * @returns {Promise<Knowledge|null>} 更新された知識、存在しない場合はnull
   */
  async updateConfidence(knowledgeId, newConfidence, reason = '') {
    try {
      // 現在の知識を取得
      const knowledge = await this.getKnowledge(knowledgeId);
      
      if (!knowledge) {
        logger.warn(`Cannot update confidence of non-existent knowledge: ${knowledgeId}`);
        return null;
      }
      
      // 確信度を更新
      knowledge.updateConfidence(newConfidence, reason);
      
      // データベースを更新
      await this.dbClient.knowledge.update(
        { id: knowledgeId },
        { $set: knowledge.toJSON() }
      );
      
      // キャッシュを更新
      const cacheKey = this._getCacheKey(knowledgeId);
      await this.cacheClient.set(cacheKey, JSON.stringify(knowledge.toJSON()), this.cacheTTL);
      
      logger.info(`Knowledge confidence updated: ${knowledgeId}, new value: ${newConfidence}`);
      return knowledge;
    } catch (error) {
      logger.error(`Failed to update knowledge confidence ${knowledgeId}: ${error.message}`);
      throw new Error(`Failed to update knowledge confidence: ${error.message}`);
    }
  }
  
  /**
   * 知識の参照ドキュメントを追加する
   * @param {string} knowledgeId 知識ID
   * @param {string} reference 追加する参照ドキュメント
   * @returns {Promise<Knowledge|null>} 更新された知識、存在しない場合はnull
   */
  async addReference(knowledgeId, reference) {
    try {
      // 現在の知識を取得
      const knowledge = await this.getKnowledge(knowledgeId);
      
      if (!knowledge) {
        logger.warn(`Cannot add reference to non-existent knowledge: ${knowledgeId}`);
        return null;
      }
      
      // 既に存在する参照は追加しない
      if (!knowledge.references.includes(reference)) {
        knowledge.references.push(reference);
        knowledge.updated_at = new Date().toISOString();
        
        // データベースを更新
        await this.dbClient.knowledge.update(
          { id: knowledgeId },
          { $set: knowledge.toJSON() }
        );
        
        // キャッシュを更新
        const cacheKey = this._getCacheKey(knowledgeId);
        await this.cacheClient.set(cacheKey, JSON.stringify(knowledge.toJSON()), this.cacheTTL);
        
        logger.info(`Reference added to knowledge: ${knowledgeId}, reference: ${reference}`);
      } else {
        logger.debug(`Reference already exists in knowledge: ${knowledgeId}, reference: ${reference}`);
      }
      
      return knowledge;
    } catch (error) {
      logger.error(`Failed to add reference to knowledge ${knowledgeId}: ${error.message}`);
      throw new Error(`Failed to add reference to knowledge: ${error.message}`);
    }
  }
}
