// integrations/windsurf/client.js - Windsurfクライアント向けヘルパー
import fetch from 'node-fetch';

/**
 * HARCA Windsurfクライアントクラス
 * Windsurfから利用するためのクライアントライブラリ
 */
class HarcaWindsurfClient {
  /**
   * コンストラクタ
   * @param {string} baseUrl HARCAサーバーのベースURL
   */
  constructor(baseUrl = 'http://localhost:3600') {
    this.baseUrl = baseUrl;
    this.apiPrefix = '/api/windsurf';
  }

  /**
   * サーバーの状態を確認
   * @returns {Promise<Object>} サーバーの状態情報
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/health`);
      return await response.json();
    } catch (error) {
      console.error('HARCAサーバーの状態確認中にエラーが発生しました:', error);
      return {
        status: 'error',
        error: error.message,
        message: 'HARCAサーバーに接続できません'
      };
    }
  }

  /**
   * コードを分析
   * @param {Object} params 分析パラメータ
   * @param {string} params.code 分析するコード
   * @param {string} params.language コードの言語
   * @param {Array<string>} params.rules 適用するルール
   * @param {Object} params.options 追加オプション
   * @returns {Promise<Object>} 分析結果
   */
  async analyzeCode(params) {
    try {
      if (!params.code) {
        throw new Error('コードが指定されていません');
      }

      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });

      return await response.json();
    } catch (error) {
      console.error('コード分析中にエラーが発生しました:', error);
      return {
        success: false,
        error: error.message,
        message: 'コード分析中にエラーが発生しました'
      };
    }
  }

  /**
   * 利用可能なルールを取得
   * @returns {Promise<Object>} ルール情報
   */
  async getAvailableRules() {
    try {
      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/rules`);
      return await response.json();
    } catch (error) {
      console.error('ルール情報の取得中にエラーが発生しました:', error);
      return {
        success: false,
        error: error.message,
        message: 'ルール情報の取得中にエラーが発生しました'
      };
    }
  }

  /**
   * 分析オプションを取得
   * @returns {Promise<Object>} オプション情報
   */
  async getAnalysisOptions() {
    try {
      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/options`);
      return await response.json();
    } catch (error) {
      console.error('分析オプションの取得中にエラーが発生しました:', error);
      return {
        success: false,
        error: error.message,
        message: '分析オプションの取得中にエラーが発生しました'
      };
    }
  }

  /**
   * Windsurf設定を確認
   * @returns {Promise<Object>} 設定情報
   */
  async checkWindsurfConfig() {
    try {
      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/config`);
      return await response.json();
    } catch (error) {
      console.error('Windsurf設定の確認中にエラーが発生しました:', error);
      return {
        success: false,
        error: error.message,
        message: 'Windsurf設定の確認中にエラーが発生しました'
      };
    }
  }
}

export default HarcaWindsurfClient;
