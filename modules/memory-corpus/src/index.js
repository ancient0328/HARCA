/**
 * @fileoverview メモリコーパスモジュールのエントリーポイント
 * 
 * このファイルは、メモリコーパスモジュールの各コンポーネントをまとめて
 * 外部から利用しやすいインターフェースを提供します。
 */

import { Memory, MemoryType, MemoryPriority } from './memory-model.js';
import { MemoryManager } from './memory-manager.js';
import { MemorySearch } from './memory-search.js';
import { MemoryOptimizer } from './memory-optimizer.js';
import logger from '../../utils/logger.js';

/**
 * メモリコーパスクラス
 * メモリコーパスモジュールの主要機能を統合したインターフェースを提供します。
 */
class MemoryCorpus {
  /**
   * MemoryCorpusのインスタンスを作成する
   * @param {Object} options 設定オプション
   * @param {Object} options.dbConfig データベース設定
   * @param {Object} options.cacheConfig キャッシュ設定
   * @param {Object} options.embeddingConfig 埋め込み設定
   * @param {Object} options.summarizerConfig 要約設定
   */
  constructor(options = {}) {
    this.options = options;
    
    // 各コンポーネントのインスタンスを作成
    this.memoryManager = new MemoryManager(options);
    this.memorySearch = new MemorySearch(options);
    this.memoryOptimizer = new MemoryOptimizer(options);
    
    logger.info('MemoryCorpus initialized');
  }
  
  /**
   * 新しいメモリを作成する
   * @param {Object} memoryData メモリデータ
   * @returns {Promise<Memory>} 作成されたメモリ
   */
  async createMemory(memoryData) {
    return this.memoryManager.createMemory(memoryData);
  }
  
  /**
   * IDによりメモリを取得する
   * @param {string} memoryId メモリID
   * @returns {Promise<Memory|null>} 取得したメモリ、存在しない場合はnull
   */
  async getMemory(memoryId) {
    return this.memoryManager.getMemory(memoryId);
  }
  
  /**
   * メモリを更新する
   * @param {string} memoryId メモリID
   * @param {Object} updateData 更新データ
   * @returns {Promise<Memory|null>} 更新されたメモリ、存在しない場合はnull
   */
  async updateMemory(memoryId, updateData) {
    return this.memoryManager.updateMemory(memoryId, updateData);
  }
  
  /**
   * メモリを削除する
   * @param {string} memoryId メモリID
   * @returns {Promise<boolean>} 削除成功の場合はtrue
   */
  async deleteMemory(memoryId) {
    return this.memoryManager.deleteMemory(memoryId);
  }
  
  /**
   * 条件に基づいてメモリを一括取得する
   * @param {Object} query 検索クエリ
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Memory>>} 取得したメモリの配列
   */
  async listMemories(query = {}, options = {}) {
    return this.memoryManager.listMemories(query, options);
  }
  
  /**
   * テキストクエリに基づいてメモリを検索する
   * @param {Object} params 検索パラメータ
   * @param {string} params.query 検索クエリ
   * @param {Object} params.filters フィルター条件
   * @param {number} params.limit 取得上限数
   * @param {number} params.threshold 類似度閾値
   * @returns {Promise<Array<{memory: Memory, similarity: number}>>} 検索結果
   */
  async searchMemories(params) {
    return this.memorySearch.searchComplex(params);
  }
  
  /**
   * 関連メモリを検索する
   * @param {string} memoryId 基準となるメモリID
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<{memory: Memory, similarity: number}>>} 検索結果
   */
  async findRelatedMemories(memoryId, options = {}) {
    return this.memorySearch.findRelatedMemories(memoryId, options);
  }
  
  /**
   * タグに基づいてメモリを検索する
   * @param {Array<string>} tags 検索対象のタグ
   * @param {Object} options 検索オプション
   * @returns {Promise<Array<Memory>>} 検索結果
   */
  async searchByTags(tags, options = {}) {
    return this.memorySearch.searchByTags(tags, options);
  }
  
  /**
   * 重複メモリを検出する
   * @param {Object} options 検出オプション
   * @returns {Promise<Array<{group: Array<Memory>, similarity: number}>>} 重複グループの配列
   */
  async detectDuplicateMemories(options = {}) {
    return this.memoryOptimizer.detectDuplicates(options);
  }
  
  /**
   * 重複メモリを検出する (detectDuplicateMemoriesのエイリアス)
   * @param {Object} options 検出オプション
   * @returns {Promise<Array<{memories: Array<Memory>, similarity: number}>>} 重複グループの配列
   */
  async findDuplicateMemories(options = {}) {
    const duplicates = await this.memoryOptimizer.detectDuplicates(options);
    // テスト用に戻り値の形式を調整
    return duplicates.map(group => ({
      memories: group.group,
      similarity: group.similarity
    }));
  }
  
  /**
   * 重複メモリを統合する
   * @param {Array<Memory>} memories 統合対象のメモリ配列
   * @returns {Promise<Memory>} 統合されたメモリ
   */
  async mergeMemories(memories) {
    return this.memoryOptimizer.mergeMemories(memories);
  }
  
  /**
   * 古いメモリを圧縮する
   * @param {Object} options 圧縮オプション
   * @returns {Promise<Array<{original: Array<Memory>, compressed: Memory}>>} 圧縮結果
   */
  async compressOldMemories(options = {}) {
    return this.memoryOptimizer.compressOldMemories(options);
  }
  
  /**
   * メモリの使用状況を分析する
   * @returns {Promise<Object>} 使用状況の分析結果
   */
  async analyzeMemoryUsage() {
    return this.memoryOptimizer.analyzeMemoryUsage();
  }
  
  /**
   * 最適化処理を実行する
   * @returns {Promise<Object>} 最適化結果
   */
  async optimizeMemories() {
    return this.memoryOptimizer.runOptimization();
  }
  
  /**
   * 有効期限切れのメモリをクリーンアップする
   * @returns {Promise<number>} 削除されたメモリの数
   */
  async cleanupExpiredMemories() {
    return this.memoryOptimizer.cleanupExpiredMemories();
  }
  
  /**
   * 複数のメモリを一括で作成する
   * @param {Array<Object>} memoriesData メモリデータの配列
   * @returns {Promise<Array<string>>} 作成されたメモリのID配列
   */
  async bulkCreateMemories(memoriesData) {
    const ids = [];
    for (const memoryData of memoriesData) {
      const id = await this.createMemory(memoryData);
      ids.push(id);
    }
    return ids;
  }
  
  /**
   * 複数のメモリを一括で削除する
   * @param {Array<string>} memoryIds 削除対象のメモリID配列
   * @returns {Promise<{success: number, failed: number}>} 削除結果
   */
  async bulkDeleteMemories(memoryIds) {
    let success = 0;
    let failed = 0;
    
    for (const id of memoryIds) {
      const result = await this.deleteMemory(id);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }
    
    return { success, failed };
  }
}

// モジュールのエクスポート
export {
  MemoryCorpus,
  Memory,
  MemoryType,
  MemoryPriority
};
