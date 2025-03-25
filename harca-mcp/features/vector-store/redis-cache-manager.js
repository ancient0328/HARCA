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
      clear: [],
      invalidate: [],
      updateExpiry: []
    };
    
    // 統計情報
    this.stats = {
      startTime: Date.now(),
      hits: 0,
      misses: 0,
      gets: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      published: 0,
      received: 0
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
          // 送信元のインスタンスIDを渡して、無限ループを防止
          const sourceInstance = data.metadata.sourceInstance || null;
          this.clearModelCache(data.metadata.modelName, sourceInstance)
            .then(() => console.log(`PubSubメッセージにより ${data.metadata.modelName} モデルのキャッシュをクリアしました`))
            .catch(err => console.error(`PubSubメッセージによるモデルキャッシュのクリア中にエラーが発生しました:`, err));
        }
        
        // イベントタイプに応じてリスナーに通知
        if (data.type && this.eventListeners[data.type]) {
          this._notifyListeners(data.type, data.key, data.metadata);
        }
        
        // 統計情報の更新
        if (data.type === 'set') {
          this.stats.sets++;
        } else if (data.type === 'delete') {
          this.stats.deletes++;
        } else if (data.type === 'clear') {
          this.stats.errors++;
        }
        
        this.stats.received++;
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
    
    this.stats.published++;
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
      if (!data) {
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      this.stats.gets++;
      
      return JSON.parse(data);
    } catch (err) {
      console.error('Redisからのデータ取得中にエラーが発生しました:', err);
      this.stats.errors++;
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
      this.stats.errors++;
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
      this.stats.errors++;
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
      this.stats.errors++;
      return [];
    }
  }
  
  /**
   * 特定のモデルのすべてのRedisキャッシュを削除し、必要に応じて他のインスタンスに通知します
   * @param {string} modelName モデル名
   * @param {string} [sourceInstanceId] 送信元のインスタンスID（自分自身のイベントを無視するため）
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async clearModelCache(modelName, sourceInstanceId = null) {
    try {
      console.log(`Redis分散キャッシュから ${modelName} モデルのエントリを削除しています...`);
      
      // 1. すべてのキーを取得
      const keys = await this.redis.keys(`${this.config.keyPrefix}*`);
      console.log(`Redis分散キャッシュで ${keys.length} 件のキーを検出しました`);
      
      // 2. 各キーの内容を確認して、指定されたモデルのエントリを削除
      let deletedCount = 0;
      
      for (const key of keys) {
        try {
          // キーの内容を取得
          const value = await this.redis.get(key);
          if (!value) continue;
          
          // JSONとしてパース
          const cacheEntry = JSON.parse(value);
          
          // モデル名が一致するかチェック
          if (cacheEntry && cacheEntry.modelName === modelName) {
            await this.redis.del(key);
            deletedCount++;
          }
        } catch (error) {
          console.error(`キー ${key} の処理中にエラーが発生しました:`, error);
        }
      }
      
      console.log(`Redis分散キャッシュから ${modelName} モデルの ${deletedCount} エントリを削除しました`);
      
      // 3. 他のインスタンスに通知
      if (this.config.enablePubSub && sourceInstanceId !== this.config.instanceId) {
        this._publishMessage('clearModel', null, { 
          modelName, 
          sourceInstance: sourceInstanceId || this.config.instanceId 
        });
      }
      
      return true;
    } catch (error) {
      console.error(`Redis分散キャッシュからの ${modelName} モデルの削除中にエラーが発生しました:`, error);
      this.stats.errors++;
      return false;
    }
  }
  
  /**
   * Redis内のすべてのキャッシュエントリをクリアします
   * @param {string} [sourceInstanceId] 送信元のインスタンスID（自分自身のイベントを無視するため）
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async clear(sourceInstanceId = null) {
    try {
      console.log('Redis内のすべてのキャッシュをクリアしています...');
      
      // キャッシュキーのパターンを指定してすべてのキーを取得
      const pattern = `${this.config.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length === 0) {
        console.log('クリアするキャッシュエントリがありません');
        return true;
      }
      
      console.log(`${keys.length}個のキャッシュエントリをクリアします`);
      
      // 一度に複数のキーを削除（パフォーマンス向上のため）
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      // 他のインスタンスにも通知
      if (this.config.enablePubSub && sourceInstanceId !== this.config.instanceId) {
        this._publishMessage('clear', null, { 
          sourceInstance: sourceInstanceId || this.config.instanceId 
        });
      }
      
      console.log('Redis内のすべてのキャッシュを正常にクリアしました');
      return true;
    } catch (error) {
      console.error('Redis内のキャッシュクリア中にエラーが発生しました:', error);
      this.stats.errors++;
      return false;
    }
  }
  
  /**
   * Redis分散キャッシュの統計情報を取得します
   * @returns {Promise<Object>} 統計情報
   */
  async getStats() {
    try {
      // キャッシュサイズの取得
      const keys = await this.redis.keys(`${this.config.keyPrefix}:*`);
      const size = keys.length;
      
      // 統計情報の準備
      const stats = {
        // 基本統計情報
        size,
        
        // ヒット率
        hits: this.stats.hits || 0,
        misses: this.stats.misses || 0,
        hitRate: (this.stats.hits + this.stats.misses) > 0 
          ? this.stats.hits / (this.stats.hits + this.stats.misses) 
          : 0,
        
        // 操作統計
        operations: {
          gets: this.stats.gets || 0,
          sets: this.stats.sets || 0,
          deletes: this.stats.deletes || 0,
          total: (this.stats.gets || 0) + (this.stats.sets || 0) + (this.stats.deletes || 0)
        },
        
        // エラー統計
        errors: this.stats.errors || 0,
        
        // PubSub統計
        pubsub: {
          published: this.stats.published || 0,
          received: this.stats.received || 0
        },
        
        // 稼働時間
        uptime: Date.now() - this.stats.startTime
      };
      
      return stats;
    } catch (error) {
      console.error('Redis統計情報の取得中にエラーが発生しました:', error);
      this.stats.errors++;
      return {
        size: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        operations: {
          gets: 0,
          sets: 0,
          deletes: 0,
          total: 0
        },
        errors: 0,
        pubsub: {
          published: 0,
          received: 0
        },
        uptime: 0,
        error: error.message
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
      this.stats.errors++;
      return false;
    }
  }
  
  /**
   * キャッシュ無効化イベントを発行します
   * @param {string} text テキスト
   * @param {string} modelName モデル名
   * @param {Object} metadata 追加のメタデータ
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async publishInvalidationEvent(text, modelName, metadata = {}) {
    if (!this.config.enablePubSub) {
      return false;
    }
    
    try {
      // キーを生成
      const key = this._getCacheKey(text, modelName);
      
      // 無効化イベントを発行
      this._publishMessage('invalidate', key, {
        ...metadata,
        modelName,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error('キャッシュ無効化イベントの発行に失敗しました:', error);
      this.stats.errors++;
      return false;
    }
  }
  
  /**
   * 特定のモデルに関連するすべてのキャッシュを無効化します
   * @param {string} modelName モデル名
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async invalidateModelCache(modelName) {
    if (!modelName) {
      return false;
    }
    
    try {
      // モデル無効化イベントを発行
      this._publishMessage('clearModel', null, {
        modelName,
        timestamp: Date.now()
      });
      
      // モデル名に基づいてキーパターンを作成
      const pattern = `${this.config.keyPrefix}*:${modelName}:*`;
      
      // パターンに一致するすべてのキーを検索
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        // 一括削除
        await this.redis.del(keys);
        console.log(`モデル '${modelName}' に関連する ${keys.length} 個のキャッシュエントリを無効化しました`);
      }
      
      return true;
    } catch (error) {
      console.error(`モデル '${modelName}' のキャッシュ無効化に失敗しました:`, error);
      this.stats.errors++;
      return false;
    }
  }
  
  /**
   * キャッシュの有効期限を更新します
   * @param {string} key キャッシュキー
   * @param {number} ttl 新しいTTL（秒）
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async updateExpiry(key, ttl) {
    try {
      const exists = await this.redis.exists(key);
      if (!exists) {
        return false;
      }
      
      await this.redis.expire(key, ttl);
      
      // 更新イベントを発行
      this._publishMessage('updateExpiry', key, {
        ttl,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error('キャッシュの有効期限更新に失敗しました:', error);
      this.stats.errors++;
      return false;
    }
  }
  
  /**
   * パターンに一致するキーを削除します
   * @param {string} pattern 削除するキーのパターン
   * @returns {Promise<Object>} 削除結果（成功したかどうかと削除されたキーの数）
   */
  async deleteByPattern(pattern) {
    try {
      // パターンにプレフィックスが含まれているかチェック
      const searchPattern = pattern.startsWith(this.config.keyPrefix) 
        ? pattern 
        : `${this.config.keyPrefix}${pattern}`;
      
      console.log(`キーを検索: パターン=${searchPattern}`);
      const keys = await this.findKeys(searchPattern);
      
      if (keys.length === 0) {
        console.log(`パターン ${searchPattern} に一致するキーが見つかりませんでした`);
        return { success: true, count: 0 };
      }
      
      console.log(`${keys.length}個のキーを削除します...`);
      
      // バッチサイズを設定
      const batchSize = 100;
      const batches = [];
      
      // キーをバッチに分割
      for (let i = 0; i < keys.length; i += batchSize) {
        batches.push(keys.slice(i, i + batchSize));
      }
      
      // 各バッチを処理
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`バッチ ${i + 1}/${batches.length} を処理中... (${batch.length}キー)`);
        
        if (batch.length > 0) {
          // DELコマンドを使用して一度に複数のキーを削除
          await this.redis.del(batch);
        }
      }
      
      console.log(`パターン ${searchPattern} に一致する ${keys.length}個のキーを削除しました`);
      
      // 各キーの削除イベントを発行
      for (const key of keys) {
        this._notifyListeners('delete', key);
      }
      
      // 一括削除イベントを発行
      this._publishMessage('bulkDelete', null, {
        pattern: searchPattern,
        count: keys.length,
        timestamp: Date.now()
      });
      
      return { success: true, count: keys.length };
    } catch (error) {
      console.error(`パターン ${pattern} に一致するキーの削除中にエラーが発生しました:`, error);
      this.stats.errors++;
      return { success: false, count: 0, error: error.message };
    }
  }
  
  /**
   * 特定のキーの無効化イベントを発行します
   * @param {string} key 無効化するキー
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async publishInvalidation(key) {
    try {
      this._publishMessage('invalidate', key, {
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error('無効化イベントの発行中にエラーが発生しました:', error);
      this.stats.errors++;
      return false;
    }
  }
  
  /**
   * 特定のモデルの無効化イベントを発行します
   * @param {string} modelName 無効化するモデル名
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async publishModelInvalidation(modelName) {
    try {
      this._publishMessage('clearModel', null, {
        modelName,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error(`モデル ${modelName} の無効化イベント発行中にエラーが発生しました:`, error);
      this.stats.errors++;
      return false;
    }
  }
  
  /**
   * パターンに一致するキャッシュエントリを一括削除します
   * @param {string} pattern 削除するキーのパターン（正規表現文字列）
   * @param {string} [sourceInstanceId] 送信元のインスタンスID（自分自身のイベントを無視するため）
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async bulkDelete(pattern, sourceInstanceId = null) {
    try {
      console.log(`パターン ${pattern} に一致するRedisキャッシュエントリを一括削除します`);
      
      // 1. すべてのキーを取得
      const allKeys = await this.redis.keys(`${this.config.keyPrefix}:*`);
      
      // 2. パターンに一致するキーをフィルタリング
      const regex = new RegExp(pattern);
      const matchingKeys = allKeys.filter(key => regex.test(key));
      
      console.log(`${allKeys.length}件のキーのうち、${matchingKeys.length}件がパターン ${pattern} に一致しました`);
      
      // 3. 一致したキーを削除
      let deletedCount = 0;
      
      if (matchingKeys.length > 0) {
        // バッチサイズを定義
        const batchSize = 100;
        
        // キーをバッチに分割して削除
        for (let i = 0; i < matchingKeys.length; i += batchSize) {
          const batch = matchingKeys.slice(i, i + batchSize);
          console.log(`バッチ ${Math.floor(i / batchSize) + 1}/${Math.ceil(matchingKeys.length / batchSize)} を処理中... (${batch.length}キー)`);
          
          if (batch.length > 0) {
            const result = await this.redis.del(batch);
            deletedCount += result;
          }
        }
      }
      
      console.log(`Redis分散キャッシュから ${deletedCount} 件のキーを削除しました`);
      
      // 4. 他のインスタンスに通知
      if (this.config.enablePubSub && sourceInstanceId !== this.config.instanceId) {
        this._publishMessage('bulkDelete', pattern, { 
          sourceInstance: sourceInstanceId || this.config.instanceId 
        });
      }
      
      return true;
    } catch (error) {
      console.error(`パターン ${pattern} に一致するキャッシュエントリの一括削除中にエラーが発生しました:`, error);
      this.stats.errors++;
      return false;
    }
  }
}

export { RedisCacheManager };
