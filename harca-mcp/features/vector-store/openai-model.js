// features/vector-store/openai-model.js - OpenAI APIを使用した埋め込みモデル
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { ModelManager } from './model-manager.js';

// 環境変数の読み込み
dotenv.config();

/**
 * OpenAI APIを使用した埋め込みモデル
 * テキストから高品質な埋め込みベクトルを生成
 */
class OpenAIEmbeddingModel {
  /**
   * OpenAI埋め込みモデルの初期化
   * @param {Object} config - 設定オブジェクト
   */
  constructor(config = {}) {
    // OpenAI APIクライアントの初期化
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // モデルマネージャーの初期化
    this.modelManager = new ModelManager();
    
    // 使用するモデルの設定
    this.modelId = config.modelId || process.env.OPENAI_EMBEDDING_MODEL || 'openai-ada-002';
    const modelInfo = this.modelManager.getModelInfo(this.modelId);
    
    if (!modelInfo || modelInfo.provider !== 'openai') {
      console.warn(`指定されたモデル ${this.modelId} は無効です。デフォルトモデルを使用します。`);
      this.modelId = 'openai-ada-002';
    }
    
    this.model = this.modelManager.getModelInfo(this.modelId).name;
    this.dimensions = this.modelManager.getModelInfo(this.modelId).dimensions;
    
    // リトライ設定
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000; // ミリ秒
    this.useExponentialBackoff = config.useExponentialBackoff !== false;
    
    // エラーログ
    this.errorLog = [];
    this.maxErrorLogSize = config.maxErrorLogSize || 100;
    
    console.log(`OpenAI埋め込みモデルを初期化しました: ${this.model} (${this.dimensions}次元)`);
  }
  
  /**
   * テキストから埋め込みベクトルを生成
   * @param {string} text - 埋め込みを生成するテキスト
   * @returns {Promise<Array<number>>} - 埋め込みベクトル
   */
  async embed(text) {
    // テキストが空の場合はゼロベクトルを返す
    if (!text || text.trim() === '') {
      return new Array(this.dimensions).fill(0);
    }
    
    // テキストが長すぎる場合は分割して処理
    const maxTokens = 8000; // OpenAIの制限に近い値
    if (this.estimateTokens(text) > maxTokens) {
      return this.embedLongText(text, maxTokens);
    }
    
    // リトライロジックを使用してAPIリクエスト
    return this.embedWithRetry(text);
  }
  
