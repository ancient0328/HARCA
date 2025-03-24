# SvelteKit 2 Server-Side Features (Part 1)

**Document Number**: GUIDE-010  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Server-Side Rendering Overview](#server-side-rendering-overview)
2. [Load Functions](#load-functions)
3. [Form Actions](#form-actions)
4. [API Routes](#api-routes)
5. [Hooks](#hooks)

## Server-Side Rendering Overview

SvelteKit 2 provides robust server-side rendering (SSR) capabilities, allowing you to render pages on the server before sending them to the client. This approach offers several benefits:

- **Improved SEO**: Search engines can index your content more effectively
- **Faster initial load**: Users see content sooner
- **Better performance on low-powered devices**: Less JavaScript to parse and execute
- **Progressive enhancement**: Basic functionality works without JavaScript

SvelteKit supports several rendering strategies:

- **Server-Side Rendering (SSR)**: Pages are rendered on the server for each request
- **Static Site Generation (SSG)**: Pages are pre-rendered at build time
- **Client-Side Rendering (CSR)**: Pages are rendered in the browser
- **Hybrid Rendering**: Combination of the above strategies

## Load Functions

Load functions are used to load data for a page or layout. They can run on the server, the client, or both.

### Server Load Functions

Server load functions run exclusively on the server and can access server-only resources.

```javascript
// src/routes/products/+page.server.js
export async function load(event) {
  const { fetch, params, url, route, cookies, locals } = event;
  
  // Access server-only resources
  const products = await db.getProducts();
  
  // You can return any serializable data
  return {
    products,
    categories: await db.getCategories()
  };
}
```

Server load functions have access to:

- `params`: Route parameters
- `url`: The request URL
- `route`: Information about the current route
- `fetch`: A fetch function that includes cookies
- `cookies`: The request cookies
- `locals`: Data that is specific to the request
- `request`: The request object
- `getClientAddress()`: Function to get the client's IP address
- `platform`: Platform-specific context (e.g., Cloudflare, Vercel)
- `setHeaders(...)`: Function to set response headers

### Universal Load Functions

Universal load functions run on both the server and the client.

```javascript
// src/routes/products/+page.js
export async function load({ fetch, params, depends }) {
  // This runs on both server and client
  depends('products');  // Declare a dependency
  
  const response = await fetch(`/api/products`);
  const products = await response.json();
  
  return {
    products
  };
}
```

Universal load functions have access to:

- `params`: Route parameters
- `url`: The request URL
- `route`: Information about the current route
- `fetch`: A fetch function that includes cookies
- `depends`: Function to declare data dependencies
- `parent`: Function to access data from parent layouts

### Layout Load Functions

Layout load functions load data for layout components, which is then available to all child routes.

```javascript
// src/routes/+layout.server.js
export async function load({ locals }) {
  return {
    user: locals.user,
    navigation: await getNavigationItems()
  };
}
```

```javascript
// src/routes/dashboard/+layout.server.js
export async function load({ locals, parent }) {
  // Get data from parent layout
  const parentData = await parent();
  
  // Only allow authenticated users
  if (!parentData.user) {
    throw redirect(303, '/login');
  }
  
  return {
    dashboardItems: await getDashboardItems(parentData.user.id)
  };
}
```

### Data Loading Patterns

#### Sequential Loading

```javascript
// src/routes/user/[id]/+page.server.js
export async function load({ params }) {
  const user = await db.getUser(params.id);
  const posts = await db.getPostsByUser(params.id);
  
  return {
    user,
    posts
  };
}
```

#### Parallel Loading

```javascript
// src/routes/user/[id]/+page.server.js
export async function load({ params }) {
  const [user, posts] = await Promise.all([
    db.getUser(params.id),
    db.getPostsByUser(params.id)
  ]);
  
  return {
    user,
    posts
  };
}
```

#### Conditional Loading

```javascript
// src/routes/user/[id]/+page.server.js
export async function load({ params, url }) {
  const user = await db.getUser(params.id);
  
  // Only load posts if the 'posts' query parameter is present
  let posts = [];
  if (url.searchParams.has('posts')) {
    posts = await db.getPostsByUser(params.id);
  }
  
  return {
    user,
    posts
  };
}
```

#### Dependency Declaration

```javascript
// src/routes/products/+page.js
export async function load({ fetch, depends }) {
  depends('products');  // Declare a dependency
  
  const response = await fetch('/api/products');
  const products = await response.json();
  
  return {
    products
  };
}
```

To invalidate this data later:

```javascript
import { invalidate } from '$app/navigation';

// Invalidate the 'products' dependency
await invalidate('products');
```

### Error Handling in Load Functions

```javascript
// src/routes/product/[id]/+page.server.js
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const product = await db.getProduct(params.id);
  
  if (!product) {
    throw error(404, {
      message: 'Product not found',
      code: 'PRODUCT_NOT_FOUND'
    });
  }
  
  return {
    product
  };
}
```

### Redirects in Load Functions

```javascript
// src/routes/dashboard/+layout.server.js
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
  if (!locals.user) {
    throw redirect(303, '/login?redirectTo=/dashboard');
  }
  
  return {
    user: locals.user
  };
}
```

### Setting Headers in Load Functions

```javascript
// src/routes/api/data.json/+server.js
export async function GET({ setHeaders }) {
  const data = await getData();
  
  setHeaders({
    'Cache-Control': 'max-age=3600',
    'Content-Type': 'application/json'
  });
  
  return json(data);
}
```

## Form Actions

Form actions handle form submissions on the server.

### Basic Form Action

```javascript
// src/routes/login/+page.server.js
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
  default: async (event) => {
    const { request, cookies } = event;
    const data = await request.formData();
    
    const username = data.get('username');
    const password = data.get('password');
    
    if (!username || !password) {
      return fail(400, {
        error: 'Username and password are required',
        username
      });
    }
    
    const user = await db.authenticateUser(username, password);
    
    if (!user) {
      return fail(401, {
        error: 'Invalid username or password',
        username
      });
    }
    
    cookies.set('session', user.sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });
    
    throw redirect(303, '/dashboard');
  }
};
```

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

### Multiple Form Actions

```javascript
// src/routes/profile/+page.server.js
export const actions = {
  updateProfile: async ({ request, locals }) => {
    const data = await request.formData();
    const name = data.get('name');
    const bio = data.get('bio');
    
    await db.updateUserProfile(locals.user.id, { name, bio });
    
    return {
      success: true,
      message: 'Profile updated successfully'
    };
  },
  
  changePassword: async ({ request, locals }) => {
    const data = await request.formData();
    const currentPassword = data.get('currentPassword');
    const newPassword = data.get('newPassword');
    const confirmPassword = data.get('confirmPassword');
    
    if (newPassword !== confirmPassword) {
      return fail(400, {
        error: 'Passwords do not match'
      });
    }
    
    const success = await db.changeUserPassword(
      locals.user.id,
      currentPassword,
      newPassword
    );
    
    if (!success) {
      return fail(401, {
        error: 'Current password is incorrect'
      });
    }
    
    return {
      success: true,
      message: 'Password changed successfully'
    };
  }
};
```

```svelte
<!-- src/routes/profile/+page.svelte -->
<script>
  export let form;
</script>

<h1>Profile</h1>

<form method="POST" action="?/updateProfile">
  <!-- Profile form fields -->
  <button type="submit">Update Profile</button>
</form>

<form method="POST" action="?/changePassword">
  <!-- Password form fields -->
  <button type="submit">Change Password</button>
</form>

{#if form?.success}
  <p class="success">{form.message}</p>
{/if}

{#if form?.error}
  <p class="error">{form.error}</p>
{/if}
```

### Progressive Enhancement with use:enhance

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

### File Uploads

```javascript
// src/routes/upload/+page.server.js
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const file = data.get('file');
    
    if (!(file instanceof File)) {
      return fail(400, {
        error: 'No file uploaded'
      });
    }
    
    // Process the file
    const fileBuffer = await file.arrayBuffer();
    const fileName = file.name;
    
    // Save the file
    await saveFile(fileName, fileBuffer);
    
    return {
      success: true,
      fileName
    };
  }
};
```

```svelte
<!-- src/routes/upload/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  
  export let form;
</script>

<form method="POST" enctype="multipart/form-data" use:enhance>
  <div>
    <label for="file">Choose a file</label>
    <input id="file" name="file" type="file" required />
  </div>
  
  <button type="submit">Upload</button>
</form>

{#if form?.success}
  <p>File {form.fileName} uploaded successfully!</p>
{/if}

{#if form?.error}
  <p class="error">{form.error}</p>
{/if}
```

### Validation

```javascript
// src/routes/register/+page.server.js
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const username = data.get('username');
    const email = data.get('email');
    const password = data.get('password');
    
    const errors = {};
    
    if (!username || username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }
    
    if (!email || !email.includes('@')) {
      errors.email = 'Valid email is required';
    }
    
    if (!password || password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    
    if (Object.keys(errors).length > 0) {
      return fail(400, {
        errors,
        username,
        email
      });
    }
    
    // Create user
    await db.createUser({ username, email, password });
    
    return {
      success: true
    };
  }
};
```
