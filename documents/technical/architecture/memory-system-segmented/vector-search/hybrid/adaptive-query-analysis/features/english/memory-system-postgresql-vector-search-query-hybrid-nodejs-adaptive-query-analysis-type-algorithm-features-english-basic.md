---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 英語特徴量 - 基本解析）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 英語特徴量 - 基本解析）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの特徴抽出のうち、英語クエリに特化した基本特徴量の抽出方法について説明します。

## 2. 英語クエリの特徴と課題

英語クエリは、以下のような特徴と課題を持ちます：

1. **単語の区切りが明示的**：英語は空白で単語が区切られるため、トークン化が比較的容易
2. **冠詞や前置詞の存在**：「a」「the」「in」「on」などの冠詞や前置詞が文の構造を形成
3. **語形変化**：動詞の時制変化や名詞の複数形など、語形変化が存在
4. **ストップワード**：意味的に重要でない一般的な単語（「the」「is」「and」など）が多く含まれる
5. **大文字と小文字の区別**：固有名詞は大文字で始まるなど、大文字と小文字の使い分けがある

これらの特徴と課題に対応するため、英語クエリの特徴抽出では、トークン化、ステミング、ストップワード除去などの処理が重要となります。

## 3. 英語クエリの基本前処理

英語クエリの基本前処理には、トークン化、ステミング、ストップワード除去などが含まれます。HARCA多階層記憶システムでは、Node.jsで利用可能な自然言語処理ライブラリである「natural」を使用します。

### 3.1 トークン化

トークン化は、英語クエリを単語に分割する処理です。英語では、主に空白や句読点を基準にトークン化を行います。

```javascript
const natural = require('natural');

/**
 * 英語クエリをトークン化する
 * @param {string} query - 英語クエリ
 * @returns {Array<string>} - トークン化された単語の配列
 * @private
 */
tokenizeEnglish(query) {
  const tokenizer = new natural.WordTokenizer();
  return tokenizer.tokenize(query);
}
```

### 3.2 ステミング

ステミングは、単語の語尾変化を取り除いて語幹を抽出する処理です。例えば、「running」「runs」「ran」はすべて「run」という語幹に変換されます。

```javascript
/**
 * 英語の単語をステミングする
 * @param {Array<string>} tokens - トークン化された単語の配列
 * @returns {Array<string>} - ステミングされた単語の配列
 * @private
 */
stemEnglishTokens(tokens) {
  return tokens.map(token => natural.PorterStemmer.stem(token));
}
```

### 3.3 ストップワード除去

ストップワードは、意味的に重要でない一般的な単語（「the」「is」「and」など）です。これらの単語は、クエリの意味内容にほとんど寄与しないため、特徴抽出の前に除去することがあります。

```javascript
/**
 * 英語のトークンからストップワードを除去する
 * @param {Array<string>} tokens - トークン化された単語の配列
 * @returns {Array<string>} - ストップワードが除去された単語の配列
 * @private
 */
removeEnglishStopwords(tokens) {
  const stopwords = natural.stopwords;
  return tokens.filter(token => !stopwords.includes(token.toLowerCase()));
}
```

### 3.4 前処理の統合

これらの前処理を統合して、英語クエリの基本前処理を行います。

```javascript
/**
 * 英語クエリの基本前処理を行う
 * @param {string} query - 英語クエリ
 * @param {object} options - オプション
 * @returns {object} - 前処理結果
 * @private
 */
preprocessEnglishQuery(query, options = {}) {
  const {
    performStemming = true,
    removeStopwords = true
  } = options;
  
  // トークン化
  const tokens = this.tokenizeEnglish(query);
  
  // 元のトークンを保存
  const originalTokens = [...tokens];
  
  // ストップワード除去（オプション）
  const tokensWithoutStopwords = removeStopwords ? this.removeEnglishStopwords(tokens) : tokens;
  
  // ステミング（オプション）
  const stemmedTokens = performStemming ? this.stemEnglishTokens(tokensWithoutStopwords) : tokensWithoutStopwords;
  
  return {
    originalQuery: query,
    originalTokens,
    tokensWithoutStopwords,
    stemmedTokens,
    tokenCount: tokens.length,
    tokenCountWithoutStopwords: tokensWithoutStopwords.length
  };
}
```

## 4. 英語クエリの基本特徴量抽出

英語クエリの基本特徴量は、前処理の結果に基づいて抽出されます。以下に、主な基本特徴量の抽出方法を示します。

