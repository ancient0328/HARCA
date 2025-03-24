/**
 * Sequential Thinking APIエンドポイント
 * 
 * このモジュールは、Sequential Thinkingサービスへのアクセスを提供するAPIエンドポイントを実装します。
 * ツール推奨、思考プロセス、ヘルスチェックなどの機能を提供します。
 */

import express from 'express';
import { defaultToolRecommender } from './tool-recommender.js';
import { defaultCache } from './utils/cache.js';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import { getUserFriendlyMessage, logError } from './utils/error-handler.js';

// APIルーターの作成
const router = express.Router();

// リクエスト数を追跡するためのカウンター
const requestCounter = {
  count: 0,
  resetTime: Date.now() + config.api.rateLimitWindow,
  
  // カウンターをインクリメントし、レート制限を超えているかどうかをチェック
  increment() {
    const now = Date.now();
    
    // リセット時間を過ぎている場合はカウンターをリセット
    if (now > this.resetTime) {
      this.count = 0;
      this.resetTime = now + config.api.rateLimitWindow;
    }
    
    this.count++;
    return this.count <= config.api.rateLimit;
  },
  
  // 残りのリクエスト数を取得
  getRemainingRequests() {
    const now = Date.now();
    
    // リセット時間を過ぎている場合はカウンターをリセット
    if (now > this.resetTime) {
      this.count = 0;
      this.resetTime = now + config.api.rateLimitWindow;
    }
    
    return Math.max(0, config.api.rateLimit - this.count);
  },
  
  // リセットまでの時間（秒）を取得
  getResetTimeInSeconds() {
    return Math.max(0, Math.ceil((this.resetTime - Date.now()) / 1000));
  }
};

// レート制限ミドルウェア
const rateLimitMiddleware = (req, res, next) => {
  // リクエストカウンターをインクリメント
  if (!requestCounter.increment()) {
    // レート制限を超えた場合は429エラーを返す
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      rateLimit: {
        limit: config.api.rateLimit,
        remaining: requestCounter.getRemainingRequests(),
        resetInSeconds: requestCounter.getResetTimeInSeconds()
      }
    });
  }
  
  // レート制限ヘッダーを設定
  res.set({
    'X-RateLimit-Limit': config.api.rateLimit,
    'X-RateLimit-Remaining': requestCounter.getRemainingRequests(),
    'X-RateLimit-Reset': requestCounter.getResetTimeInSeconds()
  });
  
  next();
};

// すべてのルートにレート制限ミドルウェアを適用
router.use(rateLimitMiddleware);

/**
 * ツール推奨APIエンドポイント
 * POST /api/sequential-thinking/recommend-tools
 */
router.post('/recommend-tools', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { text, availableTools = [] } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'テキストが指定されていません',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`[API] ツール推奨リクエスト: ${text.substring(0, 50)}...`);
    
    // ツール推奨の取得
    const recommendations = await defaultToolRecommender.getRecommendations(text, { availableTools });
    
    // レスポンスの返却
    const responseTime = Date.now() - startTime;
    logger.info(`[API] ツール推奨完了: ${recommendations.length}件 (${responseTime}ms)`);
    
    return res.json({
      success: true,
      recommendations,
      count: recommendations.length,
      responseTime
    });
  } catch (error) {
    logError(error, 'API:recommend-tools');
    
    // エラーレスポンスの返却
    return res.status(500).json({
      success: false,
      error: getUserFriendlyMessage(error)
    });
  }
});

/**
 * ヘルスチェックエンドポイントの設定
 * @param {express.Router} router Expressルーター
 */
