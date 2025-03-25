# 重要度評価アルゴリズム詳細設計

## 概要

重要度評価アルゴリズムは、HARCA多階層記憶システムにおいて、各記憶の価値と重要性を定量的に評価し、適切な記憶層への配置や記憶間の優先順位付けを行うための中核的なメカニズムです。このアルゴリズムは、「立体的思考・立体的記憶」という概念を実現するために、多次元的な評価基準と適応的な調整メカニズムを組み合わせています。

## 評価モデル

重要度評価は、以下の数式モデルに基づいて計算されます：

```
ImportanceScore = BaseScore * (
    w₁ * RecencyFactor + 
    w₂ * FrequencyFactor + 
    w₃ * RelevanceFactor + 
    w₄ * ExplicitValueFactor + 
    w₅ * RelationalValueFactor
) * DecayFunction(time)
```

ここで：
- `ImportanceScore`: 最終的な重要度スコア（0.0〜1.0）
- `BaseScore`: 初期重要度スコア（デフォルト: 0.5）
- `w₁...w₅`: 各要素の重み係数（合計が1.0になるように正規化）
- `DecayFunction`: 時間経過に伴う重要度の減衰関数

## 評価要素

### 1. 最近性（Recency）

最近アクセスされた記憶ほど高いスコアを持ちます。

```
RecencyFactor = exp(-λ * (currentTime - lastAccessTime) / timeUnit)
```

- `λ`: 減衰率パラメータ（デフォルト: 0.1）
- `timeUnit`: 時間単位（例: 1日）

#### 実装詳細

- 最終アクセス時間のタイムスタンプを各記憶に保存
- 記憶の種類に応じた適切な減衰率の調整
- 周期的アクセスパターンの検出と考慮

### 2. 頻度（Frequency）

頻繁にアクセスされる記憶ほど高いスコアを持ちます。

```
FrequencyFactor = min(1.0, accessCount / thresholdCount)^α
```

- `accessCount`: アクセス回数
- `thresholdCount`: 飽和閾値（デフォルト: 10）
- `α`: 非線形調整パラメータ（デフォルト: 0.5）

#### 実装詳細

- アクセスカウンターの実装と更新メカニズム
- 時間窓に基づくアクセス頻度の計算（例: 直近7日間）
- 長期的アクセスパターンと短期的アクセスパターンの区別

### 3. 関連性（Relevance）

現在のコンテキストに関連する記憶ほど高いスコアを持ちます。

```
RelevanceFactor = cosine_similarity(memoryEmbedding, contextEmbedding)
```

- `memoryEmbedding`: 記憶のベクトル表現
- `contextEmbedding`: 現在のコンテキストのベクトル表現

#### 実装詳細

- OpenAI Ada 002を使用したベクトル埋め込みの生成
- コンテキストウィンドウの定義と更新メカニズム
- 関連性スコアのキャッシュと効率的な計算

### 4. 明示的価値（Explicit Value）

ユーザーによって明示的に指定された価値や重要度を反映します。

```
ExplicitValueFactor = userSpecifiedValue * (1 + β * userConfidence)
```

- `userSpecifiedValue`: ユーザー指定の価値（0.0〜1.0）
- `userConfidence`: ユーザーの確信度（0.0〜1.0）
- `β`: 確信度の影響度（デフォルト: 0.2）

#### 実装詳細

- ユーザーインターフェースからの明示的フィードバックの収集
- 暗黙的フィードバック（閲覧時間、操作パターンなど）の解釈
- フィードバックの信頼性評価と重み付け

### 5. 関係的価値（Relational Value）

他の重要な記憶との関連性が高い記憶ほど高いスコアを持ちます。

```
RelationalValueFactor = avg(
    connectionStrength_i * connectedMemoryImportance_i
    for each connected memory i
)
```

- `connectionStrength_i`: 記憶iとの関連強度（0.0〜1.0）
- `connectedMemoryImportance_i`: 関連記憶iの重要度

#### 実装詳細

- 記憶間の関連性グラフの構築と維持
- グラフアルゴリズムを用いた中心性と影響度の計算
- 関連記憶の重要度変化の伝播メカニズム

## 時間減衰モデル

記憶の重要度は、時間経過とともに自然に減衰します。

```
DecayFunction(time) = exp(-δ * time / halfLifeTime)
```

- `δ`: 基本減衰率（デフォルト: 0.693）
- `halfLifeTime`: 重要度が半減する時間
- `time`: 記憶が作成されてからの経過時間

### 減衰モデルの調整

- 記憶の種類に応じた半減期の調整
- ユーザーの学習パターンに基づく減衰率の個別化
- 定期的な再評価による長期記憶の安定化

## 適応メカニズム

重要度評価アルゴリズムは、以下のメカニズムによって継続的に適応・改善されます：

### 1. 重み係数の動的調整

```
w_i_new = w_i_old + η * (observedUtility - predictedUtility) * factor_i
```

- `η`: 学習率（デフォルト: 0.01）
- `observedUtility`: 観測された記憶の有用性
- `predictedUtility`: 予測された記憶の有用性
- `factor_i`: 対応する評価要素の値

