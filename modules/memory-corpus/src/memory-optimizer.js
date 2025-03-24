/**
 * @fileoverview メモリ最適化機能
 * 
 * このファイルでは、メモリコーパスの最適化機能を提供する
 * MemoryOptimizerクラスを定義しています。
 */

import { Memory } from './memory-model.js';
import { getDbClient, getCacheClient } from './memory-manager.js';
import { getEmbeddingService } from './memory-search.js';

// モックの要約サービス（テスト用）
class MockSummarizerService {
  async summarize(text, options = {}) {
    const maxLength = options.maxLength || 500;
    if (text.length <= maxLength) return text;
    
    // 簡易的な要約（実際のシステムではLLMなどを使用）
    return text.substring(0, maxLength) + '...';
  }
}

// デフォルトの要約サービス
let defaultSummarizerService = null;

// 要約サービスの取得
export const getSummarizerService = () => {
  if (!defaultSummarizerService) {
    defaultSummarizerService = new MockSummarizerService();
  }
  return defaultSummarizerService;
};

/**
 * メモリ最適化クラス
 */
export class MemoryOptimizer {
  /**
   * MemoryOptimizerのインスタンスを作成する
   * @param {Object} options 設定オプション
   */
  constructor(options = {}) {
    this.dbClient = options.dbClient || getDbClient(options.dbConfig);
    this.cacheClient = options.cacheClient || getCacheClient(options.cacheConfig);
    this.embeddingService = options.embeddingService || getEmbeddingService(options.embeddingConfig);
    this.summarizerService = options.summarizerService || getSummarizerService(options.summarizerConfig);
    
    // 重複検出の類似度閾値
    this.duplicateThreshold = options.duplicateThreshold || 0.92;
    
    // 圧縮対象の最小メモリ数
    this.compressionMinCount = options.compressionMinCount || 5;
    
    // 圧縮対象の最大メモリ数
    this.compressionMaxCount = options.compressionMaxCount || 20;
    
    // 圧縮対象の最小経過日数
    this.compressionMinAgeDays = options.compressionMinAgeDays || 30;
  }
  
  /**
   * 重複メモリを検出する
   * @param {Object} options 検出オプション
   * @param {number} options.threshold 類似度閾値
   * @param {string} options.type メモリタイプでフィルタリング
   * @param {Array<string>} options.tags タグでフィルタリング
   * @returns {Promise<Array<{memories: Array<Memory>, similarity: number}>>} 重複グループの配列
   */
  async findDuplicates(options = {}) {
    try {
      const threshold = options.threshold || this.duplicateThreshold;
      const limit = options.limit || 100;
      
      // フィルタを構築
      const filter = {};
      if (options.type) {
        filter.type = options.type;
      }
      if (options.tags && options.tags.length > 0) {
        filter.tags = options.tags;
      }
      
      // メモリを取得
      const allMemories = await this.dbClient.listMemories(filter);
      const memories = allMemories.items;
      
      // 重複グループを保持する配列
      const duplicateGroups = [];
      
      // 処理済みのメモリIDを追跡
      const processedIds = new Set();
      
      // 各メモリについて重複を検索
      for (const memory of memories) {
        // 既に処理済みならスキップ
        if (processedIds.has(memory.id)) {
          continue;
        }
        
        // 類似メモリのグループ
        const similarMemories = [memory];
        
        // 他のメモリとの類似度を計算
        for (const otherMemory of memories) {
          if (memory.id === otherMemory.id || processedIds.has(otherMemory.id)) {
            continue;
          }
          
          // 内容の類似度を計算
          const similarity = await this._calculateSimilarity(memory, otherMemory);
          
          if (similarity >= threshold) {
            similarMemories.push(otherMemory);
            processedIds.add(otherMemory.id);
          }
        }
        
        // 類似メモリがあれば重複グループを作成
        if (similarMemories.length > 1) {
          duplicateGroups.push({
            memories: similarMemories,
            similarity: 0.95 // 簡易的に固定値を使用
          });
          
          // 処理済みに追加
          processedIds.add(memory.id);
        }
      }
      
      return duplicateGroups;
    } catch (error) {
      throw new Error(`Failed to detect duplicate memories: ${error.message}`);
    }
  }
  
  /**
   * 2つのメモリ間の類似度を計算する
   * @param {Memory} memory1 メモリ1
   * @param {Memory} memory2 メモリ2
   * @returns {Promise<number>} 類似度（0〜1）
   * @private
   */
  async _calculateSimilarity(memory1, memory2) {
    try {
      // 埋め込みサービスを使用して類似度を計算
      return await this.embeddingService.calculateSimilarity(memory1.id, memory2.id);
    } catch (error) {
      // フォールバックとして内容の類似度を計算
      return this._calculateContentSimilarity(memory1.content, memory2.content);
    }
  }
  
