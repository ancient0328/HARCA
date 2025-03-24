/**
 * @fileoverview 記憶強化・減衰モジュール
 * 
 * このファイルでは、記憶の強化と減衰を管理するためのクラスを定義しています。
 * 記憶強化・減衰モジュールは、記憶の重要度や使用頻度に基づいて、
 * 記憶の強度を調整し、効率的な記憶管理を実現します。
 */

/**
 * 記憶強化・減衰クラス
 */
export class MemoryReinforcement {
  /**
   * MemoryReinforcementのインスタンスを作成する
   * @param {Object} options 設定オプション
   */
  constructor(options = {}) {
    // 依存コンポーネント
    this.memorySystem = options.memorySystem;
    this.memoryManager = options.memoryManager;
    
    // 設定
    this.config = {
      // 強化係数（高いほど強化効果が大きい）
      strengthFactor: options.strengthFactor || 0.2,
      // 減衰係数（高いほど減衰が速い）
      decayFactor: options.decayFactor || 0.05,
      // 強化の閾値（この値以上の重要度を持つ記憶のみ強化）
      strengthThreshold: options.strengthThreshold || 0.3,
      // 記憶の最大強度
      maxStrength: options.maxStrength || 1.0,
      // 記憶の最小強度（この値未満になると記憶が削除される可能性がある）
      minStrength: options.minStrength || 0.1,
      // 減衰の間隔（ミリ秒）
      decayInterval: options.decayInterval || 24 * 60 * 60 * 1000, // デフォルトは1日
      // 強化の冷却時間（ミリ秒）
      strengthCooldown: options.strengthCooldown || 60 * 60 * 1000, // デフォルトは1時間
      // 自動減衰の有効化
      autoDecay: options.autoDecay !== false
    };
    
    // 強化履歴
    this.strengthHistory = new Map();
    
    // 自動減衰タイマー
    this.decayTimer = null;
    
    // 自動減衰を開始
    if (this.config.autoDecay) {
      this._startAutoDecay();
    }
  }

  /**
   * 記憶を強化する
   * @param {string|Object} memory 記憶IDまたは記憶オブジェクト
   * @param {Object} options オプション
   * @returns {Promise<Object>} 強化された記憶
   */
  async strengthenMemory(memory, options = {}) {
    try {
      // 記憶オブジェクトを取得
      const memoryObj = typeof memory === 'string' 
        ? await this.memorySystem.getMemory(memory)
        : memory;
      
      if (!memoryObj) {
        throw new Error('Memory not found');
      }
      
      // 記憶IDを取得
      const memoryId = memoryObj.id;
      
      // 強化の冷却時間をチェック
      if (!this._canStrengthen(memoryId)) {
        return memoryObj;
      }
      
      // 記憶の重要度が閾値未満の場合は強化しない
      const importance = memoryObj.metadata?.importance || 0.5;
      if (importance < this.config.strengthThreshold && !options.force) {
        return memoryObj;
      }
      
      // 現在の強度を取得
      const currentStrength = memoryObj.metadata?.strength || 0;
      
      // 強化係数を計算
      const factor = options.factor || this.config.strengthFactor;
      
      // 強度を増加（最大値を超えないように）
      const newStrength = Math.min(
        currentStrength + factor,
        this.config.maxStrength
      );
      
      // 強度が変わらない場合は更新しない
      if (newStrength === currentStrength) {
        return memoryObj;
      }
      
      // 強化履歴を更新
      this._updateStrengthHistory(memoryId);
      
      // メタデータを更新
      const updateData = {
        metadata: {
          ...memoryObj.metadata,
          strength: newStrength,
          last_strengthened: new Date().toISOString(),
          strength_count: (memoryObj.metadata?.strength_count || 0) + 1
        }
      };
      
      // 記憶を更新
      const updatedMemory = await this.memorySystem.updateMemory(memoryId, updateData);
      
      return updatedMemory;
    } catch (error) {
      console.error(`Failed to strengthen memory: ${error.message}`);
      return memory;
    }
  }

