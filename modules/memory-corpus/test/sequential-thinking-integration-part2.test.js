/**
 * @fileoverview 思考プロセス連携モジュールのテスト（パート2）
 */

import { jest } from '@jest/globals';
import { SequentialThinkingIntegration } from '../src/sequential-thinking-integration.js';
import { MemoryType } from '../src/memory-model.js';

describe('SequentialThinkingIntegration (Part 2)', () => {
  let sequentialThinkingIntegration;
  let mockMemorySystem;
  let mockWorkingMemory;
  let mockContextManager;
  let mockEpisodicMemory;
  let mockKnowledgeBase;
  let mockRuleEngine;
  
  beforeEach(() => {
    // 時間を固定
    jest.useFakeTimers().setSystemTime(new Date('2023-01-01T00:00:00Z'));
    
    // モックオブジェクトを作成
    mockMemorySystem = {
      getMemory: jest.fn().mockResolvedValue(null),
      createMemory: jest.fn().mockResolvedValue('memory-123'),
      updateMemory: jest.fn().mockResolvedValue(null),
      getRelevantMemories: jest.fn().mockResolvedValue([])
    };
    
    mockWorkingMemory = {
      store: jest.fn().mockResolvedValue('memory-123'),
      get: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue(true)
    };
    
    mockContextManager = {
      setContext: jest.fn().mockResolvedValue(true),
      getContext: jest.fn().mockResolvedValue(null),
      removeContext: jest.fn().mockResolvedValue(true)
    };
    
    mockEpisodicMemory = {
      store: jest.fn().mockResolvedValue('memory-123'),
      get: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue(true)
    };
    
    mockKnowledgeBase = {
      store: jest.fn().mockResolvedValue('memory-123'),
      get: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue(true)
    };
    
    mockRuleEngine = {
      addRule: jest.fn().mockResolvedValue('rule-123'),
      evaluateRules: jest.fn().mockResolvedValue([])
    };
    
    // テスト対象のインスタンスを作成
    sequentialThinkingIntegration = new SequentialThinkingIntegration({
      memorySystem: mockMemorySystem,
      workingMemory: mockWorkingMemory,
      contextManager: mockContextManager,
      episodicMemory: mockEpisodicMemory,
      knowledgeBase: mockKnowledgeBase,
      ruleEngine: mockRuleEngine,
      maxSteps: 5,
      maxDepth: 3,
      maxHistory: 100,
      maxThinkingTime: 60000
    });
  });
  
  afterEach(() => {
    // 時間固定を解除
    jest.useRealTimers();
    
    // モックをリセット
    jest.clearAllMocks();
  });
  
  describe('getThinkingState', () => {
    it('思考プロセスの状態を取得する', async () => {
      // 思考プロセスの初期状態を設定
      const thinkingId = 'thinking-123';
      const thinkingState = {
        id: thinkingId,
        context: { query: 'テスト思考', topic: 'テスト' },
        options: { importance: 0.8 },
        steps: [
          { action: 'analyze', result: { output: 'ステップ1結果' } }
        ],
        startTime: new Date('2023-01-01T00:00:00Z').getTime(),
        status: 'started',
        currentStep: 1,
        maxSteps: 5,
        depth: 0,
        parentId: null
      };
      
      sequentialThinkingIntegration.thinkingHistory.set(thinkingId, thinkingState);
      
      const status = await sequentialThinkingIntegration.getThinkingState(thinkingId);
      
      expect(status).toBeDefined();
      expect(status.thinking_id).toBe(thinkingId);
      expect(status.status).toBe('started');
      expect(status.current_step).toBe(1);
      expect(status.max_steps).toBe(5);
      expect(status.steps).toHaveLength(1);
    });
    
    it('存在しない思考プロセスIDを指定するとエラーをスローする', async () => {
      const invalidId = 'invalid-id';
      
      await expect(sequentialThinkingIntegration.getThinkingState(invalidId))
        .rejects.toThrow('Thinking process not found');
    });
  });
  
  describe('completeThinking', () => {
    let thinkingId;
    let thinkingState;
    
    beforeEach(() => {
      // 思考プロセスの初期状態を設定
      thinkingId = 'thinking-123';
      thinkingState = {
        id: thinkingId,
        context: { query: 'テスト思考', topic: 'テスト' },
        options: { importance: 0.8 },
        steps: [
          { action: 'analyze', result: { output: 'ステップ1結果' } }
        ],
        startTime: new Date('2023-01-01T00:00:00Z').getTime(),
        status: 'started',
        currentStep: 1,
        maxSteps: 5,
        depth: 0,
        parentId: null
      };
      
      sequentialThinkingIntegration.thinkingHistory.set(thinkingId, thinkingState);
    });
    
    it('思考プロセスの結果を記憶として保存する', async () => {
      const finalResult = { output: '最終結果', confidence: 0.9 };
      
      mockMemorySystem.createMemory.mockResolvedValueOnce('memory-456');
      
      const result = await sequentialThinkingIntegration.completeThinking(thinkingId, finalResult);
      
      expect(result).toBeDefined();
      expect(result.thinking_id).toBe(thinkingId);
      expect(result.status).toBe('completed');
      
      expect(mockMemorySystem.createMemory).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.stringContaining('最終結果'),
        type: MemoryType.FACT
      }));
    });
    
    it('思考プロセスの履歴を記録する', async () => {
      const finalResult = { output: '最終結果', confidence: 0.9 };
      
      await sequentialThinkingIntegration.completeThinking(thinkingId, finalResult);
      
      expect(mockEpisodicMemory.store).toHaveBeenCalledWith(expect.objectContaining({
        type: MemoryType.EPISODE,
        content: expect.stringContaining('思考プロセス'),
        metadata: expect.objectContaining({
          thinking_id: thinkingId
        })
      }));
    });
  });
  
  describe('failThinking', () => {
    let thinkingId;
    let thinkingState;
    
    beforeEach(() => {
      // 思考プロセスの初期状態を設定
      thinkingId = 'thinking-123';
      thinkingState = {
        id: thinkingId,
        context: { query: 'テスト思考', topic: 'テスト' },
        options: { importance: 0.8 },
        steps: [
          { action: 'analyze', result: { output: 'ステップ1結果' } }
        ],
        startTime: new Date('2023-01-01T00:00:00Z').getTime(),
        status: 'started',
        currentStep: 1,
        maxSteps: 5,
        depth: 0,
        parentId: null
      };
      
      sequentialThinkingIntegration.thinkingHistory.set(thinkingId, thinkingState);
    });
    
    it('思考プロセスの失敗を記録する', async () => {
      const error = { message: 'テストエラー', code: 'TEST_ERROR' };
      
      const result = await sequentialThinkingIntegration.failThinking(thinkingId, error);
      
      expect(result).toBeDefined();
      expect(result.thinking_id).toBe(thinkingId);
      expect(result.status).toBe('failed');
      expect(result.error).toEqual(error);
      
      expect(mockEpisodicMemory.store).toHaveBeenCalledWith(expect.objectContaining({
        type: MemoryType.EPISODE,
        content: expect.stringContaining('失敗'),
        metadata: expect.objectContaining({
          thinking_id: thinkingId,
          error: error
        })
      }));
    });
    
    it('存在しない思考プロセスIDを指定するとエラーをスローする', async () => {
      const invalidId = 'invalid-id';
      const error = { message: 'テストエラー', code: 'TEST_ERROR' };
      
      await expect(sequentialThinkingIntegration.failThinking(invalidId, error))
        .rejects.toThrow('Thinking process not found');
    });
  });
  
  describe('_executeStep', () => {
    it('分析アクションを実行する', async () => {
      const stepData = { action: 'analyze', data: 'テストデータ' };
      const options = { query: 'テスト思考', topic: 'テスト' };
      const memories = [
        { id: 'memory-1', content: '関連記憶1' },
        { id: 'memory-2', content: '関連記憶2' }
      ];
      
      // _getRelevantMemories をスタブ化
      jest.spyOn(sequentialThinkingIntegration, '_getRelevantMemories').mockResolvedValue(memories);
      
      const result = await sequentialThinkingIntegration._executeStep(stepData, options);
      
      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.result).toBeDefined();
      expect(result.result.output).toBeDefined();
      expect(result.result.final).toBe(false);
    });
    
    it('結論アクションを実行する', async () => {
      const stepData = { action: 'conclude', data: 'テスト結論' };
      const options = { query: 'テスト思考', topic: 'テスト' };
      const memories = [
        { id: 'memory-1', content: '関連記憶1' },
        { id: 'memory-2', content: '関連記憶2' }
      ];
      
      // _getRelevantMemories をスタブ化
      jest.spyOn(sequentialThinkingIntegration, '_getRelevantMemories').mockResolvedValue(memories);
      
      const result = await sequentialThinkingIntegration._executeStep(stepData, options);
      
      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.result).toBeDefined();
      expect(result.result.output).toBeDefined();
      expect(result.result.final).toBe(true);
    });
    
    it('サポートされていないアクションを指定するとエラーをスローする', async () => {
      const stepData = { action: 'invalid-action', data: 'テストデータ' };
      const options = { query: 'テスト思考', topic: 'テスト' };
      
      await expect(sequentialThinkingIntegration._executeStep(stepData, options))
        .rejects.toThrow('Unsupported action');
    });
  });
});
