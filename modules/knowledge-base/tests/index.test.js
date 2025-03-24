/**
 * @fileoverview 知識ベースモジュールのエントリーポイントのテスト
 * 
 * このファイルでは、知識ベースモジュールの統合機能と
 * 外部インターフェースをテストします。
 */

import { KnowledgeBase } from '../src/index.js';
import { KnowledgeRelationType } from '../src/knowledge-model.js';

// モックデータベースクライアント
class MockDbClient {
  constructor() {
    this.knowledgeStore = new Map();
    this.accessLog = new Map();
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
      
      if (query.subject && knowledge.subject !== query.subject) {
        match = false;
      }
      
      if (query.predicate && knowledge.predicate !== query.predicate) {
        match = false;
      }
      
      if (query.object && knowledge.object !== query.object) {
        match = false;
      }
      
      if (query.tags && query.tags.length > 0) {
        const hasAllTags = query.tags.every(tag => knowledge.tags.includes(tag));
        if (!hasAllTags) match = false;
      }
      
      if (query.minConfidence && knowledge.confidence < query.minConfidence) {
        match = false;
      }
      
      if (match) {
        results.push(knowledge);
        
        const log = this.accessLog.get(knowledge.id) || { accessCount: 0 };
        log.lastAccessed = new Date().toISOString();
        log.accessCount += 1;
        this.accessLog.set(knowledge.id, log);
      }
    }
    
    return results;
  }
  
  async vectorSearch(embedding, limit, filters) {
    const queryText = embedding._mockQueryText || '';
    const results = [];
    
    for (const knowledge of this.knowledgeStore.values()) {
      if (filters) {
        let passesFilter = true;
        
        if (filters.subject && knowledge.subject !== filters.subject) {
          passesFilter = false;
        }
        
        if (filters.predicate && knowledge.predicate !== filters.predicate) {
          passesFilter = false;
        }
        
        if (filters.object && knowledge.object !== filters.object) {
          passesFilter = false;
        }
        
        if (filters.tags && filters.tags.length > 0) {
          const hasAllTags = filters.tags.every(tag => knowledge.tags.includes(tag));
          if (!hasAllTags) passesFilter = false;
        }
        
        if (!passesFilter) continue;
      }
      
      const contentText = `${knowledge.subject} ${knowledge.predicate} ${knowledge.object}`;
      const score = this.calculateMockSimilarity(queryText, contentText);
      
      results.push({
        knowledge,
        score
      });
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit || results.length);
  }
  
  calculateMockSimilarity(text1, text2) {
    text1 = text1.toLowerCase();
    text2 = text2.toLowerCase();
    
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    let matchCount = 0;
    for (const word of words1) {
      if (words2.includes(word)) {
        matchCount++;
      }
    }
    
    const baseScore = 0.2 + (matchCount / Math.max(words1.length, 1)) * 0.7;
    return baseScore + (Math.random() * 0.1);
  }
  
  async getAllAccessLogs() {
    const logs = {};
    for (const [id, log] of this.accessLog.entries()) {
      logs[id] = log;
    }
    return logs;
  }
}

// モックキャッシュクライアント
class MockCacheClient {
  constructor() {
    this.cache = new Map();
    this.ttlMap = new Map();
  }
  
  async get(key) {
    if (this.ttlMap.has(key)) {
      const expiryTime = this.ttlMap.get(key);
      if (Date.now() > expiryTime) {
        this.cache.delete(key);
        this.ttlMap.delete(key);
        return null;
      }
    }
    
    return this.cache.get(key) || null;
  }
  
  async set(key, value, ttl = 60) {
    this.cache.set(key, value);
    
    if (ttl) {
      const expiryTime = Date.now() + (ttl * 1000);
      this.ttlMap.set(key, expiryTime);
    }
    
    return true;
  }
  
  async delete(key) {
    this.ttlMap.delete(key);
    return this.cache.delete(key);
  }
  
