---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - 基本概念）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - 基本概念）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析の基本概念について説明します。適応型検索とは、クエリの特性を分析し、最適な検索戦略を自動的に選択する手法です。

適応型検索は以下の要素から構成されます：

1. **クエリ分析**：クエリの特性（キーワード中心、セマンティック中心、混合型）を分析
2. **言語処理**：クエリの言語を検出し、言語に応じた処理を適用
3. **戦略選択**：クエリ分析の結果に基づいて最適な検索戦略を選択
4. **結果の再ランキング**：複数の検索結果を組み合わせて最終的なランキングを生成

本ドキュメントでは、これらの要素のうち、クエリ分析の基本概念に焦点を当てます。

## 2. 前提条件

適応型検索のためのクエリ分析の実装には、以下のモジュールが必要です：

- `db-config.js`：データベース接続設定
- `embedding-util.js`：埋め込み生成ユーティリティ
- `query-util.js`：クエリ前処理ユーティリティ

これらのモジュールの詳細については、[ハイブリッド検索（Node.js基本実装 - 設定）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-config.md)を参照してください。

また、以下の追加モジュールが必要です：

```javascript
// package.json の依存関係
{
  "dependencies": {
    "pg-promise": "^10.15.0",
    "openai": "^4.0.0",
    "natural": "^6.2.0",
    "kuromoji": "^0.1.2",
    "franc": "^6.1.0",
    "langdetect": "^0.2.1",
    "dotenv": "^16.0.0"
  }
}
```

- `franc`：言語検出ライブラリ
- `langdetect`：より精度の高い言語検出のためのライブラリ
- `natural`：自然言語処理ライブラリ（英語の処理に使用）
- `kuromoji`：日本語形態素解析ライブラリ

## 3. クエリ分析の基本概念

クエリ分析は、以下の観点からクエリを分析し、最適な検索戦略を選択するための情報を提供します：

1. **クエリタイプ**：キーワード中心、セマンティック中心、混合型
2. **クエリの言語**：日本語、英語、その他
3. **クエリの複雑さ**：単純、中程度、複雑
4. **クエリの長さ**：短い、中程度、長い
5. **クエリの構造**：質問、命令、宣言、その他

### 3.1 クエリ分析の基本構造

クエリ分析の基本構造は以下のとおりです：

