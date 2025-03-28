---
title: "コンテナ化モジュラーモノリスアーキテクチャ"
date: "2025-03-23"
author: "HARCA開発チーム"
status: "approved"
document_number: "ARCH-001"
related_documents: ["system-architecture-overview.md"]
---

# コンテナ化モジュラーモノリスアーキテクチャ

## 1. 概要

コンテナ化モジュラーモノリスは、モノリシックアプリケーションの単純さとマイクロサービスの柔軟性を組み合わせた設計パターンです。Docker Composeを使用して複数のモジュールをコンテナ化し、単一のシステムとして管理しながらも、各モジュールの独立性を保つアーキテクチャです。

HARCAプロジェクトでは、このアーキテクチャを採用することで、開発の容易さと運用の単純さを維持しながら、モジュール間の明確な境界と責任分離を実現しています。

## 2. 主要な特徴

### 2.1 モジュール性

- **明確な境界**: 各モジュールは明確に定義されたインターフェースを持ち、独立して開発可能
- **責任の分離**: 各モジュールは特定の機能領域に責任を持つ
- **独立したコードベース**: モジュールごとに独立したコードベースを持ち、変更の影響範囲を限定

### 2.2 コンテナ化

- **Docker Compose**: 複数のコンテナを単一の設定ファイルで管理
- **環境の一貫性**: 開発環境と本番環境の一貫性を確保
- **依存関係の分離**: モジュールごとに異なる依存関係を持つことが可能

### 2.3 モノリシックな運用

- **単一のデプロイメント**: システム全体を一度にデプロイ
- **シンプルな運用**: マイクロサービスの複雑な運用課題を回避
- **統合テスト**: システム全体を一度にテスト可能

## 3. アーキテクチャの構成要素

### 3.1 モジュール構造

HARCAプロジェクトでは、以下のようなモジュール構造を採用しています：

```
/
├── docker-compose.yml       # システム全体の構成
├── .env                     # 環境変数
├── modules/                 # モジュールディレクトリ
│   ├── core/                # コアモジュール
│   ├── vector-store/        # ベクトルストアモジュール
│   ├── cache-system/        # キャッシュシステムモジュール
│   ├── sequential-thinking/ # Sequential Thinkingモジュール
│   ├── document-rag/        # ドキュメントRAGモジュール
│   └── memory-corpus/       # メモリコーパスモジュール（計画中）
└── shared/                  # 共有ライブラリ
```

### 3.2 通信パターン

モジュール間の通信は、以下のパターンを採用しています：

1. **API通信**: RESTful APIまたはJSON-RPC 2.0を使用した通信
2. **共有データベース**: PostgreSQLを共有リソースとして使用
3. **メッセージキュー**: 必要に応じてRedisを使用したメッセージング
4. **ファイルシステム**: 共有ボリュームを使用したファイル共有

### 3.3 デプロイメントモデル

デプロイメントは、以下のプロセスに従います：

1. **ビルドフェーズ**: 各モジュールのDockerイメージをビルド
2. **構成フェーズ**: docker-compose.ymlを使用してシステムを構成
3. **起動フェーズ**: Docker Composeを使用してシステムを起動
4. **検証フェーズ**: ヘルスチェックを実行して正常動作を確認

## 4. メリットとデメリット

### 4.1 メリット

- **開発の容易さ**: モノリシックアプリケーションの開発の容易さを維持
- **モジュール性**: 明確な境界と責任分離による保守性の向上
- **スケーラビリティ**: 必要に応じて特定のモジュールのみをスケールアップ/アウト可能
- **デプロイの単純さ**: 単一のコマンドでシステム全体をデプロイ
- **運用の単純さ**: マイクロサービスの複雑な運用課題を回避

### 4.2 デメリット

- **部分的なスケーリング制限**: 完全な独立スケーリングはマイクロサービスほど柔軟ではない
- **技術スタックの制約**: モジュール間で一部の技術選択が制約される場合がある
- **障害分離の限界**: 一部のモジュールの障害が他のモジュールに影響する可能性

## 5. 実装ガイドライン

### 5.1 モジュール設計原則

- **単一責任の原則**: 各モジュールは明確に定義された単一の責任を持つ
- **明確なインターフェース**: モジュール間の依存関係は明確に定義されたインターフェースを通じてのみ行う
- **自己完結性**: 各モジュールは可能な限り自己完結的であるべき

### 5.2 コンテナ設計原則

- **軽量コンテナ**: 必要最小限の依存関係のみを含む軽量なコンテナを作成
- **環境変数による設定**: 設定は環境変数を通じて注入
- **永続データの分離**: 永続データはボリュームを使用して分離
- **ログの標準化**: ログは標準出力/標準エラー出力に出力

### 5.3 通信設計原則

- **非同期通信の優先**: 可能な限り非同期通信を優先
- **冪等性の確保**: APIは冪等性を確保
- **障害の適切な処理**: 通信障害を適切に処理するメカニズムを実装
- **タイムアウトの設定**: 適切なタイムアウト値を設定

## 6. HARCAプロジェクトでの適用例

### 6.1 Sequential Thinkingモジュール

Sequential Thinkingモジュールは、コンテナ化モジュラーモノリスの原則に従って実装されています：

- **独立したコンテナ**: 独自のDockerコンテナで実行
- **明確なAPI**: JSON-RPC 2.0形式のAPIを提供
- **設定の柔軟性**: 環境変数による設定
- **スケーラビリティ**: 必要に応じて独立してスケール可能

### 6.2 ドキュメントRAGモジュール

ドキュメントRAGモジュールも同様の原則に従っています：

- **モジュール性**: 文書処理、ベクトル化、検索の責任を明確に分離
- **共有リソースの活用**: PostgreSQLとpgvectorを活用
- **APIによる統合**: 明確に定義されたAPIを通じて他のモジュールと統合

## 7. 結論

コンテナ化モジュラーモノリスアーキテクチャは、モノリシックアプリケーションとマイクロサービスの良いところを組み合わせた設計パターンです。HARCAプロジェクトでは、このアーキテクチャを採用することで、開発の容易さと運用の単純さを維持しながら、モジュール性とスケーラビリティを実現しています。

今後のフェーズでは、このアーキテクチャの原則に従って、メモリコーパスモジュールなどの新しいモジュールを追加していく予定です。

## 更新履歴

| 日付 | 更新者 | 変更内容 |
|------|--------|----------|
| 2025-03-23 | HARCA開発チーム | 初版作成 |
