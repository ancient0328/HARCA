---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 日本語特徴量 - 文法特性）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 日本語特徴量 - 文法特性）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの特徴抽出のうち、日本語クエリに特化した文法特性の分析について説明します。

## 2. 日本語クエリの文法特性

日本語クエリの文法特性は、クエリの構造や意図を理解するための重要な手がかりとなります。特に、以下の文法特性が重要です：

1. **助詞の使用パターン**：「は」「が」「を」「に」などの助詞の使用パターン
2. **文末表現**：「ですか」「てください」などの文末表現
3. **敬語表現**：「です」「ます」などの敬語表現
4. **疑問表現**：「何」「どこ」「いつ」などの疑問詞や「か」などの疑問を表す助詞
5. **命令表現**：「て」「なさい」などの命令を表す表現
6. **複文構造**：「が」「けれども」「ので」などの接続助詞による複文構造

これらの文法特性を分析することで、クエリがキーワード中心なのかセマンティック中心なのかを判別するための重要な特徴量を抽出することができます。

## 3. 助詞の使用パターン分析

助詞の使用パターンは、日本語クエリの文法構造を示す重要な特徴です。特に、格助詞（「が」「を」「に」など）や係助詞（「は」「も」など）の使用パターンは、クエリが文として構造化されているかどうかを判断する手がかりとなります。

```javascript
/**
 * 日本語クエリの助詞の使用パターンを分析する
 * @param {Array<object>} tokens - 形態素解析結果
 * @returns {object} - 助詞の使用パターン
 * @private
 */
analyzeJapaneseParticlePatterns(tokens) {
  // 助詞のカウント
  const particleCounts = {};
  let totalParticles = 0;
  
  // 助詞の種類
  const caseParticles = ['が', 'を', 'に', 'へ', 'と', 'から', 'より', 'で', 'まで'];
  const topicParticles = ['は', 'も'];
  const conjunctiveParticles = ['て', 'で', 'ながら', 'つつ', 'ので', 'から', 'ば', 'たら', 'なら', 'と', 'が', 'けれども', 'のに'];
  const endParticles = ['か', 'な', 'ね', 'よ', 'ぞ', 'ぜ', 'わ'];
  
  // 助詞の出現をカウント
  for (const token of tokens) {
    if (token.pos === '助詞') {
      const particle = token.surface_form;
      particleCounts[particle] = (particleCounts[particle] || 0) + 1;
      totalParticles++;
    }
  }
  
  // 助詞のカテゴリ別カウント
  let caseParticleCount = 0;
  let topicParticleCount = 0;
  let conjunctiveParticleCount = 0;
  let endParticleCount = 0;
  
  for (const particle in particleCounts) {
    if (caseParticles.includes(particle)) {
      caseParticleCount += particleCounts[particle];
    }
    if (topicParticles.includes(particle)) {
      topicParticleCount += particleCounts[particle];
    }
    if (conjunctiveParticles.includes(particle)) {
      conjunctiveParticleCount += particleCounts[particle];
    }
    if (endParticles.includes(particle)) {
      endParticleCount += particleCounts[particle];
    }
  }
  
  // 助詞の使用パターンの特徴量
  return {
    totalParticles,
    caseParticleCount,
    topicParticleCount,
    conjunctiveParticleCount,
    endParticleCount,
    caseParticleRatio: totalParticles > 0 ? caseParticleCount / totalParticles : 0,
    topicParticleRatio: totalParticles > 0 ? topicParticleCount / totalParticles : 0,
    conjunctiveParticleRatio: totalParticles > 0 ? conjunctiveParticleCount / totalParticles : 0,
    endParticleRatio: totalParticles > 0 ? endParticleCount / totalParticles : 0,
    particleCounts
  };
}
```

### 3.1 助詞の使用パターンの解釈

助詞の使用パターンは、以下のように解釈されます：

- **格助詞の割合（caseParticleRatio）**：格助詞の割合が高いほど、主語や目的語などの文の要素が明確に示されたセマンティック中心クエリである可能性が高まります。
- **係助詞の割合（topicParticleRatio）**：係助詞の割合が高いほど、話題や対比が明示されたセマンティック中心クエリである可能性が高まります。
- **接続助詞の割合（conjunctiveParticleRatio）**：接続助詞の割合が高いほど、複文構造を持つセマンティック中心クエリである可能性が高まります。
- **終助詞の割合（endParticleRatio）**：終助詞の割合が高いほど、話者の態度や意図が明示されたセマンティック中心クエリである可能性が高まります。

## 4. 文末表現分析

文末表現は、クエリの種類（質問、命令、説明など）を示す重要な特徴です。特に、「ですか」「てください」などの文末表現は、クエリがセマンティック中心であることを強く示唆します。

