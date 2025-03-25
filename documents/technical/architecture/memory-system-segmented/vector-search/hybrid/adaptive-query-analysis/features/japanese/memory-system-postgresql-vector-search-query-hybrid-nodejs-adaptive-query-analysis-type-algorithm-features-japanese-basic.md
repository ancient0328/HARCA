---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 日本語特徴量 - 基本解析）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 日本語特徴量 - 基本解析）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの特徴抽出のうち、日本語クエリに特化した特徴量の基本解析について説明します。

## 2. 日本語クエリの特徴と課題

日本語クエリは、以下のような特徴と課題を持ちます：

1. **単語の区切りが明示的でない**：日本語は分かち書きされないため、単語の境界を特定するには形態素解析が必要
2. **文字種の多様性**：漢字、ひらがな、カタカナ、アルファベット、数字など複数の文字種が混在
3. **助詞や助動詞の豊富さ**：「は」「が」「を」「に」などの助詞や「です」「ます」などの助動詞が文の構造を形成
4. **同音異義語の多さ**：同じ読みでも異なる意味を持つ単語が多い
5. **表記ゆれの存在**：同じ意味でも「ウェブ」「ウエブ」「Web」など複数の表記が存在

これらの特徴と課題に対応するため、日本語クエリの特徴抽出では、形態素解析を中心とした特殊な処理が必要となります。

## 3. 形態素解析の基本

形態素解析は、日本語の文章を意味を持つ最小単位（形態素）に分割し、各形態素の品詞や活用形などの情報を付与する処理です。HARCA多階層記憶システムでは、Node.jsで利用可能な形態素解析ライブラリである「kuromoji.js」を使用します。

### 3.1 kuromoji.jsの初期化

kuromoji.jsを使用するには、まず初期化が必要です。初期化には辞書データの読み込みが含まれるため、非同期処理となります。

```javascript
const { tokenizer: kuromojiTokenizer } = require('kuromoji');

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
```

### 3.2 形態素解析の実行

初期化後、形態素解析を実行して日本語クエリを形態素に分割します。

```javascript
/**
 * 日本語クエリを形態素解析する
 * @param {string} query - 日本語クエリ
 * @returns {Array<object>} - 形態素解析結果
 * @private
 */
tokenizeJapanese(query) {
  if (!this.japaneseTokenizerReady || !this.japaneseTokenizer) {
    throw new Error('日本語トークナイザーが初期化されていません');
  }
  
  return this.japaneseTokenizer.tokenize(query);
}
```

形態素解析の結果は、以下のような情報を含むオブジェクトの配列として返されます：

```javascript
[
  {
    word: '日本語',      // 表層形
    reading: 'ニホンゴ',  // 読み
    pos: '名詞',         // 品詞
    pos_detail_1: '一般', // 品詞細分類1
    pos_detail_2: '*',   // 品詞細分類2
    pos_detail_3: '*',   // 品詞細分類3
    conjugated_type: '*', // 活用型
    conjugated_form: '*', // 活用形
    basic_form: '日本語',  // 基本形
    surface_form: '日本語', // 表層形
    position: 0           // 位置
  },
  // ...
]
```

## 4. 日本語クエリの基本特徴量抽出

日本語クエリの基本特徴量は、形態素解析の結果に基づいて抽出されます。以下に、主な基本特徴量の抽出方法を示します。

```javascript
/**
 * 日本語クエリから基本特徴量を抽出する
 * @param {string} query - 日本語クエリ
 * @returns {object} - 日本語クエリの基本特徴量
 */
extractJapaneseBasicFeatures(query) {
  // 形態素解析
  const tokens = this.tokenizeJapanese(query);
  
  // 文字種の分布
  const charTypeDistribution = this.analyzeJapaneseCharTypes(query);
  
  // 品詞の分布
  const posDistribution = this.analyzeJapanesePos(tokens);
  
  // 内容語と機能語の比率
  const contentFunctionRatio = this.calculateJapaneseContentFunctionRatio(tokens);
  
  // 単語の基本形と表層形の比率
  const basicSurfaceRatio = this.calculateJapaneseBasicSurfaceRatio(tokens);
  
  return {
    charTypeDistribution,
    posDistribution,
    contentFunctionRatio,
    basicSurfaceRatio,
    tokenCount: tokens.length
  };
}
```

### 4.1 文字種の分布分析

日本語クエリには、漢字、ひらがな、カタカナ、アルファベット、数字などの文字種が混在します。文字種の分布は、クエリの性質を示す重要な特徴となります。

