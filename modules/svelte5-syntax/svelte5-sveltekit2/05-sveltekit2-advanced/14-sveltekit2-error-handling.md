# SvelteKit 2 エラーハンドリング

**Document Number**: GUIDE-014-EH  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [エラーハンドリングの概要](#エラーハンドリングの概要)
2. [エラーページ](#エラーページ)
3. [load関数でのエラーハンドリング](#load関数でのエラーハンドリング)
4. [アクションでのエラーハンドリング](#アクションでのエラーハンドリング)
5. [APIエンドポイントでのエラーハンドリング](#apiエンドポイントでのエラーハンドリング)
6. [グローバルエラーハンドリング](#グローバルエラーハンドリング)
7. [エラーの種類](#エラーの種類)

## エラーハンドリングの概要

SvelteKit 2では、アプリケーション内でのエラー処理を簡単に行うための仕組みが用意されています。エラーハンドリングは、以下の方法で実装できます：

- エラーページ（`+error.svelte`）を使用したエラー表示
- `load`関数内でのエラーハンドリング
- フォームアクション内でのエラーハンドリング
- APIエンドポイント内でのエラーハンドリング
- グローバルエラーハンドリング（`hooks.server.js`の`handleError`関数）

## エラーページ

SvelteKitでは、エラーが発生した場合に表示するカスタムエラーページを定義できます。エラーページは、`+error.svelte`ファイルとして定義します。

```svelte
<!-- src/routes/+error.svelte -->
<script>
  import { page } from '$app/stores';
</script>

<div class="error-container">
  <h1>{$page.status}: {$page.error.message}</h1>
  
  {#if $page.status === 404}
    <p>ページが見つかりませんでした。</p>
  {:else if $page.status === 500}
    <p>サーバーエラーが発生しました。</p>
  {:else}
    <p>エラーが発生しました。</p>
  {/if}
  
  <a href="/">ホームに戻る</a>
</div>

<style>
  .error-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
  }
  
  h1 {
    color: #d00;
    font-size: 2rem;
    margin-bottom: 1rem;
  }
  
  a {
    display: inline-block;
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background-color: #333;
    color: white;
    text-decoration: none;
    border-radius: 4px;
  }
  
  a:hover {
    background-color: #555;
  }
</style>
```

エラーページは、ルートレベルだけでなく、特定のルートやレイアウトに対しても定義できます。例えば、`/dashboard`ルート用のエラーページを作成するには、`src/routes/dashboard/+error.svelte`を定義します。

## load関数でのエラーハンドリング

`load`関数内でエラーを処理するには、以下の方法があります：

1. エラーをスローする
2. `error`関数を使用する
3. `redirect`関数を使用する

```javascript
// src/routes/products/[id]/+page.server.js
import { error, redirect } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, fetch }) {
  try {
    // 商品データを取得
    const response = await fetch(`/api/products/${params.id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        // 商品が見つからない場合は404エラー
        throw error(404, '商品が見つかりません');
      } else {
        // その他のエラー
        throw error(response.status, '商品の取得中にエラーが発生しました');
      }
    }
    
    const product = await response.json();
    
    // 商品が非公開で、ユーザーが管理者でない場合はリダイレクト
    if (product.private && !isAdmin()) {
      throw redirect(303, '/products');
    }
    
    return {
      product
    };
  } catch (e) {
    // 既にerror関数でスローされたエラーはそのまま再スロー
    if (e.status) throw e;
    
    // その他の予期しないエラー
    console.error('商品データ取得エラー:', e);
    throw error(500, '予期しないエラーが発生しました');
  }
}
```

## アクションでのエラーハンドリング

フォームアクションでのエラーハンドリングには、`fail`関数を使用します。これにより、フォームの検証エラーなどをクライアントに返すことができます。

```javascript
// src/routes/register/+page.server.js
import { fail } from '@sveltejs/kit';

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const username = data.get('username');
    const email = data.get('email');
    const password = data.get('password');
    
    // バリデーションエラー
    const errors = {};
    
    if (!username || username.length < 3) {
      errors.username = 'ユーザー名は3文字以上である必要があります';
    }
    
    if (!email || !email.includes('@')) {
      errors.email = '有効なメールアドレスを入力してください';
    }
    
    if (!password || password.length < 8) {
      errors.password = 'パスワードは8文字以上である必要があります';
    }
    
    // エラーがある場合
    if (Object.keys(errors).length > 0) {
      return fail(400, {
        errors,
        username,
        email
      });
    }
    
    try {
      // ユーザー登録処理
      // ...
      
      return {
        success: true
      };
    } catch (e) {
      // データベースエラーなどの処理
      console.error('登録エラー:', e);
      
      return fail(500, {
        error: '登録中にエラーが発生しました'
      });
    }
  }
};
```

## APIエンドポイントでのエラーハンドリング

APIエンドポイント（`+server.js`ファイル）でのエラーハンドリングには、適切なステータスコードとエラーメッセージを含むレスポンスを返します。

```javascript
// src/routes/api/users/[id]/+server.js
import { json, error } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, locals }) {
  // 認証チェック
  if (!locals.user) {
    throw error(401, '認証が必要です');
  }
  
  try {
    // ユーザーデータを取得
    const user = await getUserById(params.id);
    
    if (!user) {
      throw error(404, 'ユーザーが見つかりません');
    }
    
    // 権限チェック
    if (user.id !== locals.user.id && locals.user.role !== 'admin') {
      throw error(403, 'アクセス権限がありません');
    }
    
    // ユーザーデータを返す
    return json(user);
  } catch (e) {
    // 既にerror関数でスローされたエラーはそのまま再スロー
    if (e.status) throw e;
    
    // その他の予期しないエラー
    console.error('ユーザーデータ取得エラー:', e);
    throw error(500, '予期しないエラーが発生しました');
  }
}
```

## グローバルエラーハンドリング

アプリケーション全体でのエラーハンドリングには、`hooks.server.js`ファイルの`handleError`関数を使用します。

```javascript
// src/hooks.server.js

