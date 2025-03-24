---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 英語特徴量 - 文法特性 - 品詞分析）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 英語特徴量 - 文法特性 - 品詞分析）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの特徴抽出のうち、英語クエリに特化した文法特性の品詞分析について説明します。

## 2. 英語クエリの品詞分析の重要性

英語クエリの品詞分析は、クエリの文法構造を理解するための基盤となります。品詞の分布パターンは、クエリがキーワード中心なのかセマンティック中心なのかを判別するための重要な手がかりとなります。

例えば、以下のようなクエリの違いを考えてみましょう：

1. **キーワード中心クエリ**: "machine learning algorithm comparison"
   - 主に名詞と形容詞で構成され、動詞や冠詞などの機能語が少ない

2. **セマンティック中心クエリ**: "What are the best machine learning algorithms for image recognition?"
   - 疑問詞、冠詞、前置詞、動詞などの機能語を含み、文法的な構造を持つ

これらの違いを検出するためには、クエリの品詞構成を分析することが重要です。

## 3. 品詞タグ付けの実装

英語クエリの品詞タグ付けには、Node.jsで利用可能な自然言語処理ライブラリである「natural」や「pos」を使用します。

```javascript
const natural = require('natural');
const pos = require('pos');

/**
 * 英語クエリに品詞タグを付ける
 * @param {string} query - 英語クエリ
 * @returns {Array<object>} - 品詞タグ付けされたトークンの配列
 * @private
 */
tagPartsOfSpeech(query) {
  // トークン化
  const words = new pos.Lexer().lex(query);
  
  // 品詞タグ付け
  const tagger = new pos.Tagger();
  const taggedWords = tagger.tag(words);
  
  // 結果を整形
  return taggedWords.map(taggedWord => {
    return {
      token: taggedWord[0],
      tag: taggedWord[1],
      category: this.getPOSCategory(taggedWord[1])
    };
  });
}

/**
 * 品詞タグからカテゴリを取得する
 * @param {string} tag - 品詞タグ
 * @returns {string} - 品詞カテゴリ
 * @private
 */
getPOSCategory(tag) {
  // 名詞カテゴリ
  if (['NN', 'NNS', 'NNP', 'NNPS'].includes(tag)) {
    return 'noun';
  }
  // 動詞カテゴリ
  else if (['VB', 'VBD', 'VBG', 'VBN', 'VBP', 'VBZ'].includes(tag)) {
    return 'verb';
  }
  // 形容詞カテゴリ
  else if (['JJ', 'JJR', 'JJS'].includes(tag)) {
    return 'adjective';
  }
  // 副詞カテゴリ
  else if (['RB', 'RBR', 'RBS'].includes(tag)) {
    return 'adverb';
  }
  // 前置詞カテゴリ
  else if (['IN'].includes(tag)) {
    return 'preposition';
  }
  // 冠詞カテゴリ
  else if (['DT'].includes(tag)) {
    return 'determiner';
  }
  // 代名詞カテゴリ
  else if (['PRP', 'PRP$', 'WP', 'WP$'].includes(tag)) {
    return 'pronoun';
  }
  // 接続詞カテゴリ
  else if (['CC', 'IN'].includes(tag)) {
    return 'conjunction';
  }
  // 疑問詞カテゴリ
  else if (['WDT', 'WP', 'WP$', 'WRB'].includes(tag)) {
    return 'interrogative';
  }
  // その他
  else {
    return 'other';
  }
}
```

## 4. 品詞分布の分析

品詞タグ付けの結果に基づいて、品詞の分布を分析します。

