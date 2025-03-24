/**
 * 重複コード検出ルール
 * コード内の重複を検出し、リファクタリングの候補を特定
 */

/**
 * 重複コード検出ルール
 */
const duplicationRule = {
  name: '重複コード検出',
  description: 'コード内の重複を検出し、リファクタリングの候補を特定します',
  
  /**
   * コードを分析
   * @param {string} code コード文字列
   * @param {string} language 言語
   * @param {Object} options オプション
   * @returns {Object} 分析結果
   */
  analyze(code, language = 'javascript', options = {}) {
    const {
      minBlockSize = 3, // 最小ブロックサイズ（行数）
      minDuplicateCount = 2, // 最小重複数
      ignoreWhitespace = true, // 空白を無視するかどうか
      ignoreComments = true // コメントを無視するかどうか
    } = options;
    
    // コードを前処理
    const processedCode = this.preprocessCode(code, language, { ignoreWhitespace, ignoreComments });
    
    // コードを行に分割
    const lines = processedCode.split('\n');
    
    // 重複ブロックを検出
    const duplicateBlocks = this.findDuplicateBlocks(lines, minBlockSize, minDuplicateCount);
    
    // 分析結果
    const issues = [];
    
    // 重複ブロックごとに問題を報告
    for (const block of duplicateBlocks) {
      const { content, occurrences, size } = block;
      
      // 重複の深刻度を計算
      const severity = this.calculateSeverity(size, occurrences.length);
      
      issues.push({
        severity,
        message: `${occurrences.length}箇所で${size}行の重複コードが見つかりました。共通の関数やメソッドにリファクタリングすることを検討してください。`,
        details: {
          blockSize: size,
          occurrences: occurrences.length,
          locations: occurrences.map(occurrence => ({
            startLine: occurrence.startLine,
            endLine: occurrence.startLine + size - 1
          })),
          content: content.join('\n')
        }
      });
    }
    
    return {
      issues,
      summary: {
        totalDuplicateBlocks: duplicateBlocks.length,
        totalDuplicateLines: duplicateBlocks.reduce((total, block) => total + block.size * (block.occurrences.length - 1), 0),
        duplicateBlocksBySize: this.groupDuplicateBlocksBySize(duplicateBlocks)
      }
    };
  },
  
  /**
   * コードを前処理
   * @param {string} code コード文字列
   * @param {string} language 言語
   * @param {Object} options オプション
   * @returns {string} 前処理されたコード
   */
  preprocessCode(code, language, options) {
    const { ignoreWhitespace, ignoreComments } = options;
    let processedCode = code;
    
    // コメントを削除
    if (ignoreComments) {
      processedCode = this.removeComments(processedCode, language);
    }
    
    // 空白を正規化
    if (ignoreWhitespace) {
      processedCode = this.normalizeWhitespace(processedCode);
    }
    
    return processedCode;
  },
  
  /**
   * コメントを削除
   * @param {string} code コード文字列
   * @param {string} language 言語
   * @returns {string} コメントを削除したコード
   */
  removeComments(code, language) {
    let processedCode = code;
    
    switch (language) {
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
      case 'java':
      case 'c':
      case 'cpp':
        // 単一行コメントを削除
        processedCode = processedCode.replace(/\/\/.*$/gm, '');
        // 複数行コメントを削除
        processedCode = processedCode.replace(/\/\*[\s\S]*?\*\//g, '');
        break;
        
      case 'python':
      case 'py':
        // 単一行コメントを削除
        processedCode = processedCode.replace(/#.*$/gm, '');
        // 複数行コメントを削除（ドキュメント文字列）
        processedCode = processedCode.replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, '');
        break;
        
      case 'html':
        // HTMLコメントを削除
        processedCode = processedCode.replace(/<!--[\s\S]*?-->/g, '');
        break;
        
      default:
        // 一般的なコメントパターンを削除
        processedCode = processedCode.replace(/(?:\/\/|#).*$/gm, '');
        processedCode = processedCode.replace(/\/\*[\s\S]*?\*\/|'''[\s\S]*?'''|"""[\s\S]*?"""/g, '');
    }
    
    return processedCode;
  },
  
  /**
   * 空白を正規化
   * @param {string} code コード文字列
   * @returns {string} 空白を正規化したコード
   */
  normalizeWhitespace(code) {
    // 各行の先頭と末尾の空白を削除
    let processedCode = code.split('\n').map(line => line.trim()).join('\n');
    
    // 連続する空白を1つの空白に置換
    processedCode = processedCode.replace(/\s+/g, ' ');
    
    // 空行を削除
    processedCode = processedCode.split('\n').filter(line => line.trim().length > 0).join('\n');
    
    return processedCode;
  },
  
  /**
   * 重複ブロックを検出
   * @param {Array<string>} lines コード行の配列
   * @param {number} minBlockSize 最小ブロックサイズ
   * @param {number} minDuplicateCount 最小重複数
   * @returns {Array<Object>} 重複ブロックの配列
   */
  findDuplicateBlocks(lines, minBlockSize, minDuplicateCount) {
    const duplicateBlocks = [];
    const blockHashes = new Map();
    
    // 各行からブロックを生成し、ハッシュ化
    for (let i = 0; i <= lines.length - minBlockSize; i++) {
      for (let blockSize = minBlockSize; blockSize <= Math.min(30, lines.length - i); blockSize++) {
        const block = lines.slice(i, i + blockSize);
        const blockContent = block.join('\n');
        const blockHash = this.hashCode(blockContent);
        
        if (!blockHashes.has(blockHash)) {
          blockHashes.set(blockHash, []);
        }
        
        blockHashes.get(blockHash).push({
          startLine: i,
          content: block
        });
      }
    }
    
    // 重複ブロックを抽出
    for (const [hash, occurrences] of blockHashes.entries()) {
      if (occurrences.length >= minDuplicateCount) {
        const { content } = occurrences[0];
        
        // 既に報告済みのサブブロックかどうかをチェック
        const isSubBlock = duplicateBlocks.some(existingBlock => {
          return existingBlock.content.join('\n').includes(content.join('\n')) &&
                 existingBlock.content.length > content.length;
        });
        
        if (!isSubBlock) {
          duplicateBlocks.push({
            content,
            size: content.length,
            occurrences
          });
        }
      }
    }
    
    // ブロックサイズの降順でソート
    return duplicateBlocks.sort((a, b) => b.size - a.size);
  },
  
  /**
   * 文字列のハッシュコードを計算
   * @param {string} str 文字列
   * @returns {string} ハッシュコード
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32ビット整数に変換
    }
    return hash.toString();
  },
  
  /**
   * 重複の深刻度を計算
   * @param {number} blockSize ブロックサイズ
   * @param {number} occurrenceCount 出現回数
   * @returns {string} 深刻度（'low', 'medium', 'high'）
   */
  calculateSeverity(blockSize, occurrenceCount) {
    const duplicationScore = blockSize * (occurrenceCount - 1);
    
    if (duplicationScore >= 50) {
      return 'high';
    } else if (duplicationScore >= 20) {
      return 'medium';
    } else {
      return 'low';
    }
  },
  
  /**
   * 重複ブロックをサイズ別にグループ化
   * @param {Array<Object>} duplicateBlocks 重複ブロックの配列
   * @returns {Object} サイズ別のグループ
   */
  groupDuplicateBlocksBySize(duplicateBlocks) {
    const groups = {};
    
    for (const block of duplicateBlocks) {
      const { size } = block;
      
      if (!groups[size]) {
        groups[size] = 0;
      }
      
      groups[size]++;
    }
    
    return groups;
  }
};

export default duplicationRule;
