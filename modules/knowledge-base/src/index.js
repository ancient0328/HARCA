/**
 * @fileoverview 知識ベースモジュールのエントリーポイント
 * 
 * このファイルは、知識ベースモジュールの各コンポーネントをまとめて
 * 外部から利用しやすいインターフェースを提供します。
 */

import { Knowledge, Predicate as KnowledgeRelationType, Importance as KnowledgeImportance } from './knowledge-model.js';
import { KnowledgeManager } from './knowledge-manager.js';
import { KnowledgeSearch } from './knowledge-search.js';
import logger from '../../utils/logger.js';

/**
 * 知識ベースクラス
 * 知識ベースモジュールの主要機能を統合したインターフェースを提供します。
 */
export class KnowledgeBase {
  /**
   * KnowledgeBaseのインスタンスを作成する
   * @param {Object} options 設定オプション
   * @param {Object} options.dbConfig データベース設定
   * @param {Object} options.cacheConfig キャッシュ設定
   * @param {Object} options.embeddingConfig 埋め込み設定
   */
  constructor(options = {}) {
    this.options = options;
    
    // 各コンポーネントのインスタンスを作成
    this.knowledgeManager = new KnowledgeManager(options);
    this.knowledgeSearch = new KnowledgeSearch(options);
    
    logger.info('KnowledgeBase initialized');
  }
  
  /**
   * 新しい知識を作成する
   * @param {Object} knowledgeData 知識データ
   * @returns {Promise<Knowledge>} 作成された知識
   */
  async createKnowledge(knowledgeData) {
    return this.knowledgeManager.createKnowledge(knowledgeData);
  }
  
  /**
   * IDにより知識を取得する
   * @param {string} knowledgeId 知識ID
   * @returns {Promise<Knowledge|null>} 取得した知識、存在しない場合はnull
   */
  async getKnowledge(knowledgeId) {
    return this.knowledgeManager.getKnowledge(knowledgeId);
  }
  
  /**
   * 知識を更新する
   * @param {string} knowledgeId 知識ID
   * @param {Object} updateData 更新データ
   * @returns {Promise<Knowledge|null>} 更新された知識、存在しない場合はnull
   */
  async updateKnowledge(knowledgeId, updateData) {
    return this.knowledgeManager.updateKnowledge(knowledgeId, updateData);
  }
  
  /**
   * 知識を削除する
   * @param {string} knowledgeId 知識ID
   * @returns {Promise<boolean>} 削除成功の場合はtrue
   */
  async deleteKnowledge(knowledgeId) {
    return this.knowledgeManager.deleteKnowledge(knowledgeId);
  }
  
  /**
   * 条件に基づいて知識を一括取得する
   * @param {Object} query 検索クエリ
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Knowledge>>} 取得した知識の配列
   */
  async listKnowledge(query = {}, options = {}) {
    return this.knowledgeManager.listKnowledge(query, options);
  }
  
  /**
   * テキストクエリに基づいて知識を検索する
   * @param {Object} params 検索パラメータ
   * @param {string} params.query 検索クエリ
   * @param {Object} params.filters フィルター条件
   * @param {number} params.limit 取得上限数
   * @param {number} params.threshold 類似度閾値
   * @returns {Promise<Array<{knowledge: Knowledge, similarity: number}>>} 検索結果
   */
  async searchKnowledge(params) {
    return this.knowledgeSearch.searchByText(params);
  }
  
  /**
   * 複合検索を実行する
   * @param {Object} params 検索パラメータ
   * @returns {Promise<Array<{knowledge: Knowledge, similarity: number}>>} 検索結果
   */
  async searchComplex(params) {
    return this.knowledgeSearch.searchComplex(params);
  }
  
  /**
   * 知識グラフを探索する
   * @param {string} startNodeId 開始ノードID
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<{path: Array<Knowledge>, depth: number}>>} 検索結果
   */
  async exploreKnowledgeGraph(startNodeId, options = {}) {
    return this.knowledgeSearch.exploreKnowledgeGraph(startNodeId, options);
  }
  
  /**
   * 知識IDに基づいて関連する知識を検索する
   * @param {string} knowledgeId 基準となる知識ID
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<{knowledge: Knowledge, relation: string}>>} 検索結果
   */
  async findRelatedKnowledge(knowledgeId, options = {}) {
    return this.knowledgeSearch.findRelatedKnowledge(knowledgeId, options);
  }
  
  /**
   * 主語に基づいて関連する知識を検索する
   * @param {string} subject 検索対象の主語
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Knowledge>>} 検索結果
   */
  async findRelatedBySubject(subject, options = {}) {
    return this.knowledgeSearch.findRelatedBySubject(subject, options);
  }
  
  /**
   * 目的語に基づいて関連する知識を検索する
   * @param {string} object 検索対象の目的語
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Knowledge>>} 検索結果
   */
  async findRelatedByObject(object, options = {}) {
    return this.knowledgeSearch.findRelatedByObject(object, options);
  }
  
  /**
   * 矛盾する可能性のある知識を検索する
   * @param {Object} params 検索パラメータ
   * @returns {Promise<Array<Knowledge>>} 検索結果
   */
  async findContradictions(params) {
    return this.knowledgeSearch.findContradictions(params);
  }
  
  /**
   * 知識の確信度を更新する
   * @param {string} knowledgeId 知識ID
   * @param {number} newConfidence 新しい確信度
   * @param {string} reason 更新理由
   * @returns {Promise<Knowledge|null>} 更新された知識、存在しない場合はnull
   */
  async updateConfidence(knowledgeId, newConfidence, reason = '') {
    return this.knowledgeManager.updateConfidence(knowledgeId, newConfidence, reason);
  }
  
  /**
   * 知識の参照ドキュメントを追加する
   * @param {string} knowledgeId 知識ID
   * @param {string} reference 追加する参照ドキュメント
   * @returns {Promise<Knowledge|null>} 更新された知識、存在しない場合はnull
   */
  async addReference(knowledgeId, reference) {
    return this.knowledgeManager.addReference(knowledgeId, reference);
  }
  
  /**
   * 主語と述語の組み合わせに基づいて知識を検索する
   * @param {string} subject 検索対象の主語
   * @param {string} predicate 検索対象の述語
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Knowledge>>} 検索結果
   */
  async findBySubjectAndPredicate(subject, predicate, options = {}) {
    return this.knowledgeManager.findBySubjectAndPredicate(subject, predicate, options);
  }
  
  /**
   * 知識の矛盾を検出する
   * @param {Knowledge} knowledge 検証対象の知識
   * @returns {Promise<Array<Knowledge>>} 矛盾する可能性のある知識の配列
   */
  async findPotentialConflicts(knowledge) {
    return this.knowledgeManager.findPotentialConflicts(knowledge);
  }
}

// モジュールのエクスポート
export {
  KnowledgeBase,
  Knowledge,
  KnowledgeRelationType,
  KnowledgeImportance
};
