/**
 * @fileoverview 知識ベースの検索機能
 * 
 * このファイルでは、知識ベース内の知識を効率的に検索するための
 * KnowledgeSearchクラスを定義しています。
 */

import { Knowledge } from './knowledge-model.js';
import { getEmbeddingService } from '../../services/embedding-service.js';
import { getDbClient } from '../../db/db-client.js';
import { getCacheClient } from '../../cache/cache-client.js';
import logger from '../../utils/logger.js';

/**
 * 知識検索クラス
 */
export class KnowledgeSearch {
  /**
   * KnowledgeSearchのインスタンスを作成する
   * @param {Object} options 設定オプション
   * @param {Object} options.dbConfig データベース設定
   * @param {Object} options.cacheConfig キャッシュ設定
   * @param {Object} options.embeddingConfig 埋め込み設定
   */
  constructor(options = {}) {
    this.dbClient = getDbClient(options.dbConfig);
    this.cacheClient = getCacheClient(options.cacheConfig);
    this.embeddingService = getEmbeddingService(options.embeddingConfig);
    
    // キャッシュキープレフィックス
    this.cacheKeyPrefix = 'knowledge:search:';
    
    // キャッシュTTL（秒）
    this.cacheTTL = options.cacheTTL || 1800; // デフォルト30分
    
    // 検索結果のデフォルト上限
    this.defaultLimit = options.defaultLimit || 50;
    
    // 類似度の閾値
    this.similarityThreshold = options.similarityThreshold || 0.7;
    
    logger.info('KnowledgeSearch initialized');
  }
  
