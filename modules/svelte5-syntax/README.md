# HARCA Svelte 5 構文変換モジュール

このモジュールは、Svelte 5の新しいイベント構文への移行を支援するためのHARCA拡張機能です。

## 主な機能

### 1. イベント構文の自動変換
- 古い構文（`on:event`）から新しい構文（`onevent`）への自動変換
- 混在した構文の検出と警告

### 2. イベント修飾子の処理
- 修飾子（`preventDefault`、`stopPropagation`など）の自動検出
- 適切な実装への変換テンプレート
- インライン関数または明示的な関数内処理への変換

### 3. 自動修正と検証
- ファイルスコープでの自動修正機能
- 変換前後の検証ステップ
- 逆方向変換の防止

## インストール

```bash
cd /path/to/harca
npm install @harca/svelte5-syntax
```

## 使用方法

### HARCAツールとして使用

HARCAのツールとして以下の機能が利用可能になります：

1. `svelte5_check_syntax` - Svelteファイルの構文をチェック
2. `svelte5_transform_file` - 単一ファイルの構文を変換
3. `svelte5_process_directory` - ディレクトリ内のファイルを一括処理

### プロジェクト設定例

`harca-config.json`に以下の設定を追加することで、プロジェクト固有の設定が可能です：

```json
{
  "projectRules": {
    "svelte5": {
      "eventSyntax": {
        "oldPattern": "on:event",
        "newPattern": "onevent",
        "direction": "on:event_to_onevent",
        "enforceCheck": true
      },
      "eventModifiers": {
        "enabled": true,
        "autoTransform": true
      }
    }
  }
}
```

### プログラムから使用

```javascript
const svelte5Syntax = require('@harca/svelte5-syntax');

// ファイルの変換
const result = svelte5Syntax.transformFile('path/to/Component.svelte', {
  write: true,
  backup: true
});

console.log(`${result.detectedCount}個のイベント構文を変換しました`);
```

## 変換例

### イベントハンドラの変換

```svelte
<!-- 変換前 -->
<button on:click={handleClick}>クリック</button>

<!-- 変換後 -->
<button onclick={handleClick}>クリック</button>
```

### イベント修飾子の処理

```svelte
<!-- 変換前 -->
<a href="/path" on:click|preventDefault={handleLink}>リンク</a>

<!-- 変換後 -->
<a href="/path" onclick={(e) => { e.preventDefault(); handleLink(e); }}>リンク</a>
```

## 注意事項

- Svelte 5では古い構文と新しい構文の混在は許可されていません
- すべてのコンポーネントで一貫して新しい構文を使用してください
- イベント修飾子は関数内で明示的に処理する必要があります

## ライセンス

MIT
