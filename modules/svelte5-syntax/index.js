/**
 * Svelte 5 構文変換モジュール
 * 
 * このモジュールは、Svelte 5の新しいイベント構文に対応するための機能を提供します。
 * - イベントハンドラの構文変換（on:event → onevent）
 * - イベント修飾子の処理
 * - 自動検出と修正
 */

const fs = require('fs');
const path = require('path');

// イベント名のリスト
const EVENT_NAMES = [
  'submit', 'click', 'input', 'change', 'keydown', 'keyup', 
  'keypress', 'focus', 'blur', 'mouseenter', 'mouseleave'
];

// 修飾子のリスト
const MODIFIERS = [
  { name: 'preventDefault', implementation: 'event.preventDefault()' },
  { name: 'stopPropagation', implementation: 'event.stopPropagation()' },
  { name: 'capture', implementation: '/* capture - カスタム実装が必要 */' },
  { name: 'once', implementation: '/* once - カスタム実装が必要 */' },
  { name: 'passive', implementation: '/* passive - カスタム実装が必要 */' }
];

// 変換テンプレート
const TRANSFORMATION_TEMPLATES = {
  simple: 'onevent={handler}',
  withModifier: 'onevent={(e) => { e.{modifierImplementation}; handler(e); }}',
  withoutParams: 'onevent={(e) => { e.{modifierImplementation}; handler(); }}'
};

/**
 * イベント構文を検出する
 * @param {string} content - ファイルの内容
 * @returns {Array} - 検出されたイベント構文の配列
 */
function detectEventSyntax(content) {
  const eventPattern = new RegExp(`on:(${EVENT_NAMES.join('|')})(?:\\|([a-zA-Z]+))?={([^}]+)}`, 'g');
  const results = [];
  
  let match;
  while ((match = eventPattern.exec(content)) !== null) {
    results.push({
      fullMatch: match[0],
      event: match[1],
      modifier: match[2] || null,
      handler: match[3],
      index: match.index
    });
  }
  
  return results;
}

/**
 * イベント構文を変換する
 * @param {string} content - ファイルの内容
 * @param {Object} options - 変換オプション
 * @returns {Object} - 変換結果
 */
function transformEventSyntax(content, options = {}) {
  const detectedEvents = detectEventSyntax(content);
  let transformedContent = content;
  const changes = [];
  
  // インデックスのオフセットを追跡（置換によって文字列の長さが変わるため）
  let offset = 0;
  
  for (const event of detectedEvents) {
    const { fullMatch, event: eventName, modifier, handler, index } = event;
    let replacement;
    
    if (modifier) {
      // 修飾子がある場合
      const modifierObj = MODIFIERS.find(m => m.name === modifier);
      if (modifierObj) {
        // ハンドラが引数を取るかどうかを推測（完全な解析は難しいので単純化）
        const template = handler.includes('(event)') || handler.includes('(e)') 
          ? TRANSFORMATION_TEMPLATES.withModifier 
          : TRANSFORMATION_TEMPLATES.withoutParams;
        
        replacement = template
          .replace('onevent', `on${eventName}`)
          .replace('{modifierImplementation}', modifierObj.implementation)
          .replace('handler', handler);
      } else {
        // 未知の修飾子の場合はコメントを追加
        replacement = `on${eventName}={(e) => { /* 未知の修飾子: ${modifier} */ ${handler}(e); }}`;
      }
    } else {
      // 修飾子がない場合は単純に変換
      replacement = `on${eventName}={${handler}}`;
    }
    
    // 変換を適用
    const actualIndex = index + offset;
    transformedContent = transformedContent.substring(0, actualIndex) + 
                         replacement + 
                         transformedContent.substring(actualIndex + fullMatch.length);
    
    // オフセットを更新
    offset += replacement.length - fullMatch.length;
    
    changes.push({
      original: fullMatch,
      replacement,
      line: content.substring(0, index).split('\n').length
    });
  }
  
  return {
    content: transformedContent,
    changes,
    detectedCount: detectedEvents.length
  };
}

/**
 * ファイル内のイベント構文を変換する
 * @param {string} filePath - ファイルパス
 * @param {Object} options - 変換オプション
 * @returns {Object} - 変換結果
 */
function transformFile(filePath, options = {}) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = transformEventSyntax(content, options);
    
    if (options.write && result.detectedCount > 0) {
      // バックアップを作成（オプション）
      if (options.backup) {
        const backupPath = `${filePath}.backup`;
        fs.writeFileSync(backupPath, content);
      }
      
      // 変換結果を書き込み
      fs.writeFileSync(filePath, result.content);
    }
    
    return {
      ...result,
      filePath
    };
  } catch (error) {
    return {
      error: `ファイルの処理中にエラーが発生しました: ${error.message}`,
      filePath
    };
  }
}

