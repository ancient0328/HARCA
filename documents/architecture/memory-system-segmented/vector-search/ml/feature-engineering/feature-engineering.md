---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能 - 機械学習ベース - 特徴量エンジニアリング）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能 - 機械学習ベース - 特徴量エンジニアリング）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおける機械学習ベースのクエリタイプ判別のための特徴量エンジニアリングについて説明します。特徴量エンジニアリングは、機械学習モデルの性能を左右する重要なプロセスであり、クエリから有用な情報を抽出し、モデルが理解できる形式に変換します。

## 2. 特徴量エンジニアリングの目的

特徴量エンジニアリングの主な目的は以下の通りです：

1. **情報の抽出**：クエリから機械学習モデルにとって有用な情報を抽出します。
2. **次元の削減**：生データを扱いやすい次元に削減します。
3. **ノイズの除去**：クエリタイプ判別に無関係なノイズを除去します。
4. **特徴量の標準化**：異なるスケールの特徴量を標準化し、モデルが公平に学習できるようにします。
5. **非線形関係の捕捉**：特徴量間の非線形関係を捉える新しい特徴量を作成します。

## 3. 基本的な特徴量

機械学習ベースのクエリタイプ判別のための基本的な特徴量には、以下のようなものがあります：

### 3.1 統計的特徴量

```javascript
/**
 * クエリから統計的特徴量を抽出する
 * @param {string} query - クエリ
 * @param {string} language - 言語（'ja'または'en'）
 * @returns {object} - 統計的特徴量
 */
extractStatisticalFeatures(query, language) {
  // クエリの前処理
  const preprocessedQuery = this.preprocessQuery(query, language);
  
  // トークン化
  const tokens = language === 'ja' 
    ? this.tokenizeJapanese(preprocessedQuery)
    : this.tokenizeEnglish(preprocessedQuery);
  
  // 統計的特徴量の計算
  return {
    queryLength: query.length,
    tokenCount: tokens.length,
    averageTokenLength: tokens.reduce((sum, token) => sum + token.length, 0) / tokens.length,
    uniqueTokenRatio: new Set(tokens).size / tokens.length,
    characterDistribution: this.calculateCharacterDistribution(query),
    specialCharacterRatio: (query.match(/[^\w\s]/g) || []).length / query.length,
    digitRatio: (query.match(/\d/g) || []).length / query.length,
    uppercaseRatio: (query.match(/[A-Z]/g) || []).length / query.length,
    whitespaceRatio: (query.match(/\s/g) || []).length / query.length
  };
}

/**
 * 文字分布を計算する
 * @param {string} text - テキスト
 * @returns {object} - 文字分布
 * @private
 */
calculateCharacterDistribution(text) {
  const distribution = {};
  
  for (const char of text) {
    distribution[char] = (distribution[char] || 0) + 1;
  }
  
  // 文字分布の正規化
  const totalChars = text.length;
  for (const char in distribution) {
    distribution[char] /= totalChars;
  }
  
  return distribution;
}
```

### 3.2 言語特有の特徴量

```javascript
/**
 * 言語特有の特徴量を抽出する
 * @param {string} query - クエリ
 * @param {string} language - 言語（'ja'または'en'）
 * @returns {object} - 言語特有の特徴量
 */
extractLanguageSpecificFeatures(query, language) {
  if (language === 'ja') {
    return this.extractJapaneseFeatures(query);
  } else if (language === 'en') {
    return this.extractEnglishFeatures(query);
  } else {
    throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * 日本語特有の特徴量を抽出する
 * @param {string} query - クエリ
 * @returns {object} - 日本語特有の特徴量
 * @private
 */
extractJapaneseFeatures(query) {
  // 形態素解析
  const tokens = this.tokenizeJapanese(query);
  
  // 品詞分布
  const posDistribution = this.calculatePosDistribution(tokens);
  
  // 文字種分布
  const characterTypeDistribution = this.calculateJapaneseCharacterTypeDistribution(query);
  
  // 特定の文法パターン
  const grammarPatterns = this.detectJapaneseGrammarPatterns(tokens);
  
  return {
    posDistribution,
    characterTypeDistribution,
    grammarPatterns,
    // その他の日本語特有の特徴量
  };
}

/**
 * 英語特有の特徴量を抽出する
 * @param {string} query - クエリ
 * @returns {object} - 英語特有の特徴量
 * @private
 */
extractEnglishFeatures(query) {
  // トークン化
  const tokens = this.tokenizeEnglish(query);
  
  // 品詞タグ付け
  const taggedTokens = this.posTagEnglish(tokens);
  
  // 品詞分布
  const posDistribution = this.calculateEnglishPosDistribution(taggedTokens);
  
  // ストップワード比率
  const stopwordRatio = this.calculateStopwordRatio(tokens);
  
  // 特定の文法パターン
  const grammarPatterns = this.detectEnglishGrammarPatterns(taggedTokens);
  
  return {
    posDistribution,
    stopwordRatio,
    grammarPatterns,
    // その他の英語特有の特徴量
  };
}
```

