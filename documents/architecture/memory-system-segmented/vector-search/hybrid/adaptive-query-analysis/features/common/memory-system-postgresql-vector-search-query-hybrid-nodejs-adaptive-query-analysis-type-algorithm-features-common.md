---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 共通特徴量）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 共通特徴量）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの特徴抽出のうち、言語に依存しない共通特徴量の抽出方法について説明します。

## 2. 共通特徴量の概要

クエリタイプ判別において、言語に依存しない共通の特徴量は、クエリの基本的な構造や特性を捉えるために重要です。これらの特徴量は、クエリの言語に関わらず、クエリの性質を表現するために使用されます。

主な共通特徴量は以下のとおりです：

1. **長さに関する特徴量**：文字数、単語数、平均単語長など
2. **構造に関する特徴量**：特殊文字の有無、記号の分布など
3. **複雑性に関する特徴量**：単語の多様性、エントロピーなど
4. **パターンに関する特徴量**：繰り返しパターン、数字やURLの有無など

## 3. 共通特徴量の抽出実装

以下に、共通特徴量を抽出するための実装例を示します：

```javascript
/**
 * クエリから共通特徴量を抽出する
 * @param {string} query - 検索クエリ
 * @returns {object} - 共通特徴量
 */
extractCommonFeatures(query) {
  if (!query || typeof query !== 'string') {
    throw new Error('クエリは文字列である必要があります');
  }
  
  // 基本的な長さの特徴量
  const lengthFeatures = this.extractLengthFeatures(query);
  
  // 構造的な特徴量
  const structuralFeatures = this.extractStructuralFeatures(query);
  
  // 複雑性の特徴量
  const complexityFeatures = this.extractComplexityFeatures(query);
  
  // パターンの特徴量
  const patternFeatures = this.extractPatternFeatures(query);
  
  // 全ての特徴量を結合
  return {
    ...lengthFeatures,
    ...structuralFeatures,
    ...complexityFeatures,
    ...patternFeatures
  };
}
```

## 4. 長さに関する特徴量

長さに関する特徴量は、クエリの量的な側面を捉えるために使用されます。一般的に、キーワード中心クエリは短く、セマンティック中心クエリは長い傾向があります。

```javascript
/**
 * クエリから長さに関する特徴量を抽出する
 * @param {string} query - 検索クエリ
 * @returns {object} - 長さに関する特徴量
 * @private
 */
extractLengthFeatures(query) {
  // 文字数
  const charCount = query.length;
  
  // 単語数（簡易的な実装）
  const words = query.trim().split(/\s+/);
  const wordCount = words.length;
  
  // 平均単語長
  const avgWordLength = wordCount > 0 ? charCount / wordCount : 0;
  
  // 単語長の分散
  const wordLengthVariance = this.calculateVariance(words.map(word => word.length));
  
  return {
    charCount,
    wordCount,
    avgWordLength,
    wordLengthVariance
  };
}

/**
 * 配列の分散を計算する
 * @param {Array<number>} array - 数値の配列
 * @returns {number} - 分散
 * @private
 */
calculateVariance(array) {
  if (array.length === 0) return 0;
  
  const mean = array.reduce((sum, val) => sum + val, 0) / array.length;
  const squaredDiffs = array.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / array.length;
}
```

### 4.1 長さに関する特徴量の解釈

長さに関する特徴量は、以下のように解釈されます：

- **文字数（charCount）**：クエリの全体的な長さ。一般的に、セマンティック中心クエリは文字数が多い傾向があります。
- **単語数（wordCount）**：クエリに含まれる単語の数。単語数が多いほど、セマンティック中心クエリである可能性が高まります。
- **平均単語長（avgWordLength）**：クエリに含まれる単語の平均的な長さ。専門用語や複合語が多いキーワード中心クエリでは、平均単語長が長くなる傾向があります。
- **単語長の分散（wordLengthVariance）**：単語長のばらつき。キーワード中心クエリでは、単語長が均一になる傾向があります。

## 5. 構造に関する特徴量

構造に関する特徴量は、クエリの構文的な側面を捉えるために使用されます。セマンティック中心クエリは、より構造化された文法的な要素を含む傾向があります。