```javascript
/**
 * 日本語クエリの文末表現を分析する
 * @param {Array<object>} tokens - 形態素解析結果
 * @returns {object} - 文末表現の特徴
 * @private
 */
analyzeJapaneseEndingExpressions(tokens) {
  // 文末の数トークンを分析
  const endingTokenCount = Math.min(3, tokens.length);
  const endingTokens = tokens.slice(-endingTokenCount);
  
  // 文末表現のパターン
  const isQuestion = this.hasJapaneseQuestionEnding(endingTokens);
  const isRequest = this.hasJapaneseRequestEnding(endingTokens);
  const isCommand = this.hasJapaneseCommandEnding(endingTokens);
  const isPolite = this.hasJapanesePoliteEnding(endingTokens);
  
  // 文末表現の特徴量
  return {
    isQuestion,
    isRequest,
    isCommand,
    isPolite,
    hasSpecificEnding: isQuestion || isRequest || isCommand || isPolite
  };
}

/**
 * 日本語クエリが疑問文の文末表現を持つかどうかを判定する
 * @param {Array<object>} endingTokens - 文末のトークン
 * @returns {boolean} - 疑問文の文末表現を持つかどうか
 * @private
 */
hasJapaneseQuestionEnding(endingTokens) {
  // 疑問文の文末表現パターン
  const questionPatterns = [
    // 「〜ですか」「〜ますか」などのパターン
    token => token.surface_form === 'か' && token.pos === '助詞',
    // 「〜のですか」「〜のでしょうか」などのパターン
    token => token.surface_form === 'の' && token.pos === '助詞' && token.pos_detail_1 === '連体化',
    // 疑問詞（何、どこ、いつなど）を含むパターン
    token => ['何', 'なに', 'どこ', 'いつ', 'だれ', '誰', 'どの', 'どんな', 'どう', 'どうして', 'なぜ', '何故'].includes(token.basic_form)
  ];
  
  // いずれかのパターンに一致するかどうかを判定
  return endingTokens.some(token => questionPatterns.some(pattern => pattern(token)));
}

/**
 * 日本語クエリが依頼の文末表現を持つかどうかを判定する
 * @param {Array<object>} endingTokens - 文末のトークン
 * @returns {boolean} - 依頼の文末表現を持つかどうか
 * @private
 */
hasJapaneseRequestEnding(endingTokens) {
  // 依頼の文末表現パターン
  const requestPatterns = [
    // 「〜てください」「〜ていただけますか」などのパターン
    token => token.surface_form === 'て' && token.pos === '助詞' && token.pos_detail_1 === '接続助詞',
    // 「〜お願いします」などのパターン
    token => token.basic_form === '願う' || token.basic_form === 'お願い',
    // 「〜いただけますか」などのパターン
    token => token.basic_form === '頂く' || token.basic_form === 'いただく'
  ];
  
  // いずれかのパターンに一致するかどうかを判定
  return endingTokens.some(token => requestPatterns.some(pattern => pattern(token)));
}

/**
 * 日本語クエリが命令の文末表現を持つかどうかを判定する
 * @param {Array<object>} endingTokens - 文末のトークン
 * @returns {boolean} - 命令の文末表現を持つかどうか
 * @private
 */
hasJapaneseCommandEnding(endingTokens) {
  // 命令の文末表現パターン
  const commandPatterns = [
    // 「〜しろ」「〜せよ」などのパターン
    token => token.conjugated_form === '命令' && token.pos === '動詞',
    // 「〜なさい」などのパターン
    token => token.basic_form === 'なさる' && token.conjugated_form === '命令',
    // 「〜するな」などのパターン
    token => token.surface_form === 'な' && token.pos === '助詞' && token.pos_detail_1 === '終助詞'
  ];
  
  // いずれかのパターンに一致するかどうかを判定
  return endingTokens.some(token => commandPatterns.some(pattern => pattern(token)));
}

/**
 * 日本語クエリが丁寧な文末表現を持つかどうかを判定する
 * @param {Array<object>} endingTokens - 文末のトークン
 * @returns {boolean} - 丁寧な文末表現を持つかどうか
 * @private
 */
hasJapanesePoliteEnding(endingTokens) {
  // 丁寧な文末表現パターン
  const politePatterns = [
    // 「〜です」「〜ます」などのパターン
    token => token.basic_form === 'です' || token.basic_form === 'ます',
    // 「〜でございます」などのパターン
    token => token.basic_form === 'ございます',
    // 「〜でしょう」などのパターン
    token => token.basic_form === 'でしょう'
  ];
  
  // いずれかのパターンに一致するかどうかを判定
  return endingTokens.some(token => politePatterns.some(pattern => pattern(token)));
}
```

