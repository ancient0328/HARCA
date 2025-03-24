# HARCA コード分析機能移植計画

**作成日**: 2025年3月17日
**優先度**: 高（Phase 2の優先順位2）
**ステータス**: 完了

## 1. 概要

ARCHIVEプロジェクトからHARCAプロジェクトへのコード分析機能の移植計画を詳述する。この計画はPhase 2の優先タスク「ARCHIVEからのコード分析機能移植」の実施指針となる。

## 2. 背景

ARCHIVEプロジェクトには以下の4つの主要なコード分析機能が実装されている：

1. **複雑度分析（complexity-rule.js）**
   - 関数やメソッドの複雑さを分析
   - 関数の長さや条件分岐の数などを評価
   - 改善のための推奨事項を提供

2. **コメント率分析（comments-rule.js）**
   - コード内のコメント行の割合を計算
   - 空行、コード行、コメント行をカウント
   - コメント率に基づいた推奨事項を提供

3. **命名規則分析（naming-rule.js）**
   - 変数や関数の命名規則を分析
   - キャメルケースやパスカルケースなどの命名規則への準拠をチェック
   - 命名規則に違反している場合に改善案を提示

4. **重複コード検出（duplication-rule.js）**
   - プロジェクト全体の重複コードを検出
   - 最小ブロックサイズ（3行）以上の重複を特定
   - 重複箇所のファイル名、行番号、内容を報告

HARCAには現在、簡易的なコード分析ツール（`analyzeCode`）が実装されているが、行数と文字数の基本的な統計情報のみを提供している。

## 3. 目標

1. ARCHIVEの高度なコード分析機能をHARCAに移植する
2. 既存の簡易的なコード分析ツールとの互換性を維持する
3. 各AIエージェントが必要に応じて分析の詳細度を選択できるようにする
4. 将来の拡張性を確保する

## 4. アプローチ

「独立したプラグインとして実装し、既存ツールから利用する」アプローチを採用する。このアプローチでは：

1. コード分析機能を独立したプラグインとして実装
2. 既存の`analyzeCode`ツールを拡張して新しいプラグインを利用
3. 基本分析と高度な分析のオプションを提供

### 4.1 アプローチの利点

- **HARCAの方針との整合性**: 各AIエージェントとの最適な接続方法を提供
- **モジュール性と再利用性**: 独立したプラグインとして他の部分からも利用可能
- **拡張性**: APIインターフェースを変更せずに内部実装を改善可能
- **段階的な移行**: 既存の機能を維持しながら高度な機能を追加可能

## 5. 実装計画

### 5.1 ディレクトリ構造

```
/harca-mcp/plugins/code-analysis/
├── index.js                 # メインモジュール・エクスポート
├── analyzer.js              # CodeAnalyzerクラスの実装
├── rules/                   # 分析ルール
│   ├── index.js             # ルールインデックス
│   ├── complexity-rule.js   # 複雑度分析
│   ├── comments-rule.js     # コメント率分析
│   ├── naming-rule.js       # 命名規則分析
│   └── duplication-rule.js  # 重複コード検出
└── README.md                # 使用方法とドキュメント
```

### 5.2 実装フェーズ

#### フェーズ1: プラグイン基盤の構築（予定期間: 1週間）

- `plugins/code-analysis/` ディレクトリ構造の作成
- 基本的なインターフェースの定義（index.js, analyzer.js）
- 最も重要な分析ルール（複雑度分析）の移植

#### フェーズ2: 既存ツールの拡張（予定期間: 3日）

- 既存の `analyzeCode` ツールを拡張して新しいプラグインを利用
- 基本分析と高度な分析のオプションを提供
- 単体テストの実装

#### フェーズ3: 残りの分析ルールの移植（予定期間: 1週間）

- コメント率分析の移植
- 命名規則分析の移植
- 重複コード検出の移植
- 各ルールの単体テスト

#### フェーズ4: テストと最適化（予定期間: 4日）

- 統合テストの実装
- パフォーマンス最適化
- ドキュメント作成
- コードレビュー

### 5.3 主要コンポーネントの実装詳細

#### 5.3.1 プラグインのエクスポートインターフェース (index.js)

```javascript
/**
 * HARCA コード分析プラグイン
 * 外部からアクセスするためのインターフェースを提供
 */

import CodeAnalyzer from './analyzer.js';

// シングルトンインスタンスをエクスポート
const analyzer = new CodeAnalyzer();

// 公開API
export default {
  // 単一ファイルの分析
  analyzeFile: (filePath, ruleIds = []) => analyzer.analyzeFile(filePath, ruleIds),
  
  // コード文字列の分析
  analyzeCode: (code, language = 'javascript', ruleIds = []) => {
    return analyzer.analyzeCodeString(code, language, ruleIds);
  },
  
  // プロジェクト全体の分析
  analyzeProject: (projectPath, options = {}) => analyzer.analyzeProject(projectPath, options),
  
  // 利用可能なルールの取得
  getAvailableRules: () => Array.from(analyzer.rules.keys()),
  
  // 特定のルールの詳細情報を取得
  getRuleInfo: (ruleId) => {
    const rule = analyzer.rules.get(ruleId);
    return rule ? { id: ruleId, name: rule.name, description: rule.description } : null;
  }
};
```

