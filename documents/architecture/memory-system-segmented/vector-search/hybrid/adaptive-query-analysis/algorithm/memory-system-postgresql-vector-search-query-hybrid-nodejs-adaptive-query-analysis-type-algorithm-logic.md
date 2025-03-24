---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 判定ロジック）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 判定ロジック）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの判定ロジックについて説明します。

クエリタイプ判別の判定ロジックは、スコアリングによって計算されたスコアと、その他の要素を考慮して、最終的なクエリタイプを決定するプロセスです。この判定ロジックにより、キーワード検索、セマンティック検索、またはハイブリッド検索のいずれかの戦略を選択します。

## 2. 判定ロジックの基本原則

クエリタイプ判別の判定ロジックは、以下の基本原則に基づいています：

1. **スコアベースの判定**：スコアリングによって計算されたスコアを主要な判定基準とします。
2. **閾値の適用**：スコアに対して閾値を適用し、クエリタイプを判定します。
3. **コンテキスト考慮**：クエリだけでなく、検索コンテキストも考慮します。
4. **ヒューリスティックの適用**：特定のパターンや条件に基づくヒューリスティックを適用します。
5. **適応的調整**：過去の検索結果に基づいて判定ロジックを適応的に調整します。

## 3. 判定ロジックの構造

判定ロジックは、以下の構造を持ちます：

```javascript
/**
 * クエリタイプ判別の判定ロジック
 * @typedef {object} DeterminationLogic
 * @property {object} thresholds - 判別のための閾値
 * @property {object} contextRules - コンテキストに基づくルール
 * @property {object} heuristics - ヒューリスティック
 */

/**
 * 判定ロジック
 * @type {DeterminationLogic}
 */
const determinationLogic = {
  thresholds: {
    keywordCentric: 0.3,
    semanticCentric: 0.7
  },
  contextRules: {
    // 検索コンテキストに基づくルール
    previousSearches: {
      // 直前の検索がキーワード検索で、結果が少なかった場合、セマンティック検索に傾ける
      keywordWithFewResults: {
        condition: (context) => {
          return context.previousSearch && 
                 context.previousSearch.type === 'keyword' && 
                 context.previousSearch.resultCount < 5;
        },
        adjustment: 0.2 // スコアを0.2上げる（セマンティック方向に）
      },
      // 直前の検索がセマンティック検索で、結果が多すぎた場合、キーワード検索に傾ける
      semanticWithTooManyResults: {
        condition: (context) => {
          return context.previousSearch && 
                 context.previousSearch.type === 'semantic' && 
                 context.previousSearch.resultCount > 100;
        },
        adjustment: -0.2 // スコアを0.2下げる（キーワード方向に）
      }
    },
    // ユーザープロファイルに基づくルール
    userProfile: {
      // ユーザーが技術的な背景を持つ場合、キーワード検索に傾ける
      technicalBackground: {
        condition: (context) => {
          return context.userProfile && 
                 context.userProfile.background === 'technical';
        },
        adjustment: -0.1 // スコアを0.1下げる（キーワード方向に）
      },
      // ユーザーが非技術的な背景を持つ場合、セマンティック検索に傾ける
      nonTechnicalBackground: {
        condition: (context) => {
          return context.userProfile && 
                 context.userProfile.background === 'non-technical';
        },
        adjustment: 0.1 // スコアを0.1上げる（セマンティック方向に）
      }
    }
  },
  heuristics: {
    // 特定のパターンに基づくヒューリスティック
    patterns: {
      // クエリが引用符で囲まれている場合、キーワード検索に強く傾ける
      quotedQuery: {
        condition: (query) => {
          return /^".*"$/.test(query.trim());
        },
        override: 'keyword' // キーワード検索に強制的に設定
      },
      // クエリがブール演算子を含む場合、キーワード検索に強く傾ける
      booleanOperators: {
        condition: (query) => {
          return /\b(AND|OR|NOT)\b/i.test(query);
        },
        adjustment: -0.4 // スコアを0.4下げる（キーワード方向に）
      },
      // クエリが特殊な検索構文を含む場合、キーワード検索に強く傾ける
      specialSyntax: {
        condition: (query) => {
          return /(\+|\-|\*|\~|\^|\:)/.test(query);
        },
        adjustment: -0.3 // スコアを0.3下げる（キーワード方向に）
      },
      // クエリが疑問形の場合、セマンティック検索に傾ける
      questionForm: {
        condition: (query, language) => {
          if (language === 'en') {
            return /^(who|what|when|where|why|how)\b/i.test(query) || query.endsWith('?');
          } else if (language === 'ja') {
            return query.endsWith('か？') || query.endsWith('か?') || 
                   query.includes('ですか') || query.includes('ますか');
          }
          return false;
        },
        adjustment: 0.3 // スコアを0.3上げる（セマンティック方向に）
      }
    },
    // 特定の条件に基づくヒューリスティック
    conditions: {
      // クエリが非常に短い場合（1〜2単語）、キーワード検索に傾ける
      veryShortQuery: {
        condition: (query, language, features) => {
          return features.common.tokenCount <= 2;
        },
        adjustment: -0.2 // スコアを0.2下げる（キーワード方向に）
      },
      // クエリが長い場合（10単語以上）、セマンティック検索に傾ける
      longQuery: {
        condition: (query, language, features) => {
          return features.common.tokenCount >= 10;
        },
        adjustment: 0.2 // スコアを0.2上げる（セマンティック方向に）
      }
    }
  }
};
```

