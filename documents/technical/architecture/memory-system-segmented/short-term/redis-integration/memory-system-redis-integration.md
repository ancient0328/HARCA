---
title: "多階層記憶システム Redis統合設計"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム Redis統合設計

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムとRedisの統合設計について詳細に記述します。短期記憶モジュールは主にRedisを使用して実装され、高速なデータアクセスと一時的なデータ保存を実現します。

## 2. Redis統合アーキテクチャ

### 2.1 全体アーキテクチャ

```
+-------------------+      +-------------------+
| 短期記憶モジュール |<---->|    Redis Server   |
+-------------------+      +-------------------+
        |                           |
        v                           v
+-------------------+      +-------------------+
|  コンテキスト管理  |<---->|  Redis Pub/Sub    |
+-------------------+      +-------------------+
```

### 2.2 Redis構成

- **Redis Server**: HARCAサーバーポート3710で実行
- **Redis構成モード**: 単一インスタンス（開発環境）、Sentinelモード（本番環境）
- **永続化設定**: RDBスナップショット（15分間隔）+ AOFログ（everysec）
- **メモリ設定**: 最大2GB（開発環境）、8GB（本番環境）
- **接続プール**: 最小5、最大20

## 3. データモデルとRedis実装

### 3.1 短期記憶アイテム（WorkingMemoryItem）

#### 3.1.1 Redisキー設計

```
harca:memory:short:item:{id}           // ハッシュ型：アイテム本体
harca:memory:short:idx:type:{type}     // セット型：タイプ別インデックス
harca:memory:short:idx:context:{ctxId} // セット型：コンテキスト別インデックス
harca:memory:short:idx:priority:{pri}  // ソート済みセット型：優先度別インデックス
harca:memory:short:idx:expiry          // ソート済みセット型：有効期限インデックス
```

#### 3.1.2 データ操作実装

```javascript
// アイテム作成
async function createWorkingMemoryItem(item) {
  const id = item.id || uuidv4();
  const now = Date.now();
  const ttl = item.ttl || DEFAULT_TTL;
  const expiry = now + ttl * 1000;
  
  const pipeline = redisClient.pipeline();
  
  // メインデータ保存（ハッシュ型）
  pipeline.hset(`harca:memory:short:item:${id}`, {
    id,
    type: item.type,
    content: JSON.stringify(item.content),
    contextId: item.contextId || 'global',
    priority: item.priority || 5,
    createdAt: now,
    expiresAt: expiry,
    metadata: JSON.stringify(item.metadata || {})
  });
  
  // TTL設定
  pipeline.pexpireat(`harca:memory:short:item:${id}`, expiry);
  
  // インデックス更新
  pipeline.sadd(`harca:memory:short:idx:type:${item.type}`, id);
  pipeline.sadd(`harca:memory:short:idx:context:${item.contextId || 'global'}`, id);
  pipeline.zadd(`harca:memory:short:idx:priority:${item.priority || 5}`, now, id);
  pipeline.zadd('harca:memory:short:idx:expiry', expiry, id);
  
  await pipeline.exec();
  return id;
}

// アイテム取得
async function getWorkingMemoryItem(id) {
  const data = await redisClient.hgetall(`harca:memory:short:item:${id}`);
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  
  return {
    ...data,
    content: JSON.parse(data.content),
    metadata: JSON.parse(data.metadata),
    createdAt: parseInt(data.createdAt),
    expiresAt: parseInt(data.expiresAt),
    priority: parseInt(data.priority)
  };
}

// アイテム削除
async function deleteWorkingMemoryItem(id) {
  const item = await getWorkingMemoryItem(id);
  if (!item) {
    return false;
  }
  
  const pipeline = redisClient.pipeline();
  
  // インデックスから削除
  pipeline.srem(`harca:memory:short:idx:type:${item.type}`, id);
  pipeline.srem(`harca:memory:short:idx:context:${item.contextId}`, id);
  pipeline.zrem(`harca:memory:short:idx:priority:${item.priority}`, id);
  pipeline.zrem('harca:memory:short:idx:expiry', id);
  
  // メインデータ削除
  pipeline.del(`harca:memory:short:item:${id}`);
  
  await pipeline.exec();
  return true;
}
```

### 3.2 コンテキスト（Context）

#### 3.2.1 Redisキー設計

```
harca:memory:context:{id}           // ハッシュ型：コンテキスト本体
harca:memory:ctx:idx:type:{type}    // セット型：タイプ別インデックス
harca:memory:ctx:idx:active         // セット型：アクティブコンテキスト
harca:memory:ctx:idx:expiry         // ソート済みセット型：有効期限インデックス
```

#### 3.2.2 データ操作実装

