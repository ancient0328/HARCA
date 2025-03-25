---
title: "多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能 - 機械学習ベース - モデルトレーニング - データ収集・準備）"
date: "2025-03-24"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能 - 機械学習ベース - モデルトレーニング - データ収集・準備）

*作成日: 2025年3月24日*
*更新日: 2025年3月24日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムにおける機械学習ベースのクエリタイプ判別のためのデータ収集・準備について説明します。高品質なトレーニングデータは、モデルの性能を左右する重要な要素です。

## 2. データ収集の方法

クエリタイプ判別のためのトレーニングデータを収集する方法には、以下のようなものがあります：

### 2.1 実際のユーザークエリログの収集

```javascript
/**
 * ユーザークエリログを収集する
 * @param {object} options - オプション
 * @returns {Promise<Array<object>>} - 収集されたクエリログ
 */
async collectUserQueryLogs(options = {}) {
  const {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // デフォルトは過去30日
    endDate = new Date(),
    limit = 10000,
    offset = 0
  } = options;
  
  try {
    // データベースからクエリログを取得
    const queryLogs = await this.db.query(
      `SELECT 
        query_id, 
        query_text, 
        query_language, 
        search_strategy, 
        result_count, 
        click_count, 
        timestamp
      FROM query_logs
      WHERE timestamp BETWEEN $1 AND $2
      ORDER BY timestamp DESC
      LIMIT $3 OFFSET $4`,
      [startDate, endDate, limit, offset]
    );
    
    return queryLogs.rows;
  } catch (error) {
    console.error('Error collecting user query logs:', error);
    throw error;
  }
}
```

### 2.2 手動ラベル付けデータの作成

```javascript
/**
 * 手動ラベル付けデータを作成する
 * @param {Array<object>} unlabeledQueries - ラベルなしクエリ
 * @param {Function} labelingFunction - ラベル付け関数
 * @returns {Promise<Array<object>>} - ラベル付きクエリ
 */
async createManuallyLabeledData(unlabeledQueries, labelingFunction) {
  const labeledQueries = [];
  
  for (const query of unlabeledQueries) {
    try {
      // ラベル付け関数を使用してクエリにラベルを付ける
      const label = await labelingFunction(query);
      
      labeledQueries.push({
        ...query,
        label
      });
    } catch (error) {
      console.error(`Error labeling query "${query.query_text}":`, error);
    }
  }
  
  return labeledQueries;
}

/**
 * クエリにラベルを付ける関数の例
 * @param {object} query - クエリ
 * @returns {Promise<string>} - ラベル
 */
async manualLabelingFunction(query) {
  // この例では、外部APIを使用してラベルを取得
  // 実際には、人間のアノテーターによるラベル付けや、
  // ヒューリスティックルールに基づくラベル付けなどが考えられる
  
  const response = await fetch('https://api.example.com/label-query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: query.query_text,
      language: query.query_language
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to label query: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.label;
}
```

### 2.3 合成データの生成