function initHealthEndpoint(router) {
  // GETメソッドでのヘルスチェック（従来の互換性のため）
  router.get('/health', async (req, res) => {
    try {
      const isHealthy = await defaultToolRecommender.checkHealth(true);
      res.json({
        success: true,
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logError(error, 'API:health');
      res.status(500).json({
        success: false,
        error: getUserFriendlyMessage(error),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // POSTメソッドでのヘルスチェック（新しいクライアント用）
  router.post('/health', async (req, res) => {
    try {
      const isHealthy = await defaultToolRecommender.checkHealth(true);
      res.json({
        success: true,
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logError(error, 'API:health');
      res.status(500).json({
        success: false,
        error: getUserFriendlyMessage(error),
        timestamp: new Date().toISOString()
      });
    }
  });
}

initHealthEndpoint(router);

/**
 * 思考プロセスAPIエンドポイント
 * POST /api/sequential-thinking/process
 */
router.post('/process', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { text, context = {} } = req.body;
    
    // 必須パラメータのバリデーション
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'テキストが指定されていません',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`[API] 思考プロセスリクエスト: ${text.substring(0, 50)}...`);
    
    // 思考プロセスリクエストの作成
    const processUrl = `${config.service.url}/process`;
    const processBody = JSON.stringify({
      text,
      context
    });
    
    // リクエストオプションの準備
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: processBody,
      timeout: config.service.timeout
    };
    
    // Sequential Thinkingサービスにリクエストを送信
    const response = await fetch(processUrl, requestOptions);
    
    if (!response.ok) {
      throw new Error(`Sequential Thinkingサービスがステータス ${response.status} を返しました`);
    }
    
    const result = await response.json();
    
    // レスポンスの返却
    const responseTime = Date.now() - startTime;
    logger.info(`[API] 思考プロセス完了 (${responseTime}ms)`);
    
    return res.json({
      success: true,
      process: result.process,
      responseTime
    });
  } catch (error) {
    logError(error, 'API:process');
    
    // エラーレスポンスの返却
    return res.status(500).json({
      success: false,
      error: getUserFriendlyMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * キャッシュ統計APIエンドポイント
 * GET /api/sequential-thinking/cache/stats
 */
router.get('/cache/stats', (req, res) => {
  try {
    const stats = defaultCache.getStats();
    
    logger.info(`[API] キャッシュ統計取得: サイズ=${stats.size}`);
    
    return res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logError(error, 'API:cache:stats');
    
    return res.status(500).json({
      success: false,
      error: getUserFriendlyMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * キャッシュクリアAPIエンドポイント
 * POST /api/sequential-thinking/cache/clear
 */
router.post('/cache/clear', (req, res) => {
  try {
    const beforeSize = defaultCache.getStats().size;
    defaultCache.clear();
    const afterSize = defaultCache.getStats().size;
    
    logger.info(`[API] キャッシュクリア: ${beforeSize} → ${afterSize}`);
    
    return res.json({
      success: true,
      message: `キャッシュをクリアしました（${beforeSize} → ${afterSize}）`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logError(error, 'API:cache:clear');
    
    return res.status(500).json({
      success: false,
      error: getUserFriendlyMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * キャッシュ管理APIエンドポイント
 * @param {express.Router} router Expressルーター
 */
function initCacheEndpoints(router) {
  // キャッシュ統計情報の取得
  router.get('/cache/stats', (req, res) => {
    try {
      const stats = defaultCache.getStats();
      
      res.json({
        success: true,
        stats,
        config: {
          enabled: config.cache.enabled,
          ttl: config.cache.ttl,
          maxSize: config.cache.maxSize
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logError(error, 'API:cache:stats');
      res.status(500).json({
        success: false,
        error: getUserFriendlyMessage(error),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // キャッシュのクリア
  router.post('/cache/clear', (req, res) => {
    try {
      const beforeStats = defaultCache.getStats();
      defaultCache.clear();
      const afterStats = defaultCache.getStats();
      
      logger.info('[API] キャッシュをクリアしました');
      
      res.json({
        success: true,
        message: 'キャッシュをクリアしました',
        before: beforeStats,
        after: afterStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logError(error, 'API:cache:clear');
      res.status(500).json({
        success: false,
        error: getUserFriendlyMessage(error),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 特定のキーのキャッシュをクリア
  router.delete('/cache/key/:key', (req, res) => {
    try {
      const { key } = req.params;
      const deleted = defaultCache.delete(key);
      
      if (deleted) {
        logger.info(`[API] キャッシュキー "${key}" を削除しました`);
      } else {
        logger.info(`[API] キャッシュキー "${key}" は存在しませんでした`);
      }
      
      res.json({
        success: true,
        deleted,
        message: deleted ? `キャッシュキー "${key}" を削除しました` : `キャッシュキー "${key}" は存在しませんでした`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logError(error, 'API:cache:delete');
      res.status(500).json({
        success: false,
        error: getUserFriendlyMessage(error),
        timestamp: new Date().toISOString()
      });
    }
  });
}

// キャッシュ管理エンドポイントの初期化
initCacheEndpoints(router);

/**
 * サーバーの初期化関数
 * @param {express.Application} app Expressアプリケーション
 * @param {Object} options オプション
 * @returns {Object} 初期化されたルーターとツール推奨クライアント
 */
function initServer(app, options = {}) {
  const basePath = options.basePath || config.api.basePath;
  
  // APIルーターをアプリケーションに登録
  app.use(basePath, router);
  
  logger.info(`[API] Sequential Thinking APIエンドポイントを初期化しました: ${basePath}`);
  
  return {
    router,
    toolRecommender: defaultToolRecommender
  };
}

/**
 * モジュールのエクスポート
 */
export {
  router,
  initServer
};