```javascript
// query-analyzer.js
const franc = require('franc');
const natural = require('natural');
const { TfIdf } = natural;
const { tokenizer: kuromojiTokenizer } = require('kuromoji');

/**
 * クエリ分析器クラス
 */
class QueryAnalyzer {
  constructor(options = {}) {
    // デフォルトオプション
    this.options = {
      minKeywordQueryLength: 2,      // キーワードクエリの最小長
      minSemanticQueryLength: 5,     // セマンティッククエリの最小長
      keywordThreshold: 0.6,         // キーワード中心と判定するしきい値
      semanticThreshold: 0.7,        // セマンティック中心と判定するしきい値
      japaneseProbabilityThreshold: 0.5, // 日本語と判定するしきい値
      englishProbabilityThreshold: 0.5,  // 英語と判定するしきい値
      ...options
    };
    
    // 日本語トークナイザーの初期化
    this.initializeJapaneseTokenizer();
    
    // 英語トークナイザーの初期化
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
  }
  
  /**
   * 日本語トークナイザーを初期化する
   */
  initializeJapaneseTokenizer() {
    this.japaneseTokenizerReady = false;
    this.japaneseTokenizer = null;
    
    kuromojiTokenizer()
      .then(tokenizer => {
        this.japaneseTokenizer = tokenizer;
        this.japaneseTokenizerReady = true;
      })
      .catch(err => {
        console.error('日本語トークナイザーの初期化エラー:', err);
      });
  }
  
  /**
   * クエリを分析する
   * @param {string} query - 検索クエリ
   * @returns {object} - 分析結果
   */
  analyze(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('クエリは文字列である必要があります');
    }
    
    // クエリの基本的な特性を分析
    const queryLength = query.length;
    const wordCount = this.countWords(query);
    
    // クエリの言語を検出
    const language = this.detectLanguage(query);
    
    // クエリのタイプを判別
    const queryType = this.determineQueryType(query, language);
    
    // クエリの複雑さを分析
    const complexity = this.analyzeComplexity(query, language);
    
    // クエリの構造を分析
    const structure = this.analyzeStructure(query, language);
    
    // 分析結果を返す
    return {
      originalQuery: query,
      queryLength,
      wordCount,
      language,
      queryType,
      complexity,
      structure,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * クエリの単語数をカウントする
   * @param {string} query - 検索クエリ
   * @returns {number} - 単語数
   */
  countWords(query) {
    // 簡易的な単語カウント（空白で分割）
    return query.trim().split(/\s+/).length;
  }
  
  /**
   * クエリの言語を検出する
   * @param {string} query - 検索クエリ
   * @returns {object} - 言語情報
   */
  detectLanguage(query) {
    // francを使用して言語を検出
    const langCode = franc(query);
    
    // 言語コードから言語名を取得
    let languageName = 'unknown';
    let probability = 0;
    
    if (langCode === 'jpn') {
      languageName = 'japanese';
      probability = this.calculateJapaneseProbability(query);
    } else if (langCode === 'eng') {
      languageName = 'english';
      probability = this.calculateEnglishProbability(query);
    } else {
      // その他の言語
      languageName = langCode;
      probability = 0.5; // デフォルト値
    }
    
    return {
      code: langCode,
      name: languageName,
      probability
    };
  }
  
  /**
   * 日本語である確率を計算する
   * @param {string} query - 検索クエリ
   * @returns {number} - 日本語である確率
   */
  calculateJapaneseProbability(query) {
    // 日本語の文字（ひらがな、カタカナ、漢字）の割合を計算
    const japaneseChars = query.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || [];
    return japaneseChars.length / query.length;
  }
  
  /**
   * 英語である確率を計算する
   * @param {string} query - 検索クエリ
   * @returns {number} - 英語である確率
   */
  calculateEnglishProbability(query) {
    // 英語の文字（アルファベット）の割合を計算
    const englishChars = query.match(/[a-zA-Z]/g) || [];
    return englishChars.length / query.length;
  }
  
  /**
   * クエリのタイプを判別する
   * @param {string} query - 検索クエリ
   * @param {object} language - 言語情報
   * @returns {object} - クエリタイプ情報
   */
  determineQueryType(query, language) {
    // クエリの長さに基づく初期判定
    if (query.length < this.options.minKeywordQueryLength) {
      return {
        type: 'unknown',
        keywordScore: 0,
        semanticScore: 0
      };
    }
    
    // キーワードスコアを計算
    const keywordScore = this.calculateKeywordScore(query, language);
    
    // セマンティックスコアを計算
    const semanticScore = this.calculateSemanticScore(query, language);
    
    // タイプを判定
    let type = 'mixed';
    if (keywordScore >= this.options.keywordThreshold && semanticScore < this.options.semanticThreshold) {
      type = 'keyword';
    } else if (semanticScore >= this.options.semanticThreshold && keywordScore < this.options.keywordThreshold) {
      type = 'semantic';
    }
    
    return {
      type,
      keywordScore,
      semanticScore
    };
  }
  
  /**
   * キーワードスコアを計算する
   * @param {string} query - 検索クエリ
   * @param {object} language - 言語情報
   * @returns {number} - キーワードスコア
   */
  calculateKeywordScore(query, language) {
    // 言語に応じたキーワードスコアの計算
    if (language.name === 'japanese') {
      return this.calculateJapaneseKeywordScore(query);
    } else if (language.name === 'english') {
      return this.calculateEnglishKeywordScore(query);
    } else {
      // その他の言語はデフォルトの英語処理を使用
      return this.calculateEnglishKeywordScore(query);
    }
  }
  
  /**
   * 日本語のキーワードスコアを計算する
   * @param {string} query - 検索クエリ
   * @returns {number} - キーワードスコア
   */
  calculateJapaneseKeywordScore(query) {
    // 日本語トークナイザーが準備できていない場合は簡易的な計算を行う
    if (!this.japaneseTokenizerReady) {
      // 空白で分割して単語数をカウント
      const words = query.trim().split(/\s+/);
      // 単語数が少ないほどキーワード的
      return Math.max(0, Math.min(1, 1 - (words.length - 1) / 10));
    }
    
    // 日本語トークナイザーを使用して形態素解析
    const tokens = this.japaneseTokenizer.tokenize(query);
    
    // 名詞、動詞、形容詞の割合を計算
    const contentWords = tokens.filter(token => 
      token.pos === '名詞' || 
      token.pos === '動詞' || 
      token.pos === '形容詞'
    );
    
    // 内容語の割合が高いほどキーワード的
    return contentWords.length / tokens.length;
  }
  
  /**
   * 英語のキーワードスコアを計算する
   * @param {string} query - 検索クエリ
   * @returns {number} - キーワードスコア
   */
  calculateEnglishKeywordScore(query) {
    // 英語のトークナイザーを使用して単語に分割
    const tokens = this.tokenizer.tokenize(query);
    
    // ストップワードの割合を計算
    const stopwords = natural.stopwords;
    const stopwordCount = tokens.filter(token => 
      stopwords.includes(token.toLowerCase())
    ).length;
    
    // ストップワードの割合が低いほどキーワード的
    return Math.max(0, Math.min(1, 1 - stopwordCount / tokens.length));
  }
  
  /**
   * セマンティックスコアを計算する
   * @param {string} query - 検索クエリ
   * @param {object} language - 言語情報
   * @returns {number} - セマンティックスコア
   */
  calculateSemanticScore(query, language) {
    // クエリの長さが短すぎる場合はセマンティックスコアを低くする
    if (query.length < this.options.minSemanticQueryLength) {
      return 0.3;
    }
    
    // 言語に応じたセマンティックスコアの計算
    if (language.name === 'japanese') {
      return this.calculateJapaneseSemanticScore(query);
    } else if (language.name === 'english') {
      return this.calculateEnglishSemanticScore(query);
    } else {
      // その他の言語はデフォルトの英語処理を使用
      return this.calculateEnglishSemanticScore(query);
    }
  }
  
  /**
   * 日本語のセマンティックスコアを計算する
   * @param {string} query - 検索クエリ
   * @returns {number} - セマンティックスコア
   */
  calculateJapaneseSemanticScore(query) {
    // 日本語トークナイザーが準備できていない場合は簡易的な計算を行う
    if (!this.japaneseTokenizerReady) {
      // 文の長さが長いほどセマンティック的
      return Math.min(1, query.length / 20);
    }
    
    // 日本語トークナイザーを使用して形態素解析
    const tokens = this.japaneseTokenizer.tokenize(query);
    
    // 助詞、助動詞の割合を計算
    const functionWords = tokens.filter(token => 
      token.pos === '助詞' || 
      token.pos === '助動詞'
    );
    
    // 機能語の割合が高いほどセマンティック的
    return functionWords.length / tokens.length;
  }
  
  /**
   * 英語のセマンティックスコアを計算する
   * @param {string} query - 検索クエリ
   * @returns {number} - セマンティックスコア
   */
  calculateEnglishSemanticScore(query) {
    // 英語のトークナイザーを使用して単語に分割
    const tokens = this.tokenizer.tokenize(query);
    
    // ストップワードの割合を計算
    const stopwords = natural.stopwords;
    const stopwordCount = tokens.filter(token => 
      stopwords.includes(token.toLowerCase())
    ).length;
    
    // ストップワードの割合が高いほどセマンティック的
    return Math.min(1, stopwordCount / tokens.length);
  }
  
  /**
   * クエリの複雑さを分析する
   * @param {string} query - 検索クエリ
   * @param {object} language - 言語情報
   * @returns {object} - 複雑さ情報
   */
  analyzeComplexity(query, language) {
    // 単語数に基づく複雑さの計算
    const wordCount = this.countWords(query);
    
    let level = 'simple';
    if (wordCount > 15) {
      level = 'complex';
    } else if (wordCount > 5) {
      level = 'moderate';
    }
    
    // 言語に応じた複雑さの調整
    if (language.name === 'japanese') {
      // 日本語の場合、文字数も考慮
      if (query.length > 30) {
        level = 'complex';
      } else if (query.length > 10) {
        level = 'moderate';
      }
    }
    
    return {
      level,
      wordCount,
      characterCount: query.length
    };
  }
  
  /**
   * クエリの構造を分析する
   * @param {string} query - 検索クエリ
   * @param {object} language - 言語情報
   * @returns {object} - 構造情報
   */
  analyzeStructure(query, language) {
    // クエリの末尾に基づく構造の判定
    let type = 'statement';
    
    if (query.endsWith('?') || query.endsWith('？')) {
      type = 'question';
    } else if (query.endsWith('!') || query.endsWith('！')) {
      type = 'exclamation';
    } else if (language.name === 'japanese') {
      // 日本語の場合、特定の語尾パターンを検出
      if (query.endsWith('ですか') || query.endsWith('ますか')) {
        type = 'question';
      } else if (query.endsWith('てください') || query.endsWith('なさい')) {
        type = 'command';
      }
    } else if (language.name === 'english') {
      // 英語の場合、疑問詞で始まるかどうかを検出
      const questionWords = ['what', 'who', 'where', 'when', 'why', 'how'];
      const firstWord = query.trim().split(/\s+/)[0].toLowerCase();
      if (questionWords.includes(firstWord)) {
        type = 'question';
      }
    }
    
    return {
      type
    };
  }
}

module.exports = { QueryAnalyzer };
```

