# Using Svelte 5 and SvelteKit 2 with pnpm Workspaces

**Document Number**: GUIDE-006  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Introduction to pnpm Workspaces](#introduction-to-pnpm-workspaces)
2. [Project Structure](#project-structure)
3. [Common Commands](#common-commands)
4. [Dependency Management](#dependency-management)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

## Introduction to pnpm Workspaces

pnpm workspaces allow you to manage multiple packages within a single repository. This is particularly useful for monorepo setups like the HugMeDo project, where we have multiple applications and shared libraries.

### Benefits of pnpm Workspaces

- **Efficient storage**: pnpm uses a content-addressable store to avoid duplicating dependencies
- **Strict dependency management**: Prevents accessing undeclared dependencies
- **Faster installation**: Parallel installation of dependencies
- **Simplified versioning**: Easier to manage versions across packages

## Project Structure

A typical pnpm workspace structure for a Svelte/SvelteKit project:

```
hugmedo/
├── apps/
│   ├── web/                 # SvelteKit web application
│   │   ├── src/
│   │   ├── static/
│   │   ├── svelte.config.js
│   │   └── package.json     # @hugmedo/web
│   │
│   └── mobile/              # SvelteKit mobile application
│       ├── src/
│       ├── static/
│       ├── svelte.config.js
│       └── package.json     # @hugmedo/mobile
│
├── packages/
│   ├── ui/                  # Shared UI components
│   │   ├── src/
│   │   └── package.json     # @hugmedo/ui
│   │
│   └── utils/               # Shared utilities
│       ├── src/
│       └── package.json     # @hugmedo/utils
│
├── pnpm-workspace.yaml      # Workspace configuration
└── package.json             # Root package.json
```

### pnpm-workspace.yaml

This file defines which packages are included in the workspace:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Root package.json

The root `package.json` defines workspace-wide scripts and dependencies:

```json
{
  "name": "hugmedo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:web": "pnpm --filter @hugmedo/web dev",
    "dev:mobile": "pnpm --filter @hugmedo/mobile dev",
    "build:web": "pnpm --filter @hugmedo/web build",
    "build:mobile": "pnpm --filter @hugmedo/mobile build",
    "preview:web": "pnpm --filter @hugmedo/web preview",
    "preview:mobile": "pnpm --filter @hugmedo/mobile preview",
    "check": "pnpm -r check",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "prettier": "^3.0.0",
    "eslint": "^8.0.0"
  }
}
```

## Common Commands

### Running SvelteKit Commands

When working with SvelteKit in a pnpm workspace, you need to specify which package to run commands for:

```bash
# Wrong way (from project root)
pnpm exec svelte-kit sync  # This will fail

# Correct way 1: Navigate to the app directory
cd apps/web
pnpm exec svelte-kit sync

# Correct way 2: Use --filter flag from project root
pnpm --filter @hugmedo/web exec svelte-kit sync
```

### Development Server

```bash
# Start the web app development server
pnpm --filter @hugmedo/web dev

# Start with specific host and port
pnpm --filter @hugmedo/web dev -- --host --port 40000
```

### Building for Production

```bash
# Build the web app
pnpm --filter @hugmedo/web build

# Build all apps
pnpm -r --filter "./apps/*" build
```

### Type Checking

```bash
# Check types for the web app
pnpm --filter @hugmedo/web check

# Check types for all packages
pnpm -r check
```

### Testing

```bash
# Run tests for the web app
pnpm --filter @hugmedo/web test

# Run tests for all packages
pnpm -r test
```

## Dependency Management

### Adding Dependencies

```bash
# Add a dependency to a specific package
pnpm --filter @hugmedo/web add axios

# Add a dev dependency to a specific package
pnpm --filter @hugmedo/web add -D vitest

# Add a workspace package as a dependency
pnpm --filter @hugmedo/web add @hugmedo/ui
```

### Adding Global Dependencies

```bash
# Add a dev dependency to the root package
pnpm add -Dw typescript
```

### Updating Dependencies

```bash
# Update dependencies for a specific package
pnpm --filter @hugmedo/web update

# Update a specific dependency
pnpm --filter @hugmedo/web update svelte

# Update dependencies for all packages
pnpm -r update
```

## Troubleshooting

### Common Issues and Solutions

#### 1. "Command not found" Error

**Problem:**
```
ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "svelte-kit" not found
```

**Solution:**
Use the `--filter` flag to specify which package to run the command for:
```bash
pnpm --filter @hugmedo/web exec svelte-kit sync
```

#### 2. Dependency Resolution Issues

**Problem:**
Package cannot access a dependency that should be available.

**Solution:**
Ensure the dependency is correctly declared in the package's `package.json`:
```bash
pnpm --filter @hugmedo/web add missing-dependency
```

#### 3. Port Conflicts

**Problem:**
Multiple development servers trying to use the same port.

**Solution:**
Specify different ports for each app:
```bash
# Web app on port 40000
pnpm --filter @hugmedo/web dev -- --port 40000

# Mobile app on port 40010
pnpm --filter @hugmedo/mobile dev -- --port 40010
```

#### 4. TypeScript Path Aliases

**Problem:**
TypeScript path aliases not working across packages.

**Solution:**
Configure path aliases in each package's `tsconfig.json` and ensure they're also configured in `svelte.config.js`:

```json
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "paths": {
      "$lib/*": ["./src/lib/*"],
      "@hugmedo/ui": ["../../packages/ui/src/index.ts"]
    }
  }
}
```

```javascript
// apps/web/svelte.config.js
import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      '@hugmedo/ui': '../../packages/ui/src/index.ts'
    }
  }
};

export default config;
```

## Best Practices

### Project Organization

1. **Consistent naming**: Use consistent package names (e.g., `@hugmedo/web`, `@hugmedo/mobile`)
2. **Clear separation**: Keep apps and shared packages separate
3. **Minimal dependencies**: Only add dependencies where they're needed

### Development Workflow

1. **Use workspace scripts**: Define common scripts in the root `package.json`
2. **Parallel development**: Run multiple apps simultaneously with different ports
3. **Consistent versioning**: Keep shared package versions in sync

### Port Assignments for HugMeDo Project

For the HugMeDo project, we use the following port assignments:

- Web application (`apps/web`): 40000
- Mobile application (`apps/mobile`): 40010
- API Gateway: 40040
- Module services (`/modules`):
  - OHR module: 40100
  - Chat module: 40110
  - HALCA module: 40120 (planned for implementation after v1.1.0)
  - Hugmemo module: 40130 (planned for implementation after v1.1.0)

### Environment Variables

1. **Keep `.env.example` updated**: Document all required environment variables
2. **Use `.env.local` for sensitive information**: Don't commit sensitive data to version control
3. **Use service name as prefix**: Prefix environment variable names with the service name (e.g., `HUGMEDO_DCM_API_KEY`)

```bash
# .env.example
VITE_API_URL=http://localhost:40040
VITE_WS_URL=ws://localhost:40110

# .env.local (not committed)
HUGMEDO_DCM_API_KEY=your-secret-key
```

### Sharing Code Between Packages

1. **Create dedicated shared packages**: Put shared code in the `packages/` directory
2. **Use explicit imports**: Always import from the package, not relative paths across package boundaries
3. **Minimize circular dependencies**: Design your packages to avoid circular dependencies
