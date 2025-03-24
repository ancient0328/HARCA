/**
 * @fileoverview 中期記憶モジュールのエントリーポイント
 * 
 * このファイルでは、中期記憶（エピソード記憶）モジュールのエクスポートを行います。
 */

import { EpisodicMemory, EpisodicMemoryType } from './episodic-memory.js';
import { UserProfile, ProfileAttributeType } from './user-profile.js';

export {
  EpisodicMemory,
  EpisodicMemoryType,
  UserProfile,
  ProfileAttributeType
};

/**
 * 中期記憶モジュールの初期化
 * @param {Object} options 設定オプション
 * @returns {Object} 初期化されたモジュールオブジェクト
 */
export function initializeMidTermMemory(options = {}) {
  const episodicMemory = new EpisodicMemory(options);
  const userProfile = new UserProfile({ 
    ...options, 
    episodicMemory 
  });
  
  return {
    episodicMemory,
    userProfile
  };
}