この実装では、以下の処理を行っています：

1. クエリの基本的な特性（長さ、単語数）を分析
2. クエリの言語を検出
3. クエリのタイプ（キーワード中心、セマンティック中心、混合型）を判別
4. クエリの複雑さを分析
5. クエリの構造（質問、命令、宣言）を分析

## 4. クエリ分析の使用例

以下の例では、クエリ分析器を使用してクエリを分析する方法を示します：

```javascript
// example.js
const { QueryAnalyzer } = require('./query-analyzer');

async function example() {
  try {
    // クエリ分析器のインスタンスを作成
    const analyzer = new QueryAnalyzer();
    
    // クエリを分析
    const queries = [
      'ニューラルネットワーク 学習方法',
      'ニューラルネットワークの学習方法について教えてください',
      'What is machine learning?',
      'machine learning algorithm comparison'
    ];
    
    // 少し待機して日本語トークナイザーの初期化を待つ
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 各クエリを分析
    queries.forEach(query => {
      const analysis = analyzer.analyze(query);
      console.log(`クエリ: ${query}`);
      console.log(`言語: ${analysis.language.name} (確率: ${analysis.language.probability.toFixed(2)})`);
      console.log(`タイプ: ${analysis.queryType.type} (キーワードスコア: ${analysis.queryType.keywordScore.toFixed(2)}, セマンティックスコア: ${analysis.queryType.semanticScore.toFixed(2)})`);
      console.log(`複雑さ: ${analysis.complexity.level} (単語数: ${analysis.complexity.wordCount}, 文字数: ${analysis.complexity.characterCount})`);
      console.log(`構造: ${analysis.structure.type}`);
      console.log('---');
    });
  } catch (error) {
    console.error('エラー:', error);
  }
}

example();
```