```javascript
/**
 * 日本語クエリの文字種の分布を分析する
 * @param {string} query - 日本語クエリ
 * @returns {object} - 文字種の分布
 * @private
 */
analyzeJapaneseCharTypes(query) {
  let kanjiCount = 0;
  let hiraganaCount = 0;
  let katakanaCount = 0;
  let alphabetCount = 0;
  let numberCount = 0;
  let symbolCount = 0;
  
  // 文字種のカウント
  for (const char of query) {
    if (/[\u4E00-\u9FAF]/.test(char)) {
      // 漢字
      kanjiCount++;
    } else if (/[\u3040-\u309F]/.test(char)) {
      // ひらがな
      hiraganaCount++;
    } else if (/[\u30A0-\u30FF]/.test(char)) {
      // カタカナ
      katakanaCount++;
    } else if (/[a-zA-Z]/.test(char)) {
      // アルファベット
      alphabetCount++;
    } else if (/[0-9]/.test(char)) {
      // 数字
      numberCount++;
    } else if (!/\s/.test(char)) {
      // 記号（空白以外）
      symbolCount++;
    }
  }
  
  const totalChars = query.length;
  
  // 分布の計算
  return {
    kanji: totalChars > 0 ? kanjiCount / totalChars : 0,
    hiragana: totalChars > 0 ? hiraganaCount / totalChars : 0,
    katakana: totalChars > 0 ? katakanaCount / totalChars : 0,
    alphabet: totalChars > 0 ? alphabetCount / totalChars : 0,
    number: totalChars > 0 ? numberCount / totalChars : 0,
    symbol: totalChars > 0 ? symbolCount / totalChars : 0
  };
}
```

#### 4.1.1 文字種の分布の解釈

文字種の分布は、以下のように解釈されます：

- **漢字の割合（kanji）**：漢字の割合が高いほど、専門的な内容や名詞が多いキーワード中心クエリである可能性が高まります。
- **ひらがなの割合（hiragana）**：ひらがなの割合が高いほど、助詞や助動詞が多いセマンティック中心クエリである可能性が高まります。
- **カタカナの割合（katakana）**：カタカナの割合が高いほど、外来語や専門用語が多いキーワード中心クエリである可能性が高まります。
- **アルファベットの割合（alphabet）**：アルファベットの割合が高いほど、英語の専門用語や固有名詞が多いキーワード中心クエリである可能性が高まります。
- **数字の割合（number）**：数字の割合が高いほど、具体的な数値情報を含むキーワード中心クエリである可能性が高まります。
- **記号の割合（symbol）**：記号の割合が高いほど、構造化された表現を含むセマンティック中心クエリである可能性が高まります。

### 4.2 品詞の分布分析

形態素解析の結果から、品詞の分布を分析します。品詞の分布は、クエリの文法的な構造を示す重要な特徴となります。

```javascript
/**
 * 日本語クエリの品詞の分布を分析する
 * @param {Array<object>} tokens - 形態素解析結果
 * @returns {object} - 品詞の分布
 * @private
 */
analyzeJapanesePos(tokens) {
  // 品詞のカウント
  const posCounts = {};
  
  for (const token of tokens) {
    const pos = token.pos;
    posCounts[pos] = (posCounts[pos] || 0) + 1;
  }
  
  // 主要な品詞の抽出
  const nounCount = posCounts['名詞'] || 0;
  const verbCount = posCounts['動詞'] || 0;
  const adjectiveCount = posCounts['形容詞'] || 0;
  const adverbCount = posCounts['副詞'] || 0;
  const particleCount = posCounts['助詞'] || 0;
  const auxiliaryVerbCount = posCounts['助動詞'] || 0;
  const conjunctionCount = posCounts['接続詞'] || 0;
  
  const totalTokens = tokens.length;
  
  // 分布の計算
  return {
    noun: totalTokens > 0 ? nounCount / totalTokens : 0,
    verb: totalTokens > 0 ? verbCount / totalTokens : 0,
    adjective: totalTokens > 0 ? adjectiveCount / totalTokens : 0,
    adverb: totalTokens > 0 ? adverbCount / totalTokens : 0,
    particle: totalTokens > 0 ? particleCount / totalTokens : 0,
    auxiliaryVerb: totalTokens > 0 ? auxiliaryVerbCount / totalTokens : 0,
    conjunction: totalTokens > 0 ? conjunctionCount / totalTokens : 0,
    raw: posCounts
  };
}
```

#### 4.2.1 品詞の分布の解釈

品詞の分布は、以下のように解釈されます：

- **名詞の割合（noun）**：名詞の割合が高いほど、具体的な対象や概念を指し示すキーワード中心クエリである可能性が高まります。
- **動詞の割合（verb）**：動詞の割合が高いほど、行動や状態を表現するセマンティック中心クエリである可能性が高まります。
- **形容詞の割合（adjective）**：形容詞の割合が高いほど、性質や状態を表現するセマンティック中心クエリである可能性が高まります。
- **副詞の割合（adverb）**：副詞の割合が高いほど、様態や程度を表現するセマンティック中心クエリである可能性が高まります。
- **助詞の割合（particle）**：助詞の割合が高いほど、文法的な関係を表現するセマンティック中心クエリである可能性が高まります。
- **助動詞の割合（auxiliaryVerb）**：助動詞の割合が高いほど、話者の態度や時制を表現するセマンティック中心クエリである可能性が高まります。
- **接続詞の割合（conjunction）**：接続詞の割合が高いほど、文と文の関係を表現するセマンティック中心クエリである可能性が高まります。

