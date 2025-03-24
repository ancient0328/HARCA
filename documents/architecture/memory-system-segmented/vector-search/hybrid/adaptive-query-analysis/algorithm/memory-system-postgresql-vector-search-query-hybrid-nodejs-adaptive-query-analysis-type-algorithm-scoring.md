---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - スコアリング）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - スコアリング）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムのスコアリングについて説明します。

クエリタイプ判別のスコアリングは、抽出された特徴量に基づいて、クエリがキーワード中心なのかセマンティック中心なのかを数値化するプロセスです。このスコアリングにより、最適な検索戦略を選択することができます。

## 2. スコアリングの基本原則

クエリタイプ判別のスコアリングは、以下の基本原則に基づいています：

1. **特徴量の重み付け**：各特徴量には、その重要度に応じた重みが割り当てられます。
2. **スコアの正規化**：スコアは0.0から1.0の範囲に正規化されます。0.0に近いほどキーワード中心、1.0に近いほどセマンティック中心を示します。
3. **言語特有のスコアリング**：日本語と英語では、重視すべき特徴量が異なるため、言語ごとに異なるスコアリングモデルを使用します。
4. **閾値の設定**：スコアに基づいてクエリタイプを判別するための閾値を設定します。

## 3. スコアリングモデルの構造

スコアリングモデルは、以下の構造を持ちます：

```javascript
/**
 * クエリタイプ判別のスコアリングモデル
 * @typedef {object} ScoringModel
 * @property {object} weights - 特徴量の重み
 * @property {object} thresholds - 判別のための閾値
 */

/**
 * 日本語クエリのスコアリングモデル
 * @type {ScoringModel}
 */
const japaneseScoringModel = {
  weights: {
    // 共通特徴量の重み
    common: {
      queryLength: 0.05,
      tokenCount: 0.05,
      averageTokenLength: 0.05,
      specialCharacterRatio: 0.05,
      digitRatio: 0.05,
      uniqueTokenRatio: 0.05
    },
    // 日本語特徴量の重み
    japanese: {
      // 基本解析
      contentWordRatio: 0.10,
      functionWordRatio: 0.10,
      nounRatio: 0.05,
      verbRatio: 0.05,
      adjectiveRatio: 0.05,
      // 文法特性
      particlePatterns: 0.10,
      endingExpressions: 0.10,
      complexSentenceStructure: 0.05,
      honorificExpressions: 0.05
    }
  },
  thresholds: {
    keywordCentric: 0.3,
    semanticCentric: 0.7
  }
};

/**
 * 英語クエリのスコアリングモデル
 * @type {ScoringModel}
 */
const englishScoringModel = {
  weights: {
    // 共通特徴量の重み
    common: {
      queryLength: 0.05,
      tokenCount: 0.05,
      averageTokenLength: 0.05,
      specialCharacterRatio: 0.05,
      digitRatio: 0.05,
      uniqueTokenRatio: 0.05
    },
    // 英語特徴量の重み
    english: {
      // 基本解析
      stopwordRatio: 0.10,
      contentWordRatio: 0.05,
      functionWordRatio: 0.10,
      // 品詞分析
      posDistribution: 0.15,
      posSequencePatterns: 0.10,
      // 構文解析
      syntaxComplexity: 0.15
    }
  },
  thresholds: {
    keywordCentric: 0.3,
    semanticCentric: 0.7
  }
};
```

## 4. 特徴量のスコアリング

抽出された特徴量に基づいて、クエリタイプのスコアを計算します。

