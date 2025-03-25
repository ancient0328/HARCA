---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 構造）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 構造）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの構造について説明します。クエリタイプ判別アルゴリズムは、クエリの特性を分析し、最適な検索戦略を選択するための基盤となります。

## 2. クエリタイプ判別アルゴリズムの全体構造

クエリタイプ判別アルゴリズムは、以下の主要なステップから構成されます：

1. **前処理**：クエリの正規化と基本的な特性の抽出
2. **言語検出**：クエリの言語の特定
3. **特徴量抽出**：言語に応じた特徴量の抽出
4. **スコア計算**：キーワードスコアとセマンティックスコアの計算
5. **タイプ判定**：スコアに基づくクエリタイプの判定
6. **メタデータ生成**：分析結果のメタデータの生成

以下に、これらのステップの詳細と実装例を示します。

## 3. クエリタイプ判別アルゴリズムの実装構造

クエリタイプ判別アルゴリズムは、`QueryTypeAnalyzer`クラスとして実装されます。以下に、クラスの基本構造を示します：

```javascript
// query-type-analyzer.js
const franc = require('franc');
const natural = require('natural');
const { tokenizer: kuromojiTokenizer } = require('kuromoji');

/**
 * クエリタイプ分析器クラス
 */
class QueryTypeAnalyzer {
  /**
   * コンストラクタ
   * @param {object} options - オプション
   */
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
   * @private
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
   * クエリのタイプを分析する
   * @param {string} query - 検索クエリ
   * @returns {object} - 分析結果
   */
  analyzeQueryType(query) {
    // 前処理
    const preprocessedQuery = this.preprocessQuery(query);
    
    // 言語検出
    const language = this.detectLanguage(preprocessedQuery);
    
    // 特徴量抽出
    const features = this.extractFeatures(preprocessedQuery, language);
    
    // スコア計算
    const scores = this.calculateScores(features, language);
    
    // タイプ判定
    const queryType = this.determineQueryType(scores);
    
    // メタデータ生成
    return this.generateMetadata(preprocessedQuery, language, features, scores, queryType);
  }
  
  /**
   * クエリを前処理する
   * @param {string} query - 検索クエリ
   * @returns {object} - 前処理結果
   * @private
   */
  preprocessQuery(query) {
    // 実装は別ドキュメントで詳細に説明
    // ここでは基本的な構造のみ示す
    return {
      originalQuery: query,
      normalizedQuery: query.trim(),
      length: query.length,
      wordCount: this.countWords(query)
    };
  }
  
  /**
   * クエリの言語を検出する
   * @param {object} preprocessedQuery - 前処理済みクエリ
   * @returns {object} - 言語情報
   * @private
   */
  detectLanguage(preprocessedQuery) {
    // 実装は別ドキュメントで詳細に説明
    // ここでは基本的な構造のみ示す
    return {
      code: 'unknown',
      name: 'unknown',
      probability: 0
    };
  }
  
  /**
   * クエリから特徴量を抽出する
   * @param {object} preprocessedQuery - 前処理済みクエリ
   * @param {object} language - 言語情報
   * @returns {object} - 特徴量
   * @private
   */
  extractFeatures(preprocessedQuery, language) {
    // 実装は別ドキュメントで詳細に説明
    // ここでは基本的な構造のみ示す
    return {
      // 基本的な特徴量
      length: preprocessedQuery.length,
      wordCount: preprocessedQuery.wordCount,
      
      // 言語依存の特徴量
      // 実装は言語に応じて異なる
    };
  }
  
  /**
   * 特徴量からスコアを計算する
   * @param {object} features - 特徴量
   * @param {object} language - 言語情報
   * @returns {object} - スコア
   * @private
   */
  calculateScores(features, language) {
    // 実装は別ドキュメントで詳細に説明
    // ここでは基本的な構造のみ示す
    return {
      keywordScore: 0,
      semanticScore: 0
    };
  }
  
  /**
   * スコアからクエリタイプを判定する
   * @param {object} scores - スコア
   * @returns {string} - クエリタイプ
   * @private
   */
  determineQueryType(scores) {
    // 実装は別ドキュメントで詳細に説明
    // ここでは基本的な構造のみ示す
    return 'unknown';
  }
  
  /**
   * 分析結果のメタデータを生成する
   * @param {object} preprocessedQuery - 前処理済みクエリ
   * @param {object} language - 言語情報
   * @param {object} features - 特徴量
   * @param {object} scores - スコア
   * @param {string} queryType - クエリタイプ
   * @returns {object} - メタデータ
   * @private
   */
  generateMetadata(preprocessedQuery, language, features, scores, queryType) {
    return {
      originalQuery: preprocessedQuery.originalQuery,
      normalizedQuery: preprocessedQuery.normalizedQuery,
      language: language,
      features: features,
      scores: scores,
      queryType: queryType,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * クエリの単語数をカウントする
   * @param {string} query - 検索クエリ
   * @returns {number} - 単語数
   * @private
   */
  countWords(query) {
    // 簡易的な単語カウント（空白で分割）
    return query.trim().split(/\s+/).length;
  }
}

module.exports = { QueryTypeAnalyzer };
```