```javascript
// コンテキスト作成
async function createContext(context) {
  const id = context.id || uuidv4();
  const now = Date.now();
  const ttl = context.ttl || CONTEXT_DEFAULT_TTL;
  const expiry = now + ttl * 1000;
  
  const pipeline = redisClient.pipeline();
  
  // メインデータ保存（ハッシュ型）
  pipeline.hset(`harca:memory:context:${id}`, {
    id,
    name: context.name,
    type: context.type,
    createdAt: now,
    updatedAt: now,
    expiresAt: expiry,
    metadata: JSON.stringify(context.metadata || {})
  });
  
  // TTL設定
  pipeline.pexpireat(`harca:memory:context:${id}`, expiry);
  
  // インデックス更新
  pipeline.sadd(`harca:memory:ctx:idx:type:${context.type}`, id);
  pipeline.sadd('harca:memory:ctx:idx:active', id);
  pipeline.zadd('harca:memory:ctx:idx:expiry', expiry, id);
  
  await pipeline.exec();
  return id;
}
```

## 4. Redis Pub/Sub実装

### 4.1 イベントチャネル設計

```
harca:events:memory:item:created    // 短期記憶アイテム作成イベント
harca:events:memory:item:updated    // 短期記憶アイテム更新イベント
harca:events:memory:item:deleted    // 短期記憶アイテム削除イベント
harca:events:memory:item:expired    // 短期記憶アイテム期限切れイベント
harca:events:memory:ctx:created     // コンテキスト作成イベント
harca:events:memory:ctx:updated     // コンテキスト更新イベント
harca:events:memory:ctx:deleted     // コンテキスト削除イベント
harca:events:memory:ctx:expired     // コンテキスト期限切れイベント
```

### 4.2 イベント発行実装

```javascript
// イベント発行
async function publishMemoryEvent(channel, data) {
  await redisClient.publish(channel, JSON.stringify({
    timestamp: Date.now(),
    data
  }));
}

// 短期記憶アイテム作成イベント発行
async function publishItemCreatedEvent(item) {
  await publishMemoryEvent('harca:events:memory:item:created', {
    id: item.id,
    type: item.type,
    contextId: item.contextId
  });
}
```

### 4.3 イベントサブスクライブ実装

```javascript
// イベントサブスクライブ
function subscribeToMemoryEvents(channels, callback) {
  const subscriber = redisClient.duplicate();
  
  subscriber.on('message', (channel, message) => {
    try {
      const event = JSON.parse(message);
      callback(channel, event);
    } catch (error) {
      console.error('Failed to process memory event:', error);
    }
  });
  
  channels.forEach(channel => subscriber.subscribe(channel));
  return subscriber;
}

// 短期記憶アイテムイベントのサブスクライブ
const itemSubscriber = subscribeToMemoryEvents([
  'harca:events:memory:item:created',
  'harca:events:memory:item:updated',
  'harca:events:memory:item:deleted',
  'harca:events:memory:item:expired'
], (channel, event) => {
  // イベント処理ロジック
  console.log(`Received event on channel ${channel}:`, event);
  
  // チャネルに応じた処理
  switch (channel) {
    case 'harca:events:memory:item:created':
      handleItemCreated(event.data);
      break;
    case 'harca:events:memory:item:expired':
      handleItemExpired(event.data);
      break;
    // 他のケース
  }
});
```

## 5. キャッシュ戦略

### 5.1 TTL（有効期限）戦略

| データタイプ | デフォルトTTL | 最小TTL | 最大TTL | 備考 |
|------------|--------------|---------|---------|------|
| 作業記憶アイテム | 15分 | 1分 | 24時間 | 優先度に応じて調整可能 |
| コンテキスト | 60分 | 15分 | 7日 | アクティブ状態で自動延長 |
| 一時計算結果 | 5分 | 1分 | 30分 | 計算コスト高のものは長く |
| システム状態 | 30分 | 5分 | 12時間 | 重要度に応じて調整 |

### 5.2 キャッシュ無効化戦略

- **時間ベース**: TTLによる自動期限切れ
- **イベントベース**: 関連データ更新時の明示的無効化
- **バージョンベース**: データバージョン変更時の一括無効化

### 5.3 メモリ管理

