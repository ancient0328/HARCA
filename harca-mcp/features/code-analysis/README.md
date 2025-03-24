# HARCA コード分析プラグイン

HARCA（Holistic Architecture for Resource Connection and Assistance）のコード分析機能を提供するプラグインです。このプラグインはARCHIVEプロジェクトからの機能移植の一環として開発されました。

## 機能

このプラグインは以下の機能を提供します：

1. **コードの複雑度分析**
   - 関数やメソッドの複雑さを分析
   - 条件分岐、ループ、例外処理などの要素を考慮した複雑度スコアを計算
   - 改善のための推奨事項を提供

2. **コメント率分析**（実装予定）
   - コード内のコメント行の割合を計算
   - 空行、コード行、コメント行をカウント
   - コメント率に基づいた推奨事項を提供

3. **命名規則分析**（実装予定）
   - 変数や関数の命名規則を分析
   - キャメルケースやパスカルケースなどの命名規則への準拠をチェック
   - 命名規則に違反している場合に改善案を提示

4. **重複コード検出**（実装予定）
   - プロジェクト全体の重複コードを検出
   - 最小ブロックサイズ（3行）以上の重複を特定
   - 重複箇所のファイル名、行番号、内容を報告

## 使用方法

### MCPツールとして使用

このプラグインはHARCA MCPサーバーに統合されており、以下のツールとして利用できます：

1. **analyzeCode**
   ```javascript
   {
     "code": "function example() { if (true) { return 1; } }",
     "language": "javascript",
     "advanced": true,
     "rules": ["complexity"] // オプション：適用するルールを指定
   }
   ```

2. **getCodeAnalysisRules**
   ```javascript
   {} // パラメータなし
   ```

### プログラムから直接使用

```javascript
import codeAnalysisPlugin from '../features/code-analysis/index.js';

// コード文字列の分析
const result = await codeAnalysisPlugin.analyzeCode(
  'function example() { if (true) { return 1; } }',
  'javascript',
  ['complexity'] // オプション：適用するルールを指定
);

// ファイルの分析
const fileResult = await codeAnalysisPlugin.analyzeFile(
  '/path/to/file.js',
  ['complexity'] // オプション：適用するルールを指定
);

// プロジェクト全体の分析
const projectResult = await codeAnalysisPlugin.analyzeProject(
  '/path/to/project',
  {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    exclude: ['node_modules', 'dist', 'build', '.git'],
    maxFiles: 100,
    ruleIds: ['complexity'] // オプション：適用するルールを指定
  }
);

// 利用可能なルールの取得
const rules = codeAnalysisPlugin.getAvailableRules();

// ルール情報の取得
const ruleInfo = codeAnalysisPlugin.getRuleInfo('complexity');
```

## 分析ルール

### 複雑度分析（complexity）

コードの複雑さを分析し、改善のための推奨事項を提供します。

**分析要素**：
- 条件分岐（if, else if, else, switch, case, 三項演算子）
- ループ（for, while, do-while）
- 例外処理（try, catch）
- 論理演算子（&&, ||）
- 行数

**複雑度スコア**：
- 0-5: 低複雑度
- 5-10: 中複雑度
- 10-15: 高複雑度
- 15+: 非常に高い複雑度（リファクタリング推奨）

## 今後の開発計画

1. コメント率分析の実装
2. 命名規則分析の実装
3. 重複コード検出の実装
4. パフォーマンスの最適化
5. 言語サポートの拡充

## ライセンス

このプラグインはHARCAプロジェクトの一部として提供されています。
