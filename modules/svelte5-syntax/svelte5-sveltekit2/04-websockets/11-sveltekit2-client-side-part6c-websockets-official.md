# SvelteKit 2 Client-Side Features: WebSockets (公式ガイドライン)

**Document Number**: GUIDE-011F-C13  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [WebSocketの基本](#websocketの基本)
2. [SvelteKitでのWebSocket実装](#sveltekit-でのwebsocket実装)
3. [サーバーサイドの実装](#サーバーサイドの実装)
4. [クライアントサイドの実装](#クライアントサイドの実装)
5. [ライフサイクル管理](#ライフサイクル管理)
6. [エラーハンドリング](#エラーハンドリング)
7. [セキュリティ対策](#セキュリティ対策)

## WebSocketの基本

WebSocketは、クライアントとサーバー間の双方向通信を可能にするプロトコルです。HTTP接続を通じて確立され、その後はTCP接続を維持したまま双方向通信を行います。

WebSocketの主な特徴：

- 双方向通信: サーバーからクライアントへのプッシュ通信が可能
- 低レイテンシー: 接続が確立された後は、HTTPリクエスト/レスポンスのオーバーヘッドなしで通信可能
- リアルタイム: チャット、通知、ライブ更新などのリアルタイムアプリケーションに適している

## SvelteKit でのWebSocket実装

SvelteKitは、WebSocketを直接サポートするビルトイン機能を提供していませんが、標準のWebSocket APIやサードパーティのライブラリを使用して実装できます。

SvelteKitでWebSocketを実装する主なアプローチ：

1. **クライアントサイドのみの実装**: ブラウザのネイティブWebSocket APIを使用
2. **サーバーサイドの実装**: Node.jsのWebSocketサーバーを使用（例：ws、Socket.IO）
3. **外部サービスの利用**: Pusher、Firebase、SignalRなどのリアルタイム通信サービスを利用

## サーバーサイドの実装

SvelteKitのサーバーサイドでWebSocketを実装するには、`hooks.server.js`ファイルを使用します。

```javascript
// src/hooks.server.js
import { WebSocketServer } from 'ws';

/** @type {import('@sveltejs/kit').Handle} */
export const handle = async ({ event, resolve }) => {
  // 通常のHTTPリクエストを処理
  return resolve(event);
};

// WebSocketサーバーを初期化
if (typeof process !== 'undefined') {
  const wss = new WebSocketServer({ noServer: true });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket接続が確立されました');
    
    ws.on('message', (message) => {
      console.log('受信したメッセージ:', message.toString());
      // メッセージを処理し、必要に応じて応答
      ws.send(JSON.stringify({ type: 'response', data: 'メッセージを受信しました' }));
    });
    
    ws.on('close', () => {
      console.log('WebSocket接続が閉じられました');
    });
  });
  
  // SvelteKitのサーバーインスタンスを取得し、WebSocketをアタッチ
  const { server } = await import('$app/server');
  
  server.on('upgrade', (request, socket, head) => {
    // WebSocketアップグレードリクエストを処理
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
}
```

## クライアントサイドの実装

Svelte 5のRunes APIを使用したクライアントサイドの実装例：

```svelte
<script>
  import { browser } from '$app/environment';
  
  // 状態
  let ws = $state(null);
  let connected = $state(false);
  let messages = $state([]);
  
  // WebSocket接続を初期化
  function initWebSocket() {
    if (!browser) return;
    
    // 既存の接続を閉じる
    closeWebSocket();
    
    // 新しい接続を作成
    ws = new WebSocket('ws://localhost:3000/ws');
    
    // イベントハンドラを設定
    ws.onopen = () => {
      connected = true;
      console.log('WebSocket接続が確立されました');
    };
    
    ws.onclose = () => {
      connected = false;
      console.log('WebSocket接続が閉じられました');
    };
    
    ws.onerror = (error) => {
      console.error('WebSocketエラー:', error);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        messages = [...messages, data];
      } catch (error) {
        console.error('メッセージ処理エラー:', error);
      }
    };
  }
  
  // メッセージを送信
  function sendMessage(message) {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが接続されていないため、メッセージを送信できません');
      return false;
    }
    
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      return false;
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
  
  // コンポーネントのマウント時に接続
  $effect(() => {
    if (browser) {
      initWebSocket();
      
      // クリーンアップ関数（コンポーネントのアンマウント時に実行）
      return () => {
        closeWebSocket();
      };
    }
  });
</script>

<div class="websocket-chat">
  <div class="status">
    接続状態: {connected ? '接続済み' : '切断'}
  </div>
  
  <div class="messages">
    {#each messages as message}
      <div class="message">
        <div class="message-type">{message.type}</div>
        <div class="message-data">{message.data}</div>
      </div>
    {/each}
  </div>
  
  <div class="controls">
    <button on:click={() => sendMessage({ type: 'ping', data: Date.now() })}>
      Pingを送信
    </button>
    <button on:click={initWebSocket}>
      再接続
    </button>
  </div>
</div>

<style>
  .websocket-chat {
    margin-bottom: 2rem;
  }
  
  .status {
    margin-bottom: 1rem;
  }
  
  .messages {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 1rem;
    margin-bottom: 1rem;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .message {
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    background-color: #f9f9f9;
  }
  
  .message-type {
    font-weight: bold;
    margin-bottom: 0.25rem;
  }
  
  .controls {
    display: flex;
    gap: 0.5rem;
  }
</style>
```

## ライフサイクル管理

WebSocket接続のライフサイクルを適切に管理することは重要です。Svelte 5の`$effect`を使用して、コンポーネントのライフサイクルに合わせてWebSocket接続を管理できます。

```javascript
// コンポーネントのマウント時に接続し、アンマウント時に切断
$effect(() => {
  if (browser) {
    // 接続を初期化
    initWebSocket();
    
    // クリーンアップ関数（コンポーネントのアンマウント時に実行）
    return () => {
      closeWebSocket();
    };
  }
});
```

## エラーハンドリング

WebSocket接続では、さまざまなエラーが発生する可能性があります。適切なエラーハンドリングを実装することが重要です。

```javascript
// エラーハンドリングの実装例
ws.onerror = (error) => {
  console.error('WebSocketエラー:', error);
  
  // エラータイプに応じた処理
  if (ws.readyState === WebSocket.CONNECTING) {
    // 接続エラー
    console.error('WebSocket接続エラー');
  } else if (ws.readyState === WebSocket.OPEN) {
    // 通信エラー
    console.error('WebSocket通信エラー');
  }
  
  // 必要に応じて再接続を試行
  setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      console.log('WebSocket再接続を試行します');
      initWebSocket();
    }
  }, 3000);
};
```

## セキュリティ対策

WebSocketを使用する際は、セキュリティ対策を適切に実装することが重要です。

1. **認証**: WebSocket接続を確立する前に、ユーザーを認証する
2. **暗号化**: WSS（WebSocket Secure）を使用して、通信を暗号化する
3. **入力検証**: クライアントから受信したデータを適切に検証する
4. **レート制限**: 短時間に大量のメッセージを送信する攻撃を防ぐ
5. **CORS**: 適切なCORSポリシーを設定する

```javascript
// サーバーサイドでの認証例
wss.on('connection', (ws, request) => {
  // クッキーからセッションIDを取得
  const cookies = request.headers.cookie;
  const sessionId = parseCookies(cookies)['sessionid'];
  
  // セッションIDを検証
  if (!validateSession(sessionId)) {
    console.error('無効なセッション');
    ws.close(1008, '認証エラー');
    return;
  }
  
  // 認証成功
  console.log('認証されたWebSocket接続');
  
  // 以降の処理...
});
```

```javascript
// クライアントサイドでの認証例
function initWebSocket() {
  if (!browser) return;
  
  // 認証トークンを取得
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    console.error('認証トークンがありません');
    return;
  }
  
  // WebSocket URLにトークンを含める
  ws = new WebSocket(`wss://example.com/ws?token=${token}`);
  
  // イベントハンドラを設定...
}
```

## 注意点

1. **サーバーサイドレンダリング**: SvelteKitのサーバーサイドレンダリング中にWebSocketを初期化しないように注意する（`browser`チェックを使用）
2. **接続の再利用**: 不必要に多くのWebSocket接続を作成しないよう、接続を再利用する
3. **バックプレッシャー**: クライアントやサーバーが処理できる以上のメッセージを送信しないよう注意する
4. **フォールバック**: WebSocketがサポートされていない環境や接続できない場合のフォールバックを実装する

SvelteKitでWebSocketを使用する際は、これらのガイドラインに従って実装することで、効率的で安全なリアルタイム通信を実現できます。
