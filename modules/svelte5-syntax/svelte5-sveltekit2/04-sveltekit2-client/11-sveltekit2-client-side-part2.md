# SvelteKit 2 Client-Side Features (Part 2)

**Document Number**: GUIDE-011B  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Custom Stores and State Management](#custom-stores-and-state-management)
2. [Client-Side Data Fetching](#client-side-data-fetching)
3. [Client Hooks](#client-hooks)
4. [Accessibility Features](#accessibility-features)

## Custom Stores and State Management

SvelteKit works seamlessly with Svelte's built-in store system, providing powerful state management capabilities.

### Derived Stores

```javascript
// src/lib/stores.js
import { writable, derived } from 'svelte/store';

// Base stores
export const products = writable([]);
export const searchQuery = writable('');
export const filters = writable({
  category: null,
  minPrice: 0,
  maxPrice: 1000,
  inStock: true
});

// Derived store for filtered products
export const filteredProducts = derived(
  [products, searchQuery, filters],
  ([$products, $searchQuery, $filters]) => {
    return $products
      .filter(product => {
        // Filter by search query
        if ($searchQuery && !product.name.toLowerCase().includes($searchQuery.toLowerCase())) {
          return false;
        }
        
        // Filter by category
        if ($filters.category && product.category !== $filters.category) {
          return false;
        }
        
        // Filter by price range
        if (product.price < $filters.minPrice || product.price > $filters.maxPrice) {
          return false;
        }
        
        // Filter by stock status
        if ($filters.inStock && !product.inStock) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }
);
```

```svelte
<!-- src/routes/products/+page.svelte -->
<script>
  import { products, searchQuery, filters, filteredProducts } from '$lib/stores';
  
  export let data;
  
  // Initialize products from server data
  $effect(() => {
    $products = data.products;
  });
  
  function updateCategory(event) {
    $filters.category = event.target.value || null;
  }
  
  function updatePriceRange(min, max) {
    $filters.minPrice = min;
    $filters.maxPrice = max;
  }
  
  function toggleInStock() {
    $filters.inStock = !$filters.inStock;
  }
</script>

<div class="filters">
  <input 
    type="text" 
    placeholder="Search products..." 
    bind:value={$searchQuery}
  />
  
  <select on:change={updateCategory}>
    <option value="">All Categories</option>
    {#each data.categories as category}
      <option value={category}>{category}</option>
    {/each}
  </select>
  
  <div class="price-range">
    <input 
      type="range" 
      min="0" 
      max="1000" 
      bind:value={$filters.minPrice}
    />
    <input 
      type="range" 
      min="0" 
      max="1000" 
      bind:value={$filters.maxPrice}
    />
    <span>${$filters.minPrice} - ${$filters.maxPrice}</span>
  </div>
  
  <label>
    <input 
      type="checkbox" 
      checked={$filters.inStock} 
      on:change={toggleInStock}
    />
    In Stock Only
  </label>
</div>

<div class="products">
  {#if $filteredProducts.length === 0}
    <p>No products found matching your criteria.</p>
  {:else}
    {#each $filteredProducts as product}
      <div class="product-card">
        <h3>{product.name}</h3>
        <p class="price">${product.price}</p>
        <p class="category">{product.category}</p>
        <p class="stock">
          {product.inStock ? 'In Stock' : 'Out of Stock'}
        </p>
      </div>
    {/each}
  {/if}
</div>
```

### Persistent Stores

```javascript
// src/lib/stores/persistent.js
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Create a writable store that persists to localStorage
export function persistentWritable(key, initialValue) {
  // Only access localStorage in the browser
  const storedValue = browser ? localStorage.getItem(key) : null;
  
  // Initialize with stored value or initial value
  const store = writable(
    storedValue ? JSON.parse(storedValue) : initialValue
  );
  
  // Subscribe to changes and update localStorage
  if (browser) {
    store.subscribe(value => {
      localStorage.setItem(key, JSON.stringify(value));
    });
  }
  
  return store;
}

// Example persistent stores
export const theme = persistentWritable('theme', 'light');
export const recentSearches = persistentWritable('recentSearches', []);
export const userPreferences = persistentWritable('userPreferences', {
  notifications: true,
  language: 'en',
  fontSize: 'medium'
});
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { theme, userPreferences } from '$lib/stores/persistent';
  
  function toggleTheme() {
    $theme = $theme === 'light' ? 'dark' : 'light';
  }
  
  function updateLanguage(event) {
    $userPreferences.language = event.target.value;
  }
  
  function updateFontSize(size) {
    $userPreferences.fontSize = size;
  }
  
  // Apply theme to document
  $effect(() => {
    if (browser) {
      document.documentElement.setAttribute('data-theme', $theme);
    }
  });
  
  // Apply font size to document
  $effect(() => {
    if (browser) {
      document.documentElement.setAttribute('data-font-size', $userPreferences.fontSize);
    }
  });
</script>

<div class="app" data-theme={$theme}>
  <header>
    <button on:click={toggleTheme}>
      {$theme === 'light' ? 'Dark Mode' : 'Light Mode'}
    </button>
    
    <select value={$userPreferences.language} on:change={updateLanguage}>
      <option value="en">English</option>
      <option value="fr">Français</option>
      <option value="ja">日本語</option>
    </select>
    
    <div class="font-size-controls">
      <button on:click={() => updateFontSize('small')}>A-</button>
      <button on:click={() => updateFontSize('medium')}>A</button>
      <button on:click={() => updateFontSize('large')}>A+</button>
    </div>
  </header>
  
  <main>
    <slot></slot>
  </main>
</div>
```

### Context Stores

```javascript
// src/lib/stores/context.js
import { getContext, setContext } from 'svelte';
import { writable } from 'svelte/store';

// Create a key for the context
const TOAST_KEY = Symbol('toast');

// Create a toast store
export function createToastStore() {
  const toasts = writable([]);
  
  return {
    subscribe: toasts.subscribe,
    add: (message, type = 'info', timeout = 3000) => {
      const id = Date.now();
      
      toasts.update(all => [
        ...all,
        { id, message, type, timeout }
      ]);
      
      if (timeout > 0) {
        setTimeout(() => {
          toasts.update(all => all.filter(t => t.id !== id));
        }, timeout);
      }
      
      return id;
    },
    remove: (id) => {
      toasts.update(all => all.filter(t => t.id !== id));
    },
    clear: () => {
      toasts.set([]);
    }
  };
}

// Set up the toast context
export function setToastContext() {
  const toastStore = createToastStore();
  setContext(TOAST_KEY, toastStore);
  return toastStore;
}

// Get the toast store from context
export function getToastStore() {
  return getContext(TOAST_KEY);
}
```

```svelte
<!-- src/lib/components/ToastProvider.svelte -->
<script>
  import { setToastContext } from '$lib/stores/context';
  import Toast from '$lib/components/Toast.svelte';
  
  // Create and provide the toast store
  const toasts = setToastContext();
</script>

<slot></slot>

<!-- Render toasts -->
<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <Toast {...toast} on:close={() => toasts.remove(toast.id)} />
  {/each}
</div>
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import ToastProvider from '$lib/components/ToastProvider.svelte';
</script>

<ToastProvider>
  <slot></slot>
</ToastProvider>
```

```svelte
<!-- src/routes/products/+page.svelte -->
<script>
  import { getToastStore } from '$lib/stores/context';
  
  const toast = getToastStore();
  
  function addToCart(product) {
    // Add product to cart
    cart.addItem(product);
    
    // Show success toast
    toast.add(`Added ${product.name} to cart`, 'success');
  }
  
  function handleError() {
    toast.add('An error occurred', 'error', 5000);
  }
</script>
```

### Store Patterns for Complex State

```javascript
// src/lib/stores/auth.js
import { writable, derived } from 'svelte/store';
import { goto } from '$app/navigation';

// Create the base auth store
function createAuthStore() {
  const { subscribe, set, update } = writable({
    user: null,
    token: null,
    loading: false,
    error: null
  });
  
  return {
    subscribe,
    
    // Initialize from session storage
    init: () => {
      if (browser) {
        const storedUser = sessionStorage.getItem('user');
        const storedToken = sessionStorage.getItem('token');
        
        if (storedUser && storedToken) {
          set({
            user: JSON.parse(storedUser),
            token: storedToken,
            loading: false,
            error: null
          });
        }
      }
    },
    
    // Login
    login: async (username, password) => {
      update(state => ({ ...state, loading: true, error: null }));
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Login failed');
        }
        
        const { user, token } = await response.json();
        
        // Store in session storage
        sessionStorage.setItem('user', JSON.stringify(user));
        sessionStorage.setItem('token', token);
        
        update(state => ({
          ...state,
          user,
          token,
          loading: false,
          error: null
        }));
        
        return { success: true };
      } catch (error) {
        update(state => ({
          ...state,
          loading: false,
          error: error.message
        }));
        
        return { success: false, error: error.message };
      }
    },
    
    // Logout
    logout: () => {
      // Clear session storage
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
      
      set({
        user: null,
        token: null,
        loading: false,
        error: null
      });
      
      // Redirect to login page
      goto('/login');
    },
    
    // Update user
    updateUser: (userData) => {
      update(state => {
        const updatedUser = { ...state.user, ...userData };
        
        // Update session storage
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
        
        return {
          ...state,
          user: updatedUser
        };
      });
    },
    
    // Clear error
    clearError: () => {
      update(state => ({ ...state, error: null }));
    }
  };
}

// Create and export the auth store
export const auth = createAuthStore();

// Derived stores for specific auth state
export const user = derived(auth, $auth => $auth.user);
export const isAuthenticated = derived(auth, $auth => !!$auth.user);
export const isAdmin = derived(auth, $auth => $auth.user?.role === 'admin');
export const authLoading = derived(auth, $auth => $auth.loading);
export const authError = derived(auth, $auth => $auth.error);
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { onMount } from 'svelte';
  import { auth, isAuthenticated, user } from '$lib/stores/auth';
  
  onMount(() => {
    // Initialize auth state from session storage
    auth.init();
  });
</script>

<header>
  <nav>
    <a href="/">Home</a>
    <a href="/products">Products</a>
    
    {#if $isAuthenticated}
      <a href="/profile">Profile ({$user.name})</a>
      <button on:click={() => auth.logout()}>Log out</button>
    {:else}
      <a href="/login">Log in</a>
      <a href="/register">Register</a>
    {/if}
  </nav>
</header>

<main>
  <slot></slot>
</main>
```

## Client-Side Data Fetching

SvelteKit provides several methods for fetching data on the client side.

### Using the fetch API

```svelte
<script>
  import { onMount } from 'svelte';
  
  let products = [];
  let loading = true;
  let error = null;
  
  onMount(async () => {
    try {
      const response = await fetch('/api/products');
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      
      products = await response.json();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <p>Loading products...</p>
{:else if error}
  <p class="error">Error: {error}</p>
{:else}
  <div class="products">
    {#each products as product}
      <div class="product-card">
        <h3>{product.name}</h3>
        <p>${product.price}</p>
      </div>
    {/each}
  </div>
{/if}
```

### Using Load Functions

```javascript
// src/routes/products/+page.js
export async function load({ fetch, depends }) {
  depends('data:products');
  
  const response = await fetch('/api/products');
  
  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }
  
  const products = await response.json();
  
  return {
    products
  };
}
```

```svelte
<!-- src/routes/products/+page.svelte -->
<script>
  import { invalidate } from '$app/navigation';
  
  export let data;
  
  async function refreshProducts() {
    await invalidate('data:products');
  }
</script>

<button on:click={refreshProducts}>Refresh</button>

<div class="products">
  {#each data.products as product}
    <div class="product-card">
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </div>
  {/each}
</div>
```

### Handling Loading States

```svelte
<script>
  import { navigating } from '$app/stores';
  
  export let data;
</script>

{#if $navigating?.to?.url.pathname === '/products'}
  <div class="loading-overlay">
    <div class="spinner"></div>
    <p>Loading products...</p>
  </div>
{/if}

<div class="products" class:loading={$navigating?.to?.url.pathname === '/products'}>
  {#each data.products as product}
    <div class="product-card">
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </div>
  {/each}
</div>

<style>
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .spinner {
    /* Spinner styles */
  }
  
  .products.loading {
    opacity: 0.5;
  }
</style>
```

### Data Fetching with Authentication

```javascript
// src/lib/api.js
import { auth } from '$lib/stores/auth';
import { get } from 'svelte/store';

// Create an authenticated fetch function
export async function apiFetch(endpoint, options = {}) {
  const authState = get(auth);
  
  // Add authorization header if token exists
  if (authState.token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${authState.token}`
    };
  }
  
  // Make the request
  const response = await fetch(`/api/${endpoint}`, options);
  
  // Handle 401 Unauthorized
  if (response.status === 401) {
    // Token might be expired, log out
    auth.logout();
    throw new Error('Your session has expired. Please log in again.');
  }
  
  return response;
}

// API methods
export async function getProducts() {
  const response = await apiFetch('products');
  
  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }
  
  return response.json();
}