## 4. スコアベースの判定

スコアリングによって計算されたスコアに基づいて、クエリタイプを判定します。

```javascript
/**
 * スコアに基づいてクエリタイプを判定する
 * @param {number} score - クエリタイプのスコア（0.0〜1.0）
 * @returns {string} - クエリタイプ（'keyword'、'semantic'、または'hybrid'）
 * @private
 */
determineQueryTypeByScore(score) {
  if (score <= this.determinationLogic.thresholds.keywordCentric) {
    return 'keyword';
  } else if (score >= this.determinationLogic.thresholds.semanticCentric) {
    return 'semantic';
  } else {
    return 'hybrid';
  }
}
```

## 5. コンテキスト考慮の判定

検索コンテキストを考慮して、スコアを調整し、クエリタイプを判定します。

```javascript
/**
 * コンテキストを考慮してスコアを調整する
 * @param {number} score - クエリタイプのスコア（0.0〜1.0）
 * @param {object} context - 検索コンテキスト
 * @returns {number} - 調整されたスコア（0.0〜1.0）
 * @private
 */
adjustScoreByContext(score, context) {
  let adjustedScore = score;
  
  // 前回の検索に基づくルールを適用
  for (const rule of Object.values(this.determinationLogic.contextRules.previousSearches)) {
    if (rule.condition(context)) {
      adjustedScore += rule.adjustment;
    }
  }
  
  // ユーザープロファイルに基づくルールを適用
  for (const rule of Object.values(this.determinationLogic.contextRules.userProfile)) {
    if (rule.condition(context)) {
      adjustedScore += rule.adjustment;
    }
  }
  
  // スコアを0.0〜1.0の範囲に制限
  return Math.max(0.0, Math.min(1.0, adjustedScore));
}
```

## 6. ヒューリスティックの適用

特定のパターンや条件に基づくヒューリスティックを適用して、クエリタイプを判定します。

```javascript
/**
 * ヒューリスティックを適用してクエリタイプを判定する
 * @param {string} query - クエリ
 * @param {string} language - 言語（'ja'または'en'）
 * @param {object} features - 抽出された特徴量
 * @param {number} score - クエリタイプのスコア（0.0〜1.0）
 * @returns {object} - 判定結果（adjustedScore: 調整されたスコア、override: 強制的に設定するクエリタイプ）
 * @private
 */
applyHeuristics(query, language, features, score) {
  let adjustedScore = score;
  let override = null;
  
  // パターンに基づくヒューリスティックを適用
  for (const heuristic of Object.values(this.determinationLogic.heuristics.patterns)) {
    if (heuristic.condition(query, language)) {
      if (heuristic.override) {
        override = heuristic.override;
      } else if (heuristic.adjustment) {
        adjustedScore += heuristic.adjustment;
      }
    }
  }
  
  // 条件に基づくヒューリスティックを適用
  for (const heuristic of Object.values(this.determinationLogic.heuristics.conditions)) {
    if (heuristic.condition(query, language, features)) {
      if (heuristic.override) {
        override = heuristic.override;
      } else if (heuristic.adjustment) {
        adjustedScore += heuristic.adjustment;
      }
    }
  }
  
  // スコアを0.0〜1.0の範囲に制限
  adjustedScore = Math.max(0.0, Math.min(1.0, adjustedScore));
  
  return {
    adjustedScore,
    override
  };
}
```

## 7. 適応的調整