### 3.3 セマンティック特徴量

```javascript
/**
 * セマンティック特徴量を抽出する
 * @param {string} query - クエリ
 * @param {string} language - 言語（'ja'または'en'）
 * @returns {object} - セマンティック特徴量
 */
extractSemanticFeatures(query, language) {
  // 単語埋め込み
  const wordEmbeddings = this.getWordEmbeddings(query, language);
  
  // クエリ埋め込み（単語埋め込みの平均）
  const queryEmbedding = this.calculateAverageEmbedding(wordEmbeddings);
  
  // 埋め込みの分散
  const embeddingVariance = this.calculateEmbeddingVariance(wordEmbeddings);
  
  // 意味的一貫性スコア
  const semanticCoherenceScore = this.calculateSemanticCoherenceScore(wordEmbeddings);
  
  return {
    queryEmbedding,
    embeddingVariance,
    semanticCoherenceScore,
    // その他のセマンティック特徴量
  };
}

/**
 * 単語埋め込みを取得する
 * @param {string} query - クエリ
 * @param {string} language - 言語（'ja'または'en'）
 * @returns {Array<Array<number>>} - 単語埋め込み
 * @private
 */
getWordEmbeddings(query, language) {
  // 事前訓練済みの単語埋め込みモデルを使用
  // 例：Word2Vec、GloVe、FastTextなど
  
  // この例では、モデルがロードされていることを前提としています
  const tokens = language === 'ja' 
    ? this.tokenizeJapanese(query)
    : this.tokenizeEnglish(query);
  
  return tokens.map(token => this.wordEmbeddingModel.getEmbedding(token, language));
}

/**
 * 平均埋め込みを計算する
 * @param {Array<Array<number>>} embeddings - 単語埋め込み
 * @returns {Array<number>} - 平均埋め込み
 * @private
 */
calculateAverageEmbedding(embeddings) {
  if (embeddings.length === 0) {
    return [];
  }
  
  const dimension = embeddings[0].length;
  const average = new Array(dimension).fill(0);
  
  for (const embedding of embeddings) {
    for (let i = 0; i < dimension; i++) {
      average[i] += embedding[i];
    }
  }
  
  for (let i = 0; i < dimension; i++) {
    average[i] /= embeddings.length;
  }
  
  return average;
}
```

## 4. 高度な特徴量エンジニアリング

基本的な特徴量に加えて、以下のような高度な特徴量エンジニアリング手法を適用することで、モデルの性能をさらに向上させることができます。

### 4.1 特徴量の組み合わせ

```javascript
/**
 * 特徴量を組み合わせる
 * @param {object} features - 抽出された特徴量
 * @returns {object} - 組み合わせた特徴量
 */
combineFeatures(features) {
  const combinedFeatures = { ...features };
  
  // 特徴量の積
  combinedFeatures.queryLengthTokenCountProduct = features.queryLength * features.tokenCount;
  
  // 特徴量の比率
  combinedFeatures.queryLengthTokenCountRatio = features.queryLength / features.tokenCount;
  
  // 特徴量の二乗
  combinedFeatures.queryLengthSquared = features.queryLength ** 2;
  
  // 特徴量の対数
  combinedFeatures.tokenCountLog = Math.log(features.tokenCount + 1);
  
  return combinedFeatures;
}
```

### 4.2 主成分分析（PCA）

```javascript
/**
 * 主成分分析を適用する
 * @param {Array<Array<number>>} featureVectors - 特徴量ベクトル
 * @param {number} numComponents - 主成分の数
 * @returns {Array<Array<number>>} - 次元削減された特徴量ベクトル
 */
applyPCA(featureVectors, numComponents) {
  // PCAの実装
  // この例では、TensorFlow.jsを使用した簡易的な実装を示します
  
  // 特徴量ベクトルをテンソルに変換
  const featureTensor = tf.tensor2d(featureVectors);
  
  // 平均を計算
  const mean = featureTensor.mean(0);
  
  // 平均を引く
  const centeredData = featureTensor.sub(mean);
  
  // 共分散行列を計算
  const covarianceMatrix = tf.matMul(centeredData.transpose(), centeredData)
    .div(featureVectors.length - 1);
  
  // 固有値分解
  const { eigenvectors } = tf.linalg.eigvalsh(covarianceMatrix);
  
  // 上位のnumComponents個の固有ベクトルを選択
  const principalComponents = eigenvectors.slice([0, 0], [eigenvectors.shape[0], numComponents]);
  
  // 次元削減
  const reducedFeatures = tf.matMul(centeredData, principalComponents);
  
  // テンソルを配列に変換して返す
  return reducedFeatures.arraySync();
}
```

### 4.3 特徴量の正規化

