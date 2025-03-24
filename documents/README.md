# HARCA プロジェクトドキュメント

**文書番号** DOC-001
**作成日** 2025年03月23日
**作成者** HARCA開発チーム
**ステータス** 確定

## 概要

このディレクトリには、HARCAプロジェクトに関連するすべてのドキュメントが含まれています。ドキュメントは種類別に整理され、一貫した命名規則に従っています。

## ドキュメント構造

```
/documents/
├── README.md                # このファイル
├── architecture/            # アーキテクチャ文書
├── api/                     # API仕様書
├── development-phases/      # 開発フェーズごとの成果物
│   ├── phase1/              # 基盤構築フェーズ
│   ├── phase2/              # 機能拡張フェーズ
│   ├── phase3/              # 多階層記憶システム実装フェーズ
│   ├── phase4/              # 高度分析機能フェーズ
│   └── phase5/              # エコシステム拡張フェーズ
├── guides/                  # 開発・運用ガイド
├── decisions/               # 設計決定記録
├── log/                     # 開発記録
├── roadmap/                 # プロジェクトロードマップ
└── templates/               # ドキュメントテンプレート
```

## ドキュメントの種類と命名規則

### アーキテクチャ文書 (`/architecture/`)
- システム設計の詳細
- 命名規則: `{component}-{aspect}.md`
- 例: `memory-corpus-architecture.md`

### API仕様書 (`/api/`)
- APIの詳細仕様
- 命名規則: `{module}-api.md`
- 例: `sequential-thinking-api.md`

### 開発フェーズ文書 (`/development-phases/`)
- 各開発フェーズの計画と成果物
- フェーズごとにサブディレクトリで整理
- 命名規則: `{topic}-{aspect}.md`
- 例: `memory-corpus-implementation-plan.md`

### 開発・運用ガイド (`/guides/`)
- 開発手順や規約
- 命名規則: `{topic}-guide.md`
- 例: `development-environment-setup-guide.md`

### 設計決定記録 (`/decisions/`)
- 設計や技術選定の決定事項
- 命名規則: `{date}-{topic}-decision.md`
- 例: `2025-03-15-vector-database-selection-decision.md`

### 開発記録 (`/log/`)
- 開発作業の記録
- 命名規則: `{phase}-{number}-{title}.md`
- 例: `phase1-01-redis-integration.md`

### プロジェクトロードマップ (`/roadmap/`)
- 開発計画と進捗
- 命名規則: `{phase}-roadmap.md`
- 例: `phase3-roadmap.md`

## ドキュメント作成ガイドライン

### 文書情報フォーマット

すべての文書は、以下のフォーマットで文書情報を記載します：

```markdown
---
title: "文書タイトル"
date: "YYYY-MM-DD"
author: "作成者名"
status: "ステータス"
document_number: "XXX-YYY"
related_documents: ["関連文書1", "関連文書2"]
---
```

### ステータス種別

- `draft`: 初期作成段階
- `review`: レビュー待ち
- `approved`: 承認済み
- `deprecated`: 無効または置き換えられた文書
- `completed`: 作業が完了した記録

### マークダウン記法のガイドライン

- 第1レベル（`#`）: 文書タイトル
- 第2レベル（`##`）: 主要セクション
- 第3レベル（`###`）: サブセクション
- 第4レベル以降: 必要に応じて使用

コードスニペットやコマンド例は、言語を指定したコードブロックで囲みます：

````markdown
```javascript
// JavaScriptコード例
const example = () => {
  return "Hello, HARCA!";
};
```
````

## 更新履歴の管理

文書を更新する場合は、以下の手順に従います：

1. 文書情報に「最終更新日」を追加または更新
2. 必要に応じて「バージョン」を更新
3. 重要な変更の場合は、文書末尾に更新履歴を記載

## ドキュメントレビュープロセス

1. 文書作成者が初稿を作成（ステータス: draft）
2. レビュー依頼（ステータス: review）
3. フィードバックと修正
4. 承認（ステータス: approved）
5. 必要に応じて定期的に更新