### 2. フィードバックループ

- 記憶の活性化と実際の使用の相関関係の分析
- 予測精度に基づくアルゴリズムパラメータの調整
- ユーザーの行動パターンからの暗黙的フィードバックの抽出

### 3. コンテキスト依存調整

- 作業コンテキストに基づく評価要素の重み付け変更
- プロジェクト特性に応じたパラメータプロファイルの適用
- 時間帯や活動パターンに応じた調整

## 実装アーキテクチャ

重要度評価アルゴリズムは、以下のコンポーネントで構成されます：

### 1. 評価エンジン

```typescript
class ImportanceEvaluationEngine {
  // 重要度スコアの計算
  calculateImportanceScore(memory: Memory, context: Context): number;
  
  // 個別評価要素の計算
  calculateRecencyFactor(memory: Memory): number;
  calculateFrequencyFactor(memory: Memory): number;
  calculateRelevanceFactor(memory: Memory, context: Context): number;
  calculateExplicitValueFactor(memory: Memory): number;
  calculateRelationalValueFactor(memory: Memory): number;
  
  // 時間減衰の計算
  calculateDecayFactor(memory: Memory): number;
  
  // パラメータ調整
  updateWeights(feedback: FeedbackData): void;
}
```

### 2. コンテキストマネージャー

```typescript
class ContextManager {
  // 現在のコンテキストの取得と更新
  getCurrentContext(): Context;
  updateContext(newData: any): void;
  
  // コンテキスト埋め込みの生成
  generateContextEmbedding(): Promise<number[]>;
  
  // 関連性計算
  calculateRelevanceToContext(memoryEmbedding: number[]): number;
}
```

### 3. フィードバックコレクター

```typescript
class FeedbackCollector {
  // 明示的フィードバックの収集
  collectExplicitFeedback(memory: Memory, value: number): void;
  
  // 暗黙的フィードバックの収集
  collectImplicitFeedback(memory: Memory, userActions: UserAction[]): void;
  
  // フィードバックの処理と評価エンジンへの適用
  processFeedback(): FeedbackData;
}
```

### 4. 記憶管理インターフェース

```typescript
interface MemoryManager {
  // 重要度に基づく記憶の昇格
  promoteMemory(memory: Memory): Promise<void>;
  
  // 重要度に基づく記憶の降格
  demoteMemory(memory: Memory): Promise<void>;
  
  // 定期的な記憶の再評価
  reevaluateMemories(): Promise<void>;
}
```

## パフォーマンス最適化

重要度評価アルゴリズムの効率的な実行のために、以下の最適化を実装します：

### 1. 計算の最適化

- 増分計算: 関連パラメータが変更された場合のみ再計算
- バッチ処理: 複数の記憶の評価を一括で処理
- 並列計算: 独立した評価要素の並列計算

### 2. キャッシング戦略

- 評価結果のキャッシング（TTL: 15分）
- 中間計算結果の再利用
- 頻繁にアクセスされる記憶の評価結果の優先キャッシング

### 3. スケジューリング

- 低負荷時間帯での大規模再評価の実行
- 変更頻度に基づく適応的な再評価間隔
- 重要度の閾値に基づく選択的再評価

## テスト方法論

重要度評価アルゴリズムの品質を確保するために、以下のテスト方法を適用します：

### 1. ユニットテスト

- 各評価要素の計算ロジックのテスト
- エッジケースと境界値のテスト
- パラメータ変更の影響テスト

### 2. 統合テスト

- 評価エンジンと他のコンポーネントの連携テスト
- 実際のデータを用いたエンドツーエンドテスト
- パフォーマンスと負荷テスト

### 3. シミュレーションテスト

- 様々なユーザーパターンのシミュレーション
- 時間経過に伴う挙動の検証
- 異常パターンに対する堅牢性テスト

## 今後の発展方向

重要度評価アルゴリズムは、以下の方向性でさらに発展させる予定です：

### 1. 高度化

- 機械学習モデルを用いた予測精度の向上
- コンテキスト理解の深化によるより精密な関連性評価
- 複雑な時間パターン（季節性、周期性）の検出と活用

### 2. 個別化

- ユーザー固有の学習曲線と忘却曲線のモデル化
- 作業スタイルに基づく個別化されたパラメータプロファイル
- ドメイン特化型の評価要素と重み付け

### 3. 統合拡張

- Sequential Thinkingプロセスとの緊密な統合
- 外部知識ソースからの重要度シグナルの統合
- チーム環境での集合的重要度評価メカニズム

## 結論

重要度評価アルゴリズムは、HARCAの「立体的思考・立体的記憶による有機的・立体的情報ネットワークの構築」という目的を実現するための中核的なメカニズムです。多次元的な評価基準と適応的な調整メカニズムを組み合わせることで、単なる機械的な記憶管理ではなく、人間の認知プロセスに近い、文脈適応的で有機的な記憶システムを実現します。

このアルゴリズムの継続的な改善と拡張により、HARCAの記憶システムはユーザーの思考プロセスをより効果的に支援し、知識の累積的な成長と活用を促進することが期待されます。