```javascript
/**
 * 英語クエリから基本特徴量を抽出する
 * @param {string} query - 英語クエリ
 * @returns {object} - 英語クエリの基本特徴量
 */
extractEnglishBasicFeatures(query) {
  // 基本前処理
  const preprocessed = this.preprocessEnglishQuery(query);
  
  // 単語の特性
  const wordFeatures = this.analyzeEnglishWordFeatures(preprocessed);
  
  // 文字の特性
  const characterFeatures = this.analyzeEnglishCharacterFeatures(query);
  
  // 単語の多様性
  const diversityFeatures = this.analyzeEnglishDiversityFeatures(preprocessed);
  
  // 単語の長さの分布
  const wordLengthFeatures = this.analyzeEnglishWordLengthFeatures(preprocessed.originalTokens);
  
  return {
    ...wordFeatures,
    ...characterFeatures,
    ...diversityFeatures,
    ...wordLengthFeatures,
    originalQuery: query,
    tokenCount: preprocessed.tokenCount
  };
}
```

### 4.1 単語の特性分析

単語の特性は、英語クエリの基本的な構造を示す重要な特徴です。特に、品詞の分布や機能語の割合は、クエリがキーワード中心かセマンティック中心かを判断する手がかりとなります。

```javascript
/**
 * 英語クエリの単語の特性を分析する
 * @param {object} preprocessed - 前処理結果
 * @returns {object} - 単語の特性
 * @private
 */
analyzeEnglishWordFeatures(preprocessed) {
  const { originalTokens, tokensWithoutStopwords } = preprocessed;
  
  // ストップワードの割合
  const stopwordRatio = originalTokens.length > 0 
    ? (originalTokens.length - tokensWithoutStopwords.length) / originalTokens.length 
    : 0;
  
  // 大文字で始まる単語の数（固有名詞の可能性）
  const capitalizedCount = originalTokens.filter(token => /^[A-Z]/.test(token)).length;
  const capitalizedRatio = originalTokens.length > 0 ? capitalizedCount / originalTokens.length : 0;
  
  // 全て大文字の単語の数（略語や強調の可能性）
  const uppercaseCount = originalTokens.filter(token => /^[A-Z]+$/.test(token)).length;
  const uppercaseRatio = originalTokens.length > 0 ? uppercaseCount / originalTokens.length : 0;
  
  // 数字を含む単語の数
  const numericCount = originalTokens.filter(token => /\d/.test(token)).length;
  const numericRatio = originalTokens.length > 0 ? numericCount / originalTokens.length : 0;
  
  // 特殊文字を含む単語の数
  const specialCharCount = originalTokens.filter(token => /[^\w\s]/.test(token)).length;
  const specialCharRatio = originalTokens.length > 0 ? specialCharCount / originalTokens.length : 0;
  
  return {
    stopwordRatio,
    capitalizedCount,
    capitalizedRatio,
    uppercaseCount,
    uppercaseRatio,
    numericCount,
    numericRatio,
    specialCharCount,
    specialCharRatio
  };
}
```

#### 4.1.1 単語の特性の解釈

単語の特性は、以下のように解釈されます：

- **ストップワードの割合（stopwordRatio）**：ストップワードの割合が高いほど、文法的な構造を持つセマンティック中心クエリである可能性が高まります。
- **大文字で始まる単語の割合（capitalizedRatio）**：大文字で始まる単語の割合が高いほど、固有名詞を含むキーワード中心クエリである可能性が高まります。
- **全て大文字の単語の割合（uppercaseRatio）**：全て大文字の単語の割合が高いほど、略語や強調を含むキーワード中心クエリである可能性が高まります。
- **数字を含む単語の割合（numericRatio）**：数字を含む単語の割合が高いほど、具体的な数値情報を含むキーワード中心クエリである可能性が高まります。
- **特殊文字を含む単語の割合（specialCharRatio）**：特殊文字を含む単語の割合が高いほど、特殊な表現を含むキーワード中心クエリである可能性が高まります。

### 4.2 文字の特性分析

文字の特性は、英語クエリの表記的な側面を示す特徴です。特に、大文字と小文字の使い分けや特殊文字の使用は、クエリの種類や目的を示す手がかりとなります。