  /**
   * リトライロジックを使用して埋め込みを生成
   * @param {string} text - 埋め込みを生成するテキスト
   * @param {number} retryCount - 現在のリトライ回数
   * @returns {Promise<Array<number>>} - 埋め込みベクトル
   */
  async embedWithRetry(text, retryCount = 0) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text
      });
      
      return response.data[0].embedding;
    } catch (error) {
      // エラーログに記録
      this.logError(error, text);
      
      // リトライ可能なエラーかどうかを確認
      if (this.isRetryableError(error) && retryCount < this.maxRetries) {
        // 次のリトライまでの待機時間を計算
        const delay = this.calculateRetryDelay(retryCount);
        console.warn(`埋め込み生成中にエラーが発生しました。${delay}ms後にリトライします (${retryCount + 1}/${this.maxRetries})`);
        
        // 指定時間待機
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // リトライ
        return this.embedWithRetry(text, retryCount + 1);
      }
      
      // リトライ回数を超えた場合やリトライ不可能なエラーの場合
      console.error('埋め込み生成に失敗しました:', error.message);
      throw new Error(`OpenAI埋め込み生成エラー: ${error.message}`);
    }
  }
  
  /**
   * 長いテキストを分割して埋め込みを生成し、平均化
   * @param {string} text - 長いテキスト
   * @param {number} maxTokens - チャンクあたりの最大トークン数
   * @returns {Promise<Array<number>>} - 平均化された埋め込みベクトル
   */
  async embedLongText(text, maxTokens) {
    // テキストをチャンクに分割
    const chunks = this.splitTextIntoChunks(text, maxTokens);
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
  }
  
  /**
   * 複数の埋め込みベクトルを平均化
   * @param {Array<Array<number>>} embeddings - 埋め込みベクトルの配列
   * @returns {Array<number>} - 平均化された埋め込みベクトル
   */
  averageEmbeddings(embeddings) {
    if (embeddings.length === 0) {
      return new Array(this.dimensions).fill(0);
    }
    
    if (embeddings.length === 1) {
      return embeddings[0];
    }
    
    // すべての埋め込みの各次元の平均を計算
    const result = new Array(this.dimensions).fill(0);
    for (const embedding of embeddings) {
      for (let i = 0; i < this.dimensions; i++) {
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
    
    // ゼロベクトルの場合はそのまま返す
    if (norm === 0) {
      return vector;
    }
    
    // 各要素をノルムで割って正規化
    return vector.map(val => val / norm);
  }
  
  /**
   * テキストをトークン数に基づいて分割
   * @param {string} text - 分割するテキスト
   * @param {number} maxTokens - チャンクあたりの最大トークン数
   * @returns {Array<string>} - テキストチャンクの配列
   */
  splitTextIntoChunks(text, maxTokens) {
    // 簡易的なトークン数推定に基づいて分割
    const words = text.split(/\s+/);
    const chunks = [];
    let currentChunk = [];
    let currentTokenCount = 0;
    
    for (const word of words) {
      const wordTokens = this.estimateTokens(word);
      
      if (currentTokenCount + wordTokens > maxTokens && currentChunk.length > 0) {
        // 現在のチャンクが最大トークン数を超える場合、新しいチャンクを開始
        chunks.push(currentChunk.join(' '));
        currentChunk = [word];
        currentTokenCount = wordTokens;
      } else {
        // 現在のチャンクに単語を追加
        currentChunk.push(word);
        currentTokenCount += wordTokens;
      }
    }
    
    // 最後のチャンクを追加
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }
    
    return chunks;
  }
  
  /**
   * テキストのトークン数を簡易的に推定
   * @param {string} text - 推定するテキスト
   * @returns {number} - 推定トークン数
   */
  estimateTokens(text) {
    // 簡易的な推定: 平均的に4文字で1トークン
    return Math.ceil(text.length / 4);
  }
  
  /**
   * エラーがリトライ可能かどうかを判定
   * @param {Error} error - 発生したエラー
   * @returns {boolean} - リトライ可能な場合はtrue
   */
  isRetryableError(error) {
    // レート制限エラー
    if (this.isRateLimitError(error)) {
      return true;
    }
    
    // サーバーエラー（5xx）
    if (this.isServerError(error)) {
      return true;
    }
    
    // 一時的なネットワークエラー
    if (this.isNetworkError(error)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * レート制限エラーかどうかを判定
   * @param {Error} error - 発生したエラー
   * @returns {boolean} - レート制限エラーの場合はtrue
   */
  isRateLimitError(error) {
    // OpenAIのエラーオブジェクト構造に基づいた詳細な検出
    return (
      (error.status === 429) ||
      (error.response && error.response.status === 429) ||
      (error.error && typeof error.error === 'object' && error.error.type === 'rate_limit_exceeded') ||
      (error.message && typeof error.message === 'string' && error.message.includes('rate limit')) ||
      (error.error && typeof error.error === 'string' && error.error.includes('rate limit'))
    );
  }
  
  /**
   * サーバーエラー（5xx）かどうかを判定
   * @param {Error} error - 発生したエラー
   * @returns {boolean} - サーバーエラーの場合はtrue
   */
  isServerError(error) {
    return (
      (error.status && error.status >= 500 && error.status < 600) ||
      (error.response && error.response.status >= 500 && error.response.status < 600)
    );
  }
  
  /**
   * ネットワークエラーかどうかを判定
   * @param {Error} error - 発生したエラー
   * @returns {boolean} - ネットワークエラーの場合はtrue
   */
  isNetworkError(error) {
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ESOCKETTIMEDOUT' ||
      error.code === 'ECONNREFUSED' ||
      (error.message && (
        error.message.includes('network') ||
        error.message.includes('connection') ||
        error.message.includes('timeout')
      ))
    );
  }
  
  /**
   * リトライ待機時間を計算
   * @param {number} retryCount - 現在のリトライ回数
   * @returns {number} - 待機時間（ミリ秒）
   */
  calculateRetryDelay(retryCount) {
    if (this.useExponentialBackoff) {
      // 指数バックオフ: 基本待機時間 * 2^リトライ回数 + ランダム要素
      return this.retryDelay * Math.pow(2, retryCount) + Math.random() * 1000;
    } else {
      // 固定待機時間 + ランダム要素
      return this.retryDelay + Math.random() * 1000;
    }
  }
  
  /**
   * エラーをログに記録
   * @param {Error} error - 発生したエラー
   * @param {string} text - エラーが発生したテキスト
   */
  logError(error, text) {
    // エラーログのサイズ制限
    if (this.errorLog.length >= this.maxErrorLogSize) {
      this.errorLog.shift(); // 最も古いエラーを削除
    }
    
    // エラー情報を記録
    this.errorLog.push({
      timestamp: new Date().toISOString(),
      message: error.message,
      status: error.status || (error.response && error.response.status),
      type: error.type || (error.error && error.error.type),
      code: error.code,
      textSample: text.length > 100 ? `${text.substring(0, 100)}...` : text
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
  
  /**
   * 使用可能なOpenAIモデルのリストを取得
   * @returns {Array<string>} - モデルIDのリスト
   */
  getAvailableModels() {
    return this.modelManager.getModelsByProvider('openai');
  }
  
  /**
   * 現在のモデルを変更
   * @param {string} modelId - 新しいモデルID
   * @returns {boolean} - 変更が成功したかどうか
   */
  setModel(modelId) {
    const modelInfo = this.modelManager.getModelInfo(modelId);
    
    if (!modelInfo || modelInfo.provider !== 'openai') {
      console.error(`モデル ${modelId} は無効なOpenAIモデルです`);
      return false;
    }
    
    this.modelId = modelId;
    this.model = modelInfo.name;
    this.dimensions = modelInfo.dimensions;
    
    console.log(`OpenAI埋め込みモデルを変更しました: ${this.model} (${this.dimensions}次元)`);
    return true;
  }
}

export { OpenAIEmbeddingModel };
