# SvelteKit 2 フォームアクション

**Document Number**: GUIDE-012-FA  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [フォームアクションの概要](#フォームアクションの概要)
2. [基本的な使用方法](#基本的な使用方法)
3. [アクションの結果の使用](#アクションの結果の使用)
4. [複数のアクション](#複数のアクション)
5. [プログレッシブエンハンスメント](#プログレッシブエンハンスメント)
6. [バリデーション](#バリデーション)
7. [ファイルアップロード](#ファイルアップロード)

## フォームアクションの概要

SvelteKit 2のフォームアクションは、HTMLフォームの送信を処理するためのサーバーサイド関数です。これにより、JavaScriptを使用せずにフォームデータを送信し、サーバー上で処理することができます。

フォームアクションは、以下の特徴を持っています：

- サーバーサイドで実行される
- プログレッシブエンハンスメントをサポート（JavaScriptなしでも動作）
- フォームデータの検証と処理
- クライアントサイドへの結果の返送

## 基本的な使用方法

フォームアクションは、`+page.server.js`または`+server.js`ファイル内で定義します。

```javascript
// src/routes/login/+page.server.js
import { fail } from '@sveltejs/kit';

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, cookies, locals }) => {
    const data = await request.formData();
    const username = data.get('username');
    const password = data.get('password');
    
    // 入力値の検証
    if (!username || !password) {
      return fail(400, {
        error: true,
        message: 'ユーザー名とパスワードを入力してください',
        username
      });
    }
    
    try {
      // 認証ロジック（例）
      const user = await authenticate(username, password);
      
      // セッションの設定
      cookies.set('sessionid', user.sessionid, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7 // 1週間
      });
      
      // ユーザー情報をlocalsに設定
      locals.user = user;
      
      // 成功時のレスポンス
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username
        }
      };
    } catch (error) {
      // 認証エラー
      return fail(401, {
        error: true,
        message: 'ユーザー名またはパスワードが正しくありません',
        username
      });
    }
  }
};
```

対応するSvelteコンポーネント：

```svelte
<!-- src/routes/login/+page.svelte -->
<script>
  /** @type {import('./$types').PageData} */
  export let data;
  
  /** @type {import('./$types').ActionData} */
  export let form;
</script>

<h1>ログイン</h1>

{#if form?.error}
  <div class="error">
    {form.message}
  </div>
{/if}

{#if form?.success}
  <div class="success">
    ログインに成功しました！
  </div>
{/if}

<form method="POST">
  <div>
    <label for="username">ユーザー名</label>
    <input
      id="username"
      name="username"
      type="text"
      value={form?.username || ''}
      required
    />
  </div>
  
  <div>
    <label for="password">パスワード</label>
    <input
      id="password"
      name="password"
      type="password"
      required
    />
  </div>
  
  <button type="submit">ログイン</button>
</form>
```

## アクションの結果の使用

フォームアクションの結果は、対応するページコンポーネントの`form`プロップとして利用できます。

```svelte
<script>
  /** @type {import('./$types').ActionData} */
  export let form;
  
  // formの値を使用して条件付きレンダリングやフィードバックを表示
  $effect(() => {
    if (form?.success) {
      // 成功時の処理
      console.log('ログイン成功:', form.user);
    }
  });
</script>
```

## 複数のアクション

1つのページに複数のフォームアクションを定義することができます。各アクションには名前を付け、フォームの`action`属性で指定します。

```javascript
// src/routes/account/+page.server.js
import { fail } from '@sveltejs/kit';

/** @type {import('./$types').Actions} */
export const actions = {
  updateProfile: async ({ request, locals }) => {
    // プロフィール更新ロジック
    const data = await request.formData();
    // ...
    return { success: true, message: 'プロフィールを更新しました' };
  },
  
  changePassword: async ({ request, locals }) => {
    // パスワード変更ロジック
    const data = await request.formData();
    // ...
    return { success: true, message: 'パスワードを変更しました' };
  }
};
```

対応するSvelteコンポーネント：

```svelte
<!-- src/routes/account/+page.svelte -->
<script>
  /** @type {import('./$types').ActionData} */
  export let form;
</script>

{#if form?.success}
  <div class="success">
    {form.message}
  </div>
{/if}

<h2>プロフィール更新</h2>
<form method="POST" action="?/updateProfile">
  <!-- プロフィール更新フォームの内容 -->
  <button type="submit">更新</button>
</form>

<h2>パスワード変更</h2>
<form method="POST" action="?/changePassword">
  <!-- パスワード変更フォームの内容 -->
  <button type="submit">変更</button>
</form>
```

## プログレッシブエンハンスメント

SvelteKitのフォームアクションは、JavaScriptが無効な環境でも動作します（プログレッシブエンハンスメント）。さらに、JavaScriptが有効な場合は、`use:enhance`ディレクティブを使用して、ページ全体をリロードせずにフォームを送信できます。

```svelte
<script>
  import { enhance } from '$app/forms';
  
  /** @type {import('./$types').ActionData} */
  export let form;
  
  let submitting = false;
</script>

<form
  method="POST"
  use:enhance={() => {
    // フォーム送信前
    submitting = true;
    
    return async ({ result, update }) => {
      // フォーム送信後
      submitting = false;
      
      // 結果に基づいて処理
      if (result.type === 'success') {
        // 成功時の処理
      }
      
      // フォームの状態を更新
      await update();
    };
  }}
>
  <!-- フォームの内容 -->
  <button type="submit" disabled={submitting}>
    {submitting ? '送信中...' : '送信'}
  </button>
</form>
```

## バリデーション

フォームデータのバリデーションは、サーバーサイドで行うことが推奨されています。バリデーションエラーがある場合は、`fail`関数を使用してエラー情報を返します。

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
    const confirmPassword = data.get('confirmPassword');
    
    const errors = {};
    
    // バリデーションチェック
    if (!username || username.length < 3) {
      errors.username = 'ユーザー名は3文字以上である必要があります';
    }
    
    if (!email || !email.includes('@')) {
      errors.email = '有効なメールアドレスを入力してください';
    }
    
    if (!password || password.length < 8) {
      errors.password = 'パスワードは8文字以上である必要があります';
    }
    
    if (password !== confirmPassword) {
      errors.confirmPassword = 'パスワードが一致しません';
    }
    
    // エラーがある場合
    if (Object.keys(errors).length > 0) {
      return fail(400, {
        errors,
        username,
        email
      });
    }
    
    // 登録処理
    try {
      // ユーザー登録ロジック
      // ...
      
      return {
        success: true,
        message: '登録が完了しました'
      };
    } catch (error) {
      return fail(500, {
        error: true,
        message: '登録中にエラーが発生しました'
      });
    }
  }
};
```

## ファイルアップロード

フォームアクションを使用して、ファイルのアップロードを処理することもできます。

```svelte
<!-- src/routes/upload/+page.svelte -->
<form method="POST" enctype="multipart/form-data">
  <div>
    <label for="file">ファイルを選択</label>
    <input id="file" name="file" type="file" accept="image/*" required />
  </div>
  
  <button type="submit">アップロード</button>
</form>
```

```javascript
// src/routes/upload/+page.server.js
import { fail } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../../static/uploads');

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const file = data.get('file');
    
    if (!file || !(file instanceof File)) {
      return fail(400, {
        error: true,
        message: 'ファイルが選択されていません'
      });
    }
    
    // ファイルタイプの検証
    if (!file.type.startsWith('image/')) {
      return fail(400, {
        error: true,
        message: '画像ファイルのみアップロードできます'
      });
    }
    
    try {
      // ファイル名の生成
      const filename = `${Date.now()}-${file.name}`;
      const filepath = path.join(uploadsDir, filename);
      
      // ディレクトリの存在確認
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // ファイルの保存
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filepath, buffer);
      
      return {
        success: true,
        filename,
        path: `/uploads/${filename}`
      };
    } catch (error) {
      console.error('ファイルアップロードエラー:', error);
      
      return fail(500, {
        error: true,
        message: 'ファイルのアップロード中にエラーが発生しました'
      });
    }
  }
};
```

SvelteKitのフォームアクションを使用することで、JavaScriptに依存せずにフォーム処理を実装でき、プログレッシブエンハンスメントの原則に従ったウェブアプリケーションを構築できます。
