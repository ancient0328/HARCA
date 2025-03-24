/**
 * Sequential Thinkingサービスのモックサーバー
 * 
 * このモジュールは、Sequential Thinkingサービスをシミュレートするモックサーバーを提供します。
 * テスト環境で使用することを目的としています。
 */

import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger.js';

// デフォルトのポート設定
const DEFAULT_PORT = 3740;

/**
 * モックサーバークラス
 */
class MockServer {
  /**
   * モックサーバーのコンストラクタ
   * @param {Object} options - 設定オプション
   */
  constructor(options = {}) {
    this.port = options.port || DEFAULT_PORT;
    this.app = express();
    this.server = null;
    this.debug = options.debug || false;
    
    // ミドルウェアの設定
    this.app.use(express.json());
    this.app.use(cors());
    
    // ルートの設定
    this.setupRoutes();
    
    if (this.debug) {
      logger.debug('[MockServer] 初期化完了');
    }
  }
  
  /**
   * ルートの設定
   */
  setupRoutes() {
    // ヘルスチェックエンドポイント
    this.app.post('/api/sequential-thinking/health', (req, res) => {
      res.json({
        success: true,
        status: 'healthy',
        message: 'Mock Sequential Thinking service is available',
        timestamp: new Date().toISOString()
      });
    });
    
    // ツール推奨エンドポイント
    this.app.post('/api/sequential-thinking/recommend-tools', (req, res) => {
      const { text, availableTools } = req.body;
      
      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'テキストが指定されていません',
          timestamp: new Date().toISOString()
        });
      }
      
      // モックの推奨ツールを生成
      const mockRecommendations = this.generateMockRecommendations(text, availableTools);
      