```javascript
// メモリ使用量監視
async function monitorRedisMemory() {
  const info = await redisClient.info('memory');
  const usedMemory = parseInt(info.used_memory_human.replace('M', ''));
  const maxMemory = parseInt(info.maxmemory_human.replace('M', ''));
  
  const usageRatio = usedMemory / maxMemory;
  
  // 閾値に基づくアクション
  if (usageRatio > 0.9) {
    // 緊急メモリ解放
    await performEmergencyMemoryRelease();
  } else if (usageRatio > 0.8) {
    // 低優先度アイテムのTTL短縮
    await reduceTTLForLowPriorityItems();
  }
  
  return { usedMemory, maxMemory, usageRatio };
}

// 低優先度アイテムのTTL短縮
async function reduceTTLForLowPriorityItems() {
  const now = Date.now();
  const lowPriorityItems = await redisClient.zrange('harca:memory:short:idx:priority:1', 0, 100);
  
  const pipeline = redisClient.pipeline();
  for (const id of lowPriorityItems) {
    const newExpiry = now + 5 * 60 * 1000; // 5分後に期限切れ
    pipeline.pexpireat(`harca:memory:short:item:${id}`, newExpiry);
    pipeline.zadd('harca:memory:short:idx:expiry', newExpiry, id);
  }
  
  await pipeline.exec();
}
```

## 6. 障害対策と高可用性

### 6.1 接続エラー処理

```javascript
// Redis接続管理
class RedisConnectionManager {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    this.reconnectDelay = config.reconnectDelay || 1000;
  }
  
  async connect() {
    try {
      this.client = await redis.createClient(this.config)
        .on('error', this.handleError.bind(this))
        .on('reconnecting', this.handleReconnecting.bind(this))
        .on('ready', this.handleReady.bind(this))
        .connect();
      
      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      await this.attemptReconnect();
    }
  }
  
  handleError(error) {
    console.error('Redis connection error:', error);
  }
  
  handleReconnecting() {
    this.reconnectAttempts++;
    console.log(`Reconnecting to Redis (attempt ${this.reconnectAttempts})...`);
  }
  
  handleReady() {
    this.reconnectAttempts = 0;
    console.log('Redis connection established');
  }
  
  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error('Max reconnect attempts reached');
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return this.connect();
  }
  
  async disconnect() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
```

### 6.2 フォールバックメカニズム

```javascript
// メモリアイテム取得（フォールバック付き）
async function getWorkingMemoryItemWithFallback(id) {
  try {
    // Redisから取得を試みる
    const item = await getWorkingMemoryItem(id);
    if (item) {
      return item;
    }
    
    // Redisに存在しない場合、バックアップストレージから取得
    return await getWorkingMemoryItemFromBackup(id);
  } catch (error) {
    console.error('Redis error, falling back to backup storage:', error);
    return await getWorkingMemoryItemFromBackup(id);
  }
}

// バックアップストレージからの取得
async function getWorkingMemoryItemFromBackup(id) {
  // ローカルファイルシステムまたはセカンダリDBからの取得ロジック
  // ...
}
```

### 6.3 Redisクラスタ構成（本番環境）

```javascript
// Redisクラスタ接続
async function connectToRedisCluster() {
  const nodes = [
    { host: 'redis-node-1', port: 6379 },
    { host: 'redis-node-2', port: 6379 },
    { host: 'redis-node-3', port: 6379 }
  ];
  
  const options = {
    maxRetries: 10,
    retryDelay: 1000,
    enableReadyCheck: true
  };
  
  const cluster = new Redis.Cluster(nodes, options);
  
  cluster.on('error', (error) => {
    console.error('Redis Cluster error:', error);
  });
  
  cluster.on('ready', () => {
    console.log('Redis Cluster is ready');
  });
  
  return cluster;
}
```

## 7. パフォーマンス最適化

### 7.1 パイプライン処理

複数の操作を一括で実行することで、ネットワークラウンドトリップを削減します。

```javascript
async function batchProcessItems(items) {
  const pipeline = redisClient.pipeline();
  
  for (const item of items) {
    pipeline.hset(`harca:memory:short:item:${item.id}`, {
      // アイテムデータ
    });
    pipeline.pexpireat(`harca:memory:short:item:${item.id}`, item.expiry);
    // その他の操作
  }
  
  return await pipeline.exec();
}
```

### 7.2 Luaスクリプト

複雑な操作をアトミックに実行するためのLuaスクリプトを使用します。

```javascript
// 条件付きアイテム更新のLuaスクリプト
const conditionalUpdateScript = `
  local key = KEYS[1]
  local version = tonumber(ARGV[1])
  local newData = ARGV[2]
  local newVersion = tonumber(ARGV[3])
  
  local currentVersion = tonumber(redis.call('HGET', key, 'version'))
  
  if currentVersion == version then
    redis.call('HSET', key, 'data', newData)
    redis.call('HSET', key, 'version', newVersion)
    redis.call('HSET', key, 'updatedAt', ARGV[4])
    return 1
  else
    return 0
  end
`;

// スクリプトの実行
async function conditionalUpdate(id, version, newData) {
  const key = `harca:memory:short:item:${id}`;
  const newVersion = version + 1;
  const now = Date.now();
  
  const result = await redisClient.eval(
    conditionalUpdateScript,
    1,
    key,
    version,
    JSON.stringify(newData),
    newVersion,
    now
  );
  
  return result === 1;
}
```

