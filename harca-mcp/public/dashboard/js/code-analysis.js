// code-analysis.js - コード分析機能
// ダッシュボードのコード分析ページの機能を実装

/**
 * コード分析を実行する
 */
function performCodeAnalysis() {
  // 入力値の取得
  const code = document.getElementById('code-input').value;
  const language = document.getElementById('code-analysis-language').value;
  const advanced = document.getElementById('advanced-analysis').checked;
  
  // 入力チェック
  if (!code || code.trim() === '') {
    alert('コードを入力してください');
    return;
  }
  
  // 分析中の表示
  showAnalysisLoading();
  
  // APIリクエスト
  fetch('/api/windsurf/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: code,
      language: language,
      options: {
        advanced: advanced,
        includeSummary: true
      }
    })
  })
  .then(response => response.json())
  .then(data => {
    // 分析結果を表示
    showAnalysisResults(data);
  })
  .catch(error => {
    console.error('コード分析中にエラーが発生しました:', error);
    showAnalysisError(error);
  });
}

/**
 * 分析中の読み込み表示
 */
function showAnalysisLoading() {
  // 結果コンテナを表示
  document.getElementById('analysis-results-container').style.display = 'block';
  
  // 各タブの内容をローディング表示に更新
  const tabs = ['summary', 'complexity', 'comments', 'naming', 'duplication'];
  
  tabs.forEach(tab => {
    document.getElementById(`${tab}-content`).innerHTML = `
      <div class="d-flex justify-content-center my-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">読み込み中...</span>
        </div>
      </div>
      <p class="text-center">分析中...</p>
    `;
  });
}

/**
 * 分析結果の表示
 * @param {Object} data 分析結果データ
 */