      res.json({
        success: true,
        recommendations: mockRecommendations,
        timestamp: new Date().toISOString()
      });
    });
    
    // 思考プロセスエンドポイント
    this.app.post('/api/sequential-thinking/process', (req, res) => {
      const { text, context } = req.body;
      
      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'テキストが指定されていません',
          timestamp: new Date().toISOString()
        });
      }
      
      // モックの思考プロセスを生成
      const mockProcess = this.generateMockThoughtProcess(text, context);
      
      res.json({
        success: true,
        process: mockProcess,
        timestamp: new Date().toISOString()
      });
    });
    
    // キャッシュ統計エンドポイント
    this.app.get('/api/sequential-thinking/cache/stats', (req, res) => {
      // モックのキャッシュ統計を返す
      res.json({
        success: true,
        stats: {
          size: Math.floor(Math.random() * 10),
          maxSize: 1000,
          ttl: 300000,
          enabled: true,
          hits: Math.floor(Math.random() * 100),
          misses: Math.floor(Math.random() * 50)
        },
        timestamp: new Date().toISOString()
      });
    });
    
    // キャッシュクリアエンドポイント
    this.app.post('/api/sequential-thinking/cache/clear', (req, res) => {
      // モックのキャッシュクリア結果を返す
      res.json({
        success: true,
        message: 'キャッシュをクリアしました（10 → 0）',
        timestamp: new Date().toISOString()
      });
    });
    
    // 404エラーハンドリング
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'エンドポイントが見つかりません',
        timestamp: new Date().toISOString()
      });
    });
  }
  
  /**
   * モックの推奨ツールを生成
   * @param {string} text - 入力テキスト
   * @param {Array} availableTools - 利用可能なツールのリスト
   * @returns {Array} 推奨ツールのリスト
   */
  generateMockRecommendations(text, availableTools = []) {
    // テキストに基づいて簡単なツール推奨を生成
    const recommendations = [];
    
    if (text.includes('分析') || text.includes('解析') || text.includes('analyze')) {
      recommendations.push({
        name: 'analyzeCode',
        confidence: 0.95,
        reason: 'テキストに分析や解析に関する言及があります'
      });
    }
    
    if (text.includes('思考') || text.includes('考え') || text.includes('think')) {
      recommendations.push({
        name: 'sequentialThinking',
        confidence: 0.98,
        reason: '思考プロセスに関する言及があります'
      });
    }
    
    if (text.includes('健全性') || text.includes('状態') || text.includes('health')) {
      recommendations.push({
        name: 'checkHealth',
        confidence: 0.90,
        reason: 'システムの健全性確認に関する言及があります'
      });
    }
    
    // 利用可能なツールから最大3つをランダムに選択（既に選択されたものを除く）
    const selectedNames = recommendations.map(r => r.name);
    const availableForSelection = availableTools.filter(t => !selectedNames.includes(t));
    
    if (availableForSelection.length > 0 && recommendations.length < 3) {
      const numToAdd = Math.min(3 - recommendations.length, availableForSelection.length);
      const shuffled = [...availableForSelection].sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < numToAdd; i++) {
        recommendations.push({
          name: shuffled[i],
          confidence: 0.5 + Math.random() * 0.3, // 0.5〜0.8のランダムな信頼度
          reason: 'コンテキストから推測されるツール'
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * モックの思考プロセスを生成
   * @param {string} text - 入力テキスト
   * @param {Object} context - コンテキスト情報
   * @returns {Object} 思考プロセス
   */
  generateMockThoughtProcess(text, context = {}) {
    return {
      input: text,
      steps: [
        {
          type: 'problem_definition',
          content: `問題: ${text}`
        },
        {
          type: 'analysis',
          content: '問題の分析を行います。主要な要素を特定し、関連する情報を収集します。'
        },
        {
          type: 'solution_options',
          content: '複数の解決策を検討します。各オプションの長所と短所を評価します。'
        },
        {
          type: 'decision',
          content: '最適な解決策を選択します。選択の理由と期待される結果を説明します。'
        },
        {
          type: 'implementation_plan',
          content: '実装計画を策定します。必要なステップと資源を特定します。'
        },
        {
          type: 'conclusion',
          content: `結論: ${text}に対する最適な解決策が見つかりました。`
        }
      ],
      summary: `「${text}」に対する構造化思考プロセスを完了しました。問題を分析し、複数の解決策を評価した結果、最適な解決策を特定しました。`,
      metadata: {
        processingTime: 0.5 + Math.random() * 1.5, // 0.5〜2.0秒のランダムな処理時間
        contextSize: context ? Object.keys(context).length : 0,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  /**
   * サーバーを起動
   * @returns {Promise} サーバー起動のPromise
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.info(`[MockServer] モックサーバーを起動しました: http://localhost:${this.port}`);
          resolve(this.server);
        });
      } catch (error) {
        logger.error(`[MockServer] サーバー起動エラー: ${error.message}`);
        reject(error);
      }
    });
  }
  
  /**
   * サーバーを停止
   * @returns {Promise} サーバー停止のPromise
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        logger.warn('[MockServer] サーバーは起動していません');
        return resolve();
      }
      
      this.server.close(err => {
        if (err) {
          logger.error(`[MockServer] サーバー停止エラー: ${err.message}`);
          return reject(err);
        }
        
        logger.info('[MockServer] サーバーを停止しました');
        this.server = null;
        resolve();
      });
    });
  }
}

// モックサーバーのデフォルトインスタンス
const defaultMockServer = new MockServer({
  debug: process.env.DEBUG === 'true'
});

// コマンドラインから直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || DEFAULT_PORT, 10);
  const server = new MockServer({ port, debug: true });
  
  server.start()
    .then(() => {
      logger.info(`モックサーバーが http://localhost:${port} で実行中です`);
      logger.info('終了するには Ctrl+C を押してください');
    })
    .catch(error => {
      logger.error(`サーバー起動エラー: ${error.message}`);
      process.exit(1);
    });
    
  // シグナルハンドリング
  process.on('SIGINT', async () => {
    logger.info('SIGINT シグナルを受信しました。サーバーを停止します...');
    
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      logger.error(`サーバー停止エラー: ${error.message}`);
      process.exit(1);
    }
  });
}

export {
  MockServer,
  defaultMockServer
};
