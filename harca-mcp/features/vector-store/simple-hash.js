// features/vector-store/simple-hash.js - シンプルなハッシュベースの埋め込みモデル
import crypto from 'crypto';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

/**
 * シンプルなハッシュベースの埋め込みモデル
 * APIキーが不要で常に利用可能なフォールバックモデル
 */
class SimpleHashEmbeddingModel {
  /**
   * シンプルハッシュモデルの初期化
   * @param {Object} config - 設定オブジェクト
   */
  constructor(config = {}) {
    // 次元数（OpenAIモデルと互換性を持たせるため1536がデフォルト）
    this.dimensions = config.dimensions || 1536;
    
    // トークン化設定
    this.maxTokens = config.maxTokens || 8000;
    this.tokenizationMethod = config.tokenizationMethod || 'simple';
    
    // エラーログ
    this.errorLog = [];
    this.maxErrorLogSize = config.maxErrorLogSize || 100;
    
    console.log(`シンプルハッシュ埋め込みモデルを初期化しました: 次元数=${this.dimensions}`);
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
    
    try {
      // テキストが長すぎる場合は分割して処理
      if (text.length > this.maxTokens) {
        return this.embedLongText(text, this.maxTokens);
      }
      
      // シンプルなハッシュベースのベクトル生成
      const vector = new Array(this.dimensions).fill(0);
      
      // テキストをトークン化
      const tokens = this.tokenizeText(text);
      
      // 各トークンのハッシュ値をベクトルに変換
      for (const token of tokens) {
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        
        // ハッシュの各バイトをベクトルの位置に対応させる
        for (let i = 0; i < Math.min(hash.length, this.dimensions / 8); i++) {
          const value = parseInt(hash.substring(i * 2, i * 2 + 2), 16);
          const position = i % this.dimensions;
          vector[position] += value / 255.0 - 0.5; // -0.5〜0.5の範囲に正規化
        }
      }
      
      // ベクトルの正規化
      return this.normalizeVector(vector);
    } catch (error) {
      // エラーログに記録
      this.logError(error, text);
      console.error('シンプルハッシュベクトル生成中にエラーが発生しました:', error.message);
      
      // エラーが発生した場合は、ランダムベクトルを返す
      return this.generateRandomVector();
    }
  }
  
  /**
   * テキストをトークン化
   * @param {string} text - トークン化するテキスト
   * @returns {Array<string>} - トークンの配列
   */
  tokenizeText(text) {
    switch (this.tokenizationMethod) {
      case 'simple':
      default:
        // シンプルな単語分割（デフォルト）
        return text
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(token => token.length > 0);
        
      case 'character':
        // 文字単位のトークン化
        return text.toLowerCase().split('');
        
      case 'ngram':
        // N-gramベースのトークン化（2-gram、3-gram）
        const tokens = [];
        const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        
        // 単語レベルのトークン
        tokens.push(...words.filter(word => word.length > 0));
        
        // 2-gram
        for (let i = 0; i < words.length - 1; i++) {
          tokens.push(`${words[i]} ${words[i + 1]}`);
        }
        
        // 3-gram
        for (let i = 0; i < words.length - 2; i++) {
          tokens.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
        }
        
        return tokens;
    }
  }
  
  /**
   * 長いテキストを分割して埋め込みを生成し、平均化
   * @param {string} text - 長いテキスト
   * @param {number} maxChunkSize - チャンクあたりの最大サイズ
   * @returns {Promise<Array<number>>} - 平均化された埋め込みベクトル
   */
  async embedLongText(text, maxChunkSize) {
    // テキストをチャンクに分割
    const chunks = this.splitTextIntoChunks(text, maxChunkSize);
    console.log(`テキストを ${chunks.length} チャンクに分割しました`);
    
    // 各チャンクの埋め込みを生成
    const embeddings = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        console.log(`チャンク ${i + 1}/${chunks.length} の埋め込みを生成中...`);
        
        // 再帰的にembedを呼び出すが、長いテキスト処理は行わない
        const chunkText = chunks[i];
        const vector = new Array(this.dimensions).fill(0);
        
        // テキストをトークン化
        const tokens = this.tokenizeText(chunkText);
        
        // 各トークンのハッシュ値をベクトルに変換
        for (const token of tokens) {
          const hash = crypto.createHash('sha256').update(token).digest('hex');
          
          for (let i = 0; i < Math.min(hash.length, this.dimensions / 8); i++) {
            const value = parseInt(hash.substring(i * 2, i * 2 + 2), 16);
            const position = i % this.dimensions;
            vector[position] += value / 255.0 - 0.5;
          }
        }
        
        // ベクトルの正規化
        const normalizedVector = this.normalizeVector(vector);
        embeddings.push(normalizedVector);
      } catch (error) {
        console.error(`チャンク ${i + 1} の埋め込み生成に失敗しました:`, error.message);
        // エラーが発生しても処理を続行し、成功したチャンクの埋め込みを使用
      }
    }
    
    // 埋め込みが1つも生成できなかった場合はランダムベクトルを返す
    if (embeddings.length === 0) {
      console.warn('すべてのテキストチャンクの埋め込み生成に失敗しました。ランダムベクトルを返します。');
      return this.generateRandomVector();
    }
    
    // 埋め込みを平均化
    return this.averageEmbeddings(embeddings);
  }
  
  /**
   * テキストをチャンクに分割
   * @param {string} text - 分割するテキスト
   * @param {number} maxChunkSize - チャンクあたりの最大サイズ
   * @returns {Array<string>} - テキストチャンクの配列
   */
  splitTextIntoChunks(text, maxChunkSize) {
    // 単純な文字数ベースの分割
    const chunks = [];
    for (let i = 0; i < text.length; i += maxChunkSize) {
      chunks.push(text.substring(i, i + maxChunkSize));
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
   * ランダムベクトルの生成（最終的なフォールバック）
   * @returns {Array<number>} - 正規化されたランダムベクトル
   */
  generateRandomVector() {
    const vector = new Array(this.dimensions).fill(0);
    
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
}

export { SimpleHashEmbeddingModel };