```javascript
/**
 * クエリから構造に関する特徴量を抽出する
 * @param {string} query - 検索クエリ
 * @returns {object} - 構造に関する特徴量
 * @private
 */
extractStructuralFeatures(query) {
  // 特殊文字の有無
  const hasQuestionMark = query.includes('?') || query.includes('？');
  const hasExclamationMark = query.includes('!') || query.includes('！');
  const hasComma = query.includes(',') || query.includes('、');
  const hasPeriod = query.includes('.') || query.includes('。');
  
  // 括弧の有無と対応
  const openParenCount = (query.match(/\(/g) || []).length;
  const closeParenCount = (query.match(/\)/g) || []).length;
  const hasBalancedParens = openParenCount === closeParenCount;
  
  // 引用符の有無と対応
  const openQuoteCount = (query.match(/["'「]/g) || []).length;
  const closeQuoteCount = (query.match(/["'」]/g) || []).length;
  const hasBalancedQuotes = openQuoteCount === closeQuoteCount;
  
  // 記号の割合
  const symbolCount = (query.match(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || []).length;
  const symbolRatio = query.length > 0 ? symbolCount / query.length : 0;
  
  return {
    hasQuestionMark,
    hasExclamationMark,
    hasComma,
    hasPeriod,
    openParenCount,
    closeParenCount,
    hasBalancedParens,
    openQuoteCount,
    closeQuoteCount,
    hasBalancedQuotes,
    symbolCount,
    symbolRatio
  };
}
```

### 5.1 構造に関する特徴量の解釈

構造に関する特徴量は、以下のように解釈されます：

- **疑問符の有無（hasQuestionMark）**：疑問符が含まれる場合、質問形式のセマンティック中心クエリである可能性が高まります。
- **感嘆符の有無（hasExclamationMark）**：感嘆符が含まれる場合、感情表現を含むセマンティック中心クエリである可能性が高まります。
- **カンマの有無（hasComma）**：カンマが含まれる場合、複数の要素を列挙するセマンティック中心クエリである可能性が高まります。
- **ピリオドの有無（hasPeriod）**：ピリオドが含まれる場合、完全な文を含むセマンティック中心クエリである可能性が高まります。
- **括弧の対応（hasBalancedParens）**：括弧が対応している場合、構造化された表現を含むセマンティック中心クエリである可能性が高まります。
- **引用符の対応（hasBalancedQuotes）**：引用符が対応している場合、引用や特定の表現を含むセマンティック中心クエリである可能性が高まります。
- **記号の割合（symbolRatio）**：記号の割合が高い場合、構造化された表現を含むセマンティック中心クエリである可能性が高まります。

## 6. 複雑性に関する特徴量

複雑性に関する特徴量は、クエリの情報量や多様性を捉えるために使用されます。セマンティック中心クエリは、より複雑で多様な表現を含む傾向があります。

```javascript
/**
 * クエリから複雑性に関する特徴量を抽出する
 * @param {string} query - 検索クエリ
 * @returns {object} - 複雑性に関する特徴量
 * @private
 */
extractComplexityFeatures(query) {
  // 単語の分割（簡易的な実装）
  const words = query.trim().split(/\s+/);
  
  // 単語の種類数
  const uniqueWords = new Set(words);
  const uniqueWordCount = uniqueWords.size;
  
  // 単語の多様性（Type-Token Ratio）
  const typeTokenRatio = words.length > 0 ? uniqueWordCount / words.length : 0;
  
  // 文字のエントロピー
  const entropy = this.calculateEntropy(query);
  
  // 単語長の分布
  const wordLengthDistribution = this.calculateWordLengthDistribution(words);
  
  return {
    uniqueWordCount,
    typeTokenRatio,
    entropy,
    wordLengthDistribution
  };
}

/**
 * 文字列のエントロピーを計算する
 * @param {string} text - 文字列
 * @returns {number} - エントロピー
 * @private
 */
calculateEntropy(text) {
  if (!text || text.length === 0) return 0;
  
  // 文字の頻度を計算
  const frequencies = {};
  for (const char of text) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  
  // エントロピーを計算
  let entropy = 0;
  const textLength = text.length;
  
  for (const char in frequencies) {
    const probability = frequencies[char] / textLength;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

/**
 * 単語長の分布を計算する
 * @param {Array<string>} words - 単語の配列
 * @returns {object} - 単語長の分布
 * @private
 */
calculateWordLengthDistribution(words) {
  if (!words || words.length === 0) return {};
  
  // 単語長の頻度を計算
  const distribution = {};
  
  for (const word of words) {
    const length = word.length;
    distribution[length] = (distribution[length] || 0) + 1;
  }
  
  // 分布を正規化
  const totalWords = words.length;
  const normalizedDistribution = {};
  
  for (const length in distribution) {
    normalizedDistribution[length] = distribution[length] / totalWords;
  }
  
  return normalizedDistribution;
}
```

### 6.1 複雑性に関する特徴量の解釈

複雑性に関する特徴量は、以下のように解釈されます：

