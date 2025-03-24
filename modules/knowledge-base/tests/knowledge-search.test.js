/**
 * @fileoverview 知識ベース検索機能のテスト
 * 
 * このファイルでは、知識ベースの検索機能をテストします。
 * テキスト検索、セマンティック検索、メタデータフィルタリングなどの
 * 機能が含まれます。
 */

import { KnowledgeSearch } from '../src/knowledge-search.js';
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
      
      // メタデータのフィルタリング
      if (query.metadata) {
        for (const [key, value] of Object.entries(query.metadata)) {
          if (!knowledge.metadata || knowledge.metadata[key] !== value) {
            match = false;
            break;
          }
        }
      }
      
      if (match) results.push(knowledge);
    }
    
    return results;
  }
  
  async vectorSearch(embedding, limit, filters) {
    // 簡易的なベクトル検索シミュレーション
    const queryText = embedding._mockQueryText || '';
    const results = [];
    
    for (const knowledge of this.knowledgeStore.values()) {
      // フィルターチェック
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
      
      // 簡易的な類似度計算
      const contentText = `${knowledge.subject} ${knowledge.predicate} ${knowledge.object}`;
      const score = this.calculateMockSimilarity(queryText, contentText);
      
      results.push({
        knowledge,
        score
      });
    }
    
    // スコアでソート
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit || results.length);
  }
  
  // モック用の簡易的な類似度計算
  calculateMockSimilarity(text1, text2) {
    text1 = text1.toLowerCase();
    text2 = text2.toLowerCase();
    
    // 単語の重複に基づく簡易的な類似度計算
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    let matchCount = 0;
    for (const word of words1) {
      if (words2.includes(word)) {
        matchCount++;
      }
    }
    
    // 基本スコアは0.2〜0.9の範囲
    const baseScore = 0.2 + (matchCount / Math.max(words1.length, 1)) * 0.7;
    
    // ランダム性を追加して、より現実的な結果をシミュレート
    return baseScore + (Math.random() * 0.1);
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
    
    return commonWords.length / uniqueWords.length;
  }
}