```javascript
/**
 * 英語クエリの品詞分布を分析する
 * @param {string} query - 英語クエリ
 * @returns {object} - 品詞分布の特徴
 * @private
 */
analyzePOSDistribution(query) {
  // 品詞タグ付け
  const taggedTokens = this.tagPartsOfSpeech(query);
  
  // 品詞カテゴリのカウント
  const categoryCounts = {
    noun: 0,
    verb: 0,
    adjective: 0,
    adverb: 0,
    preposition: 0,
    determiner: 0,
    pronoun: 0,
    conjunction: 0,
    interrogative: 0,
    other: 0
  };
  
  // 品詞カテゴリをカウント
  taggedTokens.forEach(token => {
    categoryCounts[token.category]++;
  });
  
  // 総トークン数
  const totalTokens = taggedTokens.length;
  
  // 内容語（名詞、動詞、形容詞、副詞）の数
  const contentWordCount = categoryCounts.noun + categoryCounts.verb + categoryCounts.adjective + categoryCounts.adverb;
  
  // 機能語（前置詞、冠詞、代名詞、接続詞など）の数
  const functionWordCount = categoryCounts.preposition + categoryCounts.determiner + categoryCounts.pronoun + categoryCounts.conjunction + categoryCounts.interrogative;
  
  // 各カテゴリの割合を計算
  const categoryRatios = {};
  for (const category in categoryCounts) {
    categoryRatios[`${category}Ratio`] = totalTokens > 0 ? categoryCounts[category] / totalTokens : 0;
  }
  
  // 内容語と機能語の割合
  const contentWordRatio = totalTokens > 0 ? contentWordCount / totalTokens : 0;
  const functionWordRatio = totalTokens > 0 ? functionWordCount / totalTokens : 0;
  
  return {
    categoryCounts,
    categoryRatios,
    contentWordCount,
    functionWordCount,
    contentWordRatio,
    functionWordRatio,
    totalTokens
  };
}
```

### 4.1 品詞分布の解釈

品詞分布は、以下のように解釈されます：

- **名詞の割合（nounRatio）**：名詞の割合が高いほど、キーワード中心クエリである可能性が高まります。
- **動詞の割合（verbRatio）**：動詞の割合が高いほど、セマンティック中心クエリである可能性が高まります。
- **冠詞の割合（determinerRatio）**：冠詞の割合が高いほど、セマンティック中心クエリである可能性が高まります。
- **前置詞の割合（prepositionRatio）**：前置詞の割合が高いほど、セマンティック中心クエリである可能性が高まります。
- **疑問詞の割合（interrogativeRatio）**：疑問詞の割合が高いほど、質問形式のセマンティック中心クエリである可能性が高まります。
- **内容語の割合（contentWordRatio）**：内容語の割合が高いほど、キーワード中心クエリである可能性が高まります。
- **機能語の割合（functionWordRatio）**：機能語の割合が高いほど、セマンティック中心クエリである可能性が高まります。

## 5. 品詞シーケンスパターンの分析

品詞の並び順（シーケンス）は、クエリの文法構造をより詳細に示す特徴です。特定の品詞シーケンスパターンは、クエリの種類や目的を示す手がかりとなります。

