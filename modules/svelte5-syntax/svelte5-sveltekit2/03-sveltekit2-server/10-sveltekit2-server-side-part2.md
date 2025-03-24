# SvelteKit 2 Server-Side Features (Part 2)

**Document Number**: GUIDE-010B  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [API Routes](#api-routes)
2. [Hooks](#hooks)
3. [Cookies and Sessions](#cookies-and-sessions)
4. [Environment Variables](#environment-variables)
5. [Server-Only Modules](#server-only-modules)

## API Routes

API routes allow you to create server endpoints that respond to HTTP requests.

### Basic API Route

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

### Request Handling

```javascript
// src/routes/api/data/+server.js
export async function GET(event) {
  const { url, request, locals, params, getClientAddress } = event;
  
  // Access query parameters
  const limit = url.searchParams.get('limit') || '10';
  
  // Access headers
  const authorization = request.headers.get('Authorization');
  
  // Access client IP
  const clientIp = getClientAddress();
  
  // Access route parameters
  const { id } = params;
  
  // Access locals
  const { user } = locals;
  
  // Process the request
  const data = await getData(parseInt(limit), user.id);
  
  return json(data);
}
```

### Response Types

```javascript
// src/routes/api/examples/+server.js
import { json, text, error } from '@sveltejs/kit';

// JSON response
export function GET() {
  return json({ message: 'Hello, world!' });
}

// Text response
export function POST() {
  return text('Success');
}

// Custom response
export function PUT() {
  return new Response(JSON.stringify({ status: 'updated' }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=3600'
    }
  });
}

// Error response
export function DELETE() {
  throw error(403, 'Forbidden');
}
```

### File Handling

```javascript
// src/routes/api/download/[filename]/+server.js
import { error } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

export async function GET({ params }) {
  const { filename } = params;
  const filepath = path.join(process.cwd(), 'static', 'files', filename);
  
  try {
    const file = await fs.readFile(filepath);
    
    return new Response(file, {
      headers: {
        'Content-Type': getContentType(filename),
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    throw error(404, 'File not found');
  }
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.txt': 'text/plain',
    // Add more as needed
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}
```

### API Versioning

```
src/routes/
└── api/
    ├── v1/
    │   └── users/
    │       └── +server.js
    └── v2/
        └── users/
            └── +server.js
```

```javascript
// src/routes/api/v1/users/+server.js
export async function GET() {
  const users = await db.getUsersV1();
  return json(users);
}

// src/routes/api/v2/users/+server.js
export async function GET() {
  const users = await db.getUsersV2();
  return json(users);
}
```

### Authentication and Authorization

```javascript
// src/routes/api/protected/+server.js
import { json, error } from '@sveltejs/kit';

export async function GET({ request, locals }) {
  // Check if user is authenticated
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  
  // Check if user has required role
  if (locals.user.role !== 'admin') {
    throw error(403, 'Forbidden');
  }
  
  // Process the request
  const data = await getProtectedData();
  
  return json(data);
}
```

### CORS Configuration

```javascript
// src/routes/api/cors-enabled/+server.js
export async function GET({ request, setHeaders }) {
  setHeaders({
    'Access-Control-Allow-Origin': 'https://trusted-site.com',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  
  return json({ message: 'CORS-enabled endpoint' });
}

export async function OPTIONS({ setHeaders }) {
  setHeaders({
    'Access-Control-Allow-Origin': 'https://trusted-site.com',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  
  return new Response(null, { status: 204 });
}
```

### Rate Limiting

```javascript
// src/lib/server/rate-limiter.js
const ipRequests = new Map();

export function rateLimit(ip, limit = 100, windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Initialize or clean old requests
  if (!ipRequests.has(ip)) {
    ipRequests.set(ip, []);
  }
  
  const requests = ipRequests.get(ip);
  const recentRequests = requests.filter(time => time > windowStart);
  
  // Update requests
  ipRequests.set(ip, [...recentRequests, now]);
  
  return recentRequests.length < limit;
}
```

```javascript
// src/routes/api/rate-limited/+server.js
import { json, error } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limiter';

export async function GET({ getClientAddress }) {
  const ip = getClientAddress();
  
  if (!rateLimit(ip, 5, 60000)) { // 5 requests per minute
    throw error(429, 'Too Many Requests');
  }
  
  return json({ message: 'Rate-limited endpoint' });
}
```

## Hooks

Hooks allow you to run code at specific points in the request lifecycle.

### Server Hooks

Server hooks are defined in `src/hooks.server.js` or `src/hooks.server.ts`.

```javascript
// src/hooks.server.js
import { sequence } from '@sveltejs/kit/hooks';

// Handle requests
export const handle = sequence(
  // First hook: Authentication
  async ({ event, resolve }) => {
    const sessionId = event.cookies.get('session');
    
    if (sessionId) {
      const user = await db.getUserBySessionId(sessionId);
      event.locals.user = user;
    }
    
    return resolve(event);
  },
  
  // Second hook: Logging
  async ({ event, resolve }) => {
    const startTime = Date.now();
    
    // Pass the request to the endpoint
    const response = await resolve(event);
    
    const duration = Date.now() - startTime;
    console.log(`${event.request.method} ${event.url.pathname} - ${duration}ms`);
    
    return response;
  }
);

// Handle errors
export function handleError({ error, event }) {
  // Log the error
  console.error(`Error during ${event.request.method} ${event.url.pathname}:`, error);
  
  // You can return additional data to be used in error pages
  return {
    message: error.message,
    code: error.code || 'UNKNOWN'
  };
}
```

### Response Transformation

```javascript
// src/hooks.server.js
export async function handle({ event, resolve }) {
  // Process the request
  const response = await resolve(event, {
    // Transform the rendered HTML
    transformPageChunk: ({ html }) => {
      // Replace placeholders or add content
      return html.replace(
        '%CURRENT_YEAR%',
        new Date().getFullYear().toString()
      );
    }
  });
  
  // Add headers to all responses
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}
```

### Custom Rendering

```javascript
// src/hooks.server.js
export async function handle({ event, resolve }) {
  // Check if the request is for a specific route
  if (event.url.pathname.startsWith('/custom')) {
    // Return a custom response without using the normal rendering pipeline
    return new Response('Custom response', {
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
  
  // For other routes, use the normal rendering pipeline
  return resolve(event);
}
```

### Request Preprocessing

```javascript
// src/hooks.server.js
export async function handle({ event, resolve }) {
  // Add custom data to locals
  event.locals.requestTime = new Date();
  event.locals.requestId = crypto.randomUUID();
  
  // Parse custom headers
  const apiKey = event.request.headers.get('X-API-Key');
  if (apiKey) {
    event.locals.apiKey = apiKey;
    event.locals.apiUser = await db.getUserByApiKey(apiKey);
  }
  
  // Continue with the request
  return resolve(event);
}
```

## Cookies and Sessions

SvelteKit provides utilities for working with cookies and managing user sessions.

### Reading and Writing Cookies

```javascript
// src/routes/api/cookies/+server.js
export function GET({ cookies }) {
  // Read a cookie
  const theme = cookies.get('theme');
  
  // Set a cookie
  cookies.set('visited', 'true', {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  
  // Delete a cookie
  cookies.delete('temporary', { path: '/' });
  
  return json({ theme });
}
```

### Session Management

```javascript
// src/lib/server/session.js
import { randomBytes } from 'crypto';

// In-memory session store (use a database in production)
const sessions = new Map();

export function createSession(userId) {
  const sessionId = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
  
  sessions.set(sessionId, {
    userId,
    expires,
    created: new Date()
  });
  
  return { sessionId, expires };
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }
  
  if (session.expires < new Date()) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}
```

```javascript
// src/routes/login/+page.server.js
import { redirect } from '@sveltejs/kit';
import { createSession } from '$lib/server/session';

export const actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get('username');
    const password = data.get('password');
    
    const user = await db.authenticateUser(username, password);
    
    if (user) {
      const { sessionId, expires } = createSession(user.id);
      
      cookies.set('session', sessionId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires
      });
      
      throw redirect(303, '/dashboard');
    }
    
    return { error: 'Invalid username or password' };
  }
};
```

```javascript
// src/routes/logout/+page.server.js
import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/session';

export function load({ cookies }) {
  const sessionId = cookies.get('session');
  
  if (sessionId) {
    deleteSession(sessionId);
    cookies.delete('session', { path: '/' });
  }
  
  throw redirect(303, '/');
}
```

### Authentication in Hooks

```javascript
// src/hooks.server.js
import { getSession } from '$lib/server/session';

export async function handle({ event, resolve }) {
  const sessionId = event.cookies.get('session');
  
  if (sessionId) {
    const session = getSession(sessionId);
    
    if (session) {
      const user = await db.getUserById(session.userId);
      event.locals.user = user;
    } else {
      // Invalid or expired session
      event.cookies.delete('session', { path: '/' });
    }
  }
  
  return resolve(event);
}
```

## Environment Variables

SvelteKit provides a structured way to work with environment variables.

### Defining Environment Variables

```
# .env
# Private variables (server-only)
DATABASE_URL="postgres://user:password@localhost:5432/mydb"
API_SECRET_KEY="your-secret-key"

# Public variables (accessible in browser)
PUBLIC_API_URL="https://api.example.com"
PUBLIC_FEATURE_FLAGS="comments,dark-mode"
```

### Accessing Environment Variables

```javascript
// src/routes/+layout.server.js
import { DATABASE_URL } from '$env/static/private';
import { PUBLIC_API_URL } from '$env/static/public';

export function load() {
  console.log('Database URL:', DATABASE_URL); // Server-only
  
  return {
    apiUrl: PUBLIC_API_URL // Safe to send to the client
  };
}
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { PUBLIC_API_URL } from '$env/static/public';
  
  export let data;
  
  console.log('API URL from load function:', data.apiUrl);
  console.log('API URL from env:', PUBLIC_API_URL);
</script>
```

### Dynamic Environment Variables

```javascript
// src/routes/api/config/+server.js
import { env } from '$env/dynamic/private';
import { PUBLIC_FEATURE_FLAGS } from '$env/static/public';

export function GET() {
  // Access dynamic environment variables
  const dbUrl = env.DATABASE_URL;
  
  // Parse feature flags
  const featureFlags = PUBLIC_FEATURE_FLAGS.split(',');
  
  return json({
    features: featureFlags,
    version: env.VERSION || '1.0.0'
  });
}
```

### Environment-Specific Configuration

```javascript
// src/lib/server/config.js
import { dev } from '$app/environment';
import { DATABASE_URL, API_SECRET_KEY } from '$env/static/private';

export const config = {
  database: {
    url: DATABASE_URL,
    poolSize: dev ? 5 : 20,
    ssl: !dev
  },
  api: {
    secretKey: API_SECRET_KEY,
    timeout: dev ? 5000 : 3000,
    retries: dev ? 1 : 3
  }
};
```

## Server-Only Modules

SvelteKit allows you to create server-only modules that are never sent to the client.

### Creating Server-Only Modules

```javascript
// src/lib/server/database.js
import { DATABASE_URL } from '$env/static/private';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
});

export async function query(text, params) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getUserById(id) {
  const users = await query('SELECT * FROM users WHERE id = $1', [id]);
  return users[0];
}

export async function createUser(data) {
  const { username, email, password } = data;
  const hashedPassword = await hashPassword(password);
  
  const users = await query(
    'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
    [username, email, hashedPassword]
  );
  
  return users[0];
}

async function hashPassword(password) {
  // Implementation
}
```

### Using Server-Only Modules

```javascript
// src/routes/users/+page.server.js
import * as db from '$lib/server/database';

export async function load() {
  const users = await db.query('SELECT id, username, email FROM users');
  
  return {
    users
  };
}
```

```javascript
// src/routes/users/[id]/+page.server.js
import * as db from '$lib/server/database';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const user = await db.getUserById(params.id);
  
  if (!user) {
    throw error(404, 'User not found');
  }
  
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email
      // Don't include sensitive data like password
    }
  };
}
```

### Server-Only Utilities

```javascript
// src/lib/server/auth.js
import jwt from 'jsonwebtoken';
import { API_SECRET_KEY } from '$env/static/private';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    API_SECRET_KEY,
    { expiresIn: '1h' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, API_SECRET_KEY);
  } catch (err) {
    return null;
  }
}
```

```javascript
// src/routes/api/token/+server.js
import { json } from '@sveltejs/kit';
import * as db from '$lib/server/database';
import { generateToken } from '$lib/server/auth';

export async function POST({ request }) {
  const { username, password } = await request.json();
  
  const user = await db.authenticateUser(username, password);
  
  if (!user) {
    return json({ error: 'Invalid credentials' }, { status: 401 });
  }
  
  const token = generateToken(user);
  
  return json({ token });
}
```

### Server-Only Types

```typescript
// src/lib/server/types.ts
export interface DatabaseUser {
  id: string;
  username: string;
  email: string;
  password: string; // Hashed password
  role: 'user' | 'admin';
  created_at: Date;
  updated_at: Date;
}

export interface PublicUser {
  id: string;
  username: string;
  role: 'user' | 'admin';
}

export function sanitizeUser(user: DatabaseUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}
```

```typescript
// src/routes/api/users/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import * as db from '$lib/server/database';
import { sanitizeUser } from '$lib/server/types';

export const GET: RequestHandler = async () => {
  const users = await db.query('SELECT * FROM users');
  
  // Sanitize users before sending to client
  const publicUsers = users.map(sanitizeUser);
  
  return json(publicUsers);
};
```