過去の検索結果に基づいて、判定ロジックを適応的に調整します。

```javascript
/**
 * 判定ロジックを適応的に調整する
 * @param {object} searchResult - 検索結果
 * @param {string} queryType - 使用されたクエリタイプ
 * @param {number} originalScore - 元のスコア
 * @param {number} adjustedScore - 調整されたスコア
 */
adaptDeterminationLogic(searchResult, queryType, originalScore, adjustedScore) {
  // 検索結果が良好だった場合、現在の判定ロジックを強化
  if (searchResult.quality === 'good') {
    // 現在の判定ロジックが正しかった場合、閾値を調整して同様の判定をしやすくする
    if (queryType === 'keyword' && originalScore <= this.determinationLogic.thresholds.keywordCentric) {
      // キーワード検索が成功した場合、キーワード閾値を少し上げる
      this.determinationLogic.thresholds.keywordCentric += 0.01;
    } else if (queryType === 'semantic' && originalScore >= this.determinationLogic.thresholds.semanticCentric) {
      // セマンティック検索が成功した場合、セマンティック閾値を少し下げる
      this.determinationLogic.thresholds.semanticCentric -= 0.01;
    }
  } else if (searchResult.quality === 'poor') {
    // 検索結果が良くなかった場合、判定ロジックを調整
    if (queryType === 'keyword') {
      // キーワード検索が失敗した場合、キーワード閾値を少し下げる
      this.determinationLogic.thresholds.keywordCentric -= 0.01;
    } else if (queryType === 'semantic') {
      // セマンティック検索が失敗した場合、セマンティック閾値を少し上げる
      this.determinationLogic.thresholds.semanticCentric += 0.01;
    }
  }
  
  // 閾値の制約を適用
  this.determinationLogic.thresholds.keywordCentric = Math.max(0.1, Math.min(0.4, this.determinationLogic.thresholds.keywordCentric));
  this.determinationLogic.thresholds.semanticCentric = Math.max(0.6, Math.min(0.9, this.determinationLogic.thresholds.semanticCentric));
}
```

## 8. 総合的な判定プロセス

スコアリング、コンテキスト考慮、ヒューリスティックの適用、適応的調整を組み合わせた総合的な判定プロセスを実装します。

```javascript
/**
 * クエリタイプを判別する
 * @param {string} query - クエリ
 * @param {string} language - 言語（'ja'または'en'）
 * @param {object} context - 検索コンテキスト
 * @returns {object} - 判別結果
 */
determineQueryType(query, language, context = {}) {
  // 特徴量を抽出
  const features = this.extractFeatures(query, language);
  
  // スコアを計算
  const originalScore = this.calculateQueryTypeScore(features, language);
  
  // コンテキストを考慮してスコアを調整
  const contextAdjustedScore = this.adjustScoreByContext(originalScore, context);
  
  // ヒューリスティックを適用
  const { adjustedScore, override } = this.applyHeuristics(query, language, features, contextAdjustedScore);
  
  // クエリタイプを判定
  const queryType = override || this.determineQueryTypeByScore(adjustedScore);
  
  return {
    query,
    language,
    features,
    originalScore,
    contextAdjustedScore,
    adjustedScore,
    queryType,
    determinationReason: this.generateDeterminationReason(query, language, features, originalScore, contextAdjustedScore, adjustedScore, queryType, override)
  };
}
```

## 9. 判定理由の生成

クエリタイプ判別の理由を生成し、判定プロセスの透明性を確保します。

