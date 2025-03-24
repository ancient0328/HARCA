/**
 * Sequential Thinking統合モジュール設定
 * 
 * このモジュールは、Sequential Thinking統合モジュールの設定を一元管理します。
 * 環境変数から設定を読み込み、デフォルト値を提供し、設定の検証を行います。
 */

// 環境変数からの設定読み込み
const env = process.env;

/**
 * 設定オブジェクト
 */
const config = {
  // サービス設定
  service: {
    // Sequential ThinkingサービスのURL
    url: env.SEQUENTIAL_THINKING_URL || 'http://localhost:3740',
    
    // リクエストタイムアウト（ミリ秒）
    timeout: parseInt(env.SEQUENTIAL_THINKING_TIMEOUT || '5000', 10),
    
    // 失敗時の再試行回数
    retries: parseInt(env.SEQUENTIAL_THINKING_RETRIES || '2', 10),
    
    // 再試行間の遅延時間（ミリ秒）
    retryDelay: parseInt(env.SEQUENTIAL_THINKING_RETRY_DELAY || '500', 10),
    
    // ヘルスチェックの間隔（ミリ秒）
    healthCheckInterval: parseInt(env.SEQUENTIAL_THINKING_HEALTH_CHECK_INTERVAL || '60000', 10),
  },
  
  // キャッシュ設定
  cache: {
    // キャッシュを有効にするかどうか
    enabled: env.SEQUENTIAL_THINKING_CACHE_ENABLED !== 'false',
    
    // キャッシュエントリのTTL（ミリ秒）
    ttl: parseInt(env.SEQUENTIAL_THINKING_CACHE_TTL || '300000', 10), // デフォルト: 5分
    
    // キャッシュの最大サイズ
    maxSize: parseInt(env.SEQUENTIAL_THINKING_CACHE_MAX_SIZE || '1000', 10),
  },
  
  // 推奨設定
  recommendation: {
    // デフォルトの最大結果数
    defaultMaxResults: parseInt(env.SEQUENTIAL_THINKING_DEFAULT_MAX_RESULTS || '5', 10),
    
    // デフォルトの最小スコア
    defaultMinScore: parseFloat(env.SEQUENTIAL_THINKING_DEFAULT_MIN_SCORE || '0.3'),
    
    // デフォルトのユーザー経験レベル
    defaultUserExperienceLevel: parseInt(env.SEQUENTIAL_THINKING_DEFAULT_USER_EXPERIENCE_LEVEL || '5', 10),
    
    // 使用ヒントを含めるかどうか
    includeUsageHints: env.SEQUENTIAL_THINKING_INCLUDE_USAGE_HINTS !== 'false',
  },
  
  // API設定
  api: {
    // レート制限（リクエスト数/ウィンドウ）
    rateLimit: parseInt(env.SEQUENTIAL_THINKING_RATE_LIMIT || '100', 10),
    
    // レート制限ウィンドウ（ミリ秒）
    rateLimitWindow: parseInt(env.SEQUENTIAL_THINKING_RATE_LIMIT_WINDOW || '60000', 10), // デフォルト: 1分
    
    // APIパス
    basePath: env.SEQUENTIAL_THINKING_API_BASE_PATH || '/api/sequential-thinking',
  },
  
  // デバッグモード
  debug: env.DEBUG === 'true' || env.SEQUENTIAL_THINKING_DEBUG === 'true',
};

/**
 * 設定の検証
 * @param {Object} config 検証する設定オブジェクト
 * @returns {boolean} 設定が有効かどうか
 */
function validateConfig(config) {
  // URLの検証
  try {
    new URL(config.service.url);
  } catch (error) {
    console.error(`[Config] 無効なサービスURL: ${config.service.url}`);
    return false;
  }
  
  // タイムアウトの検証
  if (config.service.timeout <= 0) {
    console.error(`[Config] 無効なタイムアウト値: ${config.service.timeout}`);
    return false;
  }
  
  // 再試行回数の検証
  if (config.service.retries < 0) {
    console.error(`[Config] 無効な再試行回数: ${config.service.retries}`);
    return false;
  }
  
  // キャッシュTTLの検証
  if (config.cache.ttl <= 0) {
    console.error(`[Config] 無効なキャッシュTTL: ${config.cache.ttl}`);
    return false;
  }
  
  // キャッシュサイズの検証
  if (config.cache.maxSize <= 0) {
    console.error(`[Config] 無効なキャッシュサイズ: ${config.cache.maxSize}`);
    return false;
  }
  
  // レート制限の検証
  if (config.api.rateLimit <= 0) {
    console.error(`[Config] 無効なレート制限: ${config.api.rateLimit}`);
    return false;
  }
  
  // レート制限ウィンドウの検証
  if (config.api.rateLimitWindow <= 0) {
    console.error(`[Config] 無効なレート制限ウィンドウ: ${config.api.rateLimitWindow}`);
    return false;
  }
  
  return true;
}

// 設定の検証
const isValid = validateConfig(config);
if (!isValid) {
  console.warn('[Config] 設定の検証に失敗しました。デフォルト値を使用します。');
}

// デバッグモードが有効な場合は設定を出力
if (config.debug) {
  console.debug('[Config] Sequential Thinking統合モジュール設定:', JSON.stringify(config, null, 2));
}

export { config, validateConfig };
