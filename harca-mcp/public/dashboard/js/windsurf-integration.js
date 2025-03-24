// windsurf-integration.js - Windsurf連携機能
// ダッシュボードのWindsurf連携ページの機能を実装

/**
 * Windsurf連携ステータスの読み込み
 */
function loadWindsurfIntegrationStatus() {
  // ステータス取得中の表示
  document.getElementById('windsurf-status').innerHTML = `
    <div class="d-flex align-items-center">
      <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
        <span class="visually-hidden">読み込み中...</span>
      </div>
      <span>接続状態を確認中...</span>
    </div>
  `;
  
  // 設定情報の取得
  fetch('/api/windsurf/config')
    .then(response => response.json())
    .then(data => {
      updateWindsurfConfig(data);
      checkWindsurfConnection();
    })
    .catch(error => {
      console.error('Windsurf設定の取得に失敗しました:', error);
      document.getElementById('windsurf-status').innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-circle me-2"></i>
          設定情報の取得に失敗しました
        </div>
      `;
    });
}

/**
 * Windsurf設定情報の更新
 * @param {Object} config 設定情報
 */
function updateWindsurfConfig(config) {
  if (!config) {
    return;
  }
  
  // フォームに設定値を反映
  if (config.apiUrl) {
    document.getElementById('windsurf-api-url').value = config.apiUrl;
  }
  
  if (config.port) {
    document.getElementById('windsurf-port').value = config.port;
  }
  
  // 設定状態の表示
  const configStatus = document.getElementById('windsurf-config-status');
  
  if (config.configured) {
    configStatus.innerHTML = `
      <div class="alert alert-success">
        <i class="bi bi-check-circle me-2"></i>
        Windsurf設定が構成されています
      </div>
    `;
  } else {
    configStatus.innerHTML = `
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle me-2"></i>
        Windsurf設定が未構成です
      </div>
    `;
  }
}

/**
 * Windsurf接続の確認
 */
function checkWindsurfConnection() {
  // ステータス表示の更新
  document.getElementById('windsurf-status').innerHTML = `
    <div class="d-flex align-items-center">
      <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
        <span class="visually-hidden">読み込み中...</span>
      </div>
      <span>接続を確認中...</span>
    </div>
  `;
  
  // 接続確認APIの呼び出し
  fetch('/api/windsurf/health')
    .then(response => response.json())
    .then(data => {
      updateWindsurfStatus(data);
      loadAvailableRules();
    })
    .catch(error => {
      console.error('Windsurf接続の確認に失敗しました:', error);
      document.getElementById('windsurf-status').innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-x-circle me-2"></i>
          接続エラー: サーバーに接続できません
        </div>
      `;
      
      // 利用可能なルールの表示をクリア
      document.getElementById('available-rules').innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          接続エラーのため、利用可能なルールを取得できません
        </div>
      `;
    });
}

/**
 * Windsurf接続ステータスの更新
 * @param {Object} data ステータスデータ
 */
function updateWindsurfStatus(data) {
  const statusElement = document.getElementById('windsurf-status');
  
  if (data && data.status === 'ok') {
    statusElement.innerHTML = `
      <div class="alert alert-success">
        <i class="bi bi-check-circle me-2"></i>
        接続成功: Windsurfサーバーに接続されています
      </div>
    `;
    
    // 詳細情報の表示
    if (data.version) {
      document.getElementById('windsurf-details').innerHTML = `
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">接続詳細</h5>
            <div class="row">
              <div class="col-md-6">
                <p><strong>バージョン:</strong> ${data.version}</p>
                <p><strong>接続タイプ:</strong> ${data.connectionType || 'HTTP'}</p>
              </div>
              <div class="col-md-6">
                <p><strong>応答時間:</strong> ${data.responseTime || '0'}ms</p>
                <p><strong>最終確認:</strong> ${new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  } else {
    // エラーメッセージの表示
    const errorMessage = data?.error || '不明なエラー';
    
    statusElement.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-x-circle me-2"></i>
        接続エラー: ${errorMessage}
      </div>
    `;
    
    // 詳細情報のクリア
    document.getElementById('windsurf-details').innerHTML = '';
  }
}

/**
 * 利用可能なルールの読み込み
 */
function loadAvailableRules() {
  // ルール取得中の表示
  document.getElementById('available-rules').innerHTML = `
    <div class="d-flex align-items-center">
      <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
        <span class="visually-hidden">読み込み中...</span>
      </div>
      <span>利用可能なルールを読み込み中...</span>
    </div>
  `;
  
  // ルール取得APIの呼び出し
  fetch('/api/windsurf/rules')
    .then(response => response.json())
    .then(data => {
      updateAvailableRules(data);
    })
    .catch(error => {
      console.error('利用可能なルールの取得に失敗しました:', error);
      document.getElementById('available-rules').innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-circle me-2"></i>
          ルールの取得に失敗しました: ${error.message || '不明なエラー'}
        </div>
      `;
    });
}

/**
 * 利用可能なルールの表示更新
 * @param {Object} data ルールデータ
 */
function updateAvailableRules(data) {
  const rulesElement = document.getElementById('available-rules');
  
  if (data && data.rules && data.rules.length > 0) {
    // ルールテーブルの作成
    let html = `
      <div class="card">
        <div class="card-header">
          <h5 class="card-title mb-0">利用可能なルール (${data.rules.length})</h5>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th>ルール名</th>
                  <th>説明</th>
                  <th>言語</th>
                  <th>カテゴリ</th>
                </tr>
              </thead>
              <tbody>
    `;
    
    // ルール一覧の追加
    data.rules.forEach(rule => {
      const languages = rule.languages && rule.languages.length > 0 ? 
                       rule.languages.join(', ') : 'すべて';
      
      html += `
        <tr>
          <td>${rule.name}</td>
          <td>${rule.description || '-'}</td>
          <td>${languages}</td>
          <td>${rule.category || '-'}</td>
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
    
    rulesElement.innerHTML = html;
  } else {
    // ルールがない場合
    rulesElement.innerHTML = `
      <div class="alert alert-info">
        <i class="bi bi-info-circle me-2"></i>
        利用可能なルールがありません
      </div>
    `;
  }
}

/**
 * Windsurf設定の保存
 */
function saveWindsurfConfig() {
  // フォームからの値の取得
  const apiUrl = document.getElementById('windsurf-api-url').value;
  const port = document.getElementById('windsurf-port').value;
  
  // 入力チェック
  if (!apiUrl) {
    alert('API URLを入力してください');
    return;
  }
  
  // 保存中の表示
  document.getElementById('windsurf-config-status').innerHTML = `
    <div class="d-flex align-items-center">
      <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
        <span class="visually-hidden">保存中...</span>
      </div>
      <span>設定を保存中...</span>
    </div>
  `;
  
  // 設定保存APIの呼び出し
  fetch('/api/windsurf/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiUrl: apiUrl,
      port: port ? parseInt(port, 10) : undefined
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      document.getElementById('windsurf-config-status').innerHTML = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle me-2"></i>
          設定が正常に保存されました
        </div>
      `;
      
      // 接続確認
      setTimeout(() => {
        checkWindsurfConnection();
      }, 1000);
    } else {
      document.getElementById('windsurf-config-status').innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-circle me-2"></i>
          設定の保存に失敗しました: ${data.error || '不明なエラー'}
        </div>
      `;
    }
  })
  .catch(error => {
    console.error('設定の保存に失敗しました:', error);
    document.getElementById('windsurf-config-status').innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-circle me-2"></i>
        設定の保存に失敗しました: ${error.message || '不明なエラー'}
      </div>
    `;
  });
}
