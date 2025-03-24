# SvelteKit 2 Routing Complete Reference

**Document Number**: GUIDE-009  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Routing Basics](#routing-basics)
2. [File-Based Routing](#file-based-routing)
3. [Route Parameters](#route-parameters)
4. [Nested Routes](#nested-routes)
5. [Layout Routes](#layout-routes)
6. [Error Handling](#error-handling)
7. [Redirects](#redirects)
8. [Navigation](#navigation)
9. [Route Matching](#route-matching)
10. [Advanced Routing Techniques](#advanced-routing-techniques)

## Routing Basics

SvelteKit uses a file-based routing system where the structure of your routes directory determines the routes of your application.

**Basic Routing Structure:**

```
src/
└── routes/
    ├── +page.svelte       # Renders the home page (/)
    ├── about/
    │   └── +page.svelte   # Renders the about page (/about)
    └── contact/
        └── +page.svelte   # Renders the contact page (/contact)
```

**Route Files:**

- **+page.svelte**: Defines a page component
- **+page.js/ts**: Defines client-side load functions
- **+page.server.js/ts**: Defines server-side load functions
- **+layout.svelte**: Defines a layout component
- **+layout.js/ts**: Defines client-side layout load functions
- **+layout.server.js/ts**: Defines server-side layout load functions
- **+server.js/ts**: Defines API endpoints
- **+error.svelte**: Defines error pages

## File-Based Routing

### Page Routes

Page routes render components at specific URLs.

**Basic Page Route:**

```svelte
<!-- src/routes/+page.svelte -->
<h1>Home Page</h1>
<p>Welcome to my website!</p>
```

**Page with Data Loading:**

```svelte
<!-- src/routes/blog/+page.svelte -->
<script>
  // Data is passed from +page.js or +page.server.js
  export let data;
</script>

<h1>Blog Posts</h1>

<ul>
  {#each data.posts as post}
    <li>
      <a href="/blog/{post.slug}">{post.title}</a>
    </li>
  {/each}
</ul>
```

```javascript
// src/routes/blog/+page.server.js
export async function load() {
  // Fetch data from a database or API
  const posts = await db.getRecentPosts();
  
  return {
    posts
  };
}
```

### API Routes

API routes handle server-side logic and respond to HTTP requests.

```javascript
// src/routes/api/users/+server.js
import { json } from '@sveltejs/kit';

export async function GET(event) {
  const users = await db.getUsers();
  
  return json(users);
}

export async function POST(event) {
  const data = await event.request.json();
  const newUser = await db.createUser(data);
  
  return json(newUser, { status: 201 });
}
```

**Accessing API Routes:**

```javascript
// Client-side code
const response = await fetch('/api/users');
const users = await response.json();
```

## Route Parameters

Route parameters allow you to create dynamic routes that match multiple URLs.

**Basic Parameter:**

```
src/routes/
└── blog/
    ├── +page.svelte
    └── [slug]/
        └── +page.svelte  # Matches /blog/any-slug
```

**Accessing Parameters:**

```svelte
<!-- src/routes/blog/[slug]/+page.svelte -->
<script>
  export let data;
</script>

<h1>{data.post.title}</h1>
<div>{@html data.post.content}</div>
```

```javascript
// src/routes/blog/[slug]/+page.server.js
export async function load({ params }) {
  const { slug } = params;
  
  const post = await db.getPostBySlug(slug);
  
  if (!post) {
    throw error(404, 'Post not found');
  }
  
  return {
    post
  };
}
```

**Multiple Parameters:**

```
src/routes/
└── shop/
    └── [category]/
        └── [product]/
            └── +page.svelte  # Matches /shop/category/product
```

```javascript
// src/routes/shop/[category]/[product]/+page.server.js
export async function load({ params }) {
  const { category, product } = params;
  
  // Fetch product data
  const productData = await db.getProduct(category, product);
  
  return {
    productData
  };
}
```

**Optional Parameters:**

```
src/routes/
└── [[lang]]/
    └── +page.svelte  # Matches both / and /en, /fr, etc.
```

```javascript
// src/routes/[[lang]]/+page.server.js
export async function load({ params }) {
  const { lang = 'en' } = params;
  
  const translations = await getTranslations(lang);
  
  return {
    lang,
    translations
  };
}
```

**Rest Parameters:**

```
src/routes/
└── files/
    └── [...path]/
        └── +page.svelte  # Matches /files/any/nested/path
```

```javascript
// src/routes/files/[...path]/+page.server.js
export async function load({ params }) {
  const { path } = params;
  const segments = path.split('/');
  
  // Process the path segments
  const file = await getFileFromPath(segments);
  
  return {
    file
  };
}
```

## Nested Routes

Nested routes allow you to create hierarchical URL structures.

**Basic Nested Routes:**

```
src/routes/
├── dashboard/
│   ├── +page.svelte           # /dashboard
│   ├── profile/
│   │   └── +page.svelte       # /dashboard/profile
│   └── settings/
│       └── +page.svelte       # /dashboard/settings
└── +page.svelte               # /
```

**Sharing Data Between Nested Routes:**

```javascript
// src/routes/dashboard/+layout.server.js
export async function load({ locals }) {
  // This data is available to all routes under /dashboard
  const user = await db.getUserById(locals.userId);
  
  return {
    user
  };
}
```

```svelte
<!-- src/routes/dashboard/+layout.svelte -->
<script>
  export let data;
  
  // data.user is available from +layout.server.js
</script>

<div class="dashboard">
  <aside>
    <nav>
      <a href="/dashboard">Dashboard</a>
      <a href="/dashboard/profile">Profile</a>
      <a href="/dashboard/settings">Settings</a>
    </nav>
  </aside>
  
  <main>
    <!-- Child routes are rendered here -->
    <slot></slot>
  </main>
</div>
```

```svelte
<!-- src/routes/dashboard/profile/+page.svelte -->
<script>
  export let data;
  
  // data.user is inherited from the parent layout
  const { user } = data;
</script>

<h1>Profile</h1>
<p>Welcome, {user.name}!</p>
```

## Layout Routes

Layout routes define shared UI elements for multiple routes.

**Basic Layout:**

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
</script>

<div class="app">
  <Header />
  
  <main>
    <slot></slot>
  </main>
  
  <Footer />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  
  main {
    flex: 1;
    padding: 1rem;
  }
</style>
```

**Nested Layouts:**

```
src/routes/
├── +layout.svelte           # Applied to all routes
├── admin/
│   ├── +layout.svelte       # Applied to all /admin routes
│   ├── +page.svelte         # /admin
│   ├── users/
│   │   └── +page.svelte     # /admin/users
│   └── settings/
│       └── +page.svelte     # /admin/settings
└── +page.svelte             # /
```

**Layout with Data:**

```javascript
// src/routes/+layout.server.js
export async function load({ locals }) {
  return {
    user: locals.user,
    notifications: await getNotifications(locals.user?.id)
  };
}
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  export let data;
  
  $effect(() => {
    // Update the page title when the route changes
    document.title = data.title || 'My App';
  });
</script>

<header>
  {#if data.user}
    <p>Welcome, {data.user.name}</p>
    <span class="notifications">{data.notifications.length}</span>
  {:else}
    <a href="/login">Log in</a>
  {/if}
</header>

<main>
  <slot></slot>
</main>
```

**Group Layouts:**

Group layouts allow you to apply a layout to a subset of routes without affecting the URL structure.

```
src/routes/
├── +layout.svelte
├── (auth)/                  # Group for authentication routes
│   ├── +layout.svelte       # Shared layout for auth routes
│   ├── login/
│   │   └── +page.svelte     # /login
│   └── register/
│       └── +page.svelte     # /register
└── +page.svelte
```

```svelte
<!-- src/routes/(auth)/+layout.svelte -->
<div class="auth-layout">
  <div class="auth-form">
    <h1>Authentication</h1>
    <slot></slot>
  </div>
</div>
```

**Named Layouts:**

```
src/routes/
├── +layout.svelte           # Default layout
├── +layout@modal.svelte     # Named layout
├── profile/
│   └── +page@modal.svelte   # Uses the modal layout
└── +page.svelte             # Uses the default layout
```

## Error Handling

SvelteKit provides error handling through error boundaries.

**Basic Error Page:**

```svelte
<!-- src/routes/+error.svelte -->
<script>
  import { page } from '$app/stores';
</script>

<h1>{$page.status}: {$page.error.message}</h1>

<p>Sorry, something went wrong.</p>

{#if $page.status === 404}
  <p>The page you're looking for doesn't exist.</p>
{/if}

<a href="/">Go back home</a>
```

**Throwing Errors:**

```javascript
// src/routes/blog/[slug]/+page.server.js
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const { slug } = params;
  
  const post = await db.getPostBySlug(slug);
  
  if (!post) {
    throw error(404, 'Post not found');
  }
  
  return {
    post
  };
}
```

**Scoped Error Pages:**

```
src/routes/
├── +error.svelte           # Fallback error page
├── admin/
│   ├── +error.svelte       # Error page for /admin routes
│   └── +page.svelte
└── +page.svelte
```

## Redirects

SvelteKit provides several ways to handle redirects.

**Server-Side Redirects:**

```javascript
// src/routes/old-page/+page.server.js
import { redirect } from '@sveltejs/kit';

export function load() {
  throw redirect(307, '/new-page');
}
```

**Conditional Redirects:**

```javascript
// src/routes/dashboard/+layout.server.js
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
  if (!locals.user) {
    throw redirect(303, '/login');
  }
  
  return {
    user: locals.user
  };
}
```

**Client-Side Redirects:**

```svelte
<script>
  import { goto } from '$app/navigation';
  
  function handleClick() {
    goto('/dashboard');
  }
</script>

<button on:click={handleClick}>
  Go to Dashboard
</button>
```

## Navigation

SvelteKit provides utilities for client-side navigation.

**Basic Navigation:**

```svelte
<script>
  import { goto } from '$app/navigation';
  
  function navigateToDashboard() {
    goto('/dashboard');
  }
</script>

<a href="/about">About</a>
<button on:click={navigateToDashboard}>Dashboard</button>
```

**Navigation Options:**

```javascript
// Navigate with options
goto('/dashboard', {
  replaceState: true,      // Replace the current history entry
  noScroll: true,          // Don't scroll to top after navigation
  keepFocus: true,         // Keep the current focused element
  invalidateAll: true      // Invalidate all data
});
```

**Programmatic Navigation:**

```svelte
<script>
  import { goto, invalidate } from '$app/navigation';
  
  async function refreshData() {
    // Invalidate specific data
    await invalidate('data:posts');
    
    // Or invalidate all data
    await invalidate();
  }
</script>
```

**Navigation Events:**

```svelte
<script>
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  
  beforeNavigate(({ from, to, cancel }) => {
    if (unsavedChanges && !confirm('Discard unsaved changes?')) {
      cancel();
    }
  });
  
  afterNavigate(({ from, to }) => {
    console.log(`Navigated from ${from?.url.pathname} to ${to.url.pathname}`);
  });
</script>
```

## Route Matching

SvelteKit uses a sophisticated route matching algorithm.

**Route Matching Priority:**

1. Static segments (e.g., `/about`)
2. Named parameters (e.g., `/blog/[slug]`)
3. Rest parameters (e.g., `/files/[...path]`)
4. Optional parameters (e.g., `/[[lang]]`)

**Example:**

```
/blog/hello              → /blog/[slug]
/blog/hello/comments     → /blog/[slug]/comments
/blog                    → /blog
/files/path/to/file.txt  → /files/[...path]
/                        → /
/en                      → /[[lang]]
```

**Advanced Matching:**

```javascript
// src/params/slug.js
export function match(param) {
  // Only match slugs that are alphanumeric with hyphens
  return /^[a-z0-9-]+$/.test(param);
}
```

## Advanced Routing Techniques

### Route Guards

```javascript
// src/routes/admin/+layout.server.js
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
  if (!locals.user) {
    throw redirect(303, '/login');
  }
  
  if (locals.user.role !== 'admin') {
    throw redirect(303, '/unauthorized');
  }
  
  return {
    user: locals.user
  };
}
```

### Dynamic Imports

```svelte
<script>
  import { onMount } from 'svelte';
  
  let Component;
  
  onMount(async () => {
    const module = await import('./DynamicComponent.svelte');
    Component = module.default;
  });
</script>

{#if Component}
  <svelte:component this={Component} />
{:else}
  <p>Loading...</p>
{/if}
```

### Route Data Preloading

```svelte
<script>
  import { prefetch } from '$app/navigation';
  
  function handleMouseEnter() {
    prefetch('/dashboard');
  }
</script>

<a 
  href="/dashboard" 
  on:mouseenter={handleMouseEnter}
>
  Dashboard
</a>
```

### Custom Route Matchers

```javascript
// src/params/id.js
export function match(param) {
  return /^\d+$/.test(param);
}
```

```
src/routes/
└── users/
    └── [id=id]/
        └── +page.svelte  # Only matches numeric IDs
```

### Route Groups Without Layouts

```
src/routes/
├── (marketing)/           # Group without a layout
│   ├── about/
│   │   └── +page.svelte   # /about
│   └── contact/
│       └── +page.svelte   # /contact
└── +page.svelte           # /
```

### Parallel Routes

```
src/routes/
├── (main)/
│   └── +page.svelte       # Main content
├── (sidebar)/
│   └── +page.svelte       # Sidebar content
└── +layout.svelte         # Combines both routes
```

```svelte
<!-- src/routes/+layout.svelte -->
<div class="layout">
  <main>
    <slot name="main"></slot>
  </main>
  
  <aside>
    <slot name="sidebar"></slot>
  </aside>
</div>
```

### Advanced API Routes

```javascript
// src/routes/api/[...path]/+server.js
export async function GET({ params, request, url }) {
  const path = params.path;
  const searchParams = url.searchParams;
  
  // Handle different API paths
  if (path.startsWith('users')) {
    return handleUsersApi(path, searchParams);
  } else if (path.startsWith('products')) {
    return handleProductsApi(path, searchParams);
  }
  
  return new Response('Not found', { status: 404 });
}

async function handleUsersApi(path, searchParams) {
  // Implementation
}

async function handleProductsApi(path, searchParams) {
  // Implementation
}
```

### Route-Specific Metadata

```javascript
// src/routes/blog/[slug]/+page.server.js
export async function load({ params }) {
  const post = await getPost(params.slug);
  
  return {
    post,
    metadata: {
      title: post.title,
      description: post.excerpt,
      openGraph: {
        title: post.title,
        description: post.excerpt,
        image: post.featuredImage
      }
    }
  };
}
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { page } from '$app/stores';
  
  $effect(() => {
    const metadata = $page.data.metadata || {};
    
    document.title = metadata.title || 'My App';
    
    // Update meta tags
    updateMetaTags(metadata);
  });
  
  function updateMetaTags(metadata) {
    // Implementation
  }
</script>

<slot></slot>
```
