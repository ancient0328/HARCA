/**
 * @fileoverview 知識ベース最適化機能のテスト
 * 
 * このファイルでは、知識ベースの最適化機能をテストします。
 * 重複検出、知識の圧縮、使用状況分析などの機能が含まれます。
 */

import { KnowledgeOptimizer } from '../src/knowledge-optimizer.js';
import { Knowledge, KnowledgeRelationType } from '../src/knowledge-model.js';

// モックデータベースクライアント
class MockDbClient {
  constructor() {
    this.knowledgeStore = new Map();
    this.accessLog = new Map(); // アクセスログを記録
  }
  
  async insert(knowledge) {
    this.knowledgeStore.set(knowledge.id, { ...knowledge });
    this.accessLog.set(knowledge.id, {
      lastAccessed: new Date().toISOString(),
      accessCount: 0
    });
    return knowledge.id;
  }
  
  async findById(id) {
    const knowledge = this.knowledgeStore.get(id);
    if (knowledge) {
      // アクセスログを更新
      const log = this.accessLog.get(id) || { accessCount: 0 };
      log.lastAccessed = new Date().toISOString();
      log.accessCount += 1;
      this.accessLog.set(id, log);
    }
    return knowledge || null;
  }
  
  async update(id, data) {
    const knowledge = this.knowledgeStore.get(id);
    if (!knowledge) return null;
    
    const updatedKnowledge = { ...knowledge, ...data, updated_at: new Date().toISOString() };
    this.knowledgeStore.set(id, updatedKnowledge);
    return updatedKnowledge;
  }
  
  async delete(id) {
    const exists = this.knowledgeStore.has(id);
    this.knowledgeStore.delete(id);
    this.accessLog.delete(id);
    return exists;
  }
  
  async findByQuery(query) {
    const results = [];
    
    for (const knowledge of this.knowledgeStore.values()) {
      let match = true;
      
      // 主語のフィルタリング
      if (query.subject && knowledge.subject !== query.subject) {
        match = false;
      }
      
      // 述語のフィルタリング
      if (query.predicate && knowledge.predicate !== query.predicate) {
        match = false;
      }
      
      // 目的語のフィルタリング
      if (query.object && knowledge.object !== query.object) {
        match = false;
      }
      
      // タグのフィルタリング
      if (query.tags && query.tags.length > 0) {
        const hasAllTags = query.tags.every(tag => knowledge.tags.includes(tag));
        if (!hasAllTags) match = false;
      }
      
      // 信頼度のフィルタリング
      if (query.minConfidence && knowledge.confidence < query.minConfidence) {
        match = false;
      }
      
      // 最終アクセス日時のフィルタリング
      if (query.lastAccessedBefore) {
        const log = this.accessLog.get(knowledge.id);
        if (log && new Date(log.lastAccessed) > new Date(query.lastAccessedBefore)) {
          match = false;
        }
      }
      
      if (match) {
        results.push(knowledge);
        
        // アクセスログを更新（検索結果もアクセスとみなす）
        const log = this.accessLog.get(knowledge.id) || { accessCount: 0 };
        log.lastAccessed = new Date().toISOString();
        log.accessCount += 1;
        this.accessLog.set(knowledge.id, log);
      }
    }
    
    return results;
  }
  
  // アクセスログを取得
  async getAccessLog(id) {
    return this.accessLog.get(id) || null;
  }
  
  // すべてのアクセスログを取得
  async getAllAccessLogs() {
    const logs = {};
    for (const [id, log] of this.accessLog.entries()) {
      logs[id] = log;
    }
    return logs;
  }
}

// モック埋め込みサービス
class MockEmbeddingService {
  async getEmbedding(text) {
    return {
      _mockQueryText: text,
      vector: new Array(1536).fill(0).map(() => Math.random())
    };
  }
  
  async calculateSimilarity(text1, text2) {
    // 簡易的な類似度計算
    text1 = text1.toLowerCase();
    text2 = text2.toLowerCase();
    
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const uniqueWords = [...new Set([...words1, ...words2])];
    
    // 共通単語の割合に基づく類似度（0〜1）
    return commonWords.length / Math.max(uniqueWords.length, 1);
  }
}