```javascript
/**
 * 合成データを生成する
 * @param {object} options - オプション
 * @returns {Array<object>} - 生成された合成データ
 */
generateSyntheticData(options = {}) {
  const {
    count = 1000,
    languages = ['ja', 'en'],
    queryTypes = ['keyword', 'semantic', 'hybrid']
  } = options;
  
  const syntheticData = [];
  
  for (let i = 0; i < count; i++) {
    // ランダムに言語を選択
    const language = languages[Math.floor(Math.random() * languages.length)];
    
    // ランダムにクエリタイプを選択
    const queryType = queryTypes[Math.floor(Math.random() * queryTypes.length)];
    
    // クエリタイプに基づいてクエリを生成
    const query = this.generateQueryByType(queryType, language);
    
    syntheticData.push({
      query_text: query,
      query_language: language,
      label: queryType
    });
  }
  
  return syntheticData;
}

/**
 * クエリタイプに基づいてクエリを生成する
 * @param {string} queryType - クエリタイプ
 * @param {string} language - 言語
 * @returns {string} - 生成されたクエリ
 * @private
 */
generateQueryByType(queryType, language) {
  if (language === 'ja') {
    // 日本語クエリの生成
    switch (queryType) {
      case 'keyword':
        return this.generateJapaneseKeywordQuery();
      case 'semantic':
        return this.generateJapaneseSemanticQuery();
      case 'hybrid':
        return this.generateJapaneseHybridQuery();
      default:
        throw new Error(`Unknown query type: ${queryType}`);
    }
  } else if (language === 'en') {
    // 英語クエリの生成
    switch (queryType) {
      case 'keyword':
        return this.generateEnglishKeywordQuery();
      case 'semantic':
        return this.generateEnglishSemanticQuery();
      case 'hybrid':
        return this.generateEnglishHybridQuery();
      default:
        throw new Error(`Unknown query type: ${queryType}`);
    }
  } else {
    throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * 日本語のキーワードクエリを生成する
 * @returns {string} - 生成されたクエリ
 * @private
 */
generateJapaneseKeywordQuery() {
  // キーワードのサンプル
  const keywords = [
    '東京', '大阪', '京都', 'ラーメン', '寿司', '温泉', '旅行',
    'スマートフォン', 'パソコン', 'カメラ', '自動車', '電車',
    '映画', '音楽', '本', 'アニメ', 'ゲーム'
  ];
  
  // 1〜3個のキーワードをランダムに選択
  const count = Math.floor(Math.random() * 3) + 1;
  const selectedKeywords = [];
  
  for (let i = 0; i < count; i++) {
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];
    if (!selectedKeywords.includes(keyword)) {
      selectedKeywords.push(keyword);
    }
  }
  
  return selectedKeywords.join(' ');
}

/**
 * 日本語のセマンティッククエリを生成する
 * @returns {string} - 生成されたクエリ
 * @private
 */
generateJapaneseSemanticQuery() {
  // セマンティッククエリのテンプレート
  const templates = [
    '東京で美味しいラーメン屋を教えてください',
    '大阪の観光スポットを教えてください',
    '京都で人気のある温泉はどこですか',
    '最新のスマートフォンの特徴を教えてください',
    '初心者におすすめのカメラはありますか',
    '電車での東京から大阪への最速ルートを教えてください',
    '今月公開される映画のおすすめを教えてください',
    '日本の歴史について詳しく知りたいです',
    'プログラミングを独学で学ぶ方法を教えてください',
    '健康的な食事について詳しく知りたいです'
  ];
  
  // ランダムにテンプレートを選択
  return templates[Math.floor(Math.random() * templates.length)];
}

// 英語クエリ生成メソッドも同様に実装
```

## 3. データクレンジング

収集したデータを機械学習モデルのトレーニングに適した形式にクレンジングします。

```javascript
/**
 * データをクレンジングする
 * @param {Array<object>} data - クレンジング対象のデータ
 * @returns {Array<object>} - クレンジングされたデータ
 */
cleanData(data) {
  // クレンジングされたデータを格納する配列
  const cleanedData = [];
  
  for (const item of data) {
    // 無効なデータをスキップ
    if (!item.query_text || item.query_text.trim() === '') {
      continue;
    }
    
    // クエリテキストのクレンジング
    const cleanedQueryText = this.cleanQueryText(item.query_text);
    
    // クレンジング後のクエリが空の場合はスキップ
    if (cleanedQueryText.trim() === '') {
      continue;
    }
    
    // 言語の検証
    const language = item.query_language || this.detectLanguage(cleanedQueryText);
    if (!['ja', 'en'].includes(language)) {
      continue; // サポートされていない言語はスキップ
    }
    
    // ラベルの検証
    const label = item.label || 'unknown';
    if (!['keyword', 'semantic', 'hybrid', 'unknown'].includes(label)) {
      continue; // 無効なラベルはスキップ
    }
    
    // クレンジングされたデータを追加
    cleanedData.push({
      ...item,
      query_text: cleanedQueryText,
      query_language: language,
      label
    });
  }
  
  return cleanedData;
}

/**
 * クエリテキストをクレンジングする
 * @param {string} queryText - クエリテキスト
 * @returns {string} - クレンジングされたクエリテキスト
 * @private
 */
cleanQueryText(queryText) {
  // 前後の空白を削除
  let cleanedText = queryText.trim();
  
  // 連続する空白を1つの空白に置換
  cleanedText = cleanedText.replace(/\s+/g, ' ');
  
  // HTMLタグを削除
  cleanedText = cleanedText.replace(/<[^>]*>/g, '');
  
  // 特殊文字のエスケープを解除
  cleanedText = cleanedText.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  return cleanedText;
}
```

## 4. データの前処理

クレンジングされたデータを機械学習モデルのトレーニングに適した形式に前処理します。

