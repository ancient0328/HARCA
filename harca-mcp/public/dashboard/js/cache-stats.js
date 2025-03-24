// cache-stats.js - キャッシュ統計機能
// ダッシュボードのキャッシュ統計ページの機能を実装

/**
 * キャッシュサイズチャートの初期化
 */
function initCacheSizeChart() {
  const ctx = document.getElementById('cache-size-chart').getContext('2d');
  
  // 過去7日間のデータ
  const labels = [];
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }));
  }
  
  // キャッシュサイズデータ（サンプル）
  const cacheSizes = [125, 142, 156, 178, 195, 210, 232];
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'キャッシュサイズ (MB)',
        data: cacheSizes,
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
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
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + ' MB';
            }
          }
        }
      }
    }
  });
  
  // 詳細情報の更新
  document.getElementById('cache-size-details').textContent = `現在のサイズ: 232 MB (最大容量: 500 MB)`;
}

/**
 * キャッシュパフォーマンスチャートの初期化
 */
function initCachePerformanceChart() {
  const ctx = document.getElementById('cache-performance-chart').getContext('2d');
  
  // 過去7日間のデータ
  const labels = [];
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }));
  }
  
  // パフォーマンスデータ（サンプル）
  const avgResponseTimes = [45, 42, 38, 35, 32, 30, 28];
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '平均応答時間 (ms)',
        data: avgResponseTimes,
        borderColor: 'rgba(153, 102, 255, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.1)',
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
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + ' ms';
            }
          }
        }
      }
    }
  });
  
  // 詳細情報の更新
  document.getElementById('cache-performance-details').textContent = `平均応答時間: 28 ms (前週比 -17 ms)`;
}

/**
 * キャッシュエントリテーブルの更新
 */
function updateCacheEntriesTable() {
  // サンプルデータ
  const cacheEntries = [
    { key: 'code-analysis-result:js:file1', size: '12.5 KB', hits: 42, lastAccess: '2025-03-17 06:45:12' },
    { key: 'vector-search:query1', size: '8.2 KB', hits: 35, lastAccess: '2025-03-17 06:30:05' },
    { key: 'code-analysis-result:py:file2', size: '15.7 KB', hits: 28, lastAccess: '2025-03-17 05:55:23' },
    { key: 'vector-search:query2', size: '7.8 KB', hits: 24, lastAccess: '2025-03-17 05:40:18' },
    { key: 'code-analysis-result:ts:file3', size: '14.2 KB', hits: 19, lastAccess: '2025-03-17 04:25:37' },
    { key: 'vector-search:query3', size: '6.5 KB', hits: 15, lastAccess: '2025-03-17 03:15:42' },
    { key: 'code-analysis-result:java:file4', size: '18.3 KB', hits: 12, lastAccess: '2025-03-16 22:10:09' },
    { key: 'vector-search:query4', size: '5.9 KB', hits: 8, lastAccess: '2025-03-16 20:05:31' },
    { key: 'code-analysis-result:go:file5', size: '10.1 KB', hits: 5, lastAccess: '2025-03-16 18:30:24' },
    { key: 'vector-search:query5', size: '4.7 KB', hits: 3, lastAccess: '2025-03-16 15:20:17' }
  ];
  
  // テーブルの作成
  let tableHtml = `
    <table class="table table-striped table-hover">
      <thead>
        <tr>
          <th>キー</th>
          <th>サイズ</th>
          <th>ヒット数</th>
          <th>最終アクセス</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  cacheEntries.forEach(entry => {
    tableHtml += `
      <tr>
        <td>${entry.key}</td>
        <td>${entry.size}</td>
        <td>${entry.hits}</td>
        <td>${entry.lastAccess}</td>
      </tr>
    `;
  });
  
  tableHtml += `
      </tbody>
    </table>
  `;
  
  document.getElementById('cache-entries').innerHTML = tableHtml;
  
  // キャッシュ統計の更新
  document.getElementById('cache-stats-summary').innerHTML = `
    <div class="row">
      <div class="col-md-3">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">総エントリ数</h5>
            <p class="card-text display-6">1,245</p>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">総サイズ</h5>
            <p class="card-text display-6">232 MB</p>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">平均ヒット率</h5>
            <p class="card-text display-6">85%</p>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">平均応答時間</h5>
            <p class="card-text display-6">28 ms</p>
          </div>
        </div>
      </div>
    </div>
  `;
}
