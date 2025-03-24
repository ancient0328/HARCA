---
title: "多階層記憶システム PostgreSQL統合設計 - コネクション管理"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - コネクション管理

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムのPostgreSQLコネクション管理戦略について詳細に記述します。効率的なデータベース接続の管理、コネクションプールの設定、およびコネクションライフサイクルの最適化について定義します。

## 2. コネクション管理の原則

### 2.1 基本原則

- **コネクション再利用**: 接続の作成と破棄のオーバーヘッドを最小化
- **適切なプールサイズ**: サーバーリソースとアプリケーション要件に合わせた設定
- **コネクションライフサイクル管理**: 接続の適切な初期化、維持、終了
- **障害検出と回復**: 接続エラーの迅速な検出と自動回復
- **負荷分散**: 複数のデータベースインスタンス間での負荷分散

### 2.2 コネクションプールの設計目標

| 設計目標 | 説明 |
|---------|------|
| 高可用性 | サーバー障害時の自動フェイルオーバーと接続再確立 |
| スケーラビリティ | 負荷に応じたプールサイズの動的調整 |
| パフォーマンス | 接続再利用による接続オーバーヘッドの最小化 |
| リソース効率 | データベースサーバーとアプリケーションサーバーのリソース最適化 |
| モニタリング | 接続状態とパフォーマンスの継続的な監視 |

## 3. コネクションプール実装

### 3.1 node-postgresを使用したコネクションプール

```javascript
const { Pool } = require('pg');

// プール設定
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '3730'),
  database: process.env.POSTGRES_DB || 'harca_memory',
  user: process.env.POSTGRES_USER || 'harca_user',
  password: process.env.POSTGRES_PASSWORD || 'password',
  // プール設定
  max: parseInt(process.env.POSTGRES_POOL_MAX || '20'),     // 最大接続数
  min: parseInt(process.env.POSTGRES_POOL_MIN || '5'),      // 最小接続数（アイドル状態で維持）
  idleTimeoutMillis: 30000,                                 // アイドル接続のタイムアウト
  connectionTimeoutMillis: 5000,                            // 接続試行のタイムアウト
  maxUses: 7500,                                            // 接続の最大再利用回数
  allowExitOnIdle: false                                    // アイドル状態での終了を許可しない
});

// イベントハンドラ
pool.on('connect', (client) => {
  console.log('New client connected to PostgreSQL');
  
  // 接続初期化設定
  client.query('SET application_name = $1', ['harca_memory_system']);
  client.query('SET statement_timeout = $1', [30000]); // 30秒
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('remove', () => {
  console.log('Client removed from pool');
});

// クエリ実行ヘルパー関数
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  // 長時間実行クエリのログ記録
  if (duration > 500) {
    console.warn('Slow query:', { text, duration, rows: res.rowCount });
  }
  
  return res;
}

// クライアント取得（トランザクション用）
async function getClient() {
  const client = await pool.connect();
  
  // オリジナルのクエリメソッドをラップしてモニタリングを追加
  const query = client.query.bind(client);
  client.query = async (text, params) => {
    const start = Date.now();
    const res = await query(text, params);
    const duration = Date.now() - start;
    
    // 長時間実行クエリのログ記録
    if (duration > 500) {
      console.warn('Slow query (transaction):', { text, duration, rows: res.rowCount });
    }
    
    return res;
  };
  
  return client;
}

module.exports = {
  query,
  getClient,
  pool
};
```

### 3.2 Prismaを使用したコネクション管理

```javascript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// src/lib/prisma.js
const { PrismaClient } = require('@prisma/client');

// グローバルインスタンス
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['warn', 'error'],
    errorFormat: 'minimal'
  });
} else {
  // 開発環境ではホットリロード時の複数インスタンス作成を防止
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      errorFormat: 'pretty'
    });
  }
  prisma = global.prisma;
}

// コネクション設定
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  const duration = after - before;
  
  // 長時間実行クエリのログ記録
  if (duration > 500) {
    console.warn(`Slow Prisma query: ${params.model}.${params.action} took ${duration}ms`);
  }
  
  return result;
});

module.exports = prisma;
```

## 4. コネクション設定最適化

### 4.1 環境別のプール設定

| 環境 | 最小接続数 | 最大接続数 | アイドルタイムアウト | 接続タイムアウト | 最大再利用回数 |
|------|----------|----------|-------------------|--------------|------------|
| 開発 | 2 | 10 | 30秒 | 5秒 | 7500 |
| テスト | 5 | 20 | 30秒 | 5秒 | 7500 |
| 本番 | 10 | 50 | 60秒 | 10秒 | 10000 |