```javascript
/**
 * 特徴量を正規化する
 * @param {object} features - 特徴量
 * @param {object} scaleParams - スケールパラメータ
 * @returns {object} - 正規化された特徴量
 */
normalizeFeatures(features, scaleParams) {
  const normalizedFeatures = {};
  
  for (const feature in features) {
    if (typeof features[feature] === 'number') {
      // Min-Max正規化
      if (scaleParams[feature] && scaleParams[feature].type === 'minmax') {
        const { min, max } = scaleParams[feature];
        normalizedFeatures[feature] = (features[feature] - min) / (max - min);
      }
      // Z-score正規化
      else if (scaleParams[feature] && scaleParams[feature].type === 'zscore') {
        const { mean, std } = scaleParams[feature];
        normalizedFeatures[feature] = (features[feature] - mean) / std;
      }
      // 正規化なし
      else {
        normalizedFeatures[feature] = features[feature];
      }
    } else {
      // 数値以外の特徴量はそのまま
      normalizedFeatures[feature] = features[feature];
    }
  }
  
  return normalizedFeatures;
}
```

## 5. 特徴量選択

全ての特徴量が同等に重要とは限りません。特徴量選択を行うことで、モデルの性能向上とオーバーフィッティングの防止が期待できます。

### 5.1 フィルタ法

```javascript
/**
 * 分散に基づいて特徴量を選択する
 * @param {Array<object>} featureVectors - 特徴量ベクトル
 * @param {number} threshold - 分散の閾値
 * @returns {Array<string>} - 選択された特徴量の名前
 */
selectFeaturesByVariance(featureVectors, threshold) {
  const variances = {};
  
  // 各特徴量の分散を計算
  for (const feature in featureVectors[0]) {
    if (typeof featureVectors[0][feature] === 'number') {
      const values = featureVectors.map(vector => vector[feature]);
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
      variances[feature] = variance;
    }
  }
  
  // 分散が閾値以上の特徴量を選択
  return Object.keys(variances).filter(feature => variances[feature] >= threshold);
}
```

### 5.2 ラッパー法

```javascript
/**
 * 再帰的特徴量除去を行う
 * @param {Array<object>} featureVectors - 特徴量ベクトル
 * @param {Array<number>} labels - ラベル
 * @param {number} numFeaturesToSelect - 選択する特徴量の数
 * @returns {Array<string>} - 選択された特徴量の名前
 */
recursiveFeatureElimination(featureVectors, labels, numFeaturesToSelect) {
  const allFeatures = Object.keys(featureVectors[0]).filter(
    feature => typeof featureVectors[0][feature] === 'number'
  );
  
  let selectedFeatures = [...allFeatures];
  
  while (selectedFeatures.length > numFeaturesToSelect) {
    // 現在の特徴量セットでモデルを訓練
    const model = this.trainModel(featureVectors, labels, selectedFeatures);
    
    // 特徴量の重要度を取得
    const featureImportance = this.getFeatureImportance(model, selectedFeatures);
    
    // 最も重要度の低い特徴量を除去
    const leastImportantFeature = selectedFeatures.reduce(
      (minFeature, feature) => featureImportance[feature] < featureImportance[minFeature] ? feature : minFeature,
      selectedFeatures[0]
    );
    
    selectedFeatures = selectedFeatures.filter(feature => feature !== leastImportantFeature);
  }
  
  return selectedFeatures;
}
```

## 6. 特徴量エンジニアリングパイプライン

特徴量エンジニアリングの各ステップを統合したパイプラインを構築することで、一貫性のある特徴量処理が可能になります。

```javascript
/**
 * 特徴量エンジニアリングパイプラインを実行する
 * @param {string} query - クエリ
 * @param {string} language - 言語（'ja'または'en'）
 * @returns {object} - 処理された特徴量
 */
featureEngineeringPipeline(query, language) {
  // 1. 基本的な特徴量抽出
  const statisticalFeatures = this.extractStatisticalFeatures(query, language);
  const languageSpecificFeatures = this.extractLanguageSpecificFeatures(query, language);
  const semanticFeatures = this.extractSemanticFeatures(query, language);
  
  // 2. 特徴量の組み合わせ
  const combinedFeatures = this.combineFeatures({
    ...statisticalFeatures,
    ...languageSpecificFeatures,
    ...semanticFeatures
  });
  
  // 3. 特徴量の正規化
  const normalizedFeatures = this.normalizeFeatures(combinedFeatures, this.scaleParams);
  
  // 4. 特徴量選択（オプション）
  const selectedFeatures = {};
  for (const feature of this.selectedFeatureNames) {
    if (normalizedFeatures[feature] !== undefined) {
      selectedFeatures[feature] = normalizedFeatures[feature];
    }
  }
  
  return selectedFeatures;
}
```

## 7. 次のステップ

本ドキュメントでは、機械学習ベースのクエリタイプ判別のための特徴量エンジニアリングについて説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能 - 機械学習ベース - モデルトレーニング）](./model-training.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能 - 機械学習ベース - 推論プロセス）](./inference-process.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能 - 機械学習ベース - モデル更新）](./model-update.md)