```javascript
/**
 * 英語クエリの品詞シーケンスパターンを分析する
 * @param {string} query - 英語クエリ
 * @returns {object} - 品詞シーケンスパターンの特徴
 * @private
 */
analyzePOSSequencePatterns(query) {
  // 品詞タグ付け
  const taggedTokens = this.tagPartsOfSpeech(query);
  
  // 品詞タグのシーケンス
  const tagSequence = taggedTokens.map(token => token.tag);
  
  // 品詞カテゴリのシーケンス
  const categorySequence = taggedTokens.map(token => token.category);
  
  // 特定のパターンの検出
  const patterns = {
    // 疑問文パターン（疑問詞で始まる）
    isQuestionPattern: this.detectQuestionPattern(categorySequence),
    
    // 命令文パターン（動詞で始まる）
    isCommandPattern: this.detectCommandPattern(categorySequence),
    
    // 名詞句パターン（冠詞+形容詞*+名詞）
    hasNounPhrasePattern: this.detectNounPhrasePattern(categorySequence),
    
    // 動詞句パターン（動詞+名詞句）
    hasVerbPhrasePattern: this.detectVerbPhrasePattern(categorySequence),
    
    // 前置詞句パターン（前置詞+名詞句）
    hasPrepositionalPhrasePattern: this.detectPrepositionalPhrasePattern(categorySequence)
  };
  
  return {
    tagSequence,
    categorySequence,
    patterns
  };
}

/**
 * 疑問文パターンを検出する
 * @param {Array<string>} categorySequence - 品詞カテゴリのシーケンス
 * @returns {boolean} - 疑問文パターンが検出されたかどうか
 * @private
 */
detectQuestionPattern(categorySequence) {
  // 疑問詞で始まる
  if (categorySequence.length > 0 && categorySequence[0] === 'interrogative') {
    return true;
  }
  
  // 助動詞+主語+動詞のパターン（例：「Do you know...」「Is there...」）
  if (categorySequence.length >= 3 && 
      categorySequence[0] === 'verb' && 
      (categorySequence[1] === 'pronoun' || categorySequence[1] === 'noun') &&
      categorySequence[2] === 'verb') {
    return true;
  }
  
  return false;
}

/**
 * 命令文パターンを検出する
 * @param {Array<string>} categorySequence - 品詞カテゴリのシーケンス
 * @returns {boolean} - 命令文パターンが検出されたかどうか
 * @private
 */
detectCommandPattern(categorySequence) {
  // 動詞で始まる
  if (categorySequence.length > 0 && categorySequence[0] === 'verb') {
    // 疑問文パターンではない（助動詞+主語+動詞のパターンではない）
    if (!(categorySequence.length >= 3 && 
          (categorySequence[1] === 'pronoun' || categorySequence[1] === 'noun') &&
          categorySequence[2] === 'verb')) {
      return true;
    }
  }
  
  return false;
}

/**
 * 名詞句パターンを検出する
 * @param {Array<string>} categorySequence - 品詞カテゴリのシーケンス
 * @returns {boolean} - 名詞句パターンが検出されたかどうか
 * @private
 */
detectNounPhrasePattern(categorySequence) {
  // 名詞句パターン（冠詞+形容詞*+名詞）を検出
  for (let i = 0; i < categorySequence.length - 1; i++) {
    if (categorySequence[i] === 'determiner') {
      let j = i + 1;
      // 形容詞が0個以上続く
      while (j < categorySequence.length && categorySequence[j] === 'adjective') {
        j++;
      }
      // 名詞で終わる
      if (j < categorySequence.length && categorySequence[j] === 'noun') {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 動詞句パターンを検出する
 * @param {Array<string>} categorySequence - 品詞カテゴリのシーケンス
 * @returns {boolean} - 動詞句パターンが検出されたかどうか
 * @private
 */
detectVerbPhrasePattern(categorySequence) {
  // 動詞句パターン（動詞+名詞句）を検出
  for (let i = 0; i < categorySequence.length - 1; i++) {
    if (categorySequence[i] === 'verb') {
      // 名詞が続く
      if (i + 1 < categorySequence.length && categorySequence[i + 1] === 'noun') {
        return true;
      }
      // 冠詞+名詞が続く
      if (i + 2 < categorySequence.length && 
          categorySequence[i + 1] === 'determiner' && 
          categorySequence[i + 2] === 'noun') {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 前置詞句パターンを検出する
 * @param {Array<string>} categorySequence - 品詞カテゴリのシーケンス
 * @returns {boolean} - 前置詞句パターンが検出されたかどうか
 * @private
 */
detectPrepositionalPhrasePattern(categorySequence) {
  // 前置詞句パターン（前置詞+名詞句）を検出
  for (let i = 0; i < categorySequence.length - 1; i++) {
    if (categorySequence[i] === 'preposition') {
      // 名詞が続く
      if (i + 1 < categorySequence.length && categorySequence[i + 1] === 'noun') {
        return true;
      }
      // 冠詞+名詞が続く
      if (i + 2 < categorySequence.length && 
          categorySequence[i + 1] === 'determiner' && 
          categorySequence[i + 2] === 'noun') {
        return true;
      }
    }
  }
  
  return false;
}
```

