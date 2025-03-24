# SvelteKit 2 Client-Side Features: WebSockets (Testing)

**Document Number**: GUIDE-011F-C5  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## Table of Contents

1. [Testing WebSocket Implementations](#testing-websocket-implementations)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [Mock WebSocket Server](#mock-websocket-server)
5. [HugMeDo-Specific Testing Approaches](#hugmedo-specific-testing-approaches)

## Testing WebSocket Implementations

Testing WebSocket implementations in SvelteKit applications presents unique challenges due to their real-time, stateful nature. This document covers approaches to effectively test WebSocket functionality.

## Unit Testing

Unit testing WebSocket code involves testing individual components and functions in isolation, typically by mocking the WebSocket API.

### Mocking the WebSocket API

```javascript
// src/lib/mocks/websocket.mock.js
export class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    
    // Event handlers
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // Mock behavior
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen({ target: this });
    }, 0);
  }
  
  // Mock send method
  send(data) {
    // Store sent data for assertions
    this._lastSentData = data;
    
    // Simulate echo response
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data, target: this });
      }
    }, 10);
  }
  
  // Mock close method
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ 
        code: 1000, 
        reason: 'Normal closure', 
        wasClean: true, 
        target: this 
      });
    }
  }
  
  // Helper method to simulate receiving a message
  receiveMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data, target: this });
    }
  }
  
  // Helper method to simulate an error
  simulateError(error) {
    if (this.onerror) {
      this.onerror({ error, target: this });
    }
  }
}

// Mock WebSocket constants
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;
```

### Testing WebSocket Services

```javascript
// src/lib/services/websocket.service.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockWebSocket } from '$lib/mocks/websocket.mock';
import { get } from 'svelte/store';
import { 
  initWebSocket, 
  closeWebSocket, 
  sendMessage, 
  socket, 
  connected, 
  messages 
} from '$lib/services/websocket.service';

// Mock the WebSocket global
const originalWebSocket = global.WebSocket;

describe('WebSocket Service', () => {
  beforeEach(() => {
    // Replace global WebSocket with mock
    global.WebSocket = MockWebSocket;
    
    // Reset stores
    socket.set(null);
    connected.set(false);
    messages.set([]);
    
    // Mock browser environment
    vi.stubGlobal('browser', true);
  });
  
  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
    
    // Clean up
    vi.unstubAllGlobals();
  });
  
  it('should initialize a WebSocket connection', () => {
    const ws = initWebSocket('wss://example.com');
    
    expect(ws).toBeInstanceOf(MockWebSocket);
    expect(ws.url).toBe('wss://example.com');
    
    // Wait for connection to open
    return new Promise(resolve => {
      setTimeout(() => {
        expect(get(connected)).toBe(true);
        resolve();
      }, 10);
    });
  });
  
  it('should close the WebSocket connection', async () => {
    // Initialize WebSocket
    const ws = initWebSocket('wss://example.com');
    
    // Wait for connection to open
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Close connection
    closeWebSocket();
    
    expect(get(connected)).toBe(false);
    expect(get(socket)).toBeNull();
  });
  
  it('should send messages through the WebSocket', async () => {
    // Initialize WebSocket
    const ws = initWebSocket('wss://example.com');
    
    // Wait for connection to open
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Send a message
    const testMessage = { type: 'test', content: 'Hello, WebSocket!' };
    sendMessage(testMessage);
    
    // Check if message was sent
    expect(ws._lastSentData).toBe(JSON.stringify(testMessage));
    
    // Wait for echo response
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // Check if message was received
    const receivedMessages = get(messages);
    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0]).toEqual(testMessage);
  });
  
  it('should handle WebSocket errors', async () => {
    // Initialize WebSocket
    const ws = initWebSocket('wss://example.com');
    
    // Wait for connection to open
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Simulate an error
    ws.simulateError('Connection lost');
    
    // Check if error was handled
    expect(get(connected)).toBe(false);
  });
});
```

### Testing Components with WebSockets

```javascript
// src/lib/components/ChatComponent.test.js
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockWebSocket } from '$lib/mocks/websocket.mock';
import ChatComponent from '$lib/components/ChatComponent.svelte';

// Mock the WebSocket global
const originalWebSocket = global.WebSocket;

describe('ChatComponent', () => {
  let mockWebSocket;
  
  beforeEach(() => {
    // Create a mock WebSocket instance
    mockWebSocket = new MockWebSocket('wss://example.com');
    
    // Replace global WebSocket with a function that returns our instance
    global.WebSocket = function() {
      return mockWebSocket;
    };
    
    // Mock browser environment
    vi.stubGlobal('browser', true);
  });
  
  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
    
    // Clean up
    vi.unstubAllGlobals();
  });
  
  it('should render the chat component', () => {
    const { getByText } = render(ChatComponent);
    
    expect(getByText('Chat')).toBeInTheDocument();
  });
  
  it('should display connection status', async () => {
    const { getByText } = render(ChatComponent);
    
    // Initially connecting
    expect(getByText('Connecting...')).toBeInTheDocument();
    
    // Simulate connection open
    mockWebSocket.onopen();
    
    await waitFor(() => {
      expect(getByText('Connected')).toBeInTheDocument();
    });
  });
  
  it('should send and receive messages', async () => {
    const { getByPlaceholderText, getByText, findByText } = render(ChatComponent);
    
    // Simulate connection open
    mockWebSocket.onopen();
    
    // Type a message
    const input = getByPlaceholderText('Type a message...');
    await fireEvent.input(input, { target: { value: 'Hello, WebSocket!' } });
    
    // Send the message
    const sendButton = getByText('Send');
    await fireEvent.click(sendButton);
    
    // Check if message was sent
    expect(mockWebSocket._lastSentData).toBe(JSON.stringify({
      type: 'chat',
      content: 'Hello, WebSocket!'
    }));
    
    // Simulate receiving a response
    mockWebSocket.receiveMessage(JSON.stringify({
      type: 'chat',
      content: 'Echo: Hello, WebSocket!',
      sender: 'Server'
    }));
    
    // Check if response is displayed
    const response = await findByText('Echo: Hello, WebSocket!');
    expect(response).toBeInTheDocument();
  });
  
  it('should handle connection errors', async () => {
    const { getByText } = render(ChatComponent);
    
    // Simulate an error
    mockWebSocket.simulateError('Connection failed');
    
    await waitFor(() => {
      expect(getByText('Connection error')).toBeInTheDocument();
    });
  });
});
```

## Integration Testing

Integration testing involves testing how WebSocket components interact with other parts of your application.

### Testing with Playwright

```javascript
// tests/integration/websocket.spec.js
import { test, expect } from '@playwright/test';

// Mock WebSocket server endpoint
const WS_SERVER_URL = 'ws://localhost:3000/ws';

test.describe('WebSocket Chat', () => {
  test('should connect to WebSocket server and exchange messages', async ({ page }) => {
    // Navigate to the chat page
    await page.goto('/chat');
    
    // Wait for WebSocket connection
    await page.waitForSelector('.status.connected');
    
    // Type and send a message
    await page.fill('input[placeholder="Type a message..."]', 'Hello from Playwright!');
    await page.click('button:has-text("Send")');
    
    // Wait for the message to appear in the chat
    await page.waitForSelector('.message:has-text("Hello from Playwright!")');
    
    // Wait for the server response
    await page.waitForSelector('.message:has-text("Server received:")');
    
    // Verify the connection remains stable
    await expect(page.locator('.status.connected')).toBeVisible();
  });
  
  test('should handle reconnection', async ({ page }) => {
    // Navigate to the chat page
    await page.goto('/chat');
    
    // Wait for WebSocket connection
    await page.waitForSelector('.status.connected');
    
    // Simulate network disconnection
    await page.evaluate(() => {
      // Mock WebSocket close event
      const event = new CloseEvent('close', { 
        wasClean: false, 
        code: 1006, 
        reason: 'Connection lost' 
      });
      
      // Find WebSocket instance and dispatch event
      const ws = window._debugWebSocket;
      if (ws) {
        ws.dispatchEvent(event);
      }
    });
    
    // Wait for reconnecting status
    await page.waitForSelector('.status.reconnecting');
    
    // Wait for reconnection
    await page.waitForSelector('.status.connected', { timeout: 10000 });
  });
});
```

## Mock WebSocket Server

For comprehensive testing, it's useful to create a mock WebSocket server that can be used in development and testing environments.

### Mock Server with ws

```javascript
// tests/mock-server/websocket-server.js
const WebSocket = require('ws');
const http = require('http');

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  // Add client to set
  clients.add(ws);
  
  console.log('Client connected');
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    content: 'Welcome to the mock WebSocket server!',
    timestamp: new Date().toISOString()
  }));
  
  // Handle messages
  ws.on('message', (message) => {
    console.log('Received:', message);
    
    try {
      // Parse message
      const data = JSON.parse(message);
      
      // Echo the message back
      ws.send(JSON.stringify({
        type: 'response',
        content: `Server received: ${data.content || message}`,
        originalMessage: data,
        timestamp: new Date().toISOString()
      }));
      
      // Broadcast to other clients if it's a chat message
      if (data.type === 'chat') {
        broadcastMessage(ws, {
          type: 'chat',
          content: data.content,
          sender: data.sender || 'Anonymous',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      // Handle non-JSON messages
      ws.send(JSON.stringify({
        type: 'error',
        content: 'Invalid message format',
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');
  });
});

// Broadcast message to all clients except sender
function broadcastMessage(sender, message) {
  const messageStr = JSON.stringify(message);
  
  clients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Mock WebSocket server running on port ${PORT}`);
});

