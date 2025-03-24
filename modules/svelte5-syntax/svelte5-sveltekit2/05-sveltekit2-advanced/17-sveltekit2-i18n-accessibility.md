# SvelteKit 2 国際化（i18n）とアクセシビリティ

**Document Number**: GUIDE-017-I18N-A11Y  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [はじめに](#はじめに)
2. [国際化（i18n）](#国際化i18n)
3. [アクセシビリティ](#アクセシビリティ)

## はじめに

このドキュメントでは、SvelteKit 2における国際化（i18n）とアクセシビリティに関する公式情報を提供します。

## 国際化（i18n）

SvelteKitの公式ドキュメントでは、国際化（i18n）に関する具体的な実装方法は提供されていませんが、SvelteKitのルーティングシステムを活用して国際化を実装することが可能です。

### ルートパラメータを使用した国際化

SvelteKitのルートパラメータを使用して、URLに言語コードを含めることができます。

```
/src/routes/[lang]/+layout.svelte
/src/routes/[lang]/+layout.server.js
/src/routes/[lang]/+page.svelte
/src/routes/[lang]/about/+page.svelte
```

`+layout.server.js`で言語パラメータを取得し、適切な翻訳を読み込むことができます。

```javascript
// src/routes/[lang]/+layout.server.js
export function load({ params }) {
  const { lang } = params;
  // 有効な言語コードかチェック
  const validLangs = ['en', 'ja', 'fr', 'de'];
  const validLang = validLangs.includes(lang) ? lang : 'en';
  
  return {
    lang: validLang
  };
}
```

### 日付と数値のフォーマット

JavaScriptの`Intl`オブジェクトを使用して、日付と数値を各言語に適したフォーマットで表示できます。

```svelte
<script>
  export let lang;
  export let date = new Date();
  export let number = 1234567.89;
  
  $: dateFormatter = new Intl.DateTimeFormat(lang, {
    dateStyle: 'full',
    timeStyle: 'long'
  });
  
  $: numberFormatter = new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: lang === 'ja' ? 'JPY' : 'USD'
  });
</script>

<p>日付: {dateFormatter.format(date)}</p>
<p>数値: {numberFormatter.format(number)}</p>
```

## アクセシビリティ

SvelteKitは、アクセシブルなウェブアプリケーションを構築するための基盤を提供します。

### アクセシビリティの警告

Svelteコンパイラには、アクセシビリティに関する問題を検出する機能が組み込まれています。例えば、イメージに`alt`属性がない場合や、フォーム要素に適切なラベルがない場合に警告が表示されます。

```svelte
<!-- コンパイラが警告を表示 -->
<img src="image.jpg">

<!-- 正しい実装 -->
<img src="image.jpg" alt="説明的なテキスト">
```

### キーボードナビゲーション

キーボードでのナビゲーションをサポートするために、適切なフォーカス管理が重要です。

```svelte
<script>
  let modalOpen = false;
  let modalButton;
  let closeButton;
  
  function openModal() {
    modalOpen = true;
    // モーダルが開いたら閉じるボタンにフォーカス
    setTimeout(() => {
      closeButton.focus();
    }, 0);
  }
  
  function closeModal() {
    modalOpen = false;
    // モーダルが閉じたら開くボタンにフォーカス
    modalButton.focus();
  }
</script>

<button bind:this={modalButton} on:click={openModal}>
  モーダルを開く
</button>

{#if modalOpen}
  <div role="dialog" aria-modal="true">
    <h2>モーダルタイトル</h2>
    <p>モーダルの内容...</p>
    <button bind:this={closeButton} on:click={closeModal}>
      閉じる
    </button>
  </div>
{/if}
```

### ARIA属性

適切なARIA属性を使用して、スクリーンリーダーユーザーにコンテンツの意味を伝えることができます。

```svelte
<div role="alert" aria-live="assertive">
  {#if error}
    <p>{error}</p>
  {/if}
</div>

<button
  aria-expanded={isExpanded}
  on:click={() => isExpanded = !isExpanded}
>
  詳細を{isExpanded ? '隠す' : '表示'}
</button>

{#if isExpanded}
  <div id="details">
    詳細な情報...
  </div>
{/if}
```

### コントラストと色

視覚障害のあるユーザーのために、十分なコントラスト比を確保することが重要です。

```svelte
<style>
  /* 良いコントラスト比 */
  .good-contrast {
    color: #222;
    background-color: #fff;
  }
  
  /* 不十分なコントラスト比 */
  .poor-contrast {
    color: #aaa;
    background-color: #eee;
  }
</style>
```

### フォーカス可視性

キーボードユーザーのために、フォーカスされた要素が視覚的に識別できるようにすることが重要です。

```svelte
<style>
  /* フォーカス時のスタイル */
  :focus {
    outline: 2px solid #4a90e2;
    outline-offset: 2px;
  }
  
  /* マウスユーザーのみフォーカスアウトラインを非表示にする場合 */
  :focus:not(:focus-visible) {
    outline: none;
  }
</style>
```

### スクリーンリーダーのサポート

視覚的に表示されていない情報をスクリーンリーダーユーザーに伝えるために、`aria-label`や`sr-only`クラスを使用できます。

```svelte
<button aria-label="閉じる">
  <svg>...</svg>
</button>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>

<span class="sr-only">スクリーンリーダーのみに読み上げられるテキスト</span>
```

SvelteKitを使用してアクセシブルなウェブアプリケーションを構築する際は、WAI-ARIAのガイドラインとWCAGの基準に従うことをお勧めします。
