// integrations/windsurf/api.js - Windsurf向け拡張API
import express from 'express';
import CodeAnalysisBridge from './code-analysis-bridge.js';

/**
 * Windsurf向けAPI拡張クラス
 * Windsurfとの連携に特化したAPIエンドポイントを提供します
 */
class WindsurfApi {
  /**
   * コンストラクタ
   * @param {Object} app Expressアプリケーション
   */
  constructor(app) {
    this.app = app;
    this.codeAnalysisBridge = new CodeAnalysisBridge();
    this.setupRoutes();
    console.log('Windsurf向けAPI拡張が初期化されました');
  }

  /**
   * APIルートの設定
   */
  setupRoutes() {
    // Windsurf向けAPIのルートプレフィックス
    const apiPrefix = '/api/windsurf';
    
    // ヘルスチェックエンドポイント
    this.app.get(`${apiPrefix}/health`, (req, res) => {
      res.json({
        status: 'ok',
        service: 'HARCA Windsurf Integration',
        timestamp: new Date().toISOString()
      });
    });
    
    // コード分析エンドポイント
    this.app.post(`${apiPrefix}/analyze`, async (req, res) => {
      try {
        const params = req.body;
        
        // 必須パラメータの検証
        if (!params.code) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameter: code'
          });
        }
        
        // コード分析の実行
        const result = await this.codeAnalysisBridge.analyzeCode(params);
        res.json(result);
      } catch (error) {
        console.error('API error in /analyze:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          message: 'コード分析中にエラーが発生しました'
        });
      }
    });
    
    // 利用可能なルール取得エンドポイント
    this.app.get(`${apiPrefix}/rules`, async (req, res) => {
      try {
        const rules = this.codeAnalysisBridge.getAvailableRules();
        res.json(rules);
      } catch (error) {
        console.error('API error in /rules:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          message: 'ルール情報の取得中にエラーが発生しました'
        });
      }
    });
    
    // コード分析の詳細オプション取得エンドポイント
    this.app.get(`${apiPrefix}/options`, (req, res) => {
      res.json({
        success: true,
        options: {
          languages: ['javascript', 'typescript', 'python', 'java', 'go', 'ruby', 'php', 'c', 'cpp', 'csharp'],
          analysisTypes: [
            {
              id: 'complexity',
              name: '複雑度分析',
              description: '関数やメソッドの複雑さを分析し、改善提案を提供します'
            },
            {
              id: 'comments',
              name: 'コメント率分析',
              description: 'コード内のコメント行の割合を計算し、適切なコメント率を提案します'
            },
            {
              id: 'naming',
              name: '命名規則分析',
              description: '変数や関数の命名規則を分析し、一貫性のある命名を提案します'
            },
            {
              id: 'duplication',
              name: '重複コード検出',
              description: 'コード内の重複を検出し、リファクタリングの機会を特定します'
            }
          ],
          formatOptions: [
            {
              id: 'includeSummary',
              name: 'サマリーを含める',
              description: '分析結果のサマリーを含めます',
              default: true
            },
            {
              id: 'includeDetails',
              name: '詳細を含める',
              description: '詳細な分析結果を含めます',
              default: true
            }
          ]
        }
      });
    });
    
    // Windsurfの設定確認エンドポイント
    this.app.get(`${apiPrefix}/config`, (req, res) => {
      try {
        // WindsurfIntegrationクラスのインスタンスを動的にインポート
        import('../windsurf/index.js').then(module => {
          const { WindsurfIntegration } = module;
          const windsurfIntegration = new WindsurfIntegration();
          const config = windsurfIntegration.checkCurrentConfig();
          res.json({
            success: true,
            config
          });
        }).catch(error => {
          console.error('Windsurf設定の確認中にエラーが発生しました:', error);
          res.status(500).json({
            success: false,
            error: error.message,
            message: 'Windsurf設定の確認中にエラーが発生しました'
          });
        });
      } catch (error) {
        console.error('API error in /config:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          message: 'Windsurf設定の確認中にエラーが発生しました'
        });
      }
    });
    
    // Sequential Thinkingツールのエンドポイント
    this.app.post(`${apiPrefix}/sequential-thinking`, async (req, res) => {
      try {
        const params = req.body;
        
        // Sequential Thinkingモジュールの動的インポート
        import('../sequential-thinking/index.js').then(async module => {
          if (!module.defaultIntegration) {
            throw new Error('Sequential Thinking統合モジュールが見つかりません');
          }
          
          // Sequential Thinkingの実行
          const result = await module.defaultIntegration.processThought(params);
          res.json({
            success: true,
            result
          });
        }).catch(error => {
          console.error('Sequential Thinking実行中にエラーが発生しました:', error);
          res.status(500).json({
            success: false,
            error: error.message,
            message: 'Sequential Thinking実行中にエラーが発生しました'
          });
        });
      } catch (error) {
        console.error('API error in /sequential-thinking:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          message: 'Sequential Thinking実行中にエラーが発生しました'
        });
      }
    });
  }
}

export default WindsurfApi;