```javascript
/**
 * クエリタイプのスコアを計算する
 * @param {object} features - 抽出された特徴量
 * @param {string} language - 言語（'ja'または'en'）
 * @returns {number} - クエリタイプのスコア（0.0〜1.0）
 */
calculateQueryTypeScore(features, language) {
  // 言語に応じたスコアリングモデルを選択
  const scoringModel = language === 'ja' ? this.japaneseScoringModel : this.englishScoringModel;
  
  // 共通特徴量のスコアを計算
  const commonScore = this.calculateCommonFeatureScore(features.common, scoringModel.weights.common);
  
  // 言語特有の特徴量のスコアを計算
  const languageSpecificScore = language === 'ja'
    ? this.calculateJapaneseFeatureScore(features.japanese, scoringModel.weights.japanese)
    : this.calculateEnglishFeatureScore(features.english, scoringModel.weights.english);
  
  // 共通特徴量と言語特有の特徴量の重み
  const commonWeight = 0.3;
  const languageSpecificWeight = 0.7;
  
  // 総合スコアを計算
  const totalScore = (commonScore * commonWeight) + (languageSpecificScore * languageSpecificWeight);
  
  return totalScore;
}
```

### 4.1 共通特徴量のスコアリング

共通特徴量のスコアリングでは、クエリの長さやトークン数などの基本的な特徴量に基づいてスコアを計算します。

```javascript
/**
 * 共通特徴量のスコアを計算する
 * @param {object} commonFeatures - 共通特徴量
 * @param {object} weights - 共通特徴量の重み
 * @returns {number} - 共通特徴量のスコア（0.0〜1.0）
 * @private
 */
calculateCommonFeatureScore(commonFeatures, weights) {
  // 各特徴量のスコアを計算
  const scores = {
    // クエリの長さ（長いほどセマンティック中心の可能性が高い）
    queryLength: this.normalizeValue(commonFeatures.queryLength, 1, 50),
    
    // トークン数（多いほどセマンティック中心の可能性が高い）
    tokenCount: this.normalizeValue(commonFeatures.tokenCount, 1, 15),
    
    // 平均トークン長（短いほどセマンティック中心の可能性が高い）
    averageTokenLength: 1.0 - this.normalizeValue(commonFeatures.averageTokenLength, 1, 10),
    
    // 特殊文字の割合（低いほどセマンティック中心の可能性が高い）
    specialCharacterRatio: 1.0 - commonFeatures.specialCharacterRatio,
    
    // 数字の割合（低いほどセマンティック中心の可能性が高い）
    digitRatio: 1.0 - commonFeatures.digitRatio,
    
    // 一意なトークンの割合（低いほどセマンティック中心の可能性が高い）
    uniqueTokenRatio: 1.0 - commonFeatures.uniqueTokenRatio
  };
  
  // 重み付き平均を計算
  return this.calculateWeightedAverage(scores, weights);
}

/**
 * 値を指定された範囲で正規化する
 * @param {number} value - 正規化する値
 * @param {number} min - 最小値
 * @param {number} max - 最大値
 * @returns {number} - 正規化された値（0.0〜1.0）
 * @private
 */
normalizeValue(value, min, max) {
  if (value <= min) return 0.0;
  if (value >= max) return 1.0;
  return (value - min) / (max - min);
}

/**
 * 重み付き平均を計算する
 * @param {object} scores - スコア
 * @param {object} weights - 重み
 * @returns {number} - 重み付き平均（0.0〜1.0）
 * @private
 */
calculateWeightedAverage(scores, weights) {
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const feature in weights) {
    if (scores[feature] !== undefined) {
      weightedSum += scores[feature] * weights[feature];
      totalWeight += weights[feature];
    }
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
```

### 4.2 日本語特徴量のスコアリング

日本語特徴量のスコアリングでは、日本語特有の特徴量に基づいてスコアを計算します。