describe('Knowledge Search Tests', () => {
  let knowledgeSearch;
  let mockDbClient;
  let mockEmbeddingService;
  
  beforeEach(async () => {
    // 各テスト前にモックと検索モジュールを初期化
    mockDbClient = new MockDbClient();
    mockEmbeddingService = new MockEmbeddingService();
    
    knowledgeSearch = new KnowledgeSearch({
      dbClient: mockDbClient,
      embeddingService: mockEmbeddingService
    });
    
    // テスト用の知識データをいくつか作成
    await setupTestData();
  });
  
  // テストデータのセットアップ
  async function setupTestData() {
    const knowledgeData = [
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
        subject: '東京',
        predicate: KnowledgeRelationType.HAS_PROPERTY,
        object: '人口が多い',
        confidence: 0.9,
        tags: ['特性', '都市'],
        metadata: {
          source: 'test-data',
          category: '人口統計'
        }
      },
      {
        id: 'know_osaka',
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
        id: 'know_fuji',
        subject: '富士山',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本',
        confidence: 0.98,
        tags: ['地理', '自然', '山'],
        metadata: {
          source: 'test-data',
          category: '地理'
        }
      },
      {
        id: 'know_shinkansen',
        subject: '新幹線',
        predicate: KnowledgeRelationType.IS_A,
        object: '高速鉄道',
        confidence: 0.97,
        tags: ['交通', '技術'],
        metadata: {
          source: 'test-data',
          category: '交通'
        }
      },
      {
        id: 'know_sushi',
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
  }
  
  describe('テキスト検索', () => {
    test('searchByText()が正しくテキスト検索を実行できること', async () => {
      const results = await knowledgeSearch.searchByText({
        query: '日本 都市',
        limit: 5
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 各結果が知識オブジェクトとスコアを持つことを確認
      results.forEach(result => {
        expect(result).toHaveProperty('knowledge');
        expect(result).toHaveProperty('score');
        expect(result.knowledge).toBeDefined();
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
      
      // 「日本」や「都市」に関連する知識が上位に来ることを期待
      const topResult = results[0];
      expect(['東京', '大阪', '日本']).toContain(topResult.knowledge.subject);
    });
    
    test('searchByText()がフィルターを適用できること', async () => {
      const results = await knowledgeSearch.searchByText({
        query: '日本',
        filters: {
          tags: ['自然']
        },
        limit: 3
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // すべての結果が「自然」タグを持つことを確認
      results.forEach(result => {
        expect(result.knowledge.tags).toContain('自然');
      });
      
      // 富士山の知識が含まれることを期待
      const hasFuji = results.some(result => result.knowledge.subject === '富士山');
      expect(hasFuji).toBe(true);
    });
    
    test('searchByText()が複合フィルターを適用できること', async () => {
      const results = await knowledgeSearch.searchByText({
        query: '日本',
        filters: {
          predicate: KnowledgeRelationType.LOCATED_IN,
          tags: ['都市']
        }
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // すべての結果がLOCATED_IN述語と「都市」タグを持つことを確認
      results.forEach(result => {
        expect(result.knowledge.predicate).toBe(KnowledgeRelationType.LOCATED_IN);
        expect(result.knowledge.tags).toContain('都市');
      });
    });
  });
  
  describe('セマンティック検索', () => {
    test('searchSemantic()が正しくセマンティック検索を実行できること', async () => {
      const results = await knowledgeSearch.searchSemantic({
        query: '日本の有名な観光地',
        limit: 3
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 各結果が知識オブジェクトとスコアを持つことを確認
      results.forEach(result => {
        expect(result).toHaveProperty('knowledge');
        expect(result).toHaveProperty('score');
      });
    });
    
    test('searchSemantic()がフィルターを適用できること', async () => {
      const results = await knowledgeSearch.searchSemantic({
        query: '日本の文化',
        filters: {
          tags: ['食べ物']
        }
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // すべての結果が「食べ物」タグを持つことを確認
      results.forEach(result => {
        expect(result.knowledge.tags).toContain('食べ物');
      });
      
      // 寿司の知識が含まれることを期待
      const hasSushi = results.some(result => result.knowledge.subject === '寿司');
      expect(hasSushi).toBe(true);
    });
  });
  
  describe('メタデータ検索', () => {
    test('searchByMetadata()が正しくメタデータ検索を実行できること', async () => {
      const results = await knowledgeSearch.searchByMetadata({
        metadata: {
          category: '地理'
        }
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // すべての結果が「地理」カテゴリを持つことを確認
      results.forEach(result => {
        expect(result.metadata.category).toBe('地理');
      });
    });
    
    test('searchByMetadata()が複合条件で検索できること', async () => {
      const results = await knowledgeSearch.searchByMetadata({
        metadata: {
          source: 'test-data',
          category: '交通'
        }
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // すべての結果が指定されたメタデータを持つことを確認
      results.forEach(result => {
        expect(result.metadata.source).toBe('test-data');
        expect(result.metadata.category).toBe('交通');
      });
      
      // 新幹線の知識が含まれることを期待
      const hasShinkansen = results.some(result => result.subject === '新幹線');
      expect(hasShinkansen).toBe(true);
    });
  });
  
  describe('複合検索', () => {
    test('searchCombined()がテキスト検索とメタデータ検索を組み合わせられること', async () => {
      const results = await knowledgeSearch.searchCombined({
        textQuery: '日本',
        metadata: {
          category: '地理'
        },
        limit: 5
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // すべての結果が「地理」カテゴリを持ち、「日本」に関連することを確認
      results.forEach(result => {
        expect(result.knowledge.metadata.category).toBe('地理');
        
        // 「日本」に関連する知識（主語、述語、目的語のいずれかに「日本」を含む）
        const hasJapan = 
          result.knowledge.subject === '日本' ||
          result.knowledge.object === '日本' ||
          result.knowledge.subject.includes('日本') ||
          result.knowledge.object.includes('日本');
          
        expect(hasJapan || result.score > 0.5).toBe(true);
      });
    });
    
    test('searchCombined()がセマンティック検索とタグフィルタリングを組み合わせられること', async () => {
      const results = await knowledgeSearch.searchCombined({
        semanticQuery: '日本の名所',
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
  });
  
  describe('関連知識検索', () => {
    test('findRelatedKnowledge()が主語に基づいて関連知識を検索できること', async () => {
      // 東京に関する知識を取得
      const tokyoKnowledge = await mockDbClient.findById('know_tokyo1');
      
      const results = await knowledgeSearch.findRelatedKnowledge({
        knowledge: tokyoKnowledge,
        relationField: 'subject',
        limit: 3
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // 東京を主語に持つ他の知識が含まれることを確認
      const hasRelatedTokyo = results.some(result => 
        result.knowledge.subject === '東京' && 
        result.knowledge.id !== 'know_tokyo1'
      );
      
      expect(hasRelatedTokyo).toBe(true);
    });
    
    test('findRelatedKnowledge()が目的語に基づいて関連知識を検索できること', async () => {
      // 日本を目的語に持つ知識を取得
      const japanKnowledge = await mockDbClient.findById('know_tokyo1');
      
      const results = await knowledgeSearch.findRelatedKnowledge({
        knowledge: japanKnowledge,
        relationField: 'object',
        limit: 5
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // 日本を目的語に持つ他の知識が含まれることを確認
      results.forEach(result => {
        if (result.knowledge.id !== 'know_tokyo1') {
          expect(result.knowledge.object).toBe('日本');
        }
      });
    });
    
    test('findRelatedKnowledge()が述語に基づいて関連知識を検索できること', async () => {
      // IS_A述語を持つ知識を取得
      const isAKnowledge = await mockDbClient.findById('know_shinkansen');
      
      const results = await knowledgeSearch.findRelatedKnowledge({
        knowledge: isAKnowledge,
        relationField: 'predicate',
        limit: 2
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // IS_A述語を持つ他の知識が含まれることを確認
      const hasSushi = results.some(result => 
        result.knowledge.subject === '寿司' && 
        result.knowledge.predicate === KnowledgeRelationType.IS_A
      );
      
      expect(hasSushi).toBe(true);
    });
  });
  
  describe('エラーハンドリング', () => {
    test('無効なクエリでsearchByText()を呼び出すとエラーがスローされること', async () => {
      await expect(knowledgeSearch.searchByText({
        query: '' // 空のクエリ
      })).rejects.toThrow();
    });
    
    test('無効なクエリでsearchSemantic()を呼び出すとエラーがスローされること', async () => {
      await expect(knowledgeSearch.searchSemantic({
        query: '' // 空のクエリ
      })).rejects.toThrow();
    });
    
    test('無効なパラメータでfindRelatedKnowledge()を呼び出すとエラーがスローされること', async () => {
      await expect(knowledgeSearch.findRelatedKnowledge({
        knowledge: null, // 知識がnull
        relationField: 'subject'
      })).rejects.toThrow();
      
      const knowledge = await mockDbClient.findById('know_tokyo1');
      
      await expect(knowledgeSearch.findRelatedKnowledge({
        knowledge,
        relationField: 'invalid_field' // 無効なフィールド
      })).rejects.toThrow();
    });
  });
});
