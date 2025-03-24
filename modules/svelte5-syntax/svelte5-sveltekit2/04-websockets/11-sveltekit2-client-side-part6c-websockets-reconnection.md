# SvelteKit 2 Client-Side Features: WebSockets (再接続戦略)

**Document Number**: GUIDE-011F-C7  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [WebSocketの再接続戦略](#websocketの再接続戦略)
2. [基本的な再接続メカニズム](#基本的な再接続メカニズム)
3. [指数バックオフ戦略](#指数バックオフ戦略)
4. [Svelte 5での再接続実装](#svelte-5での再接続実装)
5. [HugMeDo固有の実装](#hugmedo固有の実装)

## WebSocketの再接続戦略

WebSocket接続は、ネットワークの問題、サーバーの再起動、またはその他の理由により切断される可能性があります。このドキュメントでは、SvelteKitアプリケーションでのWebSocketの再接続戦略について説明します。

## 基本的な再接続メカニズム

最も基本的な再接続メカニズムは、接続が切断された場合に一定の遅延後に再接続を試みることです。

```javascript
// src/lib/services/websocket-reconnect.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export const socket = writable(null);
export const connected = writable(false);
export const reconnecting = writable(false);

let ws = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;

/**
 * WebSocket接続を初期化
 * @param {string} url - WebSocketサーバーのURL
 */
export function initWebSocket(url) {
  if (!browser) return null;
  
  // 既存の接続を閉じる
  closeWebSocket();
  
  // 再接続カウンターをリセット
  reconnectAttempts = 0;
  
  // 新しい接続を作成
  connectWebSocket(url);
}

/**
 * WebSocket接続を作成
 * @param {string} url - WebSocketサーバーのURL
 */
function connectWebSocket(url) {
  // 接続中フラグを設定
  reconnecting.set(reconnectAttempts > 0);
  
  // WebSocket接続を作成
  ws = new WebSocket(url);
  
  // イベントハンドラを設定
  ws.onopen = handleOpen;
  ws.onclose = (event) => handleClose(event, url);
  ws.onerror = handleError;
  ws.onmessage = handleMessage;
  
  // ストアを更新
  socket.set(ws);
}

/**
 * 接続が開いたときの処理
 */
function handleOpen() {
  connected.set(true);
  reconnecting.set(false);
  reconnectAttempts = 0;
}

/**
 * 接続が閉じたときの処理
 * @param {CloseEvent} event - WebSocket閉じるイベント
 * @param {string} url - 再接続するURL
 */
function handleClose(event, url) {
  connected.set(false);
  
  // 正常な切断（コード1000）でない場合は再接続を試みる
  if (event.code !== 1000) {
    scheduleReconnect(url);
  }
}

/**
 * エラー発生時の処理
 */
function handleError(error) {
  console.error('WebSocket error:', error);
}

/**
 * メッセージ受信時の処理
 */
function handleMessage(event) {
  // メッセージ処理ロジック
}

/**
 * 再接続をスケジュール
 * @param {string} url - 再接続するURL
 */
function scheduleReconnect(url) {
  // 既存の再接続タイマーをクリア
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  // 再接続を試みる回数を増やす
  reconnectAttempts++;
  
  // 再接続の遅延（ミリ秒）
  const delay = 1000; // 1秒
  
  console.log(`WebSocket再接続を${delay}ミリ秒後に試みます（試行回数: ${reconnectAttempts}）`);
  reconnecting.set(true);
  
  // 再接続タイマーを設定
  reconnectTimeout = setTimeout(() => {
    connectWebSocket(url);
  }, delay);
}

/**
 * WebSocket接続を閉じる
 */
export function closeWebSocket() {
  // 再接続タイマーをクリア
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  if (ws) {
    // イベントリスナーを削除
    ws.onopen = null;
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    
    // 接続が開いている場合は閉じる
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(1000, 'Normal closure');
    }
    
    // 参照を解放
    ws = null;
    socket.set(null);
    connected.set(false);
    reconnecting.set(false);
  }
}
```

## 指数バックオフ戦略

より洗練された再接続戦略として、指数バックオフを使用できます。これにより、再接続の試行間隔が徐々に長くなり、サーバーへの負荷を軽減します。

```javascript
// src/lib/services/websocket-exponential-backoff.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export const socket = writable(null);
export const connected = writable(false);
export const reconnecting = writable(false);
export const reconnectAttempt = writable(0);

let ws = null;
let reconnectTimeout = null;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY = 1000; // 1秒
const MAX_DELAY = 30000; // 30秒

/**
 * WebSocket接続を初期化
 * @param {string} url - WebSocketサーバーのURL
 */
export function initWebSocket(url) {
  if (!browser) return null;
  
  // 既存の接続を閉じる
  closeWebSocket();
  
  // 再接続カウンターをリセット
  reconnectAttempt.set(0);
  
  // 新しい接続を作成
  connectWebSocket(url);
}

/**
 * WebSocket接続を作成
 * @param {string} url - WebSocketサーバーのURL
 */
function connectWebSocket(url) {
  // 接続中フラグを設定
  reconnecting.set(get(reconnectAttempt) > 0);
  
  // WebSocket接続を作成
  ws = new WebSocket(url);
  
  // イベントハンドラを設定
  ws.onopen = handleOpen;
  ws.onclose = (event) => handleClose(event, url);
  ws.onerror = handleError;
  ws.onmessage = handleMessage;
  
  // ストアを更新
  socket.set(ws);
}

/**
 * 接続が開いたときの処理
 */
function handleOpen() {
  connected.set(true);
  reconnecting.set(false);
  reconnectAttempt.set(0);
}

/**
 * 接続が閉じたときの処理
 * @param {CloseEvent} event - WebSocket閉じるイベント
 * @param {string} url - 再接続するURL
 */
function handleClose(event, url) {
  connected.set(false);
  
  // 正常な切断（コード1000）でない場合は再接続を試みる
  if (event.code !== 1000) {
    scheduleReconnect(url);
  }
}

/**
 * エラー発生時の処理
 */
function handleError(error) {
  console.error('WebSocket error:', error);
}

/**
 * メッセージ受信時の処理
 */
function handleMessage(event) {
  // メッセージ処理ロジック
}

/**
 * 再接続をスケジュール（指数バックオフ）
 * @param {string} url - 再接続するURL
 */
function scheduleReconnect(url) {
  // 既存の再接続タイマーをクリア
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  // 再接続を試みる回数を増やす
  reconnectAttempt.update(n => n + 1);
  const attempts = get(reconnectAttempt);
  
  // 最大再接続回数をチェック
  if (attempts > MAX_RECONNECT_ATTEMPTS) {
    console.error(`最大再接続試行回数（${MAX_RECONNECT_ATTEMPTS}）に達しました。再接続を停止します。`);
    reconnecting.set(false);
    return;
  }
  
  // 指数バックオフを使用して遅延を計算
  // 2^n * BASE_DELAY + ランダム要素（ジッター）
  const exponentialDelay = Math.min(
    Math.pow(2, attempts - 1) * BASE_DELAY + Math.random() * 1000,
    MAX_DELAY
  );
  
  console.log(`WebSocket再接続を${Math.round(exponentialDelay)}ミリ秒後に試みます（試行回数: ${attempts}）`);
  reconnecting.set(true);
  
  // 再接続タイマーを設定
  reconnectTimeout = setTimeout(() => {
    connectWebSocket(url);
  }, exponentialDelay);
}

/**
 * WebSocket接続を閉じる
 */
export function closeWebSocket() {
  // 再接続タイマーをクリア
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  if (ws) {
    // イベントリスナーを削除
    ws.onopen = null;
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    
    // 接続が開いている場合は閉じる
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(1000, 'Normal closure');
    }
    
    // 参照を解放
    ws = null;
    socket.set(null);
    connected.set(false);
    reconnecting.set(false);
  }
}

// ストアの値を取得するヘルパー関数
function get(store) {
  let value;
  const unsubscribe = store.subscribe(v => value = v);
  unsubscribe();
  return value;
}
```

## Svelte 5での再接続実装

Svelte 5のRunes APIを使用すると、再接続ロジックをより宣言的に実装できます。

```svelte
<script>
  import { browser } from '$app/environment';
  
  // 設定
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_DELAY = 1000; // 1秒
  const MAX_DELAY = 30000; // 30秒
  
  // 状態
  let ws = $state(null);
  let connected = $state(false);
  let reconnecting = $state(false);
  let reconnectAttempts = $state(0);
  let reconnectTimeout = $state(null);
  let messages = $state([]);
  
  // WebSocketの初期化
  function initWebSocket(url) {
    if (!browser) return;
    
    // 既存の接続を閉じる
    closeWebSocket();
    
    // 再接続カウンターをリセット
    reconnectAttempts = 0;
    
    // 新しい接続を作成
    connectWebSocket(url);
  }
  
  // WebSocket接続を作成
  function connectWebSocket(url) {
    // 接続中フラグを設定
    reconnecting = reconnectAttempts > 0;
    
    // WebSocket接続を作成
    ws = new WebSocket(url);
    
    // イベントハンドラを設定
    ws.onopen = () => {
      connected = true;
      reconnecting = false;
      reconnectAttempts = 0;
    };
    
    ws.onclose = (event) => {
      connected = false;
      
      // 正常な切断（コード1000）でない場合は再接続を試みる
      if (event.code !== 1000) {
        scheduleReconnect(url);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        messages = [...messages, data];
      } catch (err) {
        console.error('メッセージの解析エラー:', err);
      }
    };
  }
  
  // 再接続をスケジュール（指数バックオフ）
  function scheduleReconnect(url) {
    // 既存の再接続タイマーをクリア
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    
    // 再接続を試みる回数を増やす
    reconnectAttempts++;
    
    // 最大再接続回数をチェック
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      console.error(`最大再接続試行回数（${MAX_RECONNECT_ATTEMPTS}）に達しました。再接続を停止します。`);
      reconnecting = false;
      return;
    }
    
    // 指数バックオフを使用して遅延を計算
    const exponentialDelay = Math.min(
      Math.pow(2, reconnectAttempts - 1) * BASE_DELAY + Math.random() * 1000,
      MAX_DELAY
    );
    
    console.log(`WebSocket再接続を${Math.round(exponentialDelay)}ミリ秒後に試みます（試行回数: ${reconnectAttempts}）`);
    reconnecting = true;
    
    // 再接続タイマーを設定
    reconnectTimeout = setTimeout(() => {
      connectWebSocket(url);
    }, exponentialDelay);
  }
  
  // WebSocket接続を閉じる
  function closeWebSocket() {
    // 再接続タイマーをクリア
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (ws) {
      // イベントリスナーを削除
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      
      // 接続が開いている場合は閉じる
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Normal closure');
      }
      
      // 参照を解放
      ws = null;
      connected = false;
      reconnecting = false;
    }
  }
  
  // メッセージを送信
  function sendMessage(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      ws.send(message);
      return true;
    }
    return false;
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

<div class="websocket-status">
  {#if connected}
    <div class="status connected">接続済み</div>
  {:else if reconnecting}
    <div class="status reconnecting">再接続中... (試行回数: {reconnectAttempts})</div>
  {:else}
    <div class="status disconnected">切断</div>
  {/if}
</div>

<style>
  .websocket-status {
    margin-bottom: 1rem;
  }
  
  .status {
    padding: 0.5rem;
    border-radius: 4px;
    display: inline-block;
  }
  
  .connected {
    background-color: #d4edda;
    color: #155724;
  }
  
  .reconnecting {
    background-color: #fff3cd;
    color: #856404;
  }
  
  .disconnected {
    background-color: #f8d7da;
    color: #721c24;
  }
</style>
```

## HugMeDo固有の実装

HugMeDoプロジェクトでは、特にChatモジュールで高度な再接続戦略を実装しています。以下はSocket.IOを使用した再接続実装の例です。

```javascript
// modules/chat/src/lib/services/socket-reconnect.service.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { io } from 'socket.io-client';
import { PUBLIC_CHAT_WS_URL } from '$env/static/public';
import { getAuthToken, refreshToken, isTokenExpired } from '$lib/services/auth.service';

// ストアの作成
export const socket = writable(null);
export const connected = writable(false);
export const reconnecting = writable(false);
export const reconnectAttempt = writable(0);
export const error = writable(null);

// 設定
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

let socketInstance = null;
let manuallyDisconnected = false;

/**
 * Socket.IO接続を初期化
 */
export async function initializeSocket() {
  if (!browser) return null;
  
  // 既存の接続を閉じる
  closeSocket();
  
  // 手動切断フラグをリセット
  manuallyDisconnected = false;
  
  try {
    // トークンが期限切れの場合は更新
    if (isTokenExpired()) {
      await refreshToken();
    }
    
    // 認証トークンを取得
    const token = getAuthToken();
    if (!token) {
      error.set('認証情報がありません');
      return null;
    }
    
    // Socket.IOインスタンスを作成
    socketInstance = io(PUBLIC_CHAT_WS_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionDelayMax: MAX_RECONNECT_DELAY,
      randomizationFactor: 0.5,
      auth: {
        token
      }
    });
    
    // イベントハンドラを設定
    setupEventHandlers();
    
    // ストアを更新
    socket.set(socketInstance);
    
    return socketInstance;
  } catch (err) {
    console.error('Socket初期化エラー:', err);
    error.set(err.message);
    return null;
  }
}

/**
 * Socket.IOイベントハンドラを設定
 */
function setupEventHandlers() {
  if (!socketInstance) return;
  
  // 接続イベント
  socketInstance.on('connect', () => {
    console.log('Socket.IO接続確立');
    connected.set(true);
    reconnecting.set(false);
    reconnectAttempt.set(0);
    error.set(null);
  });
  
  // 切断イベント
  socketInstance.on('disconnect', (reason) => {
    console.log(`Socket.IO切断: ${reason}`);
    connected.set(false);
    
    // 手動切断の場合は再接続しない
    if (manuallyDisconnected) {
      reconnecting.set(false);
      return;
    }
    
    // 再接続が必要な切断理由の場合
    if (
      reason === 'io server disconnect' || 
      reason === 'transport close' || 
      reason === 'ping timeout'
    ) {
      reconnecting.set(true);
    }
  });
  
  // 再接続試行イベント
  socketInstance.on('reconnect_attempt', (attempt) => {
    console.log(`Socket.IO再接続試行: ${attempt}`);
    reconnecting.set(true);
    reconnectAttempt.set(attempt);
  });
  
  // 再接続エラーイベント
  socketInstance.on('reconnect_error', (error) => {
    console.error('Socket.IO再接続エラー:', error);
  });
  
  // 再接続失敗イベント
  socketInstance.on('reconnect_failed', () => {
    console.error('Socket.IO再接続失敗: 最大試行回数に達しました');
    reconnecting.set(false);
    error.set('再接続に失敗しました。ページを更新してください。');
  });
  
  // 接続エラーイベント
  socketInstance.on('connect_error', (err) => {
    console.error('Socket.IO接続エラー:', err);
    error.set(err.message);
    
    // 認証エラーの場合はトークンを更新して再接続
    if (err.message.includes('authentication')) {
      handleAuthError();
    }
  });
  
  // エラーイベント
  socketInstance.on('error', (err) => {
    console.error('Socket.IOエラー:', err);
    error.set(err.message || 'エラーが発生しました');
  });
}

/**
 * 認証エラーを処理
 */
async function handleAuthError() {
  try {
    // トークンを更新
    await refreshToken();
    
    // 接続を再初期化
    await initializeSocket();
  } catch (err) {
    console.error('認証更新エラー:', err);
    error.set('認証に失敗しました。再ログインしてください。');
  }
}

/**
 * Socket.IO接続を閉じる
 */
export function closeSocket() {
  if (socketInstance) {
    // 手動切断フラグを設定
    manuallyDisconnected = true;
    
    // 接続を閉じる
    socketInstance.disconnect();
    
    // 参照を解放
    socketInstance = null;
    socket.set(null);
    connected.set(false);
    reconnecting.set(false);
  }
}

/**
 * 手動で再接続を試みる
 */
export async function manualReconnect() {
  if (socketInstance && !socketInstance.connected) {
    // 既存の接続を閉じる
    closeSocket();
    
    // 新しい接続を初期化
    return initializeSocket();
  }
  
  return socketInstance;
}
```

### 再接続UI

```svelte
<!-- modules/chat/src/lib/components/ConnectionStatus.svelte -->
<script>
  import { 
    connected, 
    reconnecting, 
    reconnectAttempt, 
    error,
    manualReconnect
  } from '$lib/services/socket-reconnect.service';
</script>

<div class="connection-status">
  {#if $connected}
    <div class="status connected">
      <span class="indicator"></span>
      <span class="text">接続済み</span>
    </div>
  {:else if $reconnecting}
    <div class="status reconnecting">
      <span class="indicator"></span>
      <span class="text">再接続中... (試行回数: {$reconnectAttempt})</span>
    </div>
  {:else}
    <div class="status disconnected">
      <span class="indicator"></span>
      <span class="text">切断</span>
      <button class="reconnect-button" on:click={manualReconnect}>
        再接続
      </button>
    </div>
  {/if}
  
  {#if $error}
    <div class="error-message">
      {$error}
    </div>
  {/if}
</div>

<style>
  .connection-status {
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  
  .status {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    border-radius: 4px;
  }
  
  .indicator {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 0.5rem;
  }
  
  .connected {
    background-color: #d4edda;
    color: #155724;
  }
  
  .connected .indicator {
    background-color: #28a745;
  }
  
  .reconnecting {
    background-color: #fff3cd;
    color: #856404;
  }
  
  .reconnecting .indicator {
    background-color: #ffc107;
    animation: blink 1s infinite;
  }
  
  .disconnected {
    background-color: #f8d7da;
    color: #721c24;
  }
  
  .disconnected .indicator {
    background-color: #dc3545;
  }
  
  .reconnect-button {
    margin-left: auto;
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
  }
  
  .reconnect-button:hover {
    background-color: #0069d9;
  }
  
  .error-message {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: #f8d7da;
    color: #721c24;
    border-radius: 4px;
    font-size: 0.8rem;
  }
  
  @keyframes blink {
    0% { opacity: 0.5; }
    50% { opacity: 1; }
    100% { opacity: 0.5; }
  }
</style>
```

これらの再接続戦略を実装することで、ネットワークの問題や一時的なサーバーの障害に対して耐性のあるWebSocketアプリケーションを構築できます。特に、指数バックオフ戦略は、サーバーへの負荷を軽減しながら、接続の復旧を試みるための効果的な方法です。
