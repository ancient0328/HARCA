# Svelte 5 and SvelteKit 2: Introduction

**Document Number**: GUIDE-001  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Introduction](#introduction)
2. [What's New in Svelte 5](#whats-new-in-svelte-5)
3. [What's New in SvelteKit 2](#whats-new-in-sveltekit-2)
4. [Getting Started](#getting-started)
5. [Project Structure](#project-structure)
6. [Development Workflow](#development-workflow)
7. [References](#references)

## Introduction

This guide provides comprehensive documentation for Svelte 5 and SvelteKit 2, focusing on their new features, improvements, and best practices. It is designed for developers working on the HugMeDo project but can be useful for any Svelte developer.

Svelte 5 introduces a revolutionary new reactivity system called "Runes," while SvelteKit 2 builds upon this foundation to provide an enhanced full-stack development experience. This document series will explore these technologies in depth, providing practical examples and guidance.

## What's New in Svelte 5

Svelte 5 represents a significant evolution of the Svelte framework, introducing several groundbreaking features:

### Runes

Runes are special functions that transform the variables they touch, making them reactive. They are prefixed with `$` and include:

- `$state()` - Creates reactive state variables
- `$derived()` - Creates computed values derived from other reactive values
- `$effect()` - Runs side effects when dependencies change
- `$props()` - Defines component properties
- `$melt()` - Integrates with the Melt UI library

### Function Components

Svelte 5 introduces function components, allowing for a more flexible component architecture:

```svelte
<script>
  function Counter(props) {
    let count = $state(0);
    
    return {
      increment: () => count++
    };
  }
</script>

<button on:click={Counter.increment}>
  Count: {count}
</button>
```

### Enhanced TypeScript Support

Svelte 5 significantly improves TypeScript integration, making it easier to define and use types throughout your application.

### Performance Improvements

The new compiler in Svelte 5 generates more efficient code, resulting in smaller bundle sizes and faster runtime performance.

## What's New in SvelteKit 2

SvelteKit 2 builds on Svelte 5's innovations while introducing its own improvements:

### Enhanced Routing

SvelteKit 2 maintains the file-based routing system but enhances it with better support for nested layouts and more flexible route parameters.

### Improved Server-Side Functions

The `load` and action functions have been refined for better type safety and easier access to request data.

### Better Form Handling

Form actions are now more powerful and easier to use, with improved validation and error handling.

### Enhanced Adapter System

SvelteKit 2 improves its adapter system, making it easier to deploy to various platforms like Vercel, Netlify, and Cloudflare.

## Getting Started

### Installation

To create a new Svelte 5 + SvelteKit 2 project:

```bash
npm create svelte@latest my-app
cd my-app
npm install
npm run dev
```

### Using with pnpm Workspaces

In the HugMeDo project, we use pnpm workspaces. To run SvelteKit commands:

```bash
# From the project root
pnpm --filter @hugmedo/web exec svelte-kit sync

# Or navigate to the app directory
cd apps/web
pnpm exec svelte-kit sync
```

## Project Structure

A typical SvelteKit project structure:

```
my-app/
├── src/
│   ├── app.d.ts           # TypeScript declarations
│   ├── app.html           # HTML template
│   ├── hooks.server.ts    # Server hooks
│   ├── routes/            # Application routes
│   │   ├── +layout.svelte # Root layout
│   │   ├── +page.svelte   # Home page
│   │   └── about/         # About route
│   │       └── +page.svelte
│   └── lib/               # Shared libraries
├── static/                # Static assets
├── svelte.config.js       # Svelte configuration
├── vite.config.js         # Vite configuration
└── package.json           # Dependencies
```

## Development Workflow

### Type Checking

Run type checking with:

```bash
pnpm --filter @hugmedo/web check
```

### Building for Production

Build your application with:

```bash
pnpm --filter @hugmedo/web build
```

### Preview

Preview the production build with:

```bash
pnpm --filter @hugmedo/web preview
```

## References

- [Svelte 5 Official Documentation](https://svelte.dev/docs)
- [SvelteKit 2 Official Documentation](https://kit.svelte.dev/docs)
- [Svelte 5 Runes](https://svelte.dev/docs/runes)
- [SvelteKit 2 API](https://kit.svelte.dev/docs/modules)
- [Migration Guide from Svelte 4 to 5](https://svelte.dev/docs/migrating-to-svelte-5)
- [Migration Guide from SvelteKit 1 to 2](https://kit.svelte.dev/docs/migrating-to-sveltekit-2)
