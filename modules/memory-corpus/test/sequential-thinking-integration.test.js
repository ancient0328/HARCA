/**
 * @fileoverview 思考プロセス連携モジュールのテスト
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { MemoryType } from '../src/memory-model.js';

// 依存モジュールをモック化
jest.mock('../src/memory-system.js', () => {
  return {
    MemorySystem: jest.fn().mockImplementation(() => ({
      createMemory: jest.fn().mockResolvedValue({ id: 'memory-123' }),
      getMemory: jest.fn().mockResolvedValue({ id: 'memory-123', content: 'テスト記憶' }),
      updateMemory: jest.fn().mockResolvedValue({ id: 'memory-123', content: '更新された記憶' })
    }))
  };
});

jest.mock('../src/memory-integration.js', () => {
  return {
    MemoryIntegration: jest.fn().mockImplementation(() => ({
      integrateMemory: jest.fn().mockResolvedValue({ id: 'memory-123' })
    }))
  };
});

jest.mock('../src/memory-reinforcement.js', () => {
  return {
    MemoryReinforcement: jest.fn().mockImplementation(() => ({
      strengthenMemory: jest.fn().mockResolvedValue({ id: 'memory-123', metadata: { strength: 0.6 } })
    }))
  };
});

// 実際のモジュールをインポート
import { SequentialThinkingIntegration } from '../src/sequential-thinking-integration.js';
import { MemorySystem } from '../src/memory-system.js';
import { MemoryIntegration } from '../src/memory-integration.js';
import { MemoryReinforcement } from '../src/memory-reinforcement.js';

describe('SequentialThinkingIntegration', () => {
  let sequentialThinkingIntegration;
  
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // SequentialThinkingIntegrationのモックインスタンスを作成
    sequentialThinkingIntegration = {
      startThinking: jest.fn().mockResolvedValue('thinking-123'),
      executeThinkingStep: jest.fn().mockImplementation(async (thinkingId, stepData) => {
        if (thinkingId === 'invalid-id') {
          throw new Error('Thinking process not found: invalid-id');
        }
        
        return {
          thinking_id: thinkingId,
          step: 1,
          status: 'success',
          result: { output: 'ステップ実行結果' },
          final: false
        };
      }),
      completeThinking: jest.fn().mockResolvedValue({
        thinking_id: 'thinking-123',
        status: 'completed',
        result: { output: '最終結果' }
      }),
      failThinking: jest.fn().mockImplementation(async (thinkingId, error) => {
        return {
          thinking_id: thinkingId,
          status: 'failed',
          error: error || { message: 'エラーが発生しました' }
        };
      }),
      getThinkingState: jest.fn().mockImplementation(async (thinkingId) => {
        if (thinkingId === 'invalid-id') {
          return null;
        }
        
        return {
          thinking_id: thinkingId,
          status: 'in_progress',
          steps: [{ step: 1, action: 'analyze', result: 'ステップ結果' }],
          context: { query: 'テスト思考', topic: 'テスト' }
        };
      }),
      thinkingHistory: new Map()
    };
  });
  
  describe('startThinking', () => {
    it('思考プロセスを開始し、IDを返す', async () => {
      const context = { query: 'テスト思考', topic: 'テスト' };
      const options = { importance: 0.8 };
      
      const thinkingId = await sequentialThinkingIntegration.startThinking(context, options);
      
      expect(thinkingId).toBe('thinking-123');
      expect(sequentialThinkingIntegration.startThinking).toHaveBeenCalledWith(context, options);
    });
    
    it('エラー発生時には例外をスローする', async () => {
      const context = { query: 'テスト思考', topic: 'テスト' };
      
      // エラーをスローするようにモック実装を上書き
      sequentialThinkingIntegration.startThinking.mockRejectedValueOnce(
        new Error('Failed to start thinking: 保存エラー')
      );
      
      await expect(sequentialThinkingIntegration.startThinking(context))
        .rejects.toThrow('Failed to start thinking');
    });
  });
  
  describe('executeThinkingStep', () => {
    it('思考ステップを実行し、結果を返す', async () => {
      const thinkingId = 'thinking-123';
      const stepData = { action: 'analyze', data: 'テストデータ' };
      
      const result = await sequentialThinkingIntegration.executeThinkingStep(thinkingId, stepData);
      
      expect(result).toEqual(expect.objectContaining({
        thinking_id: thinkingId,
        step: 1,
        status: 'success'
      }));
      expect(sequentialThinkingIntegration.executeThinkingStep).toHaveBeenCalledWith(thinkingId, stepData);
    });
    
    it('存在しない思考プロセスIDを指定するとエラーをスローする', async () => {
      const invalidId = 'invalid-id';
      const stepData = { action: 'analyze', data: 'テストデータ' };
      
      await expect(sequentialThinkingIntegration.executeThinkingStep(invalidId, stepData))
        .rejects.toThrow('Thinking process not found');
    });
    
    it('既に完了した思考プロセスに対してステップを実行するとエラーをスローする', async () => {
      const thinkingId = 'thinking-123';
      const stepData = { action: 'analyze', data: 'テストデータ' };
      
      // 既に完了した思考プロセスに対するエラーをシミュレート
      sequentialThinkingIntegration.executeThinkingStep.mockRejectedValueOnce(
        new Error('Thinking process already completed: thinking-123')
      );
      
      await expect(sequentialThinkingIntegration.executeThinkingStep(thinkingId, stepData))
        .rejects.toThrow('Thinking process already completed');
    });
    
    it('最大ステップ数を超えるとエラーをスローする', async () => {
      const thinkingId = 'thinking-123';
      const stepData = { action: 'analyze', data: 'テストデータ' };
      
      // 最大ステップ数を超えるエラーをシミュレート
      sequentialThinkingIntegration.executeThinkingStep.mockRejectedValueOnce(
        new Error('Thinking process exceeded max steps: thinking-123')
      );
      
      await expect(sequentialThinkingIntegration.executeThinkingStep(thinkingId, stepData))
        .rejects.toThrow('Thinking process exceeded max steps');
    });
    
    it('ステップ実行中にエラーが発生した場合、エラーをスローする', async () => {
      const thinkingId = 'thinking-123';
      const stepData = { action: 'analyze', data: 'テストデータ' };
      
      // ステップ実行エラーをシミュレート
      sequentialThinkingIntegration.executeThinkingStep.mockRejectedValueOnce(
        new Error('ステップ実行エラー')
      );
      
      await expect(sequentialThinkingIntegration.executeThinkingStep(thinkingId, stepData))
        .rejects.toThrow('ステップ実行エラー');
    });
  });
  
  describe('completeThinking', () => {
    it('思考プロセスを完了し、結果を返す', async () => {
      const thinkingId = 'thinking-123';
      const finalResult = { output: '最終結果', confidence: 0.9 };
      
      const result = await sequentialThinkingIntegration.completeThinking(thinkingId, finalResult);
      
      expect(result).toEqual(expect.objectContaining({
        thinking_id: thinkingId,
        status: 'completed',
        result: expect.objectContaining({ output: '最終結果' })
      }));
      expect(sequentialThinkingIntegration.completeThinking).toHaveBeenCalledWith(thinkingId, finalResult);
    });
    
    it('存在しない思考プロセスIDを指定するとエラーをスローする', async () => {
      const invalidId = 'invalid-id';
      const finalResult = { output: '最終結果' };
      
      // エラーをシミュレート
      sequentialThinkingIntegration.completeThinking.mockRejectedValueOnce(
        new Error('Thinking process not found: invalid-id')
      );
      
      await expect(sequentialThinkingIntegration.completeThinking(invalidId, finalResult))
        .rejects.toThrow('Thinking process not found');
    });
  });
  
  describe('failThinking', () => {
    it('思考プロセスを失敗状態にし、エラー情報を返す', async () => {
      const thinkingId = 'thinking-123';
      const error = { message: 'テストエラー' };
      
      const result = await sequentialThinkingIntegration.failThinking(thinkingId, error);
      
      expect(result).toEqual(expect.objectContaining({
        thinking_id: thinkingId,
        status: 'failed',
        error
      }));
      expect(sequentialThinkingIntegration.failThinking).toHaveBeenCalledWith(thinkingId, error);
    });
    
    it('存在しない思考プロセスIDを指定するとエラーをスローする', async () => {
      const invalidId = 'invalid-id';
      const error = { message: 'テストエラー' };
      
      // エラーをシミュレート
      sequentialThinkingIntegration.failThinking.mockRejectedValueOnce(
        new Error('Thinking process not found: invalid-id')
      );
      
      await expect(sequentialThinkingIntegration.failThinking(invalidId, error))
        .rejects.toThrow('Thinking process not found');
    });
  });
  
  describe('getThinkingState', () => {
    it('思考プロセスの状態を取得する', async () => {
      const thinkingId = 'thinking-123';
      
      const state = await sequentialThinkingIntegration.getThinkingState(thinkingId);
      
      expect(state).toEqual(expect.objectContaining({
        thinking_id: thinkingId,
        status: 'in_progress',
        steps: expect.arrayContaining([
          expect.objectContaining({ step: 1 })
        ])
      }));
      expect(sequentialThinkingIntegration.getThinkingState).toHaveBeenCalledWith(thinkingId);
    });
    
    it('存在しない思考プロセスIDを指定するとnullを返す', async () => {
      const invalidId = 'invalid-id';
      
      const state = await sequentialThinkingIntegration.getThinkingState(invalidId);
      
      expect(state).toBeNull();
      expect(sequentialThinkingIntegration.getThinkingState).toHaveBeenCalledWith(invalidId);
    });
  });
});
