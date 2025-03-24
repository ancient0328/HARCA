# SvelteKit 2 Client-Side Features (Part 1)

**Document Number**: GUIDE-011A  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Client-Side Rendering Overview](#client-side-rendering-overview)
2. [Navigation and Routing](#navigation-and-routing)
3. [Page and Layout Data](#page-and-layout-data)
4. [Form Handling](#form-handling)
5. [Stores and State Management](#stores-and-state-management)

## Client-Side Rendering Overview

SvelteKit combines server-side rendering (SSR) with client-side rendering (CSR) to provide a smooth user experience. After the initial server-rendered page load, SvelteKit takes over navigation on the client side, updating only the parts of the page that need to change.

### Hydration

Hydration is the process of attaching JavaScript event listeners and state to server-rendered HTML. SvelteKit handles this automatically:

1. The server renders the initial HTML
2. The client loads the JavaScript
3. The JavaScript "hydrates" the HTML, making it interactive

### Rendering Strategies

SvelteKit supports several rendering strategies that you can configure:

- **Server-Side Rendering (SSR)**: The default strategy where pages are rendered on the server
- **Client-Side Rendering (CSR)**: Pages are rendered entirely in the browser
- **Static Site Generation (SSG)**: Pages are pre-rendered at build time
- **Hybrid Rendering**: Different strategies for different routes

### Configuring Rendering Mode

```javascript
// src/routes/+layout.js or src/routes/+layout.server.js
export const ssr = true;  // Enable server-side rendering (default)
export const csr = true;  // Enable client-side rendering (default)
export const prerender = false;  // Disable prerendering (default)
```

For specific routes:

```javascript
// src/routes/static/+page.js
export const prerender = true;  // Prerender this page at build time
```

```javascript
// src/routes/spa/+layout.js
export const ssr = false;  // Disable server-side rendering for this route
```

## Navigation and Routing

SvelteKit provides utilities for client-side navigation between pages.

### Basic Navigation

```svelte
<script>
  import { page } from '$app/stores';
</script>

<!-- Regular links work with SvelteKit's client-side router -->
<nav>
  <a href="/">Home</a>
  <a href="/about">About</a>
  <a href="/contact">Contact</a>
  
  <!-- Active link styling -->
  <a 
    href="/blog"
    class:active={$page.url.pathname.startsWith('/blog')}
  >
    Blog
  </a>
</nav>

<style>
  .active {
    font-weight: bold;
    color: var(--accent-color);
  }
</style>
```

### Programmatic Navigation

```svelte
<script>
  import { goto, invalidate, preloadData, preloadCode } from '$app/navigation';
  
  function navigateToDashboard() {
    goto('/dashboard');
  }
  
  function refreshData() {
    invalidate('data:posts');  // Invalidate specific data
  }
  
  function preloadBlogPage() {
    preloadData('/blog');  // Preload data for the blog page
    preloadCode('/blog');  // Preload code for the blog page
  }
</script>

<button on:click={navigateToDashboard}>
  Go to Dashboard
</button>

<button on:click={refreshData}>
  Refresh Posts
</button>

<a 
  href="/blog"
  on:mouseenter={preloadBlogPage}
>
  Blog
</a>
```

### Navigation Options

```javascript
// Navigate with options
goto('/dashboard', {
  replaceState: true,      // Replace the current history entry
  noScroll: true,          // Don't scroll to top after navigation
  keepFocus: true,         // Keep the current focused element
  invalidateAll: true      // Invalidate all data
});
```

### Navigation Events

```svelte
<script>
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  
  let saving = false;
  
  // Called before navigation occurs
  beforeNavigate(({ from, to, cancel }) => {
    if (saving) {
      // Prevent navigation while saving
      if (!confirm('You have unsaved changes. Continue?')) {
        cancel();
      }
    }
    
    // You can also redirect
    if (to?.url.pathname === '/old-page') {
      goto('/new-page');
      cancel();
    }
  });
  
  // Called after navigation completes
  afterNavigate(({ from, to }) => {
    console.log(`Navigated from ${from?.url.pathname || 'nowhere'} to ${to.url.pathname}`);
    
    // Scroll to hash if present
    if (to.url.hash) {
      const element = document.getElementById(to.url.hash.substring(1));
      if (element) {
        element.scrollIntoView();
      }
    }
  });
  
  async function save() {
    saving = true;
    await saveData();
    saving = false;
  }
</script>
```

### Prefetching

```svelte
<script>
  import { prefetch, prefetchRoutes } from '$app/navigation';
  
  // Prefetch a specific route
  function handleMouseEnter() {
    prefetch('/blog');
  }
  
  // Prefetch all routes
  onMount(() => {
    prefetchRoutes();
  });
</script>

<a 
  href="/blog"
  on:mouseenter={handleMouseEnter}
>
  Blog
</a>
```

### Current Page Information

```svelte
<script>
  import { page } from '$app/stores';
  
  $effect(() => {
    // Log when the page changes
    console.log('Current path:', $page.url.pathname);
    console.log('Query parameters:', $page.url.searchParams);
    console.log('Route parameters:', $page.params);
    console.log('Route ID:', $page.route.id);
  });
</script>

<div>
  <h1>Current page: {$page.url.pathname}</h1>
  
  {#if $page.url.searchParams.has('q')}
    <p>Search query: {$page.url.searchParams.get('q')}</p>
  {/if}
  
  {#if $page.params.id}
    <p>ID: {$page.params.id}</p>
  {/if}
</div>
```

### Working with URLs

```svelte
<script>
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  
  // Create a URL relative to the base path
  const profileUrl = `${base}/profile`;
  
  // Create a URL with query parameters
  function createSearchUrl(query) {
    const url = new URL($page.url);
    url.searchParams.set('q', query);
    return url.toString();
  }
  
  // Get the current query parameter
  const currentQuery = $page.url.searchParams.get('q') || '';
</script>

<a href={profileUrl}>Profile</a>
<a href={createSearchUrl('svelte')}>Search for Svelte</a>

<p>Current search: {currentQuery}</p>
```

## Page and Layout Data

SvelteKit provides access to data loaded by page and layout load functions.

### Accessing Page Data

```svelte
<!-- src/routes/blog/[slug]/+page.svelte -->
<script>
  export let data;
  
  // Data from +page.js or +page.server.js
  const { post, relatedPosts } = data;
</script>

<article>
  <h1>{post.title}</h1>
  <div class="content">{@html post.content}</div>
  
  <h2>Related Posts</h2>
  <ul>
    {#each relatedPosts as related}
      <li>
        <a href="/blog/{related.slug}">{related.title}</a>
      </li>
    {/each}
  </ul>
</article>
```

### Accessing Layout Data

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  export let data;
  
  // Data from +layout.js or +layout.server.js
  const { user, navigation } = data;
</script>

<header>
  <nav>
    {#each navigation as item}
      <a href={item.href}>{item.label}</a>
    {/each}
  </nav>
  
  {#if user}
    <div class="user-menu">
      <span>Welcome, {user.name}</span>
      <a href="/profile">Profile</a>
      <a href="/logout">Log out</a>
    </div>
  {:else}
    <div class="auth-links">
      <a href="/login">Log in</a>
      <a href="/register">Register</a>
    </div>
  {/if}
</header>

<main>
  <slot></slot>
</main>
```

### Data Invalidation

```svelte
<script>
  import { invalidate, invalidateAll } from '$app/navigation';
  
  async function refreshPosts() {
    // Invalidate specific data
    await invalidate('data:posts');
  }
  
  async function refreshAll() {
    // Invalidate all data
    await invalidateAll();
  }
  
  async function createPost() {
    await fetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Invalidate posts data
    await invalidate('data:posts');
  }
</script>

<button on:click={refreshPosts}>Refresh Posts</button>
<button on:click={refreshAll}>Refresh All</button>
<button on:click={createPost}>Create Post</button>
```

### Dependent Data

```javascript
// src/routes/blog/+page.js
export async function load({ fetch, depends }) {
  // Declare a dependency
  depends('data:posts');
  
  const response = await fetch('/api/posts');
  const posts = await response.json();
  
  return {
    posts
  };
}
```

```svelte
<!-- src/routes/blog/+page.svelte -->
<script>
  import { invalidate } from '$app/navigation';
  
  export let data;
  
  async function refreshPosts() {
    // This will trigger a reload of the page data
    await invalidate('data:posts');
  }
</script>

<button on:click={refreshPosts}>Refresh</button>

<ul>
  {#each data.posts as post}
    <li>
      <a href="/blog/{post.slug}">{post.title}</a>
    </li>
  {/each}
</ul>
```

### Parent Data

```javascript
// src/routes/dashboard/+layout.js
export async function load({ parent }) {
  // Get data from parent layout
  const parentData = await parent();
  
  // Use parent data
  const dashboardItems = filterItemsByRole(parentData.user.role);
  
  return {
    dashboardItems
  };
}
```

```svelte
<!-- src/routes/dashboard/+layout.svelte -->
<script>
  export let data;
  
  // Combine data from this layout and parent layouts
  const { user } = data;  // From parent layout
  const { dashboardItems } = data;  // From this layout
</script>

<div class="dashboard">
  <aside>
    <nav>
      {#each dashboardItems as item}
        <a href={item.href}>{item.label}</a>
      {/each}
    </nav>
  </aside>
  
  <main>
    <slot></slot>
  </main>
</div>
```

## Form Handling

SvelteKit provides utilities for handling forms with progressive enhancement.

### Basic Form Handling

```svelte
<!-- src/routes/login/+page.svelte -->
<script>
  export let form;
</script>

<form method="POST">
  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}
  
  <div>
    <label for="username">Username</label>
    <input 
      id="username" 
      name="username" 
      value={form?.username || ''} 
      required
    />
  </div>
  
  <div>
    <label for="password">Password</label>
    <input 
      id="password" 
      name="password" 
      type="password" 
      required
    />
  </div>
  
  <button type="submit">Log in</button>
</form>
```

### Enhanced Form Handling

```svelte
<script>
  import { enhance } from '$app/forms';
  
  export let form;
  
  let submitting = false;
</script>

<form 
  method="POST" 
  use:enhance={() => {
    submitting = true;
    
    return async ({ result, update }) => {
      submitting = false;
      
      if (result.type === 'success') {
        // Do something on success
      }
      
      // Update the form with the result
      await update();
    };
  }}
>
  <!-- Form fields -->
  
  <button type="submit" disabled={submitting}>
    {submitting ? 'Submitting...' : 'Submit'}
  </button>
</form>
```

### Form with Multiple Actions

```svelte
<!-- src/routes/profile/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  
  export let form;
  
  let submittingProfile = false;
  let submittingPassword = false;
</script>

<h1>Profile</h1>

<form 
  method="POST" 
  action="?/updateProfile"
  use:enhance={() => {
    submittingProfile = true;
    
    return async ({ result, update }) => {
      submittingProfile = false;
      await update();
    };
  }}
>
  <!-- Profile form fields -->
  <button type="submit" disabled={submittingProfile}>
    {submittingProfile ? 'Updating...' : 'Update Profile'}
  </button>
</form>

<form 
  method="POST" 
  action="?/changePassword"
  use:enhance={() => {
    submittingPassword = true;
    
    return async ({ result, update }) => {
      submittingPassword = false;
      await update();
    };
  }}
>
  <!-- Password form fields -->
  <button type="submit" disabled={submittingPassword}>
    {submittingPassword ? 'Changing...' : 'Change Password'}
  </button>
</form>

{#if form?.success}
  <p class="success">{form.message}</p>
{/if}

{#if form?.error}
  <p class="error">{form.error}</p>
{/if}
```

### Custom Form Submission

```svelte
<script>
  import { enhance } from '$app/forms';
  
  export let form;
  
  let submitting = false;
  let success = false;
  
  function handleEnhance() {
    submitting = true;
    success = false;
    
    return async ({ result, update }) => {
      submitting = false;
      
      if (result.type === 'success') {
        success = true;
        
        // Reset form
        document.querySelector('form').reset();
        
        // Don't update the form with the result
        // This prevents the form from being replaced
      } else {
        // Only update the form on error
        await update();
      }
    };
  }
</script>

<form method="POST" use:enhance={handleEnhance}>
  <!-- Form fields -->
  
  <button type="submit" disabled={submitting}>
    {submitting ? 'Submitting...' : 'Submit'}
  </button>
</form>

{#if success}
  <p class="success">Form submitted successfully!</p>
{/if}

{#if form?.error}
  <p class="error">{form.error}</p>
{/if}
```

### File Upload Form

```svelte
<script>
  import { enhance } from '$app/forms';
  
  export let form;
  
  let uploading = false;
  let progress = 0;
  
  function handleEnhance() {
    uploading = true;
    progress = 0;
    
    return async ({ formData, cancel }) => {
      const file = formData.get('file');
      
      if (!(file instanceof File) || file.size === 0) {
        alert('Please select a file');
        cancel();
        uploading = false;
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('File is too large (max 5MB)');
        cancel();
        uploading = false;
        return;
      }
      
      return async ({ result, update }) => {
        uploading = false;
        progress = 100;
        
        await update();
      };
    };
  }
  
  // Simulate progress
  $effect(() => {
    if (uploading && progress < 90) {
      const interval = setInterval(() => {
        progress += 5;
        if (progress >= 90) {
          clearInterval(interval);
        }
      }, 200);
      
      return () => clearInterval(interval);
    }
  });
</script>

<form 
  method="POST" 
  enctype="multipart/form-data"
  use:enhance={handleEnhance}
>
  <div>
    <label for="file">Choose a file</label>
    <input id="file" name="file" type="file" required />
  </div>
  
  <button type="submit" disabled={uploading}>
    {uploading ? 'Uploading...' : 'Upload'}
  </button>
  
  {#if uploading}
    <div class="progress">
      <div class="progress-bar" style="width: {progress}%"></div>
    </div>
  {/if}
</form>

{#if form?.success}
  <p>File {form.fileName} uploaded successfully!</p>
{/if}

{#if form?.error}
  <p class="error">{form.error}</p>
{/if}

<style>
  .progress {
    height: 20px;
    background-color: #f0f0f0;
    border-radius: 4px;
    margin-top: 10px;
  }
  
  .progress-bar {
    height: 100%;
    background-color: #4caf50;
    border-radius: 4px;
    transition: width 0.2s;
  }
</style>
```

## Stores and State Management

SvelteKit provides built-in stores for managing application state.

### Built-in Stores

```svelte
<script>
  import { page } from '$app/stores';
  import { navigating } from '$app/stores';
  
  // page store contains information about the current page
  $effect(() => {
    console.log('Current path:', $page.url.pathname);
    console.log('Route parameters:', $page.params);
    console.log('Query parameters:', $page.url.searchParams);
  });
  
  // navigating store is non-null during navigation
  $effect(() => {
    if ($navigating) {
      console.log(`Navigating from ${$navigating.from.url.pathname} to ${$navigating.to.url.pathname}`);
    }
  });
</script>

<!-- Show loading indicator during navigation -->
{#if $navigating}
  <div class="loading-indicator">
    Loading {$navigating.to.url.pathname}...
  </div>
{/if}

<!-- Display current page info -->
<div>
  <h1>Current page: {$page.url.pathname}</h1>
  
  {#if $page.params.id}
    <p>ID: {$page.params.id}</p>
  {/if}
</div>
```

### Custom Stores

```javascript
// src/lib/stores.js
import { writable } from 'svelte/store';

// Create a writable store
export const count = writable(0);

// Create a store with custom methods
function createCart() {
  const { subscribe, set, update } = writable([]);
  
  return {
    subscribe,
    addItem: (item) => update(items => [...items, item]),
    removeItem: (id) => update(items => items.filter(item => item.id !== id)),
    updateQuantity: (id, quantity) => update(items => 
      items.map(item => 
        item.id === id ? { ...item, quantity } : item
      )
    ),
    clear: () => set([])
  };
}

export const cart = createCart();
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { cart } from '$lib/stores';
  
  $effect(() => {
    // Save cart to localStorage when it changes
    localStorage.setItem('cart', JSON.stringify($cart));
  });
  
  // Load cart from localStorage on mount
  onMount(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      cart.set(JSON.parse(savedCart));
    }
  });
</script>

<div class="cart-icon">
  <span class="count">{$cart.length}</span>
</div>

<slot></slot>
```

```svelte
<!-- src/routes/products/[id]/+page.svelte -->
<script>
  import { cart } from '$lib/stores';
  
  export let data;
  const { product } = data;
  
  function addToCart() {
    cart.addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1
    });
  }
</script>

<div class="product">
  <h1>{product.name}</h1>
  <p class="price">${product.price}</p>
  
  <button on:click={addToCart}>Add to Cart</button>
</div>
```
