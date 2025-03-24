# SvelteKit 2 Client-Side Features (Part 5)

**Document Number**: GUIDE-011E  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Client-Side Performance Optimization](#client-side-performance-optimization)

## Client-Side Performance Optimization

SvelteKit provides several techniques for optimizing client-side performance, ensuring a smooth and responsive user experience.

### Code Splitting

SvelteKit automatically splits your JavaScript code into smaller chunks, loading only what's needed for the current page. This is handled through the built-in routing system.

```javascript
// src/routes/+layout.js
export const prerender = false;
export const ssr = true;
export const csr = true;

// This ensures that the code for this route is only loaded when needed
export function load() {
  return {
    // Route-specific data
  };
}
```

You can also manually control code splitting using dynamic imports:

```svelte
<script>
  import { onMount } from 'svelte';
  
  let Chart;
  let chartComponent;
  
  onMount(async () => {
    // Dynamically import the chart library only when needed
    const module = await import('chart.js');
    Chart = module.default;
    
    // Initialize chart
    initChart();
  });
  
  function initChart() {
    if (!Chart) return;
    
    const ctx = document.getElementById('myChart');
    
    chartComponent = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
        datasets: [{
          label: '# of Votes',
          data: [12, 19, 3, 5, 2, 3],
          backgroundColor: [
            'rgba(255, 99, 132, 0.2)',
            'rgba(54, 162, 235, 0.2)',
            'rgba(255, 206, 86, 0.2)',
            'rgba(75, 192, 192, 0.2)',
            'rgba(153, 102, 255, 0.2)',
            'rgba(255, 159, 64, 0.2)'
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
  
  onDestroy(() => {
    // Clean up chart when component is destroyed
    if (chartComponent) {
      chartComponent.destroy();
    }
  });
</script>

<div>
  <h2>Chart Example</h2>
  <canvas id="myChart" width="400" height="200"></canvas>
</div>
```

For components, you can use the dynamic `import()` function with Svelte's `svelte:component` element:

```svelte
<script>
  import { onMount } from 'svelte';
  
  let HeavyComponent;
  let showComponent = false;
  
  async function loadComponent() {
    // Only load the component when needed
    const module = await import('$lib/components/HeavyComponent.svelte');
    HeavyComponent = module.default;
    showComponent = true;
  }
</script>

<button on:click={loadComponent}>
  {showComponent ? 'Hide' : 'Show'} Heavy Component
</button>

{#if showComponent && HeavyComponent}
  <svelte:component this={HeavyComponent} />
{/if}
```

### Lazy Loading

Lazy loading is a technique to defer loading of non-critical resources until they are needed. This can significantly improve initial page load performance.

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let intersectionObserver;
  
  onMount(() => {
    // Initialize Intersection Observer only in the browser
    if (browser) {
      intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const lazyImage = entry.target;
            lazyImage.src = lazyImage.dataset.src;
            lazyImage.classList.remove('lazy');
            intersectionObserver.unobserve(lazyImage);
          }
        });
      });
      
      // Observe all lazy images
      document.querySelectorAll('img.lazy').forEach(img => {
        intersectionObserver.observe(img);
      });
    }
    
    return () => {
      // Clean up observer
      if (intersectionObserver) {
        intersectionObserver.disconnect();
      }
    };
  });
</script>

<slot></slot>
```

```svelte
<!-- src/routes/gallery/+page.svelte -->
<script>
  export let data;
</script>

<div class="gallery">
  {#each data.images as image}
    <div class="gallery-item">
      <img 
        class="lazy"
        src="/images/placeholder.jpg"
        data-src={image.url}
        alt={image.alt}
        width="300"
        height="200"
      />
      <p>{image.caption}</p>
    </div>
  {/each}
</div>

<style>
  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }
  
  .gallery-item {
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
  }
  
  img {
    width: 100%;
    height: auto;
    display: block;
    transition: opacity 0.3s;
  }
  
  img.lazy {
    opacity: 0.5;
  }
  
  p {
    padding: 0.5rem;
    margin: 0;
  }
