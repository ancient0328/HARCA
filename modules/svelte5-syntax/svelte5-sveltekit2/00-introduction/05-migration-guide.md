# Migration Guide

**Document Number**: GUIDE-005  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Migrating from Svelte 4 to Svelte 5](#migrating-from-svelte-4-to-svelte-5)
2. [Migrating from SvelteKit 1 to SvelteKit 2](#migrating-from-sveltekit-1-to-sveltekit-2)
3. [Common Migration Issues](#common-migration-issues)
4. [Testing After Migration](#testing-after-migration)
5. [Performance Considerations](#performance-considerations)
6. [Compatibility with Third-Party Libraries](#compatibility-with-third-party-libraries)

## Migrating from Svelte 4 to Svelte 5

### Preparing for Migration

Before migrating to Svelte 5, ensure you have:

1. Updated to the latest version of Svelte 4
2. Fixed any existing deprecation warnings
3. Backed up your project or created a migration branch
4. Updated your build tools (Vite, etc.)

### Installation

Update your dependencies:

```bash
npm install svelte@next
```

With pnpm:

```bash
pnpm update svelte@next
```

### Reactivity System Changes

#### 1. Reactive Declarations

**Svelte 4:**

```svelte
<script>
  let count = 0;
  $: doubled = count * 2;
  
  function increment() {
    count += 1;
  }
</script>
```

**Svelte 5:**

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  
  function increment() {
    count += 1;
  }
</script>
```

The `$:` syntax still works in Svelte 5, but Runes are recommended for new code.

#### 2. Stores

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

Stores are still available in Svelte 5 but are less necessary with Runes.

#### 3. Component Props

**Svelte 4:**

```svelte
<script>
  export let name = 'World';
  export let greeting = 'Hello';
</script>
```

**Svelte 5:**

```svelte
<script>
  let props = $props({
    name: 'World',
    greeting: 'Hello'
  });
</script>
```

The `export let` syntax still works in Svelte 5, but `$props()` is recommended for new code.

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

### Event Handling

**Svelte 4:**

```svelte
<button on:click={handleClick}>Click me</button>
```

**Svelte 5:**

```svelte
<button on:click={handleClick}>Click me</button>
```

Event handling syntax remains the same in Svelte 5.

### Component Structure

**Svelte 4 (Class Components):**

```svelte
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

**Svelte 5 (Function Components):**

```svelte
<script>
  function Counter() {
    let count = $state(0);
    
    return {
      increment: () => {
        count += 1;
      }
    };
  }
</script>

<button on:click={Counter.increment}>
  Count: {count}
</button>
```

Class components still work in Svelte 5, but function components are recommended for new code.

### Automated Migration

Svelte provides a migration tool to help automate the process:

```bash
npx svelte-migrate svelte-5
```

This tool will:
1. Update your Svelte configuration
2. Convert basic reactivity patterns to Runes
3. Update imports and syntax

Always review the changes made by the migration tool and test thoroughly.

## Migrating from SvelteKit 1 to SvelteKit 2

### Preparing for Migration

Before migrating to SvelteKit 2, ensure you have:

1. Updated to the latest version of SvelteKit 1
2. Fixed any existing deprecation warnings
3. Backed up your project or created a migration branch
4. Updated your build tools (Vite, etc.)

### Installation

Update your dependencies:

```bash
npm install @sveltejs/kit@next
```

With pnpm:

```bash
pnpm update @sveltejs/kit@next
```

### Configuration Changes

**SvelteKit 1:**

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter()
  }
};

export default config;
```

**SvelteKit 2:**

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter()
  }
};

export default config;
```

SvelteKit 2 simplifies the configuration by removing the need for explicit preprocessing.

### Route Changes

The file-based routing system remains the same in SvelteKit 2, but there are some changes to how routes are processed.

#### Load Function Changes

**SvelteKit 1:**

```javascript
// src/routes/products/+page.server.js
export async function load({ params, fetch, depends }) {
  depends('products');
  
  const response = await fetch(`/api/products/${params.id}`);
  const product = await response.json();
  
  return {
    product
  };
}
```

**SvelteKit 2:**

```javascript
// src/routes/products/+page.server.js
export async function load(event) {
  const { params, fetch, depends } = event;
  depends('products');
  
  const response = await fetch(`/api/products/${params.id}`);
  const product = await response.json();
  
  return {
    product
  };
}
```

In SvelteKit 2, the load function receives a single event object instead of destructured parameters.

#### Form Actions Changes

**SvelteKit 1:**

```javascript
// src/routes/login/+page.server.js
export const actions = {
  default: async ({ request, cookies }) => {
    // Handle form submission
  }
};
```

**SvelteKit 2:**

```javascript
// src/routes/login/+page.server.js
export const actions = {
  default: async (event) => {
    const { request, cookies } = event;
    // Handle form submission
  }
};
```

Similar to load functions, action functions now receive a single event object.

### Hooks Changes

**SvelteKit 1:**

```javascript
// src/hooks.server.js
export async function handle({ event, resolve }) {
  // Process request
  const response = await resolve(event);
  return response;
}
```

**SvelteKit 2:**

```javascript
// src/hooks.server.js
export async function handle({ event, resolve }) {
  // Process request
  const response = await resolve(event);
  return response;
}
```

The hooks API remains largely the same in SvelteKit 2.

### TypeScript Changes

**SvelteKit 1:**

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: {
        authenticated: boolean;
      };
    }
  }
}

export {};
```

**SvelteKit 2:**

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: {
        authenticated: boolean;
      };
    }
  }
}

export {};
```

The TypeScript definitions remain largely the same in SvelteKit 2.

### Automated Migration

SvelteKit provides a migration tool to help automate the process:

```bash
npx svelte-migrate sveltekit-2
```

This tool will:
1. Update your SvelteKit configuration
2. Convert load and action functions to the new format
3. Update imports and syntax

Always review the changes made by the migration tool and test thoroughly.

## Common Migration Issues

### 1. Reactivity Issues

**Problem:** Components don't update when state changes.

**Solution:**
- Ensure you're using `$state()` for reactive variables
- Check that derived values use `$derived()`
- Verify that effects use `$effect()`

### 2. TypeScript Errors

**Problem:** TypeScript errors after migration.

**Solution:**
- Update your TypeScript version
- Run `svelte-check` to identify issues
- Update type definitions in `app.d.ts`
- Use the `$props<Type>()` syntax for typed props

### 3. Third-Party Library Compatibility

**Problem:** Third-party libraries don't work with Svelte 5.

**Solution:**
- Check if the library has a Svelte 5 compatible version
- Look for alternative libraries
- Create a wrapper component that bridges the compatibility gap

### 4. Server-Side Rendering Issues

**Problem:** Components render differently on server and client.

**Solution:**
- Use `$effect.server()` and `$effect.client()` for platform-specific code
- Check for browser-only APIs and use `if (browser)` checks
- Ensure hydration works correctly by avoiding DOM manipulation before hydration

## Testing After Migration

### 1. Unit Tests

Update your testing setup:

```javascript
// svelte.config.js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // ...
  }
};

export default config;
```

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
```

### 2. End-to-End Tests

Update your Playwright configuration:

```javascript
// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173
  },
  testDir: 'e2e',
  testMatch: /(.+\.)?(test|spec)\.[jt]s/
});
```

## Performance Considerations

### 1. Bundle Size

Svelte 5 may have a different bundle size impact than Svelte 4. Monitor your bundle size:

```bash
npm run build
```

Use tools like `source-map-explorer` to analyze your bundle:

```bash
npx source-map-explorer build/client/_app/immutable/entry/*.js
```

### 2. Rendering Performance

Svelte 5's new reactivity system may affect rendering performance. Profile your application:

1. Use Chrome DevTools Performance tab
2. Look for long tasks and rendering bottlenecks
3. Optimize components that re-render frequently

### 3. Memory Usage

Monitor memory usage:

1. Use Chrome DevTools Memory tab
2. Look for memory leaks
3. Ensure `$effect()` cleanup functions are properly implemented

## Compatibility with Third-Party Libraries

### 1. Svelte Actions

Many Svelte actions need updates for Svelte 5:

**Svelte 4:**

```javascript
// src/lib/actions/clickOutside.js
export function clickOutside(node, callback) {
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
```

**Svelte 5:**

```javascript
// src/lib/actions/clickOutside.js
export function clickOutside(node, callback) {
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
```

The action API remains the same in Svelte 5.

### 2. UI Component Libraries

Check if your UI libraries support Svelte 5:

- **Supported:** Use as normal
- **Partially supported:** Check documentation for compatibility notes
- **Not supported:** Consider alternatives or create wrappers

### 3. Animation Libraries

Animation libraries may need updates for Svelte 5:

- **Svelte transitions:** Work the same in Svelte 5
- **Third-party animations:** May need updates for Runes compatibility

### 4. State Management Libraries

With Svelte 5's Runes, many state management libraries become less necessary:

- **Svelte stores:** Still work but less needed
- **Redux/Zustand:** Can still be used but consider Runes for simpler state
- **XState:** Still valuable for complex state machines