// Export for testing
module.exports = {
  server,
  wss,
  clients,
  broadcastMessage
};
```

### Using the Mock Server in Tests

```javascript
// tests/integration/websocket-with-mock.spec.js
import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import { once } from 'events';

let mockServer;

// Start mock server before tests
test.beforeAll(async () => {
  // Start the mock WebSocket server
  mockServer = spawn('node', ['tests/mock-server/websocket-server.js']);
  
  // Wait for server to start
  await new Promise(resolve => {
    mockServer.stdout.on('data', (data) => {
      if (data.toString().includes('running on port')) {
        resolve();
      }
    });
  });
  
  // Give the server a moment to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
});

// Stop mock server after tests
test.afterAll(async () => {
  if (mockServer) {
    mockServer.kill();
  }
});

test.describe('WebSocket Chat with Mock Server', () => {
  test('should connect to mock server and exchange messages', async ({ page }) => {
    // Navigate to the chat page
    await page.goto('/chat');
    
    // Wait for WebSocket connection
    await page.waitForSelector('.status.connected');
    
    // Wait for welcome message
    await page.waitForSelector('.message:has-text("Welcome to the mock WebSocket server!")');
    
    // Type and send a message
    await page.fill('input[placeholder="Type a message..."]', 'Hello, mock server!');
    await page.click('button:has-text("Send")');
    
    // Wait for the message to appear in the chat
    await page.waitForSelector('.message:has-text("Hello, mock server!")');
    
    // Wait for the server response
    await page.waitForSelector('.message:has-text("Server received: Hello, mock server!")');
  });
});
```

## HugMeDo-Specific Testing Approaches

In HugMeDo, we use a combination of unit tests, integration tests, and end-to-end tests to ensure our WebSocket implementations are robust and reliable.

### Mock Socket Service for Component Testing

```javascript
// modules/chat/src/lib/mocks/socket.service.mock.js
import { writable } from 'svelte/store';

