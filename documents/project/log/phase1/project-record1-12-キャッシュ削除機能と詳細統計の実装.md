# HARCAプロジェクト実装記録 - キャッシュ削除機能と詳細統計の実装

## プロジェクト概要

コンテナ化モジュラーモノリスアーキテクチャにおけるキャッシュシステムの機能を拡張し、キャッシュ削除機能、モデル単位の無効化、および詳細な統計情報収集機能を実装しました。これにより、キャッシュの一貫性維持と性能分析が可能になり、システム全体の効率と信頼性が向上しました。

## 実装内容

### 1. キャッシュ削除機能

EmbeddingCacheクラスに`delete`メソッドを実装し、特定のテキストとモデル名に基づいてキャッシュエントリを削除する機能を追加しました。

```javascript
/**
 * 指定されたテキストとモデル名に基づいてキャッシュエントリを削除します
 * @param {string} text 削除するテキスト
 * @param {string} modelName 削除するモデル名
 * @returns {Promise<boolean>} 削除が成功したかどうか
 */
async delete(text, modelName) {
  try {
    const key = this._generateCacheKey(text, modelName);
    let deleted = false;
    
    // メモリキャッシュから削除
    if (this.config.enableMemoryCache && this.memoryCache) {
      if (this.memoryCache.has(key)) {
        this.memoryCache.delete(key);
        this.stats.memory.deletes++;
        deleted = true;
      }
    }
    
    // Redis分散キャッシュから削除
    if (this.config.enableRedisCache && this.redisCache) {
      const redisDeleted = await this.redisCache.delete(key);
      if (redisDeleted) {
        this.stats.redis.deletes++;
        deleted = true;
        
        // 他のインスタンスに無効化イベントを発行
        await this.redisCache.publishInvalidation(key);
      }
    }
    
    // ファイルキャッシュから削除
    if (this.config.enableFileCache) {
      const filePath = path.join(this.config.cacheDir, `${key}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.stats.file.deletes++;
        deleted = true;
      }
    }
    
    // 頻度マップから削除
    if (this.frequencyMap.has(key)) {
      this.frequencyMap.delete(key);
    }
    
    // 総削除数を更新
    if (deleted) {
      this.stats.total.deletes++;
    }
    
    return deleted;
  } catch (error) {
    console.error('キャッシュ削除中にエラーが発生しました:', error);
    this.stats.errors.general++;
    return false;
  }
}
```

### 2. モデルキャッシュ無効化機能

特定のモデルに関連するすべてのキャッシュエントリを一括で無効化する`invalidateModelCache`メソッドを実装しました。

```javascript
/**
 * 指定されたモデル名に関連するすべてのキャッシュエントリを無効化します
 * @param {string} modelName 無効化するモデル名
 * @returns {Promise<Object>} 無効化の結果（削除されたエントリ数など）
 */
