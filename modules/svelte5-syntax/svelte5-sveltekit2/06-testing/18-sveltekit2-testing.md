# SvelteKit 2 テスト戦略

**Document Number**: GUIDE-018-TS  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [はじめに](#はじめに)
2. [Vitestの設定](#vitestの設定)
3. [ユニットテスト](#ユニットテスト)
4. [コンポーネントテスト](#コンポーネントテスト)
5. [エンドツーエンドテスト](#エンドツーエンドテスト)

## はじめに

このドキュメントでは、SvelteKit 2アプリケーションのテスト戦略について、公式ドキュメントに基づいた情報を提供します。SvelteKitは、Vitestを使用したテストをサポートしています。

## Vitestの設定

SvelteKitプロジェクトでは、Vitestを使用してテストを実行できます。新しいSvelteKitプロジェクトを作成する際に、テストのセットアップを選択できます。

```bash
npm create svelte@latest my-app
# テストのセットアップを選択する
cd my-app
npm install
```

または、既存のプロジェクトにVitestを追加することもできます：

```bash
npm i -D vitest
```

`vite.config.js`（または`vite.config.ts`）を更新して、Vitestの設定を追加します：

```javascript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom'
  }
});
```

`package.json`にテストスクリプトを追加します：

```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

## ユニットテスト

ユニットテストは、アプリケーションの個々の関数やモジュールをテストします。

```javascript
// src/lib/utils.js
export function add(a, b) {
  return a + b;
}

// src/lib/utils.test.js
import { describe, it, expect } from 'vitest';
import { add } from './utils';

describe('add function', () => {
  it('adds two numbers correctly', () => {
    expect(add(1, 2)).toBe(3);
  });
});
```

テストを実行するには：

```bash
npm test
```

または、監視モードで実行するには：

```bash
npm test -- --watch
```

## コンポーネントテスト

SvelteKitコンポーネントをテストするには、`@testing-library/svelte`を使用できます。

```bash
npm i -D @testing-library/svelte
```

コンポーネントのテスト例：

```svelte
<!-- src/lib/Counter.svelte -->
<script>
  let count = 0;
  
  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>
  Count: {count}
</button>
```

```javascript
// src/lib/Counter.test.js
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Counter from './Counter.svelte';

describe('Counter component', () => {
  it('increments count when button is clicked', async () => {
    const { getByText } = render(Counter);
    const button = getByText('Count: 0');
    
    await fireEvent.click(button);
    
    expect(getByText('Count: 1')).toBeTruthy();
  });
});
```

## エンドツーエンドテスト

SvelteKitアプリケーションのエンドツーエンドテストには、Playwrightを使用できます。

```bash
npm i -D @playwright/test
```

Playwrightの設定ファイル（`playwright.config.js`）を作成します：

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173
  },
  testDir: 'tests'
});
```

テストファイルを作成します：

```javascript
// tests/test.js
import { test, expect } from '@playwright/test';

test('index page has expected h1', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to SvelteKit');
});
```

Playwrightテストを実行するには：

```bash
npx playwright test
```

## まとめ

SvelteKit 2では、Vitestを使用したユニットテストとコンポーネントテスト、Playwrightを使用したエンドツーエンドテストを組み合わせて、包括的なテスト戦略を実装できます。これらのテストツールを使用することで、アプリケーションの品質と信頼性を確保できます。