// Create mock stores
export const socketConnected = writable(true);
export const socketError = writable(null);

// Mock socket instance
const mockSocket = {
  connected: true,
  emit: vi.fn((event, data, callback) => {
    // Simulate successful acknowledgement
    if (callback) {
      callback({ success: true });
    }
    
    // For testing, emit a response for certain events
    if (event === 'message') {
      // Echo the message back
      mockHandlers.new_message({
        id: `mock-${Date.now()}`,
        roomId: data.roomId,
        content: data.content,
        senderId: 'current-user',
        senderName: 'Current User',
        timestamp: new Date().toISOString()
      });
    }
  }),
  on: vi.fn((event, handler) => {
    // Store handler for later use
    mockHandlers[event] = handler;
  }),
  off: vi.fn(),
  disconnect: vi.fn(() => {
    socketConnected.set(false);
  })
};

// Store event handlers
const mockHandlers = {};

// Mock initialization function
export function initializeSocket() {
  socketConnected.set(true);
  return mockSocket;
}

// Mock disconnect function
export function disconnectSocket() {
  socketConnected.set(false);
}

// Mock join room function
export function joinChatRoom(roomId, userId, userType) {
  return true;
}

// Mock leave room function
export function leaveChatRoom(roomId, userId) {
  return true;
}

