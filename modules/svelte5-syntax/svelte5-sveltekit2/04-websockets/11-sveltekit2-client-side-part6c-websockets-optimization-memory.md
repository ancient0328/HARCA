# SvelteKit 2 Client-Side Features: WebSockets (メモリ最適化)

**Document Number**: GUIDE-011F-C6  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [WebSocketのメモリ管理](#websocketのメモリ管理)
2. [メモリリークの防止](#メモリリークの防止)
3. [コンポーネントライフサイクルとの統合](#コンポーネントライフサイクルとの統合)
4. [複数接続の管理](#複数接続の管理)
5. [HugMeDo固有の実装](#hugmedo固有の実装)

## WebSocketのメモリ管理

WebSocketは継続的な接続を維持するため、適切なメモリ管理が不可欠です。このドキュメントでは、SvelteKitアプリケーションでのWebSocketのメモリ最適化テクニックについて説明します。

## メモリリークの防止

WebSocketのメモリリークは、主に以下の原因で発生します：

1. 接続が適切に閉じられない
2. イベントリスナーが削除されない
3. 参照が解放されない

### 接続の適切なクリーンアップ

```javascript
// src/lib/services/websocket.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export const socket = writable(null);
export const connected = writable(false);

let ws = null;

export function initWebSocket(url) {
  if (!browser) return null;
  
  // 既存の接続を閉じる
  closeWebSocket();
  
  // 新しい接続を作成
  ws = new WebSocket(url);
  
  // イベントハンドラを設定
  ws.onopen = () => connected.set(true);
  ws.onclose = () => connected.set(false);
  ws.onerror = handleError;
  
  // ストアを更新
  socket.set(ws);
  
  return ws;
}

export function closeWebSocket() {
  if (ws) {
    // イベントリスナーを削除
    ws.onopen = null;
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    
    // 接続が開いている場合は閉じる
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    
    // 参照を解放
    ws = null;
    socket.set(null);
    connected.set(false);
  }
}

function handleError(error) {
  console.error('WebSocket error:', error);
  connected.set(false);
  
  // エラー後のクリーンアップ
  closeWebSocket();
}
```

### Svelte 5のRunes APIを使用したクリーンアップ

Svelte 5のRunes APIを使用すると、コンポーネントのライフサイクルに合わせて自動的にクリーンアップを行うことができます：

```svelte
<script>
  import { browser } from '$app/environment';
  
  // 状態の定義
  let ws = $state(null);
  let connected = $state(false);
  let messages = $state([]);
  
  // WebSocketの初期化
  function initWebSocket(url) {
    if (!browser) return;
    
    // 既存の接続を閉じる
    closeWebSocket();
    
    // 新しい接続を作成
    ws = new WebSocket(url);
    
    // イベントハンドラを設定
    ws.onopen = () => connected = true;
    ws.onclose = () => connected = false;
    ws.onerror = handleError;
    ws.onmessage = handleMessage;
  }
  
  // WebSocketの終了
  function closeWebSocket() {
    if (ws) {
      // イベントリスナーを削除
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      
      // 接続が開いている場合は閉じる
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      
      // 参照を解放
      ws = null;
      connected = false;
    }
  }
  
  // エラーハンドリング
  function handleError(error) {
    console.error('WebSocket error:', error);
    connected = false;
    
    // エラー後のクリーンアップ
    closeWebSocket();
  }
  
  // メッセージハンドリング
  function handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      messages = [...messages, data];
    } catch (err) {
      console.error('メッセージの解析エラー:', err);
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
```

## コンポーネントライフサイクルとの統合

WebSocket接続をコンポーネントのライフサイクルと適切に統合することで、メモリリークを防ぎ、リソースを効率的に使用できます。

### onMountとonDestroyの使用（Svelte 4以前）

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  
  let ws;
  let connected = false;
  let messages = [];
  
  onMount(() => {
    if (browser) {
      // WebSocket接続を初期化
      ws = new WebSocket('wss://example.com/ws');
      
      // イベントハンドラを設定
      ws.onopen = () => { connected = true; };
      ws.onclose = () => { connected = false; };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          messages = [...messages, data];
        } catch (err) {
          console.error('メッセージの解析エラー:', err);
        }
      };
    }
  });
  
  onDestroy(() => {
    if (ws) {
      // イベントリスナーを削除
      ws.onopen = null;
      ws.onclose = null;
      ws.onmessage = null;
      
      // 接続を閉じる
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
  });
</script>
```

### $effectの使用（Svelte 5）

```svelte
<script>
  import { browser } from '$app/environment';
  
  // 状態の定義
  let ws = $state(null);
  let connected = $state(false);
  let messages = $state([]);
  
  // WebSocketの初期化と破棄を$effectで管理
  $effect(() => {
    if (!browser) return;
    
    // WebSocket接続を初期化
    ws = new WebSocket('wss://example.com/ws');
    
    // イベントハンドラを設定
    ws.onopen = () => { connected = true; };
    ws.onclose = () => { connected = false; };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        messages = [...messages, data];
      } catch (err) {
        console.error('メッセージの解析エラー:', err);
      }
    };
    
    // クリーンアップ関数（コンポーネントのアンマウント時に実行）
    return () => {
      if (ws) {
        // イベントリスナーを削除
        ws.onopen = null;
        ws.onclose = null;
        ws.onmessage = null;
        
        // 接続を閉じる
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
        
        ws = null;
      }
    };
  });
</script>
```

## 複数接続の管理

複数のWebSocket接続を管理する場合、それぞれの接続を適切に追跡し、クリーンアップすることが重要です。

### 接続マネージャの実装

```javascript
// src/lib/services/websocket-manager.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

// 接続を追跡するためのマップ
const connections = new Map();

// 接続状態を追跡するためのストア
export const connectionStatus = writable({});

/**
 * WebSocket接続を作成または取得
 * @param {string} id - 接続の一意の識別子
 * @param {string} url - WebSocketサーバーのURL
 * @returns {WebSocket} - WebSocket接続
 */
export function getConnection(id, url) {
  if (!browser) return null;
  
  // 既存の接続を確認
  if (connections.has(id)) {
    const existingConn = connections.get(id);
    
    // 接続が既に開いているか確認
    if (existingConn.readyState === WebSocket.OPEN) {
      return existingConn;
    }
    
    // 接続が閉じられている場合は削除
    closeConnection(id);
  }
  
  // 新しい接続を作成
  const ws = new WebSocket(url);
  
  // イベントハンドラを設定
  ws.onopen = () => updateStatus(id, 'connected');
  ws.onclose = () => updateStatus(id, 'disconnected');
  ws.onerror = () => updateStatus(id, 'error');
  
  // 接続を保存
  connections.set(id, ws);
  
  // 初期状態を設定
  updateStatus(id, 'connecting');
  
  return ws;
}

/**
 * 特定の接続を閉じる
 * @param {string} id - 接続の識別子
 */
export function closeConnection(id) {
  if (connections.has(id)) {
    const ws = connections.get(id);
    
    // イベントリスナーを削除
    ws.onopen = null;
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    
    // 接続を閉じる
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    
    // マップから削除
    connections.delete(id);
    
    // 状態を更新
    updateStatus(id, 'closed');
  }
}

/**
 * すべての接続を閉じる
 */
export function closeAllConnections() {
  for (const id of connections.keys()) {
    closeConnection(id);
  }
}

/**
 * 接続状態を更新
 * @param {string} id - 接続の識別子
 * @param {string} status - 接続状態
 */
function updateStatus(id, status) {
  connectionStatus.update(statuses => ({
    ...statuses,
    [id]: {
      status,
      timestamp: new Date().toISOString()
    }
  }));
}

/**
 * 接続にメッセージを送信
 * @param {string} id - 接続の識別子
 * @param {any} data - 送信するデータ
 * @returns {boolean} - 送信が成功したかどうか
 */
export function sendMessage(id, data) {
  if (!connections.has(id)) {
    return false;
  }
  
  const ws = connections.get(id);
  
  if (ws.readyState === WebSocket.OPEN) {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    ws.send(message);
    return true;
  }
  
  return false;
}

// ブラウザが閉じられる前にすべての接続をクリーンアップ
if (browser) {
  window.addEventListener('beforeunload', () => {
    closeAllConnections();
  });
}
```

### 複数接続の使用例

```svelte
<script>
  import { onDestroy } from 'svelte';
  import { 
    getConnection, 
    closeConnection, 
    sendMessage,
    connectionStatus 
  } from '$lib/services/websocket-manager';
  
  // 接続IDを定義
  const chatConnectionId = 'chat';
  const notificationConnectionId = 'notifications';
  
  // 接続を初期化
  const chatWs = getConnection(chatConnectionId, 'wss://example.com/chat');
  const notificationWs = getConnection(notificationConnectionId, 'wss://example.com/notifications');
  
  // メッセージハンドラを設定
  chatWs.onmessage = handleChatMessage;
  notificationWs.onmessage = handleNotification;
  
  // チャットメッセージを処理
  function handleChatMessage(event) {
    try {
      const data = JSON.parse(event.data);
      // メッセージを処理
      console.log('チャットメッセージを受信:', data);
    } catch (err) {
      console.error('メッセージの解析エラー:', err);
    }
  }
  
  // 通知を処理
  function handleNotification(event) {
    try {
      const data = JSON.parse(event.data);
      // 通知を処理
      console.log('通知を受信:', data);
    } catch (err) {
      console.error('通知の解析エラー:', err);
    }
  }
  
  // チャットメッセージを送信
  function sendChatMessage(message) {
    sendMessage(chatConnectionId, {
      type: 'chat',
      content: message,
      timestamp: new Date().toISOString()
    });
  }
  
  // コンポーネントのアンマウント時にクリーンアップ
  onDestroy(() => {
    closeConnection(chatConnectionId);
    closeConnection(notificationConnectionId);
  });
</script>

<div class="connections-status">
  <div class="status-item">
    チャット: {$connectionStatus[chatConnectionId]?.status || '未初期化'}
  </div>
  <div class="status-item">
    通知: {$connectionStatus[notificationConnectionId]?.status || '未初期化'}
  </div>
</div>

<div class="chat-interface">
  <!-- チャットインターフェース -->
</div>
```

## HugMeDo固有の実装

HugMeDoプロジェクトでは、特にOHRモジュールとChatモジュールでWebSocketを使用しています。以下は、メモリ使用量を最適化するためのHugMeDo固有の実装例です。

### コネクションプール

```javascript
// modules/chat/src/lib/services/connection-pool.js
import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { io } from 'socket.io-client';
import { PUBLIC_SOCKET_URL } from '$env/static/public';
import { getAuthToken } from '$lib/services/auth.js';

// 接続プール
const connectionPool = new Map();

// 接続状態ストア
export const connectionStates = writable({});

// 接続数ストア
export const connectionCount = derived(
  connectionStates,
  $states => Object.keys($states).length
);

/**
 * 接続を取得または作成
 * @param {string} namespace - Socket.IOの名前空間
 * @param {Object} options - 接続オプション
 * @returns {SocketIOClient.Socket} - Socket.IO接続
 */
export function getConnection(namespace, options = {}) {
  if (!browser) return null;
  
  const key = namespace || 'default';
  
  // 既存の接続を確認
  if (connectionPool.has(key)) {
    const existingConn = connectionPool.get(key);
    
    // 接続が既に確立されているか確認
    if (existingConn.connected) {
      return existingConn;
    }
    
    // 切断された接続は削除
    closeConnection(key);
  }
  
  // 認証トークンを取得
  const token = getAuthToken();
  
  // 接続URLを構築
  const url = namespace 
    ? `${PUBLIC_SOCKET_URL}/${namespace}`
    : PUBLIC_SOCKET_URL;
  
  // デフォルトオプションとマージ
  const connectionOptions = {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: {
      token
    },
    ...options
  };
  
  // 新しい接続を作成
  const socket = io(url, connectionOptions);
  
  // イベントハンドラを設定
  socket.on('connect', () => updateState(key, 'connected'));
  socket.on('disconnect', () => updateState(key, 'disconnected'));
  socket.on('connect_error', (err) => {
    console.error(`接続エラー (${key}):`, err);
    updateState(key, 'error', err.message);
  });
  
  // 接続をプールに追加
  connectionPool.set(key, socket);
  
  // 初期状態を設定
  updateState(key, 'connecting');
  
  // 接続数が多すぎる場合は警告
  if (connectionPool.size > 5) {
    console.warn(`接続プールのサイズが大きくなっています: ${connectionPool.size} 接続`);
  }
  
  return socket;
}

/**
 * 特定の接続を閉じる
 * @param {string} key - 接続キー
 */
export function closeConnection(key) {
  if (connectionPool.has(key)) {
    const socket = connectionPool.get(key);
    
    // すべてのリスナーを削除
    socket.removeAllListeners();
    
    // 接続を閉じる
    socket.disconnect();
    
    // プールから削除
    connectionPool.delete(key);
    
    // 状態を更新
    updateState(key, 'closed');
  }
}

/**
 * すべての接続を閉じる
 */
export function closeAllConnections() {
  for (const key of connectionPool.keys()) {
    closeConnection(key);
  }
}

/**
 * 接続状態を更新
 * @param {string} key - 接続キー
 * @param {string} state - 接続状態
 * @param {string} error - エラーメッセージ（オプション）
 */
function updateState(key, state, error = null) {
  connectionStates.update(states => ({
    ...states,
    [key]: {
      state,
      error,
      timestamp: new Date().toISOString()
    }
  }));
}

// メモリリークを防ぐためのクリーンアップ
if (browser) {
  // ページ離脱時にすべての接続をクリーンアップ
  window.addEventListener('beforeunload', () => {
    closeAllConnections();
  });
  
  // 定期的なメモリ使用量チェック（開発モードのみ）
  if (import.meta.env.DEV) {
    setInterval(() => {
      console.debug(`現在のWebSocket接続数: ${connectionPool.size}`);
      
      // 接続状態をログ出力
      connectionStates.update(states => {
        console.debug('接続状態:', states);
        return states;
      });
    }, 30000); // 30秒ごと
  }
}
```

### メモリ使用量の監視コンポーネント（開発モードのみ）

```svelte
<!-- modules/core/src/lib/components/debug/ConnectionMonitor.svelte -->
<script>
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { connectionStates, connectionCount } from '$lib/services/connection-pool';
  
  // 開発モードでのみ表示
  const isDev = import.meta.env.DEV;
  
  // メモリ使用量
  let memoryUsage = $state(null);
  
  // メモリ使用量を取得
  function updateMemoryUsage() {
    if (browser && window.performance && window.performance.memory) {
      memoryUsage = {
        totalJSHeapSize: formatBytes(window.performance.memory.totalJSHeapSize),
        usedJSHeapSize: formatBytes(window.performance.memory.usedJSHeapSize),
        jsHeapSizeLimit: formatBytes(window.performance.memory.jsHeapSizeLimit)
      };
    }
  }
  
  // バイト数を読みやすい形式に変換
  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // 定期的な更新
  let interval;
  
  onMount(() => {
    if (isDev && browser) {
      // 初回更新
      updateMemoryUsage();
      
      // 定期的な更新
      interval = setInterval(updateMemoryUsage, 5000);
    }
  });
  
  onDestroy(() => {
    if (interval) {
      clearInterval(interval);
    }
  });
</script>

{#if isDev && browser}
  <div class="connection-monitor">
    <h3>WebSocket接続モニター</h3>
    
    <div class="stats">
      <div class="stat-item">
        <span class="label">接続数:</span>
        <span class="value">{$connectionCount}</span>
      </div>
      
      {#if memoryUsage}
        <div class="stat-item">
          <span class="label">使用メモリ:</span>
          <span class="value">{memoryUsage.usedJSHeapSize} / {memoryUsage.jsHeapSizeLimit}</span>
        </div>
      {/if}
    </div>
    
    <div class="connections">
      <h4>接続状態</h4>
      {#each Object.entries($connectionStates) as [key, info]}
        <div class="connection-item">
          <span class="key">{key}:</span>
          <span class="state {info.state}">{info.state}</span>
          {#if info.error}
            <span class="error">{info.error}</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .connection-monitor {
    position: fixed;
    bottom: 10px;
    right: 10px;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-family: monospace;
    font-size: 12px;
    z-index: 9999;
    max-width: 300px;
    max-height: 300px;
    overflow: auto;
  }
  
  h3, h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
  }
  
  .stats {
    margin-bottom: 10px;
  }
  
  .stat-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
  }
  
  .connection-item {
    margin-bottom: 5px;
    display: flex;
    flex-wrap: wrap;
  }
  
  .key {
    margin-right: 5px;
    font-weight: bold;
  }
  
  .state {
    padding: 2px 5px;
    border-radius: 3px;
    margin-right: 5px;
  }
  
  .state.connected {
    background-color: #4caf50;
  }
  
  .state.connecting {
    background-color: #2196f3;
  }
  
  .state.disconnected {
    background-color: #ff9800;
  }
  
  .state.error, .state.closed {
    background-color: #f44336;
  }
  
  .error {
    color: #f44336;
    font-size: 11px;
    width: 100%;
    margin-top: 2px;
  }
</style>
```

これらの実装により、WebSocket接続のメモリ使用量を最適化し、リソースリークを防ぐことができます。特に長時間実行されるアプリケーションや、多くの接続を管理する必要があるアプリケーションでは、これらの最適化が重要です。