### 4.2 PostgreSQL接続パラメータ

```javascript
// PostgreSQL接続パラメータの設定
const connectionParams = {
  // 基本設定
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  
  // SSL設定（本番環境）
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca.crt').toString()
  } : false,
  
  // アプリケーション名
  application_name: 'harca_memory_system',
  
  // クエリタイムアウト（ミリ秒）
  statement_timeout: 30000,
  
  // TCP keepalive
  keepalive: true,
  keepaliveInitialDelayMillis: 30000,
  
  // 接続試行回数
  connectionRetryLimit: 3,
  
  // 接続試行間隔（ミリ秒）
  connectionRetryDelay: 1000
};
```

### 4.3 接続文字列の構築

```javascript
// 接続文字列の構築
function buildConnectionString(params) {
  const {
    host,
    port,
    database,
    user,
    password,
    ssl,
    ...options
  } = params;
  
  // 基本接続文字列
  let connectionString = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  
  // オプションパラメータの追加
  if (Object.keys(options).length > 0) {
    const optionsString = Object.entries(options)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    connectionString += `?${optionsString}`;
  }
  
  // SSL設定の追加
  if (ssl) {
    connectionString += connectionString.includes('?') ? '&' : '?';
    connectionString += 'sslmode=require';
  }
  
  return connectionString;
}
```

## 5. コネクションライフサイクル管理

### 5.1 接続初期化

```javascript
// 接続初期化
async function initializeConnection(client) {
  // アプリケーション名の設定
  await client.query("SET application_name = 'harca_memory_system'");
  
  // タイムアウト設定
  await client.query('SET statement_timeout = $1', [30000]);
  
  // 検索パスの設定
  await client.query("SET search_path = 'mid_term', 'long_term', 'vector', 'public'");
  
  // トランザクション分離レベルのデフォルト設定
  await client.query('SET default_transaction_isolation = \'read committed\'');
  
  // クライアント側のエンコーディング設定
  await client.query("SET client_encoding = 'UTF8'");
  
  // タイムゾーン設定
  await client.query("SET timezone = 'UTC'");
  
  return client;
}
```

### 5.2 接続ヘルスチェック

```javascript
// 接続ヘルスチェック
async function checkConnectionHealth(client) {
  try {
    // 簡単なクエリを実行して接続が生きているか確認
    const startTime = Date.now();
    const result = await client.query('SELECT 1 AS connection_test');
    const responseTime = Date.now() - startTime;
    
    return {
      isHealthy: result.rows[0].connection_test === 1,
      responseTime,
      lastChecked: new Date()
    };
  } catch (error) {
    console.error('Connection health check failed:', error);
    
    return {
      isHealthy: false,
      error: error.message,
      lastChecked: new Date()
    };
  }
}

// プール内の全接続のヘルスチェック
async function checkPoolHealth(pool) {
  // アイドル接続の数を取得
  const idleCount = pool.idleCount;
  
  // 使用中の接続の数を取得
  const totalCount = pool.totalCount;
  const activeCount = totalCount - idleCount;
  
  // 待機中のクライアント数を取得
  const waitingCount = pool.waitingCount;
  
  // サンプル接続のヘルスチェック
  let connectionHealth = null;
  if (idleCount > 0) {
    const client = await pool.connect();
    try {
      connectionHealth = await checkConnectionHealth(client);
    } finally {
      client.release();
    }
  }
  
  return {
    totalConnections: totalCount,
    activeConnections: activeCount,
    idleConnections: idleCount,
    waitingClients: waitingCount,
    connectionHealth,
    timestamp: new Date()
  };
}
```

### 5.3 接続終了処理

```javascript
// アプリケーション終了時の接続クリーンアップ
async function shutdownPool(pool) {
  console.log('Shutting down PostgreSQL connection pool...');
  
  try {
    await pool.end();
    console.log('All PostgreSQL connections closed successfully');
    return true;
  } catch (error) {
    console.error('Error closing PostgreSQL connections:', error);
    return false;
  }
}

// グレースフルシャットダウン処理
function setupGracefulShutdown(pool) {
  // SIGTERM シグナルハンドラ
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...');
    
    // コネクションプールのシャットダウン
    await shutdownPool(pool);
    
    // プロセス終了
    process.exit(0);
  });
  
  // SIGINT シグナルハンドラ
  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down...');
    
    // コネクションプールのシャットダウン
    await shutdownPool(pool);
    
    // プロセス終了
    process.exit(0);
  });
}
```