### 4.1 文末表現の解釈

文末表現は、以下のように解釈されます：

- **疑問文（isQuestion）**：疑問文の文末表現を持つ場合、質問形式のセマンティック中心クエリである可能性が高まります。
- **依頼表現（isRequest）**：依頼の文末表現を持つ場合、依頼形式のセマンティック中心クエリである可能性が高まります。
- **命令表現（isCommand）**：命令の文末表現を持つ場合、命令形式のセマンティック中心クエリである可能性が高まります。
- **丁寧表現（isPolite）**：丁寧な文末表現を持つ場合、丁寧な表現を含むセマンティック中心クエリである可能性が高まります。
- **特定の文末表現（hasSpecificEnding）**：いずれかの特定の文末表現を持つ場合、セマンティック中心クエリである可能性が高まります。

## 5. 複文構造分析

複文構造は、クエリの複雑さを示す重要な特徴です。接続助詞（「が」「けれども」「ので」など）による複文構造は、クエリがセマンティック中心であることを強く示唆します。

```javascript
/**
 * 日本語クエリの複文構造を分析する
 * @param {Array<object>} tokens - 形態素解析結果
 * @returns {object} - 複文構造の特徴
 * @private
 */
analyzeJapaneseComplexSentenceStructure(tokens) {
  // 接続助詞のカウント
  const conjunctiveParticles = ['て', 'で', 'ながら', 'つつ', 'ので', 'から', 'ば', 'たら', 'なら', 'と', 'が', 'けれども', 'のに'];
  const conjunctiveParticleCounts = {};
  let totalConjunctiveParticles = 0;
  
  // 接続詞のカウント
  const conjunctions = ['しかし', 'けれども', 'だが', 'ところが', 'そして', 'また', 'さらに', 'それから', 'したがって', 'そのため', 'だから', 'なぜなら', 'ただし', 'もっとも', 'なお', 'ちなみに'];
  const conjunctionCounts = {};
  let totalConjunctions = 0;
  
  // 接続助詞と接続詞の出現をカウント
  for (const token of tokens) {
    if (token.pos === '助詞' && token.pos_detail_1 === '接続助詞' && conjunctiveParticles.includes(token.surface_form)) {
      conjunctiveParticleCounts[token.surface_form] = (conjunctiveParticleCounts[token.surface_form] || 0) + 1;
      totalConjunctiveParticles++;
    } else if (token.pos === '接続詞' && conjunctions.includes(token.surface_form)) {
      conjunctionCounts[token.surface_form] = (conjunctionCounts[token.surface_form] || 0) + 1;
      totalConjunctions++;
    }
  }
  
  // 複文構造の特徴量
  return {
    totalConjunctiveParticles,
    totalConjunctions,
    totalConnectors: totalConjunctiveParticles + totalConjunctions,
    conjunctiveParticleCounts,
    conjunctionCounts,
    hasComplexStructure: totalConjunctiveParticles > 0 || totalConjunctions > 0
  };
}
```

### 5.1 複文構造の解釈

複文構造は、以下のように解釈されます：

- **接続助詞の数（totalConjunctiveParticles）**：接続助詞の数が多いほど、複文構造を持つセマンティック中心クエリである可能性が高まります。
- **接続詞の数（totalConjunctions）**：接続詞の数が多いほど、複文構造を持つセマンティック中心クエリである可能性が高まります。
- **接続要素の総数（totalConnectors）**：接続要素の総数が多いほど、複雑な文構造を持つセマンティック中心クエリである可能性が高まります。
- **複文構造の有無（hasComplexStructure）**：複文構造を持つ場合、セマンティック中心クエリである可能性が高まります。

## 6. 敬語表現分析

敬語表現は、クエリの丁寧さや形式性を示す特徴です。「です」「ます」などの敬語表現は、クエリがセマンティック中心であることを示唆します。

```javascript
/**
 * 日本語クエリの敬語表現を分析する
 * @param {Array<object>} tokens - 形態素解析結果
 * @returns {object} - 敬語表現の特徴
 * @private
 */
analyzeJapaneseHonorificExpressions(tokens) {
  // 敬語表現のパターン
  const teineigo = ['です', 'ます', 'でした', 'ました']; // 丁寧語
  const sonkeigo = ['なさる', 'いらっしゃる', 'おっしゃる', 'ご覧になる', 'お召し上がる']; // 尊敬語
  const kenjougo = ['いたす', 'もうす', 'おる', 'いただく', 'うかがう', 'まいる', 'はいる', 'おります']; // 謙譲語
  
  // 敬語表現のカウント
  let teineigoCount = 0;
  let sonkeigoCount = 0;
  let kenjougoCount = 0;
  
  for (const token of tokens) {
    if (teineigo.includes(token.basic_form)) {
      teineigoCount++;
    } else if (sonkeigo.includes(token.basic_form)) {
      sonkeigoCount++;
    } else if (kenjougo.includes(token.basic_form)) {
      kenjougoCount++;
    }
  }
  
  // 敬語表現の特徴量
  return {
    teineigoCount,
    sonkeigoCount,
    kenjougoCount,
    totalHonorificCount: teineigoCount + sonkeigoCount + kenjougoCount,
    hasHonorificExpression: teineigoCount > 0 || sonkeigoCount > 0 || kenjougoCount > 0
  };
}
```

