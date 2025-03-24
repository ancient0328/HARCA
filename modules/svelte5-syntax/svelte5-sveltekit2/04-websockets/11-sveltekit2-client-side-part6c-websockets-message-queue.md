# SvelteKit 2 Client-Side Features: WebSockets (メッセージキュー)

**Document Number**: GUIDE-011F-C8  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [WebSocketのメッセージキュー](#websocketのメッセージキュー)
2. [基本的なメッセージキューの実装](#基本的なメッセージキューの実装)
3. [Svelte 5でのメッセージキュー実装](#svelte-5でのメッセージキュー実装)
4. [メッセージの優先順位付け](#メッセージの優先順位付け)

## WebSocketのメッセージキュー

WebSocket接続が切断された場合、クライアントが送信しようとしたメッセージは失われてしまいます。メッセージキューを実装することで、接続が回復したときにこれらのメッセージを再送信できます。

## 基本的なメッセージキューの実装

以下は、基本的なメッセージキューの実装例です。

```javascript
// src/lib/services/websocket-queue.js
export class WebSocketQueue {
  constructor() {
    this.queue = [];
    this.maxQueueSize = 100; // キューの最大サイズ
  }

  /**
   * メッセージをキューに追加
   * @param {Object|string} message - 送信するメッセージ
   * @returns {boolean} - キューへの追加が成功したかどうか
   */
  enqueue(message) {
    // キューが最大サイズに達している場合
    if (this.queue.length >= this.maxQueueSize) {
      console.warn(`メッセージキューが最大サイズ(${this.maxQueueSize})に達しました。古いメッセージを削除します。`);
      this.queue.shift(); // 最も古いメッセージを削除
    }

    // メッセージをキューに追加
    this.queue.push({
      message,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * キューからメッセージを取得して削除
   * @returns {Object|null} - キューの先頭のメッセージ、またはキューが空の場合はnull
   */
  dequeue() {
    if (this.queue.length === 0) {
      return null;
    }
    return this.queue.shift();
  }

  /**
   * キューの先頭を覗く（削除せずに取得）
   * @returns {Object|null} - キューの先頭のメッセージ、またはキューが空の場合はnull
   */
  peek() {
    if (this.queue.length === 0) {
      return null;
    }
    return this.queue[0];
  }

  /**
   * キューが空かどうかを確認
   * @returns {boolean} - キューが空の場合はtrue
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * キューのサイズを取得
   * @returns {number} - キュー内のメッセージ数
   */
  size() {
    return this.queue.length;
  }

  /**
   * キューをクリア
   */
  clear() {
    this.queue = [];
  }

  /**
   * 古いメッセージを削除
   * @param {number} maxAgeMs - メッセージの最大経過時間（ミリ秒）
   */
  removeOldMessages(maxAgeMs) {
    const now = Date.now();
    this.queue = this.queue.filter(item => (now - item.timestamp) <= maxAgeMs);
  }
}
```

## WebSocketサービスとの統合

```javascript
// src/lib/services/websocket-service.js
import { WebSocketQueue } from './websocket-queue';

export class WebSocketService {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.messageQueue = new WebSocketQueue();
    this.listeners = {
      message: [],
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
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    this.ws.onopen = (event) => {
      console.log('WebSocket接続が確立されました');
      this.connected = true;
      this.processQueue(); // 接続が確立されたらキューを処理
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
      this.notifyListeners('message', event);
    };
  }

  /**
   * メッセージを送信
   * @param {Object|string} message - 送信するメッセージ
   * @returns {boolean} - 送信が成功したかどうか
   */
  send(message) {
    if (this.connected && this.ws.readyState === WebSocket.OPEN) {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      this.ws.send(messageStr);
      return true;
    } else {
      // 接続が確立されていない場合はキューに追加
      console.log('WebSocket接続が確立されていないため、メッセージをキューに追加します');
      this.messageQueue.enqueue(message);
      return false;
    }
  }

  /**
   * キューに溜まったメッセージを処理
   */
  processQueue() {
    console.log(`キュー内のメッセージを処理します (${this.messageQueue.size()}件)`);
    while (!this.messageQueue.isEmpty()) {
      const item = this.messageQueue.dequeue();
      if (item) {
        this.send(item.message);
      }
    }
  }

  /**
   * WebSocket接続を閉じる
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * イベントリスナーを追加
   * @param {string} event - イベント名（message, open, close, error）
   * @param {Function} callback - コールバック関数
   */
  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * イベントリスナーを削除
   * @param {string} event - イベント名（message, open, close, error）
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

## Svelte 5でのメッセージキュー実装

Svelte 5のRunes APIを使用すると、メッセージキューをより宣言的に実装できます。

```svelte
<script>
  import { browser } from '$app/environment';
  
  // メッセージキューの状態
  let messageQueue = $state([]);
  let maxQueueSize = $state(100);
  let ws = $state(null);
  let connected = $state(false);
  
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
      processQueue(); // 接続が確立されたらキューを処理
    };
    
    ws.onclose = () => {
      connected = false;
    };
    
    ws.onerror = (error) => {
      console.error('WebSocketエラー:', error);
    };
    
    ws.onmessage = (event) => {
      // メッセージ処理ロジック
    };
  }
  
  // メッセージをキューに追加
  function enqueueMessage(message) {
    // キューが最大サイズに達している場合
    if (messageQueue.length >= maxQueueSize) {
      // 最も古いメッセージを削除
      messageQueue = messageQueue.slice(1);
    }
    
    // メッセージをキューに追加
    messageQueue = [...messageQueue, {
      message,
      timestamp: Date.now()
    }];
  }
  
  // メッセージを送信
  function sendMessage(message) {
    if (connected && ws && ws.readyState === WebSocket.OPEN) {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      ws.send(messageStr);
      return true;
    } else {
      // 接続が確立されていない場合はキューに追加
      enqueueMessage(message);
      return false;
    }
  }
  
  // キューに溜まったメッセージを処理
  function processQueue() {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    console.log(`キュー内のメッセージを処理します (${messageQueue.length}件)`);
    
    // キューを処理
    const queueCopy = [...messageQueue];
    messageQueue = [];
    
    for (const item of queueCopy) {
      sendMessage(item.message);
    }
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
  
  // キューをクリア
  function clearQueue() {
    messageQueue = [];
  }
  
  // 古いメッセージを削除
  function removeOldMessages(maxAgeMs) {
    const now = Date.now();
    messageQueue = messageQueue.filter(item => (now - item.timestamp) <= maxAgeMs);
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
  
  // 接続状態が変わったときにキューを処理
  $effect(() => {
    if (connected) {
      processQueue();
    }
  });
</script>

<div class="websocket-status">
  <div>接続状態: {connected ? '接続済み' : '切断'}</div>
  <div>キュー内のメッセージ: {messageQueue.length}</div>
</div>
```

## メッセージの優先順位付け

一部のメッセージは他のメッセージよりも重要である場合があります。優先順位付けを実装することで、接続が回復したときに重要なメッセージを先に送信できます。

```javascript
// 優先順位付きメッセージキュー
export class PriorityWebSocketQueue {
  constructor() {
    // 優先順位ごとのキュー
    this.queues = {
      high: [],    // 高優先度
      normal: [],  // 通常優先度
      low: []      // 低優先度
    };
    this.maxQueueSize = 100; // 各優先度キューの最大サイズ
  }

  /**
   * メッセージをキューに追加
   * @param {Object|string} message - 送信するメッセージ
   * @param {string} priority - 優先度 ('high', 'normal', 'low')
   * @returns {boolean} - キューへの追加が成功したかどうか
   */
  enqueue(message, priority = 'normal') {
    if (!this.queues[priority]) {
      priority = 'normal';
    }

    const queue = this.queues[priority];

    // キューが最大サイズに達している場合
    if (queue.length >= this.maxQueueSize) {
      console.warn(`${priority}優先度のキューが最大サイズ(${this.maxQueueSize})に達しました。古いメッセージを削除します。`);
      queue.shift(); // 最も古いメッセージを削除
    }

    // メッセージをキューに追加
    queue.push({
      message,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * 優先度順にキューからメッセージを取得して削除
   * @returns {Object|null} - 最も優先度の高いキューの先頭のメッセージ、またはすべてのキューが空の場合はnull
   */
  dequeue() {
    // 優先度順にキューをチェック
    for (const priority of ['high', 'normal', 'low']) {
      const queue = this.queues[priority];
      if (queue.length > 0) {
        return queue.shift();
      }
    }
    return null;
  }

  /**
   * すべてのキューが空かどうかを確認
   * @returns {boolean} - すべてのキューが空の場合はtrue
   */
  isEmpty() {
    return this.size() === 0;
  }

  /**
   * すべてのキュー内のメッセージ数を取得
   * @returns {number} - すべてのキュー内のメッセージ数
   */
  size() {
    return this.queues.high.length + this.queues.normal.length + this.queues.low.length;
  }

  /**
   * 特定の優先度のキューのサイズを取得
   * @param {string} priority - 優先度 ('high', 'normal', 'low')
   * @returns {number} - 指定された優先度のキュー内のメッセージ数
   */
  sizeByPriority(priority) {
    return this.queues[priority] ? this.queues[priority].length : 0;
  }

  /**
   * すべてのキューをクリア
   */
  clear() {
    this.queues.high = [];
    this.queues.normal = [];
    this.queues.low = [];
  }

  /**
   * 古いメッセージを削除
   * @param {number} maxAgeMs - メッセージの最大経過時間（ミリ秒）
   */
  removeOldMessages(maxAgeMs) {
    const now = Date.now();
    for (const priority in this.queues) {
      this.queues[priority] = this.queues[priority].filter(
        item => (now - item.timestamp) <= maxAgeMs
      );
    }
  }
}
```

メッセージキューを実装することで、ネットワークの問題や一時的な接続切断が発生した場合でも、メッセージの損失を防ぎ、ユーザーエクスペリエンスを向上させることができます。