  async flush() {
    this.cache.clear();
    this.ttlMap.clear();
    return true;
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
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const uniqueWords = [...new Set([...words1, ...words2])];
    
    return commonWords.length / Math.max(uniqueWords.length, 1);
  }
}

describe('Knowledge Base Module Tests', () => {
  let knowledgeBase;
  let mockDbClient;
  let mockCacheClient;
  let mockEmbeddingService;
  
  beforeEach(async () => {
    // 各テスト前にモックとモジュールを初期化
    mockDbClient = new MockDbClient();
    mockCacheClient = new MockCacheClient();
    mockEmbeddingService = new MockEmbeddingService();
    
    knowledgeBase = new KnowledgeBase({
      dbClient: mockDbClient,
      cacheClient: mockCacheClient,
      embeddingService: mockEmbeddingService
    });
    
    // テスト用の知識データをいくつか作成
    await setupTestData();
  });
  
  // テストデータのセットアップ
  async function setupTestData() {
    const knowledgeData = [
      {
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
        subject: '大阪',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本',
        confidence: 0.95,
        tags: ['地理', '都市'],
        metadata: {
          source: 'test-data',
          category: '地理'
        }
      },
      {
        subject: '富士山',
        predicate: '高さ',
        object: '3776メートル',
        confidence: 0.98,
        tags: ['地理', '自然', '山'],
        metadata: {
          source: 'test-data',
          category: '地理'
        }
      },
      {
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
      await knowledgeBase.createKnowledge(data);
    }
  }
  
  describe('Knowledge Management', () => {
    test('createKnowledge()が正しく知識を作成し、IDを返すこと', async () => {
      const knowledgeData = {
        subject: '京都',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本',
        confidence: 0.95,
        tags: ['地理', '都市', '歴史'],
        metadata: {
          source: 'unit-test',
          category: '地理'
        }
      };
      
      const knowledgeId = await knowledgeBase.createKnowledge(knowledgeData);
      
      expect(knowledgeId).toBeDefined();
      expect(typeof knowledgeId).toBe('string');
      expect(knowledgeId).toMatch(/^know_[a-f0-9]+$/);
      
      const knowledge = await knowledgeBase.getKnowledge(knowledgeId);
      expect(knowledge).toBeDefined();
      expect(knowledge.subject).toBe(knowledgeData.subject);
      expect(knowledge.predicate).toBe(knowledgeData.predicate);
      expect(knowledge.object).toBe(knowledgeData.object);
    });
    
    test('updateKnowledge()が正しく知識を更新すること', async () => {
      // まず知識を作成
      const knowledgeData = {
        subject: '名古屋',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本',
        confidence: 0.95,
        tags: ['地理', '都市']
      };
      
      const knowledgeId = await knowledgeBase.createKnowledge(knowledgeData);
      
      // 更新データ
      const updateData = {
        object: '愛知県',
        confidence: 0.98,
        tags: ['地理', '都市', '中部地方']
      };
      
      const updatedKnowledge = await knowledgeBase.updateKnowledge(knowledgeId, updateData);
      
      expect(updatedKnowledge).toBeDefined();
      expect(updatedKnowledge.id).toBe(knowledgeId);
      expect(updatedKnowledge.subject).toBe(knowledgeData.subject);
      expect(updatedKnowledge.predicate).toBe(knowledgeData.predicate);
      expect(updatedKnowledge.object).toBe(updateData.object);
      expect(updatedKnowledge.confidence).toBe(updateData.confidence);
      expect(updatedKnowledge.tags).toEqual(updateData.tags);
    });
    
    test('deleteKnowledge()が正しく知識を削除すること', async () => {
      // まず知識を作成
      const knowledgeData = {
        subject: '札幌',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '北海道',
        confidence: 0.95
      };
      
      const knowledgeId = await knowledgeBase.createKnowledge(knowledgeData);
      
      const result = await knowledgeBase.deleteKnowledge(knowledgeId);
      expect(result).toBe(true);
      
      const knowledge = await knowledgeBase.getKnowledge(knowledgeId);
      expect(knowledge).toBeNull();
    });
  });
  
  describe('Knowledge Search', () => {
    test('searchKnowledge()がテキスト検索を実行できること', async () => {
      const results = await knowledgeBase.searchKnowledge({
        query: '日本 都市',
        limit: 5
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 各結果がスコアを持つことを確認
      results.forEach(result => {
        expect(result).toHaveProperty('knowledge');
        expect(result).toHaveProperty('score');
      });
      
      // 「日本」や「都市」に関連する知識が含まれることを確認
      const hasJapanCity = results.some(result => 
        (result.knowledge.subject === '東京' || result.knowledge.subject === '大阪') &&
        result.knowledge.object === '日本'
      );
      
      expect(hasJapanCity).toBe(true);
    });
    
    test('searchKnowledge()がセマンティック検索を実行できること', async () => {
      const results = await knowledgeBase.searchKnowledge({
        semanticQuery: '日本の名所',
        limit: 3
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });
    
    test('searchKnowledge()がフィルターを適用できること', async () => {
      const results = await knowledgeBase.searchKnowledge({
        query: '日本',
        filters: {
          tags: ['自然']
        }
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // すべての結果が「自然」タグを持つことを確認
      results.forEach(result => {
        expect(result.knowledge.tags).toContain('自然');
      });
    });
    
    test('findRelatedKnowledge()が関連知識を返すこと', async () => {
      // まず、東京に関する知識を取得
      const tokyoResults = await knowledgeBase.searchKnowledge({
        query: '東京',
        limit: 1
      });
      
      expect(tokyoResults.length).toBe(1);
      const tokyoKnowledge = tokyoResults[0].knowledge;
      
      // 関連知識を検索
      const relatedResults = await knowledgeBase.findRelatedKnowledge({
        knowledgeId: tokyoKnowledge.id,
        limit: 3
      });
      
      expect(relatedResults).toBeDefined();
      expect(Array.isArray(relatedResults)).toBe(true);
      expect(relatedResults.length).toBeGreaterThan(0);
      
      // 関連知識が元の知識と異なることを確認
      relatedResults.forEach(result => {
        expect(result.knowledge.id).not.toBe(tokyoKnowledge.id);
      });
      
      // 日本に関連する他の知識が含まれることを確認
      const hasRelatedJapan = relatedResults.some(result => 
        result.knowledge.object === '日本' && 
        result.knowledge.subject !== '東京'
      );
      
      expect(hasRelatedJapan).toBe(true);
    });
  });
  
  describe('Knowledge Optimization', () => {
    // 重複する知識を追加
    beforeEach(async () => {
      await knowledgeBase.createKnowledge({
        subject: '東京都',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本国',
        confidence: 0.9,
        tags: ['地理', '都市']
      });
      
      await knowledgeBase.createKnowledge({
        subject: '富士山',
        predicate: '高さ',
        object: '3775メートル',
        confidence: 0.85,
        tags: ['地理', '山']
      });
    });
    
    test('findDuplicateKnowledge()が重複知識を検出できること', async () => {
      const duplicates = await knowledgeBase.findDuplicateKnowledge({
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
      });
    });
    
    test('findConflictingKnowledge()が矛盾知識を検出できること', async () => {
      const conflicts = await knowledgeBase.findConflictingKnowledge();
      
      expect(conflicts).toBeDefined();
      expect(Array.isArray(conflicts)).toBe(true);
      expect(conflicts.length).toBeGreaterThan(0);
      
      // 富士山の高さに関する矛盾知識が検出されることを確認
      const hasFujiConflict = conflicts.some(group => 
        group.knowledgeList.some(k => k.subject === '富士山' && k.predicate === '高さ')
      );
      
      expect(hasFujiConflict).toBe(true);
    });
    
    test('optimizeKnowledge()が知識を最適化できること', async () => {
      const result = await knowledgeBase.optimizeKnowledge({
        deduplication: true,
        conflictResolution: true,
        compression: false
      });
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('deduplication');
      expect(result).toHaveProperty('conflictResolution');
      
      // 重複と矛盾が解決されていることを確認
      expect(result.deduplication.processedGroups).toBeGreaterThan(0);
      expect(result.conflictResolution.resolvedConflicts).toBeGreaterThan(0);
    });
    
    test('analyzeKnowledgeUsage()が使用状況を分析できること', async () => {
      const analysis = await knowledgeBase.analyzeKnowledgeUsage();
      
      expect(analysis).toBeDefined();
      expect(analysis).toHaveProperty('totalKnowledge');
      expect(analysis).toHaveProperty('typeDistribution');
      expect(analysis).toHaveProperty('tagDistribution');
      expect(analysis).toHaveProperty('accessStatistics');
      
      // 総知識数が正しいことを確認
      expect(analysis.totalKnowledge).toBeGreaterThan(0);
    });
  });
  
  describe('Bulk Operations', () => {
    test('bulkCreateKnowledge()が複数の知識を一括で作成できること', async () => {
      const knowledgeDataList = [
        {
          subject: '北海道',
          predicate: KnowledgeRelationType.LOCATED_IN,
          object: '日本',
          confidence: 0.95,
          tags: ['地理', '地域']
        },
        {
          subject: '九州',
          predicate: KnowledgeRelationType.LOCATED_IN,
          object: '日本',
          confidence: 0.95,
          tags: ['地理', '地域']
        }
      ];
      
      const result = await knowledgeBase.bulkCreateKnowledge(knowledgeDataList);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      
      // 作成された知識のIDが返されることを確認
      result.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^know_[a-f0-9]+$/);
      });
      
      // 実際に知識が作成されていることを確認
      const knowledge1 = await knowledgeBase.getKnowledge(result[0]);
      const knowledge2 = await knowledgeBase.getKnowledge(result[1]);
      
      expect(knowledge1).toBeDefined();
      expect(knowledge2).toBeDefined();
    });
    
    test('bulkDeleteKnowledge()が複数の知識を一括で削除できること', async () => {
      // まず、複数の知識を作成
      const knowledgeDataList = [
        {
          subject: '四国',
          predicate: KnowledgeRelationType.LOCATED_IN,
          object: '日本',
          confidence: 0.95
        },
        {
          subject: '沖縄',
          predicate: KnowledgeRelationType.LOCATED_IN,
          object: '日本',
          confidence: 0.95
        }
      ];
      
      const ids = await knowledgeBase.bulkCreateKnowledge(knowledgeDataList);
      
      // 一括削除を実行
      const result = await knowledgeBase.bulkDeleteKnowledge(ids);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('failed');
      expect(result.success).toBe(ids.length);
      expect(result.failed).toBe(0);
      
      // 実際に削除されていることを確認
      for (const id of ids) {
        const knowledge = await knowledgeBase.getKnowledge(id);
        expect(knowledge).toBeNull();
      }
    });
  });
  
  describe('Error Handling', () => {
    test('無効なデータでcreateKnowledge()を呼び出すとエラーがスローされること', async () => {
      const invalidData = {
        // subjectが欠けている
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本'
      };
      
      await expect(knowledgeBase.createKnowledge(invalidData)).rejects.toThrow();
    });
    
    test('存在しないIDでgetKnowledge()を呼び出すとnullが返されること', async () => {
      const knowledge = await knowledgeBase.getKnowledge('know_nonexistent');
      expect(knowledge).toBeNull();
    });
    
    test('存在しないIDでupdateKnowledge()を呼び出すとnullが返されること', async () => {
      const updatedKnowledge = await knowledgeBase.updateKnowledge('know_nonexistent', { object: '更新データ' });
      expect(updatedKnowledge).toBeNull();
    });
    
    test('存在しないIDでdeleteKnowledge()を呼び出すとfalseが返されること', async () => {
      const result = await knowledgeBase.deleteKnowledge('know_nonexistent');
      expect(result).toBe(false);
    });
  });
  
  describe('Integration Tests', () => {
    test('知識の作成、検索、更新、削除の一連の流れが正しく動作すること', async () => {
      // 1. 知識の作成
      const knowledgeData = {
        subject: '新幹線',
        predicate: KnowledgeRelationType.IS_A,
        object: '高速鉄道',
        confidence: 0.97,
        tags: ['交通', '技術'],
        metadata: {
          source: 'integration-test',
          category: '交通'
        }
      };
      
      const knowledgeId = await knowledgeBase.createKnowledge(knowledgeData);
      expect(knowledgeId).toBeDefined();
      
      // 2. 知識の検索
      const searchResults = await knowledgeBase.searchKnowledge({
        query: '新幹線 鉄道',
        limit: 3
      });
      
      expect(searchResults.length).toBeGreaterThan(0);
      const foundKnowledge = searchResults.find(result => result.knowledge.id === knowledgeId);
      expect(foundKnowledge).toBeDefined();
      
      // 3. 知識の更新
      const updateData = {
        object: '日本の高速鉄道',
        confidence: 0.99,
        tags: ['交通', '技術', '日本']
      };
      
      const updatedKnowledge = await knowledgeBase.updateKnowledge(knowledgeId, updateData);
      expect(updatedKnowledge).toBeDefined();
      expect(updatedKnowledge.object).toBe(updateData.object);
      
      // 4. 更新された知識の検索
      const newSearchResults = await knowledgeBase.searchKnowledge({
        query: '日本 鉄道',
        limit: 3
      });
      
      const newFoundKnowledge = newSearchResults.find(result => result.knowledge.id === knowledgeId);
      expect(newFoundKnowledge).toBeDefined();
      expect(newFoundKnowledge.knowledge.object).toBe(updateData.object);
      
      // 5. 知識の削除
      const deleteResult = await knowledgeBase.deleteKnowledge(knowledgeId);
      expect(deleteResult).toBe(true);
      
      // 6. 削除の確認
      const deletedKnowledge = await knowledgeBase.getKnowledge(knowledgeId);
      expect(deletedKnowledge).toBeNull();
    });
    
    test('知識の最適化と分析の統合フローが正しく動作すること', async () => {
      // 1. 重複する知識を作成
      await knowledgeBase.createKnowledge({
        subject: '東京タワー',
        predicate: '高さ',
        object: '333メートル',
        confidence: 0.95,
        tags: ['建物', '観光']
      });
      
      await knowledgeBase.createKnowledge({
        subject: '東京タワー',
        predicate: '高さ',
        object: '約330メートル',
        confidence: 0.85,
        tags: ['建物', '東京']
      });
      
      // 2. 重複知識の検出
      const duplicates = await knowledgeBase.findDuplicateKnowledge({
        similarityThreshold: 0.7
      });
      
      expect(duplicates.length).toBeGreaterThan(0);
      
      // 3. 知識の最適化
      const optimizeResult = await knowledgeBase.optimizeKnowledge({
        deduplication: true,
        conflictResolution: true
      });
      
      expect(optimizeResult).toBeDefined();
      expect(optimizeResult.deduplication.processedGroups).toBeGreaterThan(0);
      
      // 4. 使用状況の分析
      const analysis = await knowledgeBase.analyzeKnowledgeUsage();
      expect(analysis).toBeDefined();
      expect(analysis.totalKnowledge).toBeGreaterThan(0);
      
      // 5. 最適化後の検索
      const searchResults = await knowledgeBase.searchKnowledge({
        query: '東京タワー',
        limit: 2
      });
      
      // 最適化により、重複が解消されていることを確認
      const tokyoTowerResults = searchResults.filter(result => 
        result.knowledge.subject === '東京タワー' && 
        result.knowledge.predicate === '高さ'
      );
      
      // 信頼度の高い方が残っていることを確認
      expect(tokyoTowerResults.length).toBe(1);
      expect(tokyoTowerResults[0].knowledge.object).toBe('333メートル');
    });
  });
});
