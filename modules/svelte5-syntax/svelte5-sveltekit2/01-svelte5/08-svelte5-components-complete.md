# Svelte 5 Components Complete Reference

**Document Number**: GUIDE-008  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Component Basics](#component-basics)
2. [Component Types](#component-types)
   - [Class Components](#class-components)
   - [Function Components](#function-components)
3. [Props](#props)
   - [Declaring Props](#declaring-props)
   - [Default Values](#default-values)
   - [Prop Validation](#prop-validation)
   - [Spread Props](#spread-props)
4. [Slots](#slots)
   - [Default Slots](#default-slots)
   - [Named Slots](#named-slots)
   - [Slot Props](#slot-props)
   - [Conditional Slots](#conditional-slots)
5. [Events](#events)
   - [DOM Events](#dom-events)
   - [Component Events](#component-events)
   - [Event Modifiers](#event-modifiers)
   - [Event Forwarding](#event-forwarding)
6. [Bindings](#bindings)
   - [Element Bindings](#element-bindings)
   - [Component Bindings](#component-bindings)
   - [Group Bindings](#group-bindings)
   - [Media Element Bindings](#media-element-bindings)
7. [Lifecycle](#lifecycle)
8. [Transitions and Animations](#transitions-and-animations)
9. [Actions](#actions)
10. [Component Composition Patterns](#component-composition-patterns)

## Component Basics

In Svelte 5, a component is a reusable piece of UI. Components are defined in `.svelte` files, which contain HTML, CSS, and JavaScript.

**Basic Component Structure:**

```svelte
<script>
  // JavaScript goes here
  let count = $state(0);
  
  function increment() {
    count += 1;
  }
</script>

<!-- HTML goes here -->
<button on:click={increment}>
  Count: {count}
</button>

<style>
  /* CSS goes here */
  button {
    background-color: #ff3e00;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
  }
</style>
```

**Importing and Using Components:**

```svelte
<script>
  import Counter from './Counter.svelte';
  import { Button } from '$lib/components';
</script>

<h1>My App</h1>
<Counter />
<Button label="Click me" />
```

## Component Types

Svelte 5 introduces a new way to define components using functions, alongside the traditional class-based components.

### Class Components

Class components are the traditional way to define components in Svelte. They are defined implicitly by the structure of the `.svelte` file.

```svelte
<script>
  let count = $state(0);
  
  function increment() {
    count += 1;
  }
  
  $effect(() => {
    console.log(`Count changed to ${count}`);
  });
</script>

<button on:click={increment}>
  Count: {count}
</button>
```

### Function Components

Function components are a new feature in Svelte 5. They allow you to define components as functions that return an object with methods and properties.

```svelte
<script>
  function Counter(props) {
    let count = $state(0);
    
    function increment() {
      count += 1;
    }
    
    $effect(() => {
      console.log(`Count changed to ${count}`);
    });
    
    return {
      increment
    };
  }
</script>

<button on:click={Counter.increment}>
  Count: {Counter.count}
</button>
```

**Multiple Components in One File:**

```svelte
<script>
  function Counter() {
    let count = $state(0);
    
    return {
      count,
      increment: () => count += 1
    };
  }
  
  function Timer() {
    let seconds = $state(0);
    
    $effect(() => {
      const interval = setInterval(() => {
        seconds += 1;
      }, 1000);
      
      return () => clearInterval(interval);
    });
    
    return {
      seconds,
      reset: () => seconds = 0
    };
  }
</script>

<div>
  <h2>Counter</h2>
  <button on:click={Counter.increment}>
    Count: {Counter.count}
  </button>
</div>

<div>
  <h2>Timer</h2>
  <p>Seconds: {Timer.seconds}</p>
  <button on:click={Timer.reset}>Reset</button>
</div>
```

## Props

Props allow you to pass data from a parent component to a child component.

### Declaring Props

**Using export (Class Components):**

```svelte
<script>
  export let name = 'World';
  export let greeting = 'Hello';
</script>

<p>{greeting}, {name}!</p>
```

**Using $props (Function Components):**

```svelte
<script>
  let props = $props({
    name: 'World',
    greeting: 'Hello'
  });
</script>

<p>{props.greeting}, {props.name}!</p>
```

**Using $props with TypeScript:**

```svelte
<script lang="ts">
  interface ButtonProps {
    label: string;
    primary?: boolean;
    disabled?: boolean;
    onClick?: () => void;
  }
  
  let props = $props<ButtonProps>({
    label: 'Click me',
    primary: false,
    disabled: false
  });
</script>

<button 
  class:primary={props.primary}
  disabled={props.disabled}
  on:click={props.onClick}
>
  {props.label}
</button>
```

### Default Values

**Class Components:**

```svelte
<script>
  export let name = 'World';
  export let count = 0;
  export let items = [];
  export let user = { name: 'Anonymous' };
</script>
```

**Function Components:**

```svelte
<script>
  let props = $props({
    name: 'World',
    count: 0,
    items: [],
    user: { name: 'Anonymous' }
  });
</script>
```

### Prop Validation

**Using TypeScript:**

```svelte
<script lang="ts">
  export let name: string;
  export let count: number;
  export let active: boolean;
  export let items: string[];
  export let user: { id: number; name: string };
  export let callback: (value: string) => void;
</script>
```

**Runtime Validation:**

```svelte
<script>
  export let name = 'World';
  export let count = 0;
  
  $effect(() => {
    if (typeof name !== 'string') {
      throw new Error('name must be a string');
    }
    
    if (typeof count !== 'number') {
      throw new Error('count must be a number');
    }
  });
</script>
```

### Spread Props

**Passing Props:**

```svelte
<script>
  import UserProfile from './UserProfile.svelte';
  
  let userProps = {
    name: 'John Doe',
    email: 'john@example.com',
    role: 'Admin'
  };
</script>

<UserProfile {...userProps} />
```

**Receiving Props:**

```svelte
<script>
  export let name;
  export let email;
  export let role;
  // Or with $props
  let props = $props({
    name: '',
    email: '',
    role: ''
  });
</script>
```

## Slots

Slots allow you to pass content from a parent component to a child component.

### Default Slots

**Defining a Slot:**

```svelte
<!-- Card.svelte -->
<div class="card">
  <slot>
    <!-- Default content if no content is provided -->
    <p>No content provided</p>
  </slot>
</div>

<style>
  .card {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 16px;
  }
</style>
```

**Using a Slot:**

```svelte
<script>
  import Card from './Card.svelte';
</script>

<Card>
  <h2>Card Title</h2>
  <p>This content will be inserted into the slot.</p>
</Card>

<!-- Uses default content -->
<Card />
```

### Named Slots

**Defining Named Slots:**

```svelte
<!-- Layout.svelte -->
<div class="layout">
  <header>
    <slot name="header">
      <h1>Default Header</h1>
    </slot>
  </header>
  
  <main>
    <slot>
      <p>Default main content</p>
    </slot>
  </main>
  
  <footer>
    <slot name="footer">
      <p>Default Footer</p>
    </slot>
  </footer>
</div>
```

**Using Named Slots:**

```svelte
<script>
  import Layout from './Layout.svelte';
</script>

<Layout>
  <h1 slot="header">My App</h1>
  
  <p>This goes in the default slot.</p>
  
  <p slot="footer">© 2025 My Company</p>
</Layout>
```

### Slot Props

Slot props allow you to pass data from a child component back to the parent.

**Defining Slot Props:**

```svelte
<!-- DataTable.svelte -->
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each items as item}
      <tr>
        <td>{item.name}</td>
        <td>{item.email}</td>
        <td>
          <slot name="actions" {item}>
            <button>View</button>
          </slot>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<script>
  export let items = [];
</script>
```

**Using Slot Props:**

```svelte
<script>
  import DataTable from './DataTable.svelte';
  
  let users = [
    { id: 1, name: 'John', email: 'john@example.com' },
    { id: 2, name: 'Jane', email: 'jane@example.com' }
  ];
  
  function deleteUser(id) {
    users = users.filter(user => user.id !== id);
  }
</script>

<DataTable items={users}>
  <div slot="actions" let:item>
    <button on:click={() => deleteUser(item.id)}>Delete</button>
    <button on:click={() => editUser(item)}>Edit</button>
  </div>
</DataTable>
```

### Conditional Slots

You can check if a slot has content using the `$$slots` object.

```svelte
<script>
  // $$slots is automatically available
</script>

<div class="card">
  {#if $$slots.header}
    <div class="card-header">
      <slot name="header"></slot>
    </div>
  {/if}
  
  <div class="card-body">
    <slot></slot>
  </div>
  
  {#if $$slots.footer}
    <div class="card-footer">
      <slot name="footer"></slot>
    </div>
  {/if}
</div>
```

## Events

### DOM Events

**Handling DOM Events:**

```svelte
<script>
  let count = $state(0);
  
  function handleClick() {
    count += 1;
  }
  
  function handleInput(event) {
    console.log('Input value:', event.target.value);
  }
</script>

<button on:click={handleClick}>
  Count: {count}
</button>

<input on:input={handleInput} />
```

**Inline Event Handlers:**

```svelte
<button on:click={() => count += 1}>
  Count: {count}
</button>

<input on:input={(e) => console.log(e.target.value)} />
```

### Component Events

**Dispatching Events:**

```svelte
<!-- Button.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let label = 'Click me';
  
  function handleClick() {
    dispatch('click', {
      time: new Date()
    });
  }
</script>

<button on:click={handleClick}>
  {label}
</button>
```

**Listening to Component Events:**

```svelte
<script>
  import Button from './Button.svelte';
  
  function handleButtonClick(event) {
    console.log('Button clicked at', event.detail.time);
  }
</script>

<Button on:click={handleButtonClick} label="Custom Button" />
```

### Event Modifiers

Svelte provides several event modifiers to control event behavior.

```svelte
<!-- Prevent default behavior -->
<form on:submit|preventDefault={handleSubmit}>
  <!-- ... -->
</form>

<!-- Stop propagation -->
<button on:click|stopPropagation={handleClick}>
  Click me
</button>

<!-- Only trigger once -->
<button on:click|once={handleClick}>
  Click me
</button>

<!-- Capture phase -->
<div on:click|capture={handleClick}>
  <!-- ... -->
</div>

<!-- Passive event listener -->
<div on:scroll|passive={handleScroll}>
  <!-- ... -->
</div>

<!-- Combining modifiers -->
<form on:submit|preventDefault|stopPropagation={handleSubmit}>
  <!-- ... -->
</form>
```

### Event Forwarding

Event forwarding allows you to pass events from a child component to a parent component.

```svelte
<!-- Button.svelte -->
<button on:click>
  <slot></slot>
</button>
```

```svelte
<script>
  import Button from './Button.svelte';
  
  function handleClick() {
    console.log('Button clicked');
  }
</script>

<Button on:click={handleClick}>
  Click me
</Button>
```

## Bindings

### Element Bindings

**Text Inputs:**

```svelte
<script>
  let name = $state('');
</script>

<input bind:value={name} />
<p>Hello, {name}!</p>
```

**Checkboxes:**

```svelte
<script>
  let checked = $state(false);
</script>

<input type="checkbox" bind:checked={checked} />
<p>Checked: {checked}</p>
```

**Radio Buttons:**

```svelte
<script>
  let color = $state('red');
</script>

<input type="radio" bind:group={color} value="red" /> Red
<input type="radio" bind:group={color} value="green" /> Green
<input type="radio" bind:group={color} value="blue" /> Blue

<p>Selected color: {color}</p>
```

**Select Elements:**

```svelte
<script>
  let selected = $state('');
  let options = ['Option 1', 'Option 2', 'Option 3'];
</script>

<select bind:value={selected}>
  {#each options as option}
    <option value={option}>{option}</option>
  {/each}
</select>

<p>Selected: {selected}</p>
```

**Multiple Select:**

```svelte
<script>
  let selected = $state([]);
  let options = ['Option 1', 'Option 2', 'Option 3'];
</script>

<select multiple bind:value={selected}>
  {#each options as option}
    <option value={option}>{option}</option>
  {/each}
</select>

<p>Selected: {selected.join(', ')}</p>
```

**Contenteditable:**

```svelte
<script>
  let html = $state('<p>Edit this content</p>');
</script>

<div contenteditable="true" bind:innerHTML={html}></div>

<pre>{html}</pre>
```

### Component Bindings

**Binding to Component Props:**

```svelte
<!-- Counter.svelte -->
<script>
  export let count = 0;
</script>

<button on:click={() => count += 1}>
  Count: {count}
</button>
```

```svelte
<script>
  import Counter from './Counter.svelte';
  
  let currentCount = $state(0);
</script>

<Counter bind:count={currentCount} />

<p>Current count: {currentCount}</p>
```

### Group Bindings

**Checkbox Groups:**

```svelte
<script>
  let selected = $state([]);
  let options = ['Apple', 'Banana', 'Orange'];
</script>

{#each options as option}
  <label>
    <input type="checkbox" bind:group={selected} value={option} />
    {option}
  </label>
{/each}

<p>Selected: {selected.join(', ')}</p>
```

### Media Element Bindings

**Video Element:**

```svelte
<script>
  let video;
  let time = $state(0);
  let duration = $state(0);
  let paused = $state(true);
</script>

<video
  bind:this={video}
  bind:currentTime={time}
  bind:duration={duration}
  bind:paused={paused}
  src="video.mp4"
></video>

<div>
  <button on:click={() => paused = !paused}>
    {paused ? 'Play' : 'Pause'}
  </button>
  
  <input type="range" min="0" max={duration} bind:value={time} />
  
  <p>
    {Math.floor(time / 60)}:{Math.floor(time % 60).toString().padStart(2, '0')} /
    {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
  </p>
</div>
```

## Lifecycle

In Svelte 5, lifecycle management is primarily handled through the `$effect` Rune.

**Component Initialization:**

```svelte
<script>
  $effect.once(() => {
    console.log('Component initialized');
    
    return () => {
      console.log('Component destroyed');
    };
  });
</script>
```

**Responding to Prop Changes:**

```svelte
<script>
  export let data;
  
  $effect(() => {
    console.log('Data changed:', data);
    // Process data
  });
</script>
```

**DOM Updates:**

```svelte
<script>
  let count = $state(0);
  
  $effect.pre(() => {
    console.log('About to update DOM with count:', count);
  });
  
  $effect.post(() => {
    console.log('DOM updated with count:', count);
  });
</script>

<button on:click={() => count += 1}>
  Count: {count}
</button>
```

**Client-Side Only Code:**

```svelte
<script>
  let windowWidth = $state(0);
  
  $effect.client(() => {
    windowWidth = window.innerWidth;
    
    const handleResize = () => {
      windowWidth = window.innerWidth;
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

<p>Window width: {windowWidth}px</p>
```

## Transitions and Animations

Svelte provides built-in transition and animation directives.

**Basic Transitions:**

```svelte
<script>
  import { fade, fly, slide, scale } from 'svelte/transition';
  
  let visible = $state(true);
</script>

<button on:click={() => visible = !visible}>
  Toggle
</button>

{#if visible}
  <div transition:fade>Fade in and out</div>
{/if}

{#if visible}
  <div transition:fly={{ y: 200, duration: 1000 }}>Fly in and out</div>
{/if}

{#if visible}
  <div transition:slide>Slide in and out</div>
{/if}

{#if visible}
  <div transition:scale>Scale in and out</div>
{/if}
```

**In and Out Transitions:**

```svelte
<script>
  import { fade, fly } from 'svelte/transition';
  
  let visible = $state(true);
</script>

<button on:click={() => visible = !visible}>
  Toggle
</button>

{#if visible}
  <div in:fly={{ y: 200 }} out:fade>
    Fly in, fade out
  </div>
{/if}
```

**Transition Events:**

```svelte
<script>
  import { fade } from 'svelte/transition';
  
  let visible = $state(true);
  
  function handleIntro(event) {
    console.log('Intro started');
  }
  
  function handleOutro(event) {
    console.log('Outro started');
  }
</script>

{#if visible}
  <div
    transition:fade
    on:introstart={handleIntro}
    on:outrostart={handleOutro}
  >
    Fade in and out
  </div>
{/if}
```

**Custom Transitions:**

```svelte
<script>
  function typewriter(node, { speed = 1 }) {
    const text = node.textContent;
    const duration = text.length / (speed * 0.01);
    
    return {
      duration,
      tick: t => {
        const i = Math.trunc(text.length * t);
        node.textContent = text.slice(0, i);
      }
    };
  }
  
  let visible = $state(true);
</script>

<button on:click={() => visible = !visible}>
  Toggle
</button>

{#if visible}
  <p transition:typewriter={{ speed: 1 }}>
    This text will be typed out character by character.
  </p>
{/if}
```

**Animations:**

```svelte
<script>
  import { flip } from 'svelte/animate';
  import { quintOut } from 'svelte/easing';
  
  let items = $state([1, 2, 3, 4, 5]);
  
  function shuffle() {
    items = items.sort(() => Math.random() - 0.5);
  }
</script>

<button on:click={shuffle}>
  Shuffle
</button>

<div>
  {#each items as item (item)}
    <div animate:flip={{ duration: 500, easing: quintOut }}>
      {item}
    </div>
  {/each}
</div>
```

## Actions

Actions are functions that are called when an element is created, allowing you to run JavaScript code directly on DOM elements.

**Basic Action:**

```svelte
<script>
  function tooltip(node, text) {
    const tooltip = document.createElement('div');
    tooltip.textContent = text;
    tooltip.className = 'tooltip';
    
    function position() {
      const { top, right, bottom } = node.getBoundingClientRect();
      tooltip.style.top = `${bottom + 5}px`;
      tooltip.style.left = `${right / 2}px`;
    }
    
    function show() {
      document.body.appendChild(tooltip);
      position();
    }
    
    function hide() {
      tooltip.remove();
    }
    
    node.addEventListener('mouseenter', show);
    node.addEventListener('mouseleave', hide);
    
    return {
      update(newText) {
        tooltip.textContent = newText;
      },
      destroy() {
        tooltip.remove();
        node.removeEventListener('mouseenter', show);
        node.removeEventListener('mouseleave', hide);
      }
    };
  }
</script>

<button use:tooltip={'Click me!'}>
  Hover me
</button>

<style>
  .tooltip {
    position: absolute;
    background: black;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    pointer-events: none;
  }
</style>
```

**Action with Parameters:**

```svelte
<script>
  function clickOutside(node, callback) {
    function handleClick(event) {
      if (!node.contains(event.target)) {
        callback();
      }
    }
    
    document.addEventListener('click', handleClick, true);
    
    return {
      destroy() {
        document.removeEventListener('click', handleClick, true);
      }
    };
  }
  
  let showModal = $state(false);
  
  function closeModal() {
    showModal = false;
  }
</script>

<button on:click={() => showModal = true}>
  Open Modal
</button>

{#if showModal}
  <div class="modal" use:clickOutside={closeModal}>
    <h2>Modal Content</h2>
    <p>Click outside to close</p>
  </div>
{/if}

<style>
  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
</style>
```

## Component Composition Patterns

### Higher-Order Components

```svelte
<!-- withAuth.svelte -->
<script>
  import { navigate } from '$app/navigation';
  
  export let component;
  export let props = {};
  
  let isAuthenticated = $state(false);
  
  $effect.once(() => {
    // Check if user is authenticated
    isAuthenticated = localStorage.getItem('token') !== null;
    
    if (!isAuthenticated) {
      navigate('/login');
    }
  });
</script>

{#if isAuthenticated}
  <svelte:component this={component} {...props} />
{:else}
  <p>Loading...</p>
{/if}
```

```svelte
<script>
  import withAuth from './withAuth.svelte';
  import Dashboard from './Dashboard.svelte';
</script>

<withAuth component={Dashboard} props={{ title: 'My Dashboard' }} />
```

### Component Composition

```svelte
<!-- Form.svelte -->
<script>
  export let onSubmit;
</script>

<form on:submit|preventDefault={onSubmit}>
  <slot></slot>
  
  <div class="form-actions">
    <slot name="actions">
      <button type="submit">Submit</button>
    </slot>
  </div>
</form>
```

```svelte
<!-- Input.svelte -->
<script>
  export let label;
  export let type = 'text';
  export let value = '';
  export let required = false;
  export let error = '';
</script>

<div class="form-group">
  <label>
    {label}
    {#if required}
      <span class="required">*</span>
    {/if}
  </label>
  
  <input {type} bind:value {required} />
  
  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>
```

```svelte
<script>
  import Form from './Form.svelte';
  import Input from './Input.svelte';
  
  let formData = $state({
    name: '',
    email: '',
    password: ''
  });
  
  let errors = $state({
    name: '',
    email: '',
    password: ''
  });
  
  function validateForm() {
    let valid = true;
    
    if (!formData.name) {
      errors.name = 'Name is required';
      valid = false;
    } else {
      errors.name = '';
    }
    
    if (!formData.email) {
      errors.email = 'Email is required';
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
      valid = false;
    } else {
      errors.email = '';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
      valid = false;
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
      valid = false;
    } else {
      errors.password = '';
    }
    
    return valid;
  }
  
  function handleSubmit() {
    if (validateForm()) {
      console.log('Form submitted', formData);
    }
  }
</script>

<Form onSubmit={handleSubmit}>
  <Input
    label="Name"
    bind:value={formData.name}
    required
    error={errors.name}
  />
  
  <Input
    label="Email"
    type="email"
    bind:value={formData.email}
    required
    error={errors.email}
  />
  
  <Input
    label="Password"
    type="password"
    bind:value={formData.password}
    required
    error={errors.password}
  />
  
  <div slot="actions">
    <button type="button">Cancel</button>
    <button type="submit">Register</button>
  </div>
</Form>
```