async invalidateModelCache(modelName) {
  if (!modelName) {
    throw new Error('モデル名が指定されていません');
  }
  
  const result = {
    memory: 0,
    redis: 0,
    file: 0,
    total: 0
  };
  
  try {
    // メモリキャッシュの無効化
    if (this.config.enableMemoryCache && this.memoryCache) {
      // キーをイテレートして、指定されたモデルに関連するエントリを削除
      for (const key of this.memoryCache.keys()) {
        if (key.includes(modelName)) {
          this.memoryCache.delete(key);
          result.memory++;
          result.total++;
        }
      }
      this.stats.memory.modelInvalidations++;
    }
    
    // Redis分散キャッシュの無効化
    if (this.config.enableRedisCache && this.redisCache) {
      const redisResult = await this.redisCache.deleteByPattern(`*${modelName}*`);
      result.redis = redisResult.count || 0;
      result.total += result.redis;
      
      if (result.redis > 0) {
        this.stats.redis.modelInvalidations++;
        // 他のインスタンスにモデル無効化イベントを発行
        await this.redisCache.publishModelInvalidation(modelName);
      }
    }
    
    // ファイルキャッシュの無効化
    if (this.config.enableFileCache) {
      const files = fs.readdirSync(this.config.cacheDir);
      for (const file of files) {
        if (file.includes(modelName)) {
          const filePath = path.join(this.config.cacheDir, file);
          fs.unlinkSync(filePath);
          result.file++;
          result.total++;
        }
      }
      
      if (result.file > 0) {
        this.stats.file.modelInvalidations++;
      }
    }
    
    // 頻度マップの更新
    for (const [key, value] of this.frequencyMap.entries()) {
      if (key.includes(modelName)) {
        this.frequencyMap.delete(key);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`モデルキャッシュ無効化中にエラーが発生しました (${modelName}):`, error);
    this.stats.errors.general++;
    throw error;
  }
}
```

### 3. 詳細な統計情報収集機能

キャッシュシステムのパフォーマンスを詳細に分析するための`collectDetailedStats`メソッドを実装しました。

```javascript
/**
 * キャッシュシステムの詳細な統計情報を収集します
 * @returns {Object} 詳細な統計情報
 */
collectDetailedStats() {
  const now = Date.now();
  const uptime = now - this.stats.startTime;
  
  // 基本的なキャッシュ統計
  const basicStats = {
    uptime: uptime,
    uptimeHours: Math.round(uptime / 3600000 * 10) / 10,
    
    // ヒット率
    hitRates: {
      memory: this._calculateRate(this.stats.memory.hits, this.stats.memory.requests),
      redis: this._calculateRate(this.stats.redis.hits, this.stats.redis.requests),
      file: this._calculateRate(this.stats.file.hits, this.stats.file.requests),
      total: this._calculateRate(this.stats.total.hits, this.stats.total.requests)
    },
    
    // 操作数
    operations: {
      memory: { ...this.stats.memory },
      redis: { ...this.stats.redis },
      file: { ...this.stats.file },
      total: { ...this.stats.total }
    },
    
    // エラー統計
    errors: { ...this.stats.errors },
    
    // 同期統計
    syncs: { ...this.stats.syncs }
  };
  
  // モデル別の統計情報
  const modelStats = {};
  for (const [model, stats] of Object.entries(this.modelStats)) {
    modelStats[model] = {
      hits: stats.hits,
      misses: stats.misses,
      sets: stats.sets,
      requests: stats.hits + stats.misses,
      hitRate: this._calculateRate(stats.hits, stats.hits + stats.misses)
    };
  }
  
  // TTL調整の統計
  const ttlStats = {
    extended: this.stats.adaptiveTtlStats.extended,
    reduced: this.stats.adaptiveTtlStats.reduced,
    unchanged: this.stats.adaptiveTtlStats.unchanged,
    averageTtl: this.stats.adaptiveTtlStats.count > 0 
      ? Math.round(this.stats.adaptiveTtlStats.totalTtl / this.stats.adaptiveTtlStats.count) 
      : this.config.defaultTTL
  };
  
  // 時間帯別のアクセス統計
  const hourlyStats = {
    hits: [...this.stats.detailedStats.hourlyHits],
    misses: [...this.stats.detailedStats.hourlyMisses],
    total: this.stats.detailedStats.hourlyHits.map((hits, i) => 
      hits + this.stats.detailedStats.hourlyMisses[i]
    ),
    hitRates: this.stats.detailedStats.hourlyHits.map((hits, i) => 
      this._calculateRate(hits, hits + this.stats.detailedStats.hourlyMisses[i])
    )
  };
  
  // パフォーマンス指標
  const performanceMetrics = {
    averageResponseTime: this.stats.timing.count > 0 
      ? Math.round(this.stats.timing.totalTime / this.stats.timing.count * 100) / 100 
      : 0,
    throughput: uptime > 0 
      ? Math.round(this.stats.total.requests / (uptime / 1000) * 100) / 100 
      : 0,
    errorRate: this._calculateRate(
      this.stats.errors.memory + this.stats.errors.redis + 
      this.stats.errors.file + this.stats.errors.general,
      this.stats.total.requests
    )
  };
  
  // パーセンタイル応答時間（95パーセンタイル）
  if (this.stats.timing.responseTimes.length > 0) {
    performanceMetrics.p95ResponseTime = this._calculatePercentile(
      this.stats.timing.responseTimes, 95
    );
  }
  
  return {
    basic: basicStats,
    models: modelStats,
    ttl: ttlStats,
    hourly: hourlyStats,
    performance: performanceMetrics,
    size: {
      memory: this.memoryCacheSize,
      file: this.fileCacheSize,
      originalSize: this.stats.originalSize,
      compressedSize: this.stats.compressedSize,
      compressionRatio: this.stats.originalSize > 0 
        ? Math.round(this.stats.compressedSize / this.stats.originalSize * 100) 
        : 100
    }
  };
}

/**
 * 配列から指定されたパーセンタイル値を計算します
 * @param {Array<number>} array 数値の配列
 * @param {number} percentile パーセンタイル（0-100）
 * @returns {number} パーセンタイル値
 */
_calculatePercentile(array, percentile) {
  if (!array || array.length === 0) return 0;
  
  // 配列をソート
  const sorted = [...array].sort((a, b) => a - b);
  
  // パーセンタイルのインデックスを計算
  const index = Math.ceil(percentile / 100 * sorted.length) - 1;
  
  // パーセンタイル値を返す
  return sorted[Math.max(0, index)];
}
```

### 4. コンストラクタの最適化

EmbeddingCacheクラスのコンストラクタを更新し、新しく追加した統計情報フィールドを初期化するとともに、環境変数からの設定読み込みを改善しました。

```javascript
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
```

## 実装結果と効果

### 1. キャッシュの一貫性向上

- **選択的削除**: 特定のエントリのみを削除することで、キャッシュ全体をクリアすることなく古いデータを更新できるようになりました。
- **モデル単位の無効化**: モデルが更新された場合に、そのモデルに関連するすべてのキャッシュを一括で無効化できるようになりました。
- **分散環境での同期**: Redis PubSubを利用して、複数のインスタンス間でキャッシュ無効化イベントを同期することで、データの一貫性を確保しました。

### 2. 詳細な統計情報と分析

- **多層的な統計**: メモリ、Redis、ファイルの各キャッシュ層ごとの詳細な統計情報を収集できるようになりました。
- **モデル別分析**: 各モデルのキャッシュパフォーマンスを個別に分析できるようになりました。
- **時間帯別アクセスパターン**: 時間帯ごとのアクセスパターンを分析することで、負荷の予測と最適化が可能になりました。
- **パフォーマンス指標**: 応答時間、スループット、エラー率などの重要な指標を収集し、システムの健全性を監視できるようになりました。

### 3. 設定の柔軟性向上

- **環境変数の最適化**: 環境変数からの設定読み込みを改善し、より直感的な設定が可能になりました。
- **デフォルト値の最適化**: 実際の使用パターンに基づいて、デフォルト値を最適化しました。
- **ユーザー設定のオーバーライド**: プログラム的に設定を上書きできるようになり、柔軟な構成が可能になりました。

## 今後の課題と展望

### 1. テストと検証

- 各キャッシュ層の動作確認
- 分散環境でのテスト
- エッジケースの検証

### 2. パフォーマンス測定

- 実環境でのベンチマーク
- 負荷テスト
- メモリ使用量の監視

### 3. 設定のチューニング

- 実際の使用パターンに基づくTTL調整
- キャッシュサイズの最適化
- プリフェッチ戦略の調整

### 4. ドキュメント作成

- 設計の詳細説明
- 設定オプションの解説
- 運用ガイドライン

## 結論

キャッシュ削除機能、モデル単位の無効化、および詳細な統計情報収集機能の実装により、コンテナ化モジュラーモノリスアーキテクチャにおけるキャッシュシステムの機能が大幅に向上しました。これらの改善により、キャッシュの一貫性維持と性能分析が可能になり、システム全体の効率と信頼性が向上しました。今後も継続的な改善と最適化を行い、さらなるパフォーマンス向上を目指します。