## 6. 高度なコネクション管理

### 6.1 読み取り/書き込み分離

```javascript
// 読み取り/書き込み分離プール
const { Pool } = require('pg');

// 書き込み用プール（プライマリDB）
const writePool = new Pool({
  host: process.env.POSTGRES_PRIMARY_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '3730'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  min: 5
});

// 読み取り用プール（レプリカDB）
const readPool = new Pool({
  host: process.env.POSTGRES_REPLICA_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '3730'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 50,
  min: 10
});

// 読み取りクエリ実行
async function readQuery(text, params) {
  return readPool.query(text, params);
}

// 書き込みクエリ実行
async function writeQuery(text, params) {
  return writePool.query(text, params);
}

// トランザクション（常に書き込みプールを使用）
async function withTransaction(callback) {
  const client = await writePool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 6.2 接続障害検出と自動再接続

```javascript
// 接続障害検出と自動再接続
class PostgresConnectionManager {
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    this.reconnectDelay = config.reconnectDelay || 1000;
    this.isConnected = false;
    
    this.initialize();
  }
  
  async initialize() {
    try {
      this.pool = new Pool(this.config);
      
      // イベントハンドラ設定
      this.pool.on('error', (err) => this.handlePoolError(err));
      this.pool.on('connect', (client) => this.handleClientConnect(client));
      this.pool.on('remove', (client) => this.handleClientRemove(client));
      
      // 接続テスト
      await this.testConnection();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      console.log('PostgreSQL connection pool initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PostgreSQL connection pool:', error);
      this.isConnected = false;
      this.attemptReconnect();
    }
  }
  
  async testConnection() {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }
  
  handlePoolError(err) {
    console.error('PostgreSQL pool error:', err);
    
    if (!this.isConnected) {
      return;
    }
    
    this.isConnected = false;
    this.attemptReconnect();
  }
  
  handleClientConnect(client) {
    console.log('New PostgreSQL client connected');
    
    // エラーハンドラ設定
    client.on('error', (err) => {
      console.error('PostgreSQL client error:', err);
    });
  }
  
  handleClientRemove(client) {
    console.log('PostgreSQL client removed from pool');
  }
  
  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached, giving up');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.pool) {
        // 既存のプールを終了
        this.pool.end().catch(err => {
          console.error('Error ending existing pool:', err);
        }).finally(() => {
          this.initialize();
        });
      } else {
        this.initialize();
      }
    }, delay);
  }
  
  async query(text, params) {
    if (!this.isConnected) {
      throw new Error('Database connection is not available');
    }
    
    try {
      return await this.pool.query(text, params);
    } catch (error) {
      if (this.isConnectionError(error)) {
        this.isConnected = false;
        this.attemptReconnect();
      }
      throw error;
    }
  }
  
  async getClient() {
    if (!this.isConnected) {
      throw new Error('Database connection is not available');
    }
    
    try {
      return await this.pool.connect();
    } catch (error) {
      if (this.isConnectionError(error)) {
        this.isConnected = false;
        this.attemptReconnect();
      }
      throw error;
    }
  }
  
  isConnectionError(error) {
    // PostgreSQLの接続関連エラーコード
    const connectionErrorCodes = [
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08004', // sqlserver_rejected_establishment_of_sqlconnection
      '57P01', // admin_shutdown
      '57P02', // crash_shutdown
      '57P03'  // cannot_connect_now
    ];
    
    return error.code && connectionErrorCodes.includes(error.code);
  }
  
  async end() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
  }
}
```

### 6.3 コネクションプールのモニタリング

```javascript
// コネクションプールのモニタリング
class PostgresPoolMonitor {
  constructor(pool, options = {}) {
    this.pool = pool;
    this.interval = options.interval || 60000; // デフォルト: 1分
    this.metrics = [];
    this.maxMetricsHistory = options.maxMetricsHistory || 100;
    this.alertThresholds = options.alertThresholds || {
      waitingClients: 5,
      idleConnections: 0,
      responseTime: 500
    };
    
    this.timer = null;
  }
  