</style>
```

For more complex scenarios, you can create a reusable lazy loading component:

```svelte
<!-- src/lib/components/LazyLoad.svelte -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  export let threshold = 0;
  export let rootMargin = '0px';
  export let once = true;
  
  let element;
  let intersecting = false;
  
  onMount(() => {
    if (!browser) return;
    
    const observer = new IntersectionObserver(
      entries => {
        intersecting = entries[0].isIntersecting;
        
        // If once is true and the element has intersected, unobserve it
        if (intersecting && once) {
          observer.unobserve(element);
        }
      },
      { threshold, rootMargin }
    );
    
    observer.observe(element);
    
    return () => {
      observer.unobserve(element);
    };
  });
</script>

<div bind:this={element}>
  {#if intersecting}
    <slot></slot>
  {:else}
    <slot name="placeholder">
      <div class="placeholder" style="height: 200px; background-color: #f5f5f5;"></div>
    </slot>
  {/if}
</div>
```

```svelte
<!-- Usage example -->
<script>
  import LazyLoad from '$lib/components/LazyLoad.svelte';
  
  export let data;
</script>

<div class="content">
  {#each data.sections as section, i}
    <LazyLoad rootMargin="100px">
      <div class="section">
        <h2>{section.title}</h2>
        <p>{section.content}</p>
        {#if section.image}
          <img src={section.image} alt={section.title} />
        {/if}
      </div>
      
      <svelte:fragment slot="placeholder">
        <div class="section-placeholder">
          <div class="title-placeholder"></div>
          <div class="content-placeholder"></div>
        </div>
      </svelte:fragment>
    </LazyLoad>
  {/each}
</div>

<style>
  .section {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .section-placeholder {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: #f9f9f9;
  }
  
  .title-placeholder {
    height: 30px;
    width: 70%;
    background-color: #eee;
    margin-bottom: 1rem;
  }
  
  .content-placeholder {
    height: 100px;
    background-color: #eee;
  }
</style>
```

### Optimizing Reactivity

Svelte 5's runes system provides a more granular approach to reactivity, allowing for better performance optimization.

```svelte
<script>
  // Bad: Entire object is reactive
  let user = $state({
    name: 'John Doe',
    email: 'john@example.com',
    preferences: {
      theme: 'dark',
      notifications: true,
      language: 'en'
    }
  });
  
  // Good: Only the specific properties that need to be reactive
  let userName = $state('John Doe');
  let userEmail = $state('john@example.com');
  let theme = $state('dark');
  let notifications = $state(true);
  let language = $state('en');
  
  // Derived values are only recalculated when dependencies change
  let greeting = $derived(`Hello, ${userName}!`);
  let displayName = $derived(userName.split(' ')[0]);
  
  // Effects are only run when dependencies change
  $effect(() => {
    // This only runs when theme changes
    document.body.setAttribute('data-theme', theme);
  });
  
  function updateUser(newName, newEmail) {
    // Only update what changed
    userName = newName;
    userEmail = newEmail;
  }
</script>
```

For lists and collections, use immutable patterns:

```svelte
<script>
  let items = $state([
    { id: 1, text: 'Item 1', completed: false },
    { id: 2, text: 'Item 2', completed: true },
    { id: 3, text: 'Item 3', completed: false }
  ]);
  
  // Derived values for filtering
  let completedItems = $derived(items.filter(item => item.completed));
  let incompleteItems = $derived(items.filter(item => !item.completed));
  
  function addItem(text) {
    // Create a new array instead of mutating the existing one
    items = [...items, { 
      id: Math.max(0, ...items.map(i => i.id)) + 1, 
      text, 
      completed: false 
    }];
  }
  
  function removeItem(id) {
    // Filter out the item to remove
    items = items.filter(item => item.id !== id);
  }
  
  function toggleItem(id) {
    // Map to a new array, updating only the matching item
    items = items.map(item => 
      item.id === id 
        ? { ...item, completed: !item.completed } 
        : item
    );
  }
</script>
```

### Memoization

For expensive computations, use memoization to avoid unnecessary recalculations:

```svelte
<script>
  import { memoize } from '$lib/utils';
  
  let data = $state([
    /* Large dataset */
  ]);
  
  let filter = $state('');
  
  // Memoize the expensive filtering operation
  const filterData = memoize((data, filter) => {
    console.log('Filtering data...');
    
    if (!filter) return data;
    
    return data.filter(item => 
      item.name.toLowerCase().includes(filter.toLowerCase()) ||
      item.description.toLowerCase().includes(filter.toLowerCase())
    );
  });
  
  // Use derived to automatically apply memoization
  let filteredData = $derived(filterData(data, filter));
</script>

<div>
  <input type="text" bind:value={filter} placeholder="Filter items..." />
  
  <div class="results">
    {#each filteredData as item}
      <div class="item">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
      </div>
    {/each}
  </div>
</div>
```

Here's a simple memoization utility:

```javascript
// src/lib/utils.js
export function memoize(fn) {
  const cache = new Map();
  
  return function(...args) {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    return result;
  };
}
```

### Virtual Scrolling

For long lists, implement virtual scrolling to only render visible items:

```svelte
<!-- src/lib/components/VirtualList.svelte -->
<script>
  import { onMount } from 'svelte';
  
  export let items = [];
  export let height = '400px';
  export let itemHeight = 50;
  
  let containerHeight;
  let scrollTop = 0;
  let visibleItems = [];
  
  $effect(() => {
    if (containerHeight === undefined) return;
    
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    );
    
    // Add buffer items for smoother scrolling
    const bufferSize = 5;
    const bufferedStart = Math.max(0, start - bufferSize);
    const bufferedEnd = Math.min(items.length, end + bufferSize);
    
    visibleItems = items
      .slice(bufferedStart, bufferedEnd)
      .map((item, i) => ({
        index: bufferedStart + i,
        data: item
      }));
  });
  
  function handleScroll(e) {
    scrollTop = e.target.scrollTop;
  }
</script>

<div 
  class="virtual-list-container"
  style="height: {height};"
  on:scroll={handleScroll}
  bind:clientHeight={containerHeight}
>
  <div 
    class="virtual-list-content"
    style="height: {items.length * itemHeight}px;"
  >
    {#each visibleItems as { index, data }}
      <div 
        class="virtual-list-item"
        style="
          height: {itemHeight}px;
          transform: translateY({index * itemHeight}px);
        "
      >
        <slot item={data} index={index}></slot>
      </div>
    {/each}
  </div>
</div>

<style>
  .virtual-list-container {
    overflow-y: auto;
    position: relative;
  }
  
  .virtual-list-content {
    position: relative;
  }
  
  .virtual-list-item {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
  }
</style>
```

```svelte
<!-- Usage example -->
<script>
  import VirtualList from '$lib/components/VirtualList.svelte';
  
  // Generate a large dataset
  let items = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    description: `Description for item ${i}`
  }));
</script>

<h2>Virtual List Example (10,000 items)</h2>

<VirtualList {items} height="400px" itemHeight={80}>
  <svelte:fragment let:item let:index>
    <div class="list-item">
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      <span class="index">#{index}</span>
    </div>
  </svelte:fragment>
</VirtualList>

<style>
  .list-item {
    padding: 1rem;
    border-bottom: 1px solid #ddd;
    background-color: white;
  }
  
  .index {
    position: absolute;
    right: 1rem;
    top: 1rem;
    color: #999;
  }
</style>
```

### Debouncing and Throttling

For performance-intensive operations triggered by user input, use debouncing and throttling:

```javascript
// src/lib/utils.js
export function debounce(func, wait) {
  let timeout;
  
  return function(...args) {
    const context = this;
    
    clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  
  return function(...args) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
```

```svelte
<script>
  import { debounce, throttle } from '$lib/utils';
  
  let searchTerm = $state('');
  let searchResults = $state([]);
  let loading = $state(false);
  
  // Debounce search to avoid excessive API calls
  const debouncedSearch = debounce(async (term) => {
    if (!term) {
      searchResults = [];
      return;
    }
    
    loading = true;
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      searchResults = await response.json();
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      loading = false;
    }
  }, 300);
  
  // Throttle scroll event handling
  const throttledScroll = throttle(() => {
    console.log('Scroll position:', window.scrollY);
    
    // Check if we need to load more results
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
      loadMoreResults();
    }
  }, 200);
  
  // Update search when searchTerm changes
  $effect(() => {
    debouncedSearch(searchTerm);
  });
  
  async function loadMoreResults() {
    // Implementation
  }
  
  onMount(() => {
    window.addEventListener('scroll', throttledScroll);
    
    return () => {
      window.removeEventListener('scroll', throttledScroll);
    };
  });
</script>

<div class="search">
  <input 
    type="text" 
    bind:value={searchTerm}
    placeholder="Search..."
  />
  
  {#if loading}
    <div class="loading">Searching...</div>
  {:else if searchResults.length === 0 && searchTerm}
    <div class="no-results">No results found</div>
  {:else}
    <div class="results">
      {#each searchResults as result}
        <div class="result-item">
          <h3>{result.title}</h3>
          <p>{result.description}</p>
        </div>
      {/each}
    </div>
  {/if}
</div>
```

### Web Workers

For CPU-intensive tasks, use Web Workers to avoid blocking the main thread:

```javascript
// src/lib/workers/sorter.js
self.onmessage = function(e) {
  const { items, sortBy, direction } = e.data;
  
  console.log(`Sorting ${items.length} items by ${sortBy} in ${direction} order`);
  
  // Perform expensive sorting
  const sortedItems = [...items].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    
    if (typeof aValue === 'string') {
      return direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else {
      return direction === 'asc'
        ? aValue - bValue
        : bValue - aValue;
    }
  });
  
  // Send the sorted items back to the main thread
  self.postMessage(sortedItems);
};
```

```svelte
<script>
  import { onMount } from 'svelte';
  
  let items = $state([
    /* Large dataset */
  ]);
  
  let sortBy = $state('name');
  let sortDirection = $state('asc');
  let sortedItems = $state([]);
  let sorting = $state(false);
  
  let worker;
  
  onMount(() => {
    // Create a worker
    worker = new Worker('/src/lib/workers/sorter.js');
    
    // Listen for messages from the worker
    worker.onmessage = (e) => {
      sortedItems = e.data;
      sorting = false;
    };
    
    // Initial sort
    sortItems();
    
    return () => {
      // Terminate the worker when the component is destroyed
      worker.terminate();
    };
  });
  
  // Sort items when sort parameters change
  $effect(() => {
    if (worker) {
      sortItems();
    }
  });
  
  function sortItems() {
    sorting = true;
    
    // Send the items to the worker for sorting
    worker.postMessage({
      items,
      sortBy,
      direction: sortDirection
    });
  }
  
  function toggleSortDirection() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  }
  
  function changeSortBy(field) {
    if (sortBy === field) {
      toggleSortDirection();
    } else {
      sortBy = field;
      sortDirection = 'asc';
    }
  }
</script>

<div class="data-table">
  <div class="table-header">
    <div 
      class="header-cell"
      class:active={sortBy === 'id'}
      on:click={() => changeSortBy('id')}
    >
      ID {sortBy === 'id' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
    </div>
    <div 
      class="header-cell"
      class:active={sortBy === 'name'}
      on:click={() => changeSortBy('name')}
    >
      Name {sortBy === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
    </div>
    <div 
      class="header-cell"
      class:active={sortBy === 'value'}
      on:click={() => changeSortBy('value')}
    >
      Value {sortBy === 'value' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
    </div>
  </div>
  
  {#if sorting}
    <div class="loading">Sorting...</div>
  {:else}
    <div class="table-body">
      {#each sortedItems as item}
        <div class="table-row">
          <div class="cell">{item.id}</div>
          <div class="cell">{item.name}</div>
          <div class="cell">{item.value}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .data-table {
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .table-header {
    display: grid;
    grid-template-columns: 100px 1fr 100px;
    background-color: #f5f5f5;
    border-bottom: 1px solid #ddd;
  }
  
  .header-cell {
    padding: 0.5rem;
    font-weight: bold;
    cursor: pointer;
  }
  
  .header-cell:hover {
    background-color: #e0e0e0;
  }
  
  .header-cell.active {
    background-color: #e0e0e0;
  }
  
  .table-row {
    display: grid;
    grid-template-columns: 100px 1fr 100px;
    border-bottom: 1px solid #ddd;
  }
  
  .cell {
    padding: 0.5rem;
  }
  
  .loading {
    padding: 1rem;
    text-align: center;
  }
</style>
```
