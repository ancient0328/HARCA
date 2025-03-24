/**
 * Redis キャッシュマネージャー
 * 
 * このモジュールは、Redisを使用した分散キャッシュの管理を担当します。
 * 複数のサーバーインスタンス間でのキャッシュ共有と同期を実現します。
 */

import Redis from 'ioredis';
import { promisify } from 'util';
import crypto from 'crypto';

class RedisCacheManager {
  /**
   * Redis キャッシュマネージャーを初期化します
   * @param {Object} config 設定オブジェクト
   * @param {string} config.redisUrl Redis接続URL（例: 'redis://localhost:6379'）
   * @param {string} config.keyPrefix キャッシュキーのプレフィックス
   * @param {number} config.defaultTTL デフォルトのTTL（秒）
   * @param {boolean} config.enablePubSub PubSubによるキャッシュ同期を有効にするかどうか
   * @param {string} config.instanceId このインスタンスの一意のID
   */
  constructor(config = {}) {
    // 環境変数から設定を読み込む
    const envRedisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const envRedisCacheTTL = parseInt(process.env.REDIS_CACHE_TTL || '86400', 10);
    const envRedisCachePrefix = process.env.REDIS_CACHE_PREFIX || 'harca';
    
    // 設定の初期化
    this.config = {
      redisUrl: config.redisUrl || envRedisUrl,
      defaultTTL: config.defaultTTL || envRedisCacheTTL,
      keyPrefix: config.keyPrefix || `${envRedisCachePrefix}:embedding:`,
      enablePubSub: config.enablePubSub !== undefined ? config.enablePubSub : true,
      instanceId: crypto.randomBytes(8).toString('hex')
    };
    
    // メインのRedisクライアント
    this.redis = new Redis(this.config.redisUrl);
    
    // PubSub用の別のRedisクライアント（有効な場合）
    if (this.config.enablePubSub) {
      // 購読用のクライアント
      this.subscriber = new Redis(this.config.redisUrl);
      // 発行用のクライアント（別接続）
      this.publisher = new Redis(this.config.redisUrl);
      this._setupPubSub();
    }
    
    // キャッシュ操作のイベントリスナー
    this.eventListeners = {
      set: [],
      delete: [],
      clear: []
    };
    
    console.log(`Redis分散キャッシュマネージャーを初期化しました（インスタンスID: ${this.config.instanceId}）`);
  }
  
  /**
   * このインスタンスの一意のIDを生成します
   * @returns {string} インスタンスID
   * @private
   */
  _generateInstanceId() {
    return crypto.randomBytes(8).toString('hex');
  }
  
