/**
 * キャッシュパフォーマンスダッシュボード
 * 
 * このモジュールは、EmbeddingCacheのパフォーマンスを視覚的に監視するための
 * シンプルなWebインターフェースを提供します。
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { EmbeddingCache } = require('./embedding-cache');

// ダッシュボード用のデータを保持するクラス
class CacheDashboardData {
  constructor() {
    this.timeSeriesData = {
      hitRates: [],
      memoryCacheSize: [],
      fileCacheSize: [],
      timestamps: []
    };
    
    this.modelPerformance = {};
    this.hourlyPatterns = Array(24).fill(0).map(() => ({
      requests: 0,
      hits: 0,
      misses: 0
    }));
    
    this.cacheSizeHistory = [];
    this.compressionStats = {
      enabled: false,
      ratioHistory: [],
      savedBytes: 0,
      averageRatio: 1
    };
    
    this.lastReportTime = Date.now();
    this.reportInterval = 5 * 60 * 1000; // 5分ごとにレポートを更新
    this.maxDataPoints = 100;
    this.lastReportUpdate = null; // 最後のレポート更新時間
  }
  
  // データポイントを追加
  addDataPoint(cache) {
    if (!cache || !cache.stats) {
      console.warn('キャッシュまたは統計情報が利用できません');
      return;
    }
    
    const now = new Date();
    const timestamp = now.toISOString();
    const hour = now.getHours();
    
    // キャッシュの統計情報を取得
    const stats = cache.stats || {};
    const requests = stats.requests || 0;
    const hits = stats.hits || { total: 0, memory: 0, redis: 0, file: 0 };
    const misses = stats.misses || 0;
    
    // ヒット率を計算
    let hitRate = 0;
    if (requests > 0) {
      hitRate = (hits.total / requests) * 100;
    }
    
    // 時間帯別のパターンを更新
    this.hourlyPatterns[hour].requests += requests;
    this.hourlyPatterns[hour].hits += hits.total;
    this.hourlyPatterns[hour].misses += misses;
    
    // 時系列データを更新
    this.timeSeriesData.hitRates.push(hitRate);
    this.timeSeriesData.memoryCacheSize.push(cache.memoryCacheSize || 0);
    this.timeSeriesData.fileCacheSize.push(cache.fileCacheSize || 0);
    this.timeSeriesData.timestamps.push(timestamp);
    
    // データポイントが多すぎる場合は古いものを削除
    if (this.timeSeriesData.hitRates.length > this.maxDataPoints) {
      this.timeSeriesData.hitRates.shift();
      this.timeSeriesData.memoryCacheSize.shift();
      this.timeSeriesData.fileCacheSize.shift();
      this.timeSeriesData.timestamps.shift();
    }
    
    // キャッシュサイズの履歴を更新
    this.cacheSizeHistory.push({
      timestamp,
      memoryCacheSize: cache.memoryCacheSize || 0,
      fileCacheSize: cache.fileCacheSize || 0,
      totalEntries: (cache.memoryCacheSize || 0) + (cache.fileCacheSize || 0)
    });
    
    // キャッシュサイズの履歴が多すぎる場合は古いものを削除
    if (this.cacheSizeHistory.length > this.maxDataPoints) {
      this.cacheSizeHistory.shift();
    }
    
    // 圧縮統計情報を更新
    if (cache.config && cache.config.enableCompression) {
      const originalSize = stats.originalSize || 0;
      const compressedSize = stats.compressedSize || 0;
      
      // 圧縮率を計算（0に分割しないように注意）
      let compressionRatio = 0;
      if (originalSize > 0) {
        compressionRatio = (compressedSize / originalSize) * 100;
      }
      
      // 圧縮によって節約されたバイト数
      const savedBytes = originalSize - compressedSize;
      
      // 圧縮統計情報を更新
      this.compressionStats.enabled = true;
      this.compressionStats.ratioHistory.push({
        timestamp,
        ratio: compressionRatio
      });
      
      // 圧縮率の履歴が多すぎる場合は古いものを削除
      if (this.compressionStats.ratioHistory.length > this.maxDataPoints) {
        this.compressionStats.ratioHistory.shift();
      }
      
      // 累積の節約バイト数を更新
      this.compressionStats.savedBytes += savedBytes;
    }
  }
  
  // ダッシュボード用のデータを取得
  getDashboardData() {
    // モデル別ヒット率の計算
    const modelHitRates = {};
    for (const [model, stats] of Object.entries(this.modelPerformance)) {
      modelHitRates[model] = stats.requests > 0 ? (stats.hits / stats.requests) * 100 : 0;
    }
    
    // 時間帯別ヒット率の計算
    const hourlyHitRates = this.hourlyPatterns.map((stats, hour) => {
      return {
        hour,
        hitRate: stats.requests > 0 ? (stats.hits / stats.requests) * 100 : 0,
        requests: stats.requests
      };
    });
    
    return {
      timeSeriesData: this.timeSeriesData,
      modelHitRates,
      hourlyHitRates,
      lastUpdated: new Date().toISOString(),
      compressionStats: this.compressionStats,
      cacheSizeHistory: this.cacheSizeHistory
    };
  }
  
  // レポートの更新が必要かどうかを確認
  shouldUpdateReport() {
    const now = Date.now();
    if (now - this.lastReportTime >= this.reportInterval) {
      this.lastReportTime = now;
      return true;
    }
    return false;
  }
  
  /**
   * パフォーマンスレポートを更新すべきかどうかを判断します
   * @returns {boolean} レポートを更新すべき場合はtrue
   */
  shouldUpdatePerformanceReport() {
    // 最後のレポート更新から1時間経過していれば更新
    if (!this.lastReportUpdate) {
      this.lastReportUpdate = Date.now();
      return true;
    }
    
    const hourInMs = 60 * 60 * 1000;
    const shouldUpdate = (Date.now() - this.lastReportUpdate) >= hourInMs;
    
    if (shouldUpdate) {
      this.lastReportUpdate = Date.now();
    }
    
    return shouldUpdate;
  }
}