```javascript
/**
 * 英語クエリの文字の特性を分析する
 * @param {string} query - 英語クエリ
 * @returns {object} - 文字の特性
 * @private
 */
analyzeEnglishCharacterFeatures(query) {
  // 文字数
  const charCount = query.length;
  
  // 空白の数
  const whitespaceCount = (query.match(/\s/g) || []).length;
  
  // 大文字の数
  const uppercaseCount = (query.match(/[A-Z]/g) || []).length;
  const uppercaseRatio = charCount > 0 ? uppercaseCount / charCount : 0;
  
  // 小文字の数
  const lowercaseCount = (query.match(/[a-z]/g) || []).length;
  const lowercaseRatio = charCount > 0 ? lowercaseCount / charCount : 0;
  
  // 数字の数
  const digitCount = (query.match(/\d/g) || []).length;
  const digitRatio = charCount > 0 ? digitCount / charCount : 0;
  
  // 特殊文字の数
  const specialCharCount = (query.match(/[^\w\s]/g) || []).length;
  const specialCharRatio = charCount > 0 ? specialCharCount / charCount : 0;
  
  // 句読点の数
  const punctuationCount = (query.match(/[.,;:!?]/g) || []).length;
  const punctuationRatio = charCount > 0 ? punctuationCount / charCount : 0;
  
  return {
    charCount,
    whitespaceCount,
    uppercaseCount,
    uppercaseRatio,
    lowercaseCount,
    lowercaseRatio,
    digitCount,
    digitRatio,
    specialCharCount,
    specialCharRatio,
    punctuationCount,
    punctuationRatio
  };
}
```

#### 4.2.1 文字の特性の解釈

文字の特性は、以下のように解釈されます：

- **大文字の割合（uppercaseRatio）**：大文字の割合が高いほど、強調や略語を含むキーワード中心クエリである可能性が高まります。
- **小文字の割合（lowercaseRatio）**：小文字の割合が高いほど、通常の文章を含むセマンティック中心クエリである可能性が高まります。
- **数字の割合（digitRatio）**：数字の割合が高いほど、具体的な数値情報を含むキーワード中心クエリである可能性が高まります。
- **特殊文字の割合（specialCharRatio）**：特殊文字の割合が高いほど、特殊な表現を含むキーワード中心クエリである可能性が高まります。
- **句読点の割合（punctuationRatio）**：句読点の割合が高いほど、文法的な構造を持つセマンティック中心クエリである可能性が高まります。

### 4.3 単語の多様性分析

単語の多様性は、クエリの情報量や複雑さを示す特徴です。特に、Type-Token Ratio（TTR）や語彙の豊かさは、クエリの種類や目的を示す手がかりとなります。

```javascript
/**
 * 英語クエリの単語の多様性を分析する
 * @param {object} preprocessed - 前処理結果
 * @returns {object} - 単語の多様性
 * @private
 */
analyzeEnglishDiversityFeatures(preprocessed) {
  const { originalTokens, tokensWithoutStopwords, stemmedTokens } = preprocessed;
  
  // 一意な単語の数（オリジナル）
  const uniqueOriginalCount = new Set(originalTokens.map(token => token.toLowerCase())).size;
  
  // 一意な単語の数（ストップワード除去後）
  const uniqueWithoutStopwordsCount = new Set(tokensWithoutStopwords.map(token => token.toLowerCase())).size;
  
  // 一意な単語の数（ステミング後）
  const uniqueStemmedCount = new Set(stemmedTokens.map(token => token.toLowerCase())).size;
  
  // Type-Token Ratio（TTR）
  const originalTTR = originalTokens.length > 0 ? uniqueOriginalCount / originalTokens.length : 0;
  const withoutStopwordsTTR = tokensWithoutStopwords.length > 0 ? uniqueWithoutStopwordsCount / tokensWithoutStopwords.length : 0;
  const stemmedTTR = stemmedTokens.length > 0 ? uniqueStemmedCount / stemmedTokens.length : 0;
  
  return {
    uniqueOriginalCount,
    uniqueWithoutStopwordsCount,
    uniqueStemmedCount,
    originalTTR,
    withoutStopwordsTTR,
    stemmedTTR
  };
}
```

#### 4.3.1 単語の多様性の解釈

単語の多様性は、以下のように解釈されます：