#### 5.3.2 既存ツールの拡張 (core/server.js)

```javascript
// コード分析プラグインをインポート
import codeAnalysisPlugin from '../plugins/code-analysis/index.js';

// ツール登録: コード分析（拡張版）
mcpServer.tool("analyzeCode", "コードを分析して統計情報と品質評価を提供します",
  {
    code: z.string().describe("分析するコード"),
    language: z.string().optional().default('javascript').describe("コードの言語"),
    advanced: z.boolean().optional().default(false).describe("高度な分析を実行するかどうか"),
    rules: z.array(z.string()).optional().describe("適用するルール（省略時はすべて）")
  },
  async (params) => {
    try {
      const { code, language, advanced, rules = [] } = params;
      
      // 基本的な分析（既存の機能）
      const basicAnalysis = {
        language,
        lines: code.split('\n').length,
        characters: code.length
      };
      
      // 高度な分析が不要な場合は基本分析のみ返す
      if (!advanced) {
        return basicAnalysis;
      }
      
      // プラグインを使用して高度な分析を実行
      const advancedAnalysis = await codeAnalysisPlugin.analyzeCode(code, language, rules);
      
      // 基本分析と高度な分析を統合
      return {
        ...basicAnalysis,
        advanced: advancedAnalysis.results
      };
    } catch (error) {
      console.error('コード分析エラー:', error);
      throw new Error(`分析エラー: ${error.message}`);
    }
  }
);
```

## 6. テスト計画

### 6.1 単体テスト

- 各分析ルールの正確性テスト
- エラーハンドリングのテスト
- 境界条件のテスト

### 6.2 統合テスト

- プラグイン全体の機能テスト
- MCPサーバーとの統合テスト
- 各AIエージェントとの互換性テスト

### 6.3 パフォーマンステスト

- 大規模コードベースでの分析パフォーマンス
- メモリ使用量の測定
- 応答時間の測定

## 7. 実装結果

### 7.1 実装完了した機能

以下の4つの主要なコード分析機能をすべて実装完了した：

1. **複雑度分析（complexity-rule.js）**
   - 関数やメソッドの複雑さを分析
   - 条件分岐、ループ、例外処理などの要素を考慮した複雑度スコアを計算
   - 改善のための推奨事項を提供

2. **コメント率分析（comments-rule.js）**
   - コード内のコメント行の割合を計算
   - 空行、コード行、コメント行をカウント
   - コメント率に基づいた推奨事項を提供

3. **命名規則分析（naming-rule.js）**
   - 変数や関数の命名規則を分析
   - キャメルケースやパスカルケースなどの命名規則への準拠をチェック
   - 命名規則に違反している場合に改善案を提示

4. **重複コード検出（duplication-rule.js）**
   - コード内の重複を検出
   - 最小ブロックサイズ（3行）以上の重複を特定
   - 重複箇所の行番号と内容を報告

### 7.2 MCPサーバーとの統合

- `core/server.js` の `analyzeCode` ツールを拡張し、新しいプラグインを利用するように修正
- 高度な分析はオプション（`advanced=true`）として提供し、既存の基本分析との後方互換性を維持
- 新しい `getCodeAnalysisRules` ツールを追加して、利用可能なルールの一覧を取得可能に

### 7.3 特徴

- **多言語対応**: JavaScript/TypeScript、Python、Javaなど複数の言語に対応
- **モジュール性**: 各ルールは独立したモジュールとして実装され、簡単に追加・削除可能
- **柔軟性**: 各AIエージェントが必要に応じて分析の詳細度を選択可能
- **拡張性**: 新しい分析ルールを簡単に追加可能

### 7.4 使用方法

サーバーを起動して、拡張された `analyzeCode` ツールをテストできる：

```bash
cd /Users/ancient0328/Development/MCPserver/HARCA
node harca-mcp/index.js --http
```

HTTP モードでサーバーが起動したら、以下のようなリクエストでテストできる：

```
POST /api/mcp
Content-Type: application/json

{
  "command": "analyzeCode",
  "params": {
    "code": "function example() { if (true) { return 1; } }",
    "language": "javascript",
    "advanced": true,
    "rules": ["complexity", "comments", "naming", "duplication"]
  }
}
```

## 8. 今後の課題

1. **テストの充実**
   - 単体テストの追加
   - 統合テストの実装

2. **ドキュメントの充実**
   - 各ルールの詳細な説明
   - 使用例の追加

3. **パフォーマンスの最適化**
   - 大規模なコードベースでの分析速度の改善
   - メモリ使用量の最適化

## 9. 結論

ARCHIVEプロジェクトからのコード分析機能の移植が完了した。これにより、HARCAプロジェクトはより高度なコード分析機能を提供できるようになり、各AIエージェントとの最適な接続方法を提供するという目標に一歩近づいた。

今後は、テストの充実やパフォーマンスの最適化を進めるとともに、Phase 2の次の優先タスク「基本的な管理ダッシュボードUI」の実装に移行する。
