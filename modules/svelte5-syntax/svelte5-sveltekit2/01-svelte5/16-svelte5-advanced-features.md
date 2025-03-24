# Svelte 5 高度な機能

**Document Number**: GUIDE-016-AF  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [Runes](#runes)
2. [スナップショット](#スナップショット)
3. [イミュータブルストア](#イミュータブルストア)
4. [トランジション](#トランジション)
5. [アニメーション](#アニメーション)
6. [アクション](#アクション)
7. [ライフサイクル](#ライフサイクル)
8. [特殊要素](#特殊要素)

## Runes

Svelte 5では、リアクティビティを宣言するための新しい構文「Runes」が導入されました。Runesは`$`記号で始まる特殊な関数です。

### $state

`$state`は、リアクティブな状態を宣言するためのRuneです。

```svelte
<script>
  let count = $state(0);
  
  function increment() {
    count++;
  }
</script>

<button on:click={increment}>
  {count}
</button>
```

### $derived

`$derived`は、他のリアクティブな値から派生した値を宣言するためのRuneです。

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>

<p>{count} * 2 = {doubled}</p>
```

### $effect

`$effect`は、リアクティブな値が変更されたときに実行される副作用を宣言するためのRuneです。

```svelte
<script>
  let count = $state(0);
  
  $effect(() => {
    console.log(`count の値が ${count} に変更されました`);
  });
  
  function increment() {
    count++;
  }
</script>

<button on:click={increment}>
  {count}
</button>
```

## スナップショット

`$snapshot`は、リアクティブな値の現在の状態のスナップショットを作成するRuneです。

```svelte
<script>
  import { snapshot } from 'svelte';
  
  let count = $state(0);
  
  function logCount() {
    const snap = $snapshot(count);
    
    setTimeout(() => {
      console.log(snap); 
      console.log(count); 
    }, 1000);
  }
</script>

<button on:click={() => count++}>Increment: {count}</button>
<button on:click={logCount}>Log count</button>
```

## イミュータブルストア

Svelte 5では、イミュータブルなストアを作成するための`immutable`関数が提供されています。

```svelte
<script>
  import { immutable } from 'svelte';
  
  let todos = $immutable([
    { id: 1, text: 'Learn Svelte', done: true },
    { id: 2, text: 'Build an app', done: false }
  ]);
  
  function addTodo(text) {
    todos = [...todos, { id: todos.length + 1, text, done: false }];
  }
  
  function toggleTodo(id) {
    todos = todos.map(todo => 
      todo.id === id ? { ...todo, done: !todo.done } : todo
    );
  }
</script>
```

## トランジション

Svelte 5では、要素の出入りをアニメーション化するためのトランジション機能が提供されています。

```svelte
<script>
  import { fade, fly, slide } from 'svelte/transition';
  
  let visible = $state(true);
</script>

<button on:click={() => visible = !visible}>
  {visible ? '非表示' : '表示'}
</button>

{#if visible}
  <div transition:fade>
    フェードイン/アウト
  </div>
  
  <div in:fly={{ y: 200 }} out:fade>
    フライイン、フェードアウト
  </div>
  
  <div transition:slide>
    スライドイン/アウト
  </div>
{/if}
```

## アニメーション

Svelte 5では、要素のプロパティをアニメーション化するための機能も提供されています。

```svelte
<script>
  import { spring, tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  
  const coords = spring({ x: 0, y: 0 });
  
  const progress = tweened(0, {
    duration: 1000,
    easing: cubicOut
  });
  
  function handleMousemove(event) {
    coords.set({ x: event.clientX, y: event.clientY });
  }
  
  function handleClick() {
    progress.set(progress === 0 ? 1 : 0);
  }
</script>

<div on:mousemove={handleMousemove}>
  <div class="box" style="transform: translate({$coords.x}px, {$coords.y}px)"></div>
</div>

<progress value={$progress}></progress>
<button on:click={handleClick}>
  {$progress === 0 ? '開始' : '終了'}
</button>
```

## アクション

Svelte 5では、DOM要素に機能を追加するためのアクションが提供されています。

```svelte
<script>
  function clickOutside(node, callback) {
    function handleClick(event) {
      if (!node.contains(event.target)) {
        callback();
      }
    }
    
    document.addEventListener('click', handleClick, true);
    
    return {
      destroy() {
        document.removeEventListener('click', handleClick, true);
      }
    };
  }
  
  let showModal = $state(false);
</script>

<button on:click={() => showModal = true}>
  モーダルを開く
</button>

{#if showModal}
  <div class="modal" use:clickOutside={() => showModal = false}>
    <h2>モーダル</h2>
    <p>モーダルの外側をクリックして閉じる</p>
  </div>
{/if}
```

## ライフサイクル

Svelte 5では、コンポーネントのライフサイクルを管理するための関数が提供されています。

```svelte
<script>
  import { onMount, onDestroy, beforeUpdate, afterUpdate } from 'svelte';
  
  let count = $state(0);
  
  onMount(() => {
    console.log('コンポーネントがマウントされました');
  });
  
  onDestroy(() => {
    console.log('コンポーネントが破棄されました');
  });
  
  beforeUpdate(() => {
    console.log('DOM更新前');
  });
  
  afterUpdate(() => {
    console.log('DOM更新後');
  });
</script>
```

## 特殊要素

Svelte 5では、特殊な機能を持つ要素が提供されています。

### `<svelte:self>`

コンポーネント自身を再帰的に参照するために使用します。

```svelte
<script>
  export let items = [];
</script>

<ul>
  {#each items as item}
    <li>
      {item.name}
      {#if item.children?.length}
        <svelte:self items={item.children} />
      {/if}
    </li>
  {/each}
</ul>
```

### `<svelte:component>`

動的にコンポーネントを選択するために使用します。

```svelte
<script>
  import ComponentA from './ComponentA.svelte';
  import ComponentB from './ComponentB.svelte';
  
  let current = 'a';
  
  const components = {
    a: ComponentA,
    b: ComponentB
  };
</script>

<select bind:value={current}>
  <option value="a">コンポーネントA</option>
  <option value="b">コンポーネントB</option>
</select>

<svelte:component this={components[current]} />
```

### `<svelte:window>`

ウィンドウオブジェクトのイベントをリッスンするために使用します。

```svelte
<script>
  let scrollY;
  let innerWidth;
  let innerHeight;
</script>

<svelte:window
  bind:scrollY
  bind:innerWidth
  bind:innerHeight
/>

<p>スクロール位置: {scrollY}px</p>
<p>ウィンドウサイズ: {innerWidth}x{innerHeight}</p>
```

### `<svelte:body>`

bodyタグのイベントをリッスンするために使用します。

```svelte
<script>
  function handleClick() {
    console.log('bodyがクリックされました');
  }
</script>

<svelte:body on:click={handleClick} />
```

### `<svelte:head>`

headタグの内容を変更するために使用します。

```svelte
<script>
  export let title = 'デフォルトタイトル';
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content="Svelteアプリケーション">
</svelte:head>
```

### `<svelte:options>`

コンポーネントのコンパイルオプションを設定するために使用します。

```svelte
<svelte:options immutable={true} accessors={true} />

<script>
  export let data = [];
</script>
```

### `<svelte:fragment>`

ラッパー要素なしでコンテンツをグループ化するために使用します。

```svelte
<script>
  let active = 'foo';
</script>

{#if active === 'foo'}
  <svelte:fragment>
    <h2>Foo</h2>
    <p>Fooの内容</p>
  </svelte:fragment>
{:else}
  <svelte:fragment>
    <h2>Bar</h2>
    <p>Barの内容</p>
  </svelte:fragment>
{/if}
```
