# SvelteKit 2 Client-Side Features (Part 4)

**Document Number**: GUIDE-011D  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Basic Event Handling](#basic-event-handling)
2. [Event Modifiers](#event-modifiers)

## Basic Event Handling

SvelteKit inherits Svelte's powerful event handling system, allowing for intuitive and declarative event management.

### DOM Events

```svelte
<script>
  let count = $state(0);
  
  function increment() {
    count++;
  }
  
  function decrement() {
    count--;
  }
  
  function reset() {
    count = 0;
  }
</script>

<div>
  <h1>Count: {count}</h1>
  
  <button on:click={increment}>Increment</button>
  <button on:click={decrement}>Decrement</button>
  <button on:click={reset}>Reset</button>
</div>
```

### Inline Event Handlers

```svelte
<script>
  let count = $state(0);
  let name = $state('');
</script>

<div>
  <h1>Count: {count}</h1>
  
  <button on:click={() => count++}>Increment</button>
  <button on:click={() => count--}>Decrement</button>
  <button on:click={() => count = 0}>Reset</button>
  
  <div>
    <input 
      type="text" 
      bind:value={name} 
      on:input={(e) => console.log('Input value:', e.target.value)}
      on:focus={() => console.log('Input focused')}
      on:blur={() => console.log('Input blurred')}
    />
  </div>
</div>
```

### Event Object Access

```svelte
<script>
  let mousePosition = $state({ x: 0, y: 0 });
  let keys = $state([]);
  
  function handleMouseMove(event) {
    mousePosition = {
      x: event.clientX,
      y: event.clientY
    };
  }
  
  function handleKeyDown(event) {
    const key = event.key;
    
    if (!keys.includes(key)) {
      keys = [...keys, key];
    }
  }
  
  function handleKeyUp(event) {
    const key = event.key;
    keys = keys.filter(k => k !== key);
  }
</script>

<div 
  class="event-area"
  on:mousemove={handleMouseMove}
  on:keydown={handleKeyDown}
  on:keyup={handleKeyUp}
  tabindex="0"
>
  <p>Move your mouse or press keys</p>
  <p>Mouse position: {mousePosition.x}, {mousePosition.y}</p>
  <p>Keys pressed: {keys.join(', ') || 'None'}</p>
</div>

<style>
  .event-area {
    width: 100%;
    height: 200px;
    background-color: #f5f5f5;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
</style>
```

### Form Events

```svelte
<script>
  let formData = $state({
    name: '',
    email: '',
    message: ''
  });
  
  let errors = $state({});
  let submitted = $state(false);
  
  function validateForm() {
    const newErrors = {};
    
    if (!formData.name) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.message) {
      newErrors.message = 'Message is required';
    }
    
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }
  
  function handleSubmit(event) {
    // Prevent the default form submission
    event.preventDefault();
    
    if (validateForm()) {
      // Form is valid, submit it
      console.log('Form submitted:', formData);
      submitted = true;
    }
  }
  
  function handleInput(field, event) {
    // Update the form data
    formData[field] = event.target.value;
    
    // Clear the error for this field if it exists
    if (errors[field]) {
      const { [field]: _, ...rest } = errors;
      errors = rest;
    }
  }
</script>

{#if submitted}
  <div class="success-message">
    <h2>Thank you for your submission!</h2>
    <p>We'll get back to you soon.</p>
    <button on:click={() => {
      formData = { name: '', email: '', message: '' };
      submitted = false;
    }}>
      Submit another message
    </button>
  </div>
{:else}
  <form on:submit={handleSubmit} class="contact-form">
    <h2>Contact Us</h2>
    
    <div class="form-group">
      <label for="name">Name</label>
      <input 
        id="name"
        type="text" 
        value={formData.name}
        on:input={(e) => handleInput('name', e)}
        class:error={errors.name}
      />
      {#if errors.name}
        <p class="error-message">{errors.name}</p>
      {/if}
    </div>
    
    <div class="form-group">
      <label for="email">Email</label>
      <input 
        id="email"
        type="email" 
        value={formData.email}
        on:input={(e) => handleInput('email', e)}
        class:error={errors.email}
      />
      {#if errors.email}
        <p class="error-message">{errors.email}</p>
      {/if}
    </div>
    
    <div class="form-group">
      <label for="message">Message</label>
      <textarea 
        id="message"
        rows="5"
        value={formData.message}
        on:input={(e) => handleInput('message', e)}
        class:error={errors.message}
      ></textarea>
      {#if errors.message}
        <p class="error-message">{errors.message}</p>
      {/if}
    </div>
    
    <button type="submit">Send Message</button>
  </form>
{/if}

<style>
  .contact-form {
    max-width: 500px;
    margin: 0 auto;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }
  
  input, textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  input.error, textarea.error {
    border-color: red;
  }
  
  .error-message {
    color: red;
    margin-top: 0.25rem;
    font-size: 0.875rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    background-color: var(--accent-color, #3498db);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .success-message {
    max-width: 500px;
    margin: 0 auto;
    text-align: center;
    padding: 2rem;
    background-color: #f5f5f5;
    border-radius: 4px;
  }
</style>
```

### Custom Events

```svelte
<!-- src/lib/components/Counter.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  
  export let initialValue = 0;
  export let step = 1;
  export let min = null;
  export let max = null;
  
  const dispatch = createEventDispatcher();
  
  let count = $state(initialValue);
  
  function increment() {
    const newValue = count + step;
    
    // Check if the new value is within bounds
    if (max !== null && newValue > max) {
      return;
    }
    
    count = newValue;
    dispatch('change', { value: count });
    
    // Dispatch a custom event when the maximum is reached
    if (max !== null && count === max) {
      dispatch('maximum', { value: count });
    }
  }
  
  function decrement() {
    const newValue = count - step;
    
    // Check if the new value is within bounds
    if (min !== null && newValue < min) {
      return;
    }
    
    count = newValue;
    dispatch('change', { value: count });
    
    // Dispatch a custom event when the minimum is reached
    if (min !== null && count === min) {
      dispatch('minimum', { value: count });
    }
  }
  
  function reset() {
    count = initialValue;
    dispatch('change', { value: count });
    dispatch('reset');
  }
</script>

<div class="counter">
  <button on:click={decrement} disabled={min !== null && count <= min}>-</button>
  <span class="count">{count}</span>
  <button on:click={increment} disabled={max !== null && count >= max}>+</button>
  <button on:click={reset} class="reset">Reset</button>
</div>

<style>
  .counter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .count {
    font-size: 1.25rem;
    min-width: 2rem;
    text-align: center;
  }
  
  button {
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    background-color: var(--accent-color, #3498db);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .reset {
    width: auto;
    padding: 0 0.5rem;
  }
</style>
```

```svelte
<!-- Usage example -->
<script>
  import Counter from '$lib/components/Counter.svelte';
  
  let currentValue = $state(0);
  let message = $state('');
  
  function handleChange(event) {
    currentValue = event.detail.value;
    message = `Counter changed to ${currentValue}`;
  }
  
  function handleMinimum() {
    message = 'Minimum value reached!';
  }
  
  function handleMaximum() {
    message = 'Maximum value reached!';
  }
  
  function handleReset() {
    message = 'Counter was reset';
  }
</script>

<div>
  <h2>Product Quantity</h2>
  
  <Counter 
    initialValue={1} 
    min={1} 
    max={10}
    on:change={handleChange}
    on:minimum={handleMinimum}
    on:maximum={handleMaximum}
    on:reset={handleReset}
  />
  
  <p>Current quantity: {currentValue}</p>
  <p>{message}</p>
</div>
```

### Event Forwarding

```svelte
<!-- src/lib/components/Button.svelte -->
<script>
  export let type = 'button';
  export let variant = 'primary';
  export let disabled = false;
  export let fullWidth = false;
</script>

<button 
  {type} 
  {disabled}
  class="button {variant}"
  class:full-width={fullWidth}
  on:click
  on:mouseover
  on:mouseenter
  on:mouseleave
  on:focus
  on:blur
>
  <slot></slot>
</button>

<style>
  .button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }
  
  .primary {
    background-color: var(--primary-color, #3498db);
    color: white;
  }
  
  .secondary {
    background-color: #f5f5f5;
    color: #333;
    border: 1px solid #ddd;
  }
  
  .danger {
    background-color: #e74c3c;
    color: white;
  }
  
  .success {
    background-color: #2ecc71;
    color: white;
  }
  
  .button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .full-width {
    width: 100%;
  }
</style>
```

```svelte
<!-- Usage example -->
<script>
  import Button from '$lib/components/Button.svelte';
  
  function handleClick() {
    alert('Button clicked!');
  }
  
  function handleMouseEnter() {
    console.log('Mouse entered button');
  }
  
  function handleMouseLeave() {
    console.log('Mouse left button');
  }
</script>

<div>
  <Button 
    variant="primary"
    on:click={handleClick}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
  >
    Click Me
  </Button>
</div>
```

## Event Modifiers

Svelte provides event modifiers to simplify common event handling patterns.

### Basic Modifiers

```svelte
<script>
  let clickCount = $state(0);
  
  function handleClick() {
    clickCount++;
  }
</script>

<div class="event-modifiers">
  <h2>Event Modifiers</h2>
  
  <div class="example">
    <h3>Default (no modifier)</h3>
    <button on:click={handleClick}>
      Click me ({clickCount})
    </button>
    <p>This will trigger the event handler normally.</p>
  </div>
  
  <div class="example">
    <h3>preventDefault</h3>
    <a 
      href="https://example.com" 
      on:click|preventDefault={() => alert('Link click prevented')}
    >
      Example Link
    </a>
    <p>This will prevent the default action (navigating to the URL).</p>
  </div>
  
  <div class="example">
    <h3>stopPropagation</h3>
    <div 
      class="outer" 
      on:click={() => alert('Outer div clicked')}
    >
      Outer div
      <div 
        class="inner" 
        on:click|stopPropagation={() => alert('Inner div clicked')}
      >
        Inner div (click won't propagate)
      </div>
    </div>
    <p>This will stop the event from propagating to parent elements.</p>
  </div>
  
  <div class="example">
    <h3>once</h3>
    <button on:click|once={() => alert('This alert appears only once')}>
      Click me (once)
    </button>
    <p>This will only trigger the event handler once.</p>
  </div>
  
  <div class="example">
    <h3>self</h3>
    <div 
      class="self-example" 
      on:click|self={() => alert('Clicked directly on the div')}
    >
      Click me directly (not on the span)
      <span>Clicking here won't trigger the handler</span>
    </div>
    <p>This will only trigger if the event target is the element itself.</p>
  </div>
</div>

<style>
  .event-modifiers {
    max-width: 600px;
    margin: 0 auto;
  }
  
  .example {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .outer {
    padding: 1rem;
    background-color: #f5f5f5;
    border: 1px solid #ddd;
  }
  
  .inner {
    margin-top: 0.5rem;
    padding: 1rem;
    background-color: #e0e0e0;
    border: 1px solid #ccc;
  }
  
  .self-example {
    padding: 1rem;
    background-color: #f5f5f5;
    border: 1px solid #ddd;
  }
  
  .self-example span {
    display: block;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: #e0e0e0;
    border: 1px solid #ccc;
  }
</style>
```

### Keyboard Event Modifiers

```svelte
<script>
  let inputValue = $state('');
  let lastKey = $state('');
  
  function handleKeydown(event) {
    lastKey = event.key;
  }
</script>

<div class="keyboard-modifiers">
  <h2>Keyboard Event Modifiers</h2>
  
  <div class="example">
    <h3>Enter Key</h3>
    <input 
      type="text" 
      placeholder="Press Enter to submit"
      on:keydown|enter={() => alert('Enter key pressed')}
    />
    <p>This will only trigger when the Enter key is pressed.</p>
  </div>
  
  <div class="example">
    <h3>Escape Key</h3>
    <input 
      type="text" 
      placeholder="Press Escape to clear"
      bind:value={inputValue}
      on:keydown|escape={() => inputValue = ''}
    />
    <p>This will clear the input when the Escape key is pressed.</p>
  </div>
  
  <div class="example">
    <h3>Modifier Keys</h3>
    <input 
      type="text" 
      placeholder="Press Ctrl+S"
      on:keydown|ctrl|s|preventDefault={() => alert('Saved!')}
    />
    <p>This will trigger when Ctrl+S is pressed (and prevent the browser's save dialog).</p>
  </div>
  
  <div class="example">
    <h3>Multiple Modifiers</h3>
    <div 
      class="key-monitor" 
      tabindex="0"
      on:keydown={handleKeydown}
    >
      Click here and press keys
      <p>Last key pressed: {lastKey || 'None'}</p>
    </div>
    <div class="key-actions">
      <button 
        on:click|once={() => alert('This works with Ctrl+Enter')}
        on:keydown|ctrl|enter={() => alert('Ctrl+Enter pressed')}
      >
        Ctrl+Enter
      </button>
      <button 
        on:click|once={() => alert('This works with Shift+Space')}
        on:keydown|shift|space={() => alert('Shift+Space pressed')}
      >
        Shift+Space
      </button>
    </div>
  </div>
</div>

<style>
  .keyboard-modifiers {
    max-width: 600px;
    margin: 0 auto;
  }
  
  .example {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .key-monitor {
    padding: 1rem;
    background-color: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: text;
  }
  
  .key-monitor:focus {
    outline: 2px solid var(--accent-color, #3498db);
  }
  
  .key-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    background-color: var(--accent-color, #3498db);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
```

### Combined Modifiers

```svelte
<script>
  let clicks = $state([]);
  
  function addClick(message) {
    clicks = [...clicks, message];
  }
  
  function clearClicks() {
    clicks = [];
  }
</script>

<div class="combined-modifiers">
  <h2>Combined Event Modifiers</h2>
  
  <div class="example">
    <h3>Multiple Modifiers</h3>
    <div class="click-area">
      <div 
        class="outer-box"
        on:click={() => addClick('Outer box clicked')}
      >
        Outer Box
        <div 
          class="middle-box"
          on:click|stopPropagation={() => addClick('Middle box clicked')}
        >
          Middle Box
          <button 
            on:click|once|stopPropagation={() => addClick('Button clicked (once only)')}
          >
            Click Me Once
          </button>
        </div>
      </div>
    </div>
    
    <div class="click-log">
      <h4>Click Log:</h4>
      {#if clicks.length === 0}
        <p>No clicks yet</p>
      {:else}
        <ul>
          {#each clicks as click}
            <li>{click}</li>
          {/each}
        </ul>
      {/if}
      <button on:click={clearClicks}>Clear Log</button>
    </div>
  </div>
  
  <div class="example">
    <h3>Form with Multiple Modifiers</h3>
    <form 
      on:submit|preventDefault={() => addClick('Form submitted')}
    >
      <div class="form-group">
        <label for="username">Username</label>
        <input 
          id="username"
          type="text" 
          on:input|self={(e) => addClick(`Username input: ${e.target.value}`)}
        />
      </div>
      
      <div class="form-group">
        <label for="password">Password</label>
        <input 
          id="password"
          type="password"
          on:keydown|enter={() => addClick('Enter pressed in password field')}
        />
      </div>
      
      <button type="submit">Submit</button>
    </form>
  </div>
</div>

<style>
  .combined-modifiers {
    max-width: 600px;
    margin: 0 auto;
  }
  
  .example {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .click-area {
    margin-bottom: 1rem;
  }
  
  .outer-box {
    padding: 2rem;
    background-color: #f5f5f5;
    border: 1px solid #ddd;
    text-align: center;
  }
  
  .middle-box {
    margin: 1rem auto;
    padding: 1rem;
    background-color: #e0e0e0;
    border: 1px solid #ccc;
    max-width: 200px;
  }
  
  .click-log {
    margin-top: 1rem;
    padding: 1rem;
    background-color: #f9f9f9;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
  }
  
  input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  button {
    padding: 0.5rem 1rem;
    background-color: var(--accent-color, #3498db);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
```
