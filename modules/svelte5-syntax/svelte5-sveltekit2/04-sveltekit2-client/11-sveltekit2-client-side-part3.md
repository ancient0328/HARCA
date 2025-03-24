# SvelteKit 2 Client-Side Features (Part 3)

**Document Number**: GUIDE-011C  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Component Lifecycle](#component-lifecycle)
2. [Advanced Component Patterns](#advanced-component-patterns)

## Component Lifecycle

SvelteKit components follow the Svelte 5 component lifecycle, with some additional considerations for server-side rendering and hydration.

### Basic Lifecycle with Runes

In Svelte 5, the traditional lifecycle functions (`onMount`, `onDestroy`, etc.) are replaced with the `$effect` rune, which provides a more unified approach to handling component lifecycle.

```svelte
<script>
  import { browser } from '$app/environment';
  
  let count = $state(0);
  let interval;
  
  // Effect runs after the component is mounted
  $effect(() => {
    // Only run in the browser
    if (browser) {
      console.log('Component mounted');
      
      // Set up an interval
      interval = setInterval(() => {
        count++;
      }, 1000);
      
      // Return a cleanup function that runs when the component is destroyed
      return () => {
        console.log('Component destroyed');
        clearInterval(interval);
      };
    }
  });
  
  // Effect that runs whenever count changes
  $effect(() => {
    if (browser) {
      console.log(`Count changed to ${count}`);
    }
  });
</script>

<div>
  <h1>Count: {count}</h1>
  <button on:click={() => count++}>Increment</button>
</div>
```

### Server vs. Client Execution

```svelte
<script>
  import { browser, dev } from '$app/environment';
  
  let mounted = $state(false);
  let renderLocation = $state('server');
  
  // This code runs on both server and client
  console.log(`Rendering on ${browser ? 'client' : 'server'}`);
  
  // This effect only runs on the client
  $effect(() => {
    if (browser) {
      mounted = true;
      renderLocation = 'client';
      
      // Log only in development
      if (dev) {
        console.log('Component hydrated on client');
      }
    }
  });
</script>

<div>
  <p>Initially rendered on: {renderLocation}</p>
  <p>Mounted: {mounted ? 'Yes' : 'No'}</p>
</div>
```

### Handling Hydration Mismatches

```svelte
<script>
  import { browser } from '$app/environment';
  
  let timeString = $state(new Date().toLocaleTimeString());
  
  // Update the time every second, but only on the client
  $effect(() => {
    if (!browser) return;
    
    const interval = setInterval(() => {
      timeString = new Date().toLocaleTimeString();
    }, 1000);
    
    return () => clearInterval(interval);
  });
</script>

<div>
  <!-- 
    This will show different times on server and client initially,
    but will hydrate without errors because the value is managed by state
  -->
  <p>Current time: {timeString}</p>
</div>
```

### Lifecycle with Navigation

```svelte
<script>
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  
  let previousPath = $state(null);
  let currentPath = $state($page.url.pathname);
  let visitCount = $state(0);
  
  // Update paths when the page changes
  $effect(() => {
    previousPath = currentPath;
    currentPath = $page.url.pathname;
    visitCount++;
  });
  
  // Run before navigation occurs
  beforeNavigate(({ from, to, cancel }) => {
    // Example: Prevent navigation if a form is dirty
    if (formIsDirty && !confirm('You have unsaved changes. Continue?')) {
      cancel();
    }
    
    // Example: Save draft before leaving
    if (from?.url.pathname === '/editor') {
      saveDraft();
    }
  });
  
  // Run after navigation completes
  afterNavigate(({ from, to }) => {
    // Example: Track page view
    trackPageView(to.url.pathname);
    
    // Example: Focus main content for accessibility
    document.getElementById('main-content')?.focus();
  });
  
  function formIsDirty() {
    // Implementation
    return false;
  }
  
  function saveDraft() {
    // Implementation
  }
  
  function trackPageView(path) {
    // Implementation
  }
</script>

<div id="main-content" tabindex="-1">
  <p>Current path: {currentPath}</p>
  <p>Previous path: {previousPath || 'None'}</p>
  <p>Visit count: {visitCount}</p>
</div>
```

### Handling External Resources

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  
  let scriptLoaded = $state(false);
  let mapInstance = $state(null);
  
  // Load external script
  $effect(() => {
    if (!browser) return;
    
    // Create script element
    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY';
    script.async = true;
    script.defer = true;
    
    // Set up load handler
    script.onload = () => {
      scriptLoaded = true;
      initMap();
    };
    
    // Add to document
    document.head.appendChild(script);
    
    // Clean up
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      
      if (mapInstance) {
        // Clean up map instance
        mapInstance = null;
      }
    };
  });
  
  function initMap() {
    if (!window.google || !window.google.maps) return;
    
    const mapElement = document.getElementById('map');
    
    if (mapElement) {
      mapInstance = new window.google.maps.Map(mapElement, {
        center: { lat: -34.397, lng: 150.644 },
        zoom: 8
      });
    }
  }
</script>

<div>
  {#if scriptLoaded}
    <div id="map" style="height: 400px; width: 100%;"></div>
  {:else}
    <p>Loading map...</p>
  {/if}
</div>
```

### Handling Animations and Transitions

```svelte
<script>
  import { fade, fly } from 'svelte/transition';
  import { navigating, page } from '$app/stores';
  
  // Generate a unique key for each page
  let pageKey;
  
  $effect(() => {
    pageKey = $page.url.pathname;
  });
  
  // Track if this is the initial render
  let initialRender = $state(true);
  
  $effect(() => {
    // Set initialRender to false after the first render
    if (initialRender) {
      // Use setTimeout to ensure this runs after hydration
      setTimeout(() => {
        initialRender = false;
      }, 0);
    }
  });
</script>

<!-- Show loading indicator during navigation -->
{#if $navigating}
  <div 
    class="loading-indicator"
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 200 }}
  >
    <div class="spinner"></div>
    <p>Loading {$navigating.to.url.pathname}...</p>
  </div>
{/if}

<!-- Only animate page transitions after initial render -->
{#key pageKey}
  <main 
    in:fly={{ y: 20, duration: 250, delay: 250 }} 
    out:fly={{ y: -20, duration: 250 }}
    class:no-animation={initialRender}
  >
    <slot></slot>
  </main>
{/key}

<style>
  .loading-indicator {
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
  
  .no-animation {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
</style>
```

## Advanced Component Patterns

SvelteKit supports advanced component patterns for building complex applications.

### Component Composition

```svelte
<!-- src/lib/components/Card.svelte -->
<script>
  export let title;
  export let subtitle = '';
  export let image = null;
  export let imageAlt = '';
  export let href = null;
</script>

<div class="card">
  {#if image}
    <div class="card-image">
      <img src={image} alt={imageAlt} />
    </div>
  {/if}
  
  <div class="card-content">
    <h3 class="card-title">
      {#if href}
        <a {href}>{title}</a>
      {:else}
        {title}
      {/if}
    </h3>
    
    {#if subtitle}
      <p class="card-subtitle">{subtitle}</p>
    {/if}
    
    <div class="card-body">
      <slot></slot>
    </div>
  </div>
  
  {#if $$slots.footer}
    <div class="card-footer">
      <slot name="footer"></slot>
    </div>
  {/if}
</div>

<style>
  .card {
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .card-image img {
    width: 100%;
    height: auto;
    display: block;
  }
  
  .card-content {
    padding: 1rem;
    flex: 1;
  }
  
  .card-title {
    margin: 0 0 0.5rem;
  }
  
  .card-subtitle {
    color: #666;
    margin: 0 0 1rem;
  }
  
  .card-footer {
    padding: 1rem;
    background-color: #f9f9f9;
    border-top: 1px solid #ddd;
  }
</style>
```

```svelte
<!-- src/routes/products/+page.svelte -->
<script>
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  
  export let data;
</script>

<div class="products-grid">
  {#each data.products as product}
    <Card
      title={product.name}
      subtitle={`$${product.price}`}
      image={product.image}
      imageAlt={product.name}
      href={`/products/${product.id}`}
    >
      <p>{product.description}</p>
      
      <svelte:fragment slot="footer">
        <Button on:click={() => addToCart(product)}>
          Add to Cart
        </Button>
      </svelte:fragment>
    </Card>
  {/each}
</div>
```

### Higher-Order Components

```svelte
<!-- src/lib/components/WithAuth.svelte -->
<script>
  import { isAuthenticated, user } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  
  export let requiredRole = null;
  
  let authorized = $state(false);
  
  $effect(() => {
    // Check if user is authenticated
    if (!$isAuthenticated) {
      goto('/login?redirectTo=' + encodeURIComponent(window.location.pathname));
      return;
    }
    
    // Check if user has required role
    if (requiredRole && $user.role !== requiredRole) {
      goto('/unauthorized');
      return;
    }
    
    // User is authorized
    authorized = true;
  });
</script>

{#if authorized}
  <slot user={$user}></slot>
{:else}
  <slot name="loading">
    <p>Checking authorization...</p>
  </slot>
{/if}
```

```svelte
<!-- src/routes/admin/+layout.svelte -->
<script>
  import WithAuth from '$lib/components/WithAuth.svelte';
</script>

<WithAuth requiredRole="admin">
  <div class="admin-layout">
    <aside>
      <nav>
        <a href="/admin">Dashboard</a>
        <a href="/admin/users">Users</a>
        <a href="/admin/products">Products</a>
        <a href="/admin/settings">Settings</a>
      </nav>
    </aside>
    
    <main>
      <slot></slot>
    </main>
  </div>
  
  <svelte:fragment slot="loading">
    <div class="loading-screen">
      <div class="spinner"></div>
      <p>Loading admin panel...</p>
    </div>
  </svelte:fragment>
</WithAuth>
```

### Render Props Pattern

```svelte
<!-- src/lib/components/FetchData.svelte -->
<script>
  export let url;
  export let method = 'GET';
  export let body = null;
  
  let data = $state(null);
  let loading = $state(true);
  let error = $state(null);
  
  async function fetchData() {
    loading = true;
    error = null;
    
    try {
      const response = await fetch(url, {
        method,
        body: body ? JSON.stringify(body) : null,
        headers: body ? { 'Content-Type': 'application/json' } : {}
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      data = await response.json();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  // Fetch data on mount
  $effect(() => {
    fetchData();
  });
</script>

<slot {data} {loading} {error} {fetchData}></slot>
```

```svelte
<!-- src/routes/products/+page.svelte -->
<script>
  import FetchData from '$lib/components/FetchData.svelte';
</script>

<FetchData url="/api/products" let:data let:loading let:error let:fetchData>
  {#if loading}
    <p>Loading products...</p>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={fetchData}>Retry</button>
    </div>
  {:else}
    <div class="products-grid">
      {#each data as product}
        <div class="product-card">
          <h3>{product.name}</h3>
          <p>${product.price}</p>
        </div>
      {/each}
    </div>
  {/if}
</FetchData>
```

### Component Context

```svelte
<!-- src/lib/components/Tabs.svelte -->
<script>
  import { setContext } from 'svelte';
  
  export let activeTab = 0;
  
  let tabs = $state([]);
  let panels = $state([]);
  
  // Provide context for tab items and panels
  setContext('tabs', {
    registerTab: (tab) => {
      tabs = [...tabs, tab];
      return tabs.length - 1;
    },
    registerPanel: (panel) => {
      panels = [...panels, panel];
      return panels.length - 1;
    },
    selectTab: (index) => {
      activeTab = index;
    },
    activeTab: () => activeTab
  });
</script>

<div class="tabs">
  <div class="tab-list" role="tablist">
    <slot name="tabs"></slot>
  </div>
  
  <div class="tab-panels">
    <slot name="panels"></slot>
  </div>
</div>

<style>
  .tabs {
    margin: 1rem 0;
  }
  
  .tab-list {
    display: flex;
    border-bottom: 1px solid #ddd;
  }
  
  .tab-panels {
    padding: 1rem 0;
  }
</style>
```

```svelte
<!-- src/lib/components/Tab.svelte -->
<script>
  import { getContext } from 'svelte';
  
  export let label;
  
  const { registerTab, selectTab, activeTab } = getContext('tabs');
  
  // Register this tab
  const index = registerTab({ label });
  
  // Check if this tab is active
  $effect(() => {
    isActive = activeTab() === index;
  });
  
  let isActive;
</script>

<button
  role="tab"
  aria-selected={isActive}
  aria-controls={`panel-${index}`}
  id={`tab-${index}`}
  tabindex={isActive ? 0 : -1}
  class="tab"
  class:active={isActive}
  on:click={() => selectTab(index)}
>
  {label}
</button>

<style>
  .tab {
    padding: 0.5rem 1rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
  }
  
  .tab.active {
    border-bottom-color: var(--accent-color);
    font-weight: bold;
  }
</style>
```

```svelte
<!-- src/lib/components/TabPanel.svelte -->
<script>
  import { getContext } from 'svelte';
  
  const { registerPanel, activeTab } = getContext('tabs');
  
  // Register this panel
  const index = registerPanel({});
  
  // Check if this panel is active
  $effect(() => {
    isActive = activeTab() === index;
  });
  
  let isActive;
</script>

<div
  role="tabpanel"
  id={`panel-${index}`}
  aria-labelledby={`tab-${index}`}
  hidden={!isActive}
>
  {#if isActive}
    <slot></slot>
  {/if}
</div>
```

```svelte
<!-- Usage example -->
<script>
  import Tabs from '$lib/components/Tabs.svelte';
  import Tab from '$lib/components/Tab.svelte';
  import TabPanel from '$lib/components/TabPanel.svelte';
</script>

<Tabs>
  <svelte:fragment slot="tabs">
    <Tab label="Profile" />
    <Tab label="Settings" />
    <Tab label="Notifications" />
  </svelte:fragment>
  
  <svelte:fragment slot="panels">
    <TabPanel>
      <h2>Profile</h2>
      <p>Profile content here</p>
    </TabPanel>
    
    <TabPanel>
      <h2>Settings</h2>
      <p>Settings content here</p>
    </TabPanel>
    
    <TabPanel>
      <h2>Notifications</h2>
      <p>Notifications content here</p>
    </TabPanel>
  </svelte:fragment>
</Tabs>
```

### Compound Components

```svelte
<!-- src/lib/components/Select/Select.svelte -->
<script>
  import { setContext, createEventDispatcher } from 'svelte';
  import { writable } from 'svelte/store';
  
  export let value = undefined;
  export let placeholder = 'Select an option';
  export let disabled = false;
  
  const dispatch = createEventDispatcher();
  
  // Create stores for the select state
  const isOpen = writable(false);
  const options = writable([]);
  const selectedOption = writable(null);
  
  // Provide context for child components
  setContext('select', {
    isOpen,
    options,
    selectedOption,
    registerOption: (option) => {
      options.update(opts => [...opts, option]);
      
      // If this option matches the current value, select it
      if (option.value === value) {
        selectedOption.set(option);
      }
      
      return {
        deregister: () => {
          options.update(opts => opts.filter(o => o !== option));
        }
      };
    },
    selectOption: (option) => {
      selectedOption.set(option);
      value = option.value;
      isOpen.set(false);
      dispatch('change', { value: option.value });
    }
  });
  
  // Handle clicks outside the select
  function handleClickOutside(event) {
    if (!event.target.closest('.select-container')) {
      isOpen.set(false);
    }
  }
  
  // Toggle the dropdown
  function toggleDropdown() {
    if (!disabled) {
      isOpen.update(open => !open);
    }
  }
  
  // Update the selected option when the value changes
  $effect(() => {
    if (value === undefined) {
      selectedOption.set(null);
      return;
    }
    
    const option = $options.find(opt => opt.value === value);
    if (option) {
      selectedOption.set(option);
    }
  });
  
  // Add event listener for clicks outside
  $effect(() => {
    if ($isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });
</script>

<div class="select-container" class:disabled>
  <button
    type="button"
    class="select-button"
    aria-haspopup="listbox"
    aria-expanded={$isOpen}
    on:click={toggleDropdown}
    disabled={disabled}
  >
    {#if $selectedOption}
      <span class="selected-value">{$selectedOption.label}</span>
    {:else}
      <span class="placeholder">{placeholder}</span>
    {/if}
    
    <span class="select-arrow" aria-hidden="true">
      {$isOpen ? '▲' : '▼'}
    </span>
  </button>
  
  {#if $isOpen}
    <div class="select-dropdown" role="listbox">
      <slot></slot>
    </div>
  {/if}
</div>

<style>
  .select-container {
    position: relative;
    width: 100%;
  }
  
  .select-button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.5rem;
    background-color: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
  }
  
  .select-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    background-color: white;
    border: 1px solid #ddd;
    border-top: none;
    border-radius: 0 0 4px 4px;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .placeholder {
    color: #999;
  }
  
  .disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .disabled .select-button {
    cursor: not-allowed;
  }
</style>
```

```svelte
<!-- src/lib/components/Select/Option.svelte -->
<script>
  import { getContext } from 'svelte';
  
  export let value;
  export let label = undefined;
  
  // If no label is provided, use the value as the label
  if (label === undefined) {
    label = value.toString();
  }
  
  const { registerOption, selectOption, selectedOption, isOpen } = getContext('select');
  
  // Register this option with the parent select
  const option = { value, label };
  const { deregister } = registerOption(option);
  
  // Deregister when the component is destroyed
  onDestroy(deregister);
  
  // Check if this option is selected
  $effect(() => {
    isSelected = $selectedOption?.value === value;
  });
  
  let isSelected;
</script>

<div
  class="select-option"
  class:selected={isSelected}
  role="option"
  aria-selected={isSelected}
  on:click={() => selectOption(option)}
>
  <slot>
    {label}
  </slot>
</div>

<style>
  .select-option {
    padding: 0.5rem;
    cursor: pointer;
  }
  
  .select-option:hover {
    background-color: #f5f5f5;
  }
  
  .selected {
    background-color: #e0e0e0;
    font-weight: bold;
  }
</style>
```

```svelte
<!-- Usage example -->
<script>
  import Select from '$lib/components/Select/Select.svelte';
  import Option from '$lib/components/Select/Option.svelte';
  
  let selectedCountry = 'jp';
  
  function handleChange(event) {
    console.log('Selected country:', event.detail.value);
  }
</script>

<Select 
  bind:value={selectedCountry} 
  placeholder="Select a country"
  on:change={handleChange}
>
  <Option value="us" label="United States" />
  <Option value="ca" label="Canada" />
  <Option value="uk" label="United Kingdom" />
  <Option value="jp" label="Japan" />
  <Option value="au" label="Australia" />
</Select>

<p>Selected country: {selectedCountry}</p>
```