```javascript
/**
 * 判定理由を生成する
 * @param {string} query - クエリ
 * @param {string} language - 言語（'ja'または'en'）
 * @param {object} features - 抽出された特徴量
 * @param {number} originalScore - 元のスコア
 * @param {number} contextAdjustedScore - コンテキスト調整後のスコア
 * @param {number} adjustedScore - 最終的な調整後のスコア
 * @param {string} queryType - 判定されたクエリタイプ
 * @param {string|null} override - 強制的に設定されたクエリタイプ
 * @returns {string} - 判定理由
 * @private
 */
generateDeterminationReason(query, language, features, originalScore, contextAdjustedScore, adjustedScore, queryType, override) {
  let reason = `元のスコア: ${originalScore.toFixed(2)}`;
  
  // スコアの調整があった場合
  if (originalScore !== contextAdjustedScore) {
    reason += `、コンテキスト調整後のスコア: ${contextAdjustedScore.toFixed(2)}`;
  }
  
  // さらなる調整があった場合
  if (contextAdjustedScore !== adjustedScore) {
    reason += `、ヒューリスティック適用後のスコア: ${adjustedScore.toFixed(2)}`;
  }
  
  // 強制的に設定された場合
  if (override) {
    reason += `、ヒューリスティックによる強制設定: ${override}`;
  }
  
  // 判定されたクエリタイプ
  reason += `、判定結果: ${queryType}`;
  
  // 特徴的な要素
  const significantFeatures = this.getSignificantFeatures(features, language);
  if (significantFeatures.length > 0) {
    reason += `、特徴的な要素: ${significantFeatures.join(', ')}`;
  }
  
  return reason;
}

/**
 * 特徴的な要素を取得する
 * @param {object} features - 抽出された特徴量
 * @param {string} language - 言語（'ja'または'en'）
 * @returns {Array<string>} - 特徴的な要素
 * @private
 */
getSignificantFeatures(features, language) {
  const significantFeatures = [];
  
  // 共通特徴量
  if (features.common.tokenCount <= 2) {
    significantFeatures.push('非常に短いクエリ');
  } else if (features.common.tokenCount >= 10) {
    significantFeatures.push('長いクエリ');
  }
  
  if (features.common.specialCharacterRatio > 0.1) {
    significantFeatures.push('特殊文字が多い');
  }
  
  // 言語特有の特徴量
  if (language === 'ja') {
    if (features.japanese.grammar.particlePatterns.totalParticles > 3) {
      significantFeatures.push('助詞が多い');
    }
    
    if (features.japanese.grammar.endingExpressions.hasSpecificEnding) {
      significantFeatures.push('特定の文末表現あり');
    }
    
    if (features.japanese.grammar.complexSentenceStructure.hasComplexStructure) {
      significantFeatures.push('複雑な文構造');
    }
  } else if (language === 'en') {
    if (features.english.basic.stopwordRatio > 0.3) {
      significantFeatures.push('ストップワードが多い');
    }
    
    if (features.english.grammar.posAnalysis.grammaticalStructureScore > 0.7) {
      significantFeatures.push('文法的構造が強い');
    }
    
    if (features.english.grammar.syntaxAnalysis.syntaxComplexityScore > 0.7) {
      significantFeatures.push('構文が複雑');
    }
  }
  
  return significantFeatures;
}
```

## 10. 判定ロジックの実装例

以下に、クエリタイプ判別の判定ロジックの実装例を示します。

```javascript
/**
 * クエリタイプ判別の判定ロジックを実装したクラス
 */
class QueryTypeDeterminer {
  constructor() {
    // スコアリングモデルと判定ロジックを初期化
    this.scoringModel = {
      japanese: { /* 日本語スコアリングモデル */ },
      english: { /* 英語スコアリングモデル */ }
    };
    
    this.determinationLogic = {
      thresholds: {
        keywordCentric: 0.3,
        semanticCentric: 0.7
      },
      contextRules: { /* コンテキストルール */ },
      heuristics: { /* ヒューリスティック */ }
    };
  }
  
  /**
   * クエリタイプを判別する
   * @param {string} query - クエリ
   * @param {string} language - 言語（'ja'または'en'）
   * @param {object} context - 検索コンテキスト
   * @returns {object} - 判別結果
   */
  determineQueryType(query, language, context = {}) {
    // 特徴量を抽出
    const features = this.extractFeatures(query, language);
    
    // スコアを計算
    const originalScore = this.calculateQueryTypeScore(features, language);
    
    // コンテキストを考慮してスコアを調整
    const contextAdjustedScore = this.adjustScoreByContext(originalScore, context);
    
    // ヒューリスティックを適用
    const { adjustedScore, override } = this.applyHeuristics(query, language, features, contextAdjustedScore);
    
    // クエリタイプを判定
    const queryType = override || this.determineQueryTypeByScore(adjustedScore);
    
    // 判定結果を返す
    return {
      query,
      language,
      features,
      originalScore,
      contextAdjustedScore,
      adjustedScore,
      queryType,
      determinationReason: this.generateDeterminationReason(query, language, features, originalScore, contextAdjustedScore, adjustedScore, queryType, override)
    };
  }
  
  // その他のメソッド（特徴量抽出、スコア計算、コンテキスト調整、ヒューリスティック適用など）
}
```

## 11. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの判定ロジックについて説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-extensions.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - メタデータフィルタリング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-metadata-filtering.md)