## 4. クエリタイプ判別アルゴリズムの処理フロー

クエリタイプ判別アルゴリズムの処理フローを以下に示します：

### 4.1 前処理（preprocessQuery）

前処理ステップでは、以下の処理を行います：

1. クエリの正規化（トリミング、特殊文字の処理など）
2. 基本的な特性の抽出（長さ、単語数など）

```javascript
/**
 * クエリを前処理する
 * @param {string} query - 検索クエリ
 * @returns {object} - 前処理結果
 * @private
 */
preprocessQuery(query) {
  if (!query || typeof query !== 'string') {
    throw new Error('クエリは文字列である必要があります');
  }
  
  // クエリの正規化
  const normalizedQuery = query.trim();
  
  // 基本的な特性の抽出
  const length = normalizedQuery.length;
  const wordCount = this.countWords(normalizedQuery);
  
  return {
    originalQuery: query,
    normalizedQuery: normalizedQuery,
    length: length,
    wordCount: wordCount
  };
}
```

### 4.2 言語検出（detectLanguage）

言語検出ステップでは、以下の処理を行います：

1. クエリの言語の特定
2. 言語の確率の計算

```javascript
/**
 * クエリの言語を検出する
 * @param {object} preprocessedQuery - 前処理済みクエリ
 * @returns {object} - 言語情報
 * @private
 */
detectLanguage(preprocessedQuery) {
  const query = preprocessedQuery.normalizedQuery;
  
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
    probability: probability
  };
}
```

### 4.3 特徴量抽出（extractFeatures）

特徴量抽出ステップでは、以下の処理を行います：

1. 言語に応じた特徴量の抽出
2. クエリの構造的特徴の分析

```javascript
/**
 * クエリから特徴量を抽出する
 * @param {object} preprocessedQuery - 前処理済みクエリ
 * @param {object} language - 言語情報
 * @returns {object} - 特徴量
 * @private
 */
extractFeatures(preprocessedQuery, language) {
  const query = preprocessedQuery.normalizedQuery;
  
  // 基本的な特徴量
  const features = {
    length: preprocessedQuery.length,
    wordCount: preprocessedQuery.wordCount,
    avgWordLength: preprocessedQuery.length / Math.max(1, preprocessedQuery.wordCount),
    hasQuestionMark: query.includes('?') || query.includes('？'),
    hasExclamationMark: query.includes('!') || query.includes('！')
  };
  
  // 言語依存の特徴量
  if (language.name === 'japanese') {
    Object.assign(features, this.extractJapaneseFeatures(query));
  } else if (language.name === 'english') {
    Object.assign(features, this.extractEnglishFeatures(query));
  }
  
  return features;
}
```

### 4.4 スコア計算（calculateScores）

スコア計算ステップでは、以下の処理を行います：

1. キーワードスコアの計算
2. セマンティックスコアの計算