// Mock send message function
export function sendMessage(roomId, message) {
  mockSocket.emit('message', {
    roomId,
    content: message.content,
    attachments: message.attachments || [],
    metadata: message.metadata || {}
  });
  
  return true;
}

// Helper to simulate receiving a message
export function simulateNewMessage(message) {
  if (mockHandlers.new_message) {
    mockHandlers.new_message(message);
  }
}

// Helper to simulate typing indicator
export function simulateTypingIndicator(data) {
  if (mockHandlers.typing) {
    mockHandlers.typing(data);
  }
}

// Helper to simulate connection error
export function simulateConnectionError(error) {
  socketConnected.set(false);
  socketError.set(error);
}

// Export mock socket for direct manipulation in tests
export const mockSocketInstance = mockSocket;
```

### Testing Chat Components with Mock Socket Service

```javascript
// modules/chat/src/routes/chat/[roomId]/+page.test.js
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { page } from '$app/stores';
import ChatPage from './+page.svelte';

// Mock socket service
vi.mock('$lib/services/socket.service', () => import('$lib/mocks/socket.service.mock'));

// Import mocked functions after mocking
import { 
  simulateNewMessage, 
  simulateTypingIndicator, 
  simulateConnectionError 
} from '$lib/mocks/socket.service.mock';

describe('Chat Page', () => {
  beforeEach(() => {
    // Mock page params
    vi.mocked(page).params = { roomId: 'test-room-123' };
    
    // Mock browser environment
    vi.stubGlobal('browser', true);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });
  
  it('should render the chat page', () => {
    const { getByText } = render(ChatPage);
    
    expect(getByText('Chat')).toBeInTheDocument();
  });
  
  it('should display messages', async () => {
    const { findByText } = render(ChatPage);
    
    // Simulate receiving a message
    simulateNewMessage({
      id: 'msg-1',
      roomId: 'test-room-123',
      content: 'Hello from the server!',
      senderId: 'server',
      senderName: 'Server',
      timestamp: new Date().toISOString()
    });
    
    // Check if message is displayed
    const message = await findByText('Hello from the server!');
    expect(message).toBeInTheDocument();
  });
  
  it('should send messages', async () => {
    const { getByPlaceholderText, getByText } = render(ChatPage);
    
    // Type a message
    const input = getByPlaceholderText('メッセージを入力...');
    await fireEvent.input(input, { target: { value: 'Hello, WebSocket!' } });
    
    // Send the message
    const sendButton = getByText('送信');
    await fireEvent.click(sendButton);
    
    // Check if input is cleared
    expect(input.value).toBe('');
    
    // Wait for echo message
    await waitFor(() => {
      expect(getByText('Hello, WebSocket!')).toBeInTheDocument();
    });
  });
  
  it('should show typing indicators', async () => {
    const { findByText } = render(ChatPage);
    
    // Simulate typing indicator
    simulateTypingIndicator({
      roomId: 'test-room-123',
      userId: 'user-456',
      userName: 'Jane Doe',
      isTyping: true
    });
    
    // Check if typing indicator is displayed
    const indicator = await findByText('Jane Doe is typing...');
    expect(indicator).toBeInTheDocument();
  });
  
  it('should handle connection errors', async () => {
    const { findByText } = render(ChatPage);
    
    // Simulate connection error
    simulateConnectionError('接続が切断されました');
    
    // Check if error message is displayed
    const errorMessage = await findByText('接続が切断されました');
    expect(errorMessage).toBeInTheDocument();
  });
});
```

By following these testing approaches, you can ensure that your WebSocket implementations in SvelteKit are robust, reliable, and maintainable.