  /**
   * 記憶を減衰させる
   * @param {string|Object} memory 記憶IDまたは記憶オブジェクト
   * @param {Object} options オプション
   * @returns {Promise<Object>} 減衰された記憶
   */
  async decayMemory(memory, options = {}) {
    try {
      // 記憶オブジェクトを取得
      const memoryObj = typeof memory === 'string' 
        ? await this.memorySystem.getMemory(memory)
        : memory;
      
      if (!memoryObj) {
        throw new Error('Memory not found');
      }
      
      // 記憶IDを取得
      const memoryId = memoryObj.id;
      
      // 現在の強度を取得
      const currentStrength = memoryObj.metadata?.strength || 0;
      
      // 強度がない場合は減衰しない
      if (currentStrength <= 0) {
        return memoryObj;
      }
      
      // 減衰係数を計算
      const factor = options.factor || this.config.decayFactor;
      
      // 強度を減少
      const newStrength = Math.max(
        currentStrength - factor,
        0
      );
      
      // 強度が変わらない場合は更新しない
      if (newStrength === currentStrength) {
        return memoryObj;
      }
      
      // メタデータを更新
      const updateData = {
        metadata: {
          ...memoryObj.metadata,
          strength: newStrength,
          last_decayed: new Date().toISOString(),
          decay_count: (memoryObj.metadata?.decay_count || 0) + 1
        }
      };
      
      // 記憶を更新
      const updatedMemory = await this.memorySystem.updateMemory(memoryId, updateData);
      
      // 強度が最小値未満になった場合は削除を検討
      if (newStrength < this.config.minStrength && options.autoRemove !== false) {
        await this._considerRemovingMemory(updatedMemory);
      }
      
      return updatedMemory;
    } catch (error) {
      console.error(`Failed to decay memory: ${error.message}`);
      return memory;
    }
  }

  /**
   * 複数の記憶を強化する
   * @param {Array} memories 記憶IDまたは記憶オブジェクトの配列
   * @param {Object} options オプション
   * @returns {Promise<Array>} 強化された記憶の配列
   */
  async strengthenMemories(memories, options = {}) {
    const results = [];
    
    for (const memory of memories) {
      const result = await this.strengthenMemory(memory, options);
      results.push(result);
    }
    
    return results;
  }

  /**
   * 複数の記憶を減衰させる
   * @param {Array} memories 記憶IDまたは記憶オブジェクトの配列
   * @param {Object} options オプション
   * @returns {Promise<Array>} 減衰された記憶の配列
   */
  async decayMemories(memories, options = {}) {
    const results = [];
    
    for (const memory of memories) {
      const result = await this.decayMemory(memory, options);
      results.push(result);
    }
    
    return results;
  }

  /**
   * すべての記憶を減衰させる
   * @param {Object} options オプション
   * @returns {Promise<number>} 減衰された記憶の数
   */
  async decayAllMemories(options = {}) {
    try {
      // 減衰対象の記憶を取得
      const memories = await this._getMemoriesForDecay(options);
      
      // 記憶がない場合は0を返す
      if (!memories || memories.length === 0) {
        return 0;
      }
      
      // 各記憶を減衰
      let decayedCount = 0;
      
      for (const memory of memories) {
        await this.decayMemory(memory, options);
        decayedCount++;
      }
      
      return decayedCount;
    } catch (error) {
      console.error(`Failed to decay all memories: ${error.message}`);
      return 0;
    }
  }

  /**
   * 記憶の強度を取得する
   * @param {string|Object} memory 記憶IDまたは記憶オブジェクト
   * @returns {Promise<number>} 記憶の強度
   */
  async getMemoryStrength(memory) {
    try {
      // 記憶オブジェクトを取得
      const memoryObj = typeof memory === 'string' 
        ? await this.memorySystem.getMemory(memory)
        : memory;
      
      if (!memoryObj) {
        throw new Error('Memory not found');
      }
      
      // 強度を返す
      return memoryObj.metadata?.strength || 0;
    } catch (error) {
      console.error(`Failed to get memory strength: ${error.message}`);
      return 0;
    }
  }

