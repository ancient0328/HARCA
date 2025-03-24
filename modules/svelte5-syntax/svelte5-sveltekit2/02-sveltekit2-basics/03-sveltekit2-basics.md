# SvelteKit 2 Basics

**Document Number**: GUIDE-003  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Routing System](#routing-system)
2. [Server-Side Rendering](#server-side-rendering)
3. [Data Loading](#data-loading)
4. [Form Actions](#form-actions)
5. [API Routes](#api-routes)
6. [Hooks](#hooks)
7. [Environment Variables](#environment-variables)
8. [TypeScript Integration](#typescript-integration)

## Routing System

SvelteKit uses a file-based routing system where files in the `src/routes` directory automatically become routes in your application.

### Basic Routes

```
src/routes/
├── +page.svelte       # Home page (/)
├── about/
│   └── +page.svelte   # About page (/about)
└── contact/
    └── +page.svelte   # Contact page (/contact)
```

### Route Layouts

Layouts allow you to share UI elements across multiple pages:

```
src/routes/
├── +layout.svelte     # Root layout (applied to all pages)
├── +page.svelte       # Home page
└── dashboard/
    ├── +layout.svelte # Dashboard layout
    ├── +page.svelte   # Dashboard index (/dashboard)
    └── settings/
        └── +page.svelte # Dashboard settings (/dashboard/settings)
```

Example layout:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
</script>

<Header />

<main>
  <slot />
</main>

<Footer />
```

### Dynamic Routes

Dynamic segments in routes are denoted with square brackets:

```
src/routes/
└── users/
    └── [id]/
        └── +page.svelte  # User profile page (/users/123)
```

Accessing parameters:

```svelte
<script>
  import { page } from '$app/stores';
  
  // Access the id parameter
  $: userId = $page.params.id;
</script>

<h1>User Profile: {userId}</h1>
```

### Route Groups

Route groups allow you to organize routes without affecting the URL structure:

```
src/routes/
├── (auth)/           # Group for authentication routes
│   ├── login/
│   │   └── +page.svelte
│   └── register/
│       └── +page.svelte
└── (marketing)/      # Group for marketing pages
    ├── +layout.svelte
    ├── about/
    │   └── +page.svelte
    └── contact/
        └── +page.svelte
```

### Advanced Routing

#### Optional Parameters

```
src/routes/
└── blog/
    └── [[slug]]/
        └── +page.svelte  # Matches /blog and /blog/post-1
```

#### Rest Parameters

```
src/routes/
└── files/
    └── [...path]/
        └── +page.svelte  # Matches /files/a/b/c
```

## Server-Side Rendering

SvelteKit supports both server-side rendering (SSR) and client-side rendering (CSR).

### Controlling Rendering Mode

In `+page.js` or `+page.server.js`:

```javascript
export const ssr = true;  // Enable SSR (default)
export const csr = true;  // Enable client-side hydration (default)
```

To disable SSR for a specific route:

```javascript
// src/routes/heavy-client-page/+page.js
export const ssr = false;
```

To create a static page (prerendered at build time):

```javascript
// src/routes/about/+page.js
export const prerender = true;
```

## Data Loading

### Server-Side Data Loading

Use `+page.server.js` for server-only data loading:

```javascript
// src/routes/products/+page.server.js
import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
  const { fetch, params, locals } = event;
  
  try {
    const response = await fetch('/api/products');
    
    if (!response.ok) {
      throw error(response.status, 'Failed to load products');
    }
    
    const products = await response.json();
    
    return {
      products
    };
  } catch (e) {
    throw error(500, 'An error occurred while loading products');
  }
}
```

### Universal Data Loading

Use `+page.js` for data loading that runs on both server and client:

```javascript
// src/routes/products/+page.js
/** @type {import('./$types').PageLoad} */
export async function load({ fetch, depends }) {
  // Mark this load function as dependent on 'products'
  depends('products');
  
  const response = await fetch('/api/products');
  const products = await response.json();
  
  return {
    products
  };
}
```

### Using Loaded Data

```svelte
<!-- src/routes/products/+page.svelte -->
<script>
  /** @type {import('./$types').PageData} */
  export let data;
  
  $: ({ products } = data);
</script>

<h1>Products</h1>

<ul>
  {#each products as product}
    <li>{product.name} - ${product.price}</li>
  {/each}
</ul>
```

### Layout Data

Data can also be loaded at the layout level:

```javascript
// src/routes/+layout.server.js
/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals }) {
  return {
    user: locals.user
  };
}
```

## Form Actions

Form actions handle form submissions on the server.

### Basic Form Action

```javascript
// src/routes/login/+page.server.js
import { fail, redirect } from '@sveltejs/kit';

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get('username');
    const password = data.get('password');
    
    if (!username || !password) {
      return fail(400, {
        error: 'Username and password are required',
        username
      });
    }
    
    // Authentication logic
    if (username === 'admin' && password === 'password') {
      cookies.set('auth', 'token', { path: '/' });
      throw redirect(303, '/dashboard');
    }
    
    return fail(401, {
      error: 'Invalid username or password',
      username
    });
  }
};
```

### Form Component

```svelte
<!-- src/routes/login/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  
  /** @type {import('./$types').ActionData} */
  export let form;
</script>

<form method="POST" use:enhance>
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
    <input id="password" name="password" type="password" required />
  </div>
  
  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}
  
  <button type="submit">Log In</button>
</form>
```

### Multiple Form Actions

```javascript
// src/routes/profile/+page.server.js
/** @type {import('./$types').Actions} */
export const actions = {
  updateProfile: async ({ request, locals }) => {
    // Handle profile update
  },
  
  changePassword: async ({ request, locals }) => {
    // Handle password change
  }
};
```

```svelte
<!-- src/routes/profile/+page.svelte -->
<form method="POST" action="?/updateProfile">
  <!-- Profile form fields -->
</form>

<form method="POST" action="?/changePassword">
  <!-- Password form fields -->
</form>
```

## API Routes

API routes are defined using `+server.js` files:

```javascript
// src/routes/api/products/+server.js
import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
  const category = url.searchParams.get('category');
  
  // Fetch products from database
  const products = [
    { id: 1, name: 'Product 1', price: 99.99 },
    { id: 2, name: 'Product 2', price: 149.99 }
  ];
  
  return json(products);
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
  const product = await request.json();
  
  // Add product to database
  
  return json({ success: true, id: 3 }, { status: 201 });
}
```

## Hooks

Hooks allow you to run code during specific parts of the request/response lifecycle.

### Server Hooks

```javascript
// src/hooks.server.js
/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // Get the auth cookie
  const authToken = event.cookies.get('auth');
  
  if (authToken) {
    // Validate token and set user in locals
    event.locals.user = {
      authenticated: true,
      id: '123',
      name: 'John Doe'
    };
  } else {
    event.locals.user = {
      authenticated: false
    };
  }
  
  // Process the request
  const response = await resolve(event);
  
  // Add custom headers
  response.headers.set('x-custom-header', 'custom-value');
  
  return response;
}
```

### Handle Errors

```javascript
// src/hooks.server.js
/** @type {import('@sveltejs/kit').HandleServerError} */
export function handleError({ error, event }) {
  console.error('Server error:', error);
  
  // Log to error tracking service
  
  return {
    message: 'An unexpected error occurred',
    code: error?.code || 'UNKNOWN'
  };
}
```

## Environment Variables

SvelteKit provides a type-safe way to access environment variables.

### Setting Environment Variables

Create `.env` files in the project root:

```
# .env (committed to git, no secrets)
PUBLIC_API_URL=https://api.example.com

# .env.local (not committed, contains secrets)
DATABASE_URL=postgres://user:password@localhost:5432/db
```

### Accessing Environment Variables

```javascript
// Server-side only (private)
import { DATABASE_URL } from '$env/static/private';

// Client-side safe (public)
import { PUBLIC_API_URL } from '$env/static/public';

// Dynamic environment variables
import { env } from '$env/dynamic/private';
```

## TypeScript Integration

SvelteKit generates TypeScript definitions for your routes.

### App.d.ts

Define global types in `src/app.d.ts`:

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: {
        authenticated: boolean;
        id?: string;
        name?: string;
      };
    }
    
    interface PageData {
      user?: {
        authenticated: boolean;
        id?: string;
        name?: string;
      };
    }
    
    interface Error {
      code?: string;
    }
    
    interface Platform {
      // platform-specific context
    }
  }
}

export {};
```

### Generated Types

SvelteKit generates types for each route in `./$types.d.ts` files:

```typescript
// Example generated types
export type PageServerLoad = (
  event: RequestEvent
) => Promise<{
  products: Product[];
}>;

export type PageData = {
  products: Product[];
};

export type Actions = {
  default: (event: RequestEvent) => Promise<ActionResult>;
};

export type ActionData = {
  error?: string;
  username?: string;
};
```
