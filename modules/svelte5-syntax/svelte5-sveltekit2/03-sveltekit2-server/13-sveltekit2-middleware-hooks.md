# SvelteKit 2 ミドルウェアとフック

**Document Number**: GUIDE-013-MH  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [ミドルウェアとフックの概要](#ミドルウェアとフックの概要)
2. [handle関数](#handle関数)
3. [handleFetch関数](#handlefetch関数)
4. [handleError関数](#handleerror関数)
5. [シーケンス関数](#シーケンス関数)
6. [一般的なユースケース](#一般的なユースケース)

## ミドルウェアとフックの概要

SvelteKit 2では、アプリケーションの動作をカスタマイズするためのフック（hooks）を提供しています。これらのフックは、`src/hooks.server.js`（または`.ts`）ファイルで定義され、リクエスト処理のさまざまな段階で実行されます。

主なフック関数：

- `handle`: すべてのリクエストを処理
- `handleFetch`: サーバーサイドでのフェッチリクエストをカスタマイズ
- `handleError`: エラー発生時の処理をカスタマイズ

## handle関数

`handle`関数は、すべてのリクエストを処理するためのミドルウェア関数です。リクエストを変更したり、レスポンスを変更したり、認証やセッション管理などの機能を実装するために使用されます。

```javascript
// src/hooks.server.js
import { sequence } from '@sveltejs/kit/hooks';

/** @type {import('@sveltejs/kit').Handle} */
export const handle = async ({ event, resolve }) => {
  // リクエストの前処理
  const sessionid = event.cookies.get('sessionid');
  
  if (sessionid) {
    // セッションIDからユーザー情報を取得
    const user = await getUserFromSession(sessionid);
    
    if (user) {
      // ユーザー情報をlocalsに設定
      event.locals.user = user;
    }
  }
  
  // レスポンスの解決
  const response = await resolve(event);
  
  // レスポンスの後処理
  response.headers.set('x-powered-by', 'SvelteKit');
  
  return response;
};
```

`handle`関数は、以下のパラメータを受け取ります：

- `event`: リクエストイベント（`cookies`、`request`、`locals`などを含む）
- `resolve`: レスポンスを解決するための関数

`resolve`関数は、以下のオプションを受け取ることができます：

```javascript
const response = await resolve(event, {
  // レンダリングオプション
  transformPageChunk: ({ html, done }) => {
    // HTMLを変換
    return html.replace('%theme%', 'dark');
  },
  
  // フィルタリングオプション
  filterSerializedResponseHeaders: (name) => {
    // シリアライズするレスポンスヘッダーをフィルタリング
    return name.startsWith('x-');
  }
});
```

## handleFetch関数

`handleFetch`関数は、サーバーサイドでのフェッチリクエストをカスタマイズするために使用されます。例えば、認証トークンの追加やプロキシの設定などに利用できます。

```javascript
// src/hooks.server.js

/** @type {import('@sveltejs/kit').HandleFetch} */
export const handleFetch = async ({ request, fetch }) => {
  // 内部APIへのリクエストの場合
  if (request.url.startsWith('https://api.internal.example.com')) {
    // 認証ヘッダーを追加
    request = new Request(
      request.url,
      {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}`
        },
        body: request.body,
        mode: request.mode,
        credentials: request.credentials,
        cache: request.cache,
        redirect: request.redirect,
        referrer: request.referrer,
        integrity: request.integrity
      }
    );
  }
  
  // カスタマイズされたリクエストでフェッチを実行
  return fetch(request);
};
```

`handleFetch`関数は、以下のパラメータを受け取ります：

- `request`: 実行されるフェッチリクエスト
- `fetch`: 元のフェッチ関数
- `event`: リクエストイベント（`cookies`、`request`、`locals`などを含む）

## handleError関数

`handleError`関数は、サーバーサイドでエラーが発生した場合の処理をカスタマイズするために使用されます。エラーのログ記録や通知などに利用できます。

```javascript
// src/hooks.server.js

/** @type {import('@sveltejs/kit').HandleError} */
export const handleError = async ({ error, event }) => {
  // エラー情報
  const errorId = crypto.randomUUID();
  const errorMessage = error.message || 'Unknown error';
  const errorStack = error.stack || '';
  const errorUrl = event.url.pathname + event.url.search;
  
  // エラーのログ記録
  console.error(`[${errorId}] Error: ${errorMessage}`);
  console.error(`URL: ${errorUrl}`);
  console.error(errorStack);
  
  // 外部サービスへのエラー報告（例：Sentry）
  try {
    await reportErrorToExternalService({
      id: errorId,
      message: errorMessage,
      stack: errorStack,
      url: errorUrl,
      user: event.locals.user?.id
    });
  } catch (reportError) {
    console.error('Error reporting failed:', reportError);
  }
  
  // エラー情報を返す（これはクライアントに送信される）
  return {
    id: errorId,
    message: process.env.NODE_ENV === 'production'
      ? 'エラーが発生しました。サポートにお問い合わせください。'
      : errorMessage
  };
};
```

`handleError`関数は、以下のパラメータを受け取ります：

- `error`: 発生したエラー
- `event`: リクエストイベント（`cookies`、`request`、`locals`などを含む）

## シーケンス関数

複数のミドルウェア関数を組み合わせるために、SvelteKitは`sequence`関数を提供しています。これにより、複数の`handle`関数を順番に実行できます。

```javascript
// src/hooks.server.js
import { sequence } from '@sveltejs/kit/hooks';

/** @type {import('@sveltejs/kit').Handle} */
const handleAuth = async ({ event, resolve }) => {
  // 認証処理
  const sessionid = event.cookies.get('sessionid');
  
  if (sessionid) {
    const user = await getUserFromSession(sessionid);
    if (user) {
      event.locals.user = user;
    }
  }
  
  return resolve(event);
};

/** @type {import('@sveltejs/kit').Handle} */
const handleHeaders = async ({ event, resolve }) => {
  // ヘッダー処理
  const response = await resolve(event);
  
  response.headers.set('x-powered-by', 'SvelteKit');
  response.headers.set('x-frame-options', 'SAMEORIGIN');
  
  return response;
};

/** @type {import('@sveltejs/kit').Handle} */
const handleLogging = async ({ event, resolve }) => {
  // リクエストのログ記録
  const start = Date.now();
  const method = event.request.method;
  const url = event.url.pathname;
  
  console.log(`${method} ${url} - Started`);
  
  const response = await resolve(event);
  
  const duration = Date.now() - start;
  const status = response.status;
  
  console.log(`${method} ${url} - ${status} - ${duration}ms`);
  
  return response;
};

// ミドルウェア関数をシーケンスとして組み合わせる
export const handle = sequence(handleAuth, handleLogging, handleHeaders);
```

## 一般的なユースケース

### 認証とセッション管理

```javascript
// src/hooks.server.js

/** @type {import('@sveltejs/kit').Handle} */
export const handle = async ({ event, resolve }) => {
  // セッションIDの取得
  const sessionid = event.cookies.get('sessionid');
  
  if (sessionid) {
    try {
      // セッションIDからユーザー情報を取得
      const user = await getUserFromSession(sessionid);
      
      if (user) {
        // ユーザー情報をlocalsに設定
        event.locals.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          authenticated: true
        };
      } else {
        // 無効なセッションIDの場合、クッキーを削除
        event.cookies.delete('sessionid', { path: '/' });
      }
    } catch (error) {
      console.error('Session verification error:', error);
    }
  }
  
  // 認証が必要なルートへのアクセスを制限
  const requiresAuth = event.url.pathname.startsWith('/dashboard') ||
                       event.url.pathname.startsWith('/account');
  
  if (requiresAuth && !event.locals.user?.authenticated) {
    // 認証が必要なページに未認証でアクセスした場合、ログインページにリダイレクト
    return new Response(null, {
      status: 303,
      headers: {
        location: `/login?redirect=${encodeURIComponent(event.url.pathname)}`
      }
    });
  }
  
  return resolve(event);
};
```

### レスポンスヘッダーの設定

```javascript
// src/hooks.server.js

