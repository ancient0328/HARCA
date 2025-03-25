---
title: "HARCAプロジェクト ドキュメント再配置計画"
date: "2025-03-24"
author: "HARCA開発チーム"
status: "proposal"
version: "1.0"
---

# HARCAプロジェクト ドキュメント再配置計画

## 現状分析

現在のHARCAプロジェクトの`documents`ディレクトリは以下の構造になっています：

```
documents/
├── 1.HARCA_concept/
├── HARCA-ドキュメント整理報告.md
├── README.md
├── api/
├── architecture/
├── decisions/
├── design/
├── development-phases/
├── guides/
├── harca-implementation-roadmap.md
├── harca-overview.md
├── log/
├── roadmap/
└── templates/
```

この構造には以下の問題点があります：

1. フラットなファイルとディレクトリが混在している
2. 命名規則が統一されていない（日本語と英語の混在、大文字小文字の不統一）
3. 似たような目的のディレクトリが複数存在する（roadmapとdevelopment-phases）
4. ドキュメントの分類が明確でない

## 再配置案

HugMeDoプロジェクトの`documents`ディレクトリ構造を参考に、以下の再配置案を提案します：

```
documents/
├── README.md                    # ドキュメントルートの説明
├── PROJECT_RULES.md             # プロジェクト固有のルール
├── project/                     # プロジェクト管理関連
│   ├── README.md
│   ├── log/                     # 開発ログ
│   ├── phase_roadmap/           # 開発フェーズとロードマップ
│   └── records/                 # 会議録や決定事項の記録
│
├── technical/                   # 技術文書
│   ├── README.md
│   ├── api/                     # API仕様
│   ├── architecture/            # アーキテクチャ設計
│   ├── decisions/               # 技術的決定事項（ADR）
│   ├── designs/                 # 詳細設計
│   └── security/                # セキュリティ関連
│
├── manuals/                     # 利用マニュアル
│   ├── README.md
│   ├── admin/                   # 管理者向け
│   ├── developer/               # 開発者向け
│   └── user/                    # エンドユーザー向け
│
├── learning/                    # 学習リソース
│   ├── README.md
│   ├── concepts/                # 基本概念の説明
│   └── tutorials/               # チュートリアル
│
└── templates/                   # 各種テンプレート
    ├── README.md
    ├── documents/               # ドキュメントテンプレート
    └── code/                    # コードテンプレート
```

## 移行計画

現在のファイルとディレクトリを新しい構造に以下のように移行します：

### 1. ルートファイル

- `README.md` → そのまま（内容更新）
- `HARCA-ドキュメント整理報告.md` → `project/records/document-reorganization-report.md`
- `harca-overview.md` → `README.md`に統合または`project/README.md`に移動
- `harca-implementation-roadmap.md` → `project/phase_roadmap/implementation-roadmap.md`

### 2. ディレクトリ

- `1.HARCA_concept/` → `learning/concepts/`
- `api/` → `technical/api/`
- `architecture/` → `technical/architecture/`
- `decisions/` → `technical/decisions/`
- `design/` → `technical/designs/`
- `development-phases/` → `project/phase_roadmap/`（`roadmap/`と統合）
- `guides/` → `manuals/developer/`または`learning/tutorials/`に分割
- `log/` → `project/log/`
- `roadmap/` → `project/phase_roadmap/`（`development-phases/`と統合）
- `templates/` → そのまま（内容整理）

## 命名規則

1. **ディレクトリ名**: すべて小文字、複数単語はハイフン（-）で連結（例: `phase-roadmap`）
2. **ファイル名**: すべて小文字、複数単語はハイフン（-）で連結（例: `api-specification.md`）
3. **言語**: 基本的に英語で統一（国際的な開発チームを考慮）
   - 日本語が必要な場合は、ファイル名に`.ja.md`のサフィックスを追加（例: `readme.ja.md`）

## 実装手順

1. 新しい構造のディレクトリを作成
2. ファイルを適切な場所に移動（Git履歴を保持するためmvコマンドを使用）
3. 各ディレクトリに適切なREADME.mdを作成
4. ドキュメント内の相互参照リンクを更新
5. 古いディレクトリを削除

## 期待される効果

1. **整理された構造**: 論理的に整理されたディレクトリ構造により、ドキュメントの検索性が向上
2. **一貫性**: 命名規則の統一による一貫性の確保
3. **拡張性**: 新しいドキュメントを追加する際の明確な配置場所の提供
4. **国際化**: 英語ベースの命名規則による国際的な開発チームでの利用のしやすさ
5. **メンテナンス性**: 明確な構造によるドキュメント更新の容易さ

## 次のステップ

1. チームでこの再配置案をレビュー
2. 必要に応じて調整
3. 移行スクリプトの作成
4. 実際の移行作業の実施
5. ドキュメントの更新と不足部分の補完

---

**注**: この再配置作業は、プロジェクトの進行に影響を与えないタイミングで実施することをお勧めします。また、移行前に全ドキュメントのバックアップを取ることも重要です。