### 6.1 敬語表現の解釈

敬語表現は、以下のように解釈されます：

- **丁寧語の数（teineigoCount）**：丁寧語の数が多いほど、丁寧な表現を含むセマンティック中心クエリである可能性が高まります。
- **尊敬語の数（sonkeigoCount）**：尊敬語の数が多いほど、相手を敬う表現を含むセマンティック中心クエリである可能性が高まります。
- **謙譲語の数（kenjougoCount）**：謙譲語の数が多いほど、自分を低める表現を含むセマンティック中心クエリである可能性が高まります。
- **敬語表現の総数（totalHonorificCount）**：敬語表現の総数が多いほど、丁寧な表現を含むセマンティック中心クエリである可能性が高まります。
- **敬語表現の有無（hasHonorificExpression）**：敬語表現を含む場合、セマンティック中心クエリである可能性が高まります。

## 7. 日本語クエリの文法特性の統合

抽出した日本語クエリの文法特性は、クエリタイプ判別の重要な要素となります。これらの特性は、基本特徴量と組み合わせて、より正確なクエリタイプの判別を行うために使用されます。

```javascript
/**
 * 日本語クエリの文法特性を抽出する
 * @param {string} query - 日本語クエリ
 * @returns {object} - 日本語クエリの文法特性
 */
extractJapaneseGrammaticalFeatures(query) {
  // 形態素解析
  const tokens = this.tokenizeJapanese(query);
  
  // 助詞の使用パターン
  const particlePatterns = this.analyzeJapaneseParticlePatterns(tokens);
  
  // 文末表現
  const endingExpressions = this.analyzeJapaneseEndingExpressions(tokens);
  
  // 複文構造
  const complexSentenceStructure = this.analyzeJapaneseComplexSentenceStructure(tokens);
  
  // 敬語表現
  const honorificExpressions = this.analyzeJapaneseHonorificExpressions(tokens);
  
  // 文法特性を統合
  return {
    particlePatterns,
    endingExpressions,
    complexSentenceStructure,
    honorificExpressions,
    // 文法的な構造の強さを示す総合スコア
    grammaticalStructureScore: this.calculateJapaneseGrammaticalStructureScore(
      particlePatterns,
      endingExpressions,
      complexSentenceStructure,
      honorificExpressions
    )
  };
}

/**
 * 日本語クエリの文法的な構造の強さを示す総合スコアを計算する
 * @param {object} particlePatterns - 助詞の使用パターン
 * @param {object} endingExpressions - 文末表現
 * @param {object} complexSentenceStructure - 複文構造
 * @param {object} honorificExpressions - 敬語表現
 * @returns {number} - 文法的な構造の強さを示す総合スコア（0.0〜1.0）
 * @private
 */
calculateJapaneseGrammaticalStructureScore(
  particlePatterns,
  endingExpressions,
  complexSentenceStructure,
  honorificExpressions
) {
  // 各特徴の重み
  const weights = {
    particlePatterns: 0.3,
    endingExpressions: 0.3,
    complexSentenceStructure: 0.2,
    honorificExpressions: 0.2
  };
  
  // 各特徴のスコア
  const scores = {
    particlePatterns: Math.min(1.0, particlePatterns.totalParticles / 5),
    endingExpressions: endingExpressions.hasSpecificEnding ? 1.0 : 0.0,
    complexSentenceStructure: Math.min(1.0, complexSentenceStructure.totalConnectors / 3),
    honorificExpressions: Math.min(1.0, honorificExpressions.totalHonorificCount / 2)
  };
  
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

## 8. 次のステップ

本ドキュメントでは、HARCA多階層記憶システムにおけるPostgreSQLベースのハイブリッド検索のNode.js実装のうち、適応型検索のためのクエリ分析におけるクエリタイプ判別の基本アルゴリズムの特徴抽出のうち、日本語クエリに特化した文法特性の分析について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 特徴抽出 - 英語特徴量）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-features-english.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - スコアリング）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-scoring.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 基本アルゴリズム - 判定ロジック）](./memory-system-postgresql-vector-search-query-hybrid-nodejs-adaptive-query-analysis-type-algorithm-logic.md)