```javascript
/**
 * 特徴量からスコアを計算する
 * @param {object} features - 特徴量
 * @param {object} language - 言語情報
 * @returns {object} - スコア
 * @private
 */
calculateScores(features, language) {
  // 言語に応じたスコア計算
  if (language.name === 'japanese') {
    return this.calculateJapaneseScores(features);
  } else if (language.name === 'english') {
    return this.calculateEnglishScores(features);
  } else {
    // デフォルトのスコア計算
    return this.calculateDefaultScores(features);
  }
}
```

### 4.5 タイプ判定（determineQueryType）

タイプ判定ステップでは、以下の処理を行います：

1. スコアに基づくクエリタイプの判定
2. 判定の確信度の計算

```javascript
/**
 * スコアからクエリタイプを判定する
 * @param {object} scores - スコア
 * @returns {object} - クエリタイプ情報
 * @private
 */
determineQueryType(scores) {
  const { keywordScore, semanticScore } = scores;
  
  // タイプを判定
  let type = 'mixed';
  let confidence = 0.5;
  
  if (keywordScore >= this.options.keywordThreshold && semanticScore < this.options.semanticThreshold) {
    type = 'keyword';
    confidence = keywordScore;
  } else if (semanticScore >= this.options.semanticThreshold && keywordScore < this.options.keywordThreshold) {
    type = 'semantic';
    confidence = semanticScore;
  } else {
    // 混合型の場合、確信度はスコアの差の逆数
    confidence = 1 - Math.abs(keywordScore - semanticScore);
  }
  
  return {
    type: type,
    confidence: confidence
  };
}
```

### 4.6 メタデータ生成（generateMetadata）

メタデータ生成ステップでは、以下の処理を行います：

1. 分析結果のメタデータの生成
2. タイムスタンプの追加

```javascript
/**
 * 分析結果のメタデータを生成する
 * @param {object} preprocessedQuery - 前処理済みクエリ
 * @param {object} language - 言語情報
 * @param {object} features - 特徴量
 * @param {object} scores - スコア
 * @param {object} queryType - クエリタイプ情報
 * @returns {object} - メタデータ
 * @private
 */
generateMetadata(preprocessedQuery, language, features, scores, queryType) {
  return {
    originalQuery: preprocessedQuery.originalQuery,
    normalizedQuery: preprocessedQuery.normalizedQuery,
    language: language,
    features: features,
    scores: scores,
    queryType: queryType,
    recommendedStrategy: this.getRecommendedStrategy(queryType),
    timestamp: new Date().toISOString()
  };
}

/**
 * クエリタイプに基づいて推奨される検索戦略を取得する
 * @param {object} queryType - クエリタイプ情報
 * @returns {string} - 推奨される検索戦略
 * @private
 */
getRecommendedStrategy(queryType) {
  switch (queryType.type) {
    case 'keyword':
      return 'keyword_search';
    case 'semantic':
      return 'vector_search';
    case 'mixed':
      return 'hybrid_search';
    default:
      return 'hybrid_search';
  }
}
```

## 5. クエリタイプ判別アルゴリズムの使用例

以下に、クエリタイプ判別アルゴリズムの使用例を示します：

```javascript
// example.js
const { QueryTypeAnalyzer } = require('./query-type-analyzer');

async function example() {
  try {
    // クエリタイプ分析器のインスタンスを作成
    const analyzer = new QueryTypeAnalyzer();
    
    // 少し待機して日本語トークナイザーの初期化を待つ
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // クエリのタイプを分析
    const queries = [
      'ニューラルネットワーク 学習方法',
      'ニューラルネットワークの学習方法について教えてください',
      'What is machine learning?',
      'machine learning algorithm comparison'
    ];
    
    // 各クエリを分析
    queries.forEach(query => {
      const result = analyzer.analyzeQueryType(query);
      console.log(`クエリ: ${query}`);
      console.log(`言語: ${result.language.name}`);
      console.log(`タイプ: ${result.queryType.type} (確信度: ${result.queryType.confidence.toFixed(2)})`);
      console.log(`推奨戦略: ${result.recommendedStrategy}`);
      console.log('---');
    });
  } catch (error) {
    console.error('エラー:', error);
  }
}

example();
```

## 6. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの構造について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-features.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - スコアリング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-scoring.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 判定ロジック）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-logic.md)
