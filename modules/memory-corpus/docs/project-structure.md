# Memory Corpus モジュール構造ドキュメント

## プロジェクト概要

Memory Corpusモジュールは、HARCAシステムにおけるメモリ管理機能を提供します。メモリの作成、取得、更新、削除などの基本的なCRUD操作と、メモリの検索機能を実装しています。

## ディレクトリ構造

```
memory-corpus/
├── __mocks__/              # グローバルモック
│   ├── src/                # ソースコードのモック
│   └── utils/              # ユーティリティのモック（logger.jsなど）
├── coverage/               # テストカバレッジレポート
├── docs/                   # ドキュメント
├── node_modules/           # 依存パッケージ
├── src/                    # ソースコード
│   ├── index.js            # モジュールのエントリーポイント
│   ├── memory-manager.js   # メモリ管理クラス
│   ├── memory-model.js     # メモリエンティティモデル
│   ├── memory-optimizer.js # メモリ最適化機能
│   └── memory-search.js    # メモリ検索機能
└── tests/                  # テストコード
    ├── __mocks__/          # テスト用モック
    │   ├── cache/          # キャッシュクライアントモック
    │   ├── db/             # データベースクライアントモック
    │   ├── services/       # サービスモック（埋め込みサービスなど）
    │   └── utils/          # ユーティリティモック
    ├── index.test.js       # エントリーポイントのテスト
    ├── memory-manager.test.js  # メモリ管理クラスのテスト
    ├── memory-model.test.js    # メモリモデルのテスト
    ├── memory-optimizer.test.js # メモリ最適化のテスト
    └── memory-search.test.js   # メモリ検索のテスト
```

## 主要コンポーネント

### 1. Memory モデル (memory-model.js)

メモリエンティティの定義とデータ構造を提供します。

- **主要クラス**: `Memory`
- **列挙型**:
  - `MemoryType`: メモリタイプ（EPISODIC, SEMANTIC, PROCEDURAL, OBSERVATION）
  - `MemoryPriority`: メモリ優先度（LOW, MEDIUM, HIGH, CRITICAL）
- **バリデーション**: メモリ作成時に必須フィールドと型チェックを実行

### 2. MemoryManager (memory-manager.js)

メモリの基本的なCRUD操作を提供します。

- **主要メソッド**:
  - `createMemory(memoryData)`: 新しいメモリを作成
  - `getMemory(memoryId)`: IDによりメモリを取得
  - `updateMemory(memoryId, updateData)`: メモリを更新
  - `deleteMemory(memoryId)`: メモリを削除
  - `bulkCreateMemories(memoriesData)`: 複数のメモリを一括作成
  - `bulkDeleteMemories(memoryIds)`: 複数のメモリを一括削除
- **キャッシュ管理**: メモリデータをデータベースとキャッシュの両方で管理

### 3. MemorySearch (memory-search.js)

メモリの検索機能を提供します。

- **主要メソッド**:
  - `searchByContent(query, options)`: 内容によるメモリ検索
  - `searchByEmbedding(embedding, options)`: 埋め込みベクトルによる類似検索
  - `searchByTags(tags, options)`: タグによるメモリ検索
  - `searchByMetadata(metadata, options)`: メタデータによるメモリ検索

### 4. MemoryCorpus (index.js)

モジュールのエントリーポイントとして、他のコンポーネントを統合します。

- **依存関係**:
  - `MemoryManager`: メモリ管理
  - `MemorySearch`: メモリ検索
  - `MemoryOptimizer`: メモリ最適化
- **外部インターフェース**: モジュールの公開APIを定義

## テスト構造

各コンポーネントに対応するテストファイルがあり、ユニットテストと統合テストを提供します。

- **モック**: テストでは、データベース、キャッシュ、埋め込みサービスなどの外部依存をモックしています。
- **テスト範囲**: 基本的なCRUD操作、検索機能、エラーハンドリングなどをカバー

## 既知の問題と課題

1. **テストの実行環境**: ESモジュール形式のテストの実行に問題があり、Jest設定の調整が必要
2. **モックの整合性**: テスト間でモックの実装に不一致がある可能性
3. **メモリバリデーション**: 必須フィールド（type, content, confidence）の検証が厳格

## 次のステップ

1. テスト環境の問題を解決し、すべてのテストが正常に実行できるようにする
2. bulkCreateMemoriesとbulkDeleteMemoriesメソッドの実装を完了する
3. updateMemoryメソッドの戻り値の一貫性を確保する（更新されたメモリオブジェクトを返す）
