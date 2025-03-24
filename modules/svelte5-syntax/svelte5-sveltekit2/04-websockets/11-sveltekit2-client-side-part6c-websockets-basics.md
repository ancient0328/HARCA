# SvelteKit 2 Client-Side Features: WebSockets (Basics)

**Document Number**: GUIDE-011F-C1  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [WebSockets in SvelteKit](#websockets-in-sveltekit)
2. [Basic WebSocket Connection](#basic-websocket-connection)
3. [Handling WebSocket Events](#handling-websocket-events)

## WebSockets in SvelteKit

WebSockets provide a persistent connection between a client and server, allowing for real-time, bidirectional communication. Unlike HTTP, which follows a request-response pattern, WebSockets enable continuous data exchange without requiring new connections for each interaction.

In SvelteKit applications, WebSockets are typically used for:

1. **Real-time chat applications**
2. **Live notifications and updates**
3. **Collaborative editing**
4. **Live data streaming**
5. **Gaming applications**

Since WebSockets are a client-side browser API, they should only be initialized in browser code. SvelteKit's server-side rendering (SSR) requires us to check for browser environment before using WebSockets.

### Browser Environment Check

```javascript
import { browser } from '$app/environment';

if (browser) {
  // Safe to initialize WebSocket connection here
  const socket = new WebSocket('wss://example.com/socket');
}
```

## Basic WebSocket Connection

### Creating a WebSocket Connection

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  
  let socket;
  let connectionStatus = $state('disconnected');
  let messages = $state([]);
  let inputMessage = $state('');
  
  onMount(() => {
    if (browser) {
      // Initialize WebSocket connection
      connectWebSocket();
    }
  });
  
  onDestroy(() => {
    // Clean up WebSocket connection when component is destroyed
    if (socket) {
      socket.close();
    }
  });
  
  function connectWebSocket() {
    // Create a new WebSocket connection
    socket = new WebSocket('wss://echo.websocket.org');
    
    // Update connection status when connection opens
    socket.onopen = () => {
      connectionStatus = 'connected';
      messages = [...messages, { type: 'system', text: 'Connected to server' }];
    };
    
    // Handle incoming messages
    socket.onmessage = (event) => {
      messages = [...messages, { type: 'received', text: event.data }];
    };
    
    // Handle errors
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      connectionStatus = 'error';
      messages = [...messages, { type: 'error', text: 'Connection error' }];
    };
    
    // Handle connection close
    socket.onclose = () => {
      connectionStatus = 'disconnected';
      messages = [...messages, { type: 'system', text: 'Disconnected from server' }];
    };
  }
  
  function sendMessage() {
    if (socket && socket.readyState === WebSocket.OPEN && inputMessage.trim()) {
      // Send message to server
      socket.send(inputMessage);
      
      // Add message to local messages array
      messages = [...messages, { type: 'sent', text: inputMessage }];
      
      // Clear input field
      inputMessage = '';
    }
  }
  
  function reconnect() {
    if (socket) {
      socket.close();
    }
    connectWebSocket();
  }
</script>

<div class="chat-container">
  <div class="connection-status {connectionStatus}">
    Status: {connectionStatus}
    {#if connectionStatus !== 'connected'}
      <button on:click={reconnect}>Reconnect</button>
    {/if}
  </div>
  
  <div class="messages">
    {#each messages as message}
      <div class="message {message.type}">
        {#if message.type === 'sent'}
          <strong>You:</strong>
        {:else if message.type === 'received'}
          <strong>Server:</strong>
        {/if}
        {message.text}
      </div>
    {/each}
  </div>
  
  <div class="input-area">
    <input 
      type="text" 
      bind:value={inputMessage} 
      placeholder="Type a message..."
      on:keydown={(e) => e.key === 'Enter' && sendMessage()}
      disabled={connectionStatus !== 'connected'}
    />
    <button 
      on:click={sendMessage}
      disabled={connectionStatus !== 'connected'}
    >
      Send
    </button>
  </div>
</div>

<style>
  .chat-container {
    max-width: 600px;
    margin: 0 auto;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .connection-status {
    padding: 0.5rem;
    text-align: center;
    font-weight: bold;
  }
  
  .connection-status.connected {
    background-color: #28a745;
    color: white;
  }
  
  .connection-status.disconnected {
    background-color: #dc3545;
    color: white;
  }
  
  .connection-status.error {
    background-color: #dc3545;
    color: white;
  }
  
  .messages {
    height: 300px;
    overflow-y: auto;
    padding: 1rem;
    background-color: #f9f9f9;
  }
  
  .message {
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
  }
  
  .message.sent {
    background-color: #e3f2fd;
    text-align: right;
  }
  
  .message.received {
    background-color: #f1f1f1;
  }
  
  .message.system {
    background-color: #fff3cd;
    text-align: center;
    font-style: italic;
  }
  
  .message.error {
    background-color: #f8d7da;
    text-align: center;
    color: #721c24;
  }
  
  .input-area {
    display: flex;
    padding: 0.5rem;
    background-color: white;
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

## Handling WebSocket Events

WebSocket connections emit several events that you need to handle:

### Connection Events

- **open**: Fired when the connection is established
- **close**: Fired when the connection is closed
- **error**: Fired when an error occurs

### Message Events

- **message**: Fired when a message is received from the server

### WebSocket States

The WebSocket object has a `readyState` property that indicates the current state of the connection:

- **WebSocket.CONNECTING (0)**: The connection is being established
- **WebSocket.OPEN (1)**: The connection is open and ready to communicate
- **WebSocket.CLOSING (2)**: The connection is closing
- **WebSocket.CLOSED (3)**: The connection is closed or couldn't be opened

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  
  let socket;
  let connectionState = $state('');
  
  onMount(() => {
    if (browser) {
      initWebSocket();
    }
  });
  
  onDestroy(() => {
    if (socket) {
      socket.close();
    }
  });
  
  function initWebSocket() {
    socket = new WebSocket('wss://echo.websocket.org');
    
    updateConnectionState();
    
    // Set up a timer to update the connection state periodically
    const stateInterval = setInterval(updateConnectionState, 1000);
    
    // Clear the interval when the component is destroyed
    return () => clearInterval(stateInterval);
  }
  
  function updateConnectionState() {
    if (!socket) return;
    
    switch (socket.readyState) {
      case WebSocket.CONNECTING:
        connectionState = 'Connecting...';
        break;
      case WebSocket.OPEN:
        connectionState = 'Connected';
        break;
      case WebSocket.CLOSING:
        connectionState = 'Closing...';
        break;
      case WebSocket.CLOSED:
        connectionState = 'Disconnected';
        break;
      default:
        connectionState = 'Unknown';
    }
  }
  
  function connect() {
    if (socket && socket.readyState === WebSocket.CLOSED) {
      initWebSocket();
    }
  }
  
  function disconnect() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
  }
</script>

<div class="websocket-demo">
  <h2>WebSocket Connection Demo</h2>
  
  <div class="connection-info">
    <p>Connection State: <strong>{connectionState}</strong></p>
  </div>
  
  <div class="controls">
    <button on:click={connect} disabled={socket && socket.readyState !== WebSocket.CLOSED}>
      Connect
    </button>
    <button on:click={disconnect} disabled={!socket || socket.readyState !== WebSocket.OPEN}>
      Disconnect
    </button>
  </div>
</div>

<style>
  .websocket-demo {
    max-width: 400px;
    margin: 0 auto;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  
  .connection-info {
    margin: 1rem 0;
    padding: 1rem;
    background-color: #f9f9f9;
    border-radius: 4px;
  }
  
  .controls {
    display: flex;
    gap: 1rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

### Handling Connection Errors and Reconnection

It's important to handle WebSocket connection errors and implement reconnection logic for a robust application:

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  
  let socket;
  let connectionStatus = $state('disconnected');
  let reconnectAttempts = $state(0);
  let maxReconnectAttempts = 5;
  let reconnectInterval = 3000; // 3 seconds
  let reconnectTimer;
  
  onMount(() => {
    if (browser) {
      connectWebSocket();
    }
  });
  
  onDestroy(() => {
    if (socket) {
      socket.close();
    }
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
  });
  
  function connectWebSocket() {
    // Reset socket if it exists
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
    }
    
    connectionStatus = 'connecting';
    
    // Create a new WebSocket connection
    socket = new WebSocket('wss://echo.websocket.org');
    
    socket.onopen = () => {
      connectionStatus = 'connected';
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    };
    
    socket.onclose = (event) => {
      // Check if the close was clean (normal closure)
      const wasClean = event.wasClean;
      
      if (wasClean) {
        connectionStatus = 'disconnected';
      } else {
        connectionStatus = 'error';
        attemptReconnect();
      }
    };
    
    socket.onerror = () => {
      connectionStatus = 'error';
      // The socket will also trigger onclose after an error
    };
  }
  
  function attemptReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) {
      connectionStatus = 'failed';
      return;
    }
    
    reconnectAttempts++;
    connectionStatus = 'reconnecting';
    
    // Set a timer to reconnect
    reconnectTimer = setTimeout(() => {
      connectWebSocket();
    }, reconnectInterval * reconnectAttempts); // Exponential backoff
  }
  
  function manualReconnect() {
    reconnectAttempts = 0;
    connectWebSocket();
  }
</script>

<div class="connection-monitor">
  <h2>WebSocket Connection Monitor</h2>
  
  <div class="status-display {connectionStatus}">
    <div class="status-indicator"></div>
    <div class="status-text">
      {#if connectionStatus === 'disconnected'}
        Disconnected
      {:else if connectionStatus === 'connecting'}
        Connecting...
      {:else if connectionStatus === 'connected'}
        Connected
      {:else if connectionStatus === 'error'}
        Connection Error
      {:else if connectionStatus === 'reconnecting'}
        Reconnecting (Attempt {reconnectAttempts}/{maxReconnectAttempts})...
      {:else if connectionStatus === 'failed'}
        Connection Failed
      {/if}
    </div>
  </div>
  
  <div class="actions">
    {#if connectionStatus === 'failed' || connectionStatus === 'disconnected'}
      <button on:click={manualReconnect}>
        Reconnect Now
      </button>
    {/if}
  </div>
</div>

<style>
  .connection-monitor {
    max-width: 400px;
    margin: 0 auto;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  
  .status-display {
    display: flex;
    align-items: center;
    padding: 1rem;
    margin: 1rem 0;
    border-radius: 4px;
  }
  
  .status-display.disconnected {
    background-color: #f8f9fa;
  }
  
  .status-display.connecting, .status-display.reconnecting {
    background-color: #fff3cd;
  }
  
  .status-display.connected {
    background-color: #d4edda;
  }
  
  .status-display.error, .status-display.failed {
    background-color: #f8d7da;
  }
  
  .status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 10px;
  }
  
  .disconnected .status-indicator {
    background-color: #6c757d;
  }
  
  .connecting .status-indicator, .reconnecting .status-indicator {
    background-color: #ffc107;
    animation: pulse 1s infinite;
  }
  
  .connected .status-indicator {
    background-color: #28a745;
  }
  
  .error .status-indicator, .failed .status-indicator {
    background-color: #dc3545;
  }
  
  .actions {
    margin-top: 1rem;
  }
  
  button {
    padding: 0.5rem 1rem;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
</style>
```
