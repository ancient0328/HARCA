# SvelteKit 2 Client-Side Features: SessionStorage

**Document Number**: GUIDE-011F-B  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [SessionStorage in SvelteKit](#sessionstorage-in-sveltekit)
2. [Basic Usage](#basic-usage)
3. [Comparing SessionStorage and LocalStorage](#comparing-sessionstorage-and-localstorage)
4. [HugMeDo-Specific Implementations](#hugmedo-specific-implementations)

## SessionStorage in SvelteKit

SessionStorage provides a way to store key-value pairs in a web browser for the duration of a page session. Data stored in sessionStorage is cleared when the page session ends — that is, when the tab or browser is closed. This makes it ideal for storing temporary data that should only be available during the current session.

In SvelteKit applications, sessionStorage is only available in the browser environment. Since SvelteKit supports server-side rendering (SSR), you need to ensure that sessionStorage is only accessed in client-side code.

### Browser Environment Check

Always check if the code is running in a browser environment before accessing sessionStorage:

```javascript
import { browser } from '$app/environment';

if (browser) {
  // Safe to use sessionStorage here
  sessionStorage.setItem('key', 'value');
}
```

## Basic Usage

### Reading and Writing Data

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  
  let formData = $state({
    name: '',
    email: '',
    message: ''
  });
  
  let formStep = $state(1);
  let formSaved = $state(false);
  
  // Load data from sessionStorage on component mount
  onMount(() => {
    if (browser) {
      const savedFormData = sessionStorage.getItem('contact_form');
      if (savedFormData) {
        try {
          formData = JSON.parse(savedFormData);
          formSaved = true;
        } catch (error) {
          console.error('Failed to parse form data from sessionStorage:', error);
        }
      }
      
      const savedStep = sessionStorage.getItem('contact_form_step');
      if (savedStep) {
        formStep = parseInt(savedStep, 10) || 1;
      }
    }
  });
  
  // Save form data to sessionStorage when it changes
  $effect(() => {
    if (browser) {
      sessionStorage.setItem('contact_form', JSON.stringify(formData));
      sessionStorage.setItem('contact_form_step', formStep.toString());
      
      // Set formSaved to true when data is saved
      formSaved = true;
      
      // Reset formSaved after 2 seconds
      const timer = setTimeout(() => {
        formSaved = false;
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  });
  
  function updateFormField(field, value) {
    formData = { ...formData, [field]: value };
  }
  
  function nextStep() {
    if (formStep < 3) {
      formStep++;
    }
  }
  
  function prevStep() {
    if (formStep > 1) {
      formStep--;
    }
  }
  
  function submitForm() {
    alert(`Form submitted with: ${JSON.stringify(formData, null, 2)}`);
    
    // Clear form data from sessionStorage after submission
    if (browser) {
      sessionStorage.removeItem('contact_form');
      sessionStorage.removeItem('contact_form_step');
    }
    
    // Reset form
    formData = {
      name: '',
      email: '',
      message: ''
    };
    formStep = 1;
  }
  
  function clearForm() {
    if (confirm('Are you sure you want to clear the form?')) {
      // Clear form data from sessionStorage
      if (browser) {
        sessionStorage.removeItem('contact_form');
        sessionStorage.removeItem('contact_form_step');
      }
      
      // Reset form
      formData = {
        name: '',
        email: '',
        message: ''
      };
      formStep = 1;
    }
  }
</script>

<div class="form-container">
  <h2>Multi-Step Contact Form</h2>
  
  {#if formSaved}
    <div class="save-indicator">
      Form progress saved
    </div>
  {/if}
  
  <div class="step-indicator">
    <div class="step" class:active={formStep === 1}>1</div>
    <div class="step-line"></div>
    <div class="step" class:active={formStep === 2}>2</div>
    <div class="step-line"></div>
    <div class="step" class:active={formStep === 3}>3</div>
  </div>
  
  <form on:submit|preventDefault={formStep === 3 ? submitForm : nextStep}>
    {#if formStep === 1}
      <div class="form-step">
        <h3>Personal Information</h3>
        
        <div class="form-field">
          <label for="name">Name</label>
          <input 
            id="name"
            type="text" 
            value={formData.name}
            on:input={(e) => updateFormField('name', e.target.value)}
            required
          />
        </div>
        
        <div class="form-field">
          <label for="email">Email</label>
          <input 
            id="email"
            type="email" 
            value={formData.email}
            on:input={(e) => updateFormField('email', e.target.value)}
            required
          />
        </div>
        
        <div class="form-actions">
          <button type="button" on:click={clearForm}>Clear</button>
          <button type="submit">Next</button>
        </div>
      </div>
    {:else if formStep === 2}
      <div class="form-step">
        <h3>Your Message</h3>
        
        <div class="form-field">
          <label for="message">Message</label>
          <textarea 
            id="message"
            value={formData.message}
            on:input={(e) => updateFormField('message', e.target.value)}
            rows="5"
            required
          ></textarea>
        </div>
        
        <div class="form-actions">
          <button type="button" on:click={prevStep}>Back</button>
          <button type="submit">Next</button>
        </div>
      </div>
    {:else if formStep === 3}
      <div class="form-step">
        <h3>Review and Submit</h3>
        
        <div class="review-data">
          <div class="review-item">
            <strong>Name:</strong> {formData.name}
          </div>
          <div class="review-item">
            <strong>Email:</strong> {formData.email}
          </div>
          <div class="review-item">
            <strong>Message:</strong>
            <p>{formData.message}</p>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" on:click={prevStep}>Back</button>
          <button type="submit">Submit</button>
        </div>
      </div>
    {/if}
  </form>
  
  <p class="help-text">
    Your form progress is automatically saved in this browser tab.
    If you accidentally close this tab and return, your data will be lost.
  </p>
</div>

<style>
  .form-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 1rem;
  }
  
  .save-indicator {
    background-color: #28a745;
    color: white;
    padding: 0.5rem;
    border-radius: 4px;
    text-align: center;
    margin-bottom: 1rem;
    animation: fadeOut 2s forwards;
  }
  
  @keyframes fadeOut {
    0% { opacity: 1; }
    70% { opacity: 1; }
    100% { opacity: 0; }
  }
  
  .step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2rem;
  }
  
  .step {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }
  
  .step.active {
    background-color: #007bff;
    color: white;
  }
  
  .step-line {
    flex: 1;
    height: 2px;
    background-color: #ddd;
    margin: 0 10px;
  }
  
  .form-step {
    margin-bottom: 1rem;
  }
  
  .form-field {
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
  
  .form-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 1rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button[type="submit"] {
    background-color: #007bff;
    color: white;
    border: none;
  }
  
  .review-data {
    background-color: #f9f9f9;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }
  
  .review-item {
    margin-bottom: 0.5rem;
  }
  
  .help-text {
    font-size: 0.8rem;
    color: #666;
    margin-top: 2rem;
  }
</style>
```

### Storing Complex Data

Like localStorage, sessionStorage only supports string values. To store objects or arrays, you need to serialize them to JSON:

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  
  let searchHistory = $state([]);
  let searchTerm = $state('');
  let searchResults = $state([]);
  
  // Load search history from sessionStorage on mount
  onMount(() => {
    if (browser) {
      const savedHistory = sessionStorage.getItem('search_history');
      if (savedHistory) {
        try {
          searchHistory = JSON.parse(savedHistory);
        } catch (error) {
          console.error('Failed to parse search history:', error);
          searchHistory = [];
        }
      }
    }
  });
  
  // Save search history to sessionStorage when it changes
  $effect(() => {
    if (browser && searchHistory.length > 0) {
      sessionStorage.setItem('search_history', JSON.stringify(searchHistory));
    }
  });
  
  async function performSearch() {
    if (!searchTerm.trim()) return;
    
    // Simulate API call
    const results = await fetchSearchResults(searchTerm);
    searchResults = results;
    
    // Add to search history if not already present
    if (!searchHistory.includes(searchTerm)) {
      // Keep only the last 10 searches
      searchHistory = [searchTerm, ...searchHistory].slice(0, 10);
    }
  }
  
  function useHistoryItem(term) {
    searchTerm = term;
    performSearch();
  }
  
  function clearHistory() {
    searchHistory = [];
    
    if (browser) {
      sessionStorage.removeItem('search_history');
    }
  }
  
  // Mock function to simulate API call
  async function fetchSearchResults(term) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock results
    return [
      { id: 1, title: `Result 1 for "${term}"` },
      { id: 2, title: `Result 2 for "${term}"` },
      { id: 3, title: `Result 3 for "${term}"` }
    ];
  }
</script>

<div class="search-container">
  <h2>Search</h2>
  
  <form on:submit|preventDefault={performSearch}>
    <div class="search-input">
      <input 
        type="text" 
        bind:value={searchTerm} 
        placeholder="Search..."
      />
      <button type="submit">Search</button>
    </div>
  </form>
  
  {#if searchHistory.length > 0}
    <div class="search-history">
      <h3>Recent Searches</h3>
      <ul>
        {#each searchHistory as term}
          <li>
            <button on:click={() => useHistoryItem(term)}>
              {term}
            </button>
          </li>
        {/each}
      </ul>
      <button class="clear-button" on:click={clearHistory}>
        Clear History
      </button>
    </div>
  {/if}
  
  {#if searchResults.length > 0}
    <div class="search-results">
      <h3>Results</h3>
      <ul>
        {#each searchResults as result}
          <li>{result.title}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .search-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 1rem;
  }
  
  .search-input {
    display: flex;
    margin-bottom: 1rem;
  }
  
  input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px 0 0 4px;
  }
  
  button {
    padding: 0.5rem 1rem;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 0 4px 4px 0;
    cursor: pointer;
  }
  
  .search-history, .search-results {
    margin-top: 1rem;
    padding: 1rem;
    background-color: #f9f9f9;
    border-radius: 4px;
  }
  
  ul {
    list-style: none;
    padding: 0;
  }
  
  li {
    margin-bottom: 0.5rem;
  }
  
  .search-history button {
    background: none;
    border: none;
    color: #007bff;
    padding: 0;
    text-align: left;
    cursor: pointer;
  }
  
  .clear-button {
    background-color: #dc3545;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }
</style>
```

## Comparing SessionStorage and LocalStorage

Both sessionStorage and localStorage are part of the Web Storage API and share the same methods and properties. However, they differ in several important ways:

| Feature | sessionStorage | localStorage |
|---------|----------------|--------------|
| **Lifetime** | Data is cleared when the page session ends (tab/browser closed) | Data persists even after the browser is closed and reopened |
| **Scope** | Limited to the tab/window where it was created | Shared across all tabs/windows from the same origin |
| **Storage Limit** | Usually around 5-10MB (varies by browser) | Usually around 5-10MB (varies by browser) |
| **Use Cases** | Form data, wizard steps, temporary user preferences | User settings, authentication tokens, persistent app state |

### When to Use SessionStorage

Use sessionStorage when:

1. **The data should not persist** beyond the current browser session
2. **Privacy is a concern** and you don't want data to be accessible after the browser is closed
3. **You need tab-specific storage** that doesn't affect other tabs
4. **You're storing sensitive information** that should be cleared when the user closes the browser

### When to Use LocalStorage

Use localStorage when:

1. **Data needs to persist** across browser sessions
2. **You want to synchronize data** across multiple tabs/windows
3. **User preferences** need to be remembered for future visits
4. **You're implementing offline functionality** that requires persistent data

## HugMeDo-Specific Implementations

In HugMeDo applications, we use sessionStorage for several purposes:

1. **Form Progress**: Saving multi-step form progress to prevent data loss if the user accidentally refreshes the page
2. **Wizard States**: Storing the current state of setup wizards and onboarding flows
3. **Session-Specific Settings**: Storing temporary UI settings that should not persist across sessions
4. **Navigation History**: Keeping track of the user's navigation path within the current session

### Example: Form Progress Manager

```javascript
// src/lib/utils/formProgressManager.js
import { browser } from '$app/environment';

/**
 * Utility for managing form progress in sessionStorage
 * @param {string} formId - Unique identifier for the form
 * @returns {Object} - Form progress manager methods
 */
export function createFormProgressManager(formId) {
  const storageKey = `hugmedo_form_${formId}`;
  
  /**
   * Save form data to sessionStorage
   * @param {Object} data - Form data to save
   */
  function saveProgress(data) {
    if (!browser) return;
    
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        data,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error(`Failed to save form progress for ${formId}:`, error);
    }
  }
  
  /**
   * Load form data from sessionStorage
   * @returns {Object|null} - Saved form data or null if not found
   */
  function loadProgress() {
    if (!browser) return null;
    
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (!saved) return null;
      
      const { data, timestamp } = JSON.parse(saved);
      
      // Check if data is older than 24 hours (for extra safety)
      const savedTime = new Date(timestamp).getTime();
      const now = new Date().getTime();
      const hoursDiff = (now - savedTime) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        clearProgress();
        return null;
      }
      
      return data;
    } catch (error) {
      console.error(`Failed to load form progress for ${formId}:`, error);
      return null;
    }
  }
  
  /**
   * Clear form data from sessionStorage
   */
  function clearProgress() {
    if (browser) {
      sessionStorage.removeItem(storageKey);
    }
  }
  
  /**
   * Check if form has saved progress
   * @returns {boolean} - Whether form has saved progress
   */
  function hasProgress() {
    if (!browser) return false;
    return !!sessionStorage.getItem(storageKey);
  }
  
  return {
    saveProgress,
    loadProgress,
    clearProgress,
    hasProgress
  };
}
```

Usage in a component:

```svelte
<script>
  import { onMount } from 'svelte';
  import { createFormProgressManager } from '$lib/utils/formProgressManager';
  
  // Create form progress manager for patient registration
  const formManager = createFormProgressManager('patient_registration');
  
  // Form data
  let formData = $state({
    personalInfo: {
      name: '',
      birthdate: '',
      gender: ''
    },
    contactInfo: {
      email: '',
      phone: '',
      address: ''
    },
    medicalInfo: {
      conditions: [],
      medications: [],
      allergies: []
    }
  });
  
  let currentStep = $state(1);
  let hasSavedProgress = $state(false);
  
  // Check for saved progress on mount
  onMount(() => {
    const savedData = formManager.loadProgress();
    if (savedData) {
      hasSavedProgress = true;
      
      // Don't automatically load the data, ask the user first
    }
  });
  
  // Save progress when form data or step changes
  $effect(() => {
    formManager.saveProgress({
      formData,
      currentStep
    });
  });
  
  function loadSavedProgress() {
    const savedData = formManager.loadProgress();
    if (savedData) {
      formData = savedData.formData;
      currentStep = savedData.currentStep;
      hasSavedProgress = false;
    }
  }
  
  function discardSavedProgress() {
    formManager.clearProgress();
    hasSavedProgress = false;
  }
  
  function submitForm() {
    // Process form submission
    alert('Form submitted successfully!');
    
    // Clear saved progress
    formManager.clearProgress();
  }
</script>

<div class="registration-form">
  <h2>患者登録フォーム</h2>
  
  {#if hasSavedProgress}
    <div class="saved-progress-alert">
      <p>前回入力した内容が保存されています。復元しますか？</p>
      <div class="alert-actions">
        <button on:click={loadSavedProgress}>
          はい、復元する
        </button>
        <button on:click={discardSavedProgress}>
          いいえ、新しく始める
        </button>
      </div>
    </div>
  {/if}
  
  <!-- Form steps would go here -->
  
  <div class="form-actions">
    {#if currentStep > 1}
      <button on:click={() => currentStep--}>
        戻る
      </button>
    {/if}
    
    {#if currentStep < 3}
      <button on:click={() => currentStep++}>
        次へ
      </button>
    {:else}
      <button on:click={submitForm}>
        送信
      </button>
    {/if}
  </div>
</div>

<style>
  .registration-form {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .saved-progress-alert {
    background-color: #fff3cd;
    border: 1px solid #ffeeba;
    color: #856404;
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: 4px;
  }
  
  .alert-actions {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
  }
  
  .form-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 2rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
```