```javascript
/**
 * 日本語特徴量のスコアを計算する
 * @param {object} japaneseFeatures - 日本語特徴量
 * @param {object} weights - 日本語特徴量の重み
 * @returns {number} - 日本語特徴量のスコア（0.0〜1.0）
 * @private
 */
calculateJapaneseFeatureScore(japaneseFeatures, weights) {
  // 基本解析のスコア
  const basicScores = {
    // 内容語の割合（低いほどセマンティック中心の可能性が高い）
    contentWordRatio: 1.0 - japaneseFeatures.basic.contentWordRatio,
    
    // 機能語の割合（高いほどセマンティック中心の可能性が高い）
    functionWordRatio: japaneseFeatures.basic.functionWordRatio,
    
    // 名詞の割合（低いほどセマンティック中心の可能性が高い）
    nounRatio: 1.0 - japaneseFeatures.basic.nounRatio,
    
    // 動詞の割合（高いほどセマンティック中心の可能性が高い）
    verbRatio: japaneseFeatures.basic.verbRatio,
    
    // 形容詞の割合（高いほどセマンティック中心の可能性が高い）
    adjectiveRatio: japaneseFeatures.basic.adjectiveRatio
  };
  
  // 文法特性のスコア
  const grammarScores = {
    // 助詞の使用パターン（高いほどセマンティック中心の可能性が高い）
    particlePatterns: japaneseFeatures.grammar.particlePatterns.totalParticles > 0 ? 1.0 : 0.0,
    
    // 文末表現（特定の文末表現があるほどセマンティック中心の可能性が高い）
    endingExpressions: japaneseFeatures.grammar.endingExpressions.hasSpecificEnding ? 1.0 : 0.0,
    
    // 複文構造（複文構造があるほどセマンティック中心の可能性が高い）
    complexSentenceStructure: japaneseFeatures.grammar.complexSentenceStructure.hasComplexStructure ? 1.0 : 0.0,
    
    // 敬語表現（敬語表現があるほどセマンティック中心の可能性が高い）
    honorificExpressions: japaneseFeatures.grammar.honorificExpressions.hasHonorificExpression ? 1.0 : 0.0
  };
  
  // 基本解析と文法特性のスコアを統合
  const scores = { ...basicScores, ...grammarScores };
  
  // 重み付き平均を計算
  return this.calculateWeightedAverage(scores, weights);
}
```

### 4.3 英語特徴量のスコアリング

英語特徴量のスコアリングでは、英語特有の特徴量に基づいてスコアを計算します。

```javascript
/**
 * 英語特徴量のスコアを計算する
 * @param {object} englishFeatures - 英語特徴量
 * @param {object} weights - 英語特徴量の重み
 * @returns {number} - 英語特徴量のスコア（0.0〜1.0）
 * @private
 */
calculateEnglishFeatureScore(englishFeatures, weights) {
  // 基本解析のスコア
  const basicScores = {
    // ストップワードの割合（高いほどセマンティック中心の可能性が高い）
    stopwordRatio: englishFeatures.basic.stopwordRatio,
    
    // 内容語の割合（低いほどセマンティック中心の可能性が高い）
    contentWordRatio: 1.0 - englishFeatures.basic.contentWordRatio,
    
    // 機能語の割合（高いほどセマンティック中心の可能性が高い）
    functionWordRatio: englishFeatures.basic.functionWordRatio
  };
  
  // 品詞分析のスコア
  const posScores = {
    // 品詞分布（文法的な構造の強さを示すスコア）
    posDistribution: englishFeatures.grammar.posAnalysis.grammaticalStructureScore,
    
    // 品詞シーケンスパターン（特定のパターンがあるほどセマンティック中心の可能性が高い）
    posSequencePatterns: Object.values(englishFeatures.grammar.posAnalysis.posSequencePatterns.patterns).filter(Boolean).length > 0 ? 1.0 : 0.0
  };
  
  // 構文解析のスコア
  const syntaxScores = {
    // 構文の複雑さ（複雑な構文ほどセマンティック中心の可能性が高い）
    syntaxComplexity: englishFeatures.grammar.syntaxAnalysis.syntaxComplexityScore
  };
  
  // 基本解析、品詞分析、構文解析のスコアを統合
  const scores = { ...basicScores, ...posScores, ...syntaxScores };
  
  // 重み付き平均を計算
  return this.calculateWeightedAverage(scores, weights);
}
```

