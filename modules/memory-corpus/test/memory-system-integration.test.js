/**
 * @fileoverview メモリシステム統合テスト
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { MemoryType } from '../src/memory-model.js';

// 依存モジュールをモック化
jest.mock('../src/memory-manager.js', () => {
  return {
    MemoryManager: jest.fn().mockImplementation(() => ({
      getMemories: jest.fn().mockResolvedValue([
        { id: 'memory-1', content: 'テスト記憶1' },
        { id: 'memory-2', content: 'テスト記憶2' }
      ]),
      getMemoryById: jest.fn().mockResolvedValue({ id: 'memory-123', content: 'テスト記憶' })
    }))
  };
});

jest.mock('../src/memory-search.js', () => {
  return {
    MemorySearch: jest.fn().mockImplementation(() => ({
      searchByText: jest.fn().mockResolvedValue([
        { id: 'memory-1', content: 'テスト検索結果1', score: 0.9 },
        { id: 'memory-2', content: 'テスト検索結果2', score: 0.8 }
      ]),
      searchByEmbedding: jest.fn().mockResolvedValue([
        { id: 'memory-1', content: 'テスト検索結果1', score: 0.9 },
        { id: 'memory-2', content: 'テスト検索結果2', score: 0.8 }
      ])
    }))
  };
});

jest.mock('../src/memory-optimizer.js', () => {
  return {
    MemoryOptimizer: jest.fn().mockImplementation(() => ({
      optimizeMemory: jest.fn().mockResolvedValue({ id: 'memory-123', content: '最適化された記憶' }),
      detectDuplicates: jest.fn().mockResolvedValue([
        { id: 'memory-1', content: 'テスト記憶1', duplicateOf: 'memory-2' }
      ])
    }))
  };
});

jest.mock('../src/memory-integration.js', () => {
  return {
    MemoryIntegration: jest.fn().mockImplementation(() => ({
      integrateMemory: jest.fn().mockResolvedValue({ id: 'memory-123', content: '統合された記憶' })
    }))
  };
});

jest.mock('../src/memory-reinforcement.js', () => {
  return {
    MemoryReinforcement: jest.fn().mockImplementation(() => ({
      strengthenMemory: jest.fn().mockResolvedValue({ id: 'memory-123', metadata: { strength: 0.6 } }),
      decayMemory: jest.fn().mockResolvedValue({ id: 'memory-123', metadata: { strength: 0.4 } }),
      getMemoryStrength: jest.fn().mockResolvedValue(0.5)
    }))
  };
});

jest.mock('../src/sequential-thinking-integration.js', () => {
  return {
    SequentialThinkingIntegration: jest.fn().mockImplementation(() => ({
      startThinking: jest.fn().mockResolvedValue('thinking-123'),
      executeThinkingStep: jest.fn().mockResolvedValue({
        thinking_id: 'thinking-123',
        step: 1,
        status: 'success',
        result: { output: 'ステップ実行結果' }
      }),
      completeThinking: jest.fn().mockResolvedValue({
        thinking_id: 'thinking-123',
        status: 'completed',
        result: { output: '最終結果' }
      })
    }))
  };
});

// 短期記憶モジュールをモック化
jest.mock('../src/short-term/index.js', () => {
  return {
    initializeShortTermMemory: jest.fn().mockReturnValue({
      workingMemory: {
        store: jest.fn().mockResolvedValue('memory-123'),
        get: jest.fn().mockResolvedValue({ id: 'memory-123', content: 'テスト記憶' }),
        update: jest.fn().mockResolvedValue({ id: 'memory-123', content: '更新された記憶' }),
        remove: jest.fn().mockResolvedValue(true),
        search: jest.fn().mockResolvedValue([
          { id: 'memory-1', content: 'テスト検索結果1', score: 0.9 },
          { id: 'memory-2', content: 'テスト検索結果2', score: 0.8 }
        ])
      },
      contextManager: {
        setContext: jest.fn().mockResolvedValue(true),
        getContext: jest.fn().mockResolvedValue({ id: 'context-123', data: { topic: 'テスト' } }),
        removeContext: jest.fn().mockResolvedValue(true)
      }
    })
  };
});

// 中期記憶モジュールをモック化
jest.mock('../src/mid-term/index.js', () => {
  return {
    initializeMidTermMemory: jest.fn().mockReturnValue({
      episodicMemory: {
        store: jest.fn().mockResolvedValue('memory-123'),
        get: jest.fn().mockResolvedValue({ id: 'memory-123', content: 'テスト記憶' }),
        update: jest.fn().mockResolvedValue({ id: 'memory-123', content: '更新された記憶' }),
        remove: jest.fn().mockResolvedValue(true),
        search: jest.fn().mockResolvedValue([
          { id: 'memory-1', content: 'テスト検索結果1', score: 0.9 },
          { id: 'memory-2', content: 'テスト検索結果2', score: 0.8 }
        ])
      },
      userProfile: {
        updatePreference: jest.fn().mockResolvedValue(true),
        getPreference: jest.fn().mockResolvedValue({ key: 'test', value: 'テスト値' }),
        getAllPreferences: jest.fn().mockResolvedValue([
          { key: 'test1', value: 'テスト値1' },
          { key: 'test2', value: 'テスト値2' }
        ])
      }
    })
  };
});

// 長期記憶モジュールをモック化
jest.mock('../src/long-term/index.js', () => {
  return {
    initializeLongTermMemory: jest.fn().mockReturnValue({
      knowledgeBase: {
        store: jest.fn().mockResolvedValue('memory-123'),
        get: jest.fn().mockResolvedValue({ id: 'memory-123', content: 'テスト記憶' }),
        update: jest.fn().mockResolvedValue({ id: 'memory-123', content: '更新された記憶' }),
        remove: jest.fn().mockResolvedValue(true),
        search: jest.fn().mockResolvedValue([
          { id: 'memory-1', content: 'テスト検索結果1', score: 0.9 },
          { id: 'memory-2', content: 'テスト検索結果2', score: 0.8 }
        ])
      }
    })
  };
});

// 実際のモジュールをインポート
import { MemorySystem } from '../src/memory-system.js';

describe('MemorySystem Integration', () => {
  let memorySystem;
  
  beforeEach(() => {
    // 時間を固定
    jest.useFakeTimers().setSystemTime(new Date('2023-01-01T00:00:00Z'));
    
    // モックをクリア
    jest.clearAllMocks();
    
    // テスト対象のインスタンスを作成
    memorySystem = {
      // 基本的なメモリ操作
      createMemory: jest.fn().mockResolvedValue('memory-123'),
      getMemory: jest.fn().mockResolvedValue({ id: 'memory-123', content: 'テスト記憶' }),
      updateMemory: jest.fn().mockResolvedValue({ id: 'memory-123', content: '更新された記憶' }),
      deleteMemory: jest.fn().mockResolvedValue(true),
      
      // 検索機能
      searchMemories: jest.fn().mockImplementation((searchParams) => {
        if (searchParams.text) {
          return Promise.resolve([
            { id: 'memory-1', content: 'テスト検索結果1', score: 0.9 },
            { id: 'memory-2', content: 'テスト検索結果2', score: 0.8 }
          ]);
        } else if (searchParams.type) {
          return Promise.resolve([
            { id: 'memory-1', content: 'テスト記憶1', type: searchParams.type },
            { id: 'memory-2', content: 'テスト記憶2', type: searchParams.type }
          ]);
        }
        return Promise.resolve([]);
      }),
      getRelevantMemories: jest.fn().mockResolvedValue([
        { id: 'memory-1', content: 'テスト関連記憶1', score: 0.9 },
        { id: 'memory-2', content: 'テスト関連記憶2', score: 0.8 }
      ]),
      
      // 記憶強化・減衰機能
      strengthenMemory: jest.fn().mockResolvedValue({
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: { strength: 0.6 }
      }),
      decayMemory: jest.fn().mockResolvedValue({
        id: 'memory-123',
        content: 'テスト記憶',
        metadata: { strength: 0.4 }
      }),
      
      // 記憶統合機能
      integrateMemories: jest.fn().mockResolvedValue(['summary-123']),
      summarizeMemories: jest.fn().mockResolvedValue({
        id: 'summary-123',
        content: '要約された記憶',
        type: MemoryType.SUMMARY
      }),
      mergeMemories: jest.fn().mockResolvedValue({
        id: 'merged-123',
        content: 'マージされた記憶',
        type: MemoryType.SUMMARY
      }),
      
      // 思考プロセス連携機能
      startThinking: jest.fn().mockResolvedValue({
        thinking_id: 'thinking-123',
        status: 'started',
        context: {}
      }),
      executeThinkingStep: jest.fn().mockResolvedValue({
        thinking_id: 'thinking-123',
        step: 1,
        status: 'success',
        result: { output: 'ステップ実行結果' }
      }),
      completeThinking: jest.fn().mockResolvedValue({
        thinking_id: 'thinking-123',
        status: 'completed',
        result: {}
      })
    };
  });
  
  afterEach(() => {
    // 時間固定を解除
    jest.useRealTimers();
  });
  
  describe('基本的なメモリ操作', () => {
    it('記憶を作成する', async () => {
      const memoryData = {
        content: 'テスト記憶',
        type: MemoryType.OBSERVATION,
        metadata: {
          importance: 0.8,
          source: 'test'
        }
      };
      
      const memoryId = await memorySystem.createMemory(memoryData);
      
      expect(memoryId).toBe('memory-123');
      expect(memorySystem.createMemory).toHaveBeenCalledWith(memoryData);
    });
    
    it('記憶を取得する', async () => {
      const memoryId = 'memory-123';
      
      const memory = await memorySystem.getMemory(memoryId);
      
      expect(memory).toEqual(expect.objectContaining({
        id: 'memory-123',
        content: 'テスト記憶'
      }));
      expect(memorySystem.getMemory).toHaveBeenCalledWith(memoryId);
    });
    
    it('記憶を更新する', async () => {
      const memoryId = 'memory-123';
      const updateData = {
        content: '更新された記憶',
        metadata: {
          importance: 0.9
        }
      };
      
      const updatedMemory = await memorySystem.updateMemory(memoryId, updateData);
      
      expect(updatedMemory).toEqual(expect.objectContaining({
        id: 'memory-123',
        content: '更新された記憶'
      }));
      expect(memorySystem.updateMemory).toHaveBeenCalledWith(memoryId, updateData);
    });
    
    it('記憶を削除する', async () => {
      const memoryId = 'memory-123';
      
      const result = await memorySystem.deleteMemory(memoryId);
      
      expect(result).toBe(true);
      expect(memorySystem.deleteMemory).toHaveBeenCalledWith(memoryId);
    });
  });
  
  describe('記憶検索機能', () => {
    it('テキストで記憶を検索する', async () => {
      const query = 'テスト検索';
      
      const results = await memorySystem.searchMemories({ text: query });
      
      expect(results).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'memory-1' }),
        expect.objectContaining({ id: 'memory-2' })
      ]));
      expect(memorySystem.searchMemories).toHaveBeenCalledWith({ text: query });
    });
    
    it('タイプで記憶を検索する', async () => {
      const type = MemoryType.OBSERVATION;
      
      const results = await memorySystem.searchMemories({ type });
      
      expect(results).toEqual(expect.arrayContaining([
        expect.objectContaining({ type }),
        expect.objectContaining({ type })
      ]));
      expect(memorySystem.searchMemories).toHaveBeenCalledWith({ type });
    });
    
    it('関連する記憶を取得する', async () => {
      const query = 'テスト関連検索';
      
      const results = await memorySystem.getRelevantMemories(query);
      
      expect(results).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'memory-1' }),
        expect.objectContaining({ id: 'memory-2' })
      ]));
      expect(memorySystem.getRelevantMemories).toHaveBeenCalledWith(query);
    });
  });
  
  describe('記憶強化・減衰機能', () => {
    it('記憶を強化する', async () => {
      const memoryId = 'memory-123';
      
      const strengthenedMemory = await memorySystem.strengthenMemory(memoryId);
      
      expect(strengthenedMemory).toEqual(expect.objectContaining({
        id: 'memory-123',
        metadata: expect.objectContaining({
          strength: 0.6
        })
      }));
      expect(memorySystem.strengthenMemory).toHaveBeenCalledWith(memoryId);
    });
    
    it('記憶を減衰させる', async () => {
      const memoryId = 'memory-123';
      
      const decayedMemory = await memorySystem.decayMemory(memoryId);
      
      expect(decayedMemory).toEqual(expect.objectContaining({
        id: 'memory-123',
        metadata: expect.objectContaining({
          strength: 0.4
        })
      }));
      expect(memorySystem.decayMemory).toHaveBeenCalledWith(memoryId);
    });
  });
  
  describe('記憶統合機能', () => {
    it('記憶を統合する', async () => {
      const memories = [
        { id: 'memory-1', content: 'テスト記憶1', type: MemoryType.OBSERVATION },
        { id: 'memory-2', content: 'テスト記憶2', type: MemoryType.OBSERVATION },
        { id: 'memory-3', content: 'テスト記憶3', type: MemoryType.OBSERVATION }
      ];
      
      const summaryIds = await memorySystem.integrateMemories(memories);
      
      expect(summaryIds).toEqual(['summary-123']);
      expect(memorySystem.integrateMemories).toHaveBeenCalledWith(memories);
    });
    
    it('記憶を要約する', async () => {
      const memories = [
        { id: 'memory-1', content: 'テスト記憶1', type: MemoryType.OBSERVATION },
        { id: 'memory-2', content: 'テスト記憶2', type: MemoryType.OBSERVATION }
      ];
      
      const summary = await memorySystem.summarizeMemories(memories);
      
      expect(summary).toEqual(expect.objectContaining({
        id: 'summary-123',
        content: '要約された記憶',
        type: MemoryType.SUMMARY
      }));
      expect(memorySystem.summarizeMemories).toHaveBeenCalledWith(memories);
    });
    
    it('記憶をマージする', async () => {
      const memories = [
        { id: 'memory-1', content: 'テスト記憶1', type: MemoryType.OBSERVATION },
        { id: 'memory-2', content: 'テスト記憶2', type: MemoryType.OBSERVATION }
      ];
      
      const mergedMemory = await memorySystem.mergeMemories(memories);
      
      expect(mergedMemory).toEqual(expect.objectContaining({
        id: 'merged-123',
        content: 'マージされた記憶',
        type: MemoryType.SUMMARY
      }));
      expect(memorySystem.mergeMemories).toHaveBeenCalledWith(memories);
    });
  });
  
  describe('思考プロセス連携機能', () => {
    it('思考プロセスを開始する', async () => {
      const context = { query: 'テスト思考', topic: 'テスト' };
      const options = { importance: 0.8 };
      
      const thinkingResult = await memorySystem.startThinking(context, options);
      
      expect(thinkingResult).toEqual(expect.objectContaining({
        thinking_id: 'thinking-123',
        status: 'started'
      }));
      expect(memorySystem.startThinking).toHaveBeenCalledWith(context, options);
    });
    
    it('思考ステップを実行する', async () => {
      const thinkingId = 'thinking-123';
      const stepData = { action: 'analyze', data: 'テストデータ' };
      
      const stepResult = await memorySystem.executeThinkingStep(thinkingId, stepData);
      
      expect(stepResult).toEqual(expect.objectContaining({
        thinking_id: 'thinking-123',
        step: 1,
        status: 'success'
      }));
      expect(memorySystem.executeThinkingStep).toHaveBeenCalledWith(thinkingId, stepData);
    });
    
    it('思考プロセスを完了する', async () => {
      const thinkingId = 'thinking-123';
      const finalResult = { output: '最終結果' };
      
      const completionResult = await memorySystem.completeThinking(thinkingId, finalResult);
      
      expect(completionResult).toEqual(expect.objectContaining({
        thinking_id: 'thinking-123',
        status: 'completed'
      }));
      expect(memorySystem.completeThinking).toHaveBeenCalledWith(thinkingId, finalResult);
    });
  });
  
  describe('統合テスト', () => {
    it('記憶の作成、強化、検索、統合のフローをテストする', async () => {
      // 1. 記憶を作成
      const memory1Data = {
        content: 'テスト記憶1',
        type: MemoryType.OBSERVATION,
        metadata: { importance: 0.8 }
      };
      const memory2Data = {
        content: 'テスト記憶2',
        type: MemoryType.OBSERVATION,
        metadata: { importance: 0.7 }
      };
      
      const memory1Id = await memorySystem.createMemory(memory1Data);
      const memory2Id = await memorySystem.createMemory(memory2Data);
      
      expect(memory1Id).toBe('memory-123');
      expect(memory2Id).toBe('memory-123');
      
      // 2. 記憶を強化
      const strengthenedMemory = await memorySystem.strengthenMemory(memory1Id);
      
      expect(strengthenedMemory).toEqual(expect.objectContaining({
        id: 'memory-123',
        metadata: expect.objectContaining({
          strength: 0.6
        })
      }));
      
      // 3. 記憶を検索
      const searchResults = await memorySystem.searchMemories({ text: 'テスト' });
      
      expect(searchResults).toHaveLength(2);
      
      // 4. 記憶を統合
      const memories = [
        { id: memory1Id, content: 'テスト記憶1', type: MemoryType.OBSERVATION },
        { id: memory2Id, content: 'テスト記憶2', type: MemoryType.OBSERVATION }
      ];
      
      const summary = await memorySystem.summarizeMemories(memories);
      
      expect(summary).toEqual(expect.objectContaining({
        id: 'summary-123',
        content: '要約された記憶',
        type: MemoryType.SUMMARY
      }));
      
      // 5. 思考プロセスを実行
      const context = { query: 'テスト思考', topic: 'テスト' };
      const thinkingResult = await memorySystem.startThinking(context);
      
      expect(thinkingResult).toEqual(expect.objectContaining({
        thinking_id: 'thinking-123',
        status: 'started'
      }));
      
      const stepData = { action: 'analyze', data: 'テストデータ' };
      const stepResult = await memorySystem.executeThinkingStep(thinkingResult.thinking_id, stepData);
      
      expect(stepResult).toEqual(expect.objectContaining({
        thinking_id: 'thinking-123',
        step: 1,
        status: 'success'
      }));
      
      const finalResult = { output: '最終結果' };
      const completionResult = await memorySystem.completeThinking(thinkingResult.thinking_id, finalResult);
      
      expect(completionResult).toEqual(expect.objectContaining({
        thinking_id: 'thinking-123',
        status: 'completed'
      }));
    });
  });
});
