/**
 * 埋め込みサービスクラス
 * OpenAI APIを使用してテキストの埋め込みベクトルを生成する
 */
const { OpenAI } = require('openai');
const config = require('../config/default');
const logger = require('./utils/logger');

class EmbeddingService {
  /**
   * EmbeddingServiceのコンストラクタ
   * @param {Object} options - 設定オプション
   */
  constructor(options = {}) {
    this.options = {
      model: options.model || config.embedding.model,
      fallbackModel: options.fallbackModel || config.embedding.fallbackModel,
      dimensions: options.dimensions || config.embedding.dimensions,
      ...options
    };
    
    this.openai = null;
    logger.info(`EmbeddingService initialized with model: ${this.options.model}`);
  }

  /**
   * OpenAI APIクライアントを初期化する
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // 環境変数からAPIキーを取得
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      
      this.openai = new OpenAI({
        apiKey: apiKey
      });
      
      logger.info('OpenAI API client initialized');
    } catch (error) {
      logger.error(`Error initializing OpenAI API client: ${error.message}`);
      throw error;
    }
  }

  /**
   * テキストの埋め込みベクトルを取得する
   * @param {string} text - 埋め込みを生成するテキスト
   * @returns {Promise<Array>} 埋め込みベクトル
   */
  async getEmbedding(text) {
    try {
      if (!this.openai) {
        await this.initialize();
      }
      
      // テキストの前処理
      const processedText = this.preprocessText(text);
      
      // 埋め込みリクエストを送信
      const response = await this.openai.embeddings.create({
        model: this.options.model,
        input: processedText,
        dimensions: this.options.dimensions
      });
      
      // レスポンスから埋め込みベクトルを取得
      const embedding = response.data[0].embedding;
      
      logger.debug(`Generated embedding with ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      // モデルエラーの場合はフォールバックモデルを試す
      if (error.message.includes('model') && this.options.model !== this.options.fallbackModel) {
        logger.warn(`Error with model ${this.options.model}, falling back to ${this.options.fallbackModel}`);
        
        const originalModel = this.options.model;
        this.options.model = this.options.fallbackModel;
        
        try {
          const fallbackEmbedding = await this.getEmbedding(text);
          
          // 成功したら元のモデルに戻す
          this.options.model = originalModel;
          
          return fallbackEmbedding;
        } catch (fallbackError) {
          // フォールバックも失敗した場合
          logger.error(`Fallback model also failed: ${fallbackError.message}`);
          this.options.model = originalModel;
          throw fallbackError;
        }
      }
      
      logger.error(`Error generating embedding: ${error.message}`);
      throw error;
    }
  }

  /**
   * 複数のテキストの埋め込みベクトルをバッチで取得する
   * @param {Array} texts - 埋め込みを生成するテキストの配列
   * @returns {Promise<Array>} 埋め込みベクトルの配列
   */
  async getBatchEmbeddings(texts) {
    try {
      if (!this.openai) {
        await this.initialize();
      }
      
      // テキストの前処理
      const processedTexts = texts.map(text => this.preprocessText(text));
      
      // 埋め込みリクエストを送信
      const response = await this.openai.embeddings.create({
        model: this.options.model,
        input: processedTexts,
        dimensions: this.options.dimensions
      });
      
      // レスポンスから埋め込みベクトルを取得
      const embeddings = response.data.map(item => item.embedding);
      
      logger.debug(`Generated ${embeddings.length} embeddings in batch`);
      return embeddings;
    } catch (error) {
      // モデルエラーの場合はフォールバックモデルを試す
      if (error.message.includes('model') && this.options.model !== this.options.fallbackModel) {
        logger.warn(`Error with model ${this.options.model}, falling back to ${this.options.fallbackModel}`);
        
        const originalModel = this.options.model;
        this.options.model = this.options.fallbackModel;
        
        try {
          const fallbackEmbeddings = await this.getBatchEmbeddings(texts);
          
          // 成功したら元のモデルに戻す
          this.options.model = originalModel;
          
          return fallbackEmbeddings;
        } catch (fallbackError) {
          // フォールバックも失敗した場合
          logger.error(`Fallback model also failed: ${fallbackError.message}`);
          this.options.model = originalModel;
          throw fallbackError;
        }
      }
      
      logger.error(`Error generating batch embeddings: ${error.message}`);
      throw error;
    }
  }

  /**
   * テキストを前処理する
   * @param {string} text - 前処理するテキスト
   * @returns {string} 前処理されたテキスト
   */
  preprocessText(text) {
    if (!text) {
      return '';
    }
    
    // 空白の正規化
    let processed = text.replace(/\s+/g, ' ');
    
    // 文字数制限（OpenAIの制限に合わせる）
    const maxTokens = 8191;  // OpenAIの埋め込みモデルの最大トークン数
    if (processed.length > maxTokens * 4) {  // 大まかな文字数制限（1トークン≒4文字と仮定）
      processed = processed.substring(0, maxTokens * 4);
    }
    
    return processed.trim();
  }
}

module.exports = EmbeddingService;
