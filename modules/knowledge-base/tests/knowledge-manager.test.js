/**
 * @fileoverview 知識ベースマネージャーのテスト
 * 
 * このファイルでは、知識ベースマネージャーの基本的なCRUD操作と
 * キャッシュ機能のテストを実施します。
 */

import { KnowledgeManager } from '../src/knowledge-manager.js';
import { Knowledge, KnowledgeRelationType } from '../src/knowledge-model.js';

// モックデータベースクライアント
class MockDbClient {
  constructor() {
    this.knowledgeStore = new Map();
  }
  
  async insert(knowledge) {
    this.knowledgeStore.set(knowledge.id, { ...knowledge });
    return knowledge.id;
  }
  
  async findById(id) {
    return this.knowledgeStore.get(id) || null;
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
      
      if (match) results.push(knowledge);
    }
    
    return results;
  }
}

// モックキャッシュクライアント
class MockCacheClient {
  constructor() {
    this.cache = new Map();
    this.ttlMap = new Map();
  }
  
  async get(key) {
    // TTLが切れているかチェック
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
    
    // TTLを設定（秒単位）
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

describe('Knowledge Manager Tests', () => {
  let knowledgeManager;
  let mockDbClient;
  let mockCacheClient;
  
  beforeEach(() => {
    // 各テスト前にモックとマネージャーを初期化
    mockDbClient = new MockDbClient();
    mockCacheClient = new MockCacheClient();
    
    knowledgeManager = new KnowledgeManager({
      dbClient: mockDbClient,
      cacheClient: mockCacheClient
    });
  });
  
  // テスト用知識データ
  const testKnowledgeData = {
    subject: '京都',
    predicate: KnowledgeRelationType.LOCATED_IN,
    object: '日本',
    confidence: 0.95,
    tags: ['地理', '都市'],
    metadata: {
      source: 'unit-test',
      category: '地理'
    }
  };
  
  describe('CRUD Operations', () => {
    test('createKnowledge()が正しく知識を作成し、IDを返すこと', async () => {
      const knowledgeId = await knowledgeManager.createKnowledge(testKnowledgeData);
      
      expect(knowledgeId).toBeDefined();
      expect(typeof knowledgeId).toBe('string');
      expect(knowledgeId).toMatch(/^know_[a-f0-9]+$/);
      
      // データベースに保存されていることを確認
      const savedKnowledge = await mockDbClient.findById(knowledgeId);
      expect(savedKnowledge).toBeDefined();
      expect(savedKnowledge.subject).toBe(testKnowledgeData.subject);
      expect(savedKnowledge.predicate).toBe(testKnowledgeData.predicate);
      expect(savedKnowledge.object).toBe(testKnowledgeData.object);
    });
    
    test('getKnowledge()が正しく知識を取得できること', async () => {
      // まず知識を作成
      const knowledgeId = await knowledgeManager.createKnowledge(testKnowledgeData);
      
      // 知識を取得
      const knowledge = await knowledgeManager.getKnowledge(knowledgeId);
      
      expect(knowledge).toBeDefined();
      expect(knowledge).toBeInstanceOf(Knowledge);
      expect(knowledge.id).toBe(knowledgeId);
      expect(knowledge.subject).toBe(testKnowledgeData.subject);
      expect(knowledge.predicate).toBe(testKnowledgeData.predicate);
      expect(knowledge.object).toBe(testKnowledgeData.object);
      expect(knowledge.confidence).toBe(testKnowledgeData.confidence);
      expect(knowledge.tags).toEqual(testKnowledgeData.tags);
      expect(knowledge.metadata).toEqual(testKnowledgeData.metadata);
    });
    
    test('updateKnowledge()が正しく知識を更新できること', async () => {
      // まず知識を作成
      const knowledgeId = await knowledgeManager.createKnowledge(testKnowledgeData);
      
      // 更新データ
      const updateData = {
        object: '関西地方',
        confidence: 0.98,
        tags: ['更新', '地理', '都市']
      };
      
      // 知識を更新
      const updatedKnowledge = await knowledgeManager.updateKnowledge(knowledgeId, updateData);
      
      expect(updatedKnowledge).toBeDefined();
      expect(updatedKnowledge).toBeInstanceOf(Knowledge);
      expect(updatedKnowledge.id).toBe(knowledgeId);
      expect(updatedKnowledge.subject).toBe(testKnowledgeData.subject);
      expect(updatedKnowledge.predicate).toBe(testKnowledgeData.predicate);
      expect(updatedKnowledge.object).toBe(updateData.object);
      expect(updatedKnowledge.confidence).toBe(updateData.confidence);
      expect(updatedKnowledge.tags).toEqual(updateData.tags);
      
      // データベースが更新されていることを確認
      const savedKnowledge = await mockDbClient.findById(knowledgeId);
      expect(savedKnowledge.object).toBe(updateData.object);
    });
    
    test('deleteKnowledge()が正しく知識を削除できること', async () => {
      // まず知識を作成
      const knowledgeId = await knowledgeManager.createKnowledge(testKnowledgeData);
      
      // 知識を削除
      const result = await knowledgeManager.deleteKnowledge(knowledgeId);
      
      expect(result).toBe(true);
      
      // データベースから削除されていることを確認
      const deletedKnowledge = await mockDbClient.findById(knowledgeId);
      expect(deletedKnowledge).toBeNull();
    });
  });
  
  describe('Query Operations', () => {
    beforeEach(async () => {
      // テスト用の知識データをいくつか作成
      await knowledgeManager.createKnowledge({
        subject: '東京',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本',
        confidence: 0.95,
        tags: ['地理', '都市', '首都']
      });
      
      await knowledgeManager.createKnowledge({
        subject: '大阪',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本',
        confidence: 0.95,
        tags: ['地理', '都市']
      });
      
      await knowledgeManager.createKnowledge({
        subject: '東京',
        predicate: KnowledgeRelationType.HAS_PROPERTY,
        object: '人口が多い',
        confidence: 0.9,
        tags: ['特性', '都市']
      });
      
      await knowledgeManager.createKnowledge({
        subject: '富士山',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本',
        confidence: 0.98,
        tags: ['地理', '自然', '山']
      });
    });
    
    test('findKnowledge()が主語で正しく知識を検索できること', async () => {
      const results = await knowledgeManager.findKnowledge({
        subject: '東京'
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      
      // すべての結果が「東京」を主語に持つことを確認
      results.forEach(knowledge => {
        expect(knowledge).toBeInstanceOf(Knowledge);
        expect(knowledge.subject).toBe('東京');
      });
    });
    
    test('findKnowledge()が述語で正しく知識を検索できること', async () => {
      const results = await knowledgeManager.findKnowledge({
        predicate: KnowledgeRelationType.LOCATED_IN
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
      
      // すべての結果がLOCATED_INを述語に持つことを確認
      results.forEach(knowledge => {
        expect(knowledge).toBeInstanceOf(Knowledge);
        expect(knowledge.predicate).toBe(KnowledgeRelationType.LOCATED_IN);
      });
    });
    
    test('findKnowledge()が目的語で正しく知識を検索できること', async () => {
      const results = await knowledgeManager.findKnowledge({
        object: '日本'
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
      
      // すべての結果が「日本」を目的語に持つことを確認
      results.forEach(knowledge => {
        expect(knowledge).toBeInstanceOf(Knowledge);
        expect(knowledge.object).toBe('日本');
      });
    });
    
    test('findKnowledge()が複合条件で正しく知識を検索できること', async () => {
      const results = await knowledgeManager.findKnowledge({
        subject: '東京',
        predicate: KnowledgeRelationType.LOCATED_IN
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
      
      const knowledge = results[0];
      expect(knowledge.subject).toBe('東京');
      expect(knowledge.predicate).toBe(KnowledgeRelationType.LOCATED_IN);
      expect(knowledge.object).toBe('日本');
    });
    
    test('findKnowledge()がタグで正しく知識を検索できること', async () => {
      const results = await knowledgeManager.findKnowledge({
        tags: ['自然']
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
      
      const knowledge = results[0];
      expect(knowledge.subject).toBe('富士山');
      expect(knowledge.tags).toContain('自然');
    });
    
    test('findKnowledge()が信頼度の閾値で正しく知識を検索できること', async () => {
      const results = await knowledgeManager.findKnowledge({
        minConfidence: 0.95
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // すべての結果が信頼度0.95以上であることを確認
      results.forEach(knowledge => {
        expect(knowledge.confidence).toBeGreaterThanOrEqual(0.95);
      });
    });
  });
  
  describe('Caching', () => {
    test('getKnowledge()がキャッシュを利用すること', async () => {
      // まず知識を作成
      const knowledgeId = await knowledgeManager.createKnowledge(testKnowledgeData);
      
      // キャッシュが設定されていないことを確認
      const initialCache = await mockCacheClient.get(`knowledge:${knowledgeId}`);
      expect(initialCache).toBeNull();
      
      // 1回目の取得（データベースから取得してキャッシュに保存）
      const knowledge1 = await knowledgeManager.getKnowledge(knowledgeId);
      expect(knowledge1).toBeDefined();
      
      // キャッシュが設定されていることを確認
      const cachedData = await mockCacheClient.get(`knowledge:${knowledgeId}`);
      expect(cachedData).toBeDefined();
      
      // データベースのデータを変更（キャッシュは更新しない）
      await mockDbClient.update(knowledgeId, { object: '変更されたデータ' });
      
      // 2回目の取得（キャッシュから取得）
      const knowledge2 = await knowledgeManager.getKnowledge(knowledgeId);
      
      // キャッシュから取得したデータはデータベースの変更を反映していないはず
      expect(knowledge2.object).toBe(testKnowledgeData.object);
      expect(knowledge2.object).not.toBe('変更されたデータ');
    });
    
    test('updateKnowledge()がキャッシュを更新すること', async () => {
      // まず知識を作成
      const knowledgeId = await knowledgeManager.createKnowledge(testKnowledgeData);
      
      // 1回目の取得（キャッシュに保存）
      await knowledgeManager.getKnowledge(knowledgeId);
      
      // 更新データ
      const updateData = {
        object: '更新された目的語',
        confidence: 0.99
      };
      
      // 知識を更新
      await knowledgeManager.updateKnowledge(knowledgeId, updateData);
      
      // 更新後に取得（キャッシュが更新されているはず）
      const updatedKnowledge = await knowledgeManager.getKnowledge(knowledgeId);
      
      expect(updatedKnowledge.object).toBe(updateData.object);
      expect(updatedKnowledge.confidence).toBe(updateData.confidence);
    });
    
    test('deleteKnowledge()がキャッシュを削除すること', async () => {
      // まず知識を作成
      const knowledgeId = await knowledgeManager.createKnowledge(testKnowledgeData);
      
      // 1回目の取得（キャッシュに保存）
      await knowledgeManager.getKnowledge(knowledgeId);
      
      // キャッシュが設定されていることを確認
      const cachedData = await mockCacheClient.get(`knowledge:${knowledgeId}`);
      expect(cachedData).toBeDefined();
      
      // 知識を削除
      await knowledgeManager.deleteKnowledge(knowledgeId);
      
      // キャッシュが削除されていることを確認
      const deletedCache = await mockCacheClient.get(`knowledge:${knowledgeId}`);
      expect(deletedCache).toBeNull();
    });
    
    test('キャッシュのTTLが正しく機能すること', async () => {
      // TTLを短く設定したマネージャーを作成
      const shortTtlManager = new KnowledgeManager({
        dbClient: mockDbClient,
        cacheClient: mockCacheClient,
        cacheTtl: 1 // 1秒
      });
      
      // 知識を作成
      const knowledgeId = await shortTtlManager.createKnowledge(testKnowledgeData);
      
      // 1回目の取得（キャッシュに保存）
      await shortTtlManager.getKnowledge(knowledgeId);
      
      // キャッシュが設定されていることを確認
      const cachedData = await mockCacheClient.get(`knowledge:${knowledgeId}`);
      expect(cachedData).toBeDefined();
      
      // TTLが切れるのを待つ
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // キャッシュが期限切れになっていることを確認
      const expiredCache = await mockCacheClient.get(`knowledge:${knowledgeId}`);
      expect(expiredCache).toBeNull();
    });
  });
  
  describe('Error Handling', () => {
    test('無効なデータでcreateKnowledge()を呼び出すとエラーがスローされること', async () => {
      const invalidData = {
        // subjectが欠けている
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本'
      };
      
      await expect(knowledgeManager.createKnowledge(invalidData)).rejects.toThrow();
    });
    
    test('存在しないIDでgetKnowledge()を呼び出すとnullが返されること', async () => {
      const knowledge = await knowledgeManager.getKnowledge('know_nonexistent');
      expect(knowledge).toBeNull();
    });
    
    test('存在しないIDでupdateKnowledge()を呼び出すとnullが返されること', async () => {
      const updatedKnowledge = await knowledgeManager.updateKnowledge('know_nonexistent', { object: '更新データ' });
      expect(updatedKnowledge).toBeNull();
    });
    
    test('存在しないIDでdeleteKnowledge()を呼び出すとfalseが返されること', async () => {
      const result = await knowledgeManager.deleteKnowledge('know_nonexistent');
      expect(result).toBe(false);
    });
  });
});
