# Svelte 5 Runes Complete Reference

**Document Number**: GUIDE-007  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Introduction to Runes](#introduction-to-runes)
2. [State Management Runes](#state-management-runes)
   - [$state](#state)
   - [$state.frozen](#statefrozen)
   - [$derived](#derived)
   - [$props](#props)
   - [$mutable](#mutable)
3. [Effect Runes](#effect-runes)
   - [$effect](#effect)
   - [$effect.pre](#effectpre)
   - [$effect.post](#effectpost)
   - [$effect.root](#effectroot)
   - [$effect.active](#effectactive)
4. [Context Runes](#context-runes)
   - [$context](#context)
   - [$context.get](#contextget)
   - [$context.set](#contextset)
5. [Lifecycle Runes](#lifecycle-runes)
   - [$effect.once](#effectonce)
   - [$effect.client](#effectclient)
   - [$effect.server](#effectserver)
6. [Binding Runes](#binding-runes)
   - [$bind](#bind)
7. [Inspecting Runes](#inspecting-runes)
   - [$inspect](#inspect)
8. [Advanced Patterns](#advanced-patterns)
9. [Migration from Svelte 4](#migration-from-svelte-4)
10. [Performance Considerations](#performance-considerations)

## Introduction to Runes

Runes are a new reactivity primitive in Svelte 5 that replace the reactive declarations and stores from Svelte 4. They are prefixed with `$` and provide a more explicit and powerful way to handle reactivity.

Runes work by tracking dependencies and automatically updating when those dependencies change. Unlike Svelte 4's reactive declarations (using `$:`), Runes are more explicit and can be used anywhere in your code, not just at the top level of a component.

## State Management Runes

### $state

`$state` is the most fundamental Rune, used to create reactive variables.

**Basic Usage:**

```svelte
<script>
  let count = $state(0);
  
  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>
  Count: {count}
</button>
```

**Object and Array State:**

```svelte
<script>
  let user = $state({
    name: 'John',
    age: 30
  });
  
  let items = $state(['apple', 'banana', 'orange']);
  
  function updateUser() {
    user.age += 1;
    // or with immutable update:
    // user = { ...user, age: user.age + 1 };
  }
  
  function addItem(item) {
    items = [...items, item];
  }
</script>
```

**Nested State:**

```svelte
<script>
  let app = $state({
    user: {
      profile: {
        name: 'John',
        age: 30
      },
      preferences: {
        theme: 'dark',
        notifications: true
      }
    },
    settings: {
      language: 'en'
    }
  });
  
  function updateTheme(theme) {
    app.user.preferences.theme = theme;
  }
</script>
```

### $state.frozen

`$state.frozen` creates immutable state that cannot be modified after creation.

```svelte
<script>
  const config = $state.frozen({
    apiUrl: 'https://api.example.com',
    timeout: 5000
  });
  
  // This will throw an error:
  // config.timeout = 10000;
</script>
```

### $derived

`$derived` creates values that are derived from other reactive values.

**Basic Usage:**

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  let isEven = $derived(count % 2 === 0);
</script>

<p>Count: {count}</p>
<p>Doubled: {doubled}</p>
<p>Is even: {isEven}</p>
```

**Complex Derivations:**

```svelte
<script>
  let firstName = $state('John');
  let lastName = $state('Doe');
  
  let fullName = $derived(`${firstName} ${lastName}`);
  
  let user = $state({
    age: 30,
    active: true
  });
  
  let userDescription = $derived(
    `${fullName}, ${user.age} years old, ${user.active ? 'active' : 'inactive'}`
  );
</script>
```

**With Functions:**

```svelte
<script>
  let items = $state([1, 2, 3, 4, 5]);
  
  let sum = $derived(() => {
    return items.reduce((total, item) => total + item, 0);
  });
  
  let evenItems = $derived(() => {
    return items.filter(item => item % 2 === 0);
  });
</script>
```

### $props

`$props` is used to define component props with default values and type information.

**Basic Usage:**

```svelte
<script>
  let props = $props({
    name: 'World',
    greeting: 'Hello'
  });
</script>

<p>{props.greeting}, {props.name}!</p>
```

**With TypeScript:**

```svelte
<script lang="ts">
  interface ButtonProps {
    label: string;
    primary?: boolean;
    disabled?: boolean;
    onClick?: () => void;
  }
  
  let props = $props<ButtonProps>({
    label: 'Click me',
    primary: false,
    disabled: false
  });
</script>

<button 
  class:primary={props.primary}
  disabled={props.disabled}
  on:click={props.onClick}
>
  {props.label}
</button>
```

**Destructuring Props:**

```svelte
<script>
  let { name = 'World', greeting = 'Hello' } = $props();
</script>

<p>{greeting}, {name}!</p>
```

### $mutable

`$mutable` creates a mutable reference that can be passed to child components.

```svelte
<script>
  let count = $state(0);
  let countRef = $mutable(count);
  
  function increment() {
    countRef.value += 1;
  }
</script>

<ChildComponent {countRef} />
```

## Effect Runes

### $effect

`$effect` runs side effects when reactive dependencies change.

**Basic Usage:**

```svelte
<script>
  let count = $state(0);
  
  $effect(() => {
    console.log(`Count changed to ${count}`);
  });
</script>
```

**Cleanup Function:**

```svelte
<script>
  let visible = $state(true);
  
  $effect(() => {
    if (!visible) return;
    
    const interval = setInterval(() => {
      console.log('Tick');
    }, 1000);
    
    return () => {
      clearInterval(interval);
    };
  });
</script>
```

**DOM Manipulation:**

```svelte
<script>
  let name = $state('World');
  let element;
  
  $effect(() => {
    if (element) {
      element.textContent = `Hello, ${name}!`;
    }
  });
</script>

<div bind:this={element}></div>
```

### $effect.pre

`$effect.pre` runs before the DOM is updated, similar to Svelte 4's `beforeUpdate`.

```svelte
<script>
  let count = $state(0);
  
  $effect.pre(() => {
    console.log(`About to update count to ${count}`);
  });
</script>
```

### $effect.post

`$effect.post` runs after the DOM is updated, similar to Svelte 4's `afterUpdate`.

```svelte
<script>
  let count = $state(0);
  
  $effect.post(() => {
    console.log(`DOM updated with count = ${count}`);
  });
</script>
```

### $effect.root

`$effect.root` creates a new "root" for effects, isolating them from parent effects.

```svelte
<script>
  $effect.root(() => {
    let count = $state(0);
    
    $effect(() => {
      console.log(`Count in isolated root: ${count}`);
    });
    
    // This effect is isolated to this root
    setInterval(() => {
      count += 1;
    }, 1000);
  });
</script>
```

### $effect.active

`$effect.active` checks if an effect is currently running.

```svelte
<script>
  function getValue() {
    if ($effect.active()) {
      console.log('Called during effect execution');
    } else {
      console.log('Called outside effect execution');
    }
    return 42;
  }
  
  let count = $state(0);
  
  $effect(() => {
    const value = getValue();
    console.log(`Effect with count ${count} and value ${value}`);
  });
  
  // Called outside effect
  getValue();
</script>
```

## Context Runes

### $context

`$context` is a shorthand for both setting and getting context.

```svelte
<!-- Parent.svelte -->
<script>
  let theme = $context('theme', 'light');
</script>

<div class={theme}>
  <slot />
</div>

<!-- Child.svelte -->
<script>
  let theme = $context('theme');
  // theme will be 'light'
</script>
```

### $context.get

`$context.get` retrieves a value from the context.

```svelte
<script>
  let theme = $context.get('theme');
  // If 'theme' is not in context, this will throw an error
  
  let language = $context.get('language', 'en');
  // If 'language' is not in context, it will default to 'en'
</script>
```

### $context.set

`$context.set` sets a value in the context.

```svelte
<script>
  $context.set('theme', 'dark');
  $context.set('user', { name: 'John', role: 'admin' });
</script>
```

## Lifecycle Runes

### $effect.once

`$effect.once` runs an effect exactly once, similar to Svelte 4's `onMount`.

```svelte
<script>
  $effect.once(() => {
    console.log('Component mounted');
    
    return () => {
      console.log('Component unmounted');
    };
  });
</script>
```

### $effect.client

`$effect.client` runs an effect only on the client, not during server-side rendering.

```svelte
<script>
  $effect.client(() => {
    console.log('Running in browser only');
    console.log('Window width:', window.innerWidth);
  });
</script>
```

### $effect.server

`$effect.server` runs an effect only during server-side rendering.

```svelte
<script>
  $effect.server(() => {
    console.log('Running on server only');
  });
</script>
```

## Binding Runes

### $bind

`$bind` creates a two-way binding between a value and a DOM element.

```svelte
<script>
  let name = $state('');
  let checked = $state(false);
  let selected = $state('option1');
</script>

<input type="text" $bind:value={name} />
<input type="checkbox" $bind:checked={checked} />
<select $bind:value={selected}>
  <option value="option1">Option 1</option>
  <option value="option2">Option 2</option>
</select>
```

## Inspecting Runes

### $inspect

`$inspect` allows you to observe changes to reactive values without causing side effects.

```svelte
<script>
  let count = $state(0);
  
  $inspect(count, (value, label = 'count') => {
    console.log(`${label} changed to ${value}`);
  });
  
  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>Increment</button>
```

## Advanced Patterns

### Computed Collections

```svelte
<script>
  let items = $state([
    { id: 1, text: 'Item 1', completed: false },
    { id: 2, text: 'Item 2', completed: true },
    { id: 3, text: 'Item 3', completed: false }
  ]);
  
  let completedItems = $derived(
    items.filter(item => item.completed)
  );
  
  let incompleteItems = $derived(
    items.filter(item => !item.completed)
  );
  
  let stats = $derived({
    total: items.length,
    completed: completedItems.length,
    incomplete: incompleteItems.length,
    percentComplete: items.length > 0 
      ? Math.round((completedItems.length / items.length) * 100) 
      : 0
  });
</script>
```

### Custom Reactive Stores

```svelte
<script>
  function createCounter(initialValue = 0) {
    let count = $state(initialValue);
    
    return {
      get value() { return count; },
      increment: () => { count += 1; },
      decrement: () => { count -= 1; },
      reset: () => { count = initialValue; }
    };
  }
  
  const counter = createCounter(10);
</script>

<button on:click={counter.increment}>+</button>
<span>{counter.value}</span>
<button on:click={counter.decrement}>-</button>
<button on:click={counter.reset}>Reset</button>
```

### Reactive Event Handlers

```svelte
<script>
  let x = $state(0);
  let y = $state(0);
  
  // This function will be reactive to changes in x and y
  let handleClick = $derived(() => {
    return (event) => {
      console.log(`Clicked at (${x}, ${y})`);
      // Do something with x and y
    };
  });
</script>

<button on:click={handleClick}>Click me</button>
```

## Migration from Svelte 4

### Reactive Declarations

**Svelte 4:**

```svelte
<script>
  let count = 0;
  $: doubled = count * 2;
  $: {
    console.log(`Count changed to ${count}`);
  }
</script>
```

**Svelte 5:**

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  
  $effect(() => {
    console.log(`Count changed to ${count}`);
  });
</script>
```

### Stores

**Svelte 4:**

```svelte
<script>
  import { writable } from 'svelte/store';
  
  const count = writable(0);
  
  function increment() {
    $count += 1;
  }
</script>

<p>Count: {$count}</p>
```

**Svelte 5:**

```svelte
<script>
  let count = $state(0);
  
  function increment() {
    count += 1;
  }
</script>

<p>Count: {count}</p>
```

### Lifecycle Methods

**Svelte 4:**

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  
  let interval;
  
  onMount(() => {
    interval = setInterval(() => {
      // Do something
    }, 1000);
  });
  
  onDestroy(() => {
    clearInterval(interval);
  });
</script>
```

**Svelte 5:**

```svelte
<script>
  $effect(() => {
    const interval = setInterval(() => {
      // Do something
    }, 1000);
    
    return () => {
      clearInterval(interval);
    };
  });
</script>
```

## Performance Considerations

### Granular Reactivity

Break down large state objects into smaller, more focused pieces to avoid unnecessary updates:

```svelte
<script>
  // Less efficient - entire user object updates
  let user = $state({
    name: 'John',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  });
  
  // More efficient - separate concerns
  let userName = $state('John');
  let userTheme = $state('dark');
  let userNotifications = $state(true);
</script>
```

### Memoization with $derived

Use `$derived` to memoize expensive calculations:

```svelte
<script>
  let items = $state([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  
  // This will only recalculate when items changes
  let filteredItems = $derived(() => {
    console.log('Filtering items...');
    return items.filter(item => item % 2 === 0);
  });
  
  // This will only recalculate when filteredItems changes
  let sum = $derived(() => {
    console.log('Calculating sum...');
    return filteredItems.reduce((total, item) => total + item, 0);
  });
</script>
```

### Avoiding Effect Loops

Be careful not to create infinite loops with effects:

```svelte
<script>
  let count = $state(0);
  
  // BAD: This will cause an infinite loop
  $effect(() => {
    count += 1; // This triggers the effect again
  });
  
  // GOOD: Use conditions to prevent loops
  $effect(() => {
    if (count < 10) {
      count += 1;
    }
  });
</script>
```
