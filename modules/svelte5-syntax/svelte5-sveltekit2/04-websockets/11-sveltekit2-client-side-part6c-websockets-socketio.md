# SvelteKit 2 Client-Side Features: WebSockets (Socket.IO)

**Document Number**: GUIDE-011F-C2  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Socket.IO in SvelteKit](#socketio-in-sveltekit)
2. [Setting Up Socket.IO Client](#setting-up-socketio-client)
3. [Basic Socket.IO Usage](#basic-socketio-usage)
4. [HugMeDo-Specific Implementations](#hugmedo-specific-implementations)

## Socket.IO in SvelteKit

While the native WebSocket API provides a solid foundation for real-time communication, Socket.IO offers additional features that make it a popular choice for many applications:

- **Automatic reconnection**: Socket.IO handles reconnection logic automatically
- **Fallbacks**: Falls back to other transport methods if WebSockets aren't available
- **Room support**: Easily group connections for targeted messaging
- **Acknowledgements**: Confirm message delivery with callbacks
- **Broadcasting**: Send messages to multiple clients at once
- **Namespaces**: Separate communication channels on the same connection

In HugMeDo, we use Socket.IO for our Chat module and other real-time features.

## Setting Up Socket.IO Client

First, you need to install the Socket.IO client library:

```bash
# In your module directory (e.g., apps/web)
pnpm add socket.io-client
```

### Creating a Socket.IO Store

It's a good practice to create a Svelte store to manage your Socket.IO connection, making it available throughout your application:

```javascript
// src/lib/stores/socket.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { io } from 'socket.io-client';

// Create a writable store
const socketStore = writable(null);

// Socket.IO connection options
const options = {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000
};

// Initialize Socket.IO connection
export function initializeSocket(url) {
  if (!browser) return;
  
  // Create Socket.IO instance
  const socket = io(url, options);
  
  // Update the store with the socket instance
  socketStore.set(socket);
  
  // Connect to the server
  socket.connect();
  
  return socket;
}

// Disconnect Socket.IO connection
export function disconnectSocket() {
  socketStore.update(socket => {
    if (socket) {
      socket.disconnect();
    }
    return null;
  });
}

// Export the store
export default socketStore;
```

## Basic Socket.IO Usage

### Connecting to a Socket.IO Server

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import socketStore, { initializeSocket, disconnectSocket } from '$lib/stores/socket';
  
  let messages = $state([]);
  let inputMessage = $state('');
  let connectionStatus = $state('disconnected');
  
  // Subscribe to socket store
  let socket;
  const unsubscribe = socketStore.subscribe(value => {
    socket = value;
  });
  
  onMount(() => {
    if (browser) {
      // Initialize Socket.IO connection
      const socket = initializeSocket('https://your-socketio-server.com');
      
      // Set up event listeners
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleError);
      socket.on('message', handleMessage);
    }
  });
  
  onDestroy(() => {
    // Clean up subscription
    unsubscribe();
    
    // Disconnect socket
    disconnectSocket();
  });
  
  function handleConnect() {
    connectionStatus = 'connected';
    messages = [...messages, { type: 'system', text: 'Connected to server' }];
  }
  
  function handleDisconnect() {
    connectionStatus = 'disconnected';
    messages = [...messages, { type: 'system', text: 'Disconnected from server' }];
  }
  
  function handleError(error) {
    connectionStatus = 'error';
    messages = [...messages, { type: 'error', text: `Connection error: ${error.message}` }];
  }
  
  function handleMessage(data) {
    messages = [...messages, { type: 'received', text: data.message, user: data.user }];
  }
  
  function sendMessage() {
    if (socket && socket.connected && inputMessage.trim()) {
      // Emit message event to server
      socket.emit('message', {
        message: inputMessage,
        timestamp: new Date().toISOString()
      }, (acknowledgement) => {
        // This callback is called when the server acknowledges the message
        console.log('Message acknowledged:', acknowledgement);
      });
      
      // Add message to local messages array
      messages = [...messages, { type: 'sent', text: inputMessage }];
      
      // Clear input field
      inputMessage = '';
    }
  }
</script>

<div class="chat-container">
  <div class="connection-status {connectionStatus}">
    Status: {connectionStatus}
  </div>
  
  <div class="messages">
    {#each messages as message}
      <div class="message {message.type}">
        {#if message.type === 'sent'}
          <strong>You:</strong>
        {:else if message.type === 'received'}
          <strong>{message.user || 'Server'}:</strong>
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

### Using Socket.IO Rooms

Socket.IO rooms allow you to group connections for targeted messaging. This is useful for features like private chats or topic-specific discussions:

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import socketStore, { initializeSocket, disconnectSocket } from '$lib/stores/socket';
  
  let rooms = $state([
    { id: 'general', name: 'General', unread: 0 },
    { id: 'support', name: 'Support', unread: 0 },
    { id: 'announcements', name: 'Announcements', unread: 0 }
  ]);
  
  let activeRoom = $state('general');
  let messages = $state({});
  let inputMessage = $state('');
  let username = $state('User_' + Math.floor(Math.random() * 1000));
  
  // Initialize message arrays for each room
  rooms.forEach(room => {
    messages[room.id] = [];
  });
  
  // Subscribe to socket store
  let socket;
  const unsubscribe = socketStore.subscribe(value => {
    socket = value;
  });
  
  onMount(() => {
    if (browser) {
      // Initialize Socket.IO connection
      const socket = initializeSocket('https://your-socketio-server.com');
      
      // Join the default room
      socket.emit('join', { room: activeRoom, username });
      
      // Set up event listeners
      socket.on('connect', () => {
        // Re-join active room on reconnection
        socket.emit('join', { room: activeRoom, username });
      });
      
      socket.on('message', handleMessage);
      
      socket.on('notification', (data) => {
        // Update unread count for the room
        if (data.room !== activeRoom) {
          rooms = rooms.map(room => 
            room.id === data.room 
              ? { ...room, unread: room.unread + 1 } 
              : room
          );
        }
      });
    }
  });
  
  onDestroy(() => {
    // Clean up subscription
    unsubscribe();
    
    // Leave current room before disconnecting
    if (socket && socket.connected) {
      socket.emit('leave', { room: activeRoom });
    }
    
    // Disconnect socket
    disconnectSocket();
  });
  
  function handleMessage(data) {
    // Add message to the appropriate room
    if (messages[data.room]) {
      messages = {
        ...messages,
        [data.room]: [
          ...messages[data.room],
          {
            id: Date.now(),
            user: data.username,
            text: data.message,
            timestamp: data.timestamp || new Date().toISOString(),
            isSelf: data.username === username
          }
        ]
      };
    }
  }
  
  function sendMessage() {
    if (socket && socket.connected && inputMessage.trim()) {
      // Emit message event to server
      socket.emit('message', {
        room: activeRoom,
        username,
        message: inputMessage,
        timestamp: new Date().toISOString()
      });
      
      // Clear input field
      inputMessage = '';
    }
  }
  
  function changeRoom(roomId) {
    if (roomId === activeRoom) return;
    
    // Leave current room
    socket.emit('leave', { room: activeRoom });
    
    // Join new room
    socket.emit('join', { room: roomId, username });
    
    // Update active room
    activeRoom = roomId;
    
    // Reset unread count for the new active room
    rooms = rooms.map(room => 
      room.id === roomId 
        ? { ...room, unread: 0 } 
        : room
    );
  }
</script>

<div class="chat-app">
  <div class="sidebar">
    <div class="user-info">
      <input 
        type="text" 
        bind:value={username} 
        placeholder="Your username"
      />
    </div>
    
    <div class="room-list">
      <h3>Rooms</h3>
      <ul>
        {#each rooms as room}
          <li 
            class:active={activeRoom === room.id}
            on:click={() => changeRoom(room.id)}
          >
            {room.name}
            {#if room.unread > 0}
              <span class="unread-badge">{room.unread}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </div>
  
  <div class="chat-area">
    <div class="room-header">
      <h2>{rooms.find(r => r.id === activeRoom)?.name || 'Chat'}</h2>
    </div>
    
    <div class="messages">
      {#each messages[activeRoom] || [] as message (message.id)}
        <div class="message" class:self={message.isSelf}>
          <div class="message-header">
            <span class="username">{message.user}</span>
            <span class="timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div class="message-content">
            {message.text}
          </div>
        </div>
      {/each}
    </div>
    
    <div class="input-area">
      <input 
        type="text" 
        bind:value={inputMessage} 
        placeholder="Type a message..."
        on:keydown={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button on:click={sendMessage}>
        Send
      </button>
    </div>
  </div>
</div>

<style>
  .chat-app {
    display: flex;
    height: 600px;
    max-width: 900px;
    margin: 0 auto;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .sidebar {
    width: 250px;
    background-color: #f5f5f5;
    border-right: 1px solid #ddd;
    display: flex;
    flex-direction: column;
  }
  
  .user-info {
    padding: 1rem;
    border-bottom: 1px solid #ddd;
  }
  
  .room-list {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
  }
  
  .room-list h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }
  
  .room-list ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .room-list li {
    padding: 0.5rem;
    margin-bottom: 0.25rem;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
  }
  
  .room-list li:hover {
    background-color: #e9ecef;
  }
  
  .room-list li.active {
    background-color: #007bff;
    color: white;
  }
  
  .unread-badge {
    background-color: #dc3545;
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
  }
  
  .chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .room-header {
    padding: 1rem;
    border-bottom: 1px solid #ddd;
    background-color: #f9f9f9;
  }
  
  .room-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .messages {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
    background-color: white;
  }
  
  .message {
    margin-bottom: 1rem;
    max-width: 70%;
  }
  
  .message.self {
    margin-left: auto;
  }
  
  .message-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
    font-size: 0.8rem;
  }
  
  .username {
    font-weight: bold;
  }
  
  .timestamp {
    color: #6c757d;
  }
  
  .message-content {
    padding: 0.5rem;
    border-radius: 4px;
    background-color: #f1f1f1;
    word-break: break-word;
  }
  
  .message.self .message-content {
    background-color: #e3f2fd;
  }
  
  .input-area {
    display: flex;
    padding: 1rem;
    border-top: 1px solid #ddd;
    background-color: #f9f9f9;
  }
  
  input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .input-area input {
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
</style>
```

## HugMeDo-Specific Implementations

In HugMeDo, we use Socket.IO for our Chat module to enable real-time communication between patients and healthcare providers. Here's how we implement it:

### Socket.IO Service

```javascript
// modules/chat/src/lib/services/socket.service.js
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { io } from 'socket.io-client';
import { PUBLIC_CHAT_WS_URL } from '$env/static/public';
import { getAuthToken } from '$lib/services/auth.service';

// Create stores
export const socketConnected = writable(false);
export const socketError = writable(null);

// Socket instance
let socket = null;

// Initialize Socket.IO connection
export function initializeSocket() {
  if (!browser || socket) return socket;
  
  const token = getAuthToken();
  if (!token) {
    socketError.set('認証情報がありません');
    return null;
  }
  
  // Create Socket.IO instance with auth token
  socket = io(PUBLIC_CHAT_WS_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: {
      token
    }
  });
  
  // Set up event listeners
  socket.on('connect', () => {
    console.log('Socket connected');
    socketConnected.set(true);
    socketError.set(null);
  });
  
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    socketConnected.set(false);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    socketError.set(error.message);
    socketConnected.set(false);
  });
  
  // Connect to the server
  socket.connect();
  
  return socket;
}

// Get the socket instance
export function getSocket() {
  return socket;
}

// Disconnect Socket.IO connection
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketConnected.set(false);
  }
}

// Join a chat room
export function joinChatRoom(roomId, userId, userType) {
  if (!socket || !socket.connected) return false;
  
  socket.emit('join_room', { roomId, userId, userType });
  return true;
}

// Leave a chat room
export function leaveChatRoom(roomId, userId) {
  if (!socket || !socket.connected) return false;
  
  socket.emit('leave_room', { roomId, userId });
  return true;
}

// Send a message
export function sendMessage(roomId, message) {
  if (!socket || !socket.connected) return false;
  
  socket.emit('message', {
    roomId,
    content: message.content,
    attachments: message.attachments || [],
    metadata: message.metadata || {}
  });
  
  return true;
}

// Subscribe to new messages
export function onNewMessage(callback) {
  if (!socket) return () => {};
  
  socket.on('new_message', callback);
  
  // Return unsubscribe function
  return () => socket.off('new_message', callback);
}

// Subscribe to typing indicators
export function onTypingIndicator(callback) {
  if (!socket) return () => {};
  
  socket.on('typing', callback);
  
  // Return unsubscribe function
  return () => socket.off('typing', callback);
}

// Send typing indicator
export function sendTypingIndicator(roomId, userId, isTyping) {
  if (!socket || !socket.connected) return false;
  
  socket.emit('typing', { roomId, userId, isTyping });
  return true;
}
```

### Using the Socket Service in a Component

```svelte
<!-- modules/chat/src/routes/chat/[roomId]/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { 
    initializeSocket, 
    disconnectSocket, 
    joinChatRoom,
    leaveChatRoom,
    sendMessage,
    onNewMessage,
    onTypingIndicator,
    sendTypingIndicator,
    socketConnected,
    socketError
  } from '$lib/services/socket.service';
  import { fetchChatHistory } from '$lib/services/chat.service';
  import { getUserProfile } from '$lib/services/user.service';
  
  import ChatMessage from '$lib/components/ChatMessage.svelte';
  import ChatInput from '$lib/components/ChatInput.svelte';
  import TypingIndicator from '$lib/components/TypingIndicator.svelte';
  import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
  
  // Get room ID from URL
  const roomId = $page.params.roomId;
  
  // State
  let messages = $state([]);
  let isLoading = $state(true);
  let error = $state(null);
  let userProfile = $state(null);
  let typingUsers = $state([]);
  
  // Unsubscribe functions
  let unsubscribeNewMessage;
  let unsubscribeTyping;
  
  onMount(async () => {
    if (browser) {
      try {
        // Get user profile
        userProfile = await getUserProfile();
        
        // Initialize socket
        initializeSocket();
        
        // Set up message listener
        unsubscribeNewMessage = onNewMessage(handleNewMessage);
        
        // Set up typing indicator listener
        unsubscribeTyping = onTypingIndicator(handleTypingIndicator);
        
        // Load chat history
        const history = await fetchChatHistory(roomId);
        messages = history;
        
        // Join chat room when connected
        const unsubscribeConnected = socketConnected.subscribe(connected => {
          if (connected) {
            joinChatRoom(roomId, userProfile.id, userProfile.type);
          }
        });
        
        isLoading = false;
        
        return () => {
          unsubscribeConnected();
        };
      } catch (err) {
        error = err.message;
        isLoading = false;
      }
    }
  });
  
  onDestroy(() => {
    // Leave chat room
    if (userProfile) {
      leaveChatRoom(roomId, userProfile.id);
    }
    
    // Unsubscribe from events
    if (unsubscribeNewMessage) unsubscribeNewMessage();
    if (unsubscribeTyping) unsubscribeTyping();
    
    // Disconnect socket
    disconnectSocket();
  });
  
  function handleNewMessage(data) {
    if (data.roomId === roomId) {
      messages = [...messages, data];
      
      // Remove user from typing list
      typingUsers = typingUsers.filter(user => user.id !== data.userId);
    }
  }
  
  function handleTypingIndicator(data) {
    if (data.roomId === roomId) {
      if (data.isTyping) {
        // Add user to typing list if not already there
        if (!typingUsers.some(user => user.id === data.userId)) {
          typingUsers = [...typingUsers, { 
            id: data.userId, 
            name: data.userName || 'Someone' 
          }];
        }
      } else {
        // Remove user from typing list
        typingUsers = typingUsers.filter(user => user.id !== data.userId);
      }
    }
  }
  
  function handleSendMessage(event) {
    const { content, attachments } = event.detail;
    
    // Send message
    sendMessage(roomId, {
      content,
      attachments,
      metadata: {
        senderType: userProfile.type
      }
    });
    
    // Clear typing indicator
    sendTypingIndicator(roomId, userProfile.id, false);
  }
  
  function handleTyping(event) {
    const { isTyping } = event.detail;
    
    // Send typing indicator
    sendTypingIndicator(roomId, userProfile.id, isTyping);
  }
</script>

<div class="chat-container">
  <ConnectionStatus connected={$socketConnected} error={$socketError} />
  
  {#if isLoading}
    <div class="loading">
      <p>読み込み中...</p>
    </div>
  {:else if error}
    <div class="error">
      <p>エラーが発生しました: {error}</p>
    </div>
  {:else}
    <div class="messages-container">
      <div class="messages">
        {#each messages as message (message.id)}
          <ChatMessage 
            {message} 
            isSelf={message.userId === userProfile?.id}
          />
        {/each}
      </div>
      
      {#if typingUsers.length > 0}
        <TypingIndicator users={typingUsers} />
      {/if}
    </div>
    
    <ChatInput 
      on:send={handleSendMessage}
      on:typing={handleTyping}
      disabled={!$socketConnected}
    />
  {/if}
</div>

<style>
  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 800px;
    margin: 0 auto;
  }
  
  .messages-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
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
    color: #dc3545;
  }
</style>
```

This implementation demonstrates how to use Socket.IO in a SvelteKit application for real-time chat functionality, which is a core feature of the HugMeDo Chat module.