  start() {
    if (this.timer) {
      return;
    }
    
    console.log(`Starting PostgreSQL pool monitoring (interval: ${this.interval}ms)`);
    
    // 初回実行
    this.collectMetrics();
    
    // 定期実行
    this.timer = setInterval(() => this.collectMetrics(), this.interval);
  }
  
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('PostgreSQL pool monitoring stopped');
    }
  }
  
  async collectMetrics() {
    try {
      const client = await this.pool.connect();
      
      try {
        // 接続応答時間測定
        const startTime = Date.now();
        await client.query('SELECT 1');
        const responseTime = Date.now() - startTime;
        
        // プール状態取得
        const idleCount = this.pool.idleCount;
        const totalCount = this.pool.totalCount;
        const activeCount = totalCount - idleCount;
        const waitingCount = this.pool.waitingCount;
        
        // メトリクス保存
        const metrics = {
          timestamp: new Date(),
          totalConnections: totalCount,
          activeConnections: activeCount,
          idleConnections: idleCount,
          waitingClients: waitingCount,
          responseTime
        };
        
        this.metrics.push(metrics);
        
        // メトリクス履歴の制限
        if (this.metrics.length > this.maxMetricsHistory) {
          this.metrics.shift();
        }
        
        // アラートチェック
        this.checkAlerts(metrics);
        
        return metrics;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error collecting PostgreSQL pool metrics:', error);
      
      // エラーメトリクス
      const errorMetrics = {
        timestamp: new Date(),
        error: error.message,
        isConnectionError: this.isConnectionError(error)
      };
      
      this.metrics.push(errorMetrics);
      
      // メトリクス履歴の制限
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics.shift();
      }
      
      return errorMetrics;
    }
  }
  
  checkAlerts(metrics) {
    // 待機クライアント数アラート
    if (metrics.waitingClients > this.alertThresholds.waitingClients) {
      console.warn(`PostgreSQL pool alert: High waiting clients (${metrics.waitingClients})`);
    }
    
    // アイドル接続不足アラート
    if (metrics.idleConnections < this.alertThresholds.idleConnections) {
      console.warn(`PostgreSQL pool alert: Low idle connections (${metrics.idleConnections})`);
    }
    
    // 応答時間アラート
    if (metrics.responseTime > this.alertThresholds.responseTime) {
      console.warn(`PostgreSQL pool alert: Slow response time (${metrics.responseTime}ms)`);
    }
  }
  
  isConnectionError(error) {
    // PostgreSQLの接続関連エラーコード
    const connectionErrorCodes = [
      '08000', '08003', '08006', '08001', '08004', '57P01', '57P02', '57P03'
    ];
    
    return error.code && connectionErrorCodes.includes(error.code);
  }
  
  getMetrics() {
    return this.metrics;
  }
  
  getLatestMetrics() {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }
  
  getSummaryMetrics() {
    if (this.metrics.length === 0) {
      return null;
    }
    
    // エラーを除外した有効なメトリクスのみを対象
    const validMetrics = this.metrics.filter(m => !m.error);
    
    if (validMetrics.length === 0) {
      return {
        totalSamples: this.metrics.length,
        validSamples: 0,
        errorRate: 1.0
      };
    }
    
    // 平均値計算
    const sum = validMetrics.reduce((acc, m) => {
      acc.totalConnections += m.totalConnections;
      acc.activeConnections += m.activeConnections;
      acc.idleConnections += m.idleConnections;
      acc.waitingClients += m.waitingClients;
      acc.responseTime += m.responseTime;
      return acc;
    }, {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      responseTime: 0
    });
    
    const count = validMetrics.length;
    
    return {
      totalSamples: this.metrics.length,
      validSamples: count,
      errorRate: (this.metrics.length - count) / this.metrics.length,
      avgTotalConnections: sum.totalConnections / count,
      avgActiveConnections: sum.activeConnections / count,
      avgIdleConnections: sum.idleConnections / count,
      avgWaitingClients: sum.waitingClients / count,
      avgResponseTime: sum.responseTime / count,
      maxResponseTime: Math.max(...validMetrics.map(m => m.responseTime)),
      minResponseTime: Math.min(...validMetrics.map(m => m.responseTime))
    };
  }
}
```

## 7. 結論

本ドキュメントでは、HARCA多階層記憶システムのPostgreSQLコネクション管理戦略について詳細に記述しました。効率的なコネクションプールの設定、コネクションライフサイクル管理、障害検出と回復メカニズム、およびモニタリング戦略を定義しました。これらの戦略を適用することで、信頼性が高く、スケーラブルで、パフォーマンスの良いデータベース接続管理を実現できます。
