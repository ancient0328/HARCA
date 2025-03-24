# SvelteKit 2 Client-Side Features: WebSockets (データ圧縮)

**Document Number**: GUIDE-011F-C10  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [WebSocketのデータ圧縮](#websocketのデータ圧縮)
2. [圧縮の利点](#圧縮の利点)
3. [基本的な圧縮の実装](#基本的な圧縮の実装)
4. [Svelte 5での圧縮実装](#svelte-5での圧縮実装)
5. [圧縮の最適化](#圧縮の最適化)

## WebSocketのデータ圧縮

WebSocketを介して大量のデータを送信する場合、データ圧縮を実装することで帯域幅を節約し、パフォーマンスを向上させることができます。このドキュメントでは、WebSocketメッセージの圧縮方法について説明します。

## 圧縮の利点

- **帯域幅の節約**: 圧縮によりデータサイズが小さくなり、ネットワーク帯域幅の使用量が減少します。
- **レイテンシの低減**: 小さなデータパケットはより速く送信できるため、全体的なレイテンシが低減します。
- **コスト削減**: モバイルデータ通信などでは、データ転送量の削減がコスト削減につながります。
- **スケーラビリティの向上**: サーバーは圧縮されたデータを処理する方が効率的であり、より多くのクライアントをサポートできます。

## 基本的な圧縮の実装

WebSocketメッセージを圧縮するには、一般的にpako.jsなどのライブラリを使用します。以下は、基本的な圧縮の実装例です。

### 1. 依存関係のインストール

```bash
pnpm add pako
```

### 2. 圧縮機能の実装

```javascript
// src/lib/services/websocket-compression.js
import pako from 'pako';

export class WebSocketCompression {
  /**
   * データを圧縮
   * @param {Object|string} data - 圧縮するデータ
   * @returns {Uint8Array} - 圧縮されたデータ
   */
  static compress(data) {
    try {
      // オブジェクトの場合はJSON文字列に変換
      const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
      
      // データを圧縮
      const compressed = pako.deflate(jsonStr);
      
      return compressed;
    } catch (error) {
      console.error('データ圧縮エラー:', error);
      throw error;
    }
  }

  /**
   * 圧縮されたデータを解凍
   * @param {Uint8Array} compressedData - 圧縮されたデータ
   * @param {boolean} parseJson - 解凍後のデータをJSONとしてパースするかどうか
   * @returns {Object|string} - 解凍されたデータ
   */
  static decompress(compressedData, parseJson = true) {
    try {
      // データを解凍
      const decompressed = pako.inflate(compressedData, { to: 'string' });
      
      // JSONとしてパースするかどうか
      if (parseJson) {
        return JSON.parse(decompressed);
      }
      
      return decompressed;
    } catch (error) {
      console.error('データ解凍エラー:', error);
      throw error;
    }
  }

  /**
   * 圧縮率を計算
   * @param {Object|string} originalData - 元のデータ
   * @param {Uint8Array} compressedData - 圧縮されたデータ
   * @returns {Object} - 圧縮に関する情報
   */
  static getCompressionInfo(originalData, compressedData) {
    const originalStr = typeof originalData === 'string' ? originalData : JSON.stringify(originalData);
    const originalSize = originalStr.length;
    const compressedSize = compressedData.length;
    const ratio = (compressedSize / originalSize) * 100;
    const savings = 100 - ratio;
    
    return {
      originalSize,
      compressedSize,
      ratio: ratio.toFixed(2) + '%',
      savings: savings.toFixed(2) + '%'
    };
  }
}
```

### 3. WebSocketサービスとの統合

```javascript
// src/lib/services/websocket-service.js
import { WebSocketCompression } from './websocket-compression';

export class WebSocketService {
  constructor(url, options = {}) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.compressionEnabled = options.compressionEnabled !== false; // デフォルトで有効
    this.compressionThreshold = options.compressionThreshold || 1024; // 1KB以上のメッセージのみ圧縮
    this.listeners = {
      message: [],
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
      try {
        let data = event.data;
        
        // バイナリデータ（圧縮されたデータ）の場合
        if (data instanceof Blob) {
          this.handleCompressedMessage(data);
        } else {
          // 通常のテキストメッセージ
          this.handleTextMessage(data);
        }
      } catch (error) {
        console.error('メッセージ処理エラー:', error);
        // エラーが発生した場合でも、元のメッセージを通知
        this.notifyListeners('message', event);
      }
    };
  }

  /**
   * 圧縮されたメッセージを処理
   * @param {Blob} blob - 圧縮されたデータのBlob
   */
  async handleCompressedMessage(blob) {
    try {
      // BlobをArrayBufferに変換
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // データを解凍
      const decompressedData = WebSocketCompression.decompress(uint8Array);
      
      // 解凍されたデータでイベントを作成
      const event = {
        data: decompressedData,
        originalEvent: { data: blob },
        isDecompressed: true
      };
      
      // リスナーに通知
      this.notifyListeners('message', event);
    } catch (error) {
      console.error('圧縮メッセージの処理エラー:', error);
    }
  }

  /**
   * テキストメッセージを処理
   * @param {string} data - テキストデータ
   */
  handleTextMessage(data) {
    try {
      // JSONの場合はパース
      const parsedData = JSON.parse(data);
      this.notifyListeners('message', { data: parsedData });
    } catch (error) {
      // JSONでない場合は文字列として処理
      this.notifyListeners('message', { data });
    }
  }

  /**
   * メッセージを送信
   * @param {Object|string} message - 送信するメッセージ
   * @param {boolean} forceCompression - 強制的に圧縮するかどうか
   * @returns {boolean} - 送信が成功したかどうか
   */
  send(message, forceCompression = false) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが接続されていないため、メッセージを送信できません');
      return false;
    }

    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      
      // 圧縮するかどうかを決定
      const shouldCompress = this.compressionEnabled && 
        (forceCompression || messageStr.length >= this.compressionThreshold);
      
      if (shouldCompress) {
        // メッセージを圧縮
        const compressed = WebSocketCompression.compress(message);
        
        // 圧縮情報をログ出力
        const info = WebSocketCompression.getCompressionInfo(message, compressed);
        console.log(`メッセージを圧縮しました: ${info.originalSize}バイト → ${info.compressedSize}バイト (${info.savings}節約)`);
        
        // 圧縮データを送信
        this.ws.send(compressed);
      } else {
        // 非圧縮でメッセージを送信
        this.ws.send(messageStr);
      }
      
      return true;
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      return false;
    }
  }

  /**
   * 圧縮を有効化
   * @param {number} threshold - 圧縮するメッセージの最小サイズ（バイト）
   */
  enableCompression(threshold = 1024) {
    this.compressionEnabled = true;
    this.compressionThreshold = threshold;
  }

  /**
   * 圧縮を無効化
   */
  disableCompression() {
    this.compressionEnabled = false;
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
   * @param {string} event - イベント名（message, open, close, error）
   * @param {Function} callback - コールバック関数
   */
  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * イベントリスナーを削除
   * @param {string} event - イベント名（message, open, close, error）
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

## Svelte 5での圧縮実装

Svelte 5のRunes APIを使用すると、WebSocketの圧縮機能をより宣言的に実装できます。

```svelte
<script>
  import { browser } from '$app/environment';
  import pako from 'pako';
  
  // 設定
  let compressionEnabled = $state(true);
  let compressionThreshold = $state(1024); // 1KB以上のメッセージのみ圧縮
  
  // 状態
  let ws = $state(null);
  let connected = $state(false);
  let messages = $state([]);
  let compressionStats = $state({
    original: 0,
    compressed: 0,
    saved: 0
  });
  
  // WebSocket接続を初期化
  function initWebSocket(url) {
    if (!browser) return;
    
    // 既存の接続を閉じる
    closeWebSocket();
    
    // 新しい接続を作成
    ws = new WebSocket(url);
    
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
    
    ws.onmessage = async (event) => {
      try {
        let data = event.data;
        
        // バイナリデータ（圧縮されたデータ）の場合
        if (data instanceof Blob) {
          data = await handleCompressedMessage(data);
        } else {
          // テキストメッセージの場合はJSONとしてパース
          try {
            data = JSON.parse(data);
          } catch {
            // JSONでない場合はそのまま使用
          }
        }
        
        // メッセージを保存
        messages = [...messages, {
          data,
          timestamp: Date.now(),
          compressed: event.data instanceof Blob
        }];
        
        // メッセージ数を制限（最新の100件のみ保持）
        if (messages.length > 100) {
          messages = messages.slice(-100);
        }
      } catch (error) {
        console.error('メッセージ処理エラー:', error);
      }
    };
  }
  
  // 圧縮されたメッセージを処理
  async function handleCompressedMessage(blob) {
    // BlobをArrayBufferに変換
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // データを解凍
    try {
      const decompressed = pako.inflate(uint8Array, { to: 'string' });
      return JSON.parse(decompressed);
    } catch (error) {
      console.error('データ解凍エラー:', error);
      return null;
    }
  }
  
  // メッセージを送信
  function sendMessage(message, forceCompression = false) {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocketが接続されていないため、メッセージを送信できません');
      return false;
    }
    
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      
      // 圧縮するかどうかを決定
      const shouldCompress = compressionEnabled && 
        (forceCompression || messageStr.length >= compressionThreshold);
      
      if (shouldCompress) {
        // メッセージを圧縮
        const compressed = compressData(message);
        
        // 圧縮統計を更新
        updateCompressionStats(messageStr.length, compressed.length);
        
        // 圧縮データを送信
        ws.send(compressed);
      } else {
        // 非圧縮でメッセージを送信
        ws.send(messageStr);
      }
      
      return true;
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      return false;
    }
  }
  
  // データを圧縮
  function compressData(data) {
    // オブジェクトの場合はJSON文字列に変換
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    
    // データを圧縮
    return pako.deflate(jsonStr);
  }
  
  // 圧縮統計を更新
  function updateCompressionStats(originalSize, compressedSize) {
    const saved = originalSize - compressedSize;
    
    compressionStats = {
      original: compressionStats.original + originalSize,
      compressed: compressionStats.compressed + compressedSize,
      saved: compressionStats.saved + saved
    };
  }
  
  // 圧縮を有効化
  function enableCompression(threshold = 1024) {
    compressionEnabled = true;
    compressionThreshold = threshold;
  }
  
  // 圧縮を無効化
  function disableCompression() {
    compressionEnabled = false;
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
  
  // コンポーネントのマウント時に接続
  $effect(() => {
    if (browser) {
      initWebSocket('wss://example.com/ws');
      
      // クリーンアップ関数（コンポーネントのアンマウント時に実行）
      return () => {
        closeWebSocket();
      };
    }
  });
</script>

<div class="websocket-controls">
  <div class="status">
    接続状態: {connected ? '接続済み' : '切断'}
  </div>
  <div class="compression-status">
    圧縮: {compressionEnabled ? '有効' : '無効'}
    <button on:click={compressionEnabled ? disableCompression : enableCompression}>
      {compressionEnabled ? '無効化' : '有効化'}
    </button>
  </div>
  <div class="compression-threshold">
    圧縮しきい値: {compressionThreshold}バイト
    <input 
      type="range" 
      min="100" 
      max="10000" 
      step="100" 
      bind:value={compressionThreshold} 
      disabled={!compressionEnabled}
    />
  </div>
  <div class="compression-stats">
    <h4>圧縮統計</h4>
    <p>元のサイズ: {compressionStats.original}バイト</p>
    <p>圧縮後のサイズ: {compressionStats.compressed}バイト</p>
    <p>節約したサイズ: {compressionStats.saved}バイト</p>
    <p>圧縮率: {compressionStats.original ? ((compressionStats.compressed / compressionStats.original) * 100).toFixed(2) : 0}%</p>
  </div>
</div>
```

## 圧縮の最適化

WebSocketデータの圧縮を最適化するためのいくつかの戦略を以下に示します。

### 1. 適応的な圧縮しきい値

ネットワーク条件に基づいて圧縮しきい値を動的に調整します。

```javascript
// ネットワーク条件に基づいて圧縮しきい値を調整
let networkQuality = 'good'; // 'good', 'medium', 'poor'
const compressionThresholds = {
  good: 2048,    // 良好な接続: 2KB以上のメッセージのみ圧縮
  medium: 1024,  // 中程度の接続: 1KB以上のメッセージのみ圧縮
  poor: 512      // 貧弱な接続: 512バイト以上のメッセージのみ圧縮
};

// ネットワーク品質を評価（簡易版）
function assessNetworkQuality() {
  const latency = getAverageLatency(); // 平均レイテンシーを取得する関数
  
  if (latency < 100) {
    networkQuality = 'good';
  } else if (latency < 300) {
    networkQuality = 'medium';
  } else {
    networkQuality = 'poor';
  }
}

// 現在の圧縮しきい値を取得
function getCurrentCompressionThreshold() {
  return compressionThresholds[networkQuality];
}
```

### 2. 圧縮レベルの調整

データの種類に応じて圧縮レベルを調整します。

```javascript
/**
 * データを圧縮（圧縮レベルを指定）
 * @param {Object|string} data - 圧縮するデータ
 * @param {number} level - 圧縮レベル（1-9、1が最速、9が最高圧縮率）
 * @returns {Uint8Array} - 圧縮されたデータ
 */
function compressWithLevel(data, level = 6) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  return pako.deflate(jsonStr, { level });
}

// データの種類に応じて圧縮レベルを選択
function selectCompressionLevel(data) {
  // テキストデータは高い圧縮率が効果的
  if (typeof data === 'string' && data.length > 1000) {
    return 9; // 最高圧縮率
  }
  
  // 小さなJSONオブジェクトは中程度の圧縮
  if (typeof data === 'object' && JSON.stringify(data).length < 5000) {
    return 6; // デフォルト
  }
  
  // 大きなJSONオブジェクトは速度重視
  return 3; // 速度優先
}
```

### 3. 差分圧縮

連続するメッセージ間の差分のみを送信することで、さらにデータサイズを削減できます。

```javascript
// 前回送信したメッセージ
let lastSentMessage = null;

/**
 * 差分圧縮を使用してメッセージを送信
 * @param {Object} message - 送信するメッセージ
 */
function sendWithDiffCompression(message) {
  if (!lastSentMessage) {
    // 初回送信時は完全なメッセージを送信
    lastSentMessage = message;
    sendMessage({
      type: 'full',
      data: message
    });
    return;
  }
  
  // 差分を計算
  const diff = calculateDiff(lastSentMessage, message);
  
  // 差分のサイズが元のメッセージより小さい場合
  if (JSON.stringify(diff).length < JSON.stringify(message).length * 0.8) {
    sendMessage({
      type: 'diff',
      data: diff
    });
  } else {
    // 差分が大きい場合は完全なメッセージを送信
    sendMessage({
      type: 'full',
      data: message
    });
  }
  
  // 最後に送信したメッセージを更新
  lastSentMessage = message;
}

// 差分を計算する関数（実装例）
function calculateDiff(oldObj, newObj) {
  // 実際の実装ではjsonpatch.jsなどのライブラリを使用
  // ここでは簡易的な実装
  const diff = {};
  
  // 新しいプロパティと変更されたプロパティ
  for (const key in newObj) {
    if (!oldObj.hasOwnProperty(key) || oldObj[key] !== newObj[key]) {
      diff[key] = newObj[key];
    }
  }
  
  // 削除されたプロパティ
  for (const key in oldObj) {
    if (!newObj.hasOwnProperty(key)) {
      diff[key] = null; // nullは削除を意味する
    }
  }
  
  return diff;
}
```

### 4. メッセージ形式の最適化

JSON形式よりも効率的なMessagePack形式を使用することで、さらにデータサイズを削減できます。

```javascript
// MessagePackを使用したシリアライズ/デシリアライズ
import * as msgpack from 'msgpack-lite';

/**
 * MessagePackを使用してデータをシリアライズ
 * @param {Object} data - シリアライズするデータ
 * @returns {Uint8Array} - シリアライズされたデータ
 */
function serializeWithMessagePack(data) {
  return msgpack.encode(data);
}

/**
 * MessagePackでシリアライズされたデータをデシリアライズ
 * @param {Uint8Array} data - デシリアライズするデータ
 * @returns {Object} - デシリアライズされたデータ
 */
function deserializeWithMessagePack(data) {
  return msgpack.decode(data);
}
```

WebSocketデータの圧縮を実装することで、特に大量のデータを送受信するアプリケーションのパフォーマンスを大幅に向上させることができます。