describe('Knowledge Optimizer Tests', () => {
  let knowledgeOptimizer;
  let mockDbClient;
  let mockEmbeddingService;
  
  beforeEach(async () => {
    // 各テスト前にモックと最適化モジュールを初期化
    mockDbClient = new MockDbClient();
    mockEmbeddingService = new MockEmbeddingService();
    
    knowledgeOptimizer = new KnowledgeOptimizer({
      dbClient: mockDbClient,
      embeddingService: mockEmbeddingService
    });
    
    // テスト用の知識データをいくつか作成
    await setupTestData();
  });
  
  // テストデータのセットアップ
  async function setupTestData() {
    const knowledgeData = [
      // 重複する可能性のある知識
      {
        id: 'know_tokyo1',
        subject: '東京',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本',
        confidence: 0.95,
        tags: ['地理', '都市', '首都'],
        metadata: {
          source: 'test-data',
          category: '地理'
        }
      },
      {
        id: 'know_tokyo2',
        subject: '東京都',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本国',
        confidence: 0.9,
        tags: ['地理', '都市'],
        metadata: {
          source: 'test-data',
          category: '地理'
        }
      },
      // 矛盾する知識
      {
        id: 'know_fuji1',
        subject: '富士山',
        predicate: '高さ',
        object: '3776メートル',
        confidence: 0.98,
        tags: ['地理', '山'],
        metadata: {
          source: 'test-data',
          category: '地理'
        }
      },
      {
        id: 'know_fuji2',
        subject: '富士山',
        predicate: '高さ',
        object: '3775メートル',
        confidence: 0.85,
        tags: ['地理', '山'],
        metadata: {
          source: 'test-data',
          category: '地理'
        }
      },
      // 古い知識（アクセス頻度が低い）
      {
        id: 'know_old1',
        subject: '江戸',
        predicate: KnowledgeRelationType.IS_A,
        object: '東京の旧称',
        confidence: 0.92,
        tags: ['歴史', '都市'],
        metadata: {
          source: 'test-data',
          category: '歴史',
          created: '2020-01-01'
        }
      },
      // 頻繁にアクセスされる知識
      {
        id: 'know_popular1',
        subject: '寿司',
        predicate: KnowledgeRelationType.IS_A,
        object: '日本料理',
        confidence: 0.99,
        tags: ['食べ物', '文化'],
        metadata: {
          source: 'test-data',
          category: '食文化'
        }
      }
    ];
    
    for (const data of knowledgeData) {
      const knowledge = new Knowledge(data);
      await mockDbClient.insert(knowledge.toJSON());
    }
    
    // 一部の知識に対してアクセスログを作成
    // 人気のある知識は頻繁にアクセス
    for (let i = 0; i < 10; i++) {
      await mockDbClient.findById('know_popular1');
    }
    
    // 古い知識は最終アクセス日時を過去に設定
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 1);
    await mockDbClient.update('know_old1', {
      updated_at: oldDate.toISOString()
    });
    
    const oldLog = await mockDbClient.getAccessLog('know_old1');
    if (oldLog) {
      oldLog.lastAccessed = oldDate.toISOString();
      oldLog.accessCount = 1;
    }
  }
  
  describe('重複検出', () => {
    test('findDuplicateKnowledge()が類似した知識を検出できること', async () => {
      const duplicates = await knowledgeOptimizer.findDuplicateKnowledge({
        similarityThreshold: 0.7
      });
      
      expect(duplicates).toBeDefined();
      expect(Array.isArray(duplicates)).toBe(true);
      expect(duplicates.length).toBeGreaterThan(0);
      
      // 各重複グループが正しい形式であることを確認
      duplicates.forEach(group => {
        expect(group).toHaveProperty('knowledgeList');
        expect(group).toHaveProperty('similarity');
        expect(Array.isArray(group.knowledgeList)).toBe(true);
        expect(group.knowledgeList.length).toBeGreaterThan(1);
        expect(typeof group.similarity).toBe('number');
        expect(group.similarity).toBeGreaterThanOrEqual(0.7);
      });
      
      // 東京に関する重複知識が検出されることを確認
      const hasTokyo = duplicates.some(group => 
        group.knowledgeList.some(k => k.id === 'know_tokyo1') &&
        group.knowledgeList.some(k => k.id === 'know_tokyo2')
      );
      
      expect(hasTokyo).toBe(true);
    });
    
    test('findDuplicateKnowledge()が特定のフィルターで検索できること', async () => {
      const duplicates = await knowledgeOptimizer.findDuplicateKnowledge({
        similarityThreshold: 0.7,
        filters: {
          tags: ['山']
        }
      });
      
      expect(duplicates).toBeDefined();
      expect(Array.isArray(duplicates)).toBe(true);
      
      // 富士山に関する重複知識が検出されることを確認
      const hasFuji = duplicates.some(group => 
        group.knowledgeList.some(k => k.id === 'know_fuji1') &&
        group.knowledgeList.some(k => k.id === 'know_fuji2')
      );
      
      expect(hasFuji).toBe(true);
    });
  });
  
  describe('矛盾検出', () => {
    test('findConflictingKnowledge()が矛盾する知識を検出できること', async () => {
      const conflicts = await knowledgeOptimizer.findConflictingKnowledge();
      
      expect(conflicts).toBeDefined();
      expect(Array.isArray(conflicts)).toBe(true);
      expect(conflicts.length).toBeGreaterThan(0);
      
      // 各矛盾グループが正しい形式であることを確認
      conflicts.forEach(group => {
        expect(group).toHaveProperty('knowledgeList');
        expect(Array.isArray(group.knowledgeList)).toBe(true);
        expect(group.knowledgeList.length).toBeGreaterThan(1);
      });
      
      // 富士山の高さに関する矛盾知識が検出されることを確認
      const hasFujiConflict = conflicts.some(group => 
        group.knowledgeList.some(k => k.id === 'know_fuji1') &&
        group.knowledgeList.some(k => k.id === 'know_fuji2')
      );
      
      expect(hasFujiConflict).toBe(true);
    });
  });
  
  describe('知識の圧縮', () => {
    test('compressKnowledge()が古い知識を圧縮できること', async () => {
      // 現在の日時から1ヶ月前を設定
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const result = await knowledgeOptimizer.compressKnowledge({
        lastAccessedBefore: oneMonthAgo.toISOString(),
        compressionLevel: 'medium'
      });
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('processedCount');
      expect(result).toHaveProperty('compressedCount');
      expect(typeof result.processedCount).toBe('number');
      expect(typeof result.compressedCount).toBe('number');
      
      // 古い知識が圧縮されていることを確認
      const oldKnowledge = await mockDbClient.findById('know_old1');
      expect(oldKnowledge).toBeDefined();
      expect(oldKnowledge.metadata).toHaveProperty('compressed');
      expect(oldKnowledge.metadata.compressed).toBe(true);
    });
    
    test('compressKnowledge()がアクセス頻度の低い知識を圧縮できること', async () => {
      const result = await knowledgeOptimizer.compressKnowledge({
        maxAccessCount: 2,
        compressionLevel: 'high'
      });
      
      expect(result).toBeDefined();
      expect(result.processedCount).toBeGreaterThan(0);
      
      // アクセス頻度の低い知識が圧縮されていることを確認
      const oldKnowledge = await mockDbClient.findById('know_old1');
      expect(oldKnowledge.metadata).toHaveProperty('compressed');
      expect(oldKnowledge.metadata.compressed).toBe(true);
      
      // 人気のある知識は圧縮されていないことを確認
      const popularKnowledge = await mockDbClient.findById('know_popular1');
      expect(popularKnowledge.metadata).not.toHaveProperty('compressed');
    });
  });
  
  describe('知識の最適化', () => {
    test('optimizeKnowledge()が重複と矛盾を解決できること', async () => {
      const result = await knowledgeOptimizer.optimizeKnowledge({
        deduplication: true,
        conflictResolution: true,
        compression: false
      });
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('deduplication');
      expect(result).toHaveProperty('conflictResolution');
      expect(result.deduplication).toHaveProperty('processedGroups');
      expect(result.conflictResolution).toHaveProperty('resolvedConflicts');
      
      // 重複が解決されていることを確認
      expect(result.deduplication.processedGroups).toBeGreaterThan(0);
      
      // 矛盾が解決されていることを確認
      expect(result.conflictResolution.resolvedConflicts).toBeGreaterThan(0);
      
      // 信頼度の低い富士山の知識が削除されていることを確認
      const lowConfidenceFuji = await mockDbClient.findById('know_fuji2');
      expect(lowConfidenceFuji).toBeNull();
      
      // 信頼度の高い富士山の知識は残っていることを確認
      const highConfidenceFuji = await mockDbClient.findById('know_fuji1');
      expect(highConfidenceFuji).toBeDefined();
    });
    
    test('optimizeKnowledge()が圧縮を実行できること', async () => {
      const result = await knowledgeOptimizer.optimizeKnowledge({
        deduplication: false,
        conflictResolution: false,
        compression: true,
        compressionOptions: {
          lastAccessedBefore: new Date().toISOString(),
          maxAccessCount: 5
        }
      });
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('compression');
      expect(result.compression).toHaveProperty('processedCount');
      expect(result.compression).toHaveProperty('compressedCount');
      
      // 圧縮が実行されていることを確認
      expect(result.compression.processedCount).toBeGreaterThan(0);
    });
  });
  
  describe('使用状況分析', () => {
    test('analyzeKnowledgeUsage()が知識の使用状況を分析できること', async () => {
      const analysis = await knowledgeOptimizer.analyzeKnowledgeUsage();
      
      expect(analysis).toBeDefined();
      expect(analysis).toHaveProperty('totalKnowledge');
      expect(analysis).toHaveProperty('typeDistribution');
      expect(analysis).toHaveProperty('tagDistribution');
      expect(analysis).toHaveProperty('accessStatistics');
      expect(analysis).toHaveProperty('confidenceDistribution');
      
      // 総知識数が正しいことを確認
      expect(analysis.totalKnowledge).toBe(6);
      
      // アクセス統計が含まれていることを確認
      expect(analysis.accessStatistics).toHaveProperty('mostAccessed');
      expect(analysis.accessStatistics).toHaveProperty('leastAccessed');
      expect(analysis.accessStatistics).toHaveProperty('averageAccessCount');
      
      // 最もアクセスされた知識が「寿司」であることを確認
      expect(analysis.accessStatistics.mostAccessed[0].id).toBe('know_popular1');
    });
    
    test('analyzeKnowledgeUsage()が特定のフィルターで分析できること', async () => {
      const analysis = await knowledgeOptimizer.analyzeKnowledgeUsage({
        filters: {
          tags: ['地理']
        }
      });
      
      expect(analysis).toBeDefined();
      expect(analysis.totalKnowledge).toBeLessThan(6);
      
      // 「地理」タグを持つ知識のみが分析されていることを確認
      expect(analysis.tagDistribution['地理']).toBeDefined();
    });
  });
  
  describe('エラーハンドリング', () => {
    test('無効なパラメータでfindDuplicateKnowledge()を呼び出すとエラーがスローされること', async () => {
      await expect(knowledgeOptimizer.findDuplicateKnowledge({
        similarityThreshold: -0.1 // 無効な閾値
      })).rejects.toThrow();
      
      await expect(knowledgeOptimizer.findDuplicateKnowledge({
        similarityThreshold: 1.5 // 無効な閾値
      })).rejects.toThrow();
    });
    
    test('無効なパラメータでcompressKnowledge()を呼び出すとエラーがスローされること', async () => {
      await expect(knowledgeOptimizer.compressKnowledge({
        compressionLevel: 'invalid_level' // 無効な圧縮レベル
      })).rejects.toThrow();
    });
  });
});