```javascript
/**
 * データを前処理する
 * @param {Array<object>} data - 前処理対象のデータ
 * @returns {object} - 前処理されたデータ
 */
preprocessData(data) {
  // 特徴量とラベルを抽出
  const features = [];
  const labels = [];
  
  for (const item of data) {
    // 特徴量を抽出
    const extractedFeatures = this.extractFeatures(item.query_text, item.query_language);
    
    // 特徴量を配列に変換
    const featureArray = this.convertFeaturesToArray(extractedFeatures);
    
    // 特徴量を追加
    features.push(featureArray);
    
    // ラベルをワンホットエンコーディング
    const label = this.oneHotEncode(item.label);
    
    // ラベルを追加
    labels.push(label);
  }
  
  return {
    features,
    labels
  };
}

/**
 * 特徴量を配列に変換する
 * @param {object} features - 特徴量
 * @returns {Array<number>} - 特徴量の配列
 * @private
 */
convertFeaturesToArray(features) {
  // 特徴量の順序を定義
  const featureOrder = [
    'queryLength',
    'tokenCount',
    'averageTokenLength',
    'uniqueTokenRatio',
    'specialCharacterRatio',
    'digitRatio',
    // その他の特徴量
  ];
  
  // 特徴量を配列に変換
  return featureOrder.map(feature => {
    // 特徴量が存在する場合はその値を、存在しない場合は0を返す
    return features[feature] !== undefined ? features[feature] : 0;
  });
}

/**
 * ラベルをワンホットエンコーディングする
 * @param {string} label - ラベル
 * @returns {Array<number>} - ワンホットエンコーディングされたラベル
 * @private
 */
oneHotEncode(label) {
  // ラベルの順序を定義
  const labelOrder = ['keyword', 'semantic', 'hybrid', 'unknown'];
  
  // ラベルのインデックスを取得
  const index = labelOrder.indexOf(label);
  
  // ワンホットエンコーディング
  return labelOrder.map((_, i) => i === index ? 1 : 0);
}
```

## 5. データの分割

前処理されたデータをトレーニングセット、検証セット、テストセットに分割します。

```javascript
/**
 * データを分割する
 * @param {object} data - 分割対象のデータ
 * @param {object} options - オプション
 * @returns {object} - 分割されたデータ
 */
splitData(data, options = {}) {
  const {
    trainRatio = 0.7,
    validationRatio = 0.15,
    testRatio = 0.15,
    shuffle = true
  } = options;
  
  // データのインデックスを作成
  const indices = Array.from({ length: data.features.length }, (_, i) => i);
  
  // インデックスをシャッフル
  if (shuffle) {
    this.shuffleArray(indices);
  }
  
  // 分割ポイントを計算
  const trainEndIndex = Math.floor(indices.length * trainRatio);
  const validationEndIndex = trainEndIndex + Math.floor(indices.length * validationRatio);
  
  // インデックスを分割
  const trainIndices = indices.slice(0, trainEndIndex);
  const validationIndices = indices.slice(trainEndIndex, validationEndIndex);
  const testIndices = indices.slice(validationEndIndex);
  
  // データを分割
  return {
    train: {
      features: trainIndices.map(i => data.features[i]),
      labels: trainIndices.map(i => data.labels[i])
    },
    validation: {
      features: validationIndices.map(i => data.features[i]),
      labels: validationIndices.map(i => data.labels[i])
    },
    test: {
      features: testIndices.map(i => data.features[i]),
      labels: testIndices.map(i => data.labels[i])
    }
  };
}

/**
 * 配列をシャッフルする
 * @param {Array} array - シャッフル対象の配列
 * @private
 */
shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
```

## 6. データ拡張

トレーニングデータを拡張して、モデルの汎化性能を向上させます。