/**
 * ディレクトリ内のSvelteファイルを再帰的に処理する
 * @param {string} dirPath - ディレクトリパス
 * @param {Object} options - 変換オプション
 * @returns {Array} - 処理結果の配列
 */
function processDirectory(dirPath, options = {}) {
  const results = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // サブディレクトリを再帰的に処理
        if (!options.excludeDirs || !options.excludeDirs.includes(entry.name)) {
          results.push(...processDirectory(fullPath, options));
        }
      } else if (entry.isFile() && entry.name.endsWith('.svelte')) {
        // Svelteファイルを処理
        results.push(transformFile(fullPath, options));
      }
    }
  } catch (error) {
    results.push({
      error: `ディレクトリの処理中にエラーが発生しました: ${error.message}`,
      dirPath
    });
  }
  
  return results;
}

/**
 * 構文の混在をチェックする
 * @param {string} content - ファイルの内容
 * @returns {Object} - チェック結果
 */
function checkMixedSyntax(content) {
  const oldSyntaxPattern = new RegExp(`on:(${EVENT_NAMES.join('|')})`, 'g');
  const newSyntaxPattern = new RegExp(`on(${EVENT_NAMES.join('|')})=`, 'g');
  
  const oldSyntaxMatches = [...content.matchAll(oldSyntaxPattern)];
  const newSyntaxMatches = [...content.matchAll(newSyntaxPattern)];
  
  return {
    hasMixedSyntax: oldSyntaxMatches.length > 0 && newSyntaxMatches.length > 0,
    oldSyntaxCount: oldSyntaxMatches.length,
    newSyntaxCount: newSyntaxMatches.length,
    oldSyntaxMatches: oldSyntaxMatches.map(m => ({
      match: m[0],
      index: m.index,
      line: content.substring(0, m.index).split('\n').length
    })),
    newSyntaxMatches: newSyntaxMatches.map(m => ({
      match: m[0],
      index: m.index,
      line: content.substring(0, m.index).split('\n').length
    }))
  };
}

// HARCAモジュールとしてのエクスポート
module.exports = {
  name: 'svelte5-syntax',
  description: 'Svelte 5のイベント構文変換を支援するモジュール',
  version: '1.0.0',
  
  // 主要な関数をエクスポート
  detectEventSyntax,
  transformEventSyntax,
  transformFile,
  processDirectory,
  checkMixedSyntax,
  
  // 定数をエクスポート
  constants: {
    EVENT_NAMES,
    MODIFIERS,
    TRANSFORMATION_TEMPLATES
  },
  
  // HARCAのツール定義
  tools: [
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
      handler: async ({ filePath }) => {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const detectedEvents = detectEventSyntax(content);
          const mixedSyntaxCheck = checkMixedSyntax(content);
          
          return {
            filePath,
            detectedEvents,
            mixedSyntaxCheck,
            hasOldSyntax: detectedEvents.length > 0,
            hasMixedSyntax: mixedSyntaxCheck.hasMixedSyntax
          };
        } catch (error) {
          return {
            error: `ファイルの処理中にエラーが発生しました: ${error.message}`,
            filePath
          };
        }
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
      handler: async ({ filePath, write, backup }) => {
        return transformFile(filePath, { write, backup });
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
      handler: async ({ dirPath, write, backup, excludeDirs }) => {
        return processDirectory(dirPath, { write, backup, excludeDirs });
      }
    }
  ],
  
  // HARCAのフック
  hooks: {
    // ファイル編集前のフック
    preEdit: async (context) => {
      const { filePath, content } = context;
      
      // Svelteファイルのみ処理
      if (!filePath.endsWith('.svelte')) {
        return context;
      }
      
      // 構文の混在をチェック
      const mixedSyntaxCheck = checkMixedSyntax(content);
      if (mixedSyntaxCheck.hasMixedSyntax) {
        context.warnings = [
          ...(context.warnings || []),
          {
            type: 'svelte5-syntax',
            message: '古い構文と新しい構文が混在しています。一貫性を保つため、すべて新しい構文に変換することをお勧めします。',
            details: mixedSyntaxCheck
          }
        ];
      }
      
      return context;
    },
    
    // ファイル編集後のフック
    postEdit: async (context) => {
      const { filePath, content } = context;
      
      // Svelteファイルのみ処理
      if (!filePath.endsWith('.svelte')) {
        return context;
      }
      
      // 古い構文が残っていないかチェック
      const detectedEvents = detectEventSyntax(content);
      if (detectedEvents.length > 0) {
        context.warnings = [
          ...(context.warnings || []),
          {
            type: 'svelte5-syntax',
            message: '古いイベント構文が残っています。新しい構文に変換することをお勧めします。',
            details: { detectedEvents }
          }
        ];
      }
      
      return context;
    }
  }
};
