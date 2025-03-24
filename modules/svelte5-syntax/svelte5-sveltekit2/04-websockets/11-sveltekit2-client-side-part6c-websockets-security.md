# SvelteKit 2 Client-Side Features: WebSockets (Security)

**Document Number**: GUIDE-011F-C4  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [WebSocket Security](#websocket-security)
2. [Authentication](#authentication)
3. [Authorization](#authorization)
4. [Data Validation](#data-validation)
5. [HugMeDo-Specific Security Implementations](#hugmedo-specific-security-implementations)

## WebSocket Security

WebSockets provide real-time, bidirectional communication, but they also introduce security considerations that must be addressed. This document covers security best practices for WebSocket implementations in SvelteKit applications.

## Authentication

Authentication ensures that the WebSocket connection is established by a legitimate user. There are several approaches to authenticate WebSocket connections:

### Token-Based Authentication

The most common approach is to use token-based authentication, where a token (JWT, session ID, etc.) is included in the WebSocket handshake:

```javascript
// src/lib/services/websocket.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { getAuthToken } from '$lib/services/auth.js';

export const socket = writable(null);
export const connected = writable(false);

export function initWebSocket(url) {
  if (!browser) return null;
  
  // Get authentication token
  const token = getAuthToken();
  if (!token) {
    console.error('Authentication token not found');
    return null;
  }
  
  // Append token to URL as query parameter
  const secureUrl = `${url}?token=${encodeURIComponent(token)}`;
  
  // Create WebSocket connection
  const ws = new WebSocket(secureUrl);
  
  // Set up event handlers
  ws.onopen = () => connected.set(true);
  ws.onclose = () => connected.set(false);
  
  // Update socket store
  socket.set(ws);
  
  return ws;
}
```

### Custom Headers (for Socket.IO)

When using Socket.IO, you can include authentication information in the connection options:

```javascript
import { io } from 'socket.io-client';
import { getAuthToken } from '$lib/services/auth.js';

export function initSocketIO(url) {
  const token = getAuthToken();
  
  const socket = io(url, {
    auth: {
      token
    },
    extraHeaders: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return socket;
}
```

### Authentication Handshake

For native WebSockets, you can implement a custom authentication handshake after the connection is established:

```javascript
// src/lib/services/secure-websocket.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { getAuthToken } from '$lib/services/auth.js';

export const socket = writable(null);
export const authenticated = writable(false);

export function initSecureWebSocket(url) {
  if (!browser) return null;
  
  // Create WebSocket connection
  const ws = new WebSocket(url);
  
  // Set up event handlers
  ws.onopen = () => {
    // Send authentication message as first message
    const token = getAuthToken();
    ws.send(JSON.stringify({
      type: 'auth',
      token
    }));
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Handle authentication response
      if (data.type === 'auth_response') {
        if (data.success) {
          authenticated.set(true);
          console.log('WebSocket authenticated successfully');
        } else {
          console.error('WebSocket authentication failed:', data.message);
          ws.close();
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  // Update socket store
  socket.set(ws);
  
  return ws;
}
```

## Authorization

Authorization determines what actions an authenticated user is allowed to perform. In WebSocket applications, authorization is typically implemented on the server side, but the client needs to handle authorization errors:

```svelte
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let socket;
  let messages = $state([]);
  let error = $state(null);
  
  onMount(() => {
    if (browser) {
      // Initialize WebSocket
      socket = new WebSocket('wss://api.example.com/ws');
      
      // Set up message handler
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle authorization errors
          if (data.type === 'error' && data.code === 'unauthorized') {
            error = 'You are not authorized to perform this action';
            return;
          }
          
          // Process normal messages
          messages = [...messages, data];
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
    }
  });
  
  function sendMessage(action, data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action,
        data,
        timestamp: new Date().toISOString()
      }));
    }
  }
</script>

<div class="websocket-app">
  {#if error}
    <div class="error-message">
      {error}
    </div>
  {/if}
  
  <!-- UI components -->
</div>
```

### Role-Based Access Control

For more complex applications, you might implement role-based access control (RBAC) to restrict certain WebSocket actions:

```javascript
// src/lib/services/websocket-rbac.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { getUserRole } from '$lib/services/auth.js';

// Define permissions for each role
const rolePermissions = {
  admin: ['read', 'write', 'delete', 'manage_users'],
  doctor: ['read', 'write', 'manage_patients'],
  nurse: ['read', 'write'],
  patient: ['read', 'write_own']
};

// Check if user has permission for an action
export function hasPermission(action) {
  const role = getUserRole();
  if (!role) return false;
  
  const permissions = rolePermissions[role] || [];
  return permissions.includes(action);
}

// Send message with permission check
export function sendSecureMessage(socket, action, data) {
  if (!hasPermission(action)) {
    console.error(`Permission denied: ${action}`);
    return false;
  }
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      action,
      data,
      timestamp: new Date().toISOString()
    }));
    return true;
  }
  
  return false;
}
```

## Data Validation

Validating data sent and received over WebSockets is crucial for security:

### Input Validation

Always validate user input before sending it over WebSockets:

```javascript
// src/lib/utils/validation.js
import { z } from 'zod';

// Define validation schemas
export const chatMessageSchema = z.object({
  content: z.string().min(1).max(1000),
  roomId: z.string().uuid(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'file']),
    url: z.string().url(),
    name: z.string().optional()
  })).optional().default([])
});

// Validate message before sending
export function validateChatMessage(message) {
  try {
    return chatMessageSchema.parse(message);
  } catch (error) {
    console.error('Invalid chat message:', error);
    return null;
  }
}
```

Using the validation in a component:

```svelte
<script>
  import { validateChatMessage } from '$lib/utils/validation';
  
  let messageInput = $state('');
  let attachments = $state([]);
  let error = $state(null);
  
  function sendMessage() {
    const message = {
      content: messageInput,
      roomId: '123e4567-e89b-12d3-a456-426614174000',
      attachments
    };
    
    // Validate message
    const validatedMessage = validateChatMessage(message);
    if (!validatedMessage) {
      error = 'Invalid message format';
      return;
    }
    
    // Send validated message
    socket.send(JSON.stringify(validatedMessage));
    messageInput = '';
    attachments = [];
  }
</script>
```

### Output Validation

Similarly, validate data received from the server:

```javascript
// src/lib/services/websocket-secure.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { z } from 'zod';

// Define validation schema for incoming messages
const incomingMessageSchema = z.object({
  type: z.string(),
  data: z.any(),
  timestamp: z.string().datetime().optional()
});

export const socket = writable(null);
export const messages = writable([]);
export const errors = writable([]);

export function initWebSocket(url) {
  if (!browser) return null;
  
  const ws = new WebSocket(url);
  
  ws.onmessage = (event) => {
    try {
      const rawData = JSON.parse(event.data);
      
      // Validate incoming message
      const result = incomingMessageSchema.safeParse(rawData);
      
      if (result.success) {
        // Process valid message
        messages.update(msgs => [...msgs, result.data]);
      } else {
        // Log validation error
        console.error('Invalid message format:', result.error);
        errors.update(errs => [...errs, {
          message: 'Invalid message format',
          details: result.error.format(),
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  };
  
  socket.set(ws);
  return ws;
}
```

## HugMeDo-Specific Security Implementations

In HugMeDo, we implement several security measures for WebSocket connections, particularly in the Chat module where sensitive patient information may be exchanged.

### Secure WebSocket Service

```javascript
// modules/chat/src/lib/services/secure-socket.service.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { io } from 'socket.io-client';
import { PUBLIC_CHAT_WS_URL } from '$env/static/public';
import { getAuthToken, refreshToken, isTokenExpired } from '$lib/services/auth.service';
import { z } from 'zod';

// Create stores
export const socket = writable(null);
export const connected = writable(false);
export const authenticated = writable(false);
export const error = writable(null);

// Message validation schemas
const messageSchema = z.object({
  roomId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  attachments: z.array(
    z.object({
      type: z.enum(['image', 'file', 'audio']),
      url: z.string().url(),
      name: z.string().optional(),
      size: z.number().optional(),
      mimeType: z.string().optional()
    })
  ).optional().default([]),
  metadata: z.record(z.string(), z.any()).optional()
});

// Initialize Socket.IO connection with security measures
export async function initializeSecureSocket() {
  if (!browser) return null;
  
  // Close existing connection
  closeSocket();
  
  try {
    // Check if token is expired and refresh if needed
    if (isTokenExpired()) {
      await refreshToken();
    }
    
    // Get fresh token
    const token = getAuthToken();
    if (!token) {
      error.set('認証情報がありません');
      return null;
    }
    
    // Create Socket.IO instance with auth token
    const socketInstance = io(PUBLIC_CHAT_WS_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token
      },
      extraHeaders: {
        'X-Client-Version': '1.0.0',
        'X-Client-Platform': 'web'
      }
    });
    
    // Set up event handlers
    socketInstance.on('connect', () => {
      connected.set(true);
      error.set(null);
      
      // Perform additional authentication handshake
      socketInstance.emit('authenticate', { token }, (response) => {
        if (response.success) {
          authenticated.set(true);
        } else {
          error.set(response.message || '認証に失敗しました');
          socketInstance.disconnect();
        }
      });
    });
    
    socketInstance.on('disconnect', () => {
      connected.set(false);
      authenticated.set(false);
    });
    
    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      error.set(err.message);
      connected.set(false);
      authenticated.set(false);
    });
    
    socketInstance.on('error', (err) => {
      console.error('Socket error:', err);
      error.set(err.message || 'エラーが発生しました');
    });
    
    // Update socket store
    socket.set(socketInstance);
    
    // Connect to the server
    socketInstance.connect();
    
    return socketInstance;
  } catch (err) {
    console.error('Failed to initialize socket:', err);
    error.set(err.message);
    return null;
  }
}

// Close Socket.IO connection
export function closeSocket() {
  socket.update(socketInstance => {
    if (socketInstance) {
      socketInstance.disconnect();
    }
    return null;
  });
  
  connected.set(false);
  authenticated.set(false);
}

// Send message with validation
export function sendSecureMessage(message) {
  return socket.update(socketInstance => {
    if (!socketInstance || !socketInstance.connected) {
      error.set('ソケット接続がありません');
      return socketInstance;
    }
    
    try {
      // Validate message
      const validatedMessage = messageSchema.parse(message);
      
      // Send validated message
      socketInstance.emit('message', validatedMessage, (response) => {
        if (!response.success) {
          error.set(response.message || 'メッセージの送信に失敗しました');
        }
      });
    } catch (err) {
      console.error('Message validation error:', err);
      error.set('メッセージの形式が無効です');
    }
    
    return socketInstance;
  });
}

// Join room with role-based access check
export function joinSecureRoom(roomId, userType) {
  return socket.update(socketInstance => {
    if (!socketInstance || !socketInstance.connected) {
      error.set('ソケット接続がありません');
      return socketInstance;
    }
    
    socketInstance.emit('join_room', { roomId, userType }, (response) => {
      if (!response.success) {
        error.set(response.message || 'ルームへの参加に失敗しました');
      }
    });
    
    return socketInstance;
  });
}
```

### Secure Chat Component

```svelte
<!-- modules/chat/src/routes/secure-chat/[roomId]/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { 
    initializeSecureSocket, 
    closeSocket,
    socket,
    connected,
    authenticated,
    error as socketError,
    sendSecureMessage,
    joinSecureRoom
  } from '$lib/services/secure-socket.service';
  import { getUserProfile } from '$lib/services/user.service';
  import { sanitizeHtml } from '$lib/utils/sanitize';
  
  import SecureChatMessage from '$lib/components/SecureChatMessage.svelte';
  import SecureChatInput from '$lib/components/SecureChatInput.svelte';
  
  // Get room ID from URL
  const roomId = $page.params.roomId;
  
  // State
  let messages = $state([]);
  let userProfile = $state(null);
  let isLoading = $state(true);
  let error = $state(null);
  
  // Initialize socket and load data
  onMount(async () => {
    try {
      // Get user profile
      userProfile = await getUserProfile();
      
      // Initialize secure socket
      await initializeSecureSocket();
      
      // Set up message handler
      const socketInstance = $socket;
      if (socketInstance) {
        socketInstance.on('new_message', handleNewMessage);
      }
      
      isLoading = false;
    } catch (err) {
      error = err.message;
      isLoading = false;
    }
  });
  
  // Clean up on component destroy
  onDestroy(() => {
    // Remove event listeners
    if ($socket) {
      $socket.off('new_message', handleNewMessage);
    }
    
    // Close socket connection
    closeSocket();
  });
  
  // Join room when authenticated
  $effect(() => {
    if ($authenticated && userProfile) {
      joinSecureRoom(roomId, userProfile.type);
    }
  });
  
  // Handle new messages
  function handleNewMessage(data) {
    if (data.roomId === roomId) {
      // Sanitize message content to prevent XSS
      const sanitizedMessage = {
        ...data,
        content: sanitizeHtml(data.content)
      };
      
      messages = [...messages, sanitizedMessage];
    }
  }
  
  // Send message
  function handleSendMessage(event) {
    const { content, attachments } = event.detail;
    
    sendSecureMessage({
      roomId,
      content,
      attachments,
      metadata: {
        senderType: userProfile?.type || 'unknown'
      }
    });
  }
</script>

<div class="secure-chat">
  <div class="status-bar">
    <div class="connection-status {$connected ? 'connected' : 'disconnected'}">
      {$connected ? '接続済み' : '未接続'}
    </div>
    
    {#if $socketError}
      <div class="error-message">
        {$socketError}
      </div>
    {/if}
  </div>
  
  {#if isLoading}
    <div class="loading">
      <p>読み込み中...</p>
    </div>
  {:else if error}
    <div class="error">
      <p>エラーが発生しました: {error}</p>
    </div>
  {:else}
    <div class="messages">
      {#each messages as message (message.id)}
        <SecureChatMessage 
          {message} 
          isSelf={message.senderId === userProfile?.id}
        />
      {/each}
    </div>
    
    <SecureChatInput 
      on:send={handleSendMessage}
      disabled={!$authenticated}
    />
  {/if}
</div>

<style>
  .secure-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 800px;
    margin: 0 auto;
  }
  
  .status-bar {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background-color: #f9f9f9;
    border-bottom: 1px solid #ddd;
  }
  
  .connection-status {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }
  
  .connection-status.connected {
    background-color: #d4edda;
    color: #155724;
  }
  
  .connection-status.disconnected {
    background-color: #f8d7da;
    color: #721c24;
  }
  
  .error-message {
    color: #721c24;
    background-color: #f8d7da;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }
  
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .loading, .error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
  }
  
  .error {
    color: #721c24;
  }
</style>
```

### HTML Sanitization Utility

To prevent XSS attacks in chat messages, we implement HTML sanitization:

```javascript
// src/lib/utils/sanitize.js
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} html - HTML content to sanitize
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  
  // Configure DOMPurify
  const config = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'object', 'embed', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    FORCE_BODY: true,
    SANITIZE_DOM: true
  };
  
  // Force links to open in new tab and add noopener noreferrer
  DOMPurify.addHook('afterSanitizeAttributes', function(node) {
    if ('target' in node) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  
  return DOMPurify.sanitize(html, config);
}

/**
 * Sanitize plain text to be safely displayed in HTML
 * @param {string} text - Plain text to sanitize
 * @returns {string} - Sanitized text
 */
export function sanitizeText(text) {
  if (!text) return '';
  
  // Escape HTML special characters
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

By implementing these security measures, we ensure that our WebSocket communications in HugMeDo are protected against common security threats such as authentication bypass, unauthorized access, cross-site scripting (XSS), and data injection attacks.
