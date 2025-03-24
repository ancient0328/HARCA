// dashboard.js - メインダッシュボード機能
document.addEventListener('DOMContentLoaded', function() {
  // ナビゲーション機能
  initNavigation();
  
  // バージョン情報の取得
  fetchVersionInfo();
  
  // 更新ボタンの設定
  document.getElementById('refresh-btn').addEventListener('click', function() {
    refreshCurrentPage();
  });
  
  // 初期ページの読み込み
  loadSystemStatus();
  
  // コード分析ページの初期化
  initCodeAnalysisPage();
  
  // Windsurf連携ページの初期化
  initWindsurfIntegrationPage();
});

// ナビゲーション機能の初期化
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      // アクティブクラスの切り替え
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
      
      // ページタイトルの更新
      const pageTitle = this.textContent.trim();
      document.getElementById('page-title').textContent = pageTitle;
      
      // コンテンツページの切り替え
      const targetPage = this.getAttribute('data-page');
      const contentPages = document.querySelectorAll('.content-page');
      
      contentPages.forEach(page => {
        page.classList.remove('active');
      });
      
      document.getElementById(`${targetPage}-page`).classList.add('active');
      
      // ページに応じたデータ読み込み
      loadPageData(targetPage);
    });
  });
}

// ページデータの読み込み
function loadPageData(page) {
  switch (page) {
    case 'system-status':
      loadSystemStatus();
      break;
    case 'cache-stats':
      loadCacheStats();
      break;
    case 'vector-search':
      loadVectorSearchData();
      break;
    case 'code-analysis':
      // コード分析ページは入力フォームのみなので特別な読み込みは不要
      break;
    case 'windsurf-integration':
      loadWindsurfIntegrationStatus();
      break;
  }
}

// 現在のページを更新
function refreshCurrentPage() {
  const activePage = document.querySelector('.content-page.active');
  const pageId = activePage.id.replace('-page', '');
  loadPageData(pageId);
}

// バージョン情報の取得
function fetchVersionInfo() {
  fetch('/version')
    .then(response => response.json())
    .then(data => {
      document.getElementById('version-info').textContent = `バージョン: ${data.version || '不明'}`;
    })
    .catch(error => {
      console.error('バージョン情報の取得に失敗しました:', error);
      document.getElementById('version-info').textContent = 'バージョン: 取得失敗';
    });
}

// システムステータスの読み込み
function loadSystemStatus() {
  // サーバーステータスの取得
  fetch('/health')
    .then(response => response.json())
    .then(data => {
      const statusElement = document.getElementById('server-status');
      if (data.status === 'ok') {
        statusElement.innerHTML = '<i class="bi bi-circle-fill text-success"></i> オンライン';
      } else {
        statusElement.innerHTML = '<i class="bi bi-circle-fill text-danger"></i> エラー';
      }
      
      // タイムスタンプから稼働時間を計算
      if (data.timestamp) {
        const startTime = new Date(data.timestamp);
        const uptime = getUptime(startTime);
        document.getElementById('uptime').textContent = `稼働時間: ${uptime}`;
      }
    })
    .catch(error => {
      console.error('サーバーステータスの取得に失敗しました:', error);
      document.getElementById('server-status').innerHTML = 
        '<i class="bi bi-circle-fill text-danger"></i> 接続エラー';
    });
  
  // システムリソース情報の取得（サンプルデータ）
  // 実際の実装では、サーバーからリアルタイムデータを取得する
  updateSystemResources();
  
  // システムログの取得
  fetchSystemLogs();
}

// システムリソース情報の更新（サンプルデータ）
function updateSystemResources() {
  // CPU使用率の更新
  const cpuUsage = Math.floor(Math.random() * 60) + 10; // 10-70%のランダム値
  const cpuBar = document.getElementById('cpu-usage');
  cpuBar.style.width = `${cpuUsage}%`;
  cpuBar.textContent = `${cpuUsage}%`;
  cpuBar.setAttribute('aria-valuenow', cpuUsage);
  document.getElementById('cpu-details').textContent = `コア数: 4 | 平均負荷: ${(cpuUsage / 100 * 4).toFixed(2)}`;
  
  // メモリ使用率の更新
  const memoryUsage = Math.floor(Math.random() * 50) + 20; // 20-70%のランダム値
  const memoryBar = document.getElementById('memory-usage');
  memoryBar.style.width = `${memoryUsage}%`;
  memoryBar.textContent = `${memoryUsage}%`;
  memoryBar.setAttribute('aria-valuenow', memoryUsage);
  const totalMemory = 16; // GB
  const usedMemory = (totalMemory * memoryUsage / 100).toFixed(1);
  document.getElementById('memory-details').textContent = `使用中: ${usedMemory}GB / ${totalMemory}GB`;
  
  // AIエージェント接続数の更新
  const agentCount = Math.floor(Math.random() * 5) + 1; // 1-5のランダム値
  document.getElementById('agent-count').textContent = agentCount;
  document.getElementById('agent-details').textContent = `アクティブ: ${agentCount}`;
}

