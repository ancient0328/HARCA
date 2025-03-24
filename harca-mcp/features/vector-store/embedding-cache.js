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
}

/**
 * 階層型埋め込みキャッシュクラス
 * メモリ内キャッシュとファイルキャッシュを組み合わせた高速かつ永続的なキャッシュシステム
 */
class EmbeddingCache {
  /**
   * 埋め込みキャッシュを初期化します
   * @param {Object} config 設定オブジェクト
   * @param {string} config.cacheDir キャッシュディレクトリのパス
   * @param {number} config.memoryLimit メモリキャッシュの最大サイズ（バイト）
   * @param {number} config.fileLimit ファイルキャッシュの最大サイズ（バイト）
   * @param {boolean} config.enableMemoryCache メモリキャッシュを有効にするかどうか
   * @param {boolean} config.enableFileCache ファイルキャッシュを有効にするかどうか
   * @param {boolean} config.enableRedisCache Redis分散キャッシュを有効にするかどうか
   * @param {string} config.redisUrl Redis接続URL
   * @param {number} config.defaultTTL デフォルトのTTL（秒）
   * @param {boolean} config.enableDetailedStats 詳細な統計情報を有効にするかどうか
   * @param {number} config.prefetchThreshold プリフェッチのしきい値（0.0〜1.0）
   * @param {number} config.maxPrefetchItems 一度にプリフェッチする最大アイテム数
   * @param {boolean} config.enableCompression キャッシュ圧縮を有効にするかどうか
   * @param {number} config.compressionLevel 圧縮レベル（1〜9）
   * @param {number} config.compressionThreshold 圧縮の閾値（バイト）
   */
  constructor(config = {}) {
    // 環境変数から設定を読み込む
    const envRedisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const envRedisCacheEnabled = process.env.REDIS_CACHE_ENABLED === 'true';
    const envMemoryCacheEnabled = process.env.ENABLE_MEMORY_CACHE === 'true';
    const envFileCacheEnabled = process.env.ENABLE_FILE_CACHE === 'true';
    const envCacheDir = process.env.CACHE_DIR || '.cache/embeddings';
    const envRedisCacheTTL = parseInt(process.env.REDIS_CACHE_TTL || '86400', 10);
    const envEnableCompression = process.env.ENABLE_CACHE_COMPRESSION === 'true';
    const envCompressionLevel = parseInt(process.env.CACHE_COMPRESSION_LEVEL || '6', 10);
    const envCompressionThreshold = parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024', 10);
    
    // 基本設定
    this.config = {
      cacheDir: config.cacheDir || path.join(__dirname, envCacheDir).replace('plugins', 'features'),
      memoryLimit: config.memoryLimit || 100 * 1024 * 1024, // 100MB
      fileLimit: config.fileLimit || 1024 * 1024 * 1024, // 1GB
      enableMemoryCache: config.enableMemoryCache !== undefined ? config.enableMemoryCache : envMemoryCacheEnabled,
      enableFileCache: config.enableFileCache !== undefined ? config.enableFileCache : envFileCacheEnabled,
      enableRedisCache: config.enableRedisCache !== undefined ? config.enableRedisCache : envRedisCacheEnabled,
      redisUrl: config.redisUrl || envRedisUrl,
      defaultTTL: config.defaultTTL || envRedisCacheTTL,
      enableDetailedStats: config.enableDetailedStats === true,
      prefetchThreshold: config.prefetchThreshold || 0.7,
      maxPrefetchItems: config.maxPrefetchItems || 5,
      enableCompression: config.enableCompression !== undefined ? config.enableCompression : envEnableCompression,
      compressionLevel: config.compressionLevel || envCompressionLevel,
      compressionThreshold: config.compressionThreshold || envCompressionThreshold
    };

    // キャッシュの初期化
    this.memoryCache = this.config.enableMemoryCache ? new LRUCache(1000) : null;
    this.fileCache = this.config.enableFileCache ? {} : null;
    this.redisCache = this.config.enableRedisCache ? 
      new RedisCacheManager({
        redisUrl: this.config.redisUrl,
        defaultTTL: this.config.defaultTTL,
        enablePubSub: true
      }) : null;

    // キャッシュ統計情報
    this.stats = {
      memory: {
        hits: 0,
        misses: 0,
        sets: 0,
        size: 0
      },
      redis: {
        hits: 0,
        misses: 0,
        sets: 0
      },
      file: {
        hits: 0,
        misses: 0,
        sets: 0,
        size: 0
      },
      total: {
        hits: 0,
        misses: 0,
        sets: 0,
        requests: 0,
        size: 0
      },
      originalSize: 0,
      compressedSize: 0
    };

    // 詳細な統計情報
    if (this.config.enableDetailedStats) {
      this.modelStats = {};
      this.hourlyStats = Array(24).fill().map(() => ({
        hits: 0,
        misses: 0,
        requests: 0
      }));
      this.sizeHistory = [];
    }

    // メモリキャッシュのLRU追跡
    this.lruList = [];
    this.memoryCacheSize = 0;

    // ファイルキャッシュの統計
    this.fileStats = new Map();
    this.fileCacheSize = 0;

    // キャッシュディレクトリの作成
    if (this.config.enableFileCache) {
      if (!fs.existsSync(this.config.cacheDir)) {
        fs.mkdirSync(this.config.cacheDir, { recursive: true });
      }
      this._loadFileCache();
    }

    // Redis分散キャッシュのイベントリスナー設定
    if (this.redisCache) {
      this._setupRedisEventListeners();
    }

    console.log('埋め込みキャッシュを初期化しました');
    if (this.config.enableMemoryCache) {
      console.log(`メモリキャッシュが有効です: 最大${this.memoryCache.capacity}エントリ`);
    }
    if (this.config.enableRedisCache) {
      console.log(`Redis分散キャッシュが有効です: ${this.config.redisUrl}`);
    }
    if (this.config.enableFileCache) {
      console.log(`ファイルキャッシュが有効です: ${this.config.cacheDir}`);
    }
    console.log(`現在のキャッシュサイズ: ${this.memoryCacheSize}エントリ`);
    console.log(`プリフェッチが有効です: しきい値=${this.config.prefetchThreshold}, 最大アイテム数=${this.config.maxPrefetchItems}`);
    console.log(`キャッシュ圧縮が有効です: レベル=${this.config.compressionLevel}, 閾値=${this.config.compressionThreshold}バイト`);
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
      console.error('統計情報の収集に失敗しました:', error);
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
  calculateAdaptiveTtl(accessCount, lastAccessed) {
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
    const hourlyHits = this.stats.detailedStats.hourlyHits[hour];
    const hourlyMisses = this.stats.detailedStats.hourlyMisses[hour];
    const hourlyTotal = hourlyHits + hourlyMisses;
    
    // アクセスが多い時間帯ではTTLを延長（キャッシュヒット率向上のため）
    if (hourlyTotal > 100 && hourlyHits / hourlyTotal > 0.8) {
      ttl = Math.min(this.config.maxTTL, ttl * 1.2);
    }
    
    return ttl;
  }
  
  // キャッシュからデータを取得します
  async get(text, modelName = 'default') {
    this.stats.requests++;
    
    // 詳細な統計情報の更新
    if (this.config.enableDetailedStats) {
      const hour = new Date().getHours();
      this.hourlyStats[hour].requests++;
      
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
    
    // メモリキャッシュから取得を試みる
    if (this.config.enableMemoryCache) {
      const memoryResult = this.memoryCache.get(key);
      if (memoryResult) {
        // アクセス頻度を更新
        this.updateFrequency(text, modelName);
        
        // 統計情報を更新
        this.stats.memory.hits++;
        this.stats.total.hits++;
        
        // 詳細な統計情報の更新
        if (this.config.enableDetailedStats) {
          const hour = new Date().getHours();
          this.hourlyStats[hour].hits++;
          this.modelStats[modelName].hits++;
        }
        
        return this._decompressData(memoryResult);
      }
    }
    
    // Redis分散キャッシュから取得を試みる
    if (this.config.enableRedisCache) {
      try {
        const redisResult = await this.redisCache.get(text, modelName);
        if (redisResult) {
          // アクセス頻度を更新
          this.updateFrequency(text, modelName);
          
          // 統計情報を更新
          this.stats.redis.hits++;
          this.stats.total.hits++;
          
          // 詳細な統計情報の更新
          if (this.config.enableDetailedStats) {
            const hour = new Date().getHours();
            this.hourlyStats[hour].hits++;
            this.modelStats[modelName].hits++;
          }
          
          // メモリキャッシュにも保存（階層化）
          if (this.config.enableMemoryCache) {
            this.memoryCache.set(key, redisResult);
          }
          
          return this._decompressData(redisResult);
        }
      } catch (error) {
        console.error('Redis分散キャッシュからの取得中にエラーが発生しました:', error);
      }
    }
    
    // ファイルキャッシュから取得を試みる
    if (this.config.enableFileCache) {
      const cacheFile = path.join(this.config.cacheDir, `${key}.json`);
      
      try {
        if (fs.existsSync(cacheFile)) {
          const data = fs.readFileSync(cacheFile, 'utf8');
          const cacheEntry = JSON.parse(data);
          
          // TTLのチェック
          if (cacheEntry.expiresAt && new Date(cacheEntry.expiresAt) < new Date()) {
            // 期限切れのキャッシュを削除
            fs.unlinkSync(cacheFile);
            this.stats.file.misses++;
            this.stats.total.misses++;
            this.fileCacheSize = Math.max(0, this.fileCacheSize - 1);
            
            // 詳細な統計情報の更新
            if (this.config.enableDetailedStats) {
              const hour = new Date().getHours();
              this.hourlyStats[hour].misses++;
              this.modelStats[modelName].misses++;
            }
            
            return null;
          }
          
          // キャッシュヒット
          this.stats.file.hits++;
          this.stats.total.hits++;
          
          // 詳細な統計情報の更新
          if (this.config.enableDetailedStats) {
            const hour = new Date().getHours();
            this.hourlyStats[hour].hits++;
            this.modelStats[modelName].hits++;
          }
          
          // アクセス時間と頻度を更新
          cacheEntry.lastAccessed = new Date().toISOString();
          cacheEntry.accessCount = (cacheEntry.accessCount || 0) + 1;
          fs.writeFileSync(cacheFile, JSON.stringify(cacheEntry, null, 2), 'utf8');
          
          // アクセス頻度を更新
          this.updateFrequency(text, modelName);
          
          // 頻度ベースの戦略：一定以上のアクセス頻度でメモリキャッシュに昇格
          if (this.config.enableMemoryCache && this.config.useFrequencyBasedStrategy && 
              cacheEntry.accessCount >= this.config.frequencyThreshold) {
            this.memoryCache.set(key, cacheEntry.embedding);
          }
          
          // Redis分散キャッシュにも保存（階層化）
          if (this.config.enableRedisCache) {
            this.redisCache.set(text, cacheEntry.embedding, modelName)
              .catch(err => console.error('Redis分散キャッシュへの保存中にエラーが発生しました:', err));
          }
          
          return this._decompressData(cacheEntry.embedding);
        }
      } catch (error) {
        console.error('ファイルキャッシュからの取得中にエラーが発生しました:', error);
      }
      
      // キャッシュミス
      this.stats.file.misses++;
      this.stats.total.misses++;
      
      // 詳細な統計情報の更新
      if (this.config.enableDetailedStats) {
        const hour = new Date().getHours();
        this.hourlyStats[hour].misses++;
        this.modelStats[modelName].misses++;
      }
    } else {
      // ファイルキャッシュが無効な場合
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
    
    // メモリキャッシュに保存
    if (this.config.enableMemoryCache) {
      const compressedData = this._compressData(embedding);
      this.memoryCache.set(key, compressedData);
      this.stats.memory.sets++;
      this.stats.total.sets++;
    }
    
    // Redis分散キャッシュに保存
    if (this.config.enableRedisCache) {
      try {
        const compressedData = this._compressData(embedding);
        await this.redisCache.set(text, compressedData, modelName);
        this.stats.redis.sets++;
        this.stats.total.sets++;
      } catch (error) {
        console.error('Redis分散キャッシュへの保存中にエラーが発生しました:', error);
      }
    }
    
    // ファイルキャッシュに保存
    if (this.config.enableFileCache) {
      try {
        // キャッシュサイズをチェック
        if (this.fileCacheSize >= this.config.maxCacheSize) {
          // 自動クリーンアップ
          this.cleanCache();
        }
        
        const cacheFile = path.join(this.config.cacheDir, `${key}.json`);
        
        // アクセス頻度を更新
        this.updateFrequency(text, modelName);
        
        // TTLの計算
        const ttl = this.calculateAdaptiveTtl(1, new Date().toISOString());
        const expiresAt = new Date(Date.now() + ttl).toISOString();
        
        // キャッシュエントリの作成
        const cacheEntry = {
          text,
          modelName,
          embedding: this._compressData(embedding),
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          expiresAt,
          accessCount: 1
        };
        
        // ファイルに保存
        fs.writeFileSync(cacheFile, JSON.stringify(cacheEntry, null, 2), 'utf8');
        
        // 統計情報を更新
        this.fileCacheSize++;
        this.stats.file.sets++;
        this.stats.total.sets++;
        
        // プリフェッチ処理
        if (this.config.enablePrefetch) {
          this.prefetchRelatedItems(text, embedding, modelName);
        }
        
        return true;
      } catch (error) {
        console.error('ファイルキャッシュへの保存中にエラーが発生しました:', error);
        return false;
      }
    }
    
    return true;
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
  getStats() {
    const stats = {
      memory: {
        hits: this.stats.memory.hits,
        misses: this.stats.memory.misses,
        sets: this.stats.memory.sets,
        size: this.memoryCacheSize,
        hitRate: (this.stats.memory.hits + this.stats.memory.misses) > 0 
          ? (this.stats.memory.hits / (this.stats.memory.hits + this.stats.memory.misses) * 100).toFixed(2) + '%' 
          : '0%'
      },
      redis: {
        hits: this.stats.redis.hits,
        misses: this.stats.redis.misses,
        sets: this.stats.redis.sets,
        hitRate: (this.stats.redis.hits + this.stats.redis.misses) > 0 
          ? (this.stats.redis.hits / (this.stats.redis.hits + this.stats.redis.misses) * 100).toFixed(2) + '%' 
          : '0%'
      },
      file: {
        hits: this.stats.file.hits,
        misses: this.stats.file.misses,
        sets: this.stats.file.sets,
        size: this.fileCacheSize,
        hitRate: (this.stats.file.hits + this.stats.file.misses) > 0 
          ? (this.stats.file.hits / (this.stats.file.hits + this.stats.file.misses) * 100).toFixed(2) + '%' 
          : '0%'
      },
      total: {
        hits: this.stats.total.hits,
        misses: this.stats.total.misses,
        sets: this.stats.total.sets,
        requests: this.stats.requests,
        size: this.memoryCacheSize + this.fileCacheSize,
        hitRate: this.stats.total.hits + this.stats.total.misses > 0 
          ? (this.stats.total.hits / (this.stats.total.hits + this.stats.total.misses) * 100).toFixed(2) + '%' 
          : '0%'
      }
    };
    
    // 詳細な統計情報を追加
    if (this.config.enableDetailedStats) {
      stats.detailed = {
        hourlyHitRate: this.calculateHourlyHitRate(),
        modelStats: this.modelStats,
        lastUpdated: new Date().toISOString()
      };
    }
    
    return stats;
  }
  
  // 時間別ヒット率の計算
  calculateHourlyHitRate() {
    const hourlyHitRate = [];
    
    if (!this.config.enableDetailedStats || !this.hourlyStats) {
      return hourlyHitRate;
    }
    
    for (let i = 0; i < 24; i++) {
      if (!this.hourlyStats[i]) continue;
      
      const hourData = this.hourlyStats[i];
      const hits = hourData.hits || 0;
      const misses = hourData.misses || 0;
      const total = hourData.requests || 0;
      
      if (total > 0) {
        const hitRate = (hits / total * 100).toFixed(2);
        
        let pattern = 'normal';
        if (hitRate < 30) pattern = 'low_hit_rate';
        else if (hitRate > 80) pattern = 'high_hit_rate';
        
        let volume = 'low';
        if (total > 100) volume = 'high';
        else if (total > 20) volume = 'medium';
        
        hourlyHitRate.push({
          hour: i,
          requests: total,
          hits,
          misses,
          hitRate: `${hitRate}%`,
          pattern,
          volume
        });
      }
    }
    
    return hourlyHitRate;
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
        success = false;
      }
    }
    
    // Redis分散キャッシュをクリア
    if (this.config.enableRedisCache) {
      try {
        console.log('Redis分散キャッシュをクリアしています...');
        // 直接Redisキャッシュをクリア（個別モデルごとではなく一括で）
        await this.redisCache.clear();
        console.log('Redis分散キャッシュを正常にクリアしました');
      } catch (error) {
        console.error('Redis分散キャッシュのクリア中にエラーが発生しました:', error);
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
        
        // 統計情報をリセット
        this.stats = {
          memory: {
            hits: 0,
            misses: 0,
            sets: 0,
            size: 0
          },
          redis: {
            hits: 0,
            misses: 0,
            sets: 0
          },
          file: {
            hits: 0,
            misses: 0,
            sets: 0,
            size: 0
          },
          total: {
            hits: 0,
            misses: 0,
            sets: 0,
            requests: 0,
            size: 0
          },
          originalSize: 0,
          compressedSize: 0
        };
        
        this.fileCacheSize = 0;
        console.log('ファイルキャッシュを正常にクリアしました');
      } catch (error) {
        console.error('ファイルキャッシュのクリア中にエラーが発生しました:', error);
        success = false;
      }
    }
    
    console.log('すべてのキャッシュクリア処理が完了しました');
    return success;
  }
  
  /**
   * 特定のモデルのキャッシュをクリアします
   * @param {string} modelName モデル名
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  async clearModelCache(modelName) {
    console.log(`モデル ${modelName} のキャッシュをクリアします...`);
    let success = true;
    
    // メモリキャッシュから特定のモデルのエントリを削除
    if (this.config.enableMemoryCache) {
      try {
        console.log(`メモリキャッシュから ${modelName} モデルのエントリを削除しています...`);
        let deletedCount = 0;
        
        const keysToDelete = [];
        for (const key of this.memoryCache.keys()) {
          const entry = this.memoryCache.get(key);
          if (entry && entry.modelName === modelName) {
            keysToDelete.push(key);
            deletedCount++;
          }
        }
        
        // 一括で削除
        for (const key of keysToDelete) {
          this.memoryCache.cache.delete(key);
        }
        
        this.memoryCacheSize = Math.max(0, this.memoryCacheSize - deletedCount);
        console.log(`メモリキャッシュから ${modelName} モデルの ${deletedCount} エントリを削除しました`);
      } catch (error) {
        console.error(`メモリキャッシュからの ${modelName} モデルの削除中にエラーが発生しました:`, error);
        success = false;
      }
    }
    
    // Redis分散キャッシュから特定のモデルのエントリを削除
    if (this.config.enableRedisCache) {
      try {
        console.log(`Redis分散キャッシュから ${modelName} モデルのエントリを削除しています...`);
        const redisSuccess = await this.redisCache.clearModelCache(modelName);
        if (redisSuccess) {
          // PubSubを通じて他のインスタンスに通知
          this.redisCache._publishMessage('clearModel', null, { modelName });
          console.log(`Redis分散キャッシュから ${modelName} モデルのエントリを削除しました`);
        } else {
          console.error(`Redis分散キャッシュからの ${modelName} モデルの削除に失敗しました`);
          success = false;
        }
      } catch (error) {
        console.error(`Redis分散キャッシュからの ${modelName} モデルの削除中にエラーが発生しました:`, error);
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
        const modelPattern = new RegExp(`_${modelName}_`);
        
        for (const file of files) {
          if (modelPattern.test(file)) {
            const filePath = path.join(this.config.cacheDir, file);
            try {
              fs.unlinkSync(filePath);
              deletedCount++;
            } catch (fileError) {
              console.error(`ファイル ${file} の削除中にエラーが発生しました:`, fileError);
            }
          }
        }
        
        this.fileCacheSize = Math.max(0, this.fileCacheSize - deletedCount);
        console.log(`ファイルキャッシュから ${modelName} モデルの ${deletedCount} エントリを削除しました`);
      } catch (error) {
        console.error(`ファイルキャッシュからの ${modelName} モデルの削除中にエラーが発生しました:`, error);
        success = false;
      }
    }
    
    console.log(`モデル ${modelName} のキャッシュクリア処理が完了しました (成功: ${success})`);
    return success;
  }
  
  // キャッシュの最適化（アクセス頻度の高いアイテムをメモリキャッシュに昇格）
  optimizeCache() {
    if (!this.config.enableMemoryCache || !this.config.enableFileCache) {
      return false;
    }
    
    try {
      // キャッシュファイルの一覧を取得
      const files = fs.readdirSync(this.config.cacheDir)
        .filter(file => file.endsWith('.json') && file !== 'stats.json');
      
      // 各ファイルのアクセス頻度を取得
      const fileStats = files.map(file => {
        const filePath = path.join(this.config.cacheDir, file);
        try {
          const data = fs.readFileSync(filePath, 'utf8');
          const cacheEntry = JSON.parse(data);
          
          // ホットデータの識別
          const key = `${cacheEntry.modelName}:${cacheEntry.text.substring(0, 100)}`;
          const isHot = this.recentAccesses.some(access => access.key === key);
          
          return {
            file,
            filePath,
            key: file.replace('.json', ''),
            accessCount: cacheEntry.accessCount || 0,
            embedding: cacheEntry.embedding,
            isHot,
            lastAccessed: new Date(cacheEntry.lastAccessed || 0)
          };
        } catch (error) {
          return null;
        }
      }).filter(stat => stat !== null);
      
      // 最適化戦略の適用
      let topItems;
      
      if (this.config.useFrequencyBasedStrategy) {
        // ホットデータを優先し、次にアクセス頻度でソート
        fileStats.sort((a, b) => {
          if (a.isHot && !b.isHot) return -1;
          if (!a.isHot && b.isHot) return 1;
          return b.accessCount - a.accessCount;
        });
        
        topItems = fileStats.slice(0, this.memoryCache.capacity);
      } else {
        // LRU戦略：最近アクセスされたアイテムのみを考慮
        fileStats.sort((a, b) => b.lastAccessed - a.lastAccessed);
        topItems = fileStats.slice(0, this.memoryCache.capacity);
      }
      
      // メモリキャッシュをクリアして再構築
      this.memoryCache.clear();
      
      // 上位のアイテムをメモリキャッシュに昇格
      for (const item of topItems) {
        if (this.config.useFrequencyBasedStrategy && item.accessCount < this.config.frequencyThreshold && !item.isHot) {
          continue; // 頻度が低く、ホットでもないアイテムはスキップ
        }
        this.memoryCache.set(item.key, item.embedding);
      }
      
      // 最適化結果の分析
      const optimizationStats = {
        totalItems: fileStats.length,
        promotedItems: topItems.length,
        hotItems: fileStats.filter(item => item.isHot).length,
        highFrequencyItems: fileStats.filter(item => item.accessCount >= this.config.frequencyThreshold).length,
        timestamp: new Date().toISOString()
      };
      
      // 最適化統計を保存
      if (!this.stats.optimizationHistory) {
        this.stats.optimizationHistory = [];
      }
      
      this.stats.optimizationHistory.push(optimizationStats);
      
      // 最大10件の履歴を保持
      if (this.stats.optimizationHistory.length > 10) {
        this.stats.optimizationHistory.shift();
      }
      
      this.saveStats();
      
      console.log(`キャッシュを最適化しました: ${topItems.length}アイテムをメモリキャッシュに昇格`);
      return true;
    } catch (error) {
      console.error('キャッシュ最適化に失敗しました:', error);
      return false;
    }
  }
  
  /**
   * テキストの埋め込みベクトルを取得または生成
   * @param {string} text - テキスト
   * @param {string} model - モデル名
   * @returns {Promise<Array<number>>} 埋め込みベクトル
   */
  async get(text, model = 'text-embedding-ada-002') {
    if (!text) {
      throw new Error('テキストが指定されていません');
    }
    
    this.stats.total.requests++;
    
    const cacheKey = this._getCacheKey(text, model);
    let embedding = null;
    
    // 1. メモリキャッシュを確認
    if (this.config.enableMemoryCache && this.memoryCache) {
      embedding = this.memoryCache.get(cacheKey);
      if (embedding) {
        this.stats.memory.hits++;
        this.stats.total.hits++;
        return embedding;
      } else {
        this.stats.memory.misses++;
      }
    }
    
    // 2. Redis分散キャッシュを確認
    if (!embedding && this.config.enableRedisCache && this.redisCache) {
      try {
        const redisData = await this.redisCache.get(cacheKey);
        if (redisData) {
          embedding = JSON.parse(redisData);
          
          // メモリキャッシュに保存
          if (this.config.enableMemoryCache && this.memoryCache) {
            this.memoryCache.set(cacheKey, embedding);
            this.stats.memory.sets++;
          }
          
          this.stats.redis.hits++;
          this.stats.total.hits++;
          return embedding;
        } else {
          this.stats.redis.misses++;
        }
      } catch (err) {
        console.error('Redis分散キャッシュからの取得エラー:', err);
        this.stats.redis.misses++;
      }
    }
    
    // 3. ファイルキャッシュを確認
    if (!embedding && this.config.enableFileCache) {
      try {
        const fileCacheDir = path.join(this.config.cacheDir, model);
        if (!fs.existsSync(fileCacheDir)) {
          fs.mkdirSync(fileCacheDir, { recursive: true });
        }
        
        const hash = crypto.createHash('md5').update(text).digest('hex');
        const cacheFile = path.join(fileCacheDir, `${hash}.json`);
        
        if (fs.existsSync(cacheFile)) {
          const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          embedding = cacheData.embedding;
          
          // メモリキャッシュに保存
          if (this.config.enableMemoryCache && this.memoryCache) {
            this.memoryCache.set(cacheKey, embedding);
            this.stats.memory.sets++;
          }
          
          this.stats.file.hits++;
          this.stats.total.hits++;
          return embedding;
        } else {
          this.stats.file.misses++;
        }
      } catch (err) {
        console.error('ファイルキャッシュからの取得エラー:', err);
        this.stats.file.misses++;
      }
    }
    
    // 4. 埋め込みベクトルを生成
    this.stats.total.misses++;
    try {
      embedding = await this._generateEmbedding(text, model);
      
      // キャッシュに保存
      await this.set(text, embedding, model);
      
      return embedding;
    } catch (err) {
      console.error('埋め込みベクトル生成エラー:', err);
      throw new Error(`埋め込みベクトルの生成に失敗しました: ${err.message}`);
    }
  }
  
  /**
   * キャッシュキーを生成
   * @param {string} text - テキスト
   * @param {string} model - モデル名
   * @returns {string} キャッシュキー
   * @private
   */
  _getCacheKey(text, model) {
    // テキストのハッシュを計算
    const hash = crypto.createHash('md5').update(text).digest('hex');
    // モデル名とハッシュを組み合わせてキャッシュキーを生成
    return `${model}:${hash}`;
  }
  
  /**
   * テキストの埋め込みベクトルを生成（実際のモデルの代わりにモック機能）
   * @param {string} text - 埋め込みベクトルに変換するテキスト
   * @param {string} model - 使用する埋め込みモデル名
   * @returns {Promise<number[]>} 埋め込みベクトル
   * @private
   */
  async _generateEmbedding(text, model) {
    console.log(`モックの埋め込みベクトルを生成します: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}" (モデル: ${model})`);
    
    // モックの埋め込みベクトルを生成
    // 実際のアプリケーションでは、ここでOpenAIなどのAPIを呼び出す
    const dimensions = model === 'text-embedding-ada-002' ? 1536 : 768;
    const embedding = new Array(dimensions).fill(0).map(() => (Math.random() * 2 - 1) * 0.1);
    
    // テキストの長さに基づいて一部の値を調整（テキストの特性を反映するため）
    const textLength = text.length;
    for (let i = 0; i < Math.min(textLength, dimensions); i++) {
      embedding[i] += (text.charCodeAt(i % text.length) / 255) * 0.1;
    }
    
    // ベクトルを正規化
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalizedEmbedding = embedding.map(val => val / norm);
    
    return normalizedEmbedding;
  }
  
  /**
   * データを圧縮します
   * @param {*} data 圧縮するデータ
   * @returns {Buffer|*} 圧縮されたデータまたは元のデータ
   * @private
   */
  _compressData(data) {
    if (!this.config.enableCompression) {
      return data;
    }
    
    try {
      // データをJSON文字列に変換
      const jsonData = JSON.stringify(data);
      
      // 圧縮の閾値よりも小さい場合は圧縮しない
      if (jsonData.length < this.config.compressionThreshold) {
        return data;
      }
      
      // データを圧縮
      const compressed = zlib.deflateSync(jsonData, {
        level: this.config.compressionLevel
      });
      
      return {
        compressed: true,
        data: compressed.toString('base64')
      };
    } catch (err) {
      console.error('データの圧縮中にエラーが発生しました:', err);
      return data;
    }
  }
  
  /**
   * 圧縮されたデータを解凍します
   * @param {*} data 解凍するデータ
   * @returns {*} 解凍されたデータまたは元のデータ
   * @private
   */
  _decompressData(data) {
    if (!data || !data.compressed) {
      return data;
    }
    
    try {
      // Base64文字列をバッファに変換
      const compressedData = Buffer.from(data.data, 'base64');
      
      // データを解凍
      const decompressed = zlib.inflateSync(compressedData);
      
      // JSON文字列をオブジェクトに変換
      return JSON.parse(decompressed.toString());
    } catch (err) {
      console.error('データの解凍中にエラーが発生しました:', err);
      return data;
    }
  }
  
  // キャッシュのパフォーマンスを分析します
  analyzePerformance() {
    const totalRequests = this.stats.requests;
    const totalHits = this.stats.total.hits;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    
    const memoryHits = this.stats.memory.hits;
    const redisHits = this.stats.redis.hits;
    const fileHits = this.stats.file.hits;
    
    const memoryCacheSize = this.config.enableMemoryCache ? this.memoryCacheSize : 0;
    const fileCacheSize = this.config.enableFileCache ? this.fileCacheSize : 0;
    
    // 圧縮率の計算
    let compressionRatio = 1;
    if (this.config.enableCompression) {
      const originalSize = this.stats.originalSize || 1;
      const compressedSize = this.stats.compressedSize || 1;
      compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
    }
    
    const analysis = {
      timestamp: new Date().toISOString(),
      hitRate: hitRate,
      requestCount: totalRequests,
      hitCount: totalHits,
      missCount: totalRequests - totalHits,
      cacheDistribution: {
        memory: memoryHits / Math.max(totalHits, 1),
        redis: redisHits / Math.max(totalHits, 1),
        file: fileHits / Math.max(totalHits, 1)
      },
      cacheSize: {
        memory: memoryCacheSize,
        file: fileCacheSize,
        total: memoryCacheSize + fileCacheSize
      },
      efficiency: this._calculateEfficiency(),
      recommendations: this._generateRecommendations(),
      compression: {
        enabled: this.config.enableCompression,
        ratio: compressionRatio,
        level: this.config.compressionLevel,
        threshold: this.config.compressionThreshold
      }
    };
    
    // 分析結果を保存
    this.performanceAnalysis = analysis;
    
    return analysis;
  }
  
  /**
   * キャッシュの効率性を計算します
   * @returns {Object} 効率性の指標
   * @private
   */
  _calculateEfficiency() {
    const { memory, redis, file, total } = this.stats;
    
    // ヒット率の計算
    const memoryHitRate = memory.hits / (memory.hits + memory.misses) || 0;
    const redisHitRate = redis.hits / (redis.hits + redis.misses) || 0;
    const fileHitRate = file.hits / (file.hits + file.misses) || 0;
    const totalHitRate = total.hits / (total.hits + total.misses) || 0;
    
    // メモリ使用効率
    const memoryEfficiency = memory.hits / (this.memoryCacheSize || 1);
    
    // 圧縮効率
    const compressionEfficiency = this.stats.originalSize > 0 ? 
      1 - (this.stats.compressedSize / this.stats.originalSize) : 0;
    
    return {
      hitRate: {
        memory: memoryHitRate,
        redis: redisHitRate,
        file: fileHitRate,
        total: totalHitRate
      },
      memoryEfficiency,
      compressionEfficiency
    };
  }
  
  /**
   * キャッシュパフォーマンスに基づく推奨事項を生成します
   * @returns {Array<string>} 推奨事項のリスト
   * @private
   */
  _generateRecommendations() {
    const recommendations = [];
    const efficiency = this._calculateEfficiency();
    
    // ヒット率に基づく推奨
    if (efficiency.hitRate.total < 0.5) {
      recommendations.push('キャッシュヒット率が低いです。キャッシュサイズの増加を検討してください。');
    }
    
    // メモリ効率に基づく推奨
    if (efficiency.memoryEfficiency < 0.2 && this.memoryCacheSize > 100) {
      recommendations.push('メモリキャッシュの効率が低いです。使用頻度の低いアイテムを削除することを検討してください。');
    }
    
    // 圧縮効率に基づく推奨
    if (this.config.enableCompression && efficiency.compressionEfficiency < 0.3) {
      recommendations.push('圧縮効率が低いです。圧縮レベルの調整または圧縮閾値の変更を検討してください。');
    } else if (!this.config.enableCompression && this.stats.originalSize > 10 * 1024 * 1024) {
      recommendations.push('キャッシュサイズが大きいです。圧縮の有効化を検討してください。');
    }
    
    // Redis使用に関する推奨
    if (!this.config.enableRedisCache && this.stats.total.requests > 10000) {
      recommendations.push('リクエスト数が多いです。分散キャッシュ（Redis）の有効化を検討してください。');
    }
    
    return recommendations;
  }
  
  /**
   * リソースを解放し、キャッシュを閉じます
   * @returns {Promise<void>}
   */
  async close() {
    try {
      // Redis接続を閉じる
      if (this.redisCache) {
        await this.redisCache.close();
        console.log('Redis接続を閉じました');
      }
      
      // 統計情報を保存
      if (this.config.enableDetailedStats) {
        this.saveStats();
      }
      
      console.log('キャッシュリソースを解放しました');
      return true;
    } catch (error) {
      console.error('キャッシュを閉じる際にエラーが発生しました:', error);
      return false;
    }
  }
  
  /**
   * ファイルキャッシュを読み込みます
   * @private
   */
  _loadFileCache() {
    try {
      if (!fs.existsSync(this.config.cacheDir)) {
        fs.mkdirSync(this.config.cacheDir, { recursive: true });
        return;
      }
      
      const files = fs.readdirSync(this.config.cacheDir)
        .filter(file => file.endsWith('.json') && file !== 'stats.json');
      
      this.fileCacheSize = files.length;
      
      console.log(`ファイルキャッシュから ${this.fileCacheSize} エントリを読み込みました`);
      
      // 詳細な統計情報を収集する場合は、各ファイルのメタデータを読み込む
      if (this.config.enableDetailedStats && this.fileCacheSize > 0) {
        // サンプリングして統計情報を収集（全ファイルを読み込むと時間がかかるため）
        const sampleSize = Math.min(100, this.fileCacheSize);
        const sampleFiles = files.sort(() => 0.5 - Math.random()).slice(0, sampleSize);
        
        for (const file of sampleFiles) {
          try {
            const filePath = path.join(this.config.cacheDir, file);
            const stats = fs.statSync(filePath);
            const data = fs.readFileSync(filePath, 'utf8');
            const cacheEntry = JSON.parse(data);
            
            if (cacheEntry.modelName && !this.modelStats[cacheEntry.modelName]) {
              this.modelStats[cacheEntry.modelName] = {
                hits: 0,
                misses: 0,
                requests: 0
              };
            }
            
            this.fileStats.set(file, {
              size: stats.size,
              lastAccessed: cacheEntry.lastAccessed || stats.mtime.toISOString(),
              accessCount: cacheEntry.accessCount || 0,
              modelName: cacheEntry.modelName || 'default'
            });
          } catch (error) {
            // 個別のファイル読み込みエラーは無視
            console.error(`ファイル ${file} の読み込み中にエラーが発生しました:`, error.message);
          }
        }
        
        console.log(`${sampleSize} ファイルのサンプルから統計情報を収集しました`);
      }
    } catch (error) {
      console.error('ファイルキャッシュの読み込み中にエラーが発生しました:', error);
      this.fileCacheSize = 0;
    }
  }
  
  /**
   * Redis分散キャッシュのイベントリスナーを設定します
   * @private
   */
  _setupRedisEventListeners() {
    if (!this.redisCache) return;
    
    // 他のインスタンスからのキャッシュ設定イベント
    this.redisCache.on('set', (key, metadata) => {
      // キーからテキストとモデル名を抽出（必要に応じて）
      // ここでは単純化のため、メモリキャッシュを無効化するだけ
      const keyParts = key.split(':');
      const hash = keyParts[keyParts.length - 1];
      
      // メモリキャッシュから該当するエントリを探して無効化
      if (this.memoryCache) {
        for (const cacheKey of this.memoryCache.keys()) {
          if (cacheKey.includes(hash)) {
            // エントリを更新するか、必要に応じて削除
            this.memoryCache.delete(cacheKey);
            console.log(`Redis同期: メモリキャッシュからキー ${cacheKey} を削除しました`);
            break;
          }
        }
      }
    });

    // 他のインスタンスからのキャッシュ削除イベント
    this.redisCache.on('delete', (key) => {
      // 同様にメモリキャッシュから削除
      const keyParts = key.split(':');
      const hash = keyParts[keyParts.length - 1];
      
      if (this.memoryCache) {
        for (const cacheKey of this.memoryCache.keys()) {
          if (cacheKey.includes(hash)) {
            this.memoryCache.delete(cacheKey);
            console.log(`Redis同期: メモリキャッシュからキー ${cacheKey} を削除しました`);
            break;
          }
        }
      }
    });

    // 他のインスタンスからのキャッシュクリアイベント
    this.redisCache.on('clear', () => {
      // メモリキャッシュをクリア
      if (this.memoryCache) {
        this.memoryCache.clear();
        this.lruList = [];
        this.memoryCacheSize = 0;
        console.log('Redis同期: メモリキャッシュをクリアしました');
      }
    });
    
    console.log('Redis分散キャッシュのイベントリスナーを設定しました');
  }
  
  /**
   * メモリキャッシュのサイズを取得します
   * @returns {number} メモリキャッシュ内のエントリ数
   */
  getMemoryCacheSize() {
    return this.memoryCache ? Object.keys(this.memoryCache).length : 0;
  }

  /**
   * ファイルキャッシュのサイズを取得します
   * @returns {number} ファイルキャッシュ内のエントリ数
   */
  getFileCacheSize() {
    return this.fileCacheSize;
  }
}

export { EmbeddingCache };
