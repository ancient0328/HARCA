# SvelteKit 2 Client-Side Features: WebSockets (バイナリデータ処理)

**Document Number**: GUIDE-011F-C11  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [WebSocketのバイナリデータ処理](#websocketのバイナリデータ処理)
2. [バイナリデータの送信](#バイナリデータの送信)
3. [バイナリデータの受信](#バイナリデータの受信)
4. [Svelte 5でのバイナリデータ処理](#svelte-5でのバイナリデータ処理)
5. [ユースケース](#ユースケース)

## WebSocketのバイナリデータ処理

WebSocketは、テキストデータだけでなくバイナリデータも効率的に送受信できます。バイナリデータの処理は、画像、音声、動画、ファイルなどのメディアコンテンツを扱うアプリケーションで特に重要です。このドキュメントでは、SvelteKitアプリケーションでのWebSocketバイナリデータの処理方法について説明します。

## バイナリデータの送信

WebSocketを通じてバイナリデータを送信するには、`ArrayBuffer`、`TypedArray`（`Uint8Array`など）、または`Blob`オブジェクトを使用します。

```javascript
// src/lib/services/websocket-binary.js
export class WebSocketBinaryService {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.listeners = {
      message: [],
      binary: [],
      open: [],
      close: [],
      error: []
    };
  }

  /**
   * WebSocket接続を初期化
   */
  connect() {
    if (this.ws) {
      this.disconnect();
    }

    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer'; // バイナリデータ形式を指定
    this.setupEventListeners();
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    this.ws.onopen = (event) => {
      console.log('WebSocket接続が確立されました');
      this.connected = true;
      this.notifyListeners('open', event);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket接続が閉じられました');
      this.connected = false;
      this.notifyListeners('close', event);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocketエラー:', error);
      this.notifyListeners('error', error);
    };

    this.ws.onmessage = (event) => {
      // バイナリデータの場合
      if (event.data instanceof ArrayBuffer) {
        this.notifyListeners('binary', {
          data: event.data,
          type: 'arraybuffer'
        });
      } else {
        // テキストデータの場合
        this.notifyListeners('message', event);
      }
    };
  }

  /**
   * バイナリデータを送信
   * @param {ArrayBuffer|Blob|TypedArray} data - 送信するバイナリデータ
   * @returns {boolean} - 送信が成功したかどうか
   */
  sendBinary(data) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが接続されていないため、データを送信できません');
      return false;
    }

    try {
      this.ws.send(data);
      return true;
    } catch (error) {
      console.error('バイナリデータ送信エラー:', error);
      return false;
    }
  }

  /**
   * ファイルをバイナリデータとして送信
   * @param {File} file - 送信するファイル
   * @returns {Promise<boolean>} - 送信が成功したかどうか
   */
  async sendFile(file) {
    try {
      // ファイルメタデータを送信
      const metaData = {
        type: 'file-meta',
        name: file.name,
        size: file.size,
        mimeType: file.type,
        lastModified: file.lastModified
      };
      
      this.sendText(JSON.stringify(metaData));
      
      // ファイルをArrayBufferとして読み込み
      const arrayBuffer = await file.arrayBuffer();
      
      // バイナリデータを送信
      return this.sendBinary(arrayBuffer);
    } catch (error) {
      console.error('ファイル送信エラー:', error);
      return false;
    }
  }

  /**
   * テキストデータを送信
   * @param {string} text - 送信するテキスト
   * @returns {boolean} - 送信が成功したかどうか
   */
  sendText(text) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが接続されていないため、テキストを送信できません');
      return false;
    }

    try {
      this.ws.send(text);
      return true;
    } catch (error) {
      console.error('テキスト送信エラー:', error);
      return false;
    }
  }

  /**
   * WebSocket接続を閉じる
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * イベントリスナーを追加
   * @param {string} event - イベント名（message, binary, open, close, error）
   * @param {Function} callback - コールバック関数
   */
  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * イベントリスナーを削除
   * @param {string} event - イベント名（message, binary, open, close, error）
   * @param {Function} callback - 削除するコールバック関数
   */
  removeEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * リスナーに通知
   * @param {string} event - イベント名
   * @param {any} data - イベントデータ
   */
  notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`リスナーの実行中にエラーが発生しました (${event}):`, error);
        }
      });
    }
  }
}
```

## バイナリデータの受信

WebSocketから受信したバイナリデータを処理するには、データの種類に応じて適切な変換を行います。

```javascript
// バイナリデータの処理ユーティリティ
export class BinaryUtils {
  /**
   * ArrayBufferをBlobに変換
   * @param {ArrayBuffer} buffer - 変換するArrayBuffer
   * @param {string} mimeType - MIMEタイプ
   * @returns {Blob} - 変換されたBlob
   */
  static arrayBufferToBlob(buffer, mimeType = 'application/octet-stream') {
    return new Blob([buffer], { type: mimeType });
  }

  /**
   * ArrayBufferをBase64文字列に変換
   * @param {ArrayBuffer} buffer - 変換するArrayBuffer
   * @returns {string} - Base64文字列
   */
  static arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return window.btoa(binary);
  }

  /**
   * Base64文字列をArrayBufferに変換
   * @param {string} base64 - 変換するBase64文字列
   * @returns {ArrayBuffer} - 変換されたArrayBuffer
   */
  static base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
  }

  /**
   * ArrayBufferを画像URLに変換
   * @param {ArrayBuffer} buffer - 変換するArrayBuffer
   * @param {string} mimeType - 画像のMIMEタイプ
   * @returns {string} - 画像のURL
   */
  static arrayBufferToImageUrl(buffer, mimeType = 'image/png') {
    const blob = new Blob([buffer], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * ArrayBufferをテキストに変換
   * @param {ArrayBuffer} buffer - 変換するArrayBuffer
   * @param {string} encoding - エンコーディング
   * @returns {string} - 変換されたテキスト
   */
  static arrayBufferToText(buffer, encoding = 'utf-8') {
    return new TextDecoder(encoding).decode(buffer);
  }

  /**
   * テキストをArrayBufferに変換
   * @param {string} text - 変換するテキスト
   * @param {string} encoding - エンコーディング
   * @returns {ArrayBuffer} - 変換されたArrayBuffer
   */
  static textToArrayBuffer(text, encoding = 'utf-8') {
    return new TextEncoder(encoding).encode(text).buffer;
  }

  /**
   * ArrayBufferをJSONオブジェクトに変換
   * @param {ArrayBuffer} buffer - 変換するArrayBuffer
   * @returns {Object} - 変換されたJSONオブジェクト
   */
  static arrayBufferToJson(buffer) {
    const text = new TextDecoder('utf-8').decode(buffer);
    return JSON.parse(text);
  }

  /**
   * BlobをArrayBufferに変換
   * @param {Blob} blob - 変換するBlob
   * @returns {Promise<ArrayBuffer>} - 変換されたArrayBuffer
   */
  static async blobToArrayBuffer(blob) {
    return await blob.arrayBuffer();
  }

  /**
   * ファイルをArrayBufferに変換
   * @param {File} file - 変換するファイル
   * @returns {Promise<ArrayBuffer>} - 変換されたArrayBuffer
   */
  static async fileToArrayBuffer(file) {
    return await file.arrayBuffer();
  }
}
```

## バイナリデータの使用例

```javascript
// WebSocketバイナリサービスの使用例
import { WebSocketBinaryService, BinaryUtils } from '$lib/services/websocket-binary';

// WebSocketサービスを初期化
const wsService = new WebSocketBinaryService('wss://example.com/ws');

// 接続
wsService.connect();

// バイナリデータのリスナーを追加
wsService.addEventListener('binary', async (event) => {
  const { data, type } = event;
  
  // ArrayBufferを処理
  if (type === 'arraybuffer') {
    try {
      // JSONデータの場合
      const jsonData = BinaryUtils.arrayBufferToJson(data);
      console.log('受信したJSONデータ:', jsonData);
    } catch (error) {
      // JSONでない場合は画像として処理
      const imageUrl = BinaryUtils.arrayBufferToImageUrl(data);
      console.log('受信した画像URL:', imageUrl);
      
      // 画像要素に表示
      const imageElement = document.getElementById('received-image');
      if (imageElement) {
        imageElement.src = imageUrl;
      }
    }
  }
});

// 画像を送信
async function sendImage(imageFile) {
  await wsService.sendFile(imageFile);
}

// テキストデータのリスナーを追加
wsService.addEventListener('message', (event) => {
  console.log('受信したテキストメッセージ:', event.data);
});

// クリーンアップ
function cleanup() {
  wsService.disconnect();
}
```

## Svelte 5でのバイナリデータ処理

Svelte 5のRunes APIを使用すると、WebSocketのバイナリデータ処理をより宣言的に実装できます。

```svelte
<script>
  import { browser } from '$app/environment';
  import { BinaryUtils } from '$lib/services/websocket-binary';
  
  // 状態
  let ws = $state(null);
  let connected = $state(false);
  let binaryType = $state('arraybuffer'); // 'arraybuffer' または 'blob'
  let receivedImages = $state([]);
  let receivedFiles = $state([]);
  
  // WebSocket接続を初期化
  function initWebSocket(url) {
    if (!browser) return;
    
    // 既存の接続を閉じる
    closeWebSocket();
    
    // 新しい接続を作成
    ws = new WebSocket(url);
    ws.binaryType = binaryType;
    
    // イベントハンドラを設定
    ws.onopen = () => {
      connected = true;
    };
    
    ws.onclose = () => {
      connected = false;
    };
    
    ws.onerror = (error) => {
      console.error('WebSocketエラー:', error);
    };
    
    ws.onmessage = (event) => {
      processReceivedData(event.data);
    };
  }
  
  // 受信したデータを処理
  function processReceivedData(data) {
    // バイナリデータの場合
    if (data instanceof ArrayBuffer) {
      processArrayBuffer(data);
    } else if (data instanceof Blob) {
      processBlob(data);
    } else {
      // テキストデータの場合
      processTextData(data);
    }
  }
  
  // ArrayBufferを処理
  function processArrayBuffer(buffer) {
    try {
      // JSONとしてパースを試みる
      const jsonData = BinaryUtils.arrayBufferToJson(buffer);
      console.log('受信したJSONデータ:', jsonData);
    } catch (error) {
      // JSONでない場合は画像として処理
      const imageUrl = BinaryUtils.arrayBufferToImageUrl(buffer);
      
      receivedImages = [...receivedImages, {
        url: imageUrl,
        timestamp: Date.now()
      }];
    }
  }
  
  // Blobを処理
  async function processBlob(blob) {
    // ファイルとして処理
    const fileName = `received-file-${Date.now()}`;
    const fileUrl = URL.createObjectURL(blob);
    
    receivedFiles = [...receivedFiles, {
      name: fileName,
      url: fileUrl,
      type: blob.type,
      size: blob.size,
      timestamp: Date.now()
    }];
  }
  
  // テキストデータを処理
  function processTextData(text) {
    try {
      const data = JSON.parse(text);
      
      // ファイルメタデータの場合
      if (data.type === 'file-meta') {
        console.log('ファイルメタデータを受信:', data);
      }
    } catch (error) {
      // JSONでない場合は通常のテキストとして処理
      console.log('テキストメッセージを受信:', text);
    }
  }
  
  // バイナリデータを送信
  function sendBinary(data) {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが接続されていないため、データを送信できません');
      return false;
    }
    
    try {
      ws.send(data);
      return true;
    } catch (error) {
      console.error('バイナリデータ送信エラー:', error);
      return false;
    }
  }
  
  // ファイルを送信
  async function sendFile(file) {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが接続されていないため、ファイルを送信できません');
      return false;
    }
    
    try {
      // ファイルメタデータを送信
      const metaData = {
        type: 'file-meta',
        name: file.name,
        size: file.size,
        mimeType: file.type,
        lastModified: file.lastModified
      };
      
      ws.send(JSON.stringify(metaData));
      
      // ファイルをArrayBufferとして読み込み
      const arrayBuffer = await file.arrayBuffer();
      
      // バイナリデータを送信
      return sendBinary(arrayBuffer);
    } catch (error) {
      console.error('ファイル送信エラー:', error);
      return false;
    }
  }
  
  // 画像をキャンバスから送信
  function sendCanvasImage(canvas, format = 'image/png', quality = 0.9) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error('キャンバスからBlobを作成できませんでした'));
              return;
            }
            
            const arrayBuffer = await blob.arrayBuffer();
            const success = sendBinary(arrayBuffer);
            resolve(success);
          },
          format,
          quality
        );
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // バイナリタイプを切り替え
  function toggleBinaryType() {
    binaryType = binaryType === 'arraybuffer' ? 'blob' : 'arraybuffer';
    
    if (ws) {
      ws.binaryType = binaryType;
    }
  }
  
  // WebSocket接続を閉じる
  function closeWebSocket() {
    if (ws) {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      
      ws = null;
      connected = false;
    }
  }
  
  // ファイル選択ハンドラ
  async function handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    for (const file of files) {
      await sendFile(file);
    }
  }
  
  // コンポーネントのマウント時に接続
  $effect(() => {
    if (browser) {
      initWebSocket('wss://example.com/ws');
      
      // クリーンアップ関数（コンポーネントのアンマウント時に実行）
      return () => {
        closeWebSocket();
        
        // 作成したURLを解放
        receivedImages.forEach(image => {
          URL.revokeObjectURL(image.url);
        });
        
        receivedFiles.forEach(file => {
          URL.revokeObjectURL(file.url);
        });
      };
    }
  });
</script>

<div class="websocket-binary">
  <div class="controls">
    <div class="status">
      接続状態: {connected ? '接続済み' : '切断'}
    </div>
    <div class="binary-type">
      バイナリタイプ: {binaryType}
      <button on:click={toggleBinaryType}>
        切り替え
      </button>
    </div>
    <div class="file-upload">
      <label for="file-input">ファイルを送信:</label>
      <input 
        id="file-input" 
        type="file" 
        on:change={handleFileSelect} 
        multiple 
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
      />
    </div>
  </div>
  
  {#if receivedImages.length > 0}
    <div class="received-images">
      <h3>受信した画像</h3>
      <div class="image-grid">
        {#each receivedImages as image (image.timestamp)}
          <div class="image-item">
            <img src={image.url} alt="受信した画像" />
            <div class="timestamp">
              {new Date(image.timestamp).toLocaleTimeString()}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
  
  {#if receivedFiles.length > 0}
    <div class="received-files">
      <h3>受信したファイル</h3>
      <ul class="file-list">
        {#each receivedFiles as file (file.timestamp)}
          <li class="file-item">
            <a href={file.url} download={file.name} target="_blank">
              {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </a>
            <div class="file-type">{file.type}</div>
            <div class="timestamp">
              {new Date(file.timestamp).toLocaleTimeString()}
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .websocket-binary {
    margin-bottom: 2rem;
  }
  
  .controls {
    margin-bottom: 1rem;
  }
  
  .status, .binary-type, .file-upload {
    margin-bottom: 0.5rem;
  }
  
  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }
  
  .image-item {
    border: 1px solid #ddd;
    padding: 0.5rem;
    border-radius: 4px;
  }
  
  .image-item img {
    width: 100%;
    height: auto;
    object-fit: cover;
  }
  
  .file-list {
    list-style: none;
    padding: 0;
  }
  
  .file-item {
    border: 1px solid #ddd;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    border-radius: 4px;
  }
  
  .timestamp {
    font-size: 0.8rem;
    color: #666;
    margin-top: 0.25rem;
  }
  
  .file-type {
    font-size: 0.8rem;
    color: #666;
  }
</style>
```

## ユースケース

WebSocketのバイナリデータ処理は、以下のようなユースケースで特に有用です。

### 1. リアルタイム画像共有

医療相談アプリケーションでは、医師が患者の症状の画像をリアルタイムで共有し、診断に役立てることができます。

```javascript
// 画像キャプチャと送信
async function captureAndSendImage() {
  const video = document.getElementById('camera-feed');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // キャンバスの画像をWebSocketで送信
  await sendCanvasImage(canvas);
}
```

### 2. ファイル転送

チャットアプリケーションでは、ユーザーがファイルを直接WebSocketを通じて送信できます。

```javascript
// ファイルドロップ領域
function setupFileDropZone(element) {
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    element.classList.add('dragover');
  });
  
  element.addEventListener('dragleave', () => {
    element.classList.remove('dragover');
  });
  
  element.addEventListener('drop', async (e) => {
    e.preventDefault();
    element.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    for (const file of files) {
      await sendFile(file);
    }
  });
}
```

### 3. オーディオストリーミング

音声チャットアプリケーションでは、音声データをバイナリとしてリアルタイムで送信できます。

```javascript
// 音声ストリーミング
let audioContext;
let mediaStream;
let processor;

async function startAudioStreaming() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    
    const source = audioContext.createMediaStreamSource(mediaStream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      const audioData = e.inputBuffer.getChannelData(0);
      sendBinary(audioData.buffer);
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
  } catch (error) {
    console.error('音声ストリーミングエラー:', error);
  }
}

function stopAudioStreaming() {
  if (processor) {
    processor.disconnect();
    processor = null;
  }
  
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}
```

### 4. キャンバス描画の同期

複数のユーザーが同じキャンバスに描画するコラボレーションツールでは、描画データをバイナリとして効率的に送信できます。

```javascript
// キャンバス描画の同期
let drawingCanvas;
let ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

function setupDrawingCanvas(canvas) {
  drawingCanvas = canvas;
  ctx = canvas.getContext('2d');
  
  // 描画イベントを設定
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  // WebSocketからの描画データを処理
  wsService.addEventListener('binary', (event) => {
    const { data } = event;
    const drawingData = new Float32Array(data);
    
    // 描画データを適用
    applyDrawingData(drawingData);
  });
}

function startDrawing(e) {
  isDrawing = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
}

function draw(e) {
  if (!isDrawing) return;
  
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  
  // 描画データを送信
  const drawingData = new Float32Array([lastX, lastY, e.offsetX, e.offsetY]);
  sendBinary(drawingData.buffer);
  
  [lastX, lastY] = [e.offsetX, e.offsetY];
}

function stopDrawing() {
  isDrawing = false;
}

function applyDrawingData(drawingData) {
  const [fromX, fromY, toX, toY] = drawingData;
  
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}
```

WebSocketのバイナリデータ処理を実装することで、テキストベースの通信では難しいリッチなリアルタイムアプリケーションを構築できます。
