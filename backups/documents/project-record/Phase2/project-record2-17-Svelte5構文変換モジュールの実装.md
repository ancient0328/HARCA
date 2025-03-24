# Svelte5構文変換モジュールの実装

## 概要
HARCAサーバーにSvelte 5の新しいイベント構文への変換を支援するモジュールを実装しました。このモジュールにより、Svelte 5の新しいイベント構文（`on:event={handler}` から `onevent={handler}`）への移行を自動化し、イベント修飾子の処理も含めた包括的な変換機能を提供します。

## 実装内容

### 1. コアモジュールの実装
- `/modules/svelte5-syntax/index.js` - イベント構文変換の中核機能
  - イベント構文の検出と変換
  - イベント修飾子の処理
  - 混在構文のチェック
  - ファイルとディレクトリの一括処理
  - 編集前後のフック処理

### 2. MCPツールの追加
- `/harca-mcp/tools/svelte5-syntax-tools.js` - HARCAのMCPサーバーに以下のツールを追加
  - `svelte5_check_syntax` - 単一ファイルの構文チェック
  - `svelte5_transform_file` - 単一ファイルの構文変換
  - `svelte5_process_directory` - ディレクトリの一括処理
  - `svelte5_analyze_project` - プロジェクト全体の分析

### 3. ドキュメントの作成
- `/modules/svelte5-syntax/README.md` - 詳細な使用方法とサンプルを記載
- パッケージ情報と依存関係の定義

## 主要機能

### イベント構文の自動変換
```javascript
// 変換前
<button on:click={handleClick}>クリック</button>

// 変換後
<button onclick={handleClick}>クリック</button>
```

### イベント修飾子の処理
```javascript
// 変換前
<a href="/path" on:click|preventDefault={handleLink}>リンク</a>

// 変換後
<a href="/path" onclick={(e) => { e.preventDefault(); handleLink(e); }}>リンク</a>
```

### 混在構文の検出
- 古い構文と新しい構文が混在しているファイルを検出
- 一貫性を保つための警告と修正提案

### 編集前後のフック
- ファイル編集前に構文の混在をチェック
- ファイル編集後に古い構文が残っていないかを検証

## 変換テンプレート
```javascript
const TRANSFORMATION_TEMPLATES = {
  simple: 'onevent={handler}',
  withModifier: 'onevent={(e) => { e.{modifierImplementation}; handler(e); }}',
  withoutParams: 'onevent={(e) => { e.{modifierImplementation}; handler(); }}'
};
```

## 使用例

### プロジェクト全体の分析
```javascript
const analysis = await mcp1_svelte5_analyze_project({
  projectPath: '/path/to/project'
});
```

### 特定のファイルの変換
```javascript
const result = await mcp1_svelte5_transform_file({
  filePath: '/path/to/Component.svelte',
  write: true,
  backup: true
});
```

### プロジェクト設定との連携
```json
{
  "projectRules": {
    "svelte5": {
      "eventSyntax": {
        "oldPattern": "on:event",
        "newPattern": "onevent",
        "direction": "on:event_to_onevent",
        "enforceCheck": true
      }
    }
  }
}
```

## 技術的詳細

### 実装アプローチ
- 正規表現を使用したイベント構文の検出
- AST解析ではなく文字列ベースの変換を採用（シンプルさと柔軟性のため）
- バックアップ機能による安全な変換
- モジュール化による再利用性の向上

### 対応イベント
- submit, click, input, change, keydown, keyup, keypress, focus, blur, mouseenter, mouseleave など

### 対応修飾子
- preventDefault, stopPropagation, capture, once, passive

## 今後の展望

### 短期的な改善点
- より多くのイベントと修飾子のサポート
- エッジケースの処理の強化
- テストケースの追加

### 長期的な計画
- AST解析ベースの変換への移行
- VSCode拡張機能との連携
- 他のSvelte 5の新機能への対応（$stateや$derivedなど）

## 結論
このモジュールにより、HARCAを使用するすべてのプロジェクトでSvelte 5のイベント構文変換を簡単に行えるようになりました。プロジェクト固有の設定と組み合わせることで、より柔軟な運用が可能です。
