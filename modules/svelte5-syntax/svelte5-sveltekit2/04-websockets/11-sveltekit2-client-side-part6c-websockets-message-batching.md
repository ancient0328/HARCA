# SvelteKit 2 Client-Side Features: WebSockets (メッセージバッチ処理)

**Document Number**: GUIDE-011F-C9  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [WebSocketのメッセージバッチ処理](#websocketのメッセージバッチ処理)
2. [バッチ処理の利点](#バッチ処理の利点)
3. [基本的なバッチ処理の実装](#基本的なバッチ処理の実装)
4. [Svelte 5でのバッチ処理実装](#svelte-5でのバッチ処理実装)
5. [バッチ処理の最適化](#バッチ処理の最適化)

## WebSocketのメッセージバッチ処理

WebSocketアプリケーションでは、多数の小さなメッセージを頻繁に送信することがあります。これらのメッセージを個別に送信すると、ネットワークオーバーヘッドが増加し、パフォーマンスが低下する可能性があります。メッセージバッチ処理を実装することで、複数のメッセージをグループ化して一度に送信し、効率を向上させることができます。

## バッチ処理の利点

- **ネットワークオーバーヘッドの削減**: 各WebSocketメッセージにはヘッダーが付加されるため、複数のメッセージをバッチ処理することでオーバーヘッドを削減できます。
- **サーバー負荷の軽減**: サーバーは個別のメッセージよりもバッチ処理されたメッセージを処理する方が効率的です。
- **帯域幅の節約**: 特に多数のクライアントが接続している場合、バッチ処理によって全体的な帯域幅使用量を削減できます。
- **クライアントのパフォーマンス向上**: クライアント側でも、多数の小さなメッセージを処理するよりも、少数の大きなメッセージを処理する方が効率的です。

## 基本的なバッチ処理の実装

以下は、基本的なメッセージバッチ処理の実装例です。

```javascript
// src/lib/services/websocket-batcher.js
export class WebSocketBatcher {
  constructor(websocket, options = {}) {
    this.ws = websocket;
    this.batch = [];
    this.flushInterval = options.flushInterval || 100; // デフォルト: 100ms
    this.maxBatchSize = options.maxBatchSize || 50; // デフォルト: 最大50メッセージ
    this.timer = null;
    this.enabled = true;
  }

  /**
   * メッセージをバッチに追加
   * @param {Object|string} message - 送信するメッセージ
   * @returns {boolean} - バッチへの追加が成功したかどうか
   */
  send(message) {
    if (!this.enabled) {
      // バッチ処理が無効の場合は直接送信
      return this.sendImmediate(message);
    }

    // メッセージをバッチに追加
    this.batch.push(message);

    // タイマーが設定されていない場合は設定
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }

    // バッチサイズが最大に達した場合はすぐにフラッシュ
    if (this.batch.length >= this.maxBatchSize) {
      this.flush();
    }

    return true;
  }

  /**
   * メッセージを即座に送信（バッチ処理なし）
   * @param {Object|string} message - 送信するメッセージ
   * @returns {boolean} - 送信が成功したかどうか
   */
  sendImmediate(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      this.ws.send(messageStr);
      return true;
    }
    return false;
  }

  /**
   * バッチをフラッシュ（すべてのメッセージを送信）
   */
  flush() {
    // タイマーをクリア
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // バッチが空の場合は何もしない
    if (this.batch.length === 0) {
      return;
    }

    // WebSocketが接続されていない場合
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが接続されていないため、バッチをフラッシュできません');
      return;
    }

    // バッチ内のメッセージを送信
    const batchData = {
      type: 'batch',
      messages: this.batch
    };

    try {
      this.ws.send(JSON.stringify(batchData));
      console.log(`バッチ内の${this.batch.length}件のメッセージを送信しました`);
    } catch (error) {
      console.error('バッチ送信エラー:', error);
    }

    // バッチをクリア
    this.batch = [];
  }

  /**
   * バッチ処理を有効化
   */
  enable() {
    this.enabled = true;
  }

  /**
   * バッチ処理を無効化（すべてのメッセージが即座に送信される）
   */
  disable() {
    this.enabled = false;
    this.flush(); // 残りのメッセージをフラッシュ
  }

  /**
   * バッチャーを破棄
   */
  dispose() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flush(); // 残りのメッセージをフラッシュ
    this.ws = null;
    this.batch = [];
  }
}
```

## WebSocketサービスとの統合

```javascript
// src/lib/services/websocket-service.js
import { WebSocketBatcher } from './websocket-batcher';

export class WebSocketService {
  constructor(url, options = {}) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.batcher = null;
    this.batchingEnabled = options.batchingEnabled !== false; // デフォルトで有効
    this.batchOptions = {
      flushInterval: options.flushInterval || 100,
      maxBatchSize: options.maxBatchSize || 50
    };
    this.listeners = {
      message: [],
      batch: [],
      open: [],
      close: [],
      error: []
    };
  }

  /**
   * WebSocket接続を初期化
   */
  connect() {
    if (this.ws) {
      this.disconnect();
    }

    this.ws = new WebSocket(this.url);
    this.setupEventListeners();

    // バッチャーを初期化
    if (this.batchingEnabled) {
      this.batcher = new WebSocketBatcher(this.ws, this.batchOptions);
    }
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    this.ws.onopen = (event) => {
      console.log('WebSocket接続が確立されました');
      this.connected = true;
      this.notifyListeners('open', event);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket接続が閉じられました');
      this.connected = false;
      this.notifyListeners('close', event);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocketエラー:', error);
      this.notifyListeners('error', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // バッチメッセージの場合
        if (data.type === 'batch' && Array.isArray(data.messages)) {
          this.notifyListeners('batch', data);
          
          // 個々のメッセージも通知
          data.messages.forEach(message => {
            this.notifyListeners('message', { data: JSON.stringify(message) });
          });
        } else {
          // 通常のメッセージ
          this.notifyListeners('message', event);
        }
      } catch (error) {
        // JSONでない場合は通常のメッセージとして処理
        this.notifyListeners('message', event);
      }
    };
  }

  /**
   * メッセージを送信
   * @param {Object|string} message - 送信するメッセージ
   * @returns {boolean} - 送信が成功したかどうか
   */
  send(message) {
    if (!this.connected) {
      console.warn('WebSocketが接続されていないため、メッセージを送信できません');
      return false;
    }

    // バッチ処理が有効な場合
    if (this.batchingEnabled && this.batcher) {
      return this.batcher.send(message);
    }

    // バッチ処理が無効な場合は直接送信
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    this.ws.send(messageStr);
    return true;
  }

  /**
   * メッセージを即座に送信（バッチ処理なし）
   * @param {Object|string} message - 送信するメッセージ
   * @returns {boolean} - 送信が成功したかどうか
   */
  sendImmediate(message) {
    if (!this.connected) {
      console.warn('WebSocketが接続されていないため、メッセージを送信できません');
      return false;
    }

    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    this.ws.send(messageStr);
    return true;
  }

  /**
   * バッチをフラッシュ
   */
  flushBatch() {
    if (this.batcher) {
      this.batcher.flush();
    }
  }

  /**
   * バッチ処理を有効化
   */
  enableBatching() {
    this.batchingEnabled = true;
    if (!this.batcher && this.ws) {
      this.batcher = new WebSocketBatcher(this.ws, this.batchOptions);
    } else if (this.batcher) {
      this.batcher.enable();
    }
  }

  /**
   * バッチ処理を無効化
   */
  disableBatching() {
    this.batchingEnabled = false;
    if (this.batcher) {
      this.batcher.disable();
    }
  }

  /**
   * WebSocket接続を閉じる
   */
  disconnect() {
    if (this.batcher) {
      this.batcher.dispose();
      this.batcher = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * イベントリスナーを追加
   * @param {string} event - イベント名（message, batch, open, close, error）
   * @param {Function} callback - コールバック関数
   */
  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * イベントリスナーを削除
   * @param {string} event - イベント名（message, batch, open, close, error）
   * @param {Function} callback - 削除するコールバック関数
   */
  removeEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * リスナーに通知
   * @param {string} event - イベント名
   * @param {any} data - イベントデータ
   */
  notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`リスナーの実行中にエラーが発生しました (${event}):`, error);
        }
      });
    }
  }
}
```

## Svelte 5でのバッチ処理実装

Svelte 5のRunes APIを使用すると、メッセージバッチ処理をより宣言的に実装できます。

```svelte
<script>
  import { browser } from '$app/environment';
  
  // 設定
  const FLUSH_INTERVAL = 100; // ミリ秒
  const MAX_BATCH_SIZE = 50;
  
  // 状態
  let ws = $state(null);
  let connected = $state(false);
  let batch = $state([]);
  let batchingEnabled = $state(true);
  let flushTimer = $state(null);
  let receivedMessages = $state([]);
  
  // WebSocket接続を初期化
  function initWebSocket(url) {
    if (!browser) return;
    
    // 既存の接続を閉じる
    closeWebSocket();
    
    // 新しい接続を作成
    ws = new WebSocket(url);
    
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
      try {
        const data = JSON.parse(event.data);
        
        // バッチメッセージの場合
        if (data.type === 'batch' && Array.isArray(data.messages)) {
          // 個々のメッセージを処理
          data.messages.forEach(message => {
            processReceivedMessage(message);
          });
        } else {
          // 通常のメッセージ
          processReceivedMessage(data);
        }
      } catch (error) {
        // JSONでない場合は文字列として処理
        processReceivedMessage(event.data);
      }
    };
  }
  
  // 受信したメッセージを処理
  function processReceivedMessage(message) {
    receivedMessages = [...receivedMessages, {
      message,
      timestamp: Date.now()
    }];
    
    // メッセージ数を制限（最新の100件のみ保持）
    if (receivedMessages.length > 100) {
      receivedMessages = receivedMessages.slice(-100);
    }
  }
  
  // メッセージを送信
  function sendMessage(message) {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが接続されていないため、メッセージを送信できません');
      return false;
    }
    
    if (batchingEnabled) {
      // バッチに追加
      batch = [...batch, message];
      
      // タイマーが設定されていない場合は設定
      if (!flushTimer) {
        flushTimer = setTimeout(() => {
          flushBatch();
          flushTimer = null;
        }, FLUSH_INTERVAL);
      }
      
      // バッチサイズが最大に達した場合はすぐにフラッシュ
      if (batch.length >= MAX_BATCH_SIZE) {
        flushBatch();
      }
      
      return true;
    } else {
      // バッチ処理が無効な場合は直接送信
      return sendImmediateMessage(message);
    }
  }
  
  // メッセージを即座に送信（バッチ処理なし）
  function sendImmediateMessage(message) {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    ws.send(messageStr);
    return true;
  }
  
  // バッチをフラッシュ
  function flushBatch() {
    // タイマーをクリア
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    
    // バッチが空の場合は何もしない
    if (batch.length === 0) {
      return;
    }
    
    // WebSocketが接続されていない場合
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが接続されていないため、バッチをフラッシュできません');
      return;
    }
    
    // バッチ内のメッセージを送信
    const batchData = {
      type: 'batch',
      messages: [...batch]
    };
    
    try {
      ws.send(JSON.stringify(batchData));
      console.log(`バッチ内の${batch.length}件のメッセージを送信しました`);
    } catch (error) {
      console.error('バッチ送信エラー:', error);
    }
    
    // バッチをクリア
    batch = [];
  }
  
  // バッチ処理を有効化
  function enableBatching() {
    batchingEnabled = true;
  }
  
  // バッチ処理を無効化
  function disableBatching() {
    batchingEnabled = false;
    flushBatch(); // 残りのメッセージをフラッシュ
  }
  
  // WebSocket接続を閉じる
  function closeWebSocket() {
    // バッチをフラッシュ
    flushBatch();
    
    // タイマーをクリア
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    
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
  
  // コンポーネントのマウント時に接続
  $effect(() => {
    if (browser) {
      initWebSocket('wss://example.com/ws');
      
      // クリーンアップ関数（コンポーネントのアンマウント時に実行）
      return () => {
        closeWebSocket();
      };
    }
  });
</script>

<div class="websocket-controls">
  <div class="status">
    接続状態: {connected ? '接続済み' : '切断'}
  </div>
  <div class="batch-status">
    バッチ処理: {batchingEnabled ? '有効' : '無効'}
    <button on:click={batchingEnabled ? disableBatching : enableBatching}>
      {batchingEnabled ? '無効化' : '有効化'}
    </button>
  </div>
  <div class="batch-info">
    バッチ内のメッセージ: {batch.length}
    {#if batch.length > 0}
      <button on:click={flushBatch}>今すぐ送信</button>
    {/if}
  </div>
</div>
```

## バッチ処理の最適化

バッチ処理を最適化するためのいくつかの戦略を以下に示します。

### 1. 動的なフラッシュ間隔

アプリケーションの状態に基づいてフラッシュ間隔を動的に調整します。例えば、ユーザーがアクティブに操作している場合は短い間隔で、アイドル状態の場合は長い間隔でフラッシュします。

```javascript
// 動的なフラッシュ間隔
let userActive = true;
const activeInterval = 50; // アクティブ時: 50ms
const idleInterval = 500;  // アイドル時: 500ms

// ユーザーのアクティビティを検出
document.addEventListener('mousemove', () => {
  userActive = true;
  // 5秒後にアイドル状態に戻す
  setTimeout(() => {
    userActive = false;
  }, 5000);
});

// フラッシュ間隔を取得
function getFlushInterval() {
  return userActive ? activeInterval : idleInterval;
}
```

### 2. メッセージの優先順位付け

重要なメッセージは即座に送信し、重要でないメッセージはバッチ処理します。

```javascript
// 優先順位に基づいてメッセージを送信
function sendWithPriority(message, priority = 'normal') {
  if (priority === 'high') {
    // 高優先度メッセージは即座に送信
    return sendImmediateMessage(message);
  } else {
    // 通常または低優先度メッセージはバッチ処理
    return addToBatch(message);
  }
}
```

### 3. メッセージの圧縮

バッチ内のメッセージを送信する前に圧縮することで、帯域幅をさらに節約できます。

```javascript
// メッセージの圧縮（例: pako.jsを使用）
async function compressAndSendBatch(batchData) {
  try {
    const jsonStr = JSON.stringify(batchData);
    const compressed = pako.deflate(jsonStr);
    const blob = new Blob([compressed], { type: 'application/octet-stream' });
    
    // 圧縮データを送信
    ws.send(blob);
    console.log(`圧縮されたバッチを送信しました (元のサイズ: ${jsonStr.length}バイト, 圧縮後: ${compressed.length}バイト)`);
  } catch (error) {
    console.error('バッチ圧縮エラー:', error);
    // 圧縮に失敗した場合は非圧縮で送信
    ws.send(JSON.stringify(batchData));
  }
}
```

### 4. バッチサイズの動的調整

ネットワーク条件に基づいてバッチサイズを動的に調整します。

```javascript
// ネットワーク条件に基づいてバッチサイズを調整
let networkQuality = 'good'; // 'good', 'medium', 'poor'
const batchSizes = {
  good: 50,    // 良好な接続: 最大50メッセージ
  medium: 20,  // 中程度の接続: 最大20メッセージ
  poor: 5      // 貧弱な接続: 最大5メッセージ
};

// ネットワーク品質を評価（簡易版）
function assessNetworkQuality() {
  const latency = getAverageLatency(); // 平均レイテンシーを取得する関数
  
  if (latency < 100) {
    networkQuality = 'good';
  } else if (latency < 300) {
    networkQuality = 'medium';
  } else {
    networkQuality = 'poor';
  }
}

// 現在のバッチサイズを取得
function getCurrentMaxBatchSize() {
  return batchSizes[networkQuality];
}
```

メッセージバッチ処理を実装することで、特に多数の小さなメッセージを送信する必要があるアプリケーションのパフォーマンスを大幅に向上させることができます。
