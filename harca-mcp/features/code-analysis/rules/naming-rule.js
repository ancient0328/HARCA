/**
 * 命名規則分析ルール
 * 変数や関数の命名規則を分析し、一貫性のある命名を促進
 */

/**
 * 命名規則分析ルール
 */
const namingRule = {
  name: '命名規則分析',
  description: '変数や関数の命名規則を分析し、一貫性のある命名を促進します',
  
  /**
   * コードを分析
   * @param {string} code コード文字列
   * @param {string} language 言語
   * @returns {Object} 分析結果
   */
  analyze(code, language = 'javascript') {
    // 言語に応じた分析方法を選択
    switch (language) {
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
        return this.analyzeJavaScript(code);
      case 'python':
      case 'py':
        return this.analyzePython(code);
      default:
        return this.analyzeGeneric(code);
    }
  },
  
  /**
   * JavaScript/TypeScriptコードを分析
   * @param {string} code コード文字列
   * @returns {Object} 分析結果
   */
  analyzeJavaScript(code) {
    const issues = [];
    const stats = {
      camelCase: 0,
      pascalCase: 0,
      snakeCase: 0,
      inconsistentCase: 0,
      tooShort: 0,
      tooLong: 0
    };
    
    // 変数宣言を検出
    const varDeclarations = this.extractJavaScriptVariables(code);
    
    // 関数宣言を検出
    const funcDeclarations = this.extractJavaScriptFunctions(code);
    
    // クラス宣言を検出
    const classDeclarations = this.extractJavaScriptClasses(code);
    
    // 変数の命名規則をチェック
    for (const variable of varDeclarations) {
      const { name, line, column } = variable;
      
      // 命名規則をチェック
      const caseStyle = this.detectCaseStyle(name);
      
      // 統計を更新
      if (caseStyle) {
        stats[caseStyle]++;
      } else {
        stats.inconsistentCase++;
      }
      
      // 変数名の長さをチェック
      if (name.length < 2) {
        stats.tooShort++;
        issues.push({
          severity: 'low',
          message: `変数名 "${name}" が短すぎます。より説明的な名前を使用してください。`,
          location: { line, column }
        });
      } else if (name.length > 30) {
        stats.tooLong++;
        issues.push({
          severity: 'low',
          message: `変数名 "${name}" が長すぎます。より簡潔な名前を検討してください。`,
          location: { line, column }
        });
      }
      
      // JavaScriptの変数はキャメルケースが推奨
      if (caseStyle && caseStyle !== 'camelCase' && !this.isConstant(name)) {
        issues.push({
          severity: 'low',
          message: `変数名 "${name}" はキャメルケース（camelCase）を使用することが推奨されます。`,
          location: { line, column },
          suggestion: this.convertToCamelCase(name)
        });
      }
    }
    
    // 関数の命名規則をチェック
    for (const func of funcDeclarations) {
      const { name, line, column } = func;
      
      // 命名規則をチェック
      const caseStyle = this.detectCaseStyle(name);
      
      // 統計を更新
      if (caseStyle) {
        stats[caseStyle]++;
      } else {
        stats.inconsistentCase++;
      }
      
      // 関数名の長さをチェック
      if (name.length < 3) {
        stats.tooShort++;
        issues.push({
          severity: 'medium',
          message: `関数名 "${name}" が短すぎます。より説明的な名前を使用してください。`,
          location: { line, column }
        });
      } else if (name.length > 30) {
        stats.tooLong++;
        issues.push({
          severity: 'low',
          message: `関数名 "${name}" が長すぎます。より簡潔な名前を検討してください。`,
          location: { line, column }
        });
      }
      
      // JavaScriptの関数はキャメルケースが推奨
      if (caseStyle && caseStyle !== 'camelCase') {
        issues.push({
          severity: 'low',
          message: `関数名 "${name}" はキャメルケース（camelCase）を使用することが推奨されます。`,
          location: { line, column },
          suggestion: this.convertToCamelCase(name)
        });
      }
    }
    
    // クラスの命名規則をチェック
    for (const cls of classDeclarations) {
      const { name, line, column } = cls;
      
      // 命名規則をチェック
      const caseStyle = this.detectCaseStyle(name);
      
      // 統計を更新
      if (caseStyle) {
        stats[caseStyle]++;
      } else {
        stats.inconsistentCase++;
      }
      
      // クラス名の長さをチェック
      if (name.length < 3) {
        stats.tooShort++;
        issues.push({
          severity: 'medium',
          message: `クラス名 "${name}" が短すぎます。より説明的な名前を使用してください。`,
          location: { line, column }
        });
      }
      
      // JavaScriptのクラスはパスカルケースが推奨
      if (caseStyle && caseStyle !== 'pascalCase') {
        issues.push({
          severity: 'medium',
          message: `クラス名 "${name}" はパスカルケース（PascalCase）を使用することが推奨されます。`,
          location: { line, column },
          suggestion: this.convertToPascalCase(name)
        });
      }
    }
    
    // 一貫性の分析
    const totalIdentifiers = varDeclarations.length + funcDeclarations.length + classDeclarations.length;
    const consistencyIssue = this.analyzeConsistency(stats, totalIdentifiers);
    if (consistencyIssue) {
      issues.push(consistencyIssue);
    }
    
    return {
      issues,
      summary: {
        totalIdentifiers,
        ...stats
      }
    };
  },
  
  /**
   * Pythonコードを分析
   * @param {string} code コード文字列
   * @returns {Object} 分析結果
   */
  analyzePython(code) {
    const issues = [];
    const stats = {
      camelCase: 0,
      pascalCase: 0,
      snakeCase: 0,
      inconsistentCase: 0,
      tooShort: 0,
      tooLong: 0
    };
    
    // 変数宣言を検出
    const varDeclarations = this.extractPythonVariables(code);
    
    // 関数宣言を検出
    const funcDeclarations = this.extractPythonFunctions(code);
    
    // クラス宣言を検出
    const classDeclarations = this.extractPythonClasses(code);
    
    // 変数の命名規則をチェック
    for (const variable of varDeclarations) {
      const { name, line, column } = variable;
      
      // 命名規則をチェック
      const caseStyle = this.detectCaseStyle(name);
      
      // 統計を更新
      if (caseStyle) {
        stats[caseStyle]++;
      } else {
        stats.inconsistentCase++;
      }
      
      // 変数名の長さをチェック
      if (name.length < 2) {
        stats.tooShort++;
        issues.push({
          severity: 'low',
          message: `変数名 "${name}" が短すぎます。より説明的な名前を使用してください。`,
          location: { line, column }
        });
      }
      
      // Pythonの変数はスネークケースが推奨
      if (caseStyle && caseStyle !== 'snakeCase' && !this.isConstant(name)) {
        issues.push({
          severity: 'low',
          message: `変数名 "${name}" はスネークケース（snake_case）を使用することが推奨されます。`,
          location: { line, column },
          suggestion: this.convertToSnakeCase(name)
        });
      }
    }
    
    // 関数の命名規則をチェック
    for (const func of funcDeclarations) {
      const { name, line, column } = func;
      
      // 命名規則をチェック
      const caseStyle = this.detectCaseStyle(name);
      
      // 統計を更新
      if (caseStyle) {
        stats[caseStyle]++;
      } else {
        stats.inconsistentCase++;
      }
      
      // Pythonの関数はスネークケースが推奨
      if (caseStyle && caseStyle !== 'snakeCase') {
        issues.push({
          severity: 'low',
          message: `関数名 "${name}" はスネークケース（snake_case）を使用することが推奨されます。`,
          location: { line, column },
          suggestion: this.convertToSnakeCase(name)
        });
      }
    }
    
    // クラスの命名規則をチェック
    for (const cls of classDeclarations) {
      const { name, line, column } = cls;
      
      // 命名規則をチェック
      const caseStyle = this.detectCaseStyle(name);
      
      // 統計を更新
      if (caseStyle) {
        stats[caseStyle]++;
      } else {
        stats.inconsistentCase++;
      }
      
      // Pythonのクラスはパスカルケースが推奨
      if (caseStyle && caseStyle !== 'pascalCase') {
        issues.push({
          severity: 'medium',
          message: `クラス名 "${name}" はパスカルケース（PascalCase）を使用することが推奨されます。`,
          location: { line, column },
          suggestion: this.convertToPascalCase(name)
        });
      }
    }
    
    // 一貫性の分析
    const totalIdentifiers = varDeclarations.length + funcDeclarations.length + classDeclarations.length;
    const consistencyIssue = this.analyzeConsistency(stats, totalIdentifiers);
    if (consistencyIssue) {
      issues.push(consistencyIssue);
    }
    
    return {
      issues,
      summary: {
        totalIdentifiers,
        ...stats
      }
    };
  },
  
  /**
   * 汎用的なコード分析
   * @param {string} code コード文字列
   * @returns {Object} 分析結果
   */
  analyzeGeneric(code) {
    // 簡易的な分析
    const words = code.match(/\b[a-zA-Z_]\w*\b/g) || [];
    const identifiers = [...new Set(words)].filter(word => !this.isKeyword(word));
    
    const stats = {
      camelCase: 0,
      pascalCase: 0,
      snakeCase: 0,
      inconsistentCase: 0
    };
    
    for (const identifier of identifiers) {
      const caseStyle = this.detectCaseStyle(identifier);
      if (caseStyle) {
        stats[caseStyle]++;
      } else {
        stats.inconsistentCase++;
      }
    }
    
    const issues = [];
    if (stats.inconsistentCase > identifiers.length * 0.2) {
      issues.push({
        severity: 'medium',
        message: '命名規則に一貫性がありません。一貫した命名規則を使用することを検討してください。'
      });
    }
    
    return {
      issues,
      summary: {
        totalIdentifiers: identifiers.length,
        ...stats
      }
    };
  },
  
  /**
   * JavaScriptの変数宣言を抽出
   * @param {string} code コード文字列
   * @returns {Array<Object>} 変数情報の配列
   */
  extractJavaScriptVariables(code) {
    const variables = [];
    const varRegex = /(?:const|let|var)\s+(\w+)\s*(?:=|;)/g;
    
    let match;
    while ((match = varRegex.exec(code)) !== null) {
      const name = match[1];
      const line = this.getLineNumberFromIndex(code, match.index);
      const column = match.index - this.getLineStartIndexFromLineNumber(code, line);
      
      variables.push({
        name,
        line,
        column
      });
    }
    
    return variables;
  },
  
  /**
   * JavaScriptの関数宣言を抽出
   * @param {string} code コード文字列
   * @returns {Array<Object>} 関数情報の配列
   */
  extractJavaScriptFunctions(code) {
    const functions = [];
    const funcRegex = /function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*function/g;
    
    let match;
    while ((match = funcRegex.exec(code)) !== null) {
      const name = match[1] || match[2];
      const line = this.getLineNumberFromIndex(code, match.index);
      const column = match.index - this.getLineStartIndexFromLineNumber(code, line);
      
      functions.push({
        name,
        line,
        column
      });
    }
    
    // アロー関数も検出
    const arrowFuncRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]*)\s*=>/g;
    while ((match = arrowFuncRegex.exec(code)) !== null) {
      const name = match[1];
      const line = this.getLineNumberFromIndex(code, match.index);
      const column = match.index - this.getLineStartIndexFromLineNumber(code, line);
      
      functions.push({
        name,
        line,
        column
      });
    }
    
    return functions;
  },
  
  /**
   * JavaScriptのクラス宣言を抽出
   * @param {string} code コード文字列
   * @returns {Array<Object>} クラス情報の配列
   */
  extractJavaScriptClasses(code) {
    const classes = [];
    const classRegex = /class\s+(\w+)/g;
    
    let match;
    while ((match = classRegex.exec(code)) !== null) {
      const name = match[1];
      const line = this.getLineNumberFromIndex(code, match.index);
      const column = match.index - this.getLineStartIndexFromLineNumber(code, line);
      
      classes.push({
        name,
        line,
        column
      });
    }
    
    return classes;
  },
  
  /**
   * Pythonの変数宣言を抽出
   * @param {string} code コード文字列
   * @returns {Array<Object>} 変数情報の配列
   */
  extractPythonVariables(code) {
    const variables = [];
    const varRegex = /(\w+)\s*=\s*(?!function|class|def)/g;
    
    let match;
    while ((match = varRegex.exec(code)) !== null) {
      const name = match[1];
      const line = this.getLineNumberFromIndex(code, match.index);
      const column = match.index - this.getLineStartIndexFromLineNumber(code, line);
      
      variables.push({
        name,
        line,
        column
      });
    }
    
    return variables;
  },
  
  /**
   * Pythonの関数宣言を抽出
   * @param {string} code コード文字列
   * @returns {Array<Object>} 関数情報の配列
   */
  extractPythonFunctions(code) {
    const functions = [];
    const funcRegex = /def\s+(\w+)\s*\(/g;
    
    let match;
    while ((match = funcRegex.exec(code)) !== null) {
      const name = match[1];
      const line = this.getLineNumberFromIndex(code, match.index);
      const column = match.index - this.getLineStartIndexFromLineNumber(code, line);
      
      functions.push({
        name,
        line,
        column
      });
    }
    
    return functions;
  },
  
  /**
   * Pythonのクラス宣言を抽出
   * @param {string} code コード文字列
   * @returns {Array<Object>} クラス情報の配列
   */
  extractPythonClasses(code) {
    const classes = [];
    const classRegex = /class\s+(\w+)/g;
    
    let match;
    while ((match = classRegex.exec(code)) !== null) {
      const name = match[1];
      const line = this.getLineNumberFromIndex(code, match.index);
      const column = match.index - this.getLineStartIndexFromLineNumber(code, line);
      
      classes.push({
        name,
        line,
        column
      });
    }
    
    return classes;
  },
  
  /**
   * 命名規則のスタイルを検出
   * @param {string} name 識別子名
   * @returns {string|null} 命名規則スタイル（camelCase, pascalCase, snakeCase）またはnull
   */
  detectCaseStyle(name) {
    if (this.isCamelCase(name)) {
      return 'camelCase';
    } else if (this.isPascalCase(name)) {
      return 'pascalCase';
    } else if (this.isSnakeCase(name)) {
      return 'snakeCase';
    }
    return null;
  },
  
  /**
   * キャメルケースかどうかをチェック
   * @param {string} name 識別子名
   * @returns {boolean} キャメルケースならtrue
   */
  isCamelCase(name) {
    return /^[a-z][a-zA-Z0-9]*$/.test(name) && name.includes(/[A-Z]/) && !name.includes('_');
  },
  
  /**
   * パスカルケースかどうかをチェック
   * @param {string} name 識別子名
   * @returns {boolean} パスカルケースならtrue
   */
  isPascalCase(name) {
    return /^[A-Z][a-zA-Z0-9]*$/.test(name) && !name.includes('_');
  },
  
  /**
   * スネークケースかどうかをチェック
   * @param {string} name 識別子名
   * @returns {boolean} スネークケースならtrue
   */
  isSnakeCase(name) {
    return /^[a-z][a-z0-9_]*$/.test(name) && name.includes('_');
  },
  
  /**
   * 定数かどうかをチェック
   * @param {string} name 識別子名
   * @returns {boolean} 定数ならtrue
   */
  isConstant(name) {
    return /^[A-Z][A-Z0-9_]*$/.test(name);
  },
  
  /**
   * キーワードかどうかをチェック
   * @param {string} word 単語
   * @returns {boolean} キーワードならtrue
   */
  isKeyword(word) {
    const keywords = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
      'continue', 'return', 'function', 'var', 'let', 'const', 'class',
      'import', 'export', 'from', 'try', 'catch', 'finally', 'throw',
      'new', 'this', 'super', 'extends', 'static', 'get', 'set',
      'def', 'pass', 'raise', 'except', 'with', 'as', 'lambda', 'yield'
    ];
    return keywords.includes(word);
  },
  
  /**
   * キャメルケースに変換
   * @param {string} name 識別子名
   * @returns {string} キャメルケースに変換した名前
   */
  convertToCamelCase(name) {
    if (this.isSnakeCase(name)) {
      return name.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    } else if (this.isPascalCase(name)) {
      return name.charAt(0).toLowerCase() + name.slice(1);
    }
    return name;
  },
  
  /**
   * パスカルケースに変換
   * @param {string} name 識別子名
   * @returns {string} パスカルケースに変換した名前
   */
  convertToPascalCase(name) {
    if (this.isSnakeCase(name)) {
      return name.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
    } else if (this.isCamelCase(name)) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return name;
  },
  
  /**
   * スネークケースに変換
   * @param {string} name 識別子名
   * @returns {string} スネークケースに変換した名前
   */
  convertToSnakeCase(name) {
    if (this.isCamelCase(name) || this.isPascalCase(name)) {
      return name.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
    return name;
  },
  
  /**
   * 命名規則の一貫性を分析
   * @param {Object} stats 統計情報
   * @param {number} totalIdentifiers 識別子の総数
   * @returns {Object|null} 一貫性の問題またはnull
   */
  analyzeConsistency(stats, totalIdentifiers) {
    if (totalIdentifiers < 5) {
      return null; // 識別子が少なすぎる場合は分析しない
    }
    
    const inconsistencyRatio = stats.inconsistentCase / totalIdentifiers;
    if (inconsistencyRatio > 0.2) {
      return {
        severity: 'medium',
        message: '命名規則に一貫性がありません。一貫した命名規則を使用することを検討してください。',
        details: {
          inconsistencyRatio: Math.round(inconsistencyRatio * 100) / 100,
          stats
        }
      };
    }
    
    return null;
  },
  
  /**
   * インデックスから行番号を取得
   * @param {string} code コード全体
   * @param {number} index インデックス
   * @returns {number} 行番号（0ベース）
   */
  getLineNumberFromIndex(code, index) {
    const lines = code.substring(0, index).split('\n');
    return lines.length - 1;
  },
  
  /**
   * 行番号から行の開始インデックスを取得
   * @param {string} code コード全体
   * @param {number} lineNumber 行番号（0ベース）
   * @returns {number} 行の開始インデックス
   */
  getLineStartIndexFromLineNumber(code, lineNumber) {
    const lines = code.split('\n');
    let index = 0;
    
    for (let i = 0; i < lineNumber; i++) {
      index += lines[i].length + 1; // +1 for newline
    }
    
    return index;
  }
};

export default namingRule;
