/**
 * コメント率分析ルール
 * コード内のコメント行の割合を計算し、改善のための推奨事項を提供
 */

/**
 * コメント率分析ルール
 */
const commentsRule = {
  name: 'コメント率分析',
  description: 'コード内のコメント行の割合を計算し、改善のための推奨事項を提供します',
  
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
      case 'java':
        return this.analyzeJava(code);
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
    // コメントパターン
    const singleLineCommentPattern = /\/\/.*/g;
    const multiLineCommentPattern = /\/\*[\s\S]*?\*\//g;
    const jsdocCommentPattern = /\/\*\*[\s\S]*?\*\//g;
    
    return this.analyzeWithPatterns(code, {
      singleLine: singleLineCommentPattern,
      multiLine: multiLineCommentPattern,
      docComment: jsdocCommentPattern
    });
  },
  
  /**
   * Pythonコードを分析
   * @param {string} code コード文字列
   * @returns {Object} 分析結果
   */
  analyzePython(code) {
    // コメントパターン
    const singleLineCommentPattern = /#.*/g;
    const multiLineCommentPattern = /'''[\s\S]*?'''|"""[\s\S]*?"""/g;
    const docCommentPattern = /'''[\s\S]*?'''|"""[\s\S]*?"""/g;
    
    return this.analyzeWithPatterns(code, {
      singleLine: singleLineCommentPattern,
      multiLine: multiLineCommentPattern,
      docComment: docCommentPattern
    });
  },
  
  /**
   * Javaコードを分析
   * @param {string} code コード文字列
   * @returns {Object} 分析結果
   */
  analyzeJava(code) {
    // コメントパターン
    const singleLineCommentPattern = /\/\/.*/g;
    const multiLineCommentPattern = /\/\*[\s\S]*?\*\//g;
    const javadocCommentPattern = /\/\*\*[\s\S]*?\*\//g;
    
    return this.analyzeWithPatterns(code, {
      singleLine: singleLineCommentPattern,
      multiLine: multiLineCommentPattern,
      docComment: javadocCommentPattern
    });
  },
  
  /**
   * 汎用的なコード分析
   * @param {string} code コード文字列
   * @returns {Object} 分析結果
   */
  analyzeGeneric(code) {
    // 一般的なコメントパターン
    const singleLineCommentPattern = /(?:\/\/|#).*/g;
    const multiLineCommentPattern = /\/\*[\s\S]*?\*\/|'''[\s\S]*?'''|"""[\s\S]*?"""/g;
    
    return this.analyzeWithPatterns(code, {
      singleLine: singleLineCommentPattern,
      multiLine: multiLineCommentPattern
    });
  },
  
  /**
   * 指定されたパターンでコードを分析
   * @param {string} code コード文字列
   * @param {Object} patterns コメントパターン
   * @returns {Object} 分析結果
   */
  analyzeWithPatterns(code, patterns) {
    // 元のコードを保存
    const originalCode = code;
    
    // コメント行を抽出
    let commentLines = [];
    let codeWithoutComments = code;
    
    // 単一行コメントを抽出
    if (patterns.singleLine) {
      const singleLineComments = code.match(patterns.singleLine) || [];
      commentLines = commentLines.concat(singleLineComments);
      codeWithoutComments = codeWithoutComments.replace(patterns.singleLine, '');
    }
    
    // 複数行コメントを抽出
    if (patterns.multiLine) {
      const multiLineComments = code.match(patterns.multiLine) || [];
      commentLines = commentLines.concat(multiLineComments);
      codeWithoutComments = codeWithoutComments.replace(patterns.multiLine, match => {
        // 複数行コメント内の改行を保持
        return match.replace(/[^\n]/g, '');
      });
    }
    
    // ドキュメントコメントを抽出
    if (patterns.docComment) {
      const docComments = code.match(patterns.docComment) || [];
      // docCommentsはmultiLineCommentsと重複する可能性があるため、カウントのみ
    }
    
    // 行数をカウント
    const totalLines = originalCode.split('\n').length;
    const codeLines = codeWithoutComments.split('\n')
      .filter(line => line.trim().length > 0).length;
    const blankLines = codeWithoutComments.split('\n')
      .filter(line => line.trim().length === 0).length;
    
    // コメント行数を計算（複数行コメントを考慮）
    let commentLinesCount = 0;
    for (const comment of commentLines) {
      commentLinesCount += comment.split('\n').length;
    }
    
    // 重複カウントを避けるための調整
    commentLinesCount = Math.min(commentLinesCount, totalLines - blankLines);
    
    // コメント率を計算
    const commentRatio = totalLines > 0 ? commentLinesCount / totalLines : 0;
    const commentRatioToCode = codeLines > 0 ? commentLinesCount / codeLines : 0;
    
    // 分析結果
    const result = {
      totalLines,
      codeLines,
      commentLines: commentLinesCount,
      blankLines,
      commentRatio: Math.round(commentRatio * 100) / 100,
      commentRatioToCode: Math.round(commentRatioToCode * 100) / 100
    };
    
    // 推奨事項
    const issues = [];
    
    if (commentRatio < 0.1 && totalLines > 20) {
      issues.push({
        severity: 'medium',
        message: 'コメントが少なすぎます。コードの理解を助けるためにコメントを追加することを検討してください。',
        details: {
          commentRatio: result.commentRatio,
          recommendedMinimum: 0.1
        }
      });
    } else if (commentRatio > 0.4) {
      issues.push({
        severity: 'low',
        message: 'コメントが多すぎる可能性があります。自己説明的なコードを書くことを検討してください。',
        details: {
          commentRatio: result.commentRatio,
          recommendedMaximum: 0.4
        }
      });
    }
    
    if (codeLines > 0 && commentLinesCount === 0 && totalLines > 10) {
      issues.push({
        severity: 'high',
        message: 'コメントがありません。少なくとも基本的な説明コメントを追加してください。',
        details: {
          commentLines: 0,
          totalLines
        }
      });
    }
    
    return {
      issues,
      summary: result
    };
  }
};

export default commentsRule;
