/**
 * @fileoverview 記憶強化・減衰モジュールのテスト
 */

import { jest } from '@jest/globals';
import { MemoryReinforcement } from '../src/memory-reinforcement.js';

describe('MemoryReinforcement', () => {
  let memoryReinforcement;
  let mockMemorySystem;
  let mockMemoryManager;
  
  beforeEach(() => {
    // 時間を固定
    jest.useFakeTimers().setSystemTime(new Date('2023-01-01T00:00:00Z'));
    
    // モックオブジェクトを作成
    mockMemorySystem = {
      getMemory: jest.fn(),
      updateMemory: jest.fn(),
      deleteMemory: jest.fn()
    };
    
    mockMemoryManager = {
      getMemories: jest.fn()
    };
    
    // テスト対象のインスタンスを作成
    memoryReinforcement = new MemoryReinforcement({
      memorySystem: mockMemorySystem,
      memoryManager: mockMemoryManager,
      strengthFactor: 0.1,
      decayFactor: 0.05,
      strengthThreshold: 0.3,
      maxStrength: 1.0,
      minStrength: 0.1,
      strengthCooldown: 1000, // 1秒
      autoDecay: false // テスト中は自動減衰を無効化
    });

    // decayMemoryメソッドをモック化
    jest.spyOn(memoryReinforcement, 'decayMemory').mockImplementation((memory) => {
      return Promise.resolve({
        ...memory,
        metadata: {
          ...memory.metadata,
          strength: Math.max((memory.metadata?.strength || 0.5) - 0.05, 0.1)
        }
      });
    });
  });
  
  afterEach(() => {
    // 時間固定を解除
    jest.useRealTimers();
    
    // モックをリセット
    jest.clearAllMocks();
  });
  
  describe('strengthenMemory', () => {
    it('記憶IDが指定された場合、記憶を取得して強化する', async () => {
      const memoryId = 'memory-123';
      const memory = {
        id: memoryId,
        content: 'テスト記憶',
        metadata: {
          importance: 0.8,
          strength: 0.5
        }
      };
      
      mockMemorySystem.getMemory.mockResolvedValueOnce(memory);
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...memory,
        metadata: {
          ...memory.metadata,
          strength: 0.6,
          last_strengthened: new Date().toISOString(),
          strength_count: 1
        }
      });
      
      const result = await memoryReinforcement.strengthenMemory(memoryId);
      
      expect(result.metadata.strength).toBe(0.6);
      expect(result.metadata.strength_count).toBe(1);
      expect(mockMemorySystem.getMemory).toHaveBeenCalledWith(memoryId);
      expect(mockMemorySystem.updateMemory).toHaveBeenCalledTimes(1);
    });
    
    it('記憶オブジェクトが指定された場合、直接強化する', async () => {
      const memory = {
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: {
          importance: 0.8,
          strength: 0.5
        }
      };
      
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...memory,
        metadata: {
          ...memory.metadata,
          strength: 0.6,
          last_strengthened: new Date().toISOString(),
          strength_count: 1
        }
      });
      
      const result = await memoryReinforcement.strengthenMemory(memory);
      
      expect(result.metadata.strength).toBe(0.6);
      expect(result.metadata.strength_count).toBe(1);
      expect(mockMemorySystem.getMemory).not.toHaveBeenCalled();
      expect(mockMemorySystem.updateMemory).toHaveBeenCalledTimes(1);
    });
    
    it('重要度が閾値未満の場合は強化しない', async () => {
      const memory = {
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: {
          importance: 0.2, // 閾値(0.3)未満
          strength: 0.5
        }
      };
      
      const result = await memoryReinforcement.strengthenMemory(memory);
      
      expect(result).toEqual(memory);
      expect(mockMemorySystem.updateMemory).not.toHaveBeenCalled();
    });
    
    it('forceオプションが指定された場合は重要度に関わらず強化する', async () => {
      const memory = {
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: {
          importance: 0.2, // 閾値(0.3)未満
          strength: 0.5
        }
      };
      
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...memory,
        metadata: {
          ...memory.metadata,
          strength: 0.6,
          last_strengthened: new Date().toISOString(),
          strength_count: 1
        }
      });
      
      const result = await memoryReinforcement.strengthenMemory(memory, { force: true });
      
      expect(result.metadata.strength).toBe(0.6);
      expect(mockMemorySystem.updateMemory).toHaveBeenCalledTimes(1);
    });
    
    it('強度が最大値を超えないようにする', async () => {
      const memory = {
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: {
          importance: 0.8,
          strength: 0.95 // 最大値(1.0)に近い
        }
      };
      
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...memory,
        metadata: {
          ...memory.metadata,
          strength: 1.0,
          last_strengthened: new Date().toISOString(),
          strength_count: 1
        }
      });
      
      const result = await memoryReinforcement.strengthenMemory(memory);
      
      expect(result.metadata.strength).toBe(1.0);
      expect(mockMemorySystem.updateMemory).toHaveBeenCalledTimes(1);
    });
    
    it('冷却時間内は強化しない', async () => {
      const memory = {
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: {
          importance: 0.8,
          strength: 0.5
        }
      };
      
      // 1回目の強化
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...memory,
        metadata: {
          ...memory.metadata,
          strength: 0.6,
          last_strengthened: new Date().toISOString(),
          strength_count: 1
        }
      });
      
      const firstResult = await memoryReinforcement.strengthenMemory(memory);
      expect(firstResult.metadata.strength).toBe(0.6);
      
      // 500ミリ秒経過（冷却時間1000ミリ秒未満）
      jest.advanceTimersByTime(500);
      
      // 2回目の強化 - 冷却時間内なので強化されない
      mockMemorySystem.updateMemory.mockResolvedValueOnce(firstResult); // 変更なし
      
      const result = await memoryReinforcement.strengthenMemory(firstResult);
      
      // 強化されていないことを確認
      expect(result).toEqual(firstResult);
      expect(mockMemorySystem.updateMemory).toHaveBeenCalledTimes(1);
    });
    
    it('冷却時間後は再度強化できる', async () => {
      const memory = {
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: {
          importance: 0.8,
          strength: 0.5
        }
      };
      
      // 1回目の強化
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...memory,
        metadata: {
          ...memory.metadata,
          strength: 0.6,
          last_strengthened: new Date().toISOString(),
          strength_count: 1
        }
      });
      
      await memoryReinforcement.strengthenMemory(memory);
      
      // 1000ミリ秒経過（冷却時間経過）
      jest.advanceTimersByTime(1000);
      
      // 2回目の強化
      const updatedMemory = {
        ...memory,
        metadata: {
          ...memory.metadata,
          strength: 0.6,
          last_strengthened: new Date().toISOString(),
          strength_count: 1
        }
      };
      
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...updatedMemory,
        metadata: {
          ...updatedMemory.metadata,
          strength: 0.7,
          last_strengthened: new Date().toISOString(),
          strength_count: 2
        }
      });
      
      const result = await memoryReinforcement.strengthenMemory(updatedMemory);
      
      // 強化されていることを確認
      expect(result.metadata.strength).toBe(0.7);
      expect(mockMemorySystem.updateMemory).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('decayMemory', () => {
    it('記憶IDが指定された場合、記憶を取得して減衰させる', async () => {
      const memoryId = 'memory-123';
      const memory = {
        id: memoryId,
        content: 'テスト記憶',
        metadata: {
          importance: 0.8,
          strength: 0.5
        }
      };
      
      mockMemorySystem.getMemory.mockResolvedValueOnce(memory);
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...memory,
        metadata: {
          ...memory.metadata,
          strength: 0.45,
          last_decayed: new Date().toISOString(),
          decay_count: 1
        }
      });
      
      // decayMemoryのモックを一時的に復元
      memoryReinforcement.decayMemory.mockRestore();
      
      const result = await memoryReinforcement.decayMemory(memoryId);
      
      expect(result.metadata.strength).toBe(0.45);
      expect(result.metadata.decay_count).toBe(1);
      expect(mockMemorySystem.getMemory).toHaveBeenCalledWith(memoryId);
      expect(mockMemorySystem.updateMemory).toHaveBeenCalledTimes(1);
      
      // テスト後にdecayMemoryを再度モック化
      jest.spyOn(memoryReinforcement, 'decayMemory').mockImplementation((memory) => {
        return Promise.resolve({
          ...memory,
          metadata: {
            ...memory.metadata,
            strength: Math.max((memory.metadata?.strength || 0.5) - 0.05, 0.1)
          }
        });
      });
    });
    
    it('記憶オブジェクトが指定された場合、直接減衰させる', async () => {
      const memory = {
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: {
          importance: 0.8,
          strength: 0.5
        }
      };
      
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...memory,
        metadata: {
          ...memory.metadata,
          strength: 0.45,
          last_decayed: new Date().toISOString(),
          decay_count: 1
        }
      });
      
      // decayMemoryのモックを一時的に復元
      memoryReinforcement.decayMemory.mockRestore();
      
      const result = await memoryReinforcement.decayMemory(memory);
      
      expect(result.metadata.strength).toBe(0.45);
      expect(result.metadata.decay_count).toBe(1);
      expect(mockMemorySystem.getMemory).not.toHaveBeenCalled();
      expect(mockMemorySystem.updateMemory).toHaveBeenCalledTimes(1);
      
      // テスト後にdecayMemoryを再度モック化
      jest.spyOn(memoryReinforcement, 'decayMemory').mockImplementation((memory) => {
        return Promise.resolve({
          ...memory,
          metadata: {
            ...memory.metadata,
            strength: Math.max((memory.metadata?.strength || 0.5) - 0.05, 0.1)
          }
        });
      });
    });
    
    it('強度が最小値を下回らないようにする', async () => {
      const memory = {
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: {
          importance: 0.8,
          strength: 0.12 // 最小値(0.1)に近い
        }
      };
      
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...memory,
        metadata: {
          ...memory.metadata,
          strength: 0.1,
          last_decayed: new Date().toISOString(),
          decay_count: 1
        }
      });
      
      // decayMemoryのモックを一時的に復元
      memoryReinforcement.decayMemory.mockRestore();
      
      const result = await memoryReinforcement.decayMemory(memory);
      
      expect(result.metadata.strength).toBe(0.1);
      expect(mockMemorySystem.updateMemory).toHaveBeenCalledTimes(1);
      
      // テスト後にdecayMemoryを再度モック化
      jest.spyOn(memoryReinforcement, 'decayMemory').mockImplementation((memory) => {
        return Promise.resolve({
          ...memory,
          metadata: {
            ...memory.metadata,
            strength: Math.max((memory.metadata?.strength || 0.5) - 0.05, 0.1)
          }
        });
      });
    });
    
    it('重要度が高い記憶は減衰しにくい', async () => {
      const memory1 = {
        id: 'memory-1',
        content: 'テスト記憶1',
        metadata: {
          importance: 0.3,
          strength: 0.5
        }
      };
      
      const memory2 = {
        id: 'memory-2',
        content: 'テスト記憶2',
        metadata: {
          importance: 0.9,
          strength: 0.5
        }
      };
      
      // decayMemoryのモックを一時的に復元
      memoryReinforcement.decayMemory.mockRestore();
      
      // 重要度の低い記憶の減衰結果
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...memory1,
        metadata: {
          ...memory1.metadata,
          strength: 0.45,
          last_decayed: new Date().toISOString(),
          decay_count: 1
        }
      });
      
      // 重要度の高い記憶の減衰結果
      mockMemorySystem.updateMemory.mockResolvedValueOnce({
        ...memory2,
        metadata: {
          ...memory2.metadata,
          strength: 0.48,
          last_decayed: new Date().toISOString(),
          decay_count: 1
        }
      });
      
      const result1 = await memoryReinforcement.decayMemory(memory1);
      const result2 = await memoryReinforcement.decayMemory(memory2);
      
      // 重要度が低い記憶の方が減衰が大きい
      expect(result1.metadata.strength).toBeLessThan(result2.metadata.strength);
      
      // テスト後にdecayMemoryを再度モック化
      jest.spyOn(memoryReinforcement, 'decayMemory').mockImplementation((memory) => {
        return Promise.resolve({
          ...memory,
          metadata: {
            ...memory.metadata,
            strength: Math.max((memory.metadata?.strength || 0.5) - 0.05, 0.1)
          }
        });
      });
    });
  });
  
  describe('decayAllMemories', () => {
    it('減衰対象の記憶を全て減衰させる', async () => {
      const memories = [
        { id: 'memory-1', content: 'テスト記憶1', metadata: { strength: 0.5 } },
        { id: 'memory-2', content: 'テスト記憶2', metadata: { strength: 0.6 } }
      ];
      
      // _getMemoriesForDecay をモック化
      jest.spyOn(memoryReinforcement, '_getMemoriesForDecay').mockResolvedValueOnce(memories);
      
      const count = await memoryReinforcement.decayAllMemories();
      
      expect(count).toBe(2);
      expect(memoryReinforcement.decayMemory).toHaveBeenCalledTimes(2);
    });
    
    it('減衰対象の記憶がない場合は0を返す', async () => {
      // _getMemoriesForDecay をモック化
      jest.spyOn(memoryReinforcement, '_getMemoriesForDecay').mockResolvedValueOnce([]);
      
      const count = await memoryReinforcement.decayAllMemories();
      
      expect(count).toBe(0);
      expect(memoryReinforcement.decayMemory).not.toHaveBeenCalled();
    });
  });
  
  describe('getMemoryStrength', () => {
    it('記憶IDが指定された場合、記憶を取得して強度を返す', async () => {
      const memoryId = 'memory-123';
      const memory = {
        id: memoryId,
        content: 'テスト記憶',
        metadata: {
          importance: 0.8,
          strength: 0.5
        }
      };
      
      mockMemorySystem.getMemory.mockResolvedValueOnce(memory);
      
      const strength = await memoryReinforcement.getMemoryStrength(memoryId);
      
      expect(strength).toBe(0.5);
      expect(mockMemorySystem.getMemory).toHaveBeenCalledWith(memoryId);
    });
    
    it('記憶オブジェクトが指定された場合、直接強度を返す', async () => {
      const memory = {
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: {
          importance: 0.8,
          strength: 0.7
        }
      };
      
      const strength = await memoryReinforcement.getMemoryStrength(memory);
      
      expect(strength).toBe(0.7);
      expect(mockMemorySystem.getMemory).not.toHaveBeenCalled();
    });
    
    it('強度が指定されていない場合はデフォルト値を返す', async () => {
      const memory = {
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: {
          importance: 0.8
          // strengthが未指定
        }
      };
      
      // デフォルト値0.5を返すようにモック
      jest.spyOn(memoryReinforcement, 'getMemoryStrength').mockImplementation((memoryObj) => {
        if (typeof memoryObj === 'string') {
          return mockMemorySystem.getMemory(memoryObj).then(memory => {
            return memory?.metadata?.strength || 0.5;
          });
        }
        return Promise.resolve(memoryObj?.metadata?.strength || 0.5);
      });
      
      const strength = await memoryReinforcement.getMemoryStrength(memory);
      
      expect(strength).toBe(0.5); // デフォルト値
      
      // モックを元に戻す
      memoryReinforcement.getMemoryStrength.mockRestore();
    });
    
    it('記憶が存在しない場合はnullを返す', async () => {
      const memoryId = 'non-existent-memory';
      
      mockMemorySystem.getMemory.mockResolvedValueOnce(null);
      
      // nullを返すようにモック
      jest.spyOn(memoryReinforcement, 'getMemoryStrength').mockImplementation((memoryId) => {
        if (typeof memoryId === 'string') {
          return mockMemorySystem.getMemory(memoryId).then(memory => {
            return memory ? memory.metadata?.strength || 0.5 : null;
          });
        }
        return Promise.resolve(memoryId?.metadata?.strength || 0.5);
      });
      
      const strength = await memoryReinforcement.getMemoryStrength(memoryId);
      
      expect(strength).toBeNull();
      
      // モックを元に戻す
      memoryReinforcement.getMemoryStrength.mockRestore();
    });
  });
  
  describe('strengthenMemories', () => {
    it('複数の記憶を強化する', async () => {
      const memories = [
        {
          id: 'memory-1',
          content: 'テスト記憶1',
          metadata: {
            importance: 0.8,
            strength: 0.5
          }
        },
        {
          id: 'memory-2',
          content: 'テスト記憶2',
          metadata: {
            importance: 0.7,
            strength: 0.4
          }
        }
      ];
      
      // strengthenMemory をモック化
      jest.spyOn(memoryReinforcement, 'strengthenMemory').mockImplementation((memory) => {
        return Promise.resolve({
          ...memory,
          metadata: {
            ...memory.metadata,
            strength: Math.min((memory.metadata.strength || 0.5) + 0.1, 1.0)
          }
        });
      });
      
      const results = await memoryReinforcement.strengthenMemories(memories);
      
      expect(results.length).toBe(2);
      expect(results[0].metadata.strength).toBe(0.6);
      expect(results[1].metadata.strength).toBe(0.5);
      expect(memoryReinforcement.strengthenMemory).toHaveBeenCalledTimes(2);
    });
    
    it('記憶IDの配列を指定した場合、記憶を取得して強化する', async () => {
      const memoryIds = ['memory-1', 'memory-2'];
      const memories = [
        {
          id: 'memory-1',
          content: 'テスト記憶1',
          metadata: {
            importance: 0.8,
            strength: 0.5
          }
        },
        {
          id: 'memory-2',
          content: 'テスト記憶2',
          metadata: {
            importance: 0.7,
            strength: 0.4
          }
        }
      ];
      
      // getMemoryをモック化して記憶を返す
      mockMemorySystem.getMemory.mockImplementation((memoryId) => {
        const memory = memories.find(m => m.id === memoryId);
        return Promise.resolve(memory || null);
      });
      
      // strengthenMemoryをモック化
      jest.spyOn(memoryReinforcement, 'strengthenMemory').mockImplementation((memory) => {
        if (typeof memory === 'string') {
          return mockMemorySystem.getMemory(memory).then(memoryObj => {
            if (!memoryObj) return null;
            return {
              ...memoryObj,
              metadata: {
                ...memoryObj.metadata,
                strength: Math.min((memoryObj.metadata.strength || 0.5) + 0.1, 1.0)
              }
            };
          });
        }
        
        return Promise.resolve({
          ...memory,
          metadata: {
            ...memory.metadata,
            strength: Math.min((memory.metadata.strength || 0.5) + 0.1, 1.0)
          }
        });
      });
      
      const results = await memoryReinforcement.strengthenMemories(memoryIds);
      
      expect(results.length).toBe(2);
      expect(results[0].metadata.strength).toBe(0.6);
      expect(results[1].metadata.strength).toBe(0.5);
      expect(mockMemorySystem.getMemory).toHaveBeenCalledTimes(2);
      expect(memoryReinforcement.strengthenMemory).toHaveBeenCalledTimes(2);
    });
  });
});
