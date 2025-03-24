/**
 * @fileoverview 知識モデルのテスト
 * 
 * このファイルでは、知識エンティティのデータモデルと
 * それに関連するバリデーション、変換、操作のためのテストを実施します。
 */

import { Knowledge, KnowledgeRelationType } from '../src/knowledge-model.js';

describe('Knowledge Model Tests', () => {
  // 有効な知識データ
  const validKnowledgeData = {
    subject: '東京',
    predicate: '位置する',
    object: '日本',
    confidence: 0.95,
    metadata: {
      source: 'unit-test',
      category: '地理'
    },
    tags: ['地理', '場所', '都市']
  };

  describe('Knowledge Constructor', () => {
    test('有効なデータで正しくインスタンス化できること', () => {
      const knowledge = new Knowledge(validKnowledgeData);
      
      // 基本的なプロパティの検証
      expect(knowledge.id).toBeDefined();
      expect(knowledge.id).toMatch(/^know_[a-f0-9]+$/);
      expect(knowledge.subject).toBe(validKnowledgeData.subject);
      expect(knowledge.predicate).toBe(validKnowledgeData.predicate);
      expect(knowledge.object).toBe(validKnowledgeData.object);
      expect(knowledge.confidence).toBe(validKnowledgeData.confidence);
      expect(knowledge.metadata).toEqual(validKnowledgeData.metadata);
      expect(knowledge.tags).toEqual(validKnowledgeData.tags);
      
      // 自動生成されるプロパティの検証
      expect(knowledge.created_at).toBeDefined();
      expect(knowledge.updated_at).toBeDefined();
      expect(new Date(knowledge.created_at)).toBeInstanceOf(Date);
      expect(new Date(knowledge.updated_at)).toBeInstanceOf(Date);
    });

    test('IDを指定した場合、そのIDが使用されること', () => {
      const customId = 'know_custom123456789';
      const knowledgeWithCustomId = new Knowledge({
        ...validKnowledgeData,
        id: customId
      });
      
      expect(knowledgeWithCustomId.id).toBe(customId);
    });

    test('必須フィールドが欠けている場合にエラーがスローされること', () => {
      // subjectが欠けている
      expect(() => {
        new Knowledge({
          predicate: validKnowledgeData.predicate,
          object: validKnowledgeData.object
        });
      }).toThrow();
      
      // predicateが欠けている
      expect(() => {
        new Knowledge({
          subject: validKnowledgeData.subject,
          object: validKnowledgeData.object
        });
      }).toThrow();
      
      // objectが欠けている
      expect(() => {
        new Knowledge({
          subject: validKnowledgeData.subject,
          predicate: validKnowledgeData.predicate
        });
      }).toThrow();
    });

    test('無効な値でエラーがスローされること', () => {
      // 無効なconfidence（範囲外）
      expect(() => {
        new Knowledge({
          ...validKnowledgeData,
          confidence: 1.5
        });
      }).toThrow();
      
      // 空の文字列
      expect(() => {
        new Knowledge({
          ...validKnowledgeData,
          subject: ''
        });
      }).toThrow();
      
      expect(() => {
        new Knowledge({
          ...validKnowledgeData,
          predicate: ''
        });
      }).toThrow();
      
      expect(() => {
        new Knowledge({
          ...validKnowledgeData,
          object: ''
        });
      }).toThrow();
    });
  });

  describe('Knowledge Methods', () => {
    test('update()メソッドが正しく動作すること', () => {
      const knowledge = new Knowledge(validKnowledgeData);
      const originalUpdatedAt = knowledge.updated_at;
      
      // 少し待機して更新時間の差を確認できるようにする
      jest.advanceTimersByTime(1000);
      
      const updateData = {
        object: '関東地方',
        confidence: 0.98,
        tags: ['更新', '地理']
      };
      
      knowledge.update(updateData);
      
      // 更新されたプロパティの検証
      expect(knowledge.object).toBe(updateData.object);
      expect(knowledge.confidence).toBe(updateData.confidence);
      expect(knowledge.tags).toEqual(updateData.tags);
      
      // 更新日時が変更されていることを確認
      expect(knowledge.updated_at).not.toBe(originalUpdatedAt);
      
      // 更新不可のプロパティが変更されていないことを確認
      expect(knowledge.id).toMatch(/^know_[a-f0-9]+$/);
      expect(knowledge.created_at).toBeDefined();
      expect(knowledge.subject).toBe(validKnowledgeData.subject);
      expect(knowledge.predicate).toBe(validKnowledgeData.predicate);
    });

    test('toJSON()メソッドが正しくJSONオブジェクトを返すこと', () => {
      const knowledge = new Knowledge(validKnowledgeData);
      const json = knowledge.toJSON();
      
      // JSONオブジェクトの検証
      expect(json).toBeInstanceOf(Object);
      expect(json.id).toBe(knowledge.id);
      expect(json.subject).toBe(knowledge.subject);
      expect(json.predicate).toBe(knowledge.predicate);
      expect(json.object).toBe(knowledge.object);
      expect(json.confidence).toBe(knowledge.confidence);
      expect(json.tags).toEqual(knowledge.tags);
      expect(json.metadata).toEqual(knowledge.metadata);
      expect(json.created_at).toBe(knowledge.created_at);
      expect(json.updated_at).toBe(knowledge.updated_at);
    });

    test('fromJSON()メソッドが正しく知識インスタンスを復元すること', () => {
      const originalKnowledge = new Knowledge(validKnowledgeData);
      const json = originalKnowledge.toJSON();
      const restoredKnowledge = Knowledge.fromJSON(json);
      
      // 復元されたインスタンスの検証
      expect(restoredKnowledge).toBeInstanceOf(Knowledge);
      expect(restoredKnowledge.id).toBe(originalKnowledge.id);
      expect(restoredKnowledge.subject).toBe(originalKnowledge.subject);
      expect(restoredKnowledge.predicate).toBe(originalKnowledge.predicate);
      expect(restoredKnowledge.object).toBe(originalKnowledge.object);
      expect(restoredKnowledge.confidence).toBe(originalKnowledge.confidence);
      expect(restoredKnowledge.tags).toEqual(originalKnowledge.tags);
      expect(restoredKnowledge.metadata).toEqual(originalKnowledge.metadata);
      expect(restoredKnowledge.created_at).toBe(originalKnowledge.created_at);
      expect(restoredKnowledge.updated_at).toBe(originalKnowledge.updated_at);
    });
    
    test('getTriple()メソッドが正しくトリプル表現を返すこと', () => {
      const knowledge = new Knowledge(validKnowledgeData);
      const triple = knowledge.getTriple();
      
      expect(triple).toBeDefined();
      expect(triple).toHaveProperty('subject');
      expect(triple).toHaveProperty('predicate');
      expect(triple).toHaveProperty('object');
      expect(triple.subject).toBe(validKnowledgeData.subject);
      expect(triple.predicate).toBe(validKnowledgeData.predicate);
      expect(triple.object).toBe(validKnowledgeData.object);
    });
    
    test('getInverseTriple()メソッドが正しく逆トリプル表現を返すこと', () => {
      const knowledge = new Knowledge(validKnowledgeData);
      const inverseTriple = knowledge.getInverseTriple();
      
      expect(inverseTriple).toBeDefined();
      expect(inverseTriple).toHaveProperty('subject');
      expect(inverseTriple).toHaveProperty('predicate');
      expect(inverseTriple).toHaveProperty('object');
      expect(inverseTriple.subject).toBe(validKnowledgeData.object);
      expect(inverseTriple.predicate).toContain('逆');
      expect(inverseTriple.object).toBe(validKnowledgeData.subject);
    });
  });

  describe('Knowledge Validation', () => {
    test('validateTriple()メソッドが有効なトリプルを検証できること', () => {
      const validTriple = {
        subject: '富士山',
        predicate: '高さ',
        object: '3776メートル'
      };
      
      const result = Knowledge.validateTriple(validTriple);
      expect(result).toBe(true);
    });
    
    test('validateTriple()メソッドが無効なトリプルを検出できること', () => {
      const invalidTriples = [
        { subject: '', predicate: '高さ', object: '3776メートル' },
        { subject: '富士山', predicate: '', object: '3776メートル' },
        { subject: '富士山', predicate: '高さ', object: '' },
        { subject: null, predicate: '高さ', object: '3776メートル' },
        { subject: '富士山', predicate: null, object: '3776メートル' },
        { subject: '富士山', predicate: '高さ', object: null }
      ];
      
      invalidTriples.forEach(triple => {
        expect(Knowledge.validateTriple(triple)).toBe(false);
      });
    });
  });

  describe('Knowledge Relations', () => {
    test('関係タイプが正しく定義されていること', () => {
      expect(KnowledgeRelationType).toBeDefined();
      expect(KnowledgeRelationType.IS_A).toBeDefined();
      expect(KnowledgeRelationType.HAS_PROPERTY).toBeDefined();
      expect(KnowledgeRelationType.PART_OF).toBeDefined();
      expect(KnowledgeRelationType.LOCATED_IN).toBeDefined();
      expect(KnowledgeRelationType.RELATED_TO).toBeDefined();
    });
    
    test('isConflicting()メソッドが矛盾する知識を検出できること', () => {
      const knowledge1 = new Knowledge({
        subject: '東京',
        predicate: '人口',
        object: '約1400万人',
        confidence: 0.9
      });
      
      const knowledge2 = new Knowledge({
        subject: '東京',
        predicate: '人口',
        object: '約1000万人',
        confidence: 0.7
      });
      
      const knowledge3 = new Knowledge({
        subject: '東京',
        predicate: '面積',
        object: '2194平方キロメートル',
        confidence: 0.9
      });
      
      // 同じ主語と述語で異なる目的語を持つ場合は矛盾
      expect(knowledge1.isConflicting(knowledge2)).toBe(true);
      
      // 述語が異なる場合は矛盾しない
      expect(knowledge1.isConflicting(knowledge3)).toBe(false);
      expect(knowledge2.isConflicting(knowledge3)).toBe(false);
    });
    
    test('getRelatedKnowledgeQuery()メソッドが適切なクエリを生成すること', () => {
      const knowledge = new Knowledge({
        subject: '東京',
        predicate: KnowledgeRelationType.LOCATED_IN,
        object: '日本',
        confidence: 0.95
      });
      
      // 主語に基づく関連知識クエリ
      const subjectQuery = knowledge.getRelatedKnowledgeQuery('subject');
      expect(subjectQuery).toBeDefined();
      expect(subjectQuery).toHaveProperty('subject');
      expect(subjectQuery.subject).toBe('東京');
      
      // 目的語に基づく関連知識クエリ
      const objectQuery = knowledge.getRelatedKnowledgeQuery('object');
      expect(objectQuery).toBeDefined();
      expect(objectQuery).toHaveProperty('object');
      expect(objectQuery.object).toBe('日本');
      
      // 述語に基づく関連知識クエリ
      const predicateQuery = knowledge.getRelatedKnowledgeQuery('predicate');
      expect(predicateQuery).toBeDefined();
      expect(predicateQuery).toHaveProperty('predicate');
      expect(predicateQuery.predicate).toBe(KnowledgeRelationType.LOCATED_IN);
    });
  });
});