  /**
   * PubSubの設定を行います
   * @private
   */
  _setupPubSub() {
    const channel = `${this.config.keyPrefix}pubsub`;
    
    // 購読設定
    this.subscriber.subscribe(channel, (err) => {
      if (err) {
        console.error('Redisチャンネルの購読に失敗しました:', err);
        return;
      }
      console.log(`Redisチャンネル '${channel}' を購読しています`);
    });
    
    // メッセージ受信ハンドラ
    this.subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        
        // 自分自身が発行したメッセージは無視
        if (data.instanceId === this.config.instanceId) return;
        
        // 特別なメッセージタイプの処理
        if (data.type === 'clearModel' && data.metadata && data.metadata.modelName) {
          this.clearModelCache(data.metadata.modelName)
            .then(() => console.log(`PubSubメッセージにより ${data.metadata.modelName} モデルのキャッシュをクリアしました`))
            .catch(err => console.error(`PubSubメッセージによるモデルキャッシュのクリア中にエラーが発生しました:`, err));
        }
        
        // イベントタイプに応じてリスナーに通知
        if (data.type && this.eventListeners[data.type]) {
          this._notifyListeners(data.type, data.key, data.metadata);
        }
      } catch (err) {
        console.error('受信したメッセージの処理中にエラーが発生しました:', err);
      }
    });
  }
  
  /**
   * PubSubを通じてメッセージを発行します
   * @param {string} type イベントタイプ（'set', 'delete', 'clear'）
   * @param {string} key キャッシュキー
   * @param {Object} metadata 追加のメタデータ
   * @private
   */
  _publishMessage(type, key = null, metadata = null) {
    if (!this.config.enablePubSub || !this.publisher) return;
    
    const channel = `${this.config.keyPrefix}pubsub`;
    const message = JSON.stringify({
      type,
      key,
      metadata,
      instanceId: this.config.instanceId,
      timestamp: Date.now()
    });
    
    this.publisher.publish(channel, message).catch(err => {
      console.error('メッセージの発行に失敗しました:', err);
    });
  }
  
  /**
   * イベントリスナーに通知します
   * @param {string} event イベント名
   * @param {string} key キャッシュキー
   * @param {Object} metadata 追加のメタデータ
   * @private
   */
  _notifyListeners(event, key = null, metadata = null) {
    if (!this.eventListeners[event]) return;
    
    for (const listener of this.eventListeners[event]) {
      try {
        listener(key, metadata);
      } catch (err) {
        console.error(`${event}イベントリスナーの実行中にエラーが発生しました:`, err);
      }
    }
  }
  
  /**
   * キャッシュキーを生成します
   * @param {string} text テキスト
   * @param {string} modelName モデル名
   * @returns {string} キャッシュキー
   * @private
   */
  _getCacheKey(text, modelName) {
    const hash = crypto.createHash('md5').update(`${text}:${modelName}`).digest('hex');
    return `${this.config.keyPrefix}${hash}`;
  }
  
  /**
   * キャッシュからデータを取得します
   * @param {string} text テキスト
   * @param {string} modelName モデル名
   * @returns {Promise<Object|null>} キャッシュされたデータ、または存在しない場合はnull
   */
  async get(text, modelName = 'default') {
    const key = this._getCacheKey(text, modelName);
    
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      
      return JSON.parse(data);
    } catch (err) {
      console.error('Redisからのデータ取得中にエラーが発生しました:', err);
      return null;
    }
  }
  
  /**
   * データをキャッシュに設定します
   * @param {string} text テキスト
   * @param {Object} data 保存するデータ
   * @param {string} modelName モデル名
   * @param {number} ttl TTL（秒）、指定しない場合はデフォルト値を使用
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async set(text, data, modelName = 'default', ttl = null) {
    const key = this._getCacheKey(text, modelName);
    const effectiveTTL = ttl || this.config.defaultTTL;
    
    try {
      const serializedData = JSON.stringify(data);
      
      // TTLを設定してデータを保存
      await this.redis.setex(key, effectiveTTL, serializedData);
      
      // メタデータ
      const metadata = {
        modelName,
        ttl: effectiveTTL,
        timestamp: Date.now()
      };
      
      // イベントリスナーに通知
      this._notifyListeners('set', key, metadata);
      
      // PubSubを通じて他のインスタンスに通知
      this._publishMessage('set', key, metadata);
      
      return true;
    } catch (err) {
      console.error('Redisへのデータ設定中にエラーが発生しました:', err);
      return false;
    }
  }
  
  /**
   * キャッシュからデータを削除します
   * @param {string} text テキスト
   * @param {string} modelName モデル名
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async delete(text, modelName = 'default') {
    const key = this._getCacheKey(text, modelName);
    
    try {
      await this.redis.del(key);
      
      // イベントリスナーに通知
      this._notifyListeners('delete', key);
      
      // PubSubを通じて他のインスタンスに通知
      this._publishMessage('delete', key);
      
      return true;
    } catch (err) {
      console.error('Redisからのデータ削除中にエラーが発生しました:', err);
      return false;
    }
  }
  
  /**
   * 特定のパターンに一致するキーを検索します
   * @param {string} pattern 検索パターン
   * @returns {Promise<Array<string>>} 一致するキーのリスト
   */
  async findKeys(pattern) {
    try {
      // パターンにプレフィックスが含まれているかチェック
      const searchPattern = pattern.startsWith(this.config.keyPrefix) 
        ? pattern 
        : `${this.config.keyPrefix}${pattern}`;
      
      console.log(`キーを検索: パターン=${searchPattern}`);
      const keys = await this.redis.keys(searchPattern);
      console.log(`検索結果: ${keys.length}件のキーが見つかりました`);
      return keys;
    } catch (err) {
      console.error('キーの検索中にエラーが発生しました:', err);
      return [];
    }
  }
  
  /**
   * 特定のモデルのすべてのキャッシュを削除します
   * @param {string} modelName モデル名
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async clearModelCache(modelName) {
    try {
      console.log(`モデル ${modelName} のキャッシュをクリアします...`);
      
      // このモデルに関連するすべてのキーを検索
      // モデル名は通常キーの末尾にあるため、ワイルドカードを使用
      const keys = await this.findKeys(`*${modelName}`);
      
      if (keys.length === 0) {
        console.log(`モデル ${modelName} のキャッシュキーが見つかりませんでした`);
        return true;
      }
      
      console.log(`モデル ${modelName} のキャッシュキーを削除します: ${keys.length}件`);
      
      // 一括削除
      await this.redis.del(keys);
      
      // イベントリスナーに通知
      this._notifyListeners('clear');
      
      // PubSubを通じて他のインスタンスに通知
      this._publishMessage('clear');
      
      console.log(`モデル ${modelName} のキャッシュを正常にクリアしました`);
      return true;
    } catch (err) {
      console.error(`モデル ${modelName} のキャッシュクリア中にエラーが発生しました:`, err);
      return false;
    }
  }
  
  /**
   * すべてのキャッシュを削除します
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async clear() {
    try {
      console.log('Redis分散キャッシュのすべてのキーを検索しています...');
      const keys = await this.findKeys('*');
      
      if (!keys || keys.length === 0) {
        console.log('削除するキーが見つかりませんでした');
        return true;
      }
      
      console.log(`${keys.length}個のキーを削除します...`);
      
      // バッチサイズを設定（大きすぎると処理が遅くなる可能性があります）
      const batchSize = 100;
      const batches = [];
      
      // キーをバッチに分割
      for (let i = 0; i < keys.length; i += batchSize) {
        batches.push(keys.slice(i, i + batchSize));
      }
      
      console.log(`${batches.length}バッチに分割して削除を実行します（バッチサイズ: ${batchSize}）`);
      
      // 各バッチを処理
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`バッチ ${i + 1}/${batches.length} を処理中... (${batch.length}キー)`);
        
        if (batch.length > 0) {
          // DELコマンドを使用して一度に複数のキーを削除
          await this.redis.del(batch);
        }
      }
      
      console.log(`${keys.length}個のキーを削除しました`);
      
      // PubSubを通じて他のインスタンスに通知
      this._publishMessage('clear', null, null);
      
      return true;
    } catch (error) {
      console.error('Redis分散キャッシュのクリア中にエラーが発生しました:', error);
      return false;
    }
  }
  
  /**
   * キャッシュの統計情報を取得します
   * @returns {Promise<Object>} 統計情報
   */
  async getStats() {
    try {
      // Redisの情報を取得
      const info = await this.redis.info();
      
      // キャッシュキーの数を取得
      const keys = await this.redis.keys(`${this.config.keyPrefix}*`);
      
      // モデル別のキー数を集計
      const modelStats = {};
      for (const key of keys) {
        const parts = key.split(':');
        const modelName = parts[parts.length - 1] || 'unknown';
        
        if (!modelStats[modelName]) {
          modelStats[modelName] = 0;
        }
        
        modelStats[modelName]++;
      }
      
      return {
        totalKeys: keys.length,
        modelStats,
        redisInfo: this._parseRedisInfo(info)
      };
    } catch (err) {
      console.error('キャッシュ統計情報の取得中にエラーが発生しました:', err);
      return {
        totalKeys: 0,
        modelStats: {},
        redisInfo: {}
      };
    }
  }
  
  /**
   * Redis INFO コマンドの出力を解析します
   * @param {string} info Redis INFO コマンドの出力
   * @returns {Object} 解析された情報
   * @private
   */
  _parseRedisInfo(info) {
    const result = {};
    const lines = info.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;
      
      const [key, value] = line.split(':');
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    }
    
    return result;
  }
  
  /**
   * イベントリスナーを登録します
   * @param {string} event イベント名（'set', 'delete', 'clear'）
   * @param {Function} listener リスナー関数
   */
  on(event, listener) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    
    this.eventListeners[event].push(listener);
  }
  
  /**
   * イベントリスナーを削除します
   * @param {string} event イベント名
   * @param {Function} listener 削除するリスナー関数
   */
  off(event, listener) {
    if (!this.eventListeners[event]) return;
    
    this.eventListeners[event] = this.eventListeners[event].filter(l => l !== listener);
  }
  
  /**
   * Redis接続を閉じます
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async close() {
    try {
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      
      if (this.publisher) {
        await this.publisher.quit();
      }
      
      if (this.redis) {
        await this.redis.quit();
      }
      
      console.log('Redis接続を閉じました');
      return true;
    } catch (error) {
      console.error('Redis接続を閉じる際にエラーが発生しました:', error);
      return false;
    }
  }
}

export { RedisCacheManager };
