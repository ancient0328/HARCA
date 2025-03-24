// features/vector-store/local-model.js - ローカル埋め込みモデル
// 注: このモジュールを使用するには追加の依存関係のインストールが必要です
// npm install @tensorflow/tfjs-node @tensorflow-models/universal-sentence-encoder
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESモジュールで__dirnameを取得するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の読み込み
dotenv.config();

/**
 * ローカル埋め込みモデル
 * TensorFlow.jsとUniversal Sentence Encoderを使用した埋め込みモデル
 */
class LocalEmbeddingModel {
  /**
   * ローカル埋め込みモデルの初期化
   * @param {Object} config - 設定オブジェクト
   */
  constructor(config = {}) {
    // モデル設定
    this.model = null;
    this.initialized = false;
    this.initPromise = null;
    this.dimensions = config.dimensions || 512; // デフォルトのUSE次元数
    this.targetDimensions = config.targetDimensions || 1536; // 変換後の次元数
    
    // エラーハンドリング設定
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000; // ミリ秒
    
    // エラーログ
    this.errorLog = [];
    this.maxErrorLogSize = config.maxErrorLogSize || 100;
    
    // 依存関係の動的ロード
    this.loadDependencies();
  }
  
  /**
   * 依存関係を動的にロードする
   */
  async loadDependencies() {
    try {
      this.tf = await import('@tensorflow/tfjs-node');
      this.use = await import('@tensorflow-models/universal-sentence-encoder');
      this.initPromise = this.initialize();
    } catch (error) {
      console.error('TensorFlow依存関係のロードに失敗しました:', error.message);
      console.warn('ローカル埋め込みモデルを使用するには、以下のパッケージをインストールしてください:');
      console.warn('npm install @tensorflow/tfjs-node @tensorflow-models/universal-sentence-encoder');
      
      // エラーログに記録
      this.logError(error, 'モデル初期化');
    }
  }
  
  /**
   * モデル初期化
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;
    
    if (!this.tf || !this.use) {
      const error = new Error('TensorFlow依存関係が利用できません');
      this.logError(error, 'モデル初期化');
      throw error;
    }
    
    try {
      console.log('Universal Sentence Encoderモデルをロード中...');
      this.model = await this.use.load();
      this.initialized = true;
      console.log('Universal Sentence Encoderモデルが正常にロードされました');
    } catch (error) {
      console.error('埋め込みモデルのロードに失敗しました:', error.message);
      this.logError(error, 'モデル初期化');
      throw error;
    }
  }
  
  /**
   * テキストから埋め込みベクトルを生成
   * @param {string} text - 埋め込みを生成するテキスト
   * @returns {Promise<Array<number>>} - 埋め込みベクトル
   */
  async embed(text) {
    // テキストが空の場合はゼロベクトルを返す
    if (!text || text.trim() === '') {
      return new Array(this.targetDimensions).fill(0);
    }
    
    try {
      // モデル初期化の確認
      if (!this.initialized) {
        if (!this.initPromise) {
          throw new Error('モデル初期化に失敗しました');
        }
        await this.initPromise;
      }
      
      // テキストが長すぎる場合は分割して処理
      if (text.length > 5000) {
        return await this.embedLongText(text);
      }
      
      // リトライロジックを使用して埋め込みを生成
      return await this.embedWithRetry(text);
    } catch (error) {
      console.error('ローカル埋め込み生成中にエラーが発生しました:', error.message);
      this.logError(error, text);
      
      // エラーが発生した場合はランダムベクトルを返す
      return this.generateRandomVector();
    }
  }
  
  /**
   * リトライロジックを使用して埋め込みを生成
   * @param {string} text - 埋め込みを生成するテキスト
   * @param {number} retryCount - 現在のリトライ回数
   * @returns {Promise<Array<number>>} - 埋め込みベクトル
   */
  async embedWithRetry(text, retryCount = 0) {
    try {
      // 埋め込み生成
      const embeddings = await this.model.embed([text]);
      const result = await embeddings.array();
      
      // 次元変換（必要な場合）
      if (result[0].length !== this.targetDimensions) {
        return this.convertDimensions(result[0], this.targetDimensions);
      }
      
      return result[0];
    } catch (error) {
      // エラーログに記録
      this.logError(error, text);
      
      // リトライ可能なエラーかどうかを確認
      if (this.isRetryableError(error) && retryCount < this.maxRetries) {
        // 次のリトライまでの待機時間を計算
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.warn(`埋め込み生成中にエラーが発生しました。${delay}ms後にリトライします (${retryCount + 1}/${this.maxRetries})`);
        
        // 指定時間待機
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // リトライ
        return this.embedWithRetry(text, retryCount + 1);
      }
      
      // リトライ回数を超えた場合やリトライ不可能なエラーの場合
      throw error;
    }
  }
  
  /**
   * 長いテキストを分割して埋め込みを生成し、平均化
   * @param {string} text - 長いテキスト
   * @returns {Promise<Array<number>>} - 平均化された埋め込みベクトル
   */
  async embedLongText(text) {
    try {
      // テキストをチャンクに分割
      const chunks = this.splitTextIntoChunks(text);
      console.log(`テキストを ${chunks.length} チャンクに分割しました`);
      
      // 各チャンクの埋め込みを生成
      const embeddings = [];
      for (let i = 0; i < chunks.length; i++) {
        try {
          console.log(`チャンク ${i + 1}/${chunks.length} の埋め込みを生成中...`);
          const embedding = await this.embedWithRetry(chunks[i]);
          embeddings.push(embedding);
        } catch (error) {
          console.error(`チャンク ${i + 1} の埋め込み生成に失敗しました:`, error.message);
          // エラーが発生しても処理を続行し、成功したチャンクの埋め込みを使用
        }
      }
      
      // 埋め込みが1つも生成できなかった場合はエラー
      if (embeddings.length === 0) {
        throw new Error('すべてのテキストチャンクの埋め込み生成に失敗しました');
      }
      
      // 埋め込みを平均化
      return this.averageEmbeddings(embeddings);
    } catch (error) {
      console.error('長いテキストの埋め込み生成に失敗しました:', error.message);
      this.logError(error, text);
      
      // エラーが発生した場合はランダムベクトルを返す
      return this.generateRandomVector();
    }
  }
  
