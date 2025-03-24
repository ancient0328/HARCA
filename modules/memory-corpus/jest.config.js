/**
 * @fileoverview Jestの設定ファイル
 * メモリコーパスモジュールのテスト設定
 */

export default {
  // テスト環境
  testEnvironment: 'node',
  
  // テストファイルのパターン
  testMatch: ['**/tests/**/*.test.js', '**/test/**/*.test.js'],
  
  // カバレッジ設定
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
  ],
  
  // テストのタイムアウト設定
  testTimeout: 10000,
  
  // ESモジュールサポート
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^../../utils/(.*)$': '<rootDir>/__mocks__/utils/$1',
    '^../../db/(.*)$': '<rootDir>/__mocks__/db/$1',
    '^../../cache/(.*)$': '<rootDir>/__mocks__/cache/$1',
    '^../../services/(.*)$': '<rootDir>/__mocks__/services/$1'
  },
  
  // モックの設定
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // モックディレクトリ
  moduleDirectories: ['node_modules', '__mocks__'],
  
  // テスト実行環境の設定
  testEnvironmentOptions: {
    url: 'http://localhost/'
  },
  
  // 詳細なテスト結果
  verbose: true,
};
