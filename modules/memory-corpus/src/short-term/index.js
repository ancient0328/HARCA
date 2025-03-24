/**
 * @fileoverview 短期記憶モジュールのエントリーポイント
 * 
 * このファイルでは、短期記憶（作業記憶）モジュールのエクスポートを行います。
 */

import { WorkingMemory, WorkingMemoryType } from './working-memory.js';
import { ContextManager, ContextType } from './context-manager.js';

export {
  WorkingMemory,
  WorkingMemoryType,
  ContextManager,
  ContextType
};

/**
 * 短期記憶モジュールの初期化
 * @param {Object} options 設定オプション
 * @returns {Object} 初期化されたモジュールオブジェクト
 */
export function initializeShortTermMemory(options = {}) {
  const workingMemory = new WorkingMemory(options);
  const contextManager = new ContextManager({ 
    ...options, 
    workingMemory 
  });
  
  return {
    workingMemory,
    contextManager
  };
}