### 7.3 接続プール設定

```javascript
// Redis接続プール設定
const redisPool = genericPool.createPool({
  create: async () => {
    const client = redis.createClient({
      url: 'redis://localhost:3710',
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
      }
    });
    await client.connect();
    return client;
  },
  destroy: async (client) => {
    await client.quit();
  }
}, {
  min: 5,          // 最小接続数
  max: 20,         // 最大接続数
  acquireTimeoutMillis: 5000,  // 取得タイムアウト
  idleTimeoutMillis: 30000,    // アイドルタイムアウト
  evictionRunIntervalMillis: 15000  // 接続チェック間隔
});

// プールからクライアント取得
async function withRedisClient(operation) {
  let client;
  try {
    client = await redisPool.acquire();
    return await operation(client);
  } finally {
    if (client) {
      await redisPool.release(client);
    }
  }
}

// 使用例
async function getItem(id) {
  return await withRedisClient(async (client) => {
    return await client.hgetall(`harca:memory:short:item:${id}`);
  });
}
```

## 8. モニタリングと運用

### 8.1 メトリクス収集

```javascript
// Redisメトリクス収集
async function collectRedisMetrics() {
  const info = await redisClient.info();
  const metrics = {
    timestamp: Date.now(),
    memory: {
      used: parseInt(info.used_memory),
      peak: parseInt(info.used_memory_peak),
      fragmentation: parseFloat(info.mem_fragmentation_ratio)
    },
    clients: {
      connected: parseInt(info.connected_clients),
      blocked: parseInt(info.blocked_clients)
    },
    operations: {
      commandsProcessed: parseInt(info.total_commands_processed),
      inputBytes: parseInt(info.total_net_input_bytes),
      outputBytes: parseInt(info.total_net_output_bytes)
    },
    keys: {
      expired: parseInt(info.expired_keys),
      evicted: parseInt(info.evicted_keys)
    },
    performance: {
      hitRate: calculateHitRate(info),
      keyspaceHits: parseInt(info.keyspace_hits),
      keyspaceMisses: parseInt(info.keyspace_misses)
    }
  };
  
  // メトリクスの保存または送信
  await storeMetrics('redis', metrics);
  
  return metrics;
}

// ヒット率計算
function calculateHitRate(info) {
  const hits = parseInt(info.keyspace_hits);
  const misses = parseInt(info.keyspace_misses);
  const total = hits + misses;
  
  return total > 0 ? hits / total : 0;
}
```

### 8.2 ヘルスチェック

```javascript
// Redisヘルスチェック
async function checkRedisHealth() {
  try {
    const startTime = Date.now();
    const result = await redisClient.ping();
    const responseTime = Date.now() - startTime;
    
    const info = await redisClient.info();
    const memoryUsage = parseInt(info.used_memory) / (1024 * 1024); // MB
    
    const health = {
      status: result === 'PONG' ? 'healthy' : 'unhealthy',
      responseTime,
      memoryUsage,
      uptime: parseInt(info.uptime_in_seconds),
      connectedClients: parseInt(info.connected_clients)
    };
    
    return health;
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}
```

## 9. セキュリティ考慮事項

### 9.1 認証と暗号化

```javascript
// セキュアなRedis接続
async function createSecureRedisClient() {
  return redis.createClient({
    url: `rediss://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    socket: {
      tls: true,
      rejectUnauthorized: true,
      ca: fs.readFileSync('/path/to/ca.crt')
    }
  });
}
```

### 9.2 データ暗号化

```javascript
// 機密データの暗号化
async function encryptData(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag().toString('base64');
  
  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag
  };
}

// 機密データの復号化
async function decryptData(encryptedData, key) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encryptedData.iv, 'base64')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

// 機密データを含む作業記憶アイテムの保存
async function storeConfidentialItem(item, encryptionKey) {
  // 機密データの暗号化
  const encryptedContent = await encryptData(item.content, encryptionKey);
  
  // 暗号化されたデータで更新
  const secureItem = {
    ...item,
    content: {
      _encrypted: true,
      data: encryptedContent
    }
  };
  
  // 通常の保存処理を使用
  return await createWorkingMemoryItem(secureItem);
}
```

## 10. 結論

本ドキュメントでは、HARCA多階層記憶システムとRedisの統合設計について詳細に記述しました。短期記憶モジュールはRedisを活用して、高速なデータアクセスと一時的なデータ保存を実現します。キー設計、データ操作、Pub/Sub実装、キャッシュ戦略、障害対策、パフォーマンス最適化、モニタリング、セキュリティについて定義しました。この設計に基づいて、効率的で信頼性の高い短期記憶システムを実装することができます。
