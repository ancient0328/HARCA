// harca-mcp/features/vector-store/embedding-cache.js - 埋め込みベクトルのキャッシュ機能
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { RedisCacheManager } from './redis-cache-manager.js';

// ESモジュールで__dirnameを取得するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * LRU（Least Recently Used）キャッシュの実装
 * メモリ内キャッシュに使用
 */
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0
    };
  }
  
  /**
   * キャッシュからアイテムを取得
   * @param {string} key - キャッシュキー
   * @returns {*} キャッシュされた値、存在しない場合はnull
   */
  get(key) {
    if (!this.cache.has(key)) {
      this.stats.misses++;
      return null;
    }
    
    // キャッシュヒット時はアイテムを最新に更新
    const item = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, item);
    
    this.stats.hits++;
    return item;
  }
  
  /**
   * キャッシュにアイテムを設定
   * @param {string} key - キャッシュキー
   * @param {*} value - キャッシュする値
   */
  set(key, value) {
    // キャッシュが容量に達した場合、最も古いアイテムを削除
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, value);
  }
  
  /**
   * キャッシュをクリア
   */
  clear() {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0
    };
  }
  
  /**
   * キャッシュサイズを取得
   * @returns {number} 現在のキャッシュサイズ
   */
  size() {
    return this.cache.size;
  }
  
  /**
   * キャッシュ統計を取得
   * @returns {Object} キャッシュ統計情報
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%' 
        : '0%'
    };
  }
  
  /**
   * キャッシュのすべてのキーを取得
   * @returns {Iterator} キャッシュキーのイテレーター
   */
  keys() {
    return this.cache.keys();
  }
  
  /**
   * キャッシュからアイテムを削除
   * @param {string} key - 削除するキャッシュキー
   * @returns {boolean} 削除に成功した場合はtrue、キーが存在しない場合はfalse
   */
  delete(key) {
    if (!this.cache.has(key)) {
      return false;
    }
    
    this.cache.delete(key);
    return true;
  }
}

/**
 * 階層型埋め込みキャッシュクラス
 * メモリ内キャッシュとファイルキャッシュを組み合わせた高速かつ永続的なキャッシュシステム
 */
class EmbeddingCache {
  /**
   * 埋め込みキャッシュを初期化します
   * @param {Object} config 設定オブジェクト
   */
  constructor(config = {}) {
    // デフォルト設定
    this.config = {
      // キャッシュの有効化設定
      enableMemoryCache: process.env.ENABLE_MEMORY_CACHE !== 'false',
      enableFileCache: process.env.ENABLE_FILE_CACHE !== 'false',
      enableRedisCache: process.env.REDIS_CACHE_ENABLED === 'true',
      
      // キャッシュディレクトリ
      cacheDir: process.env.CACHE_DIR || path.join(process.cwd(), 'cache', 'embeddings'),
      
      // キャッシュサイズ制限
      maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || '10000'),
      memoryLimit: parseInt(process.env.MEMORY_CACHE_LIMIT || '1000'),
      
      // TTL設定
      useAdaptiveTtl: process.env.USE_ADAPTIVE_TTL !== 'false',
      defaultTTL: parseInt(process.env.DEFAULT_CACHE_TTL || '86400'), // 1日（秒）
      minTTL: parseInt(process.env.MIN_CACHE_TTL || '3600'),         // 1時間（秒）
      maxTTL: parseInt(process.env.MAX_CACHE_TTL || '604800'),       // 1週間（秒）
      
      // プリフェッチ設定
      enablePrefetch: process.env.ENABLE_PREFETCH === 'true',
      prefetchThreshold: parseFloat(process.env.PREFETCH_THRESHOLD || '0.7'),
      
      // 圧縮設定
      enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
      compressionLevel: parseInt(process.env.COMPRESSION_LEVEL || '6'),
      compressionThreshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024'),
      
      // 詳細な統計情報
      enableDetailedStats: process.env.ENABLE_DETAILED_STATS !== 'false',
      
      // インスタンスID（分散環境での識別用）
      instanceId: crypto.randomUUID()
    };
    
    // ユーザー設定でデフォルト設定を上書き
    Object.assign(this.config, config);
    
    // キャッシュディレクトリの作成
    if (this.config.enableFileCache && !fs.existsSync(this.config.cacheDir)) {
      fs.mkdirSync(this.config.cacheDir, { recursive: true });
    }
    
    // メモリキャッシュの初期化
    this.memoryCache = this.config.enableMemoryCache ? new LRUCache(this.config.memoryLimit) : null;
    this.memoryCacheSize = 0;
    
    // Redis分散キャッシュの初期化
    this.redisCache = this.config.enableRedisCache ? new RedisCacheManager({
      instanceId: this.config.instanceId,
      enablePubSub: true
    }) : null;
    
    // ファイルキャッシュの初期化
    this.fileCacheSize = 0;
    if (this.config.enableFileCache) {
      this._loadFileCache();
    }
    
    // アクセス頻度の追跡
    this.frequencyMap = new Map();
    this.recentAccesses = [];
    this.recentAccessWindow = 24 * 60 * 60 * 1000; // 24時間（ミリ秒）
    
    // 統計情報の初期化
    this.stats = {
      startTime: Date.now(),
      memory: {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        requests: 0,
        modelInvalidations: 0
      },
      redis: {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        requests: 0,
        modelInvalidations: 0
      },
      file: {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        requests: 0,
        modelInvalidations: 0
      },
      total: {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        requests: 0
      },
      syncs: {
        memory: 0,
        redis: 0,
        file: 0,
        total: 0
      },
      errors: {
        memory: 0,
        redis: 0,
        file: 0,
        general: 0
      },
      adaptiveTtlStats: {
        extended: 0,
        reduced: 0,
        unchanged: 0,
        totalTtl: 0,
        count: 0
      },
      timing: {
        totalTime: 0,
        count: 0,
        responseTimes: []
      },
      originalSize: 0,
      compressedSize: 0,
      detailedStats: {
        hourlyHits: Array(24).fill(0),
        hourlyMisses: Array(24).fill(0)
      }
    };
    
    // モデル別の統計情報
    this.modelStats = {};
    
    // ファイル統計情報
    this.fileStats = new Map();
    
    // Redis分散キャッシュのイベントリスナーを設定
    if (this.config.enableRedisCache && this.redisCache) {
      this._setupRedisEventListeners();
    }
    
    // 定期的なキャッシュクリーンアップのスケジュール
    if (this.config.enableFileCache) {
      this.cleanupInterval = setInterval(() => {
        this.cleanCache().catch(err => {
          console.error('定期的なキャッシュクリーンアップ中にエラーが発生しました:', err);
        });
      }, 3600000); // 1時間ごと
    }
    
