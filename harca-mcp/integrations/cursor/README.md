# Cursor Integration

HARCAのCursorエディタ連携モジュール

## 機能
- MCPプロトコル対応
- コード分析
- ドキュメント生成

## 利用可能なツール

### analyzeCode
コードを分析し、インサイトと提案を提供します。

パラメータ:
- `code`: 分析対象のコード
- `language`: プログラミング言語

### generateDocs
コードのドキュメントを生成します。

パラメータ:
- `code`: ドキュメント化対象のコード
- `format`: ドキュメント形式（markdown/jsdoc）

## 設定
- MCPエンドポイント: `/api/mcp`
- ポート: 3700

## 使用方法
1. CursorエディタでHARCAサーバーに接続
2. 利用可能なツールを確認
3. ツールを実行してコード分析やドキュメント生成を行う

## 開発者向け情報
- 新しいツールの追加は`mcp-handler.js`の`registerTools`メソッドで行います
- ツールの実装は`handleExecuteTool`メソッドに追加します 