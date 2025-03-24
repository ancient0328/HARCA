# HugMeDoプロジェクトでのテスト実行ガイド

**Document Number**: GUIDE-018A-TS  
**Creation Date**: March 23, 2025  
**Author**: HugMeDo Project Development Team  
**Status**: Official Release  
**Version**: 1.0.0

## 目次

1. [はじめに](#はじめに)
2. [pnpmワークスペースでのテスト実行](#pnpmワークスペースでのテスト実行)
3. [Webアプリのテスト](#webアプリのテスト)
4. [モバイルアプリのテスト](#モバイルアプリのテスト)
5. [CIパイプラインでのテスト](#ciパイプラインでのテスト)

## はじめに

このドキュメントでは、HugMeDoプロジェクト固有のテスト実行方法について説明します。HugMeDoプロジェクトはpnpmワークスペースを使用しているため、テストコマンドの実行方法が標準のSvelteKitプロジェクトとは異なります。

## pnpmワークスペースでのテスト実行

HugMeDoプロジェクトでは、pnpmワークスペース環境を使用しているため、テストを実行する際には以下のいずれかの方法を使用します：

1. 対象のアプリディレクトリに移動してからコマンドを実行する
2. ルートディレクトリから`--filter`フラグを使用して対象のアプリを指定する

```bash
# 方法1: アプリディレクトリに移動してから実行
cd apps/web
pnpm test

# 方法2: ルートディレクトリから実行
pnpm --filter @hugmedo/web test
```

## Webアプリのテスト

Webアプリ（`apps/web`）のテストを実行するためのコマンド例：

```bash
# 基本的なテスト実行
pnpm --filter @hugmedo/web test

# 監視モードでテスト実行
pnpm --filter @hugmedo/web test -- --watch

# 特定のテストファイルのみ実行
pnpm --filter @hugmedo/web test src/lib/utils.test.js

# カバレッジレポートの生成
pnpm --filter @hugmedo/web test -- --coverage

# UI表示でのテスト実行
pnpm --filter @hugmedo/web test -- --ui
```

## モバイルアプリのテスト

モバイルアプリ（`apps/mobile`）のテストを実行するためのコマンド例：

```bash
# 基本的なテスト実行
pnpm --filter @hugmedo/mobile test

# 監視モードでテスト実行
pnpm --filter @hugmedo/mobile test -- --watch

# 特定のテストファイルのみ実行
pnpm --filter @hugmedo/mobile test src/lib/utils.test.js

# カバレッジレポートの生成
pnpm --filter @hugmedo/mobile test -- --coverage
```

## エンドツーエンドテスト

Playwrightを使用したエンドツーエンドテストの実行：

```bash
# Playwrightテストの実行（Webアプリ）
pnpm --filter @hugmedo/web exec playwright test

# Playwrightテストの実行（モバイルアプリ）
pnpm --filter @hugmedo/mobile exec playwright test

# UIモードでのテスト実行
pnpm --filter @hugmedo/web exec playwright test --ui

# 特定のテストファイルのみ実行
pnpm --filter @hugmedo/web exec playwright test tests/login.spec.js
```

## CIパイプラインでのテスト

GitHub Actionsなどのパイプラインでテストを実行する際は、以下のコマンドを使用します：

```bash
# 依存関係のインストール
pnpm install

# ユニットテストとコンポーネントテストの実行
pnpm test

# エンドツーエンドテストの実行
pnpm exec playwright install --with-deps
pnpm exec playwright test
```

CI環境では、テストコマンドをルートの`package.json`に定義しておくと便利です：

```json
{
  "scripts": {
    "test": "pnpm --filter @hugmedo/web test && pnpm --filter @hugmedo/mobile test",
    "test:e2e": "pnpm --filter @hugmedo/web exec playwright test"
  }
}
```

## 注意点

- テスト実行時にはポートの競合に注意してください。HugMeDoプロジェクトでは、Webアプリは40000番ポート、モバイルアプリは40010番ポートを使用します。
- テスト環境では、実際のAPIエンドポイントではなくモックサーバーを使用することをお勧めします。
- 機密情報（APIキーなど）を含むテストは、`.env.test.local`ファイルを使用して環境変数を設定してください。このファイルはバージョン管理対象外です。