## 5. クエリタイプの判別

計算されたスコアに基づいて、クエリタイプを判別します。

```javascript
/**
 * クエリタイプを判別する
 * @param {number} score - クエリタイプのスコア（0.0〜1.0）
 * @param {string} language - 言語（'ja'または'en'）
 * @returns {string} - クエリタイプ（'keyword'、'semantic'、または'hybrid'）
 */
determineQueryType(score, language) {
  // 言語に応じたスコアリングモデルを選択
  const scoringModel = language === 'ja' ? this.japaneseScoringModel : this.englishScoringModel;
  
  // スコアに基づいてクエリタイプを判別
  if (score <= scoringModel.thresholds.keywordCentric) {
    return 'keyword';
  } else if (score >= scoringModel.thresholds.semanticCentric) {
    return 'semantic';
  } else {
    return 'hybrid';
  }
}
```

## 6. スコアリングの調整と最適化

スコアリングモデルは、実際のクエリデータに基づいて調整と最適化を行うことが重要です。以下のアプローチを採用します：

### 6.1 重みの調整

特徴量の重みは、クエリタイプの判別精度を向上させるために調整することができます。

```javascript
/**
 * スコアリングモデルの重みを調整する
 * @param {ScoringModel} model - スコアリングモデル
 * @param {object} adjustments - 重みの調整値
 * @returns {ScoringModel} - 調整されたスコアリングモデル
 */
adjustScoringModelWeights(model, adjustments) {
  const adjustedModel = JSON.parse(JSON.stringify(model));
  
  // 共通特徴量の重みを調整
  if (adjustments.common) {
    for (const feature in adjustments.common) {
      if (adjustedModel.weights.common[feature] !== undefined) {
        adjustedModel.weights.common[feature] += adjustments.common[feature];
      }
    }
  }
  
  // 言語特有の特徴量の重みを調整
  if (adjustments.japanese && adjustedModel.weights.japanese) {
    for (const feature in adjustments.japanese) {
      if (adjustedModel.weights.japanese[feature] !== undefined) {
        adjustedModel.weights.japanese[feature] += adjustments.japanese[feature];
      }
    }
  }
  
  if (adjustments.english && adjustedModel.weights.english) {
    for (const feature in adjustments.english) {
      if (adjustedModel.weights.english[feature] !== undefined) {
        adjustedModel.weights.english[feature] += adjustments.english[feature];
      }
    }
  }
  
  // 重みの正規化
  this.normalizeScoringModelWeights(adjustedModel);
  
  return adjustedModel;
}

/**
 * スコアリングモデルの重みを正規化する
 * @param {ScoringModel} model - スコアリングモデル
 */
normalizeScoringModelWeights(model) {
  // 共通特徴量の重みの合計を計算
  let commonWeightSum = 0;
  for (const feature in model.weights.common) {
    commonWeightSum += model.weights.common[feature];
  }
  
  // 共通特徴量の重みを正規化
  if (commonWeightSum > 0) {
    for (const feature in model.weights.common) {
      model.weights.common[feature] /= commonWeightSum;
    }
  }
  
  // 日本語特徴量の重みの合計を計算
  if (model.weights.japanese) {
    let japaneseWeightSum = 0;
    for (const feature in model.weights.japanese) {
      japaneseWeightSum += model.weights.japanese[feature];
    }
    
    // 日本語特徴量の重みを正規化
    if (japaneseWeightSum > 0) {
      for (const feature in model.weights.japanese) {
        model.weights.japanese[feature] /= japaneseWeightSum;
      }
    }
  }
  
  // 英語特徴量の重みの合計を計算
  if (model.weights.english) {
    let englishWeightSum = 0;
    for (const feature in model.weights.english) {
      englishWeightSum += model.weights.english[feature];
    }
    
    // 英語特徴量の重みを正規化
    if (englishWeightSum > 0) {
      for (const feature in model.weights.english) {
        model.weights.english[feature] /= englishWeightSum;
      }
    }
  }
}
```