/** @type {import('@sveltejs/kit').Handle} */
export const handle = async ({ event, resolve }) => {
  // レスポンスの解決
  const response = await resolve(event);
  
  // セキュリティヘッダーの設定
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // 本番環境のみCSPを設定
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'"
    );
  }
  
  return response;
};
```

### 国際化（i18n）

```javascript
// src/hooks.server.js

/** @type {import('@sveltejs/kit').Handle} */
export const handle = async ({ event, resolve }) => {
  // クッキーから言語設定を取得
  let lang = event.cookies.get('lang') || 'ja';
  
  // URLからの言語指定を確認
  const urlLang = event.url.searchParams.get('lang');
  if (urlLang && ['en', 'ja', 'fr', 'de'].includes(urlLang)) {
    lang = urlLang;
    event.cookies.set('lang', lang, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365 // 1年
    });
  }
  
  // localsに言語設定を追加
  event.locals.lang = lang;
  
  // 言語に応じたレスポンスを解決
  return resolve(event, {
    transformPageChunk: ({ html }) => {
      // HTMLのlang属性を設定
      return html.replace('<html', `<html lang="${lang}"`);
    }
  });
};
```

SvelteKitのミドルウェアとフックを使用することで、アプリケーションの動作をカスタマイズし、認証、セッション管理、国際化などの機能を実装できます。