    console.log(`埋め込みキャッシュを初期化しました（インスタンスID: ${this.config.instanceId}）`);
    console.log(`キャッシュ設定: メモリ=${this.config.enableMemoryCache}, ファイル=${this.config.enableFileCache}, Redis=${this.config.enableRedisCache}`);
  }
  
  // 自動最適化の開始
  startAutoOptimize() {
    if (this._autoOptimizeTimer) {
      clearInterval(this._autoOptimizeTimer);
    }
    
    this._autoOptimizeTimer = setInterval(() => {
      this.optimizeCache();
      this.cleanCache();
    }, 60 * 60 * 1000); // 1時間
    
    // Node.jsプロセス終了時にタイマーをクリア
    process.on('exit', () => {
      if (this._autoOptimizeTimer) {
        clearInterval(this._autoOptimizeTimer);
      }
    });
  }
  
  // 自動最適化の停止
  stopAutoOptimize() {
    if (this._autoOptimizeTimer) {
      clearInterval(this._autoOptimizeTimer);
      this._autoOptimizeTimer = null;
    }
  }
  
  // 統計情報収集の開始
  startStatsCollection() {
    if (this._statsCollectionTimer) {
      clearInterval(this._statsCollectionTimer);
    }
    
    this._statsCollectionTimer = setInterval(() => {
      this.collectStats();
    }, 10 * 60 * 1000); // 10分
    
    // Node.jsプロセス終了時にタイマーをクリア
    process.on('exit', () => {
      if (this._statsCollectionTimer) {
        clearInterval(this._statsCollectionTimer);
      }
    });
  }
  
  // 統計情報収集の停止
  stopStatsCollection() {
    if (this._statsCollectionTimer) {
      clearInterval(this._statsCollectionTimer);
      this._statsCollectionTimer = null;
    }
  }
  
  // 統計情報の収集
  collectStats() {
    if (!this.config.enableFileCache) return;
    
    try {
      // 現在の時間
      const now = new Date();
      const hour = now.getHours();
      
      // サイズ履歴を更新（最大24ポイント保持）
      this.sizeHistory.push({
        timestamp: now.toISOString(),
        size: this.fileCacheSize
      });
      
      if (this.sizeHistory.length > 24) {
        this.sizeHistory.shift();
      }
      
      // 統計情報を保存
      this.saveStats();
    } catch (error) {
      console.error('統計情報の収集中にエラーが発生しました:', error);
    }
  }
  
  // キャッシュディレクトリの作成
  ensureCacheDirectory() {
    try {
      if (!fs.existsSync(this.config.cacheDir)) {
        fs.mkdirSync(this.config.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.error('キャッシュディレクトリの作成に失敗しました:', error);
    }
  }
  
  // キャッシュ統計の読み込み
  loadCacheStats() {
    try {
      const statsFile = path.join(this.config.cacheDir, 'stats.json');
      if (fs.existsSync(statsFile)) {
        const data = fs.readFileSync(statsFile, 'utf8');
        this.stats = JSON.parse(data);
        
        // 新しい統計フィールドの追加（後方互換性のため）
        if (!this.stats.detailedStats) {
          this.stats.detailedStats = {
            hourlyHits: Array(24).fill(0),
            hourlyMisses: Array(24).fill(0),
            modelStats: {},
            sizeHistory: [],
            lastUpdated: new Date().toISOString()
          };
        }
      } else {
        // キャッシュディレクトリ内のファイル数をカウント（.jsonファイルのみ）
        const files = fs.readdirSync(this.config.cacheDir)
          .filter(file => file.endsWith('.json') && file !== 'stats.json');
        this.fileCacheSize = files.length;
        this.saveStats();
      }
    } catch (error) {
      console.error('キャッシュ統計の読み込みに失敗しました:', error);
    }
  }
  
  // キャッシュ統計の保存
  saveStats() {
    try {
      const statsFile = path.join(this.config.cacheDir, 'stats.json');
      fs.writeFileSync(statsFile, JSON.stringify(this.stats, null, 2), 'utf8');
    } catch (error) {
      console.error('キャッシュ統計の保存に失敗しました:', error);
    }
  }
  
  // テキストからキャッシュキーを生成
  generateKey(text, modelName = 'default') {
    // テキストのハッシュを生成
    const hash = crypto.createHash('sha256')
      .update(`${modelName}:${text}`)
      .digest('hex');
    
    return hash;
  }
  
  // アクセス頻度を更新
  updateFrequency(text, modelName) {
    if (!this.config.enableFrequencyBasedStrategy) return;
    
    const key = `${modelName}:${text.substring(0, 100)}`;
    const count = (this.frequencyMap.get(key) || 0) + 1;
    this.frequencyMap.set(key, count);
    
    // 最近のアクセスを記録
    this.recentAccesses.push({
      key,
      timestamp: Date.now()
    });
    
    // 古いアクセス記録を削除
    const cutoffTime = Date.now() - this.recentAccessWindow;
    this.recentAccesses = this.recentAccesses.filter(access => access.timestamp >= cutoffTime);
    
    // 頻度マップのサイズを制限（最大10000エントリ）
    if (this.frequencyMap.size > 10000) {
      // 最も古いエントリを削除
      const oldestKey = this.frequencyMap.keys().next().value;
      this.frequencyMap.delete(oldestKey);
    }
  }
  
  // 適応的TTLの計算
  calculateAdaptiveTtl(accessCount, lastAccessed, modelName) {
    if (!this.config.useAdaptiveTtl) {
      return this.config.defaultTTL;
    }
    
    // アクセス頻度に基づいてTTLを調整
    let ttl = this.config.defaultTTL;
    
    // アクセス頻度が高いほどTTLを延長
    if (accessCount > 10) {
      ttl = Math.min(this.config.maxTTL, this.config.defaultTTL * 2);
      this.stats.adaptiveTtlStats.extended++;
    } else if (accessCount < 2) {
      // アクセス頻度が低いほどTTLを短縮
      ttl = Math.max(this.config.minTTL, this.config.defaultTTL / 2);
      this.stats.adaptiveTtlStats.reduced++;
    } else {
      this.stats.adaptiveTtlStats.unchanged++;
    }
    
    // 最終アクセス時間に基づく追加調整
    const lastAccessedDate = new Date(lastAccessed);
    const now = new Date();
    const daysSinceLastAccess = (now - lastAccessedDate) / (24 * 60 * 60 * 1000);
    
    // 最近アクセスされたアイテムはTTLを延長
    if (daysSinceLastAccess < 1) {
      ttl = Math.min(this.config.maxTTL, ttl * 1.5);
    } 
    // 長期間アクセスされていないアイテムはTTLを短縮
    else if (daysSinceLastAccess > 7) {
      ttl = Math.max(this.config.minTTL, ttl * 0.5);
    }
    
    // 使用パターンの分析に基づく動的調整
    // 時間帯別のアクセス頻度を分析
    const hour = new Date().getHours();
    const hourlyHits = this.stats.detailedStats?.hourlyHits?.[hour] || 0;
    const hourlyMisses = this.stats.detailedStats?.hourlyMisses?.[hour] || 0;
    const hourlyTotal = hourlyHits + hourlyMisses;
    
    // アクセスが多い時間帯ではTTLを延長（キャッシュヒット率向上のため）
    if (hourlyTotal > 100 && hourlyHits / hourlyTotal > 0.8) {
      ttl = Math.min(this.config.maxTTL, ttl * 1.2);
    }
    
    // モデル別の調整（特定のモデルは重要度が高い場合がある）
    if (this.modelStats && this.modelStats[modelName]) {
      const modelHits = this.modelStats[modelName].hits || 0;
      const modelMisses = this.modelStats[modelName].misses || 0;
      const modelTotal = modelHits + modelMisses;
      
      // 高頻度で使用されるモデルはTTLを延長
      if (modelTotal > 1000 && modelHits / modelTotal > 0.7) {
        ttl = Math.min(this.config.maxTTL, ttl * 1.3);
      }
    }
    
    // システム負荷に基づく調整
    // メモリ使用率が高い場合はTTLを短縮
    if (this.memoryCacheSize > this.config.memoryLimit * 0.9) {
      ttl = Math.max(this.config.minTTL, ttl * 0.8);
    }
    
    return Math.round(ttl);
  }
  
  // キャッシュからデータを取得します
  async get(text, modelName = 'default') {
    if (this.stats) {
      this.stats.total.requests++;
    }
    
    // 詳細な統計情報の更新
    if (this.config.enableDetailedStats && this.stats && this.stats.detailedStats) {
      const hour = new Date().getHours();
      if (!this.stats.detailedStats.hourlyHits) {
        this.stats.detailedStats.hourlyHits = Array(24).fill(0);
      }
      
      if (!this.modelStats[modelName]) {
        this.modelStats[modelName] = {
          hits: 0,
          misses: 0,
          requests: 0
        };
      }
      this.modelStats[modelName].requests++;
    }
    
    const key = this.generateKey(text, modelName);
    let result = null;
    let source = null;
    
    try {
      // 1. メモリキャッシュから取得を試みる（最速）
      if (this.config.enableMemoryCache && this.memoryCache) {
        const memoryResult = this.memoryCache.get(key);
        if (memoryResult) {
          result = memoryResult;
          source = 'memory';
          if (this.stats && this.stats.memory) {
            this.stats.memory.hits++;
          }
          if (this.config.enableDetailedStats && this.stats && this.stats.detailedStats && this.stats.detailedStats.hourlyHits) {
            this.stats.detailedStats.hourlyHits[new Date().getHours()]++;
          }
        } else {
          if (this.stats && this.stats.memory) {
            this.stats.memory.misses++;
          }
        }
        if (this.stats && this.stats.memory) {
          this.stats.memory.requests++;
        }
      }
      
      // 2. Redis分散キャッシュから取得を試みる（中速）
      if (!result && this.config.enableRedisCache) {
        try {
          // RedisCacheManagerは独自のキー生成方法を使用するため、
          // textとmodelNameを直接渡して、RedisCacheManager側でキーを生成させる
          const redisResult = await this.redisCache.get(text, modelName);
          if (redisResult) {
            result = redisResult;
            source = 'redis';
            
            // メモリキャッシュにも保存（階層化）
            if (this.config.enableMemoryCache) {
              this.memoryCache.set(key, redisResult);
              if (this.stats && this.stats.syncs) {
                this.stats.syncs.memory++;
              }
            }
          }
        } catch (error) {
          console.error('Redis分散キャッシュからの取得中にエラーが発生しました:', error);
          if (this.stats && this.stats.errors) {
            this.stats.errors.redis++;
          }
        }
      }
      
      // 3. ファイルキャッシュから取得を試みる（最遅）
      if (!result && this.config.enableFileCache) {
        const cacheFile = path.join(this.config.cacheDir, `${key}.json`);
        
        try {
          if (fs.existsSync(cacheFile)) {
            const data = fs.readFileSync(cacheFile, 'utf8');
            const cacheEntry = JSON.parse(data);
            
            // TTLのチェック
            if (cacheEntry.expiresAt && new Date(cacheEntry.expiresAt) < new Date()) {
              // 期限切れのキャッシュを削除
              fs.unlinkSync(cacheFile);
              if (this.stats) {
                if (this.stats.file) this.stats.file.misses++;
                if (this.stats.total) this.stats.total.misses++;
              }
              this.fileCacheSize = Math.max(0, this.fileCacheSize - 1);
              
              // 詳細な統計情報の更新
              if (this.config.enableDetailedStats && this.stats && this.stats.detailedStats) {
                const hour = new Date().getHours();
                if (this.stats.detailedStats.hourlyMisses) {
                  this.stats.detailedStats.hourlyMisses[hour]++;
                }
                if (this.modelStats[modelName]) {
                  this.modelStats[modelName].misses++;
                }
              }
            } else {
              result = cacheEntry.embedding;
              source = 'file';
              
              // アクセス時間と頻度を更新
              cacheEntry.lastAccessed = new Date().toISOString();
              cacheEntry.accessCount = (cacheEntry.accessCount || 0) + 1;
              fs.writeFileSync(cacheFile, JSON.stringify(cacheEntry, null, 2), 'utf8');
              
              // 上位層のキャッシュに同期（階層化）
              if (this.config.enableMemoryCache) {
                this.memoryCache.set(key, result);
                if (this.stats && this.stats.syncs) {
                  this.stats.syncs.memory++;
                }
              }
              
              if (this.config.enableRedisCache) {
                // 非同期で更新して処理を遅延させない
                this.redisCache.set(text, result, modelName)
                  .then(() => {
                    if (this.stats && this.stats.syncs) {
                      this.stats.syncs.redis++;
                    }
                  })
                  .catch(err => {
                    console.error('Redis分散キャッシュへの同期中にエラーが発生しました:', err);
                    if (this.stats && this.stats.errors) {
                      this.stats.errors.redis++;
                    }
                  });
              }
            }
          }
        } catch (error) {
          console.error('ファイルキャッシュからの取得中にエラーが発生しました:', error);
          if (this.stats && this.stats.errors) {
            this.stats.errors.file++;
          }
        }
      }
      
      // キャッシュヒット/ミスの統計更新
      if (result) {
        // アクセス頻度を更新
        this.updateFrequency(text, modelName);
        
        // ヒット統計の更新
        if (this.stats) {
          if (source === 'memory' && this.stats.memory) {
            this.stats.memory.hits++;
          } else if (source === 'redis' && this.stats.redis) {
            this.stats.redis.hits++;
          } else if (source === 'file' && this.stats.file) {
            this.stats.file.hits++;
          }
          if (this.stats.total) {
            this.stats.total.hits++;
          }
        }
        
        // 詳細な統計情報の更新
        if (this.config.enableDetailedStats && this.stats && this.stats.detailedStats) {
          const hour = new Date().getHours();
          if (this.stats.detailedStats.hourlyHits) {
            this.stats.detailedStats.hourlyHits[hour]++;
          }
          if (this.modelStats[modelName]) {
            this.modelStats[modelName].hits++;
          }
        }
        
        return this._decompressData(result);
      } else {
        // キャッシュミス統計の更新
        if (this.stats) {
          this.stats.total.misses++;
        }
        
        // 詳細な統計情報の更新
        if (this.config.enableDetailedStats && this.stats && this.stats.detailedStats) {
          const hour = new Date().getHours();
          if (this.stats.detailedStats.hourlyMisses) {
            this.stats.detailedStats.hourlyMisses[hour]++;
          }
          if (this.modelStats[modelName]) {
            this.modelStats[modelName].misses++;
          }
        }
      }
    } catch (error) {
      console.error('キャッシュ取得中に予期しないエラーが発生しました:', error);
      if (this.stats && this.stats.errors) {
        this.stats.errors.general++;
      }
      this.stats.total.misses++;
    }
    
    return null;
  }
  
  /**
   * データをキャッシュに保存します
   * @param {string} text テキスト
   * @param {Object} embedding 埋め込みデータ
   * @param {string} modelName モデル名
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async set(text, embedding, modelName = 'default') {
    const key = this.generateKey(text, modelName);
    const compressedData = this._compressData(embedding);
    let success = true;
    
    try {
      // TTLの計算
      const ttl = this.calculateAdaptiveTtl(1, new Date().toISOString(), modelName);
      const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
      
      // 1. メモリキャッシュに保存（最速）
      if (this.config.enableMemoryCache) {
        try {
          this.memoryCache.set(key, compressedData);
          if (this.stats && this.stats.memory) {
            this.stats.memory.sets++;
          }
          if (this.stats && this.stats.total) {
            this.stats.total.sets++;
          }
        } catch (error) {
          console.error('メモリキャッシュへの保存中にエラーが発生しました:', error);
          if (this.stats && this.stats.errors) {
            this.stats.errors.memory++;
          }
          success = false;
        }
      }
      
      // 2. Redis分散キャッシュに保存（中速）
      if (this.config.enableRedisCache) {
        try {
          await this.redisCache.set(text, compressedData, modelName, ttl);
          if (this.stats && this.stats.redis) {
            this.stats.redis.sets++;
          }
          if (this.stats && this.stats.total) {
            this.stats.total.sets++;
          }
        } catch (error) {
          console.error('Redis分散キャッシュへの保存中にエラーが発生しました:', error);
          if (this.stats && this.stats.errors) {
            this.stats.errors.redis++;
          }
          success = false;
        }
      }
      
      // 3. ファイルキャッシュに保存（最遅、永続）
      if (this.config.enableFileCache) {
        try {
          // キャッシュサイズをチェック
          if (this.fileCacheSize >= this.config.maxCacheSize) {
            // 自動クリーンアップ
            await this.cleanCache();
          }
          
          const cacheFile = path.join(this.config.cacheDir, `${key}.json`);
          
          // アクセス頻度を更新
          this.updateFrequency(text, modelName);
          
          // キャッシュエントリの作成
          const cacheEntry = {
            text,
            modelName,
            embedding: compressedData,
            createdAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            expiresAt,
            accessCount: 1,
            version: Date.now() // バージョン管理のためのタイムスタンプ
          };
          
          // ファイルに保存
          fs.writeFileSync(cacheFile, JSON.stringify(cacheEntry, null, 2), 'utf8');
          
          // 統計情報を更新
          this.fileCacheSize++;
          if (this.stats && this.stats.file) {
            this.stats.file.sets++;
          }
          if (this.stats && this.stats.total) {
            this.stats.total.sets++;
          }
          
          // プリフェッチ処理
          if (this.config.enablePrefetch) {
            this.prefetchRelatedItems(text, embedding, modelName);
          }
        } catch (error) {
          console.error('ファイルキャッシュへの保存中にエラーが発生しました:', error);
          if (this.stats && this.stats.errors) {
            this.stats.errors.file++;
          }
          success = false;
        }
      }
      
      // キャッシュ無効化イベントの発行（分散環境での整合性のため）
      if (this.config.enableRedisCache && this.redisCache) {
        try {
          await this.redisCache.publishInvalidationEvent(text, modelName, {
            modelName,
            operation: 'set',
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('キャッシュ無効化イベントの発行に失敗しました:', error);
          if (this.stats && this.stats.errors) {
            this.stats.errors.redis++;
          }
        }
      }
      
      return success;
    } catch (error) {
      console.error('キャッシュ保存中に予期しないエラーが発生しました:', error);
      if (this.stats && this.stats.errors) {
        this.stats.errors.general++;
      }
      return false;
    }
  }
  
  // 関連アイテムのプリフェッチ
  async prefetchRelatedItems(text, embedding, modelName) {
    if (!this.config.enablePrefetch || !this.config.enableFileCache) return;
    
    try {
      // キャッシュディレクトリ内のすべてのファイルを取得
      const files = fs.readdirSync(this.config.cacheDir)
        .filter(file => file.endsWith('.json') && file !== 'stats.json');
      
      // 類似度計算のためのアイテムを収集
      const items = [];
      
      for (const file of files) {
        const filePath = path.join(this.config.cacheDir, file);
        try {
          const data = fs.readFileSync(filePath, 'utf8');
          const cacheEntry = JSON.parse(data);
          
          // 同じモデルのエントリのみを考慮
          if (cacheEntry.modelName === modelName && cacheEntry.text !== text) {
            items.push({
              text: cacheEntry.text,
              embedding: cacheEntry.embedding,
              key: file.replace('.json', '')
            });
          }
        } catch (error) {
          // ファイル読み込みエラーは無視
        }
      }
      
      // 類似度に基づいてアイテムをソート
      const similarItems = items
        .map(item => {
          const similarity = this.calculateCosineSimilarity(embedding, item.embedding);
          return { ...item, similarity };
        })
        .filter(item => item.similarity >= this.config.prefetchThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, this.config.maxPrefetchItems);
      
      // 類似アイテムをメモリキャッシュにプリロード
      if (this.config.enableMemoryCache) {
        for (const item of similarItems) {
          this.memoryCache.set(item.key, item.embedding);
          this.prefetchedItems.add(item.key);
        }
      }
      
      if (similarItems.length > 0) {
        console.log(`プリフェッチ: ${similarItems.length}アイテムをメモリキャッシュにプリロード`);
      }
    } catch (error) {
      console.error('プリフェッチに失敗しました:', error);
    }
  }
  
  // コサイン類似度の計算
  calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }
  
  // キャッシュの統計情報を取得
  async getStats() {
    try {
      // Redis統計情報の取得
      let redisStats = null;
      if (this.config.enableRedisCache && this.redisCache) {
        try {
          redisStats = await this.redisCache.getStats();
        } catch (error) {
          console.error('Redis統計情報の取得中にエラーが発生しました:', error);
        }
      }
      
      // 統計情報の準備
      const stats = {
        // 基本統計情報
        cacheSize: {
          memory: this.memoryCacheSize || 0,
          file: this.fileCacheSize || 0,
          redis: redisStats ? redisStats.size : 0,
          total: (this.memoryCacheSize || 0) + (this.fileCacheSize || 0) + (redisStats ? redisStats.size : 0)
        },
        
        // ヒット率
        hitRate: {
          memory: this.stats.memory.requests > 0 ? this.stats.memory.hits / this.stats.memory.requests : 0,
          file: this.stats.file.requests > 0 ? this.stats.file.hits / this.stats.file.requests : 0,
          redis: this.stats.redis.requests > 0 ? this.stats.redis.hits / this.stats.redis.requests : 0,
          total: this.stats.total.requests > 0 ? this.stats.total.hits / this.stats.total.requests : 0
        },
        
        // 操作統計
        operations: {
          memory: {
            gets: this.stats.memory.requests || 0,
            sets: this.stats.memory.sets || 0,
            deletes: this.stats.memory.deletes || 0
          },
          file: {
            gets: this.stats.file.requests || 0,
            sets: this.stats.file.sets || 0,
            deletes: this.stats.file.deletes || 0
          },
          redis: {
            gets: this.stats.redis.requests || 0,
            sets: this.stats.redis.sets || 0,
            deletes: this.stats.redis.deletes || 0
          }
        },
        
        // エラー統計
        errors: {
          memory: this.stats.errors.memory || 0,
          file: this.stats.errors.file || 0,
          redis: this.stats.errors.redis || 0,
          general: this.stats.errors.general || 0,
          total: (this.stats.errors.memory || 0) + 
                 (this.stats.errors.file || 0) + 
                 (this.stats.errors.redis || 0) + 
                 (this.stats.errors.general || 0)
        },
        
        // 同期統計
        syncs: {
          memory: this.stats.syncs.memory || 0,
          file: this.stats.syncs.file || 0,
          redis: this.stats.syncs.redis || 0,
          total: this.stats.syncs.total || 0
        },
        
        // 圧縮統計
        compression: {
          originalSize: this.stats.originalSize || 0,
          compressedSize: this.stats.compressedSize || 0,
          ratio: this.stats.originalSize > 0 ? this.stats.compressedSize / this.stats.originalSize : 1
        },
        
        // 実行時間統計
        timing: {
          averageResponseTime: this.stats.timing.count > 0 ? this.stats.timing.totalTime / this.stats.timing.count : 0,
          totalTime: this.stats.timing.totalTime || 0,
          count: this.stats.timing.count || 0,
          responseTimes: this.stats.timing.responseTimes || []
        },
        originalSize: this.stats.originalSize || 0,
        compressedSize: this.stats.compressedSize || 0,
        detailedStats: {
          hourlyHits: Array(24).fill(0),
          hourlyMisses: Array(24).fill(0)
        }
      };
      
      return stats;
    } catch (error) {
      console.error('統計情報の取得中にエラーが発生しました:', error);
      return {
        error: error.message,
        cacheSize: {
          memory: this.memoryCacheSize || 0,
          file: this.fileCacheSize || 0,
          redis: 0,
          total: (this.memoryCacheSize || 0) + (this.fileCacheSize || 0)
        },
        syncs: {
          memory: 0,
          file: 0,
          redis: 0,
          total: 0
        }
      };
    }
  }
  
  // モデル別のパフォーマンス分析
  analyzeModelPerformance() {
    if (!this.config.enableDetailedStats || !this.modelStats) {
      return {};
    }
    
    const modelAnalysis = {};
    
    for (const [modelName, stats] of Object.entries(this.modelStats)) {
      const total = stats.requests;
      if (total > 0) {
        const hitRate = (stats.hits / total * 100).toFixed(2);
        
        let performance = 'normal';
        if (parseFloat(hitRate) < 30) performance = 'poor';
        else if (parseFloat(hitRate) > 80) performance = 'excellent';
        
        modelAnalysis[modelName] = {
          requests: total,
          hits: stats.hits,
          misses: stats.misses,
          hitRate: `${hitRate}%`,
          performance
        };
      }
    }
    
    return modelAnalysis;
  }
  
  // キャッシュサイズの成長分析
  analyzeSizeGrowth() {
    if (!this.config.enableDetailedStats || !this.sizeHistory || 
        this.sizeHistory.length < 2) {
      return { trend: 'insufficient_data' };
    }
    
    const history = this.sizeHistory;
    const oldestSize = history[0].size;
    const newestSize = history[history.length - 1].size;
    const growthRate = ((newestSize - oldestSize) / oldestSize) * 100;
    
    let trend = 'stable';
    if (growthRate > 50) trend = 'rapid_growth';
    else if (growthRate > 20) trend = 'moderate_growth';
    else if (growthRate < -20) trend = 'shrinking';
    
    return {
      trend,
      growthRate: `${growthRate.toFixed(2)}%`,
      oldestSize,
      newestSize,
      dataPoints: history.length
    };
  }
  
  // キャッシュパフォーマンスレポートの生成
  generatePerformanceReport() {
    const analysis = this.analyzePerformance();
    const now = new Date();
    
    let report = `# キャッシュパフォーマンスレポート\n`;
    report += `生成日時: ${now.toLocaleString('ja-JP')}\n\n`;
    
    report += `## 概要\n`;
    report += `- 全体ヒット率: ${analysis.summary.overallHitRate}\n`;
    report += `- メモリキャッシュヒット率: ${analysis.summary.memoryHitRate}\n`;
    report += `- ファイルキャッシュヒット率: ${analysis.summary.fileHitRate}\n`;
    report += `- 合計キャッシュサイズ: ${analysis.summary.totalSize}エントリ\n\n`;
    
    if (analysis.summary.recommendations.length > 0) {
      report += `## 推奨事項\n`;
      analysis.summary.recommendations.forEach((rec, i) => {
        report += `${i + 1}. ${rec}\n`;
      });
      report += `\n`;
    }
    
    if (this.config.enableFileCache) {
      // 時間帯別分析
      const hourlyAnalysis = analysis.details.hourlyAnalysis;
      if (hourlyAnalysis.length > 0) {
        report += `## 時間帯別分析\n`;
        report += `| 時間 | リクエスト数 | ヒット率 | パターン |\n`;
        report += `|------|------------|---------|----------|\n`;
        
        hourlyAnalysis.forEach(hour => {
          report += `| ${hour.hour}時 | ${hour.requests} | ${hour.hitRate} | ${this.translatePattern(hour.pattern)} |\n`;
        });
        report += `\n`;
      }
      
      // モデル別分析
      const modelAnalysis = analysis.details.modelAnalysis;
      if (Object.keys(modelAnalysis).length > 0) {
        report += `## モデル別分析\n`;
        report += `| モデル | リクエスト数 | ヒット率 | パフォーマンス |\n`;
        report += `|--------|------------|---------|----------------|\n`;
        
        Object.entries(modelAnalysis).forEach(([model, stats]) => {
          report += `| ${model} | ${stats.requests} | ${stats.hitRate} | ${this.translatePerformance(stats.performance)} |\n`;
        });
        report += `\n`;
      }
      
      // サイズ成長分析
      const sizeGrowth = analysis.details.sizeGrowth;
      if (sizeGrowth.trend !== 'insufficient_data' && sizeGrowth.trend !== 'N/A') {
        report += `## キャッシュサイズ分析\n`;
        report += `- トレンド: ${this.translateTrend(sizeGrowth.trend)}\n`;
        report += `- 成長率: ${sizeGrowth.growthRate}\n`;
        report += `- 初期サイズ: ${sizeGrowth.oldestSize}エントリ\n`;
        report += `- 現在のサイズ: ${sizeGrowth.newestSize}エントリ\n\n`;
      }
      
      // 最適化履歴
      const optimizationHistory = analysis.details.optimizationHistory;
      if (optimizationHistory.length > 0) {
        report += `## 最適化履歴\n`;
        report += `| 日時 | 合計アイテム | 昇格アイテム | ホットアイテム |\n`;
        report += `|------|------------|------------|----------------|\n`;
        
        optimizationHistory.forEach(opt => {
          const date = new Date(opt.timestamp).toLocaleString('ja-JP');
          report += `| ${date} | ${opt.totalItems} | ${opt.promotedItems} | ${opt.hotItems} |\n`;
        });
      }
    }
    
    return report;
  }
  
  // パターン名の日本語変換
  translatePattern(pattern) {
    const patterns = {
      'normal': '通常',
      'low_hit_rate': '低ヒット率',
      'high_hit_rate': '高ヒット率'
    };
    return patterns[pattern] || pattern;
  }
  
  // パフォーマンス名の日本語変換
  translatePerformance(performance) {
    const performances = {
      'normal': '通常',
      'poor': '不良',
      'excellent': '優秀'
    };
    return performances[performance] || performance;
  }
  
  // トレンド名の日本語変換
  translateTrend(trend) {
    const trends = {
      'stable': '安定',
      'rapid_growth': '急速な成長',
      'moderate_growth': '緩やかな成長',
      'shrinking': '縮小'
    };
    return trends[trend] || trend;
  }
  
  // キャッシュをクリア
  async clear() {
    let success = true;
    console.log('すべてのキャッシュをクリアします...');
    
    // メモリキャッシュをクリア
    if (this.config.enableMemoryCache) {
      try {
        console.log('メモリキャッシュをクリアしています...');
        this.memoryCache.clear();
        this.memoryCacheSize = 0;
        console.log('メモリキャッシュを正常にクリアしました');
      } catch (error) {
        console.error('メモリキャッシュのクリア中にエラーが発生しました:', error);
        if (this.stats && this.stats.errors) {
          this.stats.errors.memory++;
        }
        success = false;
      }
    }
    
    // Redis分散キャッシュをクリア
    if (this.config.enableRedisCache && this.redisCache) {
      try {
        console.log('Redis分散キャッシュをクリアしています...');
        // 直接Redisキャッシュをクリア（個別モデルごとではなく一括で）
        await this.redisCache.clear();
        console.log('Redis分散キャッシュを正常にクリアしました');
      } catch (error) {
        console.error('Redis分散キャッシュのクリア中にエラーが発生しました:', error);
        if (this.stats && this.stats.errors) {
          this.stats.errors.redis++;
        }
        success = false;
      }
    }
    
    // ファイルキャッシュをクリア
    if (this.config.enableFileCache) {
      try {
        console.log('ファイルキャッシュをクリアしています...');
        const files = fs.readdirSync(this.config.cacheDir)
          .filter(file => file.endsWith('.json') && file !== 'stats.json');
        
        console.log(`ファイルキャッシュから ${files.length} ファイルを削除します`);
        
        for (const file of files) {
          fs.unlinkSync(path.join(this.config.cacheDir, file));
        }
        
        // 統計情報を保存
        try {
          const statsFile = path.join(this.config.cacheDir, 'stats.json');
          fs.writeFileSync(statsFile, JSON.stringify(this.stats, null, 2), 'utf8');
          console.log('キャッシュ統計情報を保存しました');
        } catch (error) {
          console.error('統計情報の保存中にエラーが発生しました:', error);
        }
        
        this.fileCacheSize = 0;
        console.log('ファイルキャッシュを正常にクリアしました');
      } catch (error) {
        console.error('ファイルキャッシュのクリア中にエラーが発生しました:', error);
        if (this.stats && this.stats.errors) {
          this.stats.errors.file++;
        }
        success = false;
      }
    }
    
    console.log('すべてのキャッシュクリア処理が完了しました');
    return success;
  }
  
  /**
   * 特定のモデルのローカルキャッシュ（メモリ・ファイル）をクリアします
   * @param {string} modelName モデル名
   * @param {string} [sourceInstanceId] 送信元のインスタンスID（自分自身のイベントを無視するため）
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async clearModelCache(modelName, sourceInstanceId = null) {
    console.log(`モデル ${modelName} のローカルキャッシュをクリアします...`);
    let success = true;
    
    // メモリキャッシュから特定のモデルのエントリを削除
    if (this.config.enableMemoryCache) {
      try {
        console.log(`メモリキャッシュから ${modelName} モデルのエントリを削除しています...`);
        let deletedCount = 0;
        
        // キャッシュエントリを確認してモデル名が一致するものを削除
        const keysToDelete = [];
        this.memoryCache.cache.forEach((value, key) => {
          if (value && value.modelName === modelName) {
            keysToDelete.push(key);
          }
        });
        
        // 一括で削除
        for (const key of keysToDelete) {
          this.memoryCache.cache.delete(key);
          deletedCount++;
        }
        
        this.memoryCacheSize = Math.max(0, this.memoryCacheSize - deletedCount);
        console.log(`メモリキャッシュから ${modelName} モデルの ${deletedCount} エントリを削除しました`);
      } catch (error) {
        console.error(`メモリキャッシュからの ${modelName} モデルの削除中にエラーが発生しました:`, error);
        if (this.stats && this.stats.errors) {
          this.stats.errors.memory++;
        }
        success = false;
      }
    }
    
    // ファイルキャッシュから特定のモデルのエントリを削除
    if (this.config.enableFileCache) {
      try {
        console.log(`ファイルキャッシュから ${modelName} モデルのエントリを削除しています...`);
        const files = fs.readdirSync(this.config.cacheDir)
          .filter(file => file.endsWith('.json') && file !== 'stats.json');
        
        let deletedCount = 0;
        
        // ファイル内容を読み取ってmodelNameをチェックする
        for (const file of files) {
          const filePath = path.join(this.config.cacheDir, file);
          try {
            // ファイルの内容を読み取る
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const cacheEntry = JSON.parse(fileContent);
            
            // モデル名が一致するかチェック
            if (cacheEntry && cacheEntry.modelName === modelName) {
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          } catch (fileError) {
            console.error(`ファイル ${file} の処理中にエラーが発生しました:`, fileError);
          }
        }
        
        this.fileCacheSize = Math.max(0, this.fileCacheSize - deletedCount);
        console.log(`ファイルキャッシュから ${modelName} モデルの ${deletedCount} エントリを削除しました`);
      } catch (error) {
        console.error(`ファイルキャッシュからの ${modelName} モデルの削除中にエラーが発生しました:`, error);
        if (this.stats && this.stats.errors) {
          this.stats.errors.file++;
        }
        success = false;
      }
    }
    
    // Redisキャッシュのクリアと他のインスタンスへの通知
    // sourceInstanceIdが指定されている場合（他のインスタンスからの通知の場合）はRedisに通知しない
    if (this.config.enableRedisCache && this.redisCache && sourceInstanceId !== this.instanceId) {
      try {
        await this.redisCache.clearModelCache(modelName, this.instanceId);
      } catch (error) {
        console.error(`Redisキャッシュからの ${modelName} モデルの削除中にエラーが発生しました:`, error);
        if (this.stats && this.stats.errors) {
          this.stats.errors.redis++;
        }
        success = false;
      }
    }
    
    console.log(`モデル ${modelName} のローカルキャッシュクリア処理が完了しました (成功: ${success})`);
    return success;
  }
  
  /**
   * ローカルキャッシュ（メモリとファイル）のみをクリアします
   * @param {string} modelName モデル名
   * @returns {Promise<boolean>} 成功した場合はtrue
   * @private
   */
  async _clearLocalModelCache(modelName) {
    console.log(`モデル ${modelName} のローカルキャッシュをクリアします...`);
    let success = true;
    
    // メモリキャッシュから特定のモデルのエントリを削除
    if (this.config.enableMemoryCache) {
      try {
        console.log(`メモリキャッシュから ${modelName} モデルのエントリを削除しています...`);
        let deletedCount = 0;
        
        // キャッシュエントリを確認してモデル名が一致するものを削除
        const keysToDelete = [];
        this.memoryCache.cache.forEach((value, key) => {
          if (value && value.modelName === modelName) {
            keysToDelete.push(key);
          }
        });
        
        // 一括で削除
        for (const key of keysToDelete) {
          this.memoryCache.cache.delete(key);
          deletedCount++;
        }
        
        this.memoryCacheSize = Math.max(0, this.memoryCacheSize - deletedCount);
        console.log(`メモリキャッシュから ${modelName} モデルの ${deletedCount} エントリを削除しました`);
      } catch (error) {
        console.error(`メモリキャッシュからの ${modelName} モデルの削除中にエラーが発生しました:`, error);
        if (this.stats && this.stats.errors) {
          this.stats.errors.memory++;
        }
        success = false;
      }
    }
    
    // ファイルキャッシュから特定のモデルのエントリを削除
    if (this.config.enableFileCache) {
      try {
        console.log(`ファイルキャッシュから ${modelName} モデルのエントリを削除しています...`);
        const files = fs.readdirSync(this.config.cacheDir)
          .filter(file => file.endsWith('.json') && file !== 'stats.json');
        
        let deletedCount = 0;
        
        // ファイル内容を読み取ってmodelNameをチェックする
        for (const file of files) {
          const filePath = path.join(this.config.cacheDir, file);
          try {
            // ファイルの内容を読み取る
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const cacheEntry = JSON.parse(fileContent);
            
            // モデル名が一致するかチェック
            if (cacheEntry && cacheEntry.modelName === modelName) {
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          } catch (fileError) {
            console.error(`ファイル ${file} の処理中にエラーが発生しました:`, fileError);
          }
        }
        
        this.fileCacheSize = Math.max(0, this.fileCacheSize - deletedCount);
        console.log(`ファイルキャッシュから ${modelName} モデルの ${deletedCount} エントリを削除しました`);
      } catch (error) {
        console.error(`ファイルキャッシュからの ${modelName} モデルの削除中にエラーが発生しました:`, error);
        if (this.stats && this.stats.errors) {
          this.stats.errors.file++;
        }
        success = false;
      }
    }
    
    console.log(`モデル ${modelName} のローカルキャッシュクリア処理が完了しました (成功: ${success})`);
    return success;
  }
  
  /**
   * 特定のモデルの分散キャッシュをクリアし、他のインスタンスに通知します
   * @param {string} modelName モデル名
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async clearModelDistributedCache(modelName) {
    console.log(`モデル ${modelName} の分散キャッシュをクリアします...`);
    
    // まずローカルキャッシュをクリア
    await this.clearModelCache(modelName);
    
    // Redis分散キャッシュから特定のモデルのエントリを削除
    if (this.config.enableRedisCache) {
      try {
        console.log(`Redis分散キャッシュから ${modelName} モデルのエントリを削除しています...`);
        
        // インスタンスIDを設定
        const instanceId = this.config.instanceId || 'unknown';
        
        // RedisキャッシュマネージャーのclearModelCacheメソッドを呼び出す
        await this.redisCache.clearModelCache(modelName, instanceId);
        
        console.log(`Redis分散キャッシュから ${modelName} モデルのエントリを削除しました`);
        return true;
      } catch (error) {
        console.error(`Redis分散キャッシュからの ${modelName} モデルの削除中にエラーが発生しました:`, error);
        if (this.stats && this.stats.errors) {
          this.stats.errors.redis++;
        }
        return false;
      }
    }
    
    return true;
  }

  /**
   * パターンに一致するキャッシュエントリを一括削除します
   * @param {string} pattern 削除するキーのパターン（正規表現文字列）
   * @param {string} [sourceInstanceId] 送信元のインスタンスID（自分自身のイベントを無視するため）
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async bulkDelete(pattern, sourceInstanceId = null) {
    console.log(`パターン ${pattern} に一致するキャッシュエントリを一括削除します`);
    let success = true;
    
    try {
      const regex = new RegExp(pattern);
      
      // 1. メモリキャッシュから削除
      if (this.config.enableMemoryCache) {
        try {
          let deletedCount = 0;
          const keysToDelete = [];
          
          this.memoryCache.cache.forEach((_, key) => {
            if (regex.test(key)) {
              keysToDelete.push(key);
            }
          });
          
          for (const key of keysToDelete) {
            this.memoryCache.cache.delete(key);
            deletedCount++;
          }
          
          this.memoryCacheSize = Math.max(0, this.memoryCacheSize - deletedCount);
          console.log(`メモリキャッシュから ${deletedCount} 件のキーを削除しました`);
        } catch (error) {
          console.error('メモリキャッシュからの一括削除中にエラーが発生しました:', error);
          if (this.stats && this.stats.errors) {
            this.stats.errors.memory++;
          }
          success = false;
        }
      }
      
      // 2. ファイルキャッシュから削除
      if (this.config.enableFileCache) {
        try {
          const files = fs.readdirSync(this.config.cacheDir)
            .filter(file => file.endsWith('.json') && file !== 'stats.json');
          
          let deletedCount = 0;
          
          for (const file of files) {
            const key = file.replace('.json', '');
            if (regex.test(key)) {
              const filePath = path.join(this.config.cacheDir, file);
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          }
          
          this.fileCacheSize = Math.max(0, this.fileCacheSize - deletedCount);
          console.log(`ファイルキャッシュから ${deletedCount} 件のキーを削除しました`);
        } catch (error) {
          console.error('ファイルキャッシュからの一括削除中にエラーが発生しました:', error);
          if (this.stats && this.stats.errors) {
            this.stats.errors.file++;
          }
          success = false;
        }
      }
      
      // 3. Redisキャッシュから削除
      // sourceInstanceIdが指定されている場合（他のインスタンスからの通知の場合）はRedisに通知しない
      if (this.config.enableRedisCache && this.redisCache && sourceInstanceId !== this.instanceId) {
        try {
          await this.redisCache.bulkDelete(pattern, this.instanceId);
        } catch (error) {
          console.error('Redisキャッシュからの一括削除中にエラーが発生しました:', error);
          if (this.stats && this.stats.errors) {
            this.stats.errors.redis++;
          }
          success = false;
        }
      }
      
      return success;
    } catch (error) {
      console.error('キャッシュからの一括削除中にエラーが発生しました:', error);
      if (this.stats && this.stats.errors) {
        this.stats.errors.general++;
      }
      return false;
    }
  }
  
  /**
   * キャッシュをクリーンアップします
   * @returns {number} 削除されたエントリ数
   */
  async cleanCache() {
    if (!this.config.enableFileCache) return 0;
    
    try {
      // 目標サイズ（最大サイズの80%）
      const targetSize = this.config.maxCacheSize * 0.8;
      
      // 現在のサイズが目標サイズ以下なら何もしない
      if (this.fileCacheSize <= targetSize) {
        return 0;
      }
      
      console.log(`キャッシュクリーンアップを開始します（現在: ${this.fileCacheSize}, 目標: ${targetSize}）`);
      
      // キャッシュディレクトリ内のすべてのファイルを取得
      const files = fs.readdirSync(this.config.cacheDir)
        .filter(file => file.endsWith('.json') && file !== 'stats.json');
      
      // ファイルの詳細情報を収集
      const fileDetails = [];
      
      for (const file of files) {
        const filePath = path.join(this.config.cacheDir, file);
        try {
          const stats = fs.statSync(filePath);
          const data = fs.readFileSync(filePath, 'utf8');
          const cacheEntry = JSON.parse(data);
          
          // 期限切れのエントリは即時削除
          if (cacheEntry.expiresAt && new Date(cacheEntry.expiresAt) < new Date()) {
            // 期限切れのキャッシュを削除
            fs.unlinkSync(filePath);
            this.fileCacheSize = Math.max(0, this.fileCacheSize - 1);
            continue;
          }
          
          // 削除候補としてエントリを追加
          fileDetails.push({
            file,
            path: filePath,
            lastAccessed: new Date(cacheEntry.lastAccessed || cacheEntry.createdAt),
            accessCount: cacheEntry.accessCount || 0,
            size: stats.size,
            modelName: cacheEntry.modelName || 'default'
          });
        } catch (error) {
          // ファイル読み込みエラーは無視して次へ
          console.error(`ファイル ${file} の読み込み中にエラーが発生しました:`, error.message);
        }
      }
      
      // 削除するエントリ数を計算
      const entriesToRemove = this.fileCacheSize - targetSize;
      
      if (entriesToRemove <= 0 || fileDetails.length === 0) {
        return 0;
      }
      
      // 複合スコアに基づいてエントリをソート（低いスコアが先に削除される）
      fileDetails.sort((a, b) => {
        // 基本スコア: アクセス頻度（高いほど保持）
        const accessScore = (b.accessCount || 0) - (a.accessCount || 0);
        
        // 最終アクセス時間（最近アクセスされたものほど保持）
        const timeScore = b.lastAccessed - a.lastAccessed;
        
        // サイズスコア（大きいファイルほど削除候補）
        const sizeScore = (b.size || 0) - (a.size || 0);
        
        // モデル重要度スコア（特定のモデルは重要度が高い場合がある）
        const modelImportanceA = this.getModelImportance(a.modelName);
        const modelImportanceB = this.getModelImportance(b.modelName);
        const modelScore = modelImportanceB - modelImportanceA;
        
        // 複合スコアの計算（各要素に重み付け）
        return (accessScore * 0.5) + (timeScore * 0.3) + (sizeScore * 0.1) + (modelScore * 0.1);
      });
      
      // 削除対象のファイル
      const filesToDelete = fileDetails.slice(0, entriesToRemove);
      let deletedCount = 0;
      
      // ファイルを削除
      for (const fileInfo of filesToDelete) {
        try {
          fs.unlinkSync(fileInfo.path);
          deletedCount++;
          
          // Redis分散キャッシュからも削除（整合性のため）
          if (this.config.enableRedisCache && this.redisCache) {
            const key = path.basename(fileInfo.file, '.json');
            this.redisCache.delete(key).catch(err => {
              console.error('Redis分散キャッシュからの削除中にエラーが発生しました:', err);
            });
          }
        } catch (error) {
          console.error(`ファイル ${fileInfo.file} の削除中にエラーが発生しました:`, error);
        }
      }
      
      // キャッシュサイズを更新
      this.fileCacheSize = Math.max(0, this.fileCacheSize - deletedCount);
      
      console.log(`キャッシュクリーンアップが完了しました（削除: ${deletedCount}エントリ, 残り: ${this.fileCacheSize}エントリ）`);
      
      return deletedCount;
    } catch (error) {
      console.error('キャッシュクリーンアップ中にエラーが発生しました:', error);
      return 0;
    }
  }
  
  /**
   * モデルの重要度を取得します（高いほど重要）
   * @param {string} modelName モデル名
   * @returns {number} 重要度スコア（0〜10）
   * @private
   */
  getModelImportance(modelName = 'default') {
    // モデル別の重要度設定（プロジェクト固有の設定）
    const importanceMap = {
      'text-embedding-ada-002': 9,  // OpenAIの高精度埋め込みモデル
      'text-embedding-3-small': 8,  // OpenAIの新しい小型埋め込みモデル
      'text-embedding-3-large': 10, // OpenAIの新しい大型埋め込みモデル
      'all-MiniLM-L6-v2': 7,        // Sentence Transformersの軽量モデル
      'default': 5                  // デフォルト値
    };
    
    return importanceMap[modelName] || importanceMap['default'];
  }
  
  /**
   * キャッシュからデータを削除します
   * @param {string} text テキスト
   * @param {string} modelName モデル名
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async delete(text, modelName = 'default') {
    const key = this.generateKey(text, modelName);
    let success = true;
    
    try {
      // 1. メモリキャッシュから削除
      if (this.config.enableMemoryCache && this.memoryCache.has(key)) {
        this.memoryCache.delete(key);
        if (this.stats && this.stats.memory) {
          this.stats.memory.deletes++;
        }
        if (this.stats && this.stats.total) {
          this.stats.total.deletes++;
        }
      }
      
      // 2. Redis分散キャッシュから削除
      if (this.config.enableRedisCache) {
        try {
          // RedisCacheManagerは独自のキー生成方法を使用するため、
          // textとmodelNameを直接渡して、RedisCacheManager側でキーを生成させる
          await this.redisCache.delete(text, modelName);
          if (this.stats && this.stats.redis) {
            this.stats.redis.deletes++;
          }
          if (this.stats && this.stats.total) {
            this.stats.total.deletes++;
          }
          
          // 無効化イベントを発行（分散環境での整合性のため）
          await this.redisCache.publishInvalidationEvent(text, modelName, {
            modelName,
            operation: 'delete',
            timestamp: Date.now(),
            sourceInstance: this.instanceId || 'unknown'
          });
          
          console.log(`キャッシュ無効化イベントを発行しました: key=${key}, model=${modelName}`);
        } catch (error) {
          console.error('Redis分散キャッシュからの削除中にエラーが発生しました:', error);
          if (this.stats && this.stats.errors) {
            this.stats.errors.redis++;
          }
          success = false;
        }
      }
      
      // 3. ファイルキャッシュから削除
      if (this.config.enableFileCache) {
        try {
          const filePath = path.join(this.config.cacheDir, `${key}.json`);
          
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            if (this.stats && this.stats.file) {
              this.stats.file.deletes++;
            }
            if (this.stats && this.stats.total) {
              this.stats.total.deletes++;
            }
          }
        } catch (error) {
          console.error('ファイルキャッシュからの削除中にエラーが発生しました:', error);
          if (this.stats && this.stats.errors) {
            this.stats.errors.file++;
          }
          success = false;
        }
      }
      
      // 頻度マップからも削除
      this.frequencyMap.delete(`${text}:${modelName}`);
      
      return success;
    } catch (error) {
      console.error('キャッシュ削除中に予期しないエラーが発生しました:', error);
      if (this.stats && this.stats.errors) {
        this.stats.errors.general++;
      }
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
    
    let success = true;
    
    try {
      console.log(`モデル '${modelName}' に関連するキャッシュを無効化します...`);
      
      // このモデルに関連するメモリキャッシュをクリア
      await this.clearModelCache(modelName);
      
      // 統計情報を更新
      if (!this.modelStats[modelName]) {
        this.modelStats[modelName] = {
          hits: 0,
          misses: 0,
          requests: 0,
          invalidations: 0
        };
      }
      this.modelStats[modelName].invalidations++;
      
      if (this.stats && this.stats.syncs) {
        this.stats.syncs.total++;
      }
    } catch (error) {
      console.error(`モデル無効化イベントの処理中にエラーが発生しました: model=${modelName}`, error);
      if (this.stats && this.stats.errors) {
        this.stats.errors.general++;
      }
      success = false;
    }
    
    return success;
  }
  
  /**
   * キャッシュの統計情報を収集し、詳細な分析を行います
   * @returns {Object} 詳細な統計情報
   */
  collectDetailedStats() {
    // 基本的な統計情報
    const basicStats = {
      timestamp: new Date().toISOString(),
      cacheSize: {
        memory: this.config.enableMemoryCache ? this.memoryCache.size : 0,
        file: this.fileCacheSize,
        redis: this.stats.redis.sets - this.stats.redis.deletes
      },
      hitRates: {
        memory: this.stats.memory.requests > 0 ? this.stats.memory.hits / this.stats.memory.requests : 0,
        redis: this.stats.redis.requests > 0 ? this.stats.redis.hits / this.stats.redis.requests : 0,
        file: this.stats.file.requests > 0 ? this.stats.file.hits / this.stats.file.requests : 0,
        total: this.stats.total.requests > 0 ? this.stats.total.hits / this.stats.total.requests : 0
      },
      operations: {
        gets: this.stats.total.gets,
        sets: this.stats.total.sets,
        deletes: this.stats.total.deletes,
        syncs: this.stats.syncs.total
      },
      errors: {
        memory: this.stats.errors.memory,
        redis: this.stats.errors.redis,
        file: this.stats.errors.file,
        general: this.stats.errors.general,
        total: this.stats.errors.memory + this.stats.errors.redis + this.stats.errors.file + this.stats.errors.general
      },
      adaptiveTtlStats: {
        extended: this.stats.adaptiveTtlStats.extended,
        reduced: this.stats.adaptiveTtlStats.reduced,
        unchanged: this.stats.adaptiveTtlStats.unchanged,
        totalTtl: this.stats.adaptiveTtlStats.totalTtl,
        count: this.stats.adaptiveTtlStats.count
      },
      timing: {
        totalTime: this.stats.timing.totalTime,
        count: this.stats.timing.count,
        responseTimes: this.stats.timing.responseTimes
      },
      originalSize: this.stats.originalSize,
      compressedSize: this.stats.compressedSize,
      detailedStats: {
        hourlyHits: Array(24).fill(0),
        hourlyMisses: Array(24).fill(0)
      }
    };
    
    // モデル別の統計情報
    const modelStats = {};
    for (const [modelName, stats] of Object.entries(this.modelStats)) {
      modelStats[modelName] = {
        hits: stats.hits || 0,
        misses: stats.misses || 0,
        requests: stats.requests || 0,
        hitRate: stats.requests > 0 ? stats.hits / stats.requests : 0
      };
    }
    
    // TTL調整の統計情報
    const ttlStats = {
      extended: this.stats.adaptiveTtlStats.extended,
      reduced: this.stats.adaptiveTtlStats.reduced,
      unchanged: this.stats.adaptiveTtlStats.unchanged,
      averageTtl: this.stats.adaptiveTtlStats.totalTtl / Math.max(1, this.stats.adaptiveTtlStats.count)
    };
    
    // 時間帯別の統計情報
    const hourlyStats = {};
    for (let hour = 0; hour < 24; hour++) {
      if (!this.stats.detailedStats?.hourlyHits?.[hour]) continue;
      
      const hits = this.stats.detailedStats.hourlyHits[hour] || 0;
      const misses = this.stats.detailedStats.hourlyMisses[hour] || 0;
      const requests = hits + misses;
      
      if (requests > 0) {
        const hitRate = (hits / requests * 100).toFixed(2);
        
        let pattern = 'normal';
        if (hitRate < 30) pattern = 'low_hit_rate';
        else if (hitRate > 80) pattern = 'high_hit_rate';
        
        let volume = 'low';
        if (requests > 100) volume = 'high';
        else if (requests > 20) volume = 'medium';
        
        hourlyStats[hour] = {
          hour,
          requests,
          hits,
          misses,
          hitRate: `${hitRate}%`,
          pattern,
          volume
        };
      }
    }
    
    // パフォーマンス指標
    const performanceMetrics = {
      averageResponseTime: this.stats.timing.count > 0 ? this.stats.timing.totalTime / this.stats.timing.count : 0,
      p95ResponseTime: this._calculatePercentile(this.stats.timing.responseTimes, 95),
      p99ResponseTime: this._calculatePercentile(this.stats.timing.responseTimes, 99),
      throughput: this.stats.total.requests / (Math.max(1, (Date.now() - this.stats.startTime) / 1000)),
      errorRate: this.stats.total.requests > 0 ? 
        (this.stats.errors.memory + this.stats.errors.redis + this.stats.errors.file + this.stats.errors.general) / this.stats.total.requests : 0
    };
    
    // 推奨事項の生成
    const recommendations = this._generateRecommendations();
    
    return {
      basic: basicStats,
      models: modelStats,
      ttl: ttlStats,
      hourly: hourlyStats,
      performance: performanceMetrics,
      recommendations
    };
  }
  
  /**
   * パーセンタイルを計算します
   * @param {Array<number>} values 値の配列
   * @param {number} percentile パーセンタイル（0-100）
   * @returns {number} パーセンタイル値
   * @private
   */
  _calculatePercentile(values, percentile) {
    if (!values || values.length === 0) {
      return 0;
    }
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * データを圧縮します
   * @param {Object} data 圧縮するデータ
   * @returns {Buffer|Object} 圧縮されたデータまたは元のデータ
   * @private
   */
  _compressData(data) {
    try {
      if (!this.config.enableCompression) return data;
      
      // データをJSON文字列に変換
      const jsonData = JSON.stringify(data);
      
      // 圧縮閾値より小さい場合は圧縮しない
      if (jsonData.length < this.config.compressionThreshold) {
        return data;
      }
      
      // データを圧縮
      const compressed = zlib.deflateSync(jsonData, {
        level: this.config.compressionLevel
      });
      
      // 圧縮統計を更新
      if (this.stats) {
        this.stats.originalSize += jsonData.length;
        this.stats.compressedSize += compressed.length;
      }
      
      // 圧縮データを返す
      return {
        _compressed: true,
        data: compressed.toString('base64')
      };
    } catch (error) {
      console.error('データ圧縮中にエラーが発生しました:', error);
      if (this.stats && this.stats.errors) {
        this.stats.errors.general++;
      }
      return data;
    }
  }
  
  /**
   * 圧縮されたデータを展開します
   * @param {Object} data 展開するデータ
   * @returns {Object} 展開されたデータ
   * @private
   */
  _decompressData(data) {
    try {
      // データが圧縮されていない場合はそのまま返す
      if (!data || !data._compressed) {
        return data;
      }
      
      // 圧縮データをバッファに変換
      const compressedBuffer = Buffer.from(data.data, 'base64');
      
      // データを展開
      const decompressed = zlib.inflateSync(compressedBuffer);
      
      // JSONにパース
      return JSON.parse(decompressed.toString());
    } catch (error) {
      console.error('データ展開中にエラーが発生しました:', error);
      if (this.stats && this.stats.errors) {
        this.stats.errors.general++;
      }
      return data;
    }
  }
  
  /**
   * Redis PubSubイベントリスナーを設定します
   * @private
   */
  _setupRedisEventListeners() {
    if (!this.config.enableRedisCache || !this.redisCache) {
      return;
    }
    
    console.log('Redis PubSubイベントリスナーを設定しています...');
    
    // キャッシュ無効化イベントのリスナー
    this.redisCache.on('invalidate', async (key, metadata) => {
      try {
        console.log(`Redis PubSubからキャッシュ無効化イベントを受信しました: key=${key}`);
        
        // 送信元のインスタンスIDを確認
        if (metadata && metadata.sourceInstance === this.instanceId) {
          console.log('自分自身が発行したイベントのため、処理をスキップします');
          return;
        }
        
        // メモリキャッシュから削除
        if (this.config.enableMemoryCache) {
          const deleted = this.memoryCache.cache.delete(key);
          if (deleted) {
            console.log(`メモリキャッシュからキー ${key} を削除しました`);
            this.memoryCacheSize = Math.max(0, this.memoryCacheSize - 1);
          }
        }
        
        // ファイルキャッシュから削除
        if (this.config.enableFileCache) {
          const filePath = path.join(this.config.cacheDir, `${key}.json`);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`ファイルキャッシュからキー ${key} を削除しました`);
            this.fileCacheSize = Math.max(0, this.fileCacheSize - 1);
          }
        }
      } catch (error) {
        console.error('キャッシュ無効化イベントの処理中にエラーが発生しました:', error);
      }
    });
    
    // モデルキャッシュクリアイベントのリスナー
    this.redisCache.on('clearModel', async (_, metadata) => {
      try {
        if (!metadata || !metadata.modelName) {
          console.error('clearModelイベントにmodelNameが含まれていません');
          return;
        }
        
        const { modelName, sourceInstance } = metadata;
        console.log(`Redis PubSubからモデルキャッシュクリアイベントを受信しました: model=${modelName}, source=${sourceInstance}`);
        
        // 送信元のインスタンスIDを確認
        if (sourceInstance === this.instanceId) {
          console.log('自分自身が発行したイベントのため、処理をスキップします');
          return;
        }
        
        // ローカルキャッシュのみをクリア（Redisは呼び出し元が処理済み）
        console.log(`他のインスタンスからの要求により、モデル ${modelName} のローカルキャッシュをクリアします`);
        await this._clearLocalModelCache(modelName);
      } catch (error) {
        console.error('モデルキャッシュクリアイベントの処理中にエラーが発生しました:', error);
      }
    });
    
    // キャッシュクリアイベントのリスナー
    this.redisCache.on('clear', async (_, metadata) => {
      try {
        console.log('Redis PubSubからキャッシュクリアイベントを受信しました');
        
        // 送信元のインスタンスIDを確認
        if (metadata && metadata.sourceInstance === this.instanceId) {
          console.log('自分自身が発行したイベントのため、処理をスキップします');
          return;
        }
        
        // ローカルキャッシュをクリア
        console.log('他のインスタンスからの要求により、ローカルキャッシュをクリアします');
        
        if (this.config.enableMemoryCache) {
          this.memoryCache.clear();
          this.memoryCacheSize = 0;
          console.log('メモリキャッシュをクリアしました');
        }
        
        if (this.config.enableFileCache) {
          this._clearFileCache();
          console.log('ファイルキャッシュをクリアしました');
        }
      } catch (error) {
        console.error('キャッシュクリアイベントの処理中にエラーが発生しました:', error);
      }
    });
    
    // バルク削除イベントのリスナー
    this.redisCache.on('bulkDelete', async (pattern, metadata) => {
      try {
        console.log(`Redis PubSubからバルク削除イベントを受信しました: pattern=${pattern}`);
        
        // 送信元のインスタンスIDを確認
        if (metadata && metadata.sourceInstance === this.instanceId) {
          console.log('自分自身が発行したイベントのため、処理をスキップします');
          return;
        }
        
        // ローカルキャッシュでパターンに一致するキーを削除
        const regex = new RegExp(pattern);
        
        // メモリキャッシュから削除
        if (this.config.enableMemoryCache) {
          let deletedCount = 0;
          const keysToDelete = [];
          
          this.memoryCache.cache.forEach((_, key) => {
            if (regex.test(key)) {
              keysToDelete.push(key);
            }
          });
          
          for (const key of keysToDelete) {
            this.memoryCache.cache.delete(key);
            deletedCount++;
          }
          
          this.memoryCacheSize = Math.max(0, this.memoryCacheSize - deletedCount);
          console.log(`メモリキャッシュから ${deletedCount} 件のキーを削除しました`);
        }
        
        // ファイルキャッシュから削除
        if (this.config.enableFileCache) {
          const files = fs.readdirSync(this.config.cacheDir)
            .filter(file => file.endsWith('.json') && file !== 'stats.json');
          
          let deletedCount = 0;
          
          for (const file of files) {
            const key = file.replace('.json', '');
            if (regex.test(key)) {
              const filePath = path.join(this.config.cacheDir, file);
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          }
          
          this.fileCacheSize = Math.max(0, this.fileCacheSize - deletedCount);
          console.log(`ファイルキャッシュから ${deletedCount} 件のキーを削除しました`);
        }
      } catch (error) {
        console.error('バルク削除イベントの処理中にエラーが発生しました:', error);
      }
    });
    
    console.log('Redis PubSubイベントリスナーの設定が完了しました');
  }
  
  /**
   * ファイルキャッシュをクリアします
   * @private
   */
  _clearFileCache() {
    try {
      if (!this.config.enableFileCache) {
        return;
      }
      
      console.log('ファイルキャッシュをクリアしています...');
      
      // stats.jsonを除くすべてのJSONファイルを削除
      const files = fs.readdirSync(this.config.cacheDir)
        .filter(file => file.endsWith('.json') && file !== 'stats.json');
      
      console.log(`ファイルキャッシュから ${files.length} ファイルを削除します`);
      
      for (const file of files) {
        try {
          const filePath = path.join(this.config.cacheDir, file);
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`ファイル ${file} の削除中にエラーが発生しました:`, error);
        }
      }
      
      this.fileCacheSize = 0;
      console.log('ファイルキャッシュを正常にクリアしました');
    } catch (error) {
      console.error('ファイルキャッシュのクリア中にエラーが発生しました:', error);
      if (this.stats && this.stats.errors) {
        this.stats.errors.file++;
      }
    }
  }
}

export { EmbeddingCache };

/**
 * ファイルキャッシュを読み込みます
 * @private
 */
EmbeddingCache.prototype._loadFileCache = function() {
  try {
    if (!this.config.enableFileCache) return;
    
    console.log('ファイルキャッシュを読み込んでいます...');
    
    // キャッシュディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.config.cacheDir)) {
      fs.mkdirSync(this.config.cacheDir, { recursive: true });
      console.log(`キャッシュディレクトリを作成しました: ${this.config.cacheDir}`);
      return;
    }
    
    // キャッシュディレクトリ内のJSONファイルを取得
    const files = fs.readdirSync(this.config.cacheDir)
      .filter(file => file.endsWith('.json') && file !== 'stats.json');
    
    this.fileCacheSize = files.length;
    console.log(`ファイルキャッシュサイズ: ${this.fileCacheSize} エントリ`);
    
    // this.statsが未初期化の場合は初期化
    if (!this.stats) {
      this.stats = {
        startTime: Date.now(),
        memory: { hits: 0, misses: 0, sets: 0, deletes: 0, requests: 0, modelInvalidations: 0 },
        redis: { hits: 0, misses: 0, sets: 0, deletes: 0, requests: 0, modelInvalidations: 0 },
        file: { hits: 0, misses: 0, sets: 0, deletes: 0, requests: 0, modelInvalidations: 0 },
        total: { hits: 0, misses: 0, sets: 0, deletes: 0, requests: 0 },
        syncs: { memory: 0, redis: 0, file: 0, total: 0 },
        errors: { memory: 0, redis: 0, file: 0, general: 0 },
        adaptiveTtlStats: { extended: 0, reduced: 0, unchanged: 0, totalTtl: 0, count: 0 },
        timing: { totalTime: 0, count: 0, responseTimes: [] }
      };
    }
    
    // 統計情報ファイルがある場合は読み込む
    const statsFile = path.join(this.config.cacheDir, 'stats.json');
    if (fs.existsSync(statsFile)) {
      try {
        const statsData = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
        if (statsData && typeof statsData === 'object') {
          // 既存の統計情報を保持しつつ、ファイルから読み込んだ統計情報で更新
          const currentStartTime = this.stats.startTime;
          this.stats = {
            ...this.stats,
            ...statsData,
            // 現在の実行時の統計情報は保持
            startTime: currentStartTime
          };
          console.log('キャッシュ統計情報を読み込みました');
        }
      } catch (err) {
        console.error('統計情報ファイルの読み込み中にエラーが発生しました:', err);
        if (this.stats && this.stats.errors) {
          this.stats.errors.file++;
        }
      }
    }
  } catch (error) {
    console.error('ファイルキャッシュの読み込み中にエラーが発生しました:', error);
    // this.statsが未初期化の場合は初期化
    if (!this.stats) {
      this.stats = {
        startTime: Date.now(),
        memory: { hits: 0, misses: 0, sets: 0, deletes: 0, requests: 0, modelInvalidations: 0 },
        redis: { hits: 0, misses: 0, sets: 0, deletes: 0, requests: 0, modelInvalidations: 0 },
        file: { hits: 0, misses: 0, sets: 0, deletes: 0, requests: 0, modelInvalidations: 0 },
        total: { hits: 0, misses: 0, sets: 0, deletes: 0, requests: 0 },
        syncs: { memory: 0, redis: 0, file: 0, total: 0 },
        errors: { memory: 0, redis: 0, file: 0, general: 0 },
        adaptiveTtlStats: { extended: 0, reduced: 0, unchanged: 0, totalTtl: 0, count: 0 },
        timing: { totalTime: 0, count: 0, responseTimes: [] }
      };
    }
    if (this.stats && this.stats.errors) {
      this.stats.errors.file++;
    }
  }
};

/**
 * キャッシュリソースを解放し、接続を閉じます
 * @returns {Promise<boolean>} 成功した場合はtrue
 */
EmbeddingCache.prototype.close = async function() {
  try {
    console.log('埋め込みキャッシュリソースを解放しています...');
    
    // 定期的なクリーンアップを停止
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // 統計情報を保存
    if (this.config.enableFileCache) {
      try {
        const statsFile = path.join(this.config.cacheDir, 'stats.json');
        fs.writeFileSync(statsFile, JSON.stringify(this.stats, null, 2), 'utf8');
        console.log('キャッシュ統計情報を保存しました');
      } catch (error) {
        console.error('統計情報の保存中にエラーが発生しました:', error);
      }
    }
    
    // Redis接続を閉じる
    if (this.config.enableRedisCache && this.redisCache) {
      await this.redisCache.close();
      console.log('Redis接続を閉じました');
    }
    
    console.log('埋め込みキャッシュリソースの解放が完了しました');
    return true;
  } catch (error) {
    console.error('キャッシュリソースの解放中にエラーが発生しました:', error);
    return false;
  }
};