function showAnalysisResults(data) {
  if (!data || !data.success) {
    showAnalysisError(data?.error || '不明なエラー');
    return;
  }
  
  // サマリータブの更新
  updateSummaryTab(data);
  
  // 各分析タブの更新
  if (data.analysis) {
    // 複雑度分析
    if (data.analysis.complexity) {
      updateComplexityTab(data.analysis.complexity);
    } else {
      document.getElementById('complexity-content').innerHTML = '<div class="alert alert-info">複雑度分析データがありません</div>';
    }
    
    // コメント率分析
    if (data.analysis.comments) {
      updateCommentsTab(data.analysis.comments);
    } else {
      document.getElementById('comments-content').innerHTML = '<div class="alert alert-info">コメント率分析データがありません</div>';
    }
    
    // 命名規則分析
    if (data.analysis.naming) {
      updateNamingTab(data.analysis.naming);
    } else {
      document.getElementById('naming-content').innerHTML = '<div class="alert alert-info">命名規則分析データがありません</div>';
    }
    
    // 重複コード検出
    if (data.analysis.duplication) {
      updateDuplicationTab(data.analysis.duplication);
    } else {
      document.getElementById('duplication-content').innerHTML = '<div class="alert alert-info">重複コード検出データがありません</div>';
    }
  } else {
    // 高度な分析が無効の場合
    const tabs = ['complexity', 'comments', 'naming', 'duplication'];
    tabs.forEach(tab => {
      document.getElementById(`${tab}-content`).innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          高度な分析が無効です。詳細な分析結果を表示するには、高度な分析を有効にしてください。
        </div>
      `;
    });
  }
}

/**
 * サマリータブの更新
 * @param {Object} data 分析結果データ
 */
function updateSummaryTab(data) {
  let summaryHtml = '';
  
  // 基本情報
  summaryHtml += `
    <div class="card mb-3">
      <div class="card-body">
        <h5 class="card-title">基本情報</h5>
        <div class="row">
          <div class="col-md-6">
            <p><strong>言語:</strong> ${data.language || '不明'}</p>
            <p><strong>行数:</strong> ${data.metrics?.lines || 0} 行</p>
          </div>
          <div class="col-md-6">
            <p><strong>文字数:</strong> ${data.metrics?.characters || 0} 文字</p>
            <p><strong>分析日時:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // サマリー情報（高度な分析が有効の場合）
  if (data.summary) {
    const summary = data.summary;
    
    // 品質レベルに応じたスタイル
    let qualityClass = 'info';
    let qualityLabel = '中';
    
    if (summary.overallQuality === 'high') {
      qualityClass = 'success';
      qualityLabel = '高';
    } else if (summary.overallQuality === 'low') {
      qualityClass = 'warning';
      qualityLabel = '低';
    }
    
    summaryHtml += `
      <div class="card mb-3 border-${qualityClass}">
        <div class="card-header bg-${qualityClass} bg-opacity-10">
          <h5 class="card-title mb-0">
            <i class="bi bi-award me-2"></i>
            コード品質: <span class="badge bg-${qualityClass}">${qualityLabel}</span>
          </h5>
        </div>
        <div class="card-body">
    `;
    
    // 長所
    if (summary.strengths && summary.strengths.length > 0) {
      summaryHtml += `
        <h6><i class="bi bi-check-circle me-2 text-success"></i>長所</h6>
        <ul class="mb-3">
      `;
      
      summary.strengths.forEach(strength => {
        summaryHtml += `<li>${strength}</li>`;
      });
      
      summaryHtml += `</ul>`;
    }
    
    // 短所
    if (summary.weaknesses && summary.weaknesses.length > 0) {
      summaryHtml += `
        <h6><i class="bi bi-exclamation-triangle me-2 text-warning"></i>改善点</h6>
        <ul class="mb-3">
      `;
      
      summary.weaknesses.forEach(weakness => {
        summaryHtml += `<li>${weakness}</li>`;
      });
      
      summaryHtml += `</ul>`;
    }
    
    // 推奨事項
    if (summary.recommendations && summary.recommendations.length > 0) {
      summaryHtml += `
        <h6><i class="bi bi-lightbulb me-2 text-primary"></i>推奨事項</h6>
        <ul class="mb-0">
      `;
      
      summary.recommendations.forEach(recommendation => {
        summaryHtml += `<li>${recommendation}</li>`;
      });
      
      summaryHtml += `</ul>`;
    }
    
    summaryHtml += `
        </div>
      </div>
    `;
  } else {
    // 高度な分析が無効の場合
    summaryHtml += `
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle me-2"></i>
        詳細なサマリーを表示するには、高度な分析を有効にしてください。
      </div>
    `;
  }
  
  document.getElementById('summary-content').innerHTML = summaryHtml;
}

/**
 * 複雑度分析タブの更新
 * @param {Object} complexity 複雑度分析データ
 */
function updateComplexityTab(complexity) {
  let html = '';
  
  // 複雑度スコア
  const scoreClass = complexity.level === 'low' ? 'success' : 
                    complexity.level === 'medium' ? 'warning' : 'danger';
  
  html += `
    <div class="card mb-3">
      <div class="card-body">
        <h5 class="card-title">複雑度スコア</h5>
        <div class="progress mb-3" style="height: 25px;">
          <div class="progress-bar bg-${scoreClass}" role="progressbar" 
               style="width: ${Math.min(complexity.score * 10, 100)}%;" 
               aria-valuenow="${complexity.score}" aria-valuemin="0" aria-valuemax="10"
               aria-label="複雑度スコア">
            ${complexity.score.toFixed(1)} / 10
          </div>
        </div>
        <p class="mb-0">
          <span class="badge bg-${scoreClass}">${complexity.level === 'low' ? '低' : complexity.level === 'medium' ? '中' : '高'}</span>
          ${complexity.level === 'low' ? 'コードの複雑度は低く、理解しやすい構造です。' : 
            complexity.level === 'medium' ? 'コードの複雑度は中程度です。一部の関数で改善の余地があります。' : 
            'コードの複雑度が高く、理解や保守が難しい可能性があります。'}
        </p>
      </div>
    </div>
  `;
  
  // 詳細情報
  if (complexity.details && complexity.details.length > 0) {
    html += `
      <div class="card mb-3">
        <div class="card-header">
          <h5 class="card-title mb-0">詳細分析</h5>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>関数/メソッド</th>
                  <th>複雑度</th>
                  <th>評価</th>
                </tr>
              </thead>
              <tbody>
    `;
    
    complexity.details.forEach(detail => {
      const detailClass = detail.complexity < 5 ? 'success' : 
                         detail.complexity < 10 ? 'warning' : 'danger';
      
      html += `
        <tr>
          <td>${detail.name}</td>
          <td>${detail.complexity}</td>
          <td><span class="badge bg-${detailClass}">${detail.complexity < 5 ? '良好' : detail.complexity < 10 ? '注意' : '要改善'}</span></td>
        </tr>
      `;
    });
    
    html += `
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
  
  // 改善提案
  if (complexity.suggestions && complexity.suggestions.length > 0) {
    html += `
      <div class="card">
        <div class="card-header">
          <h5 class="card-title mb-0">改善提案</h5>
        </div>
        <div class="card-body">
          <ul class="mb-0">
    `;
    
    complexity.suggestions.forEach(suggestion => {
      html += `<li>${suggestion}</li>`;
    });
    
    html += `
          </ul>
        </div>
      </div>
    `;
  }
  
  document.getElementById('complexity-content').innerHTML = html;
}

/**
 * 分析エラーの表示
 * @param {string|Object} error エラー情報
 */
function showAnalysisError(error) {
  // 結果コンテナを表示
  document.getElementById('analysis-results-container').style.display = 'block';
  
  // エラーメッセージの作成
  const errorMessage = typeof error === 'string' ? error : 
                      error?.message || 'コード分析中に不明なエラーが発生しました';
  
  // 各タブの内容をエラー表示に更新
  const tabs = ['summary', 'complexity', 'comments', 'naming', 'duplication'];
  
  tabs.forEach(tab => {
    document.getElementById(`${tab}-content`).innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-circle me-2"></i>
        エラー: ${errorMessage}
      </div>
    `;
  });
}
