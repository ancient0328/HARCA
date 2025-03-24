// vector-search.js - ベクトル検索機能
// ダッシュボードのベクトル検索ページの機能を実装

/**
 * ベクトルDB統計の更新
 */
function updateVectorDBStats() {
  // サンプルデータ
  const stats = {
    totalEntries: 12458,
    totalVectors: 15632,
    averageDimension: 1536,
    lastUpdated: '2025-03-17 06:30:15'
  };
  
  // 統計情報の表示
  document.getElementById('vector-db-stats').innerHTML = `
    <div class="row">
      <div class="col-md-3">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">総エントリ数</h5>
            <p class="card-text display-6">${stats.totalEntries.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">総ベクトル数</h5>
            <p class="card-text display-6">${stats.totalVectors.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">平均次元数</h5>
            <p class="card-text display-6">${stats.averageDimension}</p>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">最終更新</h5>
            <p class="card-text">${stats.lastUpdated}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * ベクトル分布チャートの初期化
 */
function initVectorDistributionChart() {
  const ctx = document.getElementById('vector-distribution-chart').getContext('2d');
  
  // サンプルデータ
  const data = {
    labels: ['JavaScript', 'Python', 'TypeScript', 'Java', 'Go', 'C++', 'Ruby', 'その他'],
    datasets: [{
      data: [35, 25, 15, 10, 5, 4, 3, 3],
      backgroundColor: [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)',
        'rgba(255, 159, 64, 0.7)',
        'rgba(199, 199, 199, 0.7)',
        'rgba(83, 102, 255, 0.7)'
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)',
        'rgba(199, 199, 199, 1)',
        'rgba(83, 102, 255, 1)'
      ],
      borderWidth: 1
    }]
  };
  
  new Chart(ctx, {
    type: 'pie',
    data: data,
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.raw || 0;
              return `${label}: ${value}%`;
            }
          }
        }
      }
    }
  });
}

/**
 * ベクトル検索の実行
 */
function performVectorSearch() {
  // 入力値の取得
  const query = document.getElementById('vector-search-query').value;
  const limit = document.getElementById('vector-search-limit').value;
  
  // 入力チェック
  if (!query || query.trim() === '') {
    alert('検索クエリを入力してください');
    return;
  }
  
  // 検索中の表示
  document.getElementById('vector-search-results').innerHTML = `
    <div class="d-flex justify-content-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">検索中...</span>
      </div>
    </div>
    <p class="text-center">検索中...</p>
  `;
  
  // 検索APIの呼び出し
  fetch('/api/vector/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: query,
      limit: parseInt(limit, 10) || 10
    })
  })
  .then(response => response.json())
  .then(data => {
    showVectorSearchResults(data);
  })
  .catch(error => {
    console.error('ベクトル検索中にエラーが発生しました:', error);
    document.getElementById('vector-search-results').innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-circle me-2"></i>
        検索エラー: ${error.message || '不明なエラー'}
      </div>
    `;
  });
}

/**
 * ベクトル検索結果の表示
 * @param {Object} data 検索結果データ
 */
function showVectorSearchResults(data) {
  // 検索結果がない場合
  if (!data || !data.results || data.results.length === 0) {
    document.getElementById('vector-search-results').innerHTML = `
      <div class="alert alert-info">
        <i class="bi bi-info-circle me-2"></i>
        検索結果がありません
      </div>
    `;
    return;
  }
  
  // 検索結果の表示
  let html = `
    <div class="card">
      <div class="card-header">
        <h5 class="card-title mb-0">検索結果 (${data.results.length}件)</h5>
      </div>
      <div class="card-body">
  `;
  
  // 検索結果の一覧
  data.results.forEach((result, index) => {
    const similarity = (result.similarity * 100).toFixed(2);
    const similarityClass = similarity > 80 ? 'success' : 
                           similarity > 60 ? 'primary' : 
                           similarity > 40 ? 'warning' : 'danger';
    
    html += `
      <div class="search-result mb-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">${index + 1}. ${result.title || 'タイトルなし'}</h6>
          <span class="badge bg-${similarityClass}">${similarity}% 一致</span>
        </div>
        <p class="mb-1">${result.content || '内容なし'}</p>
        <div class="small text-muted">
          <span class="me-3"><i class="bi bi-file-earmark me-1"></i>${result.source || '不明'}</span>
          <span><i class="bi bi-tag me-1"></i>${result.category || '未分類'}</span>
        </div>
      </div>
    `;
    
    // 最後の結果以外は区切り線を追加
    if (index < data.results.length - 1) {
      html += `<hr>`;
    }
  });
  
  html += `
      </div>
    </div>
  `;
  
  document.getElementById('vector-search-results').innerHTML = html;
  
  // 検索メタデータの表示
  if (data.metadata) {
    document.getElementById('vector-search-metadata').innerHTML = `
      <div class="card mt-3">
        <div class="card-header">
          <h5 class="card-title mb-0">検索メタデータ</h5>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-4">
              <p><strong>検索時間:</strong> ${data.metadata.searchTime || 0}ms</p>
            </div>
            <div class="col-md-4">
              <p><strong>検索範囲:</strong> ${data.metadata.searchScope || 'すべて'}</p>
            </div>
            <div class="col-md-4">
              <p><strong>ベクトル次元:</strong> ${data.metadata.vectorDimension || 0}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    document.getElementById('vector-search-metadata').innerHTML = '';
  }
}
