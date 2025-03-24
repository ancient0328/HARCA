# Svelte 5 Basics

**Document Number**: GUIDE-002  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Runes System](#runes-system)
2. [Component Architecture](#component-architecture)
3. [Lifecycle Management](#lifecycle-management)
4. [Event Handling](#event-handling)
5. [Styling](#styling)
6. [TypeScript Integration](#typescript-integration)
7. [Best Practices](#best-practices)

## Runes System

Svelte 5 introduces a revolutionary reactivity system called "Runes." Runes are special functions that transform variables into reactive entities.

### $state()

`$state()` creates a reactive state variable:

```svelte
<script>
  let count = $state(0);
  
  function increment() {
    count++;
  }
</script>

<button on:click={increment}>
  Count: {count}
</button>
```

### $derived()

`$derived()` creates computed values that automatically update when their dependencies change:

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  let isEven = $derived(count % 2 === 0);
</script>

<p>Count: {count}</p>
<p>Doubled: {doubled}</p>
<p>Is even? {isEven ? 'Yes' : 'No'}</p>
```

### $effect()

`$effect()` runs side effects when dependencies change:

```svelte
<script>
  let count = $state(0);
  
  $effect(() => {
    console.log(`Count changed to ${count}`);
    
    // Optional cleanup function
    return () => {
      console.log('Cleaning up previous effect');
    };
  });
</script>
```

### $props()

`$props()` defines component properties:

```svelte
<script>
  let props = $props({
    name: '',
    greeting: 'Hello'
  });
</script>

<p>{props.greeting}, {props.name}!</p>
```

## Component Architecture

### Function Components

Svelte 5 introduces function components, a new way to define components:

```svelte
<script>
  function Greeting(props) {
    let name = $state(props.name || 'World');
    let greeting = $state(props.greeting || 'Hello');
    
    return {
      updateName: (newName) => {
        name = newName;
      }
    };
  }
</script>

<div>
  {greeting}, {name}!
</div>
```

### Using Function Components

Function components can be used within other components:

```svelte
<script>
  import { Greeting } from './Greeting.svelte';
  
  let greetingComponent;
</script>

<Greeting name="John" bind:this={greetingComponent} />
<button on:click={() => greetingComponent.updateName('Jane')}>
  Change to Jane
</button>
```

### Component Composition

Components can be composed using slots:

```svelte
<!-- Card.svelte -->
<script>
  let props = $props({
    title: ''
  });
</script>

<div class="card">
  <h2>{props.title}</h2>
  <div class="content">
    <slot />
  </div>
  <div class="footer">
    <slot name="footer" />
  </div>
</div>
```

Usage:

```svelte
<Card title="My Card">
  <p>This is the card content.</p>
  
  <svelte:fragment slot="footer">
    <button>Cancel</button>
    <button>Submit</button>
  </svelte:fragment>
</Card>
```

## Lifecycle Management

In Svelte 5, lifecycle management is primarily handled through `$effect()`:

```svelte
<script>
  let count = $state(0);
  
  // Runs on component mount and when count changes
  $effect(() => {
    console.log(`Component mounted or count changed to ${count}`);
    
    // This function runs when the component is unmounted
    // or before the effect runs again
    return () => {
      console.log('Component unmounted or effect running again');
    };
  });
  
  // Runs only once on component mount (empty dependency array)
  $effect(() => {
    const interval = setInterval(() => {
      count++;
    }, 1000);
    
    // Clean up the interval when the component is unmounted
    return () => clearInterval(interval);
  });
</script>
```

## Event Handling

### Basic Event Handling

```svelte
<script>
  let count = $state(0);
  
  function handleClick() {
    count++;
  }
</script>

<button on:click={handleClick}>Increment</button>
```

### Event Modifiers

```svelte
<!-- Stop propagation -->
<button on:click|stopPropagation={handleClick}>Click</button>

<!-- Prevent default -->
<form on:submit|preventDefault={handleSubmit}>
  <!-- Form content -->
</form>

<!-- Multiple modifiers -->
<button on:click|once|preventDefault={handleClick}>
  Click me once
</button>
```

### Custom Events

```svelte
<!-- Child.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  function handleClick() {
    dispatch('message', {
      text: 'Hello from child'
    });
  }
</script>

<button on:click={handleClick}>Send Message</button>
```

```svelte
<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';
  
  function handleMessage(event) {
    console.log(event.detail.text);
  }
</script>

<Child on:message={handleMessage} />
```

## Styling

### Component Styles

Styles in Svelte are scoped to the component by default:

```svelte
<script>
  let color = $state('red');
</script>

<p>This text is {color}.</p>

<style>
  p {
    color: var(--color);
  }
</style>
```

### Dynamic Styles

```svelte
<script>
  let color = $state('red');
</script>

<p style="color: {color}">This text is {color}.</p>
```

### Global Styles

```svelte
<style>
  /* Local to component */
  p {
    color: blue;
  }
  
  /* Global styles */
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: sans-serif;
  }
</style>
```

## TypeScript Integration

### Component Props

```svelte
<script lang="ts">
  interface Props {
    name: string;
    age?: number;
  }
  
  let props = $props<Props>({
    name: ''
  });
</script>
```

### Function Components with TypeScript

```svelte
<script lang="ts">
  interface Props {
    name: string;
    greeting?: string;
  }
  
  interface ReturnType {
    updateName: (name: string) => void;
  }
  
  function Greeting(props: Props): ReturnType {
    let name = $state(props.name);
    let greeting = $state(props.greeting || 'Hello');
    
    return {
      updateName: (newName: string) => {
        name = newName;
      }
    };
  }
</script>
```

## Best Practices

### State Management

1. Keep state as local as possible
2. Use `$derived()` for computed values
3. Use stores for shared state across components

### Performance Optimization

1. Use `$effect()` with care, specifying dependencies
2. Avoid unnecessary re-renders
3. Use the `{#key}` block for forcing re-renders when needed

### Code Organization

1. Break down complex components into smaller ones
2. Use lib directory for shared components
3. Follow consistent naming conventions

### Error Handling

```svelte
<script>
  let error = $state(null);
  let loading = $state(false);
  
  async function fetchData() {
    loading = true;
    error = null;
    
    try {
      const response = await fetch('/api/data');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      return await response.json();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
</script>

{#if loading}
  <p>Loading...</p>
{:else if error}
  <p class="error">{error}</p>
{:else}
  <!-- Display data -->
{/if}
```