  /**
   * 自動減衰を開始する
   * @private
   */
  _startAutoDecay() {
    // 既存のタイマーをクリア
    if (this.decayTimer) {
      clearInterval(this.decayTimer);
    }
    
    // 新しいタイマーを設定
    this.decayTimer = setInterval(async () => {
      try {
        const decayedCount = await this.decayAllMemories();
        console.log(`Auto decay completed: ${decayedCount} memories decayed`);
      } catch (error) {
        console.error(`Auto decay failed: ${error.message}`);
      }
    }, this.config.decayInterval);
  }

  /**
   * 自動減衰を停止する
   */
  stopAutoDecay() {
    if (this.decayTimer) {
      clearInterval(this.decayTimer);
      this.decayTimer = null;
    }
  }

  /**
   * 記憶を強化できるかどうかを確認する
   * @param {string} memoryId 記憶ID
   * @returns {boolean} 強化可能な場合はtrue
   * @private
   */
  _canStrengthen(memoryId) {
    // 強化履歴を取得
    const lastStrengthened = this.strengthHistory.get(memoryId);
    
    // 履歴がない場合は強化可能
    if (!lastStrengthened) {
      return true;
    }
    
    // 現在時刻を取得
    const now = Date.now();
    
    // 冷却時間を経過しているかどうかを確認
    return now - lastStrengthened >= this.config.strengthCooldown;
  }

  /**
   * 強化履歴を更新する
   * @param {string} memoryId 記憶ID
   * @private
   */
  _updateStrengthHistory(memoryId) {
    this.strengthHistory.set(memoryId, Date.now());
    
    // 履歴のサイズを制限
    if (this.strengthHistory.size > 1000) {
      // 最も古い履歴を削除
      const oldestId = Array.from(this.strengthHistory.entries())
        .sort(([, a], [, b]) => a - b)[0][0];
      
      this.strengthHistory.delete(oldestId);
    }
  }

  /**
   * 減衰対象の記憶を取得する
   * @param {Object} options オプション
   * @returns {Promise<Array>} 減衰対象の記憶の配列
   * @private
   */
  async _getMemoriesForDecay(options = {}) {
    try {
      // 最終減衰時刻を計算
      const now = new Date();
      const lastDecayTime = new Date(now.getTime() - this.config.decayInterval);
      
      // 減衰対象の記憶を検索
      const memories = await this.memoryManager.getMemories({
        filter: {
          // 最終減衰時刻より前に更新された記憶
          updated_before: lastDecayTime.toISOString(),
          // 強度が0より大きい記憶
          min_strength: 0.01
        },
        limit: options.limit || 100,
        offset: options.offset || 0
      });
      
      return memories;
    } catch (error) {
      console.error(`Failed to get memories for decay: ${error.message}`);
      return [];
    }
  }

  /**
   * 記憶の削除を検討する
   * @param {Object} memory 記憶オブジェクト
   * @returns {Promise<boolean>} 削除された場合はtrue
   * @private
   */
  async _considerRemovingMemory(memory) {
    try {
      // 記憶の重要度を取得
      const importance = memory.metadata?.importance || 0.5;
      
      // 重要度が高い場合は削除しない
      if (importance >= 0.7) {
        return false;
      }
      
      // 強度が最小値未満の場合は削除を検討
      const strength = memory.metadata?.strength || 0;
      
      if (strength < this.config.minStrength) {
        // 削除確率を計算（重要度が低いほど削除確率が高い）
        const removalProbability = 1 - importance;
        
        // ランダムに削除するかどうかを決定
        if (Math.random() < removalProbability) {
          // 記憶を削除
          await this.memorySystem.deleteMemory(memory.id);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to consider removing memory: ${error.message}`);
      return false;
    }
  }
}
