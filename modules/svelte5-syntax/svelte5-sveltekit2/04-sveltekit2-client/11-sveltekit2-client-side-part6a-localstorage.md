# SvelteKit 2 Client-Side Features: LocalStorage

**Document Number**: GUIDE-011F-A  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [LocalStorage in SvelteKit](#localstorage-in-sveltekit)
2. [Basic Usage](#basic-usage)
3. [Storing Complex Data](#storing-complex-data)
4. [HugMeDo-Specific Implementations](#hugmedo-specific-implementations)

## LocalStorage in SvelteKit

LocalStorage provides a way to store key-value pairs in a web browser with no expiration time. Data stored in localStorage persists even after the browser is closed and reopened. This makes it ideal for storing user preferences, theme settings, and other persistent data that should be available across browser sessions.

In SvelteKit applications, localStorage is only available in the browser environment. Since SvelteKit supports server-side rendering (SSR), you need to ensure that localStorage is only accessed in client-side code.

### Browser Environment Check

Always check if the code is running in a browser environment before accessing localStorage:

```javascript
import { browser } from '$app/environment';

if (browser) {
  // Safe to use localStorage here
  localStorage.setItem('key', 'value');
}
```

## Basic Usage

### Reading and Writing Data

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  
  let theme = $state('light');
  let savedName = $state('');
  
  // Load data from localStorage on component mount
  onMount(() => {
    if (browser) {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        theme = savedTheme;
      }
      
      const name = localStorage.getItem('username');
      if (name) {
        savedName = name;
      }
    }
  });
  
  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    
    if (browser) {
      localStorage.setItem('theme', theme);
    }
  }
  
  function saveName(name) {
    if (browser) {
      localStorage.setItem('username', name);
      savedName = name;
    }
  }
  
  function clearName() {
    if (browser) {
      localStorage.removeItem('username');
      savedName = '';
    }
  }
  
  function clearAll() {
    if (browser) {
      localStorage.clear();
      theme = 'light';
      savedName = '';
    }
  }
</script>

<div class="settings" class:dark={theme === 'dark'}>
  <h2>User Settings</h2>
  
  <div class="setting">
    <label>
      Theme:
      <button on:click={toggleTheme}>
        Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
      </button>
    </label>
  </div>
  
  <div class="setting">
    <label>
      Your Name:
      <input 
        type="text" 
        value={savedName} 
        on:input={(e) => saveName(e.target.value)}
      />
    </label>
    {#if savedName}
      <button on:click={clearName}>Clear Name</button>
    {/if}
  </div>
  
  <button on:click={clearAll}>Reset All Settings</button>
</div>

<style>
  .settings {
    padding: 1rem;
    border-radius: 8px;
    background-color: #f9f9f9;
    color: #333;
  }
  
  .settings.dark {
    background-color: #333;
    color: #f9f9f9;
  }
  
  .setting {
    margin-bottom: 1rem;
  }
  
  button {
    margin-left: 0.5rem;
  }
</style>
```

## Storing Complex Data

LocalStorage only supports string values. To store objects or arrays, you need to serialize them to JSON:

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  
  let todos = $state([]);
  let newTodo = $state('');
  
  onMount(() => {
    if (browser) {
      const savedTodos = localStorage.getItem('todos');
      if (savedTodos) {
        try {
          todos = JSON.parse(savedTodos);
        } catch (error) {
          console.error('Failed to parse todos from localStorage:', error);
          todos = [];
        }
      }
    }
  });
  
  // Save todos to localStorage whenever they change
  $effect(() => {
    if (browser && todos.length > 0) {
      localStorage.setItem('todos', JSON.stringify(todos));
    }
  });
  
  function addTodo() {
    if (newTodo.trim()) {
      todos = [
        ...todos,
        {
          id: Date.now(),
          text: newTodo,
          completed: false
        }
      ];
      newTodo = '';
    }
  }
  
  function toggleTodo(id) {
    todos = todos.map(todo => 
      todo.id === id 
        ? { ...todo, completed: !todo.completed } 
        : todo
    );
  }
  
  function removeTodo(id) {
    todos = todos.filter(todo => todo.id !== id);
    
    // If no todos left, clear from localStorage
    if (todos.length === 0 && browser) {
      localStorage.removeItem('todos');
    }
  }
  
  function clearTodos() {
    todos = [];
    
    if (browser) {
      localStorage.removeItem('todos');
    }
  }
</script>

<div class="todo-app">
  <h2>Todo List</h2>
  
  <form on:submit|preventDefault={addTodo}>
    <input 
      type="text" 
      bind:value={newTodo} 
      placeholder="Add a new todo..."
    />
    <button type="submit">Add</button>
  </form>
  
  {#if todos.length > 0}
    <ul class="todo-list">
      {#each todos as todo (todo.id)}
        <li class:completed={todo.completed}>
          <label>
            <input 
              type="checkbox" 
              checked={todo.completed} 
              on:change={() => toggleTodo(todo.id)}
            />
            <span>{todo.text}</span>
          </label>
          <button on:click={() => removeTodo(todo.id)}>Delete</button>
        </li>
      {/each}
    </ul>
    
    <button on:click={clearTodos}>Clear All</button>
  {:else}
    <p>No todos yet. Add some!</p>
  {/if}
</div>

<style>
  .todo-app {
    max-width: 500px;
    margin: 0 auto;
    padding: 1rem;
  }
  
  form {
    display: flex;
    margin-bottom: 1rem;
  }
  
  input[type="text"] {
    flex: 1;
    padding: 0.5rem;
  }
  
  .todo-list {
    list-style: none;
    padding: 0;
  }
  
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid #eee;
  }
  
  li.completed span {
    text-decoration: line-through;
    color: #999;
  }
</style>
```

## HugMeDo-Specific Implementations

In HugMeDo applications, we use localStorage for several purposes:

1. **User Preferences**: Storing UI preferences such as theme, language, and notification settings
2. **Authentication**: Storing authentication tokens (with proper security considerations)
3. **Form Data Persistence**: Saving form data to prevent data loss if the user accidentally navigates away
4. **Feature Flags**: Storing user-specific feature flags

### Example: User Preferences Store

```javascript
// src/lib/stores/userPreferences.js
import { browser } from '$app/environment';

// Default preferences
const defaultPreferences = {
  theme: 'system',
  language: 'ja',
  notifications: {
    chat: true,
    appointments: true,
    system: true
  },
  accessibility: {
    fontSize: 'medium',
    highContrast: false,
    reduceMotion: false
  }
};

// Create a reactive store for user preferences
export function createUserPreferencesStore() {
  // Load preferences from localStorage or use defaults
  const loadPreferences = () => {
    if (!browser) return defaultPreferences;
    
    try {
      const stored = localStorage.getItem('hugmedo_user_preferences');
      return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences;
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      return defaultPreferences;
    }
  };
  
  // Initialize state
  let preferences = $state(loadPreferences());
  
  // Save preferences to localStorage when they change
  $effect(() => {
    if (browser) {
      localStorage.setItem('hugmedo_user_preferences', JSON.stringify(preferences));
      
      // Apply theme immediately
      applyTheme(preferences.theme);
    }
  });
  
  // Apply theme to document
  function applyTheme(theme) {
    if (!browser) return;
    
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark);
    
    document.documentElement.classList.toggle('dark-theme', isDark);
  }
  
  // Return the store interface
  return {
    get preferences() { return preferences; },
    
    // Update specific preference
    updatePreference(key, value) {
      preferences = { ...preferences, [key]: value };
    },
    
    // Update nested preference
    updateNestedPreference(category, key, value) {
      preferences = {
        ...preferences,
        [category]: {
          ...preferences[category],
          [key]: value
        }
      };
    },
    
    // Reset all preferences
    resetPreferences() {
      preferences = defaultPreferences;
    }
  };
}

// Create and export a singleton instance
export const userPreferencesStore = createUserPreferencesStore();
```

Usage in a component:

```svelte
<script>
  import { userPreferencesStore } from '$lib/stores/userPreferences';
  
  // Get reactive references to preferences
  let preferences = $derived(userPreferencesStore.preferences);
  let theme = $derived(preferences.theme);
  let language = $derived(preferences.language);
  let notificationSettings = $derived(preferences.notifications);
  let accessibilitySettings = $derived(preferences.accessibility);
  
  // Update theme
  function setTheme(newTheme) {
    userPreferencesStore.updatePreference('theme', newTheme);
  }
  
  // Toggle notification setting
  function toggleNotification(type) {
    userPreferencesStore.updateNestedPreference(
      'notifications',
      type,
      !notificationSettings[type]
    );
  }
  
  // Reset all preferences
  function resetAllPreferences() {
    if (confirm('全ての設定をデフォルトに戻しますか？')) {
      userPreferencesStore.resetPreferences();
    }
  }
</script>

<div class="preferences-panel">
  <h2>ユーザー設定</h2>
  
  <section>
    <h3>テーマ</h3>
    <div class="theme-selector">
      <button 
        class:active={theme === 'light'}
        on:click={() => setTheme('light')}
      >
        ライト
      </button>
      <button 
        class:active={theme === 'dark'}
        on:click={() => setTheme('dark')}
      >
        ダーク
      </button>
      <button 
        class:active={theme === 'system'}
        on:click={() => setTheme('system')}
      >
        システム設定に合わせる
      </button>
    </div>
  </section>
  
  <section>
    <h3>通知設定</h3>
    <div class="notification-settings">
      <label>
        <input 
          type="checkbox" 
          checked={notificationSettings.chat} 
          on:change={() => toggleNotification('chat')}
        />
        チャットメッセージ
      </label>
      
      <label>
        <input 
          type="checkbox" 
          checked={notificationSettings.appointments} 
          on:change={() => toggleNotification('appointments')}
        />
        予約リマインダー
      </label>
      
      <label>
        <input 
          type="checkbox" 
          checked={notificationSettings.system} 
          on:change={() => toggleNotification('system')}
        />
        システム通知
      </label>
    </div>
  </section>
  
  <button class="reset-button" on:click={resetAllPreferences}>
    すべての設定をリセット
  </button>
</div>

<style>
  .preferences-panel {
    padding: 1rem;
    border-radius: 8px;
    background-color: var(--bg-color, #f9f9f9);
    color: var(--text-color, #333);
  }
  
  section {
    margin-bottom: 1.5rem;
  }
  
  .theme-selector {
    display: flex;
    gap: 0.5rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    background-color: var(--button-bg, #eee);
    border: 1px solid var(--button-border, #ddd);
    cursor: pointer;
  }
  
  button.active {
    background-color: var(--primary-color, #3498db);
    color: white;
  }
  
  .notification-settings {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .reset-button {
    margin-top: 1rem;
    background-color: var(--danger-color, #e74c3c);
    color: white;
  }
</style>
```

### Security Considerations

When using localStorage for sensitive data like authentication tokens:

1. **Never store sensitive information** like passwords or personal data
2. **Set short expiration times** for authentication tokens
3. **Use HTTPS** to prevent man-in-the-middle attacks
4. **Implement proper CSRF protection** on your API endpoints
5. **Clear sensitive data** when the user logs out

```javascript
// src/lib/auth/tokenStorage.js
import { browser } from '$app/environment';

export const tokenStorage = {
  // Store token with expiration
  setToken(token, expiresInMinutes = 60) {
    if (!browser) return;
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
    
    const tokenData = {
      value: token,
      expiresAt: expiresAt.toISOString()
    };
    
    localStorage.setItem('hugmedo_auth_token', JSON.stringify(tokenData));
  },
  
  // Get token if valid
  getToken() {
    if (!browser) return null;
    
    try {
      const tokenData = JSON.parse(localStorage.getItem('hugmedo_auth_token'));
      
      if (!tokenData) return null;
      
      // Check if token has expired
      const now = new Date();
      const expiresAt = new Date(tokenData.expiresAt);
      
      if (now > expiresAt) {
        // Token expired, remove it
        this.clearToken();
        return null;
      }
      
      return tokenData.value;
    } catch (error) {
      console.error('Failed to retrieve auth token:', error);
      return null;
    }
  },
  
  // Check if token exists and is valid
  isAuthenticated() {
    return !!this.getToken();
  },
  
  // Clear token on logout
  clearToken() {
    if (browser) {
      localStorage.removeItem('hugmedo_auth_token');
    }
  }
};
```