export async function getProduct(id) {
  const response = await apiFetch(`products/${id}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch product');
  }
  
  return response.json();
}

export async function createProduct(product) {
  const response = await apiFetch('products', {
    method: 'POST',
    body: JSON.stringify(product),
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to create product');
  }
  
  return response.json();
}
```

```svelte
<!-- src/routes/products/new/+page.svelte -->
<script>
  import { createProduct } from '$lib/api';
  import { getToastStore } from '$lib/stores/context';
  import { goto } from '$app/navigation';
  
  const toast = getToastStore();
  
  let name = '';
  let price = '';
  let description = '';
  let submitting = false;
  
  async function handleSubmit() {
    submitting = true;
    
    try {
      const newProduct = await createProduct({
        name,
        price: parseFloat(price),
        description
      });
      
      toast.add('Product created successfully', 'success');
      goto(`/products/${newProduct.id}`);
    } catch (error) {
      toast.add(error.message, 'error');
    } finally {
      submitting = false;
    }
  }
</script>

<h1>Create New Product</h1>

<form on:submit|preventDefault={handleSubmit}>
  <div>
    <label for="name">Name</label>
    <input id="name" bind:value={name} required />
  </div>
  
  <div>
    <label for="price">Price</label>
    <input id="price" type="number" step="0.01" bind:value={price} required />
  </div>
  
  <div>
    <label for="description">Description</label>
    <textarea id="description" bind:value={description} rows="5"></textarea>
  </div>
  
  <button type="submit" disabled={submitting}>
    {submitting ? 'Creating...' : 'Create Product'}
  </button>
</form>
```

## Client Hooks

SvelteKit provides client-side hooks for handling navigation and other events.

### Client Hooks in +layout.js

```javascript
// src/routes/+layout.js
import { dev } from '$app/environment';

// This runs when the app starts
export function load() {
  // Initialize analytics
  if (!dev) {
    initAnalytics();
  }
  
  return {};
}

// This runs when the page is first loaded
export const ssr = true;

// This runs when the page is loaded via client-side navigation
export const csr = true;

// This runs when the page is prerendered at build time
export const prerender = false;

// This runs when the page is loaded via client-side navigation
export const trailingSlash = 'never';

function initAnalytics() {
  // Implementation
}
```

### Page Transitions

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { fade } from 'svelte/transition';
  import { navigating, page } from '$app/stores';
  
  // Generate a unique key for each page
  $effect(() => {
    pageKey = $page.url.pathname;
  });
  
  let pageKey;
</script>

<header>
  <!-- Navigation -->
</header>

{#key pageKey}
  <main in:fade={{ duration: 250, delay: 250 }} out:fade={{ duration: 250 }}>
    <slot></slot>
  </main>
{/key}
```

### Scroll Handling

```javascript
// src/hooks.client.js
import { afterNavigate } from '$app/navigation';

// Handle scroll restoration
afterNavigate(({ from, to }) => {
  // If navigating to a new page (not just a hash change)
  if (from && to && from.url.pathname !== to.url.pathname) {
    // Scroll to top
    window.scrollTo(0, 0);
  }
  
  // If navigating to a hash
  if (to.url.hash) {
    const element = document.getElementById(to.url.hash.substring(1));
    if (element) {
      // Scroll to the element
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
});
```

### Analytics Integration

```javascript
// src/hooks.client.js
import { afterNavigate } from '$app/navigation';
import { page } from '$app/stores';
import { dev } from '$app/environment';

// Track page views
afterNavigate(({ to }) => {
  if (!dev) {
    // Send page view to analytics
    trackPageView({
      url: to.url.pathname,
      title: document.title
    });
  }
});

// Track errors
window.addEventListener('error', (event) => {
  if (!dev) {
    // Send error to analytics
    trackError({
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack
    });
  }
});

function trackPageView(data) {
  // Implementation
}

function trackError(data) {
  // Implementation
}
```

## Accessibility Features

SvelteKit provides tools and patterns for building accessible applications.

### Focus Management

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { afterNavigate } from '$app/navigation';
  
  // Focus management for navigation
  afterNavigate(({ from, to, type }) => {
    // Only handle client-side navigation
    if (type === 'link' || type === 'goto') {
      // Find the main content element
      const mainContent = document.getElementById('main-content');
      
      if (mainContent) {
        // Set focus to the main content
        mainContent.focus();
      }
    }
  });
</script>

<div class="skip-link">
  <a href="#main-content">Skip to main content</a>
</div>

<header>
  <!-- Navigation -->
</header>

<main id="main-content" tabindex="-1">
  <slot></slot>
</main>

<style>
  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: #000;
    color: white;
    padding: 8px;
    z-index: 100;
  }
  
  .skip-link:focus {
    top: 0;
  }
  
  #main-content:focus {
    outline: none;
  }
</style>
```

### Accessible Routing

```svelte
<!-- src/lib/components/NavLink.svelte -->
<script>
  import { page } from '$app/stores';
  
  export let href;
  export let exact = false;
  
  $effect(() => {
    active = exact
      ? $page.url.pathname === href
      : $page.url.pathname.startsWith(href);
  });
  
  let active;
</script>

<a {href} aria-current={active ? 'page' : undefined} class:active>
  <slot></slot>
</a>

<style>
  a {
    text-decoration: none;
    padding: 0.5rem 1rem;
    color: var(--text-color);
  }
  
  a.active {
    font-weight: bold;
    color: var(--accent-color);
  }
</style>
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import NavLink from '$lib/components/NavLink.svelte';
</script>

<nav aria-label="Main Navigation">
  <ul>
    <li>
      <NavLink href="/" exact>Home</NavLink>
    </li>
    <li>
      <NavLink href="/products">Products</NavLink>
    </li>
    <li>
      <NavLink href="/about">About</NavLink>
    </li>
    <li>
      <NavLink href="/contact">Contact</NavLink>
    </li>
  </ul>
</nav>
```

### Announcing Route Changes

```svelte
<!-- src/lib/components/RouteAnnouncer.svelte -->
<script>
  import { afterNavigate } from '$app/navigation';
  
  let message = '';
  
  afterNavigate(({ to }) => {
    // Get the page title
    const pageTitle = document.title;
    
    // Set the announcement message
    message = `Navigated to ${pageTitle}`;
  });
</script>

<!-- Visually hidden but announced by screen readers -->
<div 
  aria-live="assertive" 
  aria-atomic="true" 
  class="sr-only"
>
  {message}
</div>

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
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import RouteAnnouncer from '$lib/components/RouteAnnouncer.svelte';
</script>

<!-- Add the route announcer -->
<RouteAnnouncer />

<header>
  <!-- Navigation -->
</header>

<main>
  <slot></slot>
</main>
```

### Loading State Announcements

```svelte
<!-- src/lib/components/LoadingAnnouncer.svelte -->
<script>
  import { navigating } from '$app/stores';
  
  let message = '';
  
  $effect(() => {
    if ($navigating) {
      message = `Loading ${$navigating.to.url.pathname}`;
    } else {
      message = '';
    }
  });
</script>

<div 
  aria-live="polite" 
  aria-atomic="true" 
  class="sr-only"
>
  {message}
</div>

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
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import LoadingAnnouncer from '$lib/components/LoadingAnnouncer.svelte';
</script>

<!-- Add the loading announcer -->
<LoadingAnnouncer />

<header>
  <!-- Navigation -->
</header>

<main>
  <slot></slot>
</main>
```
