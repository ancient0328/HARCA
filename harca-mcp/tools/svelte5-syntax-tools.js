/**
 * Svelte 5 構文変換ツール定義
 * 
 * このファイルは、HARCAのMCPサーバーにSvelte 5構文変換ツールを登録します。
 */

const svelte5Syntax = require('../modules/svelte5-syntax');

/**
 * Svelte 5構文変換ツールの定義
 */
const svelte5SyntaxTools = [
  {
    name: 'svelte5_check_syntax',
    description: 'Svelteファイルの構文をチェックし、古い構文を検出します',
    parameters: {
      properties: {
        filePath: {
          type: 'string',
          description: 'チェックするSvelteファイルのパス'
        }
      },
      required: ['filePath']
    },
    handler: async (params) => {
      return await svelte5Syntax.tools.find(t => t.name === 'svelte5_check_syntax').handler(params);
    }
  },
  {
    name: 'svelte5_transform_file',
    description: 'Svelteファイルの古い構文を新しい構文に変換します',
    parameters: {
      properties: {
        filePath: {
          type: 'string',
          description: '変換するSvelteファイルのパス'
        },
        write: {
          type: 'boolean',
          description: '変換結果をファイルに書き込むかどうか',
          default: false
        },
        backup: {
          type: 'boolean',
          description: 'バックアップを作成するかどうか',
          default: true
        }
      },
      required: ['filePath']
    },
    handler: async (params) => {
      return await svelte5Syntax.tools.find(t => t.name === 'svelte5_transform_file').handler(params);
    }
  },
  {
    name: 'svelte5_process_directory',
    description: 'ディレクトリ内のSvelteファイルを再帰的に処理します',
    parameters: {
      properties: {
        dirPath: {
          type: 'string',
          description: '処理するディレクトリのパス'
        },
        write: {
          type: 'boolean',
          description: '変換結果をファイルに書き込むかどうか',
          default: false
        },
        backup: {
          type: 'boolean',
          description: 'バックアップを作成するかどうか',
          default: true
        },
        excludeDirs: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: '除外するディレクトリ名の配列',
          default: ['node_modules', '.git', 'dist', 'build']
        }
      },
      required: ['dirPath']
    },
    handler: async (params) => {
      return await svelte5Syntax.tools.find(t => t.name === 'svelte5_process_directory').handler(params);
    }
  },
  {
    name: 'svelte5_analyze_project',
    description: 'プロジェクト全体のSvelte構文を分析し、変換が必要なファイルを特定します',
    parameters: {
      properties: {
        projectPath: {
          type: 'string',
          description: 'プロジェクトのルートディレクトリ'
        },
        excludeDirs: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: '除外するディレクトリ名の配列',
          default: ['node_modules', '.git', 'dist', 'build']
        }
      },
      required: ['projectPath']
    },
    handler: async ({ projectPath, excludeDirs }) => {
      const results = svelte5Syntax.processDirectory(projectPath, { 
        write: false, 
        excludeDirs: excludeDirs || ['node_modules', '.git', 'dist', 'build'] 
      });
      
      // 結果を分析して要約
      const summary = {
        totalFiles: results.length,
        filesWithOldSyntax: results.filter(r => r.detectedCount > 0).length,
        totalOldSyntaxCount: results.reduce((sum, r) => sum + (r.detectedCount || 0), 0),
        filesWithMixedSyntax: results.filter(r => {
          const mixedCheck = svelte5Syntax.checkMixedSyntax(fs.readFileSync(r.filePath, 'utf8'));
          return mixedCheck.hasMixedSyntax;
        }).length,
        fileDetails: results.map(r => ({
          filePath: r.filePath,
          detectedCount: r.detectedCount || 0,
          hasError: !!r.error,
          error: r.error
        }))
      };
      
      return {
        summary,
        detailedResults: results
      };
    }
  }
];

module.exports = svelte5SyntaxTools;