  /**
   * テキストをチャンクに分割
   * @param {string} text - 分割するテキスト
   * @returns {Array<string>} - テキストチャンクの配列
   */
  splitTextIntoChunks(text) {
    // テキストを約1000文字のチャンクに分割
    const chunks = [];
    let currentChunk = '';
    
    const sentences = text.split(/[.!?]/g);
    for (const sentence of sentences) {
      if (sentence.trim().length === 0) continue;
      
      if (currentChunk.length + sentence.length > 1000) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * 複数の埋め込みベクトルを平均化
   * @param {Array<Array<number>>} embeddings - 埋め込みベクトルの配列
   * @returns {Array<number>} - 平均化された埋め込みベクトル
   */
  averageEmbeddings(embeddings) {
    if (embeddings.length === 0) {
      return new Array(this.targetDimensions).fill(0);
    }
    
    if (embeddings.length === 1) {
      return embeddings[0];
    }
    
    // すべての埋め込みの各次元の平均を計算
    const result = new Array(embeddings[0].length).fill(0);
    for (const embedding of embeddings) {
      for (let i = 0; i < embedding.length; i++) {
        result[i] += embedding[i] / embeddings.length;
      }
    }
    
    // 正規化
    return this.normalizeVector(result);
  }
  
  /**
   * ベクトルを正規化（長さを1に）
   * @param {Array<number>} vector - 正規化するベクトル
   * @returns {Array<number>} - 正規化されたベクトル
   */
  normalizeVector(vector) {
    // ベクトルの長さ（ノルム）を計算
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    // ゼロベクトルまたは非常に小さいベクトルの場合はランダムベクトルを生成
    if (norm < 1e-10) {
      return this.generateRandomVector();
    }
    
    // 各要素をノルムで割って正規化し、NaN値を0に置換
    const normalizedVector = vector.map(val => {
      const normalizedVal = val / norm;
      return isNaN(normalizedVal) ? 0 : normalizedVal;
    });
    
    return normalizedVector;
  }
  
  /**
   * ベクトルの次元変換
   * @param {Array<number>} vector - 変換するベクトル
   * @param {number} targetDim - 目標次元数
   * @returns {Array<number>} - 変換されたベクトル
   */
  convertDimensions(vector, targetDim = 1536) {
    if (vector.length === targetDim) return vector;
    
    // 単純な繰り返しによる次元拡張
    if (vector.length < targetDim) {
      const repeats = Math.ceil(targetDim / vector.length);
      const expanded = [];
      
      for (let i = 0; i < repeats; i++) {
        expanded.push(...vector);
      }
      
      return expanded.slice(0, targetDim);
    }
    
    // 次元削減（単純なサンプリング）
    const step = vector.length / targetDim;
    const reduced = [];
    
    for (let i = 0; i < targetDim; i++) {
      const idx = Math.floor(i * step);
      reduced.push(vector[idx]);
    }
    
    return reduced;
  }
  
  /**
   * ランダムベクトルの生成（最終的なフォールバック）
   * @returns {Array<number>} - 正規化されたランダムベクトル
   */
  generateRandomVector() {
    console.log('フォールバック: ランダムベクトルを生成します');
    
    const vector = new Array(this.targetDimensions).fill(0);
    
    // ランダム値の生成
    for (let i = 0; i < vector.length; i++) {
      vector[i] = (Math.random() * 2) - 1; // -1〜1の範囲
    }
    
    // ベクトルの正規化
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    for (let i = 0; i < vector.length; i++) {
      vector[i] = vector[i] / magnitude;
    }
    
    return vector;
  }
  
  /**
   * エラーがリトライ可能かどうかを判定
   * @param {Error} error - 発生したエラー
   * @returns {boolean} - リトライ可能な場合はtrue
   */
  isRetryableError(error) {
    // TensorFlow特有のエラーでリトライ可能なもの
    if (error.message && (
      error.message.includes('memory') ||
      error.message.includes('resource') ||
      error.message.includes('timeout') ||
      error.message.includes('failed to fetch') ||
      error.message.includes('network')
    )) {
      return true;
    }
    
    return false;
  }
  
  /**
   * エラーをログに記録
   * @param {Error} error - 発生したエラー
   * @param {string} context - エラーが発生したコンテキスト
   */
  logError(error, context) {
    // エラーログのサイズ制限
    if (this.errorLog.length >= this.maxErrorLogSize) {
      this.errorLog.shift(); // 最も古いエラーを削除
    }
    
    // エラー情報を記録
    this.errorLog.push({
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context: typeof context === 'string' && context.length > 100 
        ? `${context.substring(0, 100)}...` 
        : context
    });
  }
  
  /**
   * エラーログを取得
   * @returns {Array<Object>} - エラーログ
   */
  getErrorLog() {
    return this.errorLog;
  }
  
  /**
   * エラーログをクリア
   */
  clearErrorLog() {
    this.errorLog = [];
  }
}

export { LocalEmbeddingModel };
