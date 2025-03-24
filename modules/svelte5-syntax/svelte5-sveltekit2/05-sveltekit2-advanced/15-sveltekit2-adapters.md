# SvelteKit 2 アダプター

**Document Number**: GUIDE-015-AD  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [アダプターの概要](#アダプターの概要)
2. [Node.jsアダプター](#nodejs-アダプター)
3. [静的サイトアダプター](#静的サイトアダプター)
4. [Vercelアダプター](#vercel-アダプター)
5. [Netlifyアダプター](#netlify-アダプター)
6. [Cloudflareアダプター](#cloudflare-アダプター)
7. [カスタムアダプター](#カスタムアダプター)
8. [アダプターの設定](#アダプターの設定)

## アダプターの概要

SvelteKit 2のアダプターは、アプリケーションを特定の環境（Node.js、Vercel、Netlifyなど）にデプロイするためのプラグインです。アダプターは、SvelteKitアプリケーションをターゲット環境に適した形式に変換します。

主なアダプター：

- `@sveltejs/adapter-node`: Node.jsサーバー用
- `@sveltejs/adapter-static`: 静的サイト用
- `@sveltejs/adapter-vercel`: Vercel用
- `@sveltejs/adapter-netlify`: Netlify用
- `@sveltejs/adapter-cloudflare`: Cloudflare Pages用

## Node.jsアダプター

Node.jsアダプターは、SvelteKitアプリケーションをスタンドアロンのNode.jsサーバーとしてデプロイするためのアダプターです。

### インストール

```bash
npm install --save-dev @sveltejs/adapter-node
```

### 設定

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  
  kit: {
    adapter: adapter({
      // Node.jsアダプターのオプション
      out: 'build',           // ビルド出力ディレクトリ
      precompress: true,      // gzipとbrotli圧縮を事前に行う
      envPrefix: 'APP_',      // 環境変数のプレフィックス
      polyfill: true          // Node.js APIのポリフィルを含める
    })
  }
};

export default config;
```

### 使用方法

ビルド後、以下のコマンドでサーバーを起動できます：

```bash
node build/index.js
```

環境変数：

- `PORT`: サーバーのポート（デフォルト: 3000）
- `HOST`: サーバーのホスト（デフォルト: 0.0.0.0）
- `ORIGIN`: アプリケーションのオリジン（例: https://example.com）

## 静的サイトアダプター

静的サイトアダプターは、SvelteKitアプリケーションを静的なHTMLファイルとしてビルドするためのアダプターです。これにより、静的サイトホスティングサービス（GitHub Pages、Amazon S3など）にデプロイできます。

### インストール

```bash
npm install --save-dev @sveltejs/adapter-static
```

### 設定

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  
  kit: {
    adapter: adapter({
      // 静的サイトアダプターのオプション
      pages: 'build',         // ページの出力ディレクトリ
      assets: 'build',        // アセットの出力ディレクトリ
      fallback: 'index.html', // SPA用のフォールバックページ
      precompress: true,      // gzipとbrotli圧縮を事前に行う
      strict: true            // 動的ルートを禁止する
    }),
    
    // すべてのルートを事前レンダリングする
    prerender: {
      default: true
    }
  }
};

export default config;
```

### 動的ルートの処理

静的サイトでは、すべてのページを事前にレンダリングする必要があります。動的ルートがある場合は、以下のいずれかの方法で処理します：

1. `prerender`オプションを使用して、特定のルートを事前レンダリングする

```javascript
// src/routes/blog/[slug]/+page.js
export const prerender = true;

// すべての可能なスラッグを指定
export const entries = () => [
  { slug: 'hello-world' },
  { slug: 'second-post' },
  { slug: 'third-post' }
];
```

2. SPAモードを使用して、クライアントサイドでルーティングを処理する

```javascript
// svelte.config.js
kit: {
  adapter: adapter({
    fallback: 'index.html' // SPAモード用のフォールバックページ
  })
}
```

## Vercelアダプター

Vercelアダプターは、SvelteKitアプリケーションをVercelにデプロイするためのアダプターです。

### インストール

```bash
npm install --save-dev @sveltejs/adapter-vercel
```

### 設定

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  
  kit: {
    adapter: adapter({
      // Vercelアダプターのオプション
      runtime: 'nodejs18.x',     // Node.jsランタイムバージョン
      regions: ['hnd1'],         // デプロイするリージョン
      split: false,              // ルートごとに関数を分割するかどうか
      external: ['some-package'], // 外部依存関係
      edge: false                // Edgeランタイムを使用するかどうか
    })
  }
};

export default config;
```

### デプロイ

Vercelにデプロイするには、以下の手順を実行します：

1. GitHubリポジトリにコードをプッシュする
2. Vercelダッシュボードでリポジトリをインポートする
3. フレームワークプリセットとして「SvelteKit」を選択する
4. 必要な環境変数を設定する
5. デプロイボタンをクリックする

または、Vercel CLIを使用してデプロイすることもできます：

```bash
npm install -g vercel
vercel
```

## Netlifyアダプター

Netlifyアダプターは、SvelteKitアプリケーションをNetlifyにデプロイするためのアダプターです。

### インストール

```bash
npm install --save-dev @sveltejs/adapter-netlify
```

### 設定

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  
  kit: {
    adapter: adapter({
      // Netlifyアダプターのオプション
      edge: false,            // Edgeハンドラーを使用するかどうか
      split: false,           // ルートごとに関数を分割するかどうか
      external: ['some-package'] // 外部依存関係
    })
  }
};

export default config;
```

### デプロイ

Netlifyにデプロイするには、以下の手順を実行します：

1. GitHubリポジトリにコードをプッシュする
2. Netlifyダッシュボードでリポジトリをインポートする
3. ビルド設定：
   - ビルドコマンド: `npm run build`
   - 公開ディレクトリ: `.netlify/functions-internal`
4. 必要な環境変数を設定する
5. デプロイボタンをクリックする

または、Netlify CLIを使用してデプロイすることもできます：

```bash
npm install -g netlify-cli
netlify deploy
```

## Cloudflareアダプター

Cloudflareアダプターは、SvelteKitアプリケーションをCloudflare PagesまたはCloudflare Workersにデプロイするためのアダプターです。

### インストール

```bash
npm install --save-dev @sveltejs/adapter-cloudflare
```

### 設定

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  
  kit: {
    adapter: adapter({
      // Cloudflareアダプターのオプション
      routes: {
        include: ['/*'],      // 含めるルート
        exclude: ['/api/*']   // 除外するルート
      },
      
      // Workers KVの設定
      kvNamespaces: {
        SESSIONS: 'sessions'
      }
    })
  }
};

export default config;
```

### デプロイ

Cloudflare Pagesにデプロイするには、以下の手順を実行します：

1. GitHubリポジトリにコードをプッシュする
2. Cloudflare Pagesダッシュボードでリポジトリをインポートする
3. ビルド設定：
   - フレームワークプリセット: SvelteKit
   - ビルドコマンド: `npm run build`
   - ビルド出力ディレクトリ: `.cloudflare/functions`
4. 必要な環境変数を設定する
5. デプロイボタンをクリックする

または、Wranglerを使用してデプロイすることもできます：

```bash
npm install -g wrangler
wrangler pages publish .cloudflare/functions
```

## カスタムアダプター

特定のホスティング環境に合わせたカスタムアダプターを作成することもできます。カスタムアダプターは、以下の関数を実装する必要があります：

```javascript
// my-adapter.js
/** @type {import('@sveltejs/kit').Adapter} */
export default function myAdapter(options = {}) {
  return {
    name: 'my-adapter',
    
    async adapt(builder) {
      // ビルド出力ディレクトリを作成
      const outDir = options.out || 'build';
      builder.rimraf(outDir);
      builder.mkdirp(outDir);
      
      // クライアントアセットをコピー
      builder.writeClient(`${outDir}/client`);
      
      // 事前レンダリングされたページをコピー
      builder.writePrerendered(`${outDir}/prerendered`);
      
      // サーバーコードを生成
      builder.writeServer(`${outDir}/server`);
      
      // エントリーポイントを作成
      // ...
    }
  };
}
```

## アダプターの設定

アダプターは、`svelte.config.js`ファイルの`kit.adapter`オプションで設定します。

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-node'; // 使用するアダプター
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  
  kit: {
    // アダプターの設定
    adapter: adapter({
      // アダプター固有のオプション
    }),
    
    // その他のSvelteKit設定
    alias: {
      $components: 'src/components',
      $lib: 'src/lib'
    },
    
    env: {
      dir: '.',
      publicPrefix: 'PUBLIC_'
    },
    
    paths: {
      base: '',
      assets: ''
    },
    
    prerender: {
      default: false,
      entries: ['*']
    }
  }
};

export default config;
```

SvelteKitのアダプターを使用することで、さまざまなホスティング環境にアプリケーションをデプロイできます。プロジェクトの要件に合わせて適切なアダプターを選択してください。