### 6.2 閾値の調整

クエリタイプの判別閾値も、判別精度を向上させるために調整することができます。

```javascript
/**
 * スコアリングモデルの閾値を調整する
 * @param {ScoringModel} model - スコアリングモデル
 * @param {object} adjustments - 閾値の調整値
 * @returns {ScoringModel} - 調整されたスコアリングモデル
 */
adjustScoringModelThresholds(model, adjustments) {
  const adjustedModel = JSON.parse(JSON.stringify(model));
  
  // 閾値を調整
  if (adjustments.keywordCentric !== undefined) {
    adjustedModel.thresholds.keywordCentric += adjustments.keywordCentric;
  }
  
  if (adjustments.semanticCentric !== undefined) {
    adjustedModel.thresholds.semanticCentric += adjustments.semanticCentric;
  }
  
  // 閾値の制約を適用
  adjustedModel.thresholds.keywordCentric = Math.max(0.0, Math.min(1.0, adjustedModel.thresholds.keywordCentric));
  adjustedModel.thresholds.semanticCentric = Math.max(0.0, Math.min(1.0, adjustedModel.thresholds.semanticCentric));
  
  // keywordCentricはsemanticCentricよりも小さくなければならない
  if (adjustedModel.thresholds.keywordCentric >= adjustedModel.thresholds.semanticCentric) {
    const middle = (adjustedModel.thresholds.keywordCentric + adjustedModel.thresholds.semanticCentric) / 2;
    adjustedModel.thresholds.keywordCentric = middle - 0.1;
    adjustedModel.thresholds.semanticCentric = middle + 0.1;
  }
  
  return adjustedModel;
}
```

### 6.3 モデルの評価

スコアリングモデルの性能を評価するために、テストデータセットを使用します。

```javascript
/**
 * スコアリングモデルを評価する
 * @param {ScoringModel} model - スコアリングモデル
 * @param {Array<object>} testData - テストデータ
 * @returns {object} - 評価結果
 */
evaluateScoringModel(model, testData) {
  let correctCount = 0;
  const confusionMatrix = {
    keyword: { keyword: 0, hybrid: 0, semantic: 0 },
    hybrid: { keyword: 0, hybrid: 0, semantic: 0 },
    semantic: { keyword: 0, hybrid: 0, semantic: 0 }
  };
  
  for (const item of testData) {
    // 特徴量を抽出
    const features = this.extractFeatures(item.query, item.language);
    
    // スコアを計算
    const score = this.calculateQueryTypeScore(features, item.language);
    
    // クエリタイプを判別
    const predictedType = this.determineQueryType(score, item.language);
    
    // 正解かどうかを判定
    if (predictedType === item.actualType) {
      correctCount++;
    }
    
    // 混同行列を更新
    confusionMatrix[item.actualType][predictedType]++;
  }
  
  // 精度を計算
  const accuracy = correctCount / testData.length;
  
  return {
    accuracy,
    confusionMatrix
  };
}
```

## 7. スコアリングの実装例

以下に、クエリタイプ判別のスコアリングの実装例を示します。

```javascript
/**
 * クエリタイプを判別する
 * @param {string} query - クエリ
 * @param {string} language - 言語（'ja'または'en'）
 * @returns {object} - 判別結果
 */
determineQueryTypeWithScore(query, language) {
  // 特徴量を抽出
  const features = this.extractFeatures(query, language);
  
  // スコアを計算
  const score = this.calculateQueryTypeScore(features, language);
  
  // クエリタイプを判別
  const queryType = this.determineQueryType(score, language);
  
  return {
    query,
    language,
    features,
    score,
    queryType
  };
}
```

## 8. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムのスコアリングについて説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 判定ロジック）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-logic.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-extensions.md)
