# Advanced Usage and Practical Examples

**Document Number**: GUIDE-004  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Advanced State Management](#advanced-state-management)
2. [Authentication and Authorization](#authentication-and-authorization)
3. [Real-time Features with WebSockets](#real-time-features-with-websockets)
4. [Internationalization (i18n)](#internationalization-i18n)
5. [Testing Strategies](#testing-strategies)
6. [Performance Optimization](#performance-optimization)
7. [Deployment Strategies](#deployment-strategies)
8. [Integration with External APIs](#integration-with-external-apis)

## Advanced State Management

### Custom Stores

While Svelte 5's Runes system reduces the need for stores, they're still useful for sharing state across components:

```javascript
// src/lib/stores/cart.js
import { writable, derived } from 'svelte/store';

function createCart() {
  const { subscribe, set, update } = writable([]);
  
  return {
    subscribe,
    addItem: (item) => update(items => [...items, item]),
    removeItem: (id) => update(items => items.filter(item => item.id !== id)),
    clear: () => set([]),
    updateQuantity: (id, quantity) => update(items => 
      items.map(item => item.id === id ? { ...item, quantity } : item)
    )
  };
}

export const cart = createCart();

export const cartTotal = derived(cart, $cart => 
  $cart.reduce((total, item) => total + (item.price * item.quantity), 0)
);
```

Using the store:

```svelte
<script>
  import { cart, cartTotal } from '$lib/stores/cart';
</script>

<div class="cart">
  <h2>Your Cart</h2>
  
  {#if $cart.length === 0}
    <p>Your cart is empty</p>
  {:else}
    <ul>
      {#each $cart as item}
        <li>
          {item.name} - ${item.price} x {item.quantity}
          <button on:click={() => cart.removeItem(item.id)}>Remove</button>
        </li>
      {/each}
    </ul>
    
    <p>Total: ${$cartTotal.toFixed(2)}</p>
  {/if}
</div>
```

### Context API

For component trees that need shared state without prop drilling:

```svelte
<!-- src/routes/theme-provider.svelte -->
<script>
  import { setContext } from 'svelte';
  
  let theme = $state('light');
  
  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
  }
  
  setContext('theme', {
    getTheme: () => theme,
    toggleTheme
  });
</script>

<div class="theme-{theme}">
  <slot />
</div>
```

```svelte
<!-- src/lib/components/ThemeToggle.svelte -->
<script>
  import { getContext } from 'svelte';
  
  const { getTheme, toggleTheme } = getContext('theme');
  $: theme = getTheme();
</script>

<button on:click={toggleTheme}>
  Switch to {theme === 'light' ? 'dark' : 'light'} mode
</button>
```

## Authentication and Authorization

### Authentication Flow

```javascript
// src/routes/login/+page.server.js
import { fail, redirect } from '@sveltejs/kit';
import { authenticateUser } from '$lib/auth';

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get('username');
    const password = data.get('password');
    
    // Authentication logic
    try {
      const { user, token } = await authenticateUser(username, password);
      
      // Set authentication cookie
      cookies.set('auth', token, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
      
      throw redirect(303, '/dashboard');
    } catch (error) {
      return fail(401, {
        error: error.message,
        username
      });
    }
  }
};
```

### Protected Routes

```javascript
// src/hooks.server.js
import { redirect } from '@sveltejs/kit';
import { verifyToken } from '$lib/auth';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const token = event.cookies.get('auth');
  
  // Set default user state
  event.locals.user = { authenticated: false };
  
  if (token) {
    try {
      // Verify the token and get user data
      const userData = await verifyToken(token);
      
      event.locals.user = {
        authenticated: true,
        ...userData
      };
    } catch (error) {
      // Invalid token, clear it
      event.cookies.delete('auth', { path: '/' });
    }
  }
  
  // Check if the route requires authentication
  const requiresAuth = event.url.pathname.startsWith('/dashboard') ||
                       event.url.pathname.startsWith('/account');
  
  if (requiresAuth && !event.locals.user.authenticated) {
    throw redirect(303, `/login?redirectTo=${event.url.pathname}`);
  }
  
  // Check role-based permissions
  const adminRoutes = event.url.pathname.startsWith('/admin');
  
  if (adminRoutes && event.locals.user.role !== 'admin') {
    throw redirect(303, '/unauthorized');
  }
  
  return resolve(event);
}
```

### User Session Management

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { page } from '$app/stores';
  
  $: user = $page.data.user;
</script>

<header>
  <nav>
    <a href="/">Home</a>
    
    {#if user?.authenticated}
      <a href="/dashboard">Dashboard</a>
      <a href="/account">Account</a>
      
      {#if user.role === 'admin'}
        <a href="/admin">Admin</a>
      {/if}
      
      <form method="POST" action="/logout">
        <button type="submit">Logout</button>
      </form>
    {:else}
      <a href="/login">Login</a>
      <a href="/register">Register</a>
    {/if}
  </nav>
</header>

<main>
  <slot />
</main>
```

## Real-time Features with WebSockets

### Server Setup

```javascript
// src/lib/websocket.js
import { Server } from 'socket.io';

/** @type {import('@sveltejs/kit').Handle} */
export function setupWebSocketServer(server) {
  const io = new Server(server);
  
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Join a room
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });
    
    // Handle chat messages
    socket.on('chat-message', (data) => {
      io.to(data.roomId).emit('chat-message', {
        id: Date.now(),
        text: data.text,
        userId: data.userId,
        timestamp: new Date().toISOString()
      });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
  
  return io;
}
```

### Client Integration

```svelte
<!-- src/routes/chat/[roomId]/+page.svelte -->
<script>
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import io from 'socket.io-client';
  
  export let data;
  
  let socket;
  let messages = $state([]);
  let messageText = $state('');
  let connected = $state(false);
  
  $: roomId = $page.params.roomId;
  $: user = data.user;
  
  onMount(() => {
    // Connect to WebSocket server
    socket = io();
    
    socket.on('connect', () => {
      connected = true;
      
      // Join the chat room
      socket.emit('join-room', roomId);
    });
    
    socket.on('chat-message', (message) => {
      messages = [...messages, message];
    });
    
    socket.on('disconnect', () => {
      connected = false;
    });
  });
  
  onDestroy(() => {
    if (socket) {
      socket.disconnect();
    }
  });
  
  function sendMessage() {
    if (!messageText.trim() || !connected) return;
    
    socket.emit('chat-message', {
      roomId,
      text: messageText,
      userId: user.id
    });
    
    messageText = '';
  }
</script>

<div class="chat-container">
  <div class="messages">
    {#each messages as message}
      <div class="message {message.userId === user.id ? 'own' : 'other'}">
        <span class="user">{message.userId === user.id ? 'You' : message.userId}</span>
        <p>{message.text}</p>
        <span class="time">{new Date(message.timestamp).toLocaleTimeString()}</span>
      </div>
    {/each}
  </div>
  
  <form on:submit|preventDefault={sendMessage}>
    <input 
      type="text" 
      bind:value={messageText} 
      placeholder="Type a message..." 
      disabled={!connected} 
    />
    <button type="submit" disabled={!connected}>Send</button>
  </form>
  
  {#if !connected}
    <div class="connection-status">
      Disconnected. Trying to reconnect...
    </div>
  {/if}
</div>
```

## Internationalization (i18n)

### Setup with i18n Library

```javascript
// src/lib/i18n/index.js
import { init, register, locale } from 'svelte-i18n';
import { browser } from '$app/environment';

// Register locales
register('en', () => import('./locales/en.json'));
register('ja', () => import('./locales/ja.json'));
register('es', () => import('./locales/es.json'));

// Initialize i18n
export function initI18n() {
  init({
    fallbackLocale: 'en',
    initialLocale: browser ? window.navigator.language.split('-')[0] : 'en'
  });
}
```

### Usage in Components

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { onMount } from 'svelte';
  import { _, locale } from 'svelte-i18n';
  import { initI18n } from '$lib/i18n';
  
  // Initialize i18n
  initI18n();
  
  function changeLocale(event) {
    locale.set(event.target.value);
  }
</script>

<header>
  <h1>{$_('app.title')}</h1>
  
  <select on:change={changeLocale} value={$locale}>
    <option value="en">English</option>
    <option value="ja">日本語</option>
    <option value="es">Español</option>
  </select>
</header>

<main>
  <slot />
</main>

<footer>
  <p>{$_('app.footer')}</p>
</footer>
```

### Translation Files

```json
// src/lib/i18n/locales/en.json
{
  "app": {
    "title": "My Application",
    "footer": "© 2025 My Company"
  },
  "auth": {
    "login": "Log In",
    "register": "Register",
    "username": "Username",
    "password": "Password",
    "errors": {
      "invalidCredentials": "Invalid username or password"
    }
  }
}
```

## Testing Strategies

### Unit Testing Components

```javascript
// src/lib/components/Counter.test.js
import { render, fireEvent } from '@testing-library/svelte';
import Counter from './Counter.svelte';

describe('Counter Component', () => {
  test('renders with initial count of 0', () => {
    const { getByText } = render(Counter);
    expect(getByText('Count: 0')).toBeInTheDocument();
  });
  
  test('increments count when button is clicked', async () => {
    const { getByText } = render(Counter);
    const button = getByText('Increment');
    
    await fireEvent.click(button);
    expect(getByText('Count: 1')).toBeInTheDocument();
    
    await fireEvent.click(button);
    expect(getByText('Count: 2')).toBeInTheDocument();
  });
  
  test('accepts initial count prop', () => {
    const { getByText } = render(Counter, { props: { initialCount: 10 } });
    expect(getByText('Count: 10')).toBeInTheDocument();
  });
});
```

### Integration Testing

```javascript
// src/routes/login/+page.test.js
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { goto } from '$app/navigation';
import LoginPage from './+page.svelte';

// Mock SvelteKit modules
vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

vi.mock('$app/forms', () => ({
  enhance: () => (form) => ({})
}));

describe('Login Page', () => {
  test('renders login form', () => {
    const { getByLabelText, getByText } = render(LoginPage);
    
    expect(getByLabelText('Username')).toBeInTheDocument();
    expect(getByLabelText('Password')).toBeInTheDocument();
    expect(getByText('Log In')).toBeInTheDocument();
  });
  
  test('displays error message when form data contains error', () => {
    const { getByText } = render(LoginPage, {
      props: {
        form: {
          error: 'Invalid username or password'
        }
      }
    });
    
    expect(getByText('Invalid username or password')).toBeInTheDocument();
  });
});
```

### End-to-End Testing

```javascript
// e2e/login.spec.js
import { test, expect } from '@playwright/test';

test('login workflow', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');
  
  // Fill in login form
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'password123');
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Check that we're redirected to dashboard
  await expect(page).toHaveURL('/dashboard');
  
  // Verify dashboard elements
  await expect(page.locator('h1')).toHaveText('Dashboard');
  await expect(page.locator('.user-greeting')).toContainText('Welcome, testuser');
});
```

## Performance Optimization

### Code Splitting

SvelteKit automatically handles code splitting for routes. For manual splitting:

```javascript
// Dynamically import a component
import { onMount } from 'svelte';

let Chart;

onMount(async () => {
  const module = await import('$lib/components/Chart.svelte');
  Chart = module.default;
});
```

### Asset Optimization

```javascript
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { imagetools } from 'vite-imagetools';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [
    sveltekit(),
    imagetools()
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['chart.js', 'date-fns']
        }
      }
    }
  }
};

export default config;
```

### Lazy Loading

```svelte
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let MapComponent;
  
  onMount(async () => {
    if (browser) {
      const module = await import('$lib/components/Map.svelte');
      MapComponent = module.default;
    }
  });
</script>

<div class="map-container">
  {#if MapComponent}
    <svelte:component this={MapComponent} />
  {:else}
    <div class="loading">Loading map...</div>
  {/if}
</div>
```

## Deployment Strategies

### Static Site (SPA or SSG)

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html', // for SPA mode
      precompress: true
    })
  }
};

export default config;
```

### Node.js Server

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true
    })
  }
};

export default config;
```

### Serverless Deployment

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      edge: false,
      external: [],
      split: false
    })
  }
};

export default config;
```

## Integration with External APIs

### API Client Setup

```javascript
// src/lib/api/client.js
const BASE_URL = import.meta.env.VITE_API_URL;

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  const config = {
    method: options.method || 'GET',
    headers,
    ...options
  };
  
  if (options.body) {
    config.body = JSON.stringify(options.body);
  }
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

export const api = {
  get: (endpoint, options = {}) => 
    request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => 
    request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => 
    request(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, options = {}) => 
    request(endpoint, { ...options, method: 'DELETE' })
};
```

### Using the API Client

```javascript
// src/routes/products/+page.server.js
import { api } from '$lib/api/client';

export async function load({ fetch }) {
  try {
    // Using the fetch instance provided by SvelteKit
    const products = await api.get('/products', { fetch });
    
    return {
      products
    };
  } catch (error) {
    console.error('Failed to load products:', error);
    return {
      products: [],
      error: 'Failed to load products'
    };
  }
}
```
