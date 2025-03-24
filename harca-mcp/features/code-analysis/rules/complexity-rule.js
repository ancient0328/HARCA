/**
 * 複雑度分析ルール
 * コードの複雑さを分析し、改善のための推奨事項を提供
 */

/**
 * 複雑度分析ルール
 */
const complexityRule = {
  name: '複雑度分析',
  description: '関数やメソッドの複雑さを分析し、改善のための推奨事項を提供します',
  
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
    const functions = this.extractJavaScriptFunctions(code);
    const issues = [];
    
    for (const func of functions) {
      const complexity = this.calculateComplexity(func.body);
      
      if (complexity.score > 15) {
        issues.push({
          severity: 'high',
          message: `関数 ${func.name} の複雑度が非常に高いです (${complexity.score})。リファクタリングを検討してください。`,
          location: {
            line: func.line,
            column: func.column
          },
          details: complexity
        });
      } else if (complexity.score > 10) {
        issues.push({
          severity: 'medium',
          message: `関数 ${func.name} の複雑度が高いです (${complexity.score})。分割を検討してください。`,
          location: {
            line: func.line,
            column: func.column
          },
          details: complexity
        });
      } else if (complexity.score > 5) {
        issues.push({
          severity: 'low',
          message: `関数 ${func.name} の複雑度がやや高いです (${complexity.score})。`,
          location: {
            line: func.line,
            column: func.column
          },
          details: complexity
        });
      }
    }
    
    return {
      issues,
      summary: {
        functionCount: functions.length,
        averageComplexity: functions.length > 0 
          ? functions.reduce((sum, func) => sum + this.calculateComplexity(func.body).score, 0) / functions.length
          : 0
      }
    };
  },
  
  /**
   * Pythonコードを分析
   * @param {string} code コード文字列
   * @returns {Object} 分析結果
   */
  analyzePython(code) {
    const functions = this.extractPythonFunctions(code);
    const issues = [];
    
    for (const func of functions) {
      const complexity = this.calculateComplexity(func.body);
      
      if (complexity.score > 15) {
        issues.push({
          severity: 'high',
          message: `関数 ${func.name} の複雑度が非常に高いです (${complexity.score})。リファクタリングを検討してください。`,
          location: {
            line: func.line,
            column: func.column
          },
          details: complexity
        });
      } else if (complexity.score > 10) {
        issues.push({
          severity: 'medium',
          message: `関数 ${func.name} の複雑度が高いです (${complexity.score})。分割を検討してください。`,
          location: {
            line: func.line,
            column: func.column
          },
          details: complexity
        });
      } else if (complexity.score > 5) {
        issues.push({
          severity: 'low',
          message: `関数 ${func.name} の複雑度がやや高いです (${complexity.score})。`,
          location: {
            line: func.line,
            column: func.column
          },
          details: complexity
        });
      }
    }
    
    return {
      issues,
      summary: {
        functionCount: functions.length,
        averageComplexity: functions.length > 0 
          ? functions.reduce((sum, func) => sum + this.calculateComplexity(func.body).score, 0) / functions.length
          : 0
      }
    };
  },
  
  /**
   * 汎用的なコード分析
   * @param {string} code コード文字列
   * @returns {Object} 分析結果
   */
  analyzeGeneric(code) {
    const lines = code.split('\n');
    const complexity = this.calculateGenericComplexity(code);
    const issues = [];
    
    if (complexity.score > 15) {
      issues.push({
        severity: 'high',
        message: `コードの複雑度が非常に高いです (${complexity.score})。リファクタリングを検討してください。`,
        location: {
          line: 1,
          column: 1
        },
        details: complexity
      });
    } else if (complexity.score > 10) {
      issues.push({
        severity: 'medium',
        message: `コードの複雑度が高いです (${complexity.score})。分割を検討してください。`,
        location: {
          line: 1,
          column: 1
        },
        details: complexity
      });
    }
    
    return {
      issues,
      summary: {
        lineCount: lines.length,
        complexity: complexity.score
      }
    };
  },
  
  /**
   * JavaScriptの関数を抽出
   * @param {string} code コード文字列
   * @returns {Array<Object>} 関数情報の配列
   */
  extractJavaScriptFunctions(code) {
    const functions = [];
    const lines = code.split('\n');
    
    // 関数宣言を検出する簡易的な正規表現
    // 注: 完全な構文解析ではないため、複雑なケースでは誤検出の可能性あり
    const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)|(?:class\s+\w+\s*{[\s\S]*?(?:constructor|(\w+))\s*\([^)]*\)))/g;
    
    let match;
    let lineIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineStartIndex = lineIndex;
      lineIndex += line.length + 1; // +1 for newline
      
      let localCode = code.substring(lineStartIndex);
      const localRegex = new RegExp(functionRegex.source, 'g');
      
      while ((match = localRegex.exec(localCode)) !== null) {
        // 関数名を取得
        const name = match[1] || match[2] || match[3] || 'anonymous';
        
        // 関数の開始位置を計算
        const startIndex = lineStartIndex + match.index;
        const startLine = this.getLineNumberFromIndex(code, startIndex);
        const startColumn = startIndex - this.getLineStartIndexFromLineNumber(code, startLine);
        
        // 関数本体を抽出
        const body = this.extractFunctionBody(code, startIndex);
        
        functions.push({
          name,
          line: startLine,
          column: startColumn,
          body
        });
        
        // 次の検索位置を更新
        localRegex.lastIndex = match.index + match[0].length;
      }
    }
    
    return functions;
  },
  
  /**
   * Python関数を抽出
   * @param {string} code コード文字列
   * @returns {Array<Object>} 関数情報の配列
   */
  extractPythonFunctions(code) {
    const functions = [];
    const lines = code.split('\n');
    
    // Python関数定義を検出する簡易的な正規表現
    const functionRegex = /def\s+(\w+)\s*\([^)]*\)\s*:/g;
    
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      const name = match[1];
      const startIndex = match.index;
      const startLine = this.getLineNumberFromIndex(code, startIndex);
      const startColumn = startIndex - this.getLineStartIndexFromLineNumber(code, startLine);
      
      // 関数本体を抽出
      const body = this.extractPythonFunctionBody(code, startIndex, lines);
      
      functions.push({
        name,
        line: startLine,
        column: startColumn,
        body
      });
    }
    
    return functions;
  },
  
  /**
   * 関数本体を抽出
   * @param {string} code コード全体
   * @param {number} startIndex 関数開始位置
   * @returns {string} 関数本体
   */
  extractFunctionBody(code, startIndex) {
    let openBraces = 0;
    let bodyStartIndex = -1;
    let bodyEndIndex = -1;
    
    for (let i = startIndex; i < code.length; i++) {
      const char = code[i];
      
      if (char === '{') {
        if (openBraces === 0) {
          bodyStartIndex = i;
        }
        openBraces++;
      } else if (char === '}') {
        openBraces--;
        if (openBraces === 0) {
          bodyEndIndex = i + 1;
          break;
        }
      } else if (char === '=' && code[i+1] === '>') {
        // アロー関数の場合
        if (code[i+2] === '{') {
          // ブロック本体のアロー関数
          bodyStartIndex = i + 2;
          i += 2;
          openBraces = 1;
        } else {
          // 式本体のアロー関数
          bodyStartIndex = i + 2;
          // 式の終わりを見つける
          for (let j = i + 2; j < code.length; j++) {
            if (code[j] === ';' || code[j] === '\n' || code[j] === ',') {
              bodyEndIndex = j;
              break;
            }
          }
          if (bodyEndIndex === -1) {
            bodyEndIndex = code.length;
          }
          break;
        }
      }
    }
    
    if (bodyStartIndex !== -1 && bodyEndIndex !== -1) {
      return code.substring(bodyStartIndex, bodyEndIndex);
    }
    
    // 本体が見つからない場合は空文字列を返す
    return '';
  },
  
  /**
   * Python関数本体を抽出
   * @param {string} code コード全体
   * @param {number} startIndex 関数開始位置
   * @param {Array<string>} lines コード行の配列
   * @returns {string} 関数本体
   */
  extractPythonFunctionBody(code, startIndex, lines) {
    const startLine = this.getLineNumberFromIndex(code, startIndex);
    let endLine = startLine;
    const baseIndent = this.getIndentation(lines[startLine]);
    
    // 関数の終わりを見つける
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '' || line.startsWith(' ') || line.startsWith('\t')) {
        // 空行またはインデントされた行は関数本体の一部
        endLine = i;
      } else {
        // インデントされていない行は関数の外
        break;
      }
    }
    
    // 関数本体を抽出
    return lines.slice(startLine, endLine + 1).join('\n');
  },
  
  /**
   * 行のインデントを取得
   * @param {string} line 行
   * @returns {number} インデント数
   */
  getIndentation(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
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
  },
  
  /**
   * コードの複雑度を計算
   * @param {string} code コード文字列
   * @returns {Object} 複雑度情報
   */
  calculateComplexity(code) {
    // 条件分岐の数をカウント
    const ifCount = (code.match(/if\s*\(/g) || []).length;
    const elseIfCount = (code.match(/else\s+if\s*\(/g) || []).length;
    const elseCount = (code.match(/else\s*{/g) || []).length;
    const switchCount = (code.match(/switch\s*\(/g) || []).length;
    const caseCount = (code.match(/case\s+/g) || []).length;
    
    // ループの数をカウント
    const forCount = (code.match(/for\s*\(/g) || []).length;
    const whileCount = (code.match(/while\s*\(/g) || []).length;
    const doWhileCount = (code.match(/do\s*{/g) || []).length;
    
    // 例外処理の数をカウント
    const tryCount = (code.match(/try\s*{/g) || []).length;
    const catchCount = (code.match(/catch\s*\(/g) || []).length;
    
    // 論理演算子の数をカウント
    const andCount = (code.match(/&&/g) || []).length;
    const orCount = (code.match(/\|\|/g) || []).length;
    
    // 三項演算子の数をカウント
    const ternaryCount = (code.match(/\?.*:/g) || []).length;
    
    // 行数をカウント
    const lineCount = code.split('\n').length;
    
    // 複雑度スコアを計算
    const score = 
      ifCount + elseIfCount + elseCount * 0.5 + 
      switchCount * 2 + caseCount * 0.5 + 
      forCount * 1.5 + whileCount * 1.5 + doWhileCount * 2 + 
      tryCount + catchCount + 
      andCount * 0.3 + orCount * 0.3 + 
      ternaryCount * 0.5 + 
      Math.max(0, lineCount - 10) * 0.1;
    
    return {
      score: Math.round(score * 10) / 10, // 小数点第1位まで
      details: {
        conditionals: {
          if: ifCount,
          elseIf: elseIfCount,
          else: elseCount,
          switch: switchCount,
          case: caseCount,
          ternary: ternaryCount
        },
        loops: {
          for: forCount,
          while: whileCount,
          doWhile: doWhileCount
        },
        errorHandling: {
          try: tryCount,
          catch: catchCount
        },
        logicalOperators: {
          and: andCount,
          or: orCount
        },
        lineCount
      }
    };
  },
  
  /**
   * 汎用的な複雑度計算
   * @param {string} code コード文字列
   * @returns {Object} 複雑度情報
   */
  calculateGenericComplexity(code) {
    const lines = code.split('\n');
    const lineCount = lines.length;
    
    // 行の長さの平均を計算
    const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lineCount;
    
    // インデントの深さを計算
    const indentDepths = lines.map(line => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    });
    const maxIndentDepth = Math.max(...indentDepths);
    const avgIndentDepth = indentDepths.reduce((sum, depth) => sum + depth, 0) / lineCount;
    
    // 複雑度スコアを計算
    const score = 
      Math.min(20, lineCount / 10) + 
      Math.min(10, avgLineLength / 10) + 
      Math.min(10, maxIndentDepth / 2) + 
      Math.min(10, avgIndentDepth);
    
    return {
      score: Math.round(score * 10) / 10, // 小数点第1位まで
      details: {
        lineCount,
        avgLineLength: Math.round(avgLineLength * 10) / 10,
        maxIndentDepth,
        avgIndentDepth: Math.round(avgIndentDepth * 10) / 10
      }
    };
  }
};

export default complexityRule;