  /**
   * 内容の類似度を計算する簡易的なヘルパーメソッド
   * @param {string} content1 内容1
   * @param {string} content2 内容2
   * @returns {number} 類似度（0〜1）
   * @private
   */
  _calculateContentSimilarity(content1, content2) {
    // 実際のシステムでは埋め込みベクトルを使用した類似度計算を行う
    // ここでは簡易的な計算を行う
    
    // 文字列の長さの差を計算
    const lengthDiff = Math.abs(content1.length - content2.length) / Math.max(content1.length, content2.length);
    
    // 共通の単語の割合を計算
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    let commonWords = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        commonWords++;
      }
    }
    
    const wordSimilarity = commonWords / Math.max(words1.size, words2.size);
    
    // 長さの差と共通単語の割合を組み合わせて類似度を計算
    return (1 - lengthDiff) * 0.3 + wordSimilarity * 0.7;
  }
  
  /**
   * 重複メモリを統合する
   * @param {Array<string>} memoryIds 統合対象のメモリID配列
   * @param {Object} mergeData マージデータ
   * @returns {Promise<Memory>} 統合されたメモリ
   */
  async mergeMemories(memoryIds, mergeData = {}) {
    try {
      if (!Array.isArray(memoryIds) || memoryIds.length === 0) {
        throw new Error('No memory IDs provided');
      }
      
      // メモリを取得
      const memories = [];
      for (const id of memoryIds) {
        const memory = await this.dbClient.getMemory(id);
        if (!memory) {
          throw new Error(`Memory with ID ${id} not found`);
        }
        memories.push(memory);
      }
      
      if (memories.length === 1 && !mergeData) {
        return memories[0];
      }
      
      // タイプを決定（最初のメモリのタイプを使用）
      const type = mergeData.type || memories[0].type;
      if (!type) {
        throw new Error('type is required');
      }
      
      // タグをマージ
      const allTags = memories.flatMap(memory => memory.tags || []);
      if (mergeData.tags) {
        allTags.push(...mergeData.tags);
      }
      const mergedTags = [...new Set(allTags)];
      
      // 新しいメモリを作成
      const mergedMemory = new Memory({
        content: mergeData.content || memories.map(m => m.content).join('\n\n'),
        type,
        confidence: mergeData.confidence || Math.max(...memories.map(m => m.confidence || 0.5)),
        tags: mergedTags,
        metadata: {
          ...mergeData.metadata,
          merged_from: memoryIds,
          merged_at: new Date().toISOString()
        }
      });
      
      // データベースに保存
      await this.dbClient.saveMemory(mergedMemory);
      
      // 元のメモリを削除
      for (const id of memoryIds) {
        await this.dbClient.deleteMemory(id);
        
        // キャッシュからも削除
        const cacheKey = `memory:${id}`;
        await this.cacheClient.delete(cacheKey);
      }
      
      return mergedMemory;
    } catch (error) {
      throw new Error(`Failed to merge memories: ${error.message}`);
    }
  }
  
  /**
   * メモリを最適化する
   * @param {Object} options 最適化オプション
   * @param {number} options.threshold 類似度閾値
   * @param {string} options.type メモリタイプでフィルタリング
   * @param {Array<string>} options.tags タグでフィルタリング
   * @param {boolean} options.autoMerge 自動マージを行うかどうか
   * @returns {Promise<Object>} 最適化結果
   */
  async optimizeMemories(options = {}) {
    try {
      // 重複を検出
      const duplicates = await this.findDuplicates(options);
      
      // 自動マージが無効な場合は重複のみを返す
      if (!options.autoMerge) {
        return {
          optimized: false,
          duplicates
        };
      }
      
      // 重複をマージ
      const newMemories = [];
      for (const duplicate of duplicates) {
        const memoryIds = duplicate.memories.map(memory => memory.id);
        
        // マージデータを準備
        const mergeData = {
          type: options.type || duplicate.memories[0].type,
          tags: [...new Set(duplicate.memories.flatMap(memory => memory.tags || []))],
          confidence: Math.max(...duplicate.memories.map(memory => memory.confidence || 0.5))
        };
        
        // メモリをマージ
        const mergedMemory = await this.mergeMemories(memoryIds, mergeData);
        newMemories.push(mergedMemory);
      }
      
      return {
        optimized: true,
        mergedCount: duplicates.length,
        newMemories
      };
    } catch (error) {
      throw new Error(`Failed to optimize memories: ${error.message}`);
    }
  }
  
  /**
   * 古いメモリを圧縮する
   * @param {Object} options 圧縮オプション
   * @returns {Promise<Array<{original: Array<Memory>, compressed: Memory}>>} 圧縮結果
   */
  async compressOldMemories(options = {}) {
    try {
      const minAgeDays = options.minAgeDays || this.compressionMinAgeDays;
      const minCount = options.minCount || this.compressionMinCount;
      const maxCount = options.maxCount || this.compressionMaxCount;
      
      // 圧縮対象の日付を計算
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - minAgeDays);
      const cutoffDateString = cutoffDate.toISOString();
      
      // 古いメモリを取得
      const oldMemories = await this.dbClient.listMemories({
        created_at: { $lt: cutoffDateString }
      });
      
      // 圧縮結果
      const compressionResults = [];
      
      // タイプごとにグループ化
      const typeGroups = new Map();
      for (const memory of oldMemories.items) {
        if (!typeGroups.has(memory.type)) {
          typeGroups.set(memory.type, []);
        }
        typeGroups.get(memory.type).push(memory);
      }
      
      // 各タイプのグループを圧縮
      for (const [type, memories] of typeGroups.entries()) {
        if (memories.length < minCount) {
          continue; // 最小数に満たない場合はスキップ
        }
        
        // 日付順にソート
        memories.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        // 最大数を超える場合は分割
        for (let i = 0; i < memories.length; i += maxCount) {
          const batch = memories.slice(i, i + maxCount);
          if (batch.length >= minCount) {
            const memoryIds = batch.map(memory => memory.id);
            const mergeData = {
              type,
              tags: [...new Set(batch.flatMap(memory => memory.tags || []))],
              confidence: Math.max(...batch.map(memory => memory.confidence || 0.5))
            };
            
            const compressedMemory = await this.mergeMemories(memoryIds, mergeData);
            compressionResults.push({
              original: batch,
              compressed: compressedMemory
            });
          }
        }
      }
      
      return compressionResults;
    } catch (error) {
      throw new Error(`Failed to compress old memories: ${error.message}`);
    }
  }
}