- **単語の種類数（uniqueWordCount）**：クエリに含まれる一意な単語の数。種類数が多いほど、多様な表現を含むセマンティック中心クエリである可能性が高まります。
- **単語の多様性（typeTokenRatio）**：単語の種類数と総単語数の比率。多様性が高いほど、多様な表現を含むセマンティック中心クエリである可能性が高まります。
- **エントロピー（entropy）**：クエリの情報量。エントロピーが高いほど、情報量が多く複雑なセマンティック中心クエリである可能性が高まります。
- **単語長の分布（wordLengthDistribution）**：単語長の分布。キーワード中心クエリでは、特定の長さの単語が多く含まれる傾向があります。

## 7. パターンに関する特徴量

パターンに関する特徴量は、クエリに含まれる特定のパターンや要素を捉えるために使用されます。これらのパターンは、クエリの目的や種類を示す手がかりとなります。

```javascript
/**
 * クエリからパターンに関する特徴量を抽出する
 * @param {string} query - 検索クエリ
 * @returns {object} - パターンに関する特徴量
 * @private
 */
extractPatternFeatures(query) {
  // 数字の有無と割合
  const digitCount = (query.match(/\d/g) || []).length;
  const digitRatio = query.length > 0 ? digitCount / query.length : 0;
  
  // URLやメールアドレスの有無
  const hasUrl = /https?:\/\/[^\s]+/.test(query);
  const hasEmail = /[^\s]+@[^\s]+\.[^\s]+/.test(query);
  
  // ハッシュタグの有無と数
  const hashtagCount = (query.match(/#[^\s#]+/g) || []).length;
  
  // コードスニペットの特徴（括弧、演算子など）
  const hasCodeOperators = /[=+\-*/%<>!&|^~]+/.test(query);
  const hasSemicolon = query.includes(';');
  const hasCodePattern = hasCodeOperators && hasSemicolon;
  
  // 日付や時間のパターン
  const hasDatePattern = /\d{1,4}[-/年月]\d{1,2}[-/月日](\d{1,4})?/.test(query);
  const hasTimePattern = /\d{1,2}[:時]\d{1,2}([:分]\d{1,2})?/.test(query);
  
  return {
    digitCount,
    digitRatio,
    hasUrl,
    hasEmail,
    hashtagCount,
    hasCodeOperators,
    hasSemicolon,
    hasCodePattern,
    hasDatePattern,
    hasTimePattern
  };
}
```

### 7.1 パターンに関する特徴量の解釈

パターンに関する特徴量は、以下のように解釈されます：

- **数字の割合（digitRatio）**：数字の割合が高い場合、特定の数値情報を求めるキーワード中心クエリである可能性が高まります。
- **URLやメールアドレスの有無（hasUrl, hasEmail）**：URLやメールアドレスが含まれる場合、特定のリソースを指し示すキーワード中心クエリである可能性が高まります。
- **ハッシュタグの数（hashtagCount）**：ハッシュタグが含まれる場合、特定のトピックを指し示すキーワード中心クエリである可能性が高まります。
- **コードパターンの有無（hasCodePattern）**：コードに関連するパターンが含まれる場合、プログラミング関連のキーワード中心クエリである可能性が高まります。
- **日付や時間のパターンの有無（hasDatePattern, hasTimePattern）**：日付や時間のパターンが含まれる場合、特定の時間情報を求めるキーワード中心クエリである可能性が高まります。

## 8. 共通特徴量の統合

抽出した共通特徴量は、クエリタイプ判別の基盤となります。これらの特徴量は、言語固有の特徴量と組み合わせて、より正確なクエリタイプの判別を行うために使用されます。

```javascript
/**
 * クエリから特徴量を抽出する
 * @param {object} preprocessedQuery - 前処理済みクエリ
 * @param {object} language - 言語情報
 * @returns {object} - 特徴量
 */
extractFeatures(preprocessedQuery, language) {
  const query = preprocessedQuery.normalizedQuery;
  
  // 共通特徴量を抽出
  const commonFeatures = this.extractCommonFeatures(query);
  
  // 言語依存の特徴量を抽出
  let languageFeatures = {};
  
  if (language.name === 'japanese') {
    languageFeatures = this.extractJapaneseFeatures(query);
  } else if (language.name === 'english') {
    languageFeatures = this.extractEnglishFeatures(query);
  }
  
  // 特徴量を統合
  return {
    ...commonFeatures,
    ...languageFeatures,
    language: language.name
  };
}
```

## 9. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの特徴抽出のうち、言語に依存しない共通特徴量の抽出方法について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 日本語特徴量）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-features-japanese.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 英語特徴量）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-features-english.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - スコアリング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-scoring.md)