  /**
   * 検索クエリに基づくキャッシュキーを生成する
   * @param {string} query 検索クエリ
   * @param {Object} filters フィルター条件
   * @returns {string} キャッシュキー
   * @private
   */
  _getCacheKey(query, filters = {}) {
    const filterString = Object.entries(filters)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
      .join('|');
      
    return `${this.cacheKeyPrefix}${query}|${filterString}`;
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
  async searchByText(params) {
    try {
      const { 
        query, 
        filters = {}, 
        limit = this.defaultLimit,
        threshold = this.similarityThreshold
      } = params;
      
      if (!query || query.trim() === '') {
        throw new Error('Search query cannot be empty');
      }
      
      // キャッシュから取得を試みる
      const cacheKey = this._getCacheKey(query, filters);
      const cachedResults = await this.cacheClient.get(cacheKey);
      
      if (cachedResults) {
        logger.debug(`Knowledge search cache hit: ${query}`);
        const parsedResults = JSON.parse(cachedResults);
        
        // キャッシュされた結果を知識インスタンスに変換
        return parsedResults.map(item => ({
          knowledge: Knowledge.fromJSON(item.knowledge),
          similarity: item.similarity
        }));
      }
      
      // クエリの埋め込みを取得
      const queryEmbedding = await this.embeddingService.getEmbedding(query);
      
      // ベクトル検索を実行
      const searchResults = await this.dbClient.knowledge.vectorSearch({
        embedding: queryEmbedding,
        filters,
        limit,
        threshold
      });
      
      // 検索結果を知識インスタンスに変換
      const results = searchResults.map(item => ({
        knowledge: Knowledge.fromJSON(item.document),
        similarity: item.similarity
      }));
      
      // キャッシュに保存
      await this.cacheClient.set(
        cacheKey,
        JSON.stringify(results.map(item => ({
          knowledge: item.knowledge.toJSON(),
          similarity: item.similarity
        }))),
        this.cacheTTL
      );
      
      logger.debug(`Knowledge search completed: ${query}, found ${results.length} results`);
      return results;
    } catch (error) {
      logger.error(`Failed to search knowledge by text: ${error.message}`);
      throw new Error(`Failed to search knowledge by text: ${error.message}`);
    }
  }
  
  /**
   * 知識グラフを探索して関連知識を検索する
   * @param {string} startNodeId 開始ノードID
   * @param {Object} options 検索オプション
   * @param {number} options.maxDepth 最大探索深度
   * @param {number} options.limit 取得上限数
   * @param {Array<string>} options.predicates 探索する述語の配列
   * @returns {Promise<Array<{path: Array<Knowledge>, depth: number}>>} 検索結果
   */
  async exploreKnowledgeGraph(startNodeId, options = {}) {
    try {
      const {
        maxDepth = 2,
        limit = this.defaultLimit,
        predicates = []
      } = options;
      
      // 開始ノードの存在確認
      const startNode = await this.dbClient.knowledge.findOne({ id: startNodeId });
      if (!startNode) {
        throw new Error(`Start node not found: ${startNodeId}`);
      }
      
      // グラフ探索クエリを実行
      const graphResults = await this.dbClient.knowledge.graphExplore({
        startNodeId,
        maxDepth,
        limit,
        predicates
      });
      
      // 結果を知識インスタンスに変換
      const results = graphResults.map(item => ({
        path: item.path.map(node => Knowledge.fromJSON(node)),
        depth: item.depth
      }));
      
      logger.debug(`Knowledge graph exploration completed from ${startNodeId}, found ${results.length} paths`);
      return results;
    } catch (error) {
      logger.error(`Failed to explore knowledge graph: ${error.message}`);
      throw new Error(`Failed to explore knowledge graph: ${error.message}`);
    }
  }
  
  /**
   * 複合検索を実行する
   * @param {Object} params 検索パラメータ
   * @param {string} params.query テキスト検索クエリ
   * @param {Object} params.filters フィルター条件
   * @param {Array<string>} params.subjects 検索対象の主語配列
   * @param {Array<string>} params.predicates 検索対象の述語配列
   * @param {Array<string>} params.objects 検索対象の目的語配列
   * @param {number} params.limit 取得上限数
   * @param {number} params.threshold 類似度閾値
   * @returns {Promise<Array<{knowledge: Knowledge, similarity: number}>>} 検索結果
   */
  async searchComplex(params) {
    try {
      const {
        query,
        filters = {},
        subjects = [],
        predicates = [],
        objects = [],
        limit = this.defaultLimit,
        threshold = this.similarityThreshold
      } = params;
      
      // フィルター条件の構築
      const complexFilters = { ...filters };
      
      if (subjects.length > 0) {
        complexFilters.subject = { $in: subjects };
      }
      
      if (predicates.length > 0) {
        complexFilters.predicate = { $in: predicates };
      }
      
      if (objects.length > 0) {
        complexFilters.object = { $in: objects };
      }
      
      // テキスト検索の実行（クエリがある場合）
      if (query && query.trim() !== '') {
        return this.searchByText({
          query,
          filters: complexFilters,
          limit,
          threshold
        });
      }
      
      // テキスト検索なしの場合はフィルターのみで検索
      const knowledgeData = await this.dbClient.knowledge.find(
        complexFilters,
        { limit }
      );
      
      // 知識インスタンスに変換
      const results = knowledgeData.map(data => ({
        knowledge: Knowledge.fromJSON(data),
        similarity: 1.0 // フィルターのみの検索では類似度は常に1.0
      }));
      
      logger.debug(`Complex knowledge search completed, found ${results.length} results`);
      return results;
    } catch (error) {
      logger.error(`Failed to perform complex knowledge search: ${error.message}`);
      throw new Error(`Failed to perform complex knowledge search: ${error.message}`);
    }
  }
  
  /**
   * 主語に基づいて関連する知識を検索する
   * @param {string} subject 検索対象の主語
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Knowledge>>} 検索結果
   */
  async findRelatedBySubject(subject, options = {}) {
    try {
      // 主語に一致する知識を検索
      const directMatches = await this.dbClient.knowledge.find(
        { subject },
        { limit: options.limit || this.defaultLimit }
      );
      
      // 知識インスタンスに変換
      const results = directMatches.map(data => Knowledge.fromJSON(data));
      
      logger.debug(`Found ${results.length} knowledge items related to subject: ${subject}`);
      return results;
    } catch (error) {
      logger.error(`Failed to find knowledge related by subject: ${error.message}`);
      throw new Error(`Failed to find knowledge related by subject: ${error.message}`);
    }
  }
  
  /**
   * 目的語に基づいて関連する知識を検索する
   * @param {string} object 検索対象の目的語
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Knowledge>>} 検索結果
   */
  async findRelatedByObject(object, options = {}) {
    try {
      // 目的語に一致する知識を検索
      const directMatches = await this.dbClient.knowledge.find(
        { object },
        { limit: options.limit || this.defaultLimit }
      );
      
      // 知識インスタンスに変換
      const results = directMatches.map(data => Knowledge.fromJSON(data));
      
      logger.debug(`Found ${results.length} knowledge items related to object: ${object}`);
      return results;
    } catch (error) {
      logger.error(`Failed to find knowledge related by object: ${error.message}`);
      throw new Error(`Failed to find knowledge related by object: ${error.message}`);
    }
  }
  
  /**
   * 知識IDに基づいて関連する知識を検索する
   * @param {string} knowledgeId 基準となる知識ID
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<{knowledge: Knowledge, relation: string}>>} 検索結果
   */
  async findRelatedKnowledge(knowledgeId, options = {}) {
    try {
      // 基準となる知識を取得
      const baseKnowledge = await this.dbClient.knowledge.findOne({ id: knowledgeId });
      
      if (!baseKnowledge) {
        throw new Error(`Knowledge not found: ${knowledgeId}`);
      }
      
      const { subject, object } = baseKnowledge;
      const limit = options.limit || this.defaultLimit;
      
      // 関連する知識を検索
      const relatedBySubject = await this.dbClient.knowledge.find(
        { 
          $or: [
            { subject },
            { object: subject }
          ],
          id: { $ne: knowledgeId }
        },
        { limit }
      );
      
      const relatedByObject = await this.dbClient.knowledge.find(
        { 
          $or: [
            { subject: object },
            { object }
          ],
          id: { $ne: knowledgeId }
        },
        { limit }
      );
      
      // 重複を除去して結合
      const combinedResults = [...relatedBySubject];
      
      relatedByObject.forEach(item => {
        if (!combinedResults.some(existing => existing.id === item.id)) {
          combinedResults.push(item);
        }
      });
      
      // 関連の種類を判定して結果を整形
      const results = combinedResults.map(data => {
        let relation = 'unknown';
        
        if (data.subject === subject) {
          relation = 'same_subject';
        } else if (data.object === subject) {
          relation = 'object_to_subject';
        } else if (data.subject === object) {
          relation = 'subject_to_object';
        } else if (data.object === object) {
          relation = 'same_object';
        }
        
        return {
          knowledge: Knowledge.fromJSON(data),
          relation
        };
      });
      
      // 結果を制限
      const limitedResults = results.slice(0, limit);
      
      logger.debug(`Found ${limitedResults.length} knowledge items related to knowledge: ${knowledgeId}`);
      return limitedResults;
    } catch (error) {
      logger.error(`Failed to find related knowledge: ${error.message}`);
      throw new Error(`Failed to find related knowledge: ${error.message}`);
    }
  }
  
  /**
   * 矛盾する可能性のある知識を検索する
   * @param {Object} params 検索パラメータ
   * @param {string} params.subject 検索対象の主語
   * @param {string} params.predicate 検索対象の述語
   * @param {string} params.object 検索対象の目的語
   * @param {number} params.confidenceThreshold 確信度の閾値
   * @returns {Promise<Array<Knowledge>>} 検索結果
   */
  async findContradictions(params) {
    try {
      const {
        subject,
        predicate,
        object,
        confidenceThreshold = 0.5
      } = params;
      
      // 同じ主語と述語を持つ知識を検索
      const potentialContradictions = await this.dbClient.knowledge.find({
        subject,
        predicate,
        object: { $ne: object },
        confidence: { $gte: confidenceThreshold }
      });
      
      // 知識インスタンスに変換
      const results = potentialContradictions.map(data => Knowledge.fromJSON(data));
      
      logger.debug(`Found ${results.length} potentially contradicting knowledge items`);
      return results;
    } catch (error) {
      logger.error(`Failed to find contradictions: ${error.message}`);
      throw new Error(`Failed to find contradictions: ${error.message}`);
    }
  }
}
