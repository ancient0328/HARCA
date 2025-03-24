/**
 * @fileoverview Jestの設定ファイル
 * 知識ベースモジュールのテスト設定
 */

export default {
  // テスト環境
  testEnvironment: 'node',
  
  // テストファイルのパターン
  testMatch: ['**/tests/**/*.test.js'],
  
  // カバレッジ設定
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
  ],
  
  // テストのタイムアウト設定
  testTimeout: 10000,
  
  // モック設定
  clearMocks: true,
  resetMocks: true,
  
  // 詳細なレポート
  verbose: true,
};