### 4.1 カスタムオプションの使用例

クエリ分析器では、様々なオプションをカスタマイズすることができます：

```javascript
// custom-example.js
const { QueryAnalyzer } = require('./query-analyzer');

async function customExample() {
  try {
    // カスタムオプションを指定したクエリ分析器のインスタンスを作成
    const analyzer = new QueryAnalyzer({
      minKeywordQueryLength: 3,      // キーワードクエリの最小長を3に設定
      minSemanticQueryLength: 8,     // セマンティッククエリの最小長を8に設定
      keywordThreshold: 0.7,         // キーワード中心と判定するしきい値を0.7に設定
      semanticThreshold: 0.6,        // セマンティック中心と判定するしきい値を0.6に設定
      japaneseProbabilityThreshold: 0.6, // 日本語と判定するしきい値を0.6に設定
      englishProbabilityThreshold: 0.6   // 英語と判定するしきい値を0.6に設定
    });
    
    // クエリを分析
    const query = '機械学習アルゴリズムの比較について詳しく教えてください';
    
    // 少し待機して日本語トークナイザーの初期化を待つ
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // クエリを分析
    const analysis = analyzer.analyze(query);
    console.log(`クエリ: ${query}`);
    console.log(`分析結果:`, JSON.stringify(analysis, null, 2));
  } catch (error) {
    console.error('エラー:', error);
  }
}

customExample();
```

## 5. パフォーマンスに関する考慮事項

クエリ分析のパフォーマンスを最適化するには、以下の点に注意する必要があります：

1. **日本語トークナイザーの初期化**：日本語トークナイザーの初期化には時間がかかるため、アプリケーションの起動時に初期化しておくことが重要です。

2. **キャッシュの活用**：同じクエリに対する分析結果をキャッシュすることで、パフォーマンスを向上させることができます。

3. **非同期処理の活用**：クエリ分析は非同期で行い、他の処理と並行して実行することで、全体のパフォーマンスを向上させることができます。

## 6. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析の基本概念について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - 言語処理）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-language.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - 戦略選択）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-strategy.md)
4. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - 実装例）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-examples.md)