// システムログの取得（サンプルデータ）
function fetchSystemLogs() {
  const logSamples = [
    '[INFO] サーバー起動 - ポート: 3600',
    '[INFO] データベース接続成功',
    '[INFO] ベクトルストア初期化完了 - エントリ数: 1,245',
    '[INFO] コード分析プラグイン読み込み完了 - ルール数: 4',
    '[INFO] Windsurf連携モジュール初期化',
    '[INFO] 新規AIエージェント接続 - ID: agent-123',
    '[INFO] コード分析リクエスト処理 - 言語: JavaScript',
    '[INFO] ベクトル検索リクエスト処理 - クエリ: "コード分析"',
    '[WARN] キャッシュサイズが閾値に近づいています (85%)',
    '[INFO] 定期メンテナンス実行 - キャッシュクリーンアップ'
  ];
  
  const logElement = document.getElementById('system-log');
  let logContent = '';
  
  // 現在時刻から逆順に10件のログを生成
  const now = new Date();
  
  for (let i = 0; i < 10; i++) {
    const logTime = new Date(now.getTime() - i * 60000); // 1分ごとに遡る
    const timeStr = logTime.toLocaleTimeString();
    const logEntry = logSamples[i % logSamples.length];
    logContent += `${timeStr} ${logEntry}\n`;
  }
  
  logElement.textContent = logContent;
}

// 稼働時間の計算
function getUptime(startTime) {
  const now = new Date();
  const diff = now - startTime;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}日 ${hours}時間 ${minutes}分`;
  } else if (hours > 0) {
    return `${hours}時間 ${minutes}分`;
  } else {
    return `${minutes}分`;
  }
}

// キャッシュ統計の読み込み
function loadCacheStats() {
  // キャッシュヒット率チャートの初期化
  initCacheHitChart();
  
  // キャッシュサイズチャートの初期化
  initCacheSizeChart();
  
  // キャッシュパフォーマンスチャートの初期化
  initCachePerformanceChart();
  
  // キャッシュエントリテーブルの更新
  updateCacheEntriesTable();
}

// キャッシュヒット率チャートの初期化
function initCacheHitChart() {
  const ctx = document.getElementById('cache-hit-chart').getContext('2d');
  
  // 過去7日間のデータ
  const labels = [];
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }));
  }
  
  // ヒット率データ（サンプル）
  const hitRates = [65, 68, 72, 75, 78, 82, 85];
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'ヒット率 (%)',
        data: hitRates,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13, 110, 253, 0.1)',
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });
  
  // 詳細情報の更新
  document.getElementById('cache-hit-details').textContent = `ヒット率: 85% (前週比 +5%)`;
}

// ベクトル検索データの読み込み
function loadVectorSearchData() {
  // ベクトルDB統計の更新
  updateVectorDBStats();
  
  // ベクトル分布チャートの初期化
  initVectorDistributionChart();
  
  // 検索ボタンのイベントリスナー
  document.getElementById('vector-search-btn').addEventListener('click', performVectorSearch);
}

// コード分析ページの初期化
function initCodeAnalysisPage() {
  // 分析実行ボタンのイベントリスナー
  document.getElementById('analyze-code-btn').addEventListener('click', performCodeAnalysis);
}

// Windsurf連携ページの初期化
function initWindsurfIntegrationPage() {
  // 接続確認ボタンのイベントリスナー
  document.getElementById('check-windsurf-btn').addEventListener('click', checkWindsurfConnection);
  
  // 設定フォームのイベントリスナー
  document.getElementById('windsurf-config-form').addEventListener('submit', function(e) {
    e.preventDefault();
    saveWindsurfConfig();
  });
}

// その他の関数は別ファイルに分割
