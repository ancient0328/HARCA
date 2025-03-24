# SvelteKit 2 Client-Side Features: WebSockets (Implementation Patterns - Basic)

**Document Number**: GUIDE-011F-C3  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [WebSocket Implementation Patterns](#websocket-implementation-patterns)
2. [Store-Based Pattern](#store-based-pattern)
3. [Context API Pattern](#context-api-pattern)
4. [Lifecycle Management](#lifecycle-management)

## WebSocket Implementation Patterns

When implementing WebSockets in SvelteKit applications, several patterns can be used to manage connections, handle events, and share the WebSocket instance across components. This document covers the basic implementation patterns that we use in HugMeDo.

## Store-Based Pattern

One of the most effective patterns for managing WebSockets in SvelteKit is using Svelte stores. This approach allows you to:

1. Share the WebSocket connection across multiple components
2. Reactively update UI based on connection status
3. Centralize WebSocket event handling

### Basic Store Implementation

```javascript
// src/lib/stores/websocket.js
import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';

// Create stores
export const socket = writable(null);
export const connected = writable(false);
export const connectionError = writable(null);
export const messages = writable([]);

// Derived store for connection status
export const status = derived(
  [connected, connectionError],
  ([$connected, $connectionError]) => {
    if ($connectionError) return 'error';
    return $connected ? 'connected' : 'disconnected';
  }
);

// Initialize WebSocket
export function initWebSocket(url) {
  if (!browser) return;
  
  // Close existing connection if any
  closeWebSocket();
  
  try {
    // Create new WebSocket
    const ws = new WebSocket(url);
    
    // Update socket store
    socket.set(ws);
    
    // Set up event handlers
    ws.onopen = handleOpen;
    ws.onclose = handleClose;
    ws.onerror = handleError;
    ws.onmessage = handleMessage;
    
    return ws;
  } catch (error) {
    connectionError.set(error.message);
    return null;
  }
}

// Close WebSocket connection
export function closeWebSocket() {
  socket.update(ws => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    return null;
  });
}

// Send message through WebSocket
export function sendMessage(data) {
  socket.update(ws => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      ws.send(message);
    }
    return ws;
  });
}

// Event handlers
function handleOpen() {
  connected.set(true);
  connectionError.set(null);
}

function handleClose() {
  connected.set(false);
}

function handleError(error) {
  connectionError.set(error.message || 'WebSocket error occurred');
}

function handleMessage(event) {
  try {
    const data = JSON.parse(event.data);
    messages.update(msgs => [...msgs, data]);
  } catch (error) {
    // If data is not JSON, treat as plain text
    messages.update(msgs => [...msgs, { type: 'text', content: event.data }]);
  }
}
```

### Using the WebSocket Store

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { 
    initWebSocket, 
    closeWebSocket, 
    sendMessage,
    connected,
    status,
    messages
  } from '$lib/stores/websocket';
  
  let inputMessage = $state('');
  
  onMount(() => {
    // Initialize WebSocket connection
    initWebSocket('wss://echo.websocket.org');
    
    // Clean up on component destroy
    return () => {
      closeWebSocket();
    };
  });
  
  function handleSend() {
    if (inputMessage.trim()) {
      sendMessage({
        type: 'chat',
        content: inputMessage,
        timestamp: new Date().toISOString()
      });
      
      inputMessage = '';
    }
  }
</script>

<div class="websocket-demo">
  <div class="status {$status}">
    Connection Status: {$status}
  </div>
  
  <div class="messages">
    {#each $messages as message}
      <div class="message">
        {#if typeof message === 'object'}
          <pre>{JSON.stringify(message, null, 2)}</pre>
        {:else}
          {message}
        {/if}
      </div>
    {/each}
  </div>
  
  <div class="input-area">
    <input 
      type="text" 
      bind:value={inputMessage} 
      placeholder="Type a message..." 
      disabled={!$connected}
      on:keydown={(e) => e.key === 'Enter' && handleSend()}
    />
    <button 
      on:click={handleSend}
      disabled={!$connected}
    >
      Send
    </button>
  </div>
</div>

<style>
  .websocket-demo {
    max-width: 600px;
    margin: 0 auto;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  
  .status {
    padding: 0.5rem;
    margin-bottom: 1rem;
    border-radius: 4px;
    text-align: center;
    font-weight: bold;
  }
  
  .status.connected {
    background-color: #d4edda;
    color: #155724;
  }
  
  .status.disconnected {
    background-color: #f8d7da;
    color: #721c24;
  }
  
  .status.error {
    background-color: #f8d7da;
    color: #721c24;
  }
  
  .messages {
    height: 300px;
    overflow-y: auto;
    padding: 1rem;
    background-color: #f9f9f9;
    margin-bottom: 1rem;
    border-radius: 4px;
  }
  
  .message {
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    background-color: white;
    border-radius: 4px;
    border: 1px solid #eee;
  }
  
  .input-area {
    display: flex;
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
  
  button:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
</style>
```

## Context API Pattern

For more complex applications, you might want to use Svelte's context API to provide WebSocket functionality to a specific part of your component tree. This is useful when you have multiple WebSocket connections for different features.

### Creating a WebSocket Context

```svelte
<!-- src/lib/components/WebSocketProvider.svelte -->
<script>
  import { setContext, onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment';
  
  // Props
  export let url;
  export let autoConnect = true;
  export let reconnect = true;
  export let maxReconnectAttempts = 5;
  export let reconnectInterval = 3000;
  
  // Context key
  const WS_CONTEXT_KEY = Symbol('websocket');
  
  // Stores
  const socket = writable(null);
  const connected = writable(false);
  const error = writable(null);
  const messages = writable([]);
  
  // State
  let ws;
  let reconnectAttempts = 0;
  let reconnectTimer;
  
  // Set up context
  setContext(WS_CONTEXT_KEY, {
    socket,
    connected,
    error,
    messages,
    send: sendMessage,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
    getContext: () => ({ socket, connected, error, messages, send: sendMessage })
  });
  
  onMount(() => {
    if (browser && autoConnect) {
      connectWebSocket();
    }
  });
  
  onDestroy(() => {
    disconnectWebSocket();
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
  });
  
  function connectWebSocket() {
    // Close existing connection if any
    if (ws) {
      ws.close();
    }
    
    try {
      // Create new WebSocket
      ws = new WebSocket(url);
      socket.set(ws);
      
      // Set up event handlers
      ws.onopen = handleOpen;
      ws.onclose = handleClose;
      ws.onerror = handleError;
      ws.onmessage = handleMessage;
    } catch (err) {
      error.set(err.message);
    }
  }
  
  function disconnectWebSocket() {
    if (ws) {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      
      ws = null;
      socket.set(null);
      connected.set(false);
    }
  }
  
  function sendMessage(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      ws.send(message);
      return true;
    }
    return false;
  }
  
  function handleOpen() {
    connected.set(true);
    error.set(null);
    reconnectAttempts = 0;
  }
  
  function handleClose(event) {
    connected.set(false);
    
    // Attempt to reconnect if the connection was not closed cleanly
    // and reconnect option is enabled
    if (reconnect && !event.wasClean) {
      attemptReconnect();
    }
  }
  
  function handleError(event) {
    error.set('WebSocket error occurred');
  }
  
  function handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      messages.update(msgs => [...msgs, data]);
    } catch (err) {
      // If data is not JSON, treat as plain text
      messages.update(msgs => [...msgs, event.data]);
    }
  }
  
  function attemptReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) {
      error.set(`Failed to reconnect after ${maxReconnectAttempts} attempts`);
      return;
    }
    
    reconnectAttempts++;
    
    reconnectTimer = setTimeout(() => {
      connectWebSocket();
    }, reconnectInterval * reconnectAttempts);
  }
</script>

<slot></slot>
```

### Using the WebSocket Context

```svelte
<!-- src/routes/chat/+page.svelte -->
<script>
  import { getContext } from 'svelte';
  import WebSocketProvider from '$lib/components/WebSocketProvider.svelte';
  import ChatInput from '$lib/components/ChatInput.svelte';
  import ChatMessages from '$lib/components/ChatMessages.svelte';
  import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
  
  // Chat room URL
  const chatUrl = 'wss://chat.example.com/ws';
</script>

<WebSocketProvider url={chatUrl} autoConnect={true} reconnect={true}>
  <div class="chat-container">
    <ConnectionStatusFromContext />
    <ChatMessagesFromContext />
    <ChatInputFromContext />
  </div>
</WebSocketProvider>

<!-- Components that use the WebSocket context -->

<script>
  // src/lib/components/ConnectionStatusFromContext.svelte
  import { getContext } from 'svelte';
  
  // Get WebSocket context
  const { connected, error } = getContext(Symbol('websocket')).getContext();
</script>

<div class="connection-status {$connected ? 'connected' : 'disconnected'}">
  {#if $connected}
    Connected to chat server
  {:else if $error}
    Connection error: {$error}
  {:else}
    Disconnected from chat server
  {/if}
</div>

<script>
  // src/lib/components/ChatMessagesFromContext.svelte
  import { getContext } from 'svelte';
  
  // Get WebSocket context
  const { messages } = getContext(Symbol('websocket')).getContext();
</script>

<div class="messages">
  {#each $messages as message}
    <div class="message">
      {#if typeof message === 'object'}
        <div class="message-content">
          <strong>{message.sender || 'Anonymous'}:</strong> {message.content}
        </div>
        <div class="message-time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      {:else}
        <div class="message-content">
          {message}
        </div>
      {/if}
    </div>
  {/each}
</div>

<script>
  // src/lib/components/ChatInputFromContext.svelte
  import { getContext } from 'svelte';
  
  // Get WebSocket context
  const { connected, send } = getContext(Symbol('websocket')).getContext();
  
  let inputMessage = '';
  
  function handleSend() {
    if (inputMessage.trim() && $connected) {
      send({
        content: inputMessage,
        timestamp: new Date().toISOString()
      });
      
      inputMessage = '';
    }
  }
</script>

<div class="input-area">
  <input 
    type="text" 
    bind:value={inputMessage} 
    placeholder="Type a message..." 
    disabled={!$connected}
    on:keydown={(e) => e.key === 'Enter' && handleSend()}
  />
  <button 
    on:click={handleSend}
    disabled={!$connected}
  >
    Send
  </button>
</div>
```

## Lifecycle Management

Proper lifecycle management is crucial for WebSocket connections to prevent memory leaks and ensure connections are properly closed when no longer needed.

### Component Lifecycle

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  
  let socket;
  let messages = $state([]);
  
  onMount(() => {
    if (browser) {
      // Initialize WebSocket
      socket = new WebSocket('wss://echo.websocket.org');
      
      // Set up event handlers
      socket.onopen = () => console.log('WebSocket connected');
      socket.onclose = () => console.log('WebSocket disconnected');
      socket.onerror = (error) => console.error('WebSocket error:', error);
      socket.onmessage = (event) => {
        messages = [...messages, event.data];
      };
    }
    
    // Return cleanup function
    return () => {
      if (socket) {
        // Remove event handlers to prevent memory leaks
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        
        // Close the connection if it's still open
        if (socket.readyState === WebSocket.OPEN || 
            socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }
    };
  });
  
  // Alternative cleanup in onDestroy
  onDestroy(() => {
    if (socket) {
      // Same cleanup as above
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      
      if (socket.readyState === WebSocket.OPEN || 
          socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }
  });
</script>
```

### Page Navigation Handling

When using WebSockets in SvelteKit, you need to handle page navigation properly to avoid keeping connections open when navigating away from a page:

```javascript
// src/lib/stores/websocket.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { navigating } from '$app/stores';

// Create stores
export const socket = writable(null);
export const connected = writable(false);

// Initialize WebSocket
export function initWebSocket(url) {
  if (!browser) return;
  
  // Close existing connection if any
  closeWebSocket();
  
  // Create new WebSocket
  const ws = new WebSocket(url);
  
  // Update socket store
  socket.set(ws);
  
  // Set up event handlers
  ws.onopen = () => connected.set(true);
  ws.onclose = () => connected.set(false);
  
  // Subscribe to navigation events
  const unsubscribe = navigating.subscribe(nav => {
    if (nav) {
      // Close WebSocket when navigating away
      closeWebSocket();
      unsubscribe();
    }
  });
  
  return ws;
}

// Close WebSocket connection
export function closeWebSocket() {
  socket.update(ws => {
    if (ws) {
      // Remove event handlers
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      
      // Close connection if open
      if (ws.readyState === WebSocket.OPEN || 
          ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    return null;
  });
  
  connected.set(false);
}
```

By following these patterns, you can effectively manage WebSocket connections in your SvelteKit applications, ensuring proper resource cleanup and preventing memory leaks.