// ダッシュボードサーバークラス
class CacheDashboard {
  constructor(cache, options = {}) {
    this.cache = cache;
    this.port = options.port || 3700;
    this.updateInterval = options.updateInterval || 60000; // 1分ごとにデータを収集
    this.app = express();
    this.dashboardData = new CacheDashboardData();
    this.server = null;
    
    // 定期的なデータ収集
    this.dataCollectionInterval = null;
    
    this.setupRoutes();
  }
  
  /**
   * ダッシュボードサーバーを起動します
   * @returns {Promise<void>} 起動完了時に解決されるPromise
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        // サーバーの起動
        this.server = this.app.listen(this.port, () => {
          console.log(`キャッシュダッシュボードサーバーが起動しました: http://localhost:${this.port}`);
          
          // 定期的なデータ収集を開始
          this.dataCollectionInterval = setInterval(() => {
            this.dashboardData.addDataPoint(this.cache);
            
            // 定期的にパフォーマンスレポートを生成
            if (this.dashboardData.shouldUpdatePerformanceReport()) {
              const report = this.cache.generatePerformanceReport();
              fs.writeFileSync(
                path.join(__dirname, 'cache-performance-report.md'),
                report,
                'utf8'
              );
              console.log('キャッシュパフォーマンスレポートを更新しました');
            }
          }, this.updateInterval);
          
          // 初期データポイントを追加
          this.dashboardData.addDataPoint(this.cache);
          
          resolve();
        });
        
        // エラーハンドリング
        this.server.on('error', (err) => {
          console.error('ダッシュボードサーバーエラー:', err);
          reject(err);
        });
      } catch (err) {
        console.error('ダッシュボードサーバーの起動に失敗しました:', err);
        reject(err);
      }
    });
  }
  
  /**
   * ダッシュボードサーバーを停止します
   * @returns {Promise<void>} 停止完了時に解決されるPromise
   */
  async stop() {
    return new Promise((resolve) => {
      // データ収集インターバルをクリア
      if (this.dataCollectionInterval) {
        clearInterval(this.dataCollectionInterval);
        this.dataCollectionInterval = null;
      }
      
      // サーバーが起動していれば停止
      if (this.server) {
        this.server.close(() => {
          console.log('キャッシュダッシュボードサーバーを停止しました');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
  
  // ルートの設定
  setupRoutes() {
    // 静的ファイルの提供
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // APIエンドポイント: ダッシュボードデータ
    this.app.get('/api/cache-dashboard/data', (req, res) => {
      // 現在の統計情報
      const stats = this.cache.getStats();
      const hitRate = stats.requests > 0 ? stats.hits.total / stats.requests : 0;
      
      const currentStats = {
        hitRate,
        requests: stats.requests,
        hits: stats.hits.total,
        misses: stats.misses.total,
        cacheSize: {
          memory: this.cache.getMemoryCacheSize(),
          file: this.cache.getFileCacheSize(),
          total: this.cache.getMemoryCacheSize() + this.cache.getFileCacheSize()
        },
        cacheDistribution: {
          memory: stats.hits.memory / Math.max(stats.hits.total, 1),
          redis: stats.hits.redis / Math.max(stats.hits.total, 1),
          file: stats.hits.file / Math.max(stats.hits.total, 1)
        }
      };
      
      res.json({
        currentStats,
        timeSeriesData: this.dashboardData.timeSeriesData,
        modelPerformance: this.dashboardData.modelPerformance,
        hourlyPerformance: this.dashboardData.hourlyPatterns,
        cacheSizeHistory: this.dashboardData.cacheSizeHistory,
        compressionStats: this.dashboardData.compressionStats
      });
    });
    
    // APIエンドポイント
    this.app.get('/api/dashboard-data', (req, res) => {
      res.json(this.dashboardData.getDashboardData());
    });
    
    // パフォーマンスレポートの提供
    this.app.get('/api/performance-report', (req, res) => {
      this.cache.analyzePerformance();
      res.json({
        report: this.cache.generatePerformanceReport()
      });
    });
    
    // モデル別分析
    this.app.get('/api/model-analysis', (req, res) => {
      this.cache.analyzeModelPerformance();
      res.json({
        modelAnalysis: this.cache.modelAnalysis
      });
    });
    
    // 時間帯別分析
    this.app.get('/api/hourly-analysis', (req, res) => {
      this.cache.analyzeHourlyPatterns();
      res.json({
        hourlyAnalysis: this.cache.hourlyAnalysis
      });
    });
    
    // キャッシュサイズ分析
    this.app.get('/api/size-analysis', (req, res) => {
      this.cache.analyzeSizeGrowth();
      res.json({
        sizeAnalysis: this.cache.sizeAnalysis
      });
    });
    
    // ダッシュボードのホームページ
    this.app.get('/', (req, res) => {
      const html = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>キャッシュパフォーマンスダッシュボード</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body { padding: 20px; }
          .card { margin-bottom: 20px; }
          .stat-card { text-align: center; padding: 15px; }
          .stat-value { font-size: 24px; font-weight: bold; }
          .stat-label { font-size: 14px; color: #666; }
          .compression-info { background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 10px; }
          .compression-badge { font-size: 12px; padding: 5px 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="mb-4">キャッシュパフォーマンスダッシュボード</h1>
          
          <div class="row mb-4">
            <div class="col-md-3">
              <div class="card stat-card">
                <div class="stat-value" id="hitRate">-</div>
                <div class="stat-label">ヒット率</div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card stat-card">
                <div class="stat-value" id="requests">-</div>
                <div class="stat-label">リクエスト数</div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card stat-card">
                <div class="stat-value" id="cacheSize">-</div>
                <div class="stat-label">キャッシュサイズ</div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card stat-card">
                <div class="stat-value" id="compressionRatio">-</div>
                <div class="stat-label">圧縮率</div>
                <div id="compressionStatus" class="mt-2"></div>
              </div>
            </div>
          </div>
          
          <div class="row">
            <div class="col-md-8">
              <div class="card">
                <div class="card-header">
                  ヒット率の推移
                </div>
                <div class="card-body">
                  <canvas id="hitRateChart"></canvas>
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card">
                <div class="card-header">
                  キャッシュ分布
                </div>
                <div class="card-body">
                  <canvas id="cacheDistributionChart"></canvas>
                </div>
              </div>
            </div>
          </div>
          
          <div class="row mt-4">
            <div class="col-md-6">
              <div class="card">
                <div class="card-header">
                  時間帯別パフォーマンス
                </div>
                <div class="card-body">
                  <canvas id="hourlyPerformanceChart"></canvas>
                </div>
              </div>
            </div>
            <div class="col-md-6">
              <div class="card">
                <div class="card-header">
                  キャッシュサイズの推移
                </div>
                <div class="card-body">
                  <canvas id="cacheSizeChart"></canvas>
                </div>
              </div>
            </div>
          </div>
          
          <div class="row mt-4">
            <div class="col-md-6">
              <div class="card">
                <div class="card-header">
                  モデル別パフォーマンス
                </div>
                <div class="card-body">
                  <canvas id="modelPerformanceChart"></canvas>
                </div>
              </div>
            </div>
            <div class="col-md-6">
              <div class="card">
                <div class="card-header">
                  圧縮率の推移
                </div>
                <div class="card-body">
                  <canvas id="compressionRatioChart"></canvas>
                  <div class="compression-info mt-3" id="compressionInfo">
                    <div class="row">
                      <div class="col-6">
                        <strong>平均圧縮率:</strong> <span id="avgCompressionRatio">-</span>
                      </div>
                      <div class="col-6">
                        <strong>節約されたバイト数:</strong> <span id="savedBytes">-</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <script>
          // チャートの初期化
          const hitRateCtx = document.getElementById('hitRateChart').getContext('2d');
          const hitRateChart = new Chart(hitRateCtx, {
            type: 'line',
            data: {
              labels: [],
              datasets: [{
                label: 'ヒット率',
                data: [],
                borderColor: 'rgba(75, 192, 192, 1)',
                tension: 0.1,
                fill: false
              }]
            },
            options: {
              scales: {
                y: {
                  beginAtZero: true,
                  max: 1
                }
              }
            }
          });
          
          const cacheDistributionCtx = document.getElementById('cacheDistributionChart').getContext('2d');
          const cacheDistributionChart = new Chart(cacheDistributionCtx, {
            type: 'doughnut',
            data: {
              labels: ['メモリキャッシュ', 'Redisキャッシュ', 'ファイルキャッシュ'],
              datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                  'rgba(54, 162, 235, 0.5)',
                  'rgba(255, 99, 132, 0.5)',
                  'rgba(255, 206, 86, 0.5)'
                ]
              }]
            }
          });
          
          const hourlyPerformanceCtx = document.getElementById('hourlyPerformanceChart').getContext('2d');
          const hourlyPerformanceChart = new Chart(hourlyPerformanceCtx, {
            type: 'bar',
            data: {
              labels: Array.from({length: 24}, (_, i) => \`\${i}時\`),
              datasets: [{
                label: 'ヒット率',
                data: Array(24).fill(0),
                backgroundColor: 'rgba(75, 192, 192, 0.5)'
              }]
            },
            options: {
              scales: {
                y: {
                  beginAtZero: true,
                  max: 1
                }
              }
            }
          });
          
          const cacheSizeCtx = document.getElementById('cacheSizeChart').getContext('2d');
          const cacheSizeChart = new Chart(cacheSizeCtx, {
            type: 'line',
            data: {
              labels: [],
              datasets: [{
                label: 'メモリキャッシュ',
                data: [],
                borderColor: 'rgba(54, 162, 235, 1)',
                tension: 0.1,
                fill: false
              }, {
                label: 'ファイルキャッシュ',
                data: [],
                borderColor: 'rgba(255, 206, 86, 1)',
                tension: 0.1,
                fill: false
              }]
            }
          });
          
          const modelPerformanceCtx = document.getElementById('modelPerformanceChart').getContext('2d');
          const modelPerformanceChart = new Chart(modelPerformanceCtx, {
            type: 'bar',
            data: {
              labels: [],
              datasets: [{
                label: 'ヒット率',
                data: [],
                backgroundColor: 'rgba(153, 102, 255, 0.5)'
              }]
            },
            options: {
              scales: {
                y: {
                  beginAtZero: true,
                  max: 1
                }
              }
            }
          });
          
          const compressionRatioCtx = document.getElementById('compressionRatioChart').getContext('2d');
          const compressionRatioChart = new Chart(compressionRatioCtx, {
            type: 'line',
            data: {
              labels: [],
              datasets: [{
                label: '圧縮率',
                data: [],
                borderColor: 'rgba(255, 159, 64, 1)',
                tension: 0.1,
                fill: false
              }]
            },
            options: {
              scales: {
                y: {
                  beginAtZero: true,
                  max: 1
                }
              }
            }
          });
          
          // データの取得と更新
          function updateDashboard() {
            fetch('/api/cache-dashboard/data')
              .then(response => response.json())
              .then(data => {
                // 基本統計情報
                document.getElementById('hitRate').textContent = (data.currentStats.hitRate * 100).toFixed(1) + '%';
                document.getElementById('requests').textContent = data.currentStats.requests;
                document.getElementById('cacheSize').textContent = formatSize(data.currentStats.cacheSize.total);
                
                // 圧縮情報
                if (data.compressionStats && data.compressionStats.enabled) {
                  const ratio = data.compressionStats.averageRatio;
                  document.getElementById('compressionRatio').textContent = (ratio * 100).toFixed(1) + '%';
                  document.getElementById('compressionStatus').innerHTML = 
                    \`<span class="badge bg-success compression-badge">有効</span>\`;
                  document.getElementById('avgCompressionRatio').textContent = (ratio * 100).toFixed(1) + '%';
                  document.getElementById('savedBytes').textContent = formatSize(data.compressionStats.savedBytes);
                } else {
                  document.getElementById('compressionRatio').textContent = 'N/A';
                  document.getElementById('compressionStatus').innerHTML = 
                    \`<span class="badge bg-secondary compression-badge">無効</span>\`;
                  document.getElementById('avgCompressionRatio').textContent = 'N/A';
                  document.getElementById('savedBytes').textContent = 'N/A';
                }
                
                // ヒット率チャート
                const timeLabels = data.timeSeriesData.map(point => {
                  const date = new Date(point.timestamp);
                  return \`\${date.getHours()}:\${date.getMinutes().toString().padStart(2, '0')}\`;
                });
                hitRateChart.data.labels = timeLabels;
                hitRateChart.data.datasets[0].data = data.timeSeriesData.map(point => point.hitRate);
                hitRateChart.update();
                
                // キャッシュ分布チャート
                cacheDistributionChart.data.datasets[0].data = [
                  data.currentStats.cacheDistribution.memory,
                  data.currentStats.cacheDistribution.redis,
                  data.currentStats.cacheDistribution.file
                ];
                cacheDistributionChart.update();
                
                // 時間帯別パフォーマンスチャート
                const hourlyHitRates = Array(24).fill(0);
                if (data.hourlyPerformance) {
                  for (let i = 0; i < 24; i++) {
                    const hour = data.hourlyPerformance[i];
                    if (hour && hour.requests > 0) {
                      hourlyHitRates[i] = hour.hits / hour.requests;
                    }
                  }
                }
                hourlyPerformanceChart.data.datasets[0].data = hourlyHitRates;
                hourlyPerformanceChart.update();
                
                // キャッシュサイズチャート
                if (data.cacheSizeHistory && data.cacheSizeHistory.length > 0) {
                  const sizeLabels = data.cacheSizeHistory.map(point => {
                    const date = new Date(point.timestamp);
                    return \`\${date.getHours()}:\${date.getMinutes().toString().padStart(2, '0')}\`;
                  });
                  cacheSizeChart.data.labels = sizeLabels;
                  cacheSizeChart.data.datasets[0].data = data.cacheSizeHistory.map(point => point.memory);
                  cacheSizeChart.data.datasets[1].data = data.cacheSizeHistory.map(point => point.file);
                  cacheSizeChart.update();
                }
                
                // モデル別パフォーマンスチャート
                if (data.modelPerformance) {
                  const modelNames = Object.keys(data.modelPerformance);
                  const modelHitRates = modelNames.map(name => {
                    const model = data.modelPerformance[name];
                    return model.requests > 0 ? model.hits / model.requests : 0;
                  });
                  modelPerformanceChart.data.labels = modelNames;
                  modelPerformanceChart.data.datasets[0].data = modelHitRates;
                  modelPerformanceChart.update();
                }
                
                // 圧縮率チャート
                if (data.compressionStats && data.compressionStats.enabled && data.compressionStats.ratioHistory) {
                  const compressionLabels = data.compressionStats.ratioHistory.map(point => {
                    const date = new Date(point.timestamp);
                    return \`\${date.getHours()}:\${date.getMinutes().toString().padStart(2, '0')}\`;
                  });
                  compressionRatioChart.data.labels = compressionLabels;
                  compressionRatioChart.data.datasets[0].data = data.compressionStats.ratioHistory.map(point => point.ratio);
                  compressionRatioChart.update();
                }
              })
              .catch(error => console.error('データの取得中にエラーが発生しました:', error));
          }
          
          // サイズのフォーマット
          function formatSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
          }
          
          // 初期更新
          updateDashboard();
          
          // 定期的に更新
          setInterval(updateDashboard, 60000); // 1分ごと
        </script>
      </body>
      </html>
      `;
      
      res.send(html);
    });
  }
}

// モジュールのエクスポート
module.exports = {
  CacheDashboard,
  CacheDashboardData
};
