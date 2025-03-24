# SvelteKit 2 Client-Side Features: WebSockets (パフォーマンスモニタリング - クライアント実装)

**Document Number**: GUIDE-011F-C12-2  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [クライアントサイドモニタリングの基本](#クライアントサイドモニタリングの基本)
2. [Performance APIの活用](#performance-apiの活用)
3. [基本的なモニタリングクラスの実装](#基本的なモニタリングクラスの実装)
4. [Svelte 5でのモニタリング実装](#svelte-5でのモニタリング実装)

## クライアントサイドモニタリングの基本

クライアントサイドでWebSocketのパフォーマンスをモニタリングするには、WebSocketオブジェクトのイベントをフックし、タイミング情報やメッセージ統計を収集します。ブラウザの`Performance API`を活用することで、より正確なタイミング情報を取得できます。

## Performance APIの活用

ブラウザの`Performance API`を使用して、WebSocketの接続時間やメッセージのレイテンシーを測定できます。

```javascript
// Performance APIを使用したタイミング測定
function measureTiming(name, callback) {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  
  // 開始マークを設定
  performance.mark(startMark);
  
  // 処理を実行
  const result = callback();
  
  // 終了マークを設定
  performance.mark(endMark);
  
  // マーク間の測定を作成
  performance.measure(name, startMark, endMark);
  
  // 測定結果を取得
  const measures = performance.getEntriesByName(name);
  const duration = measures[0].duration;
  
  // マークをクリア
  performance.clearMarks(startMark);
  performance.clearMarks(endMark);
  performance.clearMeasures(name);
  
  return {
    result,
    duration
  };
}

// WebSocket接続時間の測定
async function measureWebSocketConnection(url) {
  return new Promise((resolve) => {
    performance.mark('ws-connect-start');
    
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      performance.mark('ws-connect-end');
      performance.measure('ws-connection-time', 'ws-connect-start', 'ws-connect-end');
      
      const measures = performance.getEntriesByName('ws-connection-time');
      const connectionTime = measures[0].duration;
      
      performance.clearMarks('ws-connect-start');
      performance.clearMarks('ws-connect-end');
      performance.clearMeasures('ws-connection-time');
      
      resolve({
        ws,
        connectionTime
      });
    };
    
    ws.onerror = (error) => {
      performance.clearMarks('ws-connect-start');
      resolve({
        error,
        connectionTime: null
      });
    };
  });
}
```

## 基本的なモニタリングクラスの実装

WebSocketのパフォーマンスを監視するための基本的なモニタリングクラスを実装します。

```javascript
// src/lib/services/websocket-monitor.js
export class WebSocketMonitor {
  constructor() {
    this.metrics = {
      // 接続関連のメトリクス
      connections: {
        total: 0,
        successful: 0,
        failed: 0,
        active: 0
      },
      connectionTimes: [],
      reconnections: {
        total: 0,
        successful: 0,
        failed: 0
      },
      
      // メッセージ関連のメトリクス
      messages: {
        sent: {
          total: 0,
          sizes: [],
          totalSize: 0
        },
        received: {
          total: 0,
          sizes: [],
          totalSize: 0
        }
      },
      messageTimes: [], // メッセージのレイテンシー
      
      // エラー関連のメトリクス
      errors: {
        total: 0,
        byType: {}
      }
    };
    
    // 最近のイベント履歴
    this.eventHistory = [];
    this.maxHistorySize = 100;
  }
  
  /**
   * WebSocketオブジェクトにモニタリングを適用
   * @param {WebSocket} ws - モニタリングするWebSocketオブジェクト
   * @param {Object} options - モニタリングオプション
   * @returns {WebSocket} - モニタリングが適用されたWebSocketオブジェクト
   */
  monitorWebSocket(ws, options = {}) {
    const isReconnection = options.isReconnection || false;
    const originalOnOpen = ws.onopen;
    const originalOnClose = ws.onclose;
    const originalOnError = ws.onerror;
    const originalOnMessage = ws.onmessage;
    const originalSend = ws.send;
    
    // 接続開始時間を記録
    const connectionStartTime = performance.now();
    
    // 接続試行をカウント
    this.metrics.connections.total++;
    if (isReconnection) {
      this.metrics.reconnections.total++;
    }
    
    // onopen イベントをフック
    ws.onopen = (event) => {
      const connectionTime = performance.now() - connectionStartTime;
      
      // 接続メトリクスを更新
      this.metrics.connections.successful++;
      this.metrics.connections.active++;
      this.metrics.connectionTimes.push(connectionTime);
      
      if (isReconnection) {
        this.metrics.reconnections.successful++;
      }
      
      // イベント履歴に追加
      this.addToEventHistory({
        type: 'connection',
        success: true,
        time: connectionTime,
        timestamp: Date.now(),
        isReconnection
      });
      
      // 元のハンドラを呼び出す
      if (originalOnOpen) {
        originalOnOpen.call(ws, event);
      }
    };
    
    // onclose イベントをフック
    ws.onclose = (event) => {
      // 接続メトリクスを更新
      this.metrics.connections.active--;
      
      // イベント履歴に追加
      this.addToEventHistory({
        type: 'disconnection',
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        timestamp: Date.now()
      });
      
      // 元のハンドラを呼び出す
      if (originalOnClose) {
        originalOnClose.call(ws, event);
      }
    };
    
    // onerror イベントをフック
    ws.onerror = (error) => {
      // エラーメトリクスを更新
      this.metrics.errors.total++;
      
      const errorType = error.type || 'unknown';
      if (!this.metrics.errors.byType[errorType]) {
        this.metrics.errors.byType[errorType] = 0;
      }
      this.metrics.errors.byType[errorType]++;
      
      // 接続失敗をカウント
      if (ws.readyState === WebSocket.CONNECTING) {
        this.metrics.connections.failed++;
        if (isReconnection) {
          this.metrics.reconnections.failed++;
        }
      }
      
      // イベント履歴に追加
      this.addToEventHistory({
        type: 'error',
        errorType,
        timestamp: Date.now(),
        message: error.message || 'Unknown error'
      });
      
      // 元のハンドラを呼び出す
      if (originalOnError) {
        originalOnError.call(ws, error);
      }
    };
    
    // onmessage イベントをフック
    ws.onmessage = (event) => {
      // メッセージメトリクスを更新
      this.metrics.messages.received.total++;
      
      const messageSize = typeof event.data === 'string' 
        ? event.data.length 
        : (event.data instanceof ArrayBuffer 
          ? event.data.byteLength 
          : event.data.size);
      
      this.metrics.messages.received.sizes.push(messageSize);
      this.metrics.messages.received.totalSize += messageSize;
      
      // イベント履歴に追加（サイズのみ記録し、内容は記録しない）
      this.addToEventHistory({
        type: 'message-received',
        size: messageSize,
        timestamp: Date.now()
      });
      
      // 元のハンドラを呼び出す
      if (originalOnMessage) {
        originalOnMessage.call(ws, event);
      }
    };
    
    // send メソッドをフック
    ws.send = function(data) {
      // メッセージ送信時間を記録
      const sendStartTime = performance.now();
      
      // 元のsendメソッドを呼び出す
      originalSend.call(ws, data);
      
      // メッセージメトリクスを更新
      const messageSize = typeof data === 'string' 
        ? data.length 
        : (data instanceof ArrayBuffer 
          ? data.byteLength 
          : data.size);
      
      this.metrics.messages.sent.total++;
      this.metrics.messages.sent.sizes.push(messageSize);
      this.metrics.messages.sent.totalSize += messageSize;
      
      // イベント履歴に追加（サイズのみ記録し、内容は記録しない）
      this.addToEventHistory({
        type: 'message-sent',
        size: messageSize,
        sendTime: performance.now() - sendStartTime,
        timestamp: Date.now()
      });
    }.bind(this);
    
    return ws;
  }
  
  /**
   * メッセージのレイテンシーを記録
   * @param {string} messageId - メッセージID
   * @param {number} latency - レイテンシー（ミリ秒）
   */
  recordMessageLatency(messageId, latency) {
    this.metrics.messageTimes.push({
      messageId,
      latency,
      timestamp: Date.now()
    });
    
    // 最大100件のレイテンシー記録を保持
    if (this.metrics.messageTimes.length > 100) {
      this.metrics.messageTimes.shift();
    }
  }
  
  /**
   * イベント履歴に追加
   * @param {Object} event - イベント情報
   */
  addToEventHistory(event) {
    this.eventHistory.push(event);
    
    // 最大履歴サイズを超えた場合、古いイベントを削除
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }
  
  /**
   * メトリクスのサマリーを取得
   * @returns {Object} - メトリクスのサマリー
   */
  getMetricsSummary() {
    const connectionTimes = this.metrics.connectionTimes;
    const avgConnectionTime = connectionTimes.length > 0
      ? connectionTimes.reduce((sum, time) => sum + time, 0) / connectionTimes.length
      : 0;
    
    const messageTimes = this.metrics.messageTimes.map(item => item.latency);
    const avgMessageLatency = messageTimes.length > 0
      ? messageTimes.reduce((sum, time) => sum + time, 0) / messageTimes.length
      : 0;
    
    const sentSizes = this.metrics.messages.sent.sizes;
    const avgSentSize = sentSizes.length > 0
      ? sentSizes.reduce((sum, size) => sum + size, 0) / sentSizes.length
      : 0;
    
    const receivedSizes = this.metrics.messages.received.sizes;
    const avgReceivedSize = receivedSizes.length > 0
      ? receivedSizes.reduce((sum, size) => sum + size, 0) / receivedSizes.length
      : 0;
    
    return {
      connections: {
        total: this.metrics.connections.total,
        successful: this.metrics.connections.successful,
        failed: this.metrics.connections.failed,
        active: this.metrics.connections.active,
        successRate: this.metrics.connections.total > 0
          ? (this.metrics.connections.successful / this.metrics.connections.total) * 100
          : 0
      },
      reconnections: {
        total: this.metrics.reconnections.total,
        successful: this.metrics.reconnections.successful,
        failed: this.metrics.reconnections.failed,
        successRate: this.metrics.reconnections.total > 0
          ? (this.metrics.reconnections.successful / this.metrics.reconnections.total) * 100
          : 0
      },
      connectionTime: {
        average: avgConnectionTime,
        min: Math.min(...connectionTimes) || 0,
        max: Math.max(...connectionTimes) || 0
      },
      messages: {
        sent: {
          total: this.metrics.messages.sent.total,
          totalSize: this.metrics.messages.sent.totalSize,
          averageSize: avgSentSize
        },
        received: {
          total: this.metrics.messages.received.total,
          totalSize: this.metrics.messages.received.totalSize,
          averageSize: avgReceivedSize
        }
      },
      messageLatency: {
        average: avgMessageLatency,
        min: Math.min(...messageTimes) || 0,
        max: Math.max(...messageTimes) || 0
      },
      errors: {
        total: this.metrics.errors.total,
        byType: this.metrics.errors.byType
      },
      timestamp: Date.now()
    };
  }
  
  /**
   * メトリクスをリセット
   */
  resetMetrics() {
    this.metrics = {
      connections: {
        total: 0,
        successful: 0,
        failed: 0,
        active: this.metrics.connections.active // アクティブな接続数は維持
      },
      connectionTimes: [],
      reconnections: {
        total: 0,
        successful: 0,
        failed: 0
      },
      messages: {
        sent: {
          total: 0,
          sizes: [],
          totalSize: 0
        },
        received: {
          total: 0,
          sizes: [],
          totalSize: 0
        }
      },
      messageTimes: [],
      errors: {
        total: 0,
        byType: {}
      }
    };
    
    this.eventHistory = [];
  }
}
```

## Svelte 5でのモニタリング実装

Svelte 5のRunes APIを使用して、WebSocketモニタリングを実装します。

```svelte
<script>
  import { browser } from '$app/environment';
  import { WebSocketMonitor } from '$lib/services/websocket-monitor';
  
  // 状態
  let ws = $state(null);
  let connected = $state(false);
  let monitor = $state(new WebSocketMonitor());
  let metrics = $state({});
  let showMetrics = $state(false);
  let updateInterval = $state(null);
  
  // WebSocket接続を初期化
  function initWebSocket(url) {
    if (!browser) return;
    
    // 既存の接続を閉じる
    closeWebSocket();
    
    // 新しい接続を作成
    const newWs = new WebSocket(url);
    
    // モニタリングを適用
    ws = monitor.monitorWebSocket(newWs);
    
    // イベントハンドラを設定
    ws.onopen = () => {
      connected = true;
    };
    
    ws.onclose = () => {
      connected = false;
    };
    
    ws.onerror = (error) => {
      console.error('WebSocketエラー:', error);
    };
    
    ws.onmessage = (event) => {
      // メッセージを処理
      processMessage(event.data);
    };
  }
  
  // メッセージを処理
  function processMessage(data) {
    try {
      // JSONメッセージの場合
      if (typeof data === 'string') {
        const jsonData = JSON.parse(data);
        
        // メッセージにIDが含まれている場合、レイテンシーを記録
        if (jsonData.id && jsonData.timestamp) {
          const latency = Date.now() - jsonData.timestamp;
          monitor.recordMessageLatency(jsonData.id, latency);
        }
      }
    } catch (error) {
      // JSONでない場合は無視
    }
  }
  
  // メッセージを送信
  function sendMessage(message) {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが接続されていないため、メッセージを送信できません');
      return false;
    }
    
    try {
      // メッセージにIDとタイムスタンプを追加
      const messageWithMeta = {
        ...message,
        id: generateMessageId(),
        timestamp: Date.now()
      };
      
      // メッセージを送信
      ws.send(JSON.stringify(messageWithMeta));
      return true;
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      return false;
    }
  }
  
  // メッセージIDを生成
  function generateMessageId() {
    return `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  
  // メトリクスを更新
  function updateMetrics() {
    metrics = monitor.getMetricsSummary();
  }
  
  // WebSocket接続を閉じる
  function closeWebSocket() {
    if (ws) {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      
      ws = null;
      connected = false;
    }
  }
  
  // メトリクス表示を切り替え
  function toggleMetrics() {
    showMetrics = !showMetrics;
  }
  
  // コンポーネントのマウント時に接続
  $effect(() => {
    if (browser) {
      initWebSocket('wss://example.com/ws');
      
      // 定期的にメトリクスを更新
      updateInterval = setInterval(() => {
        updateMetrics();
      }, 5000);
      
      // クリーンアップ関数（コンポーネントのアンマウント時に実行）
      return () => {
        closeWebSocket();
        
        if (updateInterval) {
          clearInterval(updateInterval);
          updateInterval = null;
        }
      };
    }
  });
</script>

<div class="websocket-monitor">
  <div class="controls">
    <div class="status">
      接続状態: {connected ? '接続済み' : '切断'}
    </div>
    <button on:click={toggleMetrics}>
      {showMetrics ? 'メトリクスを隠す' : 'メトリクスを表示'}
    </button>
    <button on:click={updateMetrics}>
      メトリクスを更新
    </button>
  </div>
  
  {#if showMetrics}
    <div class="metrics">
      <h3>WebSocketパフォーマンスメトリクス</h3>
      
      <div class="metric-section">
        <h4>接続</h4>
        <div class="metric-grid">
          <div class="metric-item">
            <div class="metric-label">総接続試行数:</div>
            <div class="metric-value">{metrics.connections?.total || 0}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">成功した接続:</div>
            <div class="metric-value">{metrics.connections?.successful || 0}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">失敗した接続:</div>
            <div class="metric-value">{metrics.connections?.failed || 0}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">アクティブな接続:</div>
            <div class="metric-value">{metrics.connections?.active || 0}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">接続成功率:</div>
            <div class="metric-value">{(metrics.connections?.successRate || 0).toFixed(2)}%</div>
          </div>
        </div>
      </div>
      
      <div class="metric-section">
        <h4>接続時間</h4>
        <div class="metric-grid">
          <div class="metric-item">
            <div class="metric-label">平均接続時間:</div>
            <div class="metric-value">{(metrics.connectionTime?.average || 0).toFixed(2)} ms</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">最小接続時間:</div>
            <div class="metric-value">{(metrics.connectionTime?.min || 0).toFixed(2)} ms</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">最大接続時間:</div>
            <div class="metric-value">{(metrics.connectionTime?.max || 0).toFixed(2)} ms</div>
          </div>
        </div>
      </div>
      
      <div class="metric-section">
        <h4>メッセージ</h4>
        <div class="metric-grid">
          <div class="metric-item">
            <div class="metric-label">送信メッセージ数:</div>
            <div class="metric-value">{metrics.messages?.sent?.total || 0}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">送信データ量:</div>
            <div class="metric-value">{formatBytes(metrics.messages?.sent?.totalSize || 0)}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">平均メッセージサイズ:</div>
            <div class="metric-value">{formatBytes(metrics.messages?.sent?.averageSize || 0)}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">受信メッセージ数:</div>
            <div class="metric-value">{metrics.messages?.received?.total || 0}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">受信データ量:</div>
            <div class="metric-value">{formatBytes(metrics.messages?.received?.totalSize || 0)}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">平均メッセージサイズ:</div>
            <div class="metric-value">{formatBytes(metrics.messages?.received?.averageSize || 0)}</div>
          </div>
        </div>
      </div>
      
      <div class="metric-section">
        <h4>メッセージレイテンシー</h4>
        <div class="metric-grid">
          <div class="metric-item">
            <div class="metric-label">平均レイテンシー:</div>
            <div class="metric-value">{(metrics.messageLatency?.average || 0).toFixed(2)} ms</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">最小レイテンシー:</div>
            <div class="metric-value">{(metrics.messageLatency?.min || 0).toFixed(2)} ms</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">最大レイテンシー:</div>
            <div class="metric-value">{(metrics.messageLatency?.max || 0).toFixed(2)} ms</div>
          </div>
        </div>
      </div>
      
      <div class="metric-section">
        <h4>エラー</h4>
        <div class="metric-grid">
          <div class="metric-item">
            <div class="metric-label">総エラー数:</div>
            <div class="metric-value">{metrics.errors?.total || 0}</div>
          </div>
        </div>
        {#if metrics.errors?.byType && Object.keys(metrics.errors.byType).length > 0}
          <div class="error-types">
            <h5>エラータイプ別</h5>
            <ul>
              {#each Object.entries(metrics.errors.byType) as [type, count]}
                <li>{type}: {count}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
      
      <div class="metric-footer">
        最終更新: {new Date(metrics.timestamp || Date.now()).toLocaleString()}
      </div>
    </div>
  {/if}
</div>

<script context="module">
  // バイト数をフォーマット
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
</script>

<style>
  .websocket-monitor {
    margin-bottom: 2rem;
  }
  
  .controls {
    margin-bottom: 1rem;
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  
  .metrics {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 1rem;
    background-color: #f9f9f9;
  }
  
  .metric-section {
    margin-bottom: 1.5rem;
  }
  
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .metric-item {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    border: 1px solid #eee;
    border-radius: 4px;
    background-color: white;
  }
  
  .metric-label {
    font-size: 0.8rem;
    color: #666;
  }
  
  .metric-value {
    font-size: 1.2rem;
    font-weight: bold;
  }
  
  .error-types {
    margin-top: 0.5rem;
  }
  
  .metric-footer {
    font-size: 0.8rem;
    color: #666;
    text-align: right;
    margin-top: 1rem;
  }
</style>
```

このクライアントサイドモニタリング実装により、WebSocketの接続状態やパフォーマンスをリアルタイムで監視できます。次のドキュメントでは、サーバーサイドのモニタリング実装について説明します。