### 4.3 内容語と機能語の比率

内容語（名詞、動詞、形容詞、副詞など）と機能語（助詞、助動詞、接続詞など）の比率は、クエリの文法的な構造を示す重要な特徴となります。

```javascript
/**
 * 日本語クエリの内容語と機能語の比率を計算する
 * @param {Array<object>} tokens - 形態素解析結果
 * @returns {object} - 内容語と機能語の比率
 * @private
 */
calculateJapaneseContentFunctionRatio(tokens) {
  let contentWordCount = 0;
  let functionWordCount = 0;
  
  // 内容語と機能語のカウント
  for (const token of tokens) {
    const pos = token.pos;
    
    if (['名詞', '動詞', '形容詞', '副詞', '連体詞', '感動詞'].includes(pos)) {
      // 内容語
      contentWordCount++;
    } else if (['助詞', '助動詞', '接続詞'].includes(pos)) {
      // 機能語
      functionWordCount++;
    }
  }
  
  const totalTokens = tokens.length;
  
  // 比率の計算
  return {
    contentWordRatio: totalTokens > 0 ? contentWordCount / totalTokens : 0,
    functionWordRatio: totalTokens > 0 ? functionWordCount / totalTokens : 0,
    contentFunctionRatio: functionWordCount > 0 ? contentWordCount / functionWordCount : Infinity
  };
}
```

#### 4.3.1 内容語と機能語の比率の解釈

内容語と機能語の比率は、以下のように解釈されます：

- **内容語の割合（contentWordRatio）**：内容語の割合が高いほど、具体的な情報を含むキーワード中心クエリである可能性が高まります。
- **機能語の割合（functionWordRatio）**：機能語の割合が高いほど、文法的な構造を持つセマンティック中心クエリである可能性が高まります。
- **内容語と機能語の比率（contentFunctionRatio）**：この比率が高いほど、キーワード中心クエリである可能性が高まり、低いほどセマンティック中心クエリである可能性が高まります。

### 4.4 単語の基本形と表層形の比率

単語の基本形（辞書形）と表層形（活用形）の比率は、クエリの文法的な複雑さを示す特徴となります。

```javascript
/**
 * 日本語クエリの単語の基本形と表層形の比率を計算する
 * @param {Array<object>} tokens - 形態素解析結果
 * @returns {object} - 基本形と表層形の比率
 * @private
 */
calculateJapaneseBasicSurfaceRatio(tokens) {
  let sameCount = 0;
  let differentCount = 0;
  
  // 基本形と表層形の比較
  for (const token of tokens) {
    if (token.basic_form === token.surface_form) {
      // 基本形と表層形が同じ
      sameCount++;
    } else {
      // 基本形と表層形が異なる
      differentCount++;
    }
  }
  
  const totalTokens = tokens.length;
  
  // 比率の計算
  return {
    sameRatio: totalTokens > 0 ? sameCount / totalTokens : 0,
    differentRatio: totalTokens > 0 ? differentCount / totalTokens : 0,
    basicSurfaceRatio: differentCount > 0 ? sameCount / differentCount : Infinity
  };
}
```

#### 4.4.1 基本形と表層形の比率の解釈

基本形と表層形の比率は、以下のように解釈されます：

- **同一の割合（sameRatio）**：基本形と表層形が同じ単語の割合が高いほど、活用のない名詞が多いキーワード中心クエリである可能性が高まります。
- **異なりの割合（differentRatio）**：基本形と表層形が異なる単語の割合が高いほど、活用のある動詞や形容詞が多いセマンティック中心クエリである可能性が高まります。
- **基本形と表層形の比率（basicSurfaceRatio）**：この比率が高いほど、キーワード中心クエリである可能性が高まり、低いほどセマンティック中心クエリである可能性が高まります。

## 5. 日本語クエリの基本特徴量の統合

抽出した日本語クエリの基本特徴量は、クエリタイプ判別の基盤となります。これらの特徴量は、共通特徴量や文法特性と組み合わせて、より正確なクエリタイプの判別を行うために使用されます。

```javascript
/**
 * 日本語クエリから特徴量を抽出する
 * @param {string} query - 日本語クエリ
 * @returns {object} - 日本語クエリの特徴量
 */
extractJapaneseFeatures(query) {
  // 基本特徴量を抽出
  const basicFeatures = this.extractJapaneseBasicFeatures(query);
  
  // 文法特性を抽出（別ドキュメントで詳細に説明）
  const grammaticalFeatures = this.extractJapaneseGrammaticalFeatures(query);
  
  // 特徴量を統合
  return {
    ...basicFeatures,
    ...grammaticalFeatures
  };
}
```

## 6. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの特徴抽出のうち、日本語クエリに特化した特徴量の基本解析について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 日本語特徴量 - 文法特性）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-features-japanese-grammar.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 英語特徴量）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-features-english.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - スコアリング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-scoring.md)