```javascript
/**
 * データを拡張する
 * @param {object} data - 拡張対象のデータ
 * @param {object} options - オプション
 * @returns {object} - 拡張されたデータ
 */
augmentData(data, options = {}) {
  const {
    augmentationFactor = 1.5, // 拡張倍率
    augmentationMethods = ['noise', 'synonym', 'word_order'] // 拡張方法
  } = options;
  
  // 拡張されたデータを格納する配列
  const augmentedFeatures = [...data.features];
  const augmentedLabels = [...data.labels];
  
  // 拡張するデータの数を計算
  const numToAugment = Math.floor(data.features.length * (augmentationFactor - 1));
  
  // データを拡張
  for (let i = 0; i < numToAugment; i++) {
    // ランダムにデータを選択
    const randomIndex = Math.floor(Math.random() * data.features.length);
    const feature = data.features[randomIndex];
    const label = data.labels[randomIndex];
    
    // ランダムに拡張方法を選択
    const method = augmentationMethods[Math.floor(Math.random() * augmentationMethods.length)];
    
    // 選択した方法でデータを拡張
    const augmentedFeature = this.augmentFeature(feature, method);
    
    // 拡張されたデータを追加
    augmentedFeatures.push(augmentedFeature);
    augmentedLabels.push(label);
  }
  
  return {
    features: augmentedFeatures,
    labels: augmentedLabels
  };
}

/**
 * 特徴量を拡張する
 * @param {Array<number>} feature - 拡張対象の特徴量
 * @param {string} method - 拡張方法
 * @returns {Array<number>} - 拡張された特徴量
 * @private
 */
augmentFeature(feature, method) {
  switch (method) {
    case 'noise':
      // ノイズを追加
      return feature.map(value => {
        const noise = (Math.random() - 0.5) * 0.1; // -0.05〜0.05のノイズ
        return value + noise;
      });
    case 'synonym':
      // 類義語置換（実際には特徴量を少し変化させる）
      return feature.map(value => {
        const factor = 0.9 + Math.random() * 0.2; // 0.9〜1.1の係数
        return value * factor;
      });
    case 'word_order':
      // 単語順序の変更（実際には特徴量を少し変化させる）
      return feature.map(value => {
        const factor = 0.8 + Math.random() * 0.4; // 0.8〜1.2の係数
        return value * factor;
      });
    default:
      return feature;
  }
}
```

## 7. データ準備パイプライン

データ収集、クレンジング、前処理、分割、拡張を統合したパイプラインを構築します。

```javascript
/**
 * データ準備パイプラインを実行する
 * @param {object} options - オプション
 * @returns {Promise<object>} - 準備されたデータ
 */
async prepareDataPipeline(options = {}) {
  try {
    // 1. データ収集
    const rawData = await this.collectData(options);
    console.log(`Collected ${rawData.length} raw data items`);
    
    // 2. データクレンジング
    const cleanedData = this.cleanData(rawData);
    console.log(`Cleaned data: ${cleanedData.length} items`);
    
    // 3. データ前処理
    const preprocessedData = this.preprocessData(cleanedData);
    console.log(`Preprocessed data: ${preprocessedData.features.length} items`);
    
    // 4. データ分割
    const splitData = this.splitData(preprocessedData, options);
    console.log(`Split data: ${splitData.train.features.length} train, ${splitData.validation.features.length} validation, ${splitData.test.features.length} test`);
    
    // 5. データ拡張（トレーニングデータのみ）
    const augmentedTrainData = options.augment
      ? this.augmentData(splitData.train, options)
      : splitData.train;
    console.log(`Augmented train data: ${augmentedTrainData.features.length} items`);
    
    // 6. 準備されたデータを返す
    return {
      train: augmentedTrainData,
      validation: splitData.validation,
      test: splitData.test,
      featureNames: this.getFeatureNames(),
      labelNames: this.getLabelNames()
    };
  } catch (error) {
    console.error('Error in data preparation pipeline:', error);
    throw error;
  }
}

/**
 * データを収集する
 * @param {object} options - オプション
 * @returns {Promise<Array<object>>} - 収集されたデータ
 * @private
 */
async collectData(options) {
  const {
    useLogs = true,
    useManualLabels = true,
    useSynthetic = true,
    logOptions = {},
    syntheticOptions = {}
  } = options;
  
  const collectedData = [];
  
  // ユーザークエリログを収集
  if (useLogs) {
    const logs = await this.collectUserQueryLogs(logOptions);
    collectedData.push(...logs);
  }
  
  // 手動ラベル付けデータを収集
  if (useManualLabels) {
    const labeledData = await this.loadManuallyLabeledData();
    collectedData.push(...labeledData);
  }
  
  // 合成データを生成
  if (useSynthetic) {
    const syntheticData = this.generateSyntheticData(syntheticOptions);
    collectedData.push(...syntheticData);
  }
  
  return collectedData;
}
```

## 8. 次のステップ

本ドキュメントでは、機械学習ベースのクエリタイプ判別のためのデータ収集・準備について説明しました。次のドキュメントでは、以下のトピックについて詳細に説明します：

1. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能 - 機械学習ベース - モデルトレーニング - モデル選択）](./model-selection.md)
2. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能 - 機械学習ベース - モデルトレーニング - トレーニングプロセス）](./training-process.md)
3. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能 - 機械学習ベース - モデルトレーニング - モデル評価）](./model-evaluation.md)
4. [多階層記憶システム PostgreSQL統合設計 - ベクトル検索クエリパターン - ハイブリッド検索（Node.js適応型検索 - クエリ分析 - クエリタイプ判別 - 拡張機能 - 機械学習ベース - モデルトレーニング - モデルエクスポート）](./model-export.md)