/** @type {import('@sveltejs/kit').HandleError} */
export const handleError = async ({ error, event }) => {
  // エラー情報
  const errorId = crypto.randomUUID();
  const errorMessage = error.message || 'Unknown error';
  const errorStack = error.stack || '';
  const errorUrl = event.url.pathname + event.url.search;
  const errorStatus = error.status || 500;
  
  // エラーのログ記録
  console.error(`[${errorId}] Error ${errorStatus}: ${errorMessage}`);
  console.error(`URL: ${errorUrl}`);
  console.error(errorStack);
  
  // 本番環境では、エラー通知サービスにエラーを報告
  if (process.env.NODE_ENV === 'production') {
    try {
      await reportErrorToService({
        id: errorId,
        message: errorMessage,
        stack: errorStack,
        url: errorUrl,
        status: errorStatus,
        user: event.locals.user?.id
      });
    } catch (reportError) {
      console.error('Error reporting failed:', reportError);
    }
  }
  
  // エラー情報を返す（これはクライアントに送信される）
  return {
    id: errorId,
    message: process.env.NODE_ENV === 'production' && errorStatus === 500
      ? 'サーバーエラーが発生しました。サポートにお問い合わせください。'
      : errorMessage
  };
};
```

## エラーの種類

SvelteKitでは、以下のエラー関数が提供されています：

### error

`error`関数は、HTTPエラーをスローするために使用されます。

```javascript
import { error } from '@sveltejs/kit';

// 404エラー
throw error(404, 'ページが見つかりません');

// 500エラー
throw error(500, 'サーバーエラーが発生しました');
```

### redirect

`redirect`関数は、別のページにリダイレクトするために使用されます。

```javascript
import { redirect } from '@sveltejs/kit';

// ログインページにリダイレクト
throw redirect(303, '/login');

// クエリパラメータ付きでリダイレクト
throw redirect(303, `/login?redirect=${encodeURIComponent('/dashboard')}`);
```

### fail

`fail`関数は、フォームアクションでのエラーを返すために使用されます。

```javascript
import { fail } from '@sveltejs/kit';

// バリデーションエラー
return fail(400, {
  errors: {
    username: 'ユーザー名は必須です',
    email: '有効なメールアドレスを入力してください'
  },
  // 入力値を保持
  username: data.get('username'),
  email: data.get('email')
});

// サーバーエラー
return fail(500, {
  error: 'サーバーエラーが発生しました'
});
```

SvelteKitのエラーハンドリング機能を使用することで、ユーザーフレンドリーなエラーメッセージを表示し、アプリケーションの堅牢性を向上させることができます。