### 5.1 品詞シーケンスパターンの解釈

品詞シーケンスパターンは、以下のように解釈されます：

- **疑問文パターン（isQuestionPattern）**：疑問文パターンが検出された場合、質問形式のセマンティック中心クエリである可能性が高まります。
- **命令文パターン（isCommandPattern）**：命令文パターンが検出された場合、命令形式のセマンティック中心クエリである可能性が高まります。
- **名詞句パターン（hasNounPhrasePattern）**：名詞句パターンが検出された場合、構造化された表現を含むセマンティック中心クエリである可能性が高まります。
- **動詞句パターン（hasVerbPhrasePattern）**：動詞句パターンが検出された場合、動作や行為を表現するセマンティック中心クエリである可能性が高まります。
- **前置詞句パターン（hasPrepositionalPhrasePattern）**：前置詞句パターンが検出された場合、関係や位置を表現するセマンティック中心クエリである可能性が高まります。

## 6. 品詞分析の統合

品詞分布と品詞シーケンスパターンの分析結果を統合して、英語クエリの品詞分析を行います。

```javascript
/**
 * 英語クエリの品詞分析を行う
 * @param {string} query - 英語クエリ
 * @returns {object} - 品詞分析の結果
 */
analyzeEnglishPOS(query) {
  // 品詞分布の分析
  const posDistribution = this.analyzePOSDistribution(query);
  
  // 品詞シーケンスパターンの分析
  const posSequencePatterns = this.analyzePOSSequencePatterns(query);
  
  // 文法的な構造の強さを示すスコアを計算
  const grammaticalStructureScore = this.calculateGrammaticalStructureScore(posDistribution, posSequencePatterns);
  
  return {
    posDistribution,
    posSequencePatterns,
    grammaticalStructureScore
  };
}

/**
 * 文法的な構造の強さを示すスコアを計算する
 * @param {object} posDistribution - 品詞分布
 * @param {object} posSequencePatterns - 品詞シーケンスパターン
 * @returns {number} - 文法的な構造の強さを示すスコア（0.0〜1.0）
 * @private
 */
calculateGrammaticalStructureScore(posDistribution, posSequencePatterns) {
  // 各特徴の重み
  const weights = {
    functionWordRatio: 0.3,
    verbRatio: 0.2,
    patternDetection: 0.5
  };
  
  // 各特徴のスコア
  const scores = {
    functionWordRatio: posDistribution.functionWordRatio,
    verbRatio: posDistribution.categoryRatios.verbRatio,
    patternDetection: 0.0
  };
  
  // パターン検出のスコアを計算
  const patterns = posSequencePatterns.patterns;
  let patternScore = 0;
  
  if (patterns.isQuestionPattern) patternScore += 0.4;
  if (patterns.isCommandPattern) patternScore += 0.3;
  if (patterns.hasNounPhrasePattern) patternScore += 0.1;
  if (patterns.hasVerbPhrasePattern) patternScore += 0.1;
  if (patterns.hasPrepositionalPhrasePattern) patternScore += 0.1;
  
  scores.patternDetection = Math.min(1.0, patternScore);
  
  // 重み付き平均を計算
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const feature in weights) {
    weightedSum += weights[feature] * scores[feature];
    totalWeight += weights[feature];
  }
  
  // 正規化されたスコアを返す
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
```

## 7. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの特徴抽出のうち、英語クエリに特化した文法特性の品詞分析について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 英語特徴量 - 文法特性 - 構文解析）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-features-english-grammar-syntax.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - スコアリング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-scoring.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 判定ロジック）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-logic.md)