- **一意な単語の数（uniqueOriginalCount）**：一意な単語の数が多いほど、多様な表現を含むセマンティック中心クエリである可能性が高まります。
- **Type-Token Ratio（originalTTR）**：TTRが高いほど、多様な表現を含むセマンティック中心クエリである可能性が高まります。TTRが低いほど、同じ単語が繰り返し使用されるキーワード中心クエリである可能性が高まります。
- **ストップワード除去後のTTR（withoutStopwordsTTR）**：ストップワード除去後のTTRが高いほど、内容語の多様性が高いセマンティック中心クエリである可能性が高まります。
- **ステミング後のTTR（stemmedTTR）**：ステミング後のTTRが高いほど、語幹の多様性が高いセマンティック中心クエリである可能性が高まります。

### 4.4 単語の長さの分布分析

単語の長さの分布は、クエリの複雑さや専門性を示す特徴です。特に、長い単語の割合や平均単語長は、クエリの種類や目的を示す手がかりとなります。

```javascript
/**
 * 英語クエリの単語の長さの分布を分析する
 * @param {Array<string>} tokens - トークン化された単語の配列
 * @returns {object} - 単語の長さの分布
 * @private
 */
analyzeEnglishWordLengthFeatures(tokens) {
  if (!tokens || tokens.length === 0) {
    return {
      avgWordLength: 0,
      maxWordLength: 0,
      minWordLength: 0,
      wordLengthVariance: 0,
      shortWordRatio: 0,
      mediumWordRatio: 0,
      longWordRatio: 0
    };
  }
  
  // 単語の長さの配列
  const wordLengths = tokens.map(token => token.length);
  
  // 平均単語長
  const avgWordLength = wordLengths.reduce((sum, length) => sum + length, 0) / wordLengths.length;
  
  // 最大単語長
  const maxWordLength = Math.max(...wordLengths);
  
  // 最小単語長
  const minWordLength = Math.min(...wordLengths);
  
  // 単語長の分散
  const wordLengthVariance = this.calculateVariance(wordLengths);
  
  // 短い単語（1-3文字）の割合
  const shortWordCount = wordLengths.filter(length => length >= 1 && length <= 3).length;
  const shortWordRatio = shortWordCount / wordLengths.length;
  
  // 中程度の単語（4-6文字）の割合
  const mediumWordCount = wordLengths.filter(length => length >= 4 && length <= 6).length;
  const mediumWordRatio = mediumWordCount / wordLengths.length;
  
  // 長い単語（7文字以上）の割合
  const longWordCount = wordLengths.filter(length => length >= 7).length;
  const longWordRatio = longWordCount / wordLengths.length;
  
  return {
    avgWordLength,
    maxWordLength,
    minWordLength,
    wordLengthVariance,
    shortWordRatio,
    mediumWordRatio,
    longWordRatio
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

#### 4.4.1 単語の長さの分布の解釈

単語の長さの分布は、以下のように解釈されます：

- **平均単語長（avgWordLength）**：平均単語長が長いほど、専門用語や複合語を含むキーワード中心クエリである可能性が高まります。
- **単語長の分散（wordLengthVariance）**：単語長の分散が大きいほど、多様な長さの単語を含むセマンティック中心クエリである可能性が高まります。
- **短い単語の割合（shortWordRatio）**：短い単語の割合が高いほど、冠詞や前置詞などの機能語を含むセマンティック中心クエリである可能性が高まります。
- **長い単語の割合（longWordRatio）**：長い単語の割合が高いほど、専門用語や複合語を含むキーワード中心クエリである可能性が高まります。

## 5. 英語クエリの基本特徴量の統合

抽出した英語クエリの基本特徴量は、クエリタイプ判別の基盤となります。これらの特徴量は、文法特性と組み合わせて、より正確なクエリタイプの判別を行うために使用されます。

```javascript
/**
 * 英語クエリから特徴量を抽出する
 * @param {string} query - 英語クエリ
 * @returns {object} - 英語クエリの特徴量
 */
extractEnglishFeatures(query) {
  // 基本特徴量を抽出
  const basicFeatures = this.extractEnglishBasicFeatures(query);
  
  // 文法特性を抽出（別ドキュメントで詳細に説明）
  const grammaticalFeatures = this.extractEnglishGrammaticalFeatures(query);
  
  // 特徴量を統合
  return {
    ...basicFeatures,
    ...grammaticalFeatures
  };
}
```

## 6. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの特徴抽出のうち、英語クエリに特化した基本特徴量の抽出方法について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 英語特徴量 - 文法特性）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-features-english-grammar.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - スコアリング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-scoring.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 判定ロジック）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-logic.md)
