/**
 * コンテキスト分析エンジン
 * ユーザーの問題や状況を分析し、最適なツールを推奨するための文脈情報を抽出するモジュール
 */

import { ToolCategory, ToolContext } from './metadata.js';

/**
 * 分析結果の信頼度レベル
 */
export enum ConfidenceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * コンテキスト分析結果のインターフェース
 */
export interface ContextAnalysisResult {
  categories: Array<{
    category: ToolCategory;
    confidence: number; // 0-1の範囲
  }>;
  contexts: Array<{
    context: ToolContext;
    confidence: number; // 0-1の範囲
  }>;
  keywords: Array<{
    keyword: string;
    relevance: number; // 0-1の範囲
  }>;
  complexityLevel: number; // 1-10のスケール
  urgencyLevel: number; // 1-10のスケール
  overallConfidence: ConfidenceLevel;
  suggestedApproach?: string;
}

/**
 * 思考ステップの分析結果
 */
export interface ThoughtAnalysisResult {
  mainFocus: string;
  subTopics: string[];
  questionsPosed: string[];
  decisionsReached: string[];
  uncertainties: string[];
  nextStepsNeeded: boolean;
}

/**
 * コンテキスト分析エンジンクラス
 */
export class ContextAnalyzer {
  // カテゴリ検出のためのキーワードマッピング
  private categoryKeywords: Record<ToolCategory, string[]> = {
    [ToolCategory.ANALYSIS]: [
      '分析', '評価', '測定', '診断', '調査', '検証', 'パターン', 'トレンド',
      '統計', 'メトリクス', 'KPI', 'パフォーマンス', '効率', 'ベンチマーク'
    ],
    [ToolCategory.CODING]: [
      'コード', 'プログラミング', '実装', '開発', '関数', 'クラス', 'メソッド',
      'API', 'ライブラリ', 'フレームワーク', '変数', 'インターフェース', 'モジュール'
    ],
    [ToolCategory.DOCUMENTATION]: [
      'ドキュメント', '文書', 'マニュアル', '仕様', 'API仕様', 'コメント',
      'README', '説明', 'ガイド', 'チュートリアル', '記録', 'リファレンス'
    ],
    [ToolCategory.COMMUNICATION]: [
      'コミュニケーション', '共有', '議論', 'チーム', '会議', 'フィードバック',
      'レビュー', 'プレゼンテーション', '説明', '質問', '回答', '連絡'
    ],
    [ToolCategory.RESEARCH]: [
      '研究', '調査', '探索', '情報収集', '学習', '発見', 'トレンド',
      '比較', '分析', '文献', '論文', '記事', 'ベストプラクティス'
    ],
    [ToolCategory.PLANNING]: [
      '計画', '戦略', 'ロードマップ', 'スケジュール', 'タスク', '優先順位',
      'マイルストーン', '目標', '要件', '見積もり', 'バックログ', 'スプリント'
    ],
    [ToolCategory.DEBUGGING]: [
      'デバッグ', 'バグ', 'エラー', '問題', '修正', 'トラブルシューティング',
      '例外', 'クラッシュ', 'ログ', '診断', '再現', 'ステップバイステップ'
    ],
    [ToolCategory.TESTING]: [
      'テスト', '検証', '品質保証', 'QA', 'ユニットテスト', '統合テスト',
      'E2Eテスト', 'モック', 'スタブ', 'アサーション', 'カバレッジ', '自動化'
    ],
    [ToolCategory.DEPLOYMENT]: [
      'デプロイ', 'リリース', '展開', 'CI/CD', 'パイプライン', 'コンテナ',
      'Docker', 'Kubernetes', 'クラウド', 'サーバー', '環境', '構成'
    ],
    [ToolCategory.OTHER]: [
      'その他', '一般', '雑多', '特殊', 'カスタム', 'ユニーク',
      '特別', '例外的', '未分類', '多目的', '汎用', '特定'
    ]
  };
  
  // コンテキスト検出のためのキーワードマッピング
  private contextKeywords: Record<ToolContext, string[]> = {
    [ToolContext.PROBLEM_DEFINITION]: [
      '問題', '課題', '定義', '特定', '明確化', '要件', 'ニーズ',
      '制約', '範囲', '目標', '目的', '背景', '状況', '症状'
    ],
    [ToolContext.SOLUTION_DESIGN]: [
      '設計', '解決策', 'アーキテクチャ', '構造', 'パターン', 'アプローチ',
      '方法論', 'フレームワーク', '青写真', 'モデル', '概念', '構想'
    ],
    [ToolContext.IMPLEMENTATION]: [
      '実装', '開発', 'コーディング', '構築', '作成', '統合', 'API',
      'ライブラリ', 'モジュール', '関数', 'クラス', 'コンポーネント'
    ],
    [ToolContext.REVIEW]: [
      'レビュー', '評価', '検証', '確認', '監査', '分析', '品質',
      '基準', 'チェックリスト', 'フィードバック', '改善点', '強み', '弱み'
    ],
    [ToolContext.REFACTORING]: [
      'リファクタリング', '改善', '最適化', '整理', '簡素化', '再構築',
      'クリーンアップ', '技術的負債', 'コード品質', '保守性', '拡張性'
    ],
    [ToolContext.LEARNING]: [
      '学習', '教育', 'トレーニング', '理解', '知識', 'スキル', '成長',
      '発見', '探索', '調査', '研究', 'ベストプラクティス', '例', 'サンプル'
    ],
    [ToolContext.COLLABORATION]: [
      '協力', 'チーム', '共同', '連携', '共有', 'コミュニケーション',
      '調整', '分担', '役割', '責任', 'フィードバック', '会議', 'ディスカッション'
    ],
    [ToolContext.DECISION_MAKING]: [
      '決定', '選択', '判断', '評価', '比較', 'トレードオフ', '優先順位',
      '基準', '根拠', '分析', '戦略', '方針', 'ゴール', '目標'
    ]
  };
  
  /**
   * 思考データからコンテキストを分析する
   */
  public analyzeThought(thought: string): ThoughtAnalysisResult {
    // 実際の実装では、より高度な自然言語処理や機械学習を使用する
    // ここでは簡易的な実装を提供
    
    const lines = thought.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // 主要な焦点を特定（最初の文または最も長い文を使用）
    const mainFocus = lines.length > 0 
      ? (lines[0].endsWith('。') || lines[0].endsWith('.') ? lines[0] : lines[0] + '。')
      : '不明な焦点';
    
    // サブトピックを特定（箇条書きや番号付きリストを検出）
    const subTopics = lines
      .filter(line => line.match(/^[•\-*]|^\d+[\.\)]/))
      .map(line => line.replace(/^[•\-*]|^\d+[\.\)]/, '').trim());
    
    // 質問を特定（疑問符を含む文）
    const questionsPosed = lines
      .filter(line => line.includes('？') || line.includes('?'))
      .map(line => line.trim());
    
    // 決定事項を特定（「決定」「選択」「判断」などのキーワードを含む文）
    const decisionsReached = lines
      .filter(line => 
        line.includes('決定') || 
        line.includes('選択') || 
        line.includes('判断') || 
        line.includes('結論')
      )
      .map(line => line.trim());
    
    // 不確実性を特定（「かもしれない」「可能性」「不明確」などのキーワードを含む文）
    const uncertainties = lines
      .filter(line => 
        line.includes('かもしれない') || 
        line.includes('可能性') || 
        line.includes('不明確') || 
        line.includes('不確か') ||
        line.includes('検討') ||
        line.includes('調査が必要')
      )
      .map(line => line.trim());
    
    // 次のステップが必要かどうかを判断
    const nextStepsNeeded = lines.some(line => 
      line.includes('次のステップ') || 
      line.includes('今後の課題') || 
      line.includes('さらなる分析') ||
      line.includes('続けて') ||
      line.includes('引き続き')
    );
    
    return {
      mainFocus,
      subTopics,
      questionsPosed,
      decisionsReached,
      uncertainties,
      nextStepsNeeded
    };
  }
  
  /**
   * テキストからコンテキスト情報を抽出する
   */
  public analyzeContext(text: string): ContextAnalysisResult {
    // テキストを前処理
    const normalizedText = text.toLowerCase();
    
    // デバッグ情報
    if (process.env.DEBUG === 'true') {
      console.log('コンテキスト分析対象テキスト:', text);
    }
    
    // カテゴリの信頼度を計算 - 改善版
    const categories = Object.entries(this.categoryKeywords).map(([category, keywords]) => {
      // 完全一致と部分一致の両方を考慮
      const exactMatches = keywords.filter(keyword => 
        normalizedText.includes(keyword.toLowerCase())
      );
      
      // 部分一致（キーワードの一部が含まれる場合）
      const partialMatches = keywords.filter(keyword => 
        !exactMatches.includes(keyword) && // 完全一致は除外
        keyword.length > 3 && // 短すぎるキーワードは除外
        this.hasPartialMatch(normalizedText, keyword.toLowerCase())
      );
      
      // 完全一致と部分一致を重み付けして信頼度を計算
      const exactMatchWeight = 1.0;
      const partialMatchWeight = 0.5;
      
      const confidence = (
        (exactMatches.length * exactMatchWeight) + 
        (partialMatches.length * partialMatchWeight)
      ) / keywords.length;
      
      return {
        category: category as ToolCategory,
        confidence: Math.min(confidence * 2, 1) // スケーリングして0-1の範囲に収める
      };
    }).sort((a, b) => b.confidence - a.confidence);
    
    // コンテキストの信頼度を計算 - 改善版
    const contexts = Object.entries(this.contextKeywords).map(([context, keywords]) => {
      // 完全一致と部分一致の両方を考慮
      const exactMatches = keywords.filter(keyword => 
        normalizedText.includes(keyword.toLowerCase())
      );
      
      // 部分一致（キーワードの一部が含まれる場合）
      const partialMatches = keywords.filter(keyword => 
        !exactMatches.includes(keyword) && // 完全一致は除外
        keyword.length > 3 && // 短すぎるキーワードは除外
        this.hasPartialMatch(normalizedText, keyword.toLowerCase())
      );
      
      // 完全一致と部分一致を重み付けして信頼度を計算
      const exactMatchWeight = 1.0;
      const partialMatchWeight = 0.5;
      
      const confidence = (
        (exactMatches.length * exactMatchWeight) + 
        (partialMatches.length * partialMatchWeight)
      ) / keywords.length;
      
      return {
        context: context as ToolContext,
        confidence: Math.min(confidence * 2, 1) // スケーリングして0-1の範囲に収める
      };
    }).sort((a, b) => b.confidence - a.confidence);
    
    // 関連キーワードを抽出 - 改善版
    const allKeywords = [
      ...Object.values(this.categoryKeywords).flat(),
      ...Object.values(this.contextKeywords).flat()
    ];
    
    // 重複を排除
    const uniqueKeywords = [...new Set(allKeywords)];
    
    // キーワード抽出の改善
    const extractedKeywords = uniqueKeywords
      .filter(keyword => 
        normalizedText.includes(keyword.toLowerCase()) || 
        (keyword.length > 3 && this.hasPartialMatch(normalizedText, keyword.toLowerCase()))
      )
      .map(keyword => ({
        keyword,
        relevance: this.calculateKeywordRelevance(keyword, normalizedText)
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 15); // 上位15件に増加
    
    // 日本語の技術用語も抽出
    const techTerms = this.extractTechnicalTerms(normalizedText);
    const combinedKeywords = [
      ...extractedKeywords,
      ...techTerms.map(term => ({
        keyword: term,
        relevance: this.calculateKeywordRelevance(term, normalizedText)
      }))
    ]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 20); // 最終的に上位20件を使用
    
    // 複雑さレベルを推定
    const complexityLevel = this.estimateComplexityLevel(text);
    
    // 緊急度レベルを推定
    const urgencyLevel = this.estimateUrgencyLevel(text);
    
    // 全体的な信頼度を計算
    const overallConfidence = this.calculateOverallConfidence(
      categories[0]?.confidence || 0,
      contexts[0]?.confidence || 0,
      combinedKeywords.length
    );
    
    // 推奨アプローチを生成
    const suggestedApproach = this.generateSuggestedApproach(
      categories[0]?.category,
      contexts[0]?.context,
      complexityLevel,
      urgencyLevel
    );
    
    // デバッグ情報
    if (process.env.DEBUG === 'true') {
      console.log('抽出されたカテゴリ:', categories.slice(0, 3));
      console.log('抽出されたコンテキスト:', contexts.slice(0, 3));
      console.log('抽出されたキーワード:', combinedKeywords.slice(0, 10));
    }
    
    return {
      categories,
      contexts,
      keywords: combinedKeywords,
      complexityLevel,
      urgencyLevel,
      overallConfidence,
      suggestedApproach
    };
  }
  
  /**
   * 部分一致を検出する
   */
  private hasPartialMatch(text: string, keyword: string): boolean {
    // 単語の境界を考慮
    const words = text.split(/\s+/);
    
    // いずれかの単語がキーワードの一部を含むか、またはその逆
    return words.some(word => 
      word.length > 3 && (word.includes(keyword) || keyword.includes(word))
    );
  }
  
  /**
   * 日本語の技術用語を抽出する
   */
  private extractTechnicalTerms(text: string): string[] {
    // 技術用語のリスト
    const technicalTerms = [
      'パフォーマンス', '最適化', 'アルゴリズム', 'データ構造', 'メモリリーク',
      'CPU使用率', 'ボトルネック', 'プロファイリング', 'キャッシュ', '非同期処理',
      'スレッド', '並列処理', 'レンダリング', 'レイテンシ', 'スループット',
      'インデックス', 'クエリ', 'データベース', 'ネットワーク', 'バッファ',
      'ガベージコレクション', 'メモリ管理', 'コンパイル', 'バンドル', 'ミニファイ',
      'コード分割', '遅延ロード', 'プリロード', 'サーバーサイドレンダリング',
      'クライアントサイドレンダリング', 'ステート管理', 'イベントループ',
      'ブロッキング', 'ノンブロッキング', 'I/O', 'ディスク', 'CPU', 'GPU',
      'メモリ', 'キャッシュ', 'ネットワーク', 'レスポンス', 'リクエスト'
    ];
    
    // テキストに含まれる技術用語を抽出
    return technicalTerms.filter(term => text.includes(term));
  }
  
  /**
   * キーワードの関連性を計算する
   */
  private calculateKeywordRelevance(keyword: string, text: string): number {
    // 正規表現でキーワードの出現回数を計算
    const regex = new RegExp(keyword.toLowerCase(), 'g');
    const matches = text.toLowerCase().match(regex);
    const frequency = matches ? matches.length : 0;
    
    // 出現頻度と位置に基づいて関連性を計算
    const firstPosition = text.toLowerCase().indexOf(keyword.toLowerCase());
    const positionFactor = firstPosition > -1 ? 1 - (firstPosition / text.length) : 0;
    
    // キーワードの長さも考慮（長いキーワードほど重要）
    const lengthFactor = Math.min(keyword.length / 15, 1);
    
    // 総合スコアの計算
    const score = (frequency * 0.3) + (positionFactor * 0.5) + (lengthFactor * 0.2);
    
    return Math.min(score, 1);
  }
  
  /**
   * 複雑さレベルを推定する
   */
  private estimateComplexityLevel(text: string): number {
    // 複雑さを示す指標
    const complexityIndicators = {
      // 技術的な用語
      technicalTerms: [
        'アルゴリズム', '最適化', 'パフォーマンス', 'スケーラビリティ',
        'アーキテクチャ', 'リファクタリング', 'デザインパターン', '分散システム',
        'マイクロサービス', 'キャッシュ', '非同期', '並列処理', 'スレッド',
        'メモリ管理', 'ガベージコレクション', 'コンパイラ', 'インタプリタ'
      ],
      
      // 複雑な問題を示す表現
      complexPhrases: [
        '複雑', '難しい', '困難', '挑戦的', '高度', '複雑な相互作用',
        '多くの要因', '複数の側面', '様々な要素', '複雑な依存関係'
      ],
      
      // 高度な概念
      advancedConcepts: [
        '分散', '並列', '非同期', '最適化', 'スケーラビリティ', '冗長性',
        '耐障害性', 'セキュリティ', '暗号化', '認証', '認可'
      ]
    };
    
    // 各指標の出現回数をカウント
    const normalizedText = text.toLowerCase();
    let technicalTermCount = 0;
    let complexPhraseCount = 0;
    let advancedConceptCount = 0;
    
    // 技術的な用語のカウント
    complexityIndicators.technicalTerms.forEach(term => {
      if (normalizedText.includes(term.toLowerCase())) {
        technicalTermCount++;
      }
    });
    
    // 複雑な問題を示す表現のカウント
    complexityIndicators.complexPhrases.forEach(phrase => {
      if (normalizedText.includes(phrase.toLowerCase())) {
        complexPhraseCount++;
      }
    });
    
    // 高度な概念のカウント
    complexityIndicators.advancedConcepts.forEach(concept => {
      if (normalizedText.includes(concept.toLowerCase())) {
        advancedConceptCount++;
      }
    });
    
    // 文の長さと数も考慮
    const sentences = text.split(/[。.!?！？]/);
    const avgSentenceLength = text.length / Math.max(sentences.length, 1);
    const sentenceLengthFactor = Math.min(avgSentenceLength / 50, 1);
    
    // 複雑さスコアの計算
    const technicalTermFactor = Math.min(technicalTermCount / 5, 1);
    const complexPhraseFactor = Math.min(complexPhraseCount / 3, 1);
    const advancedConceptFactor = Math.min(advancedConceptCount / 3, 1);
    
    const complexityScore = 
      (technicalTermFactor * 0.4) + 
      (complexPhraseFactor * 0.3) + 
      (advancedConceptFactor * 0.2) + 
      (sentenceLengthFactor * 0.1);
    
    // 1-10のスケールに変換
    return Math.max(1, Math.min(10, Math.round(1 + (complexityScore * 9))));
  }
  
  /**
   * 緊急度レベルを推定する
   */
  private estimateUrgencyLevel(text: string): number {
    // 緊急性を示す表現を検出
    const urgencyIndicators = [
      { pattern: /急ぎ|緊急|即時|すぐに|今すぐ|早急に|直ちに/, weight: 3 },
      { pattern: /重要|クリティカル|致命的|深刻|重大/, weight: 2 },
      { pattern: /期限|締切|デッドライン|タイムリミット/, weight: 2 },
      { pattern: /今日中|明日まで|今週中|数日以内/, weight: 2.5 },
      { pattern: /待機|遅延|後回し|余裕/, weight: -1 }, // 緊急性を下げる表現
      { pattern: /検討|調査|分析|評価/, weight: -0.5 } // やや緊急性を下げる表現
    ];
    
    // 基本的な緊急度レベル
    let urgencyLevel = 5;
    
    // 各指標に基づいて緊急度を調整
    for (const indicator of urgencyIndicators) {
      const matches = text.match(indicator.pattern);
      if (matches) {
        urgencyLevel += indicator.weight * matches.length;
      }
    }
    
    // 1-10の範囲に収める
    return Math.max(1, Math.min(10, urgencyLevel));
  }
  
  /**
   * 全体的な信頼度を計算する
   */
  private calculateOverallConfidence(
    topCategoryConfidence: number,
    topContextConfidence: number,
    keywordCount: number
  ): ConfidenceLevel {
    const averageConfidence = (topCategoryConfidence + topContextConfidence) / 2;
    const keywordFactor = Math.min(keywordCount / 5, 1);
    
    const combinedScore = (averageConfidence * 0.7) + (keywordFactor * 0.3);
    
    if (combinedScore >= 0.8) {
      return ConfidenceLevel.VERY_HIGH;
    } else if (combinedScore >= 0.6) {
      return ConfidenceLevel.HIGH;
    } else if (combinedScore >= 0.4) {
      return ConfidenceLevel.MEDIUM;
    } else {
      return ConfidenceLevel.LOW;
    }
  }
  
  /**
   * 推奨アプローチを生成する
   */
  private generateSuggestedApproach(
    topCategory?: ToolCategory,
    topContext?: ToolContext,
    complexityLevel?: number,
    urgencyLevel?: number
  ): string {
    if (!topCategory || !topContext) {
      return '十分な情報がないため、推奨アプローチを提供できません。';
    }
    
    const complexity = complexityLevel || 5;
    const urgency = urgencyLevel || 5;
    
    // カテゴリとコンテキストの組み合わせに基づいて推奨アプローチを生成
    const approachTemplates: Record<string, string[]> = {
      [`${ToolCategory.ANALYSIS}_${ToolContext.PROBLEM_DEFINITION}`]: [
        '問題の根本原因を特定するために詳細な分析を行うことを推奨します。',
        '問題の範囲と影響を明確にするためのデータ収集を優先してください。'
      ],
      [`${ToolCategory.CODING}_${ToolContext.IMPLEMENTATION}`]: [
        '段階的な実装アプローチで、各ステップでテストを行いながら進めることを推奨します。',
        '既存のライブラリやフレームワークを活用して開発効率を高めることを検討してください。'
      ],
      [`${ToolCategory.DEBUGGING}_${ToolContext.PROBLEM_DEFINITION}`]: [
        '問題の再現手順を明確にし、ログやエラーメッセージを収集することを推奨します。',
        'デバッグツールを使用して問題の発生箇所を特定してください。'
      ]
      // 他の組み合わせも同様に定義...
    };
    
    const key = `${topCategory}_${topContext}`;
    const templates = approachTemplates[key] || [
      `${topCategory}カテゴリと${topContext}コンテキストに基づいた適切なツールの使用を推奨します。`,
      '問題の性質に応じて、段階的なアプローチを検討してください。'
    ];
    
    // 複雑さと緊急度に基づいて追加のアドバイスを生成
    let additionalAdvice = '';
    
    if (complexity > 7 && urgency > 7) {
      additionalAdvice = '問題が複雑で緊急性が高いため、チームでの協力と並行作業を検討してください。';
    } else if (complexity > 7) {
      additionalAdvice = '問題が複雑なため、段階的なアプローチと十分な計画が必要です。';
    } else if (urgency > 7) {
      additionalAdvice = '緊急性が高いため、最も重要な部分に集中し、必要に応じて暫定的な解決策を検討してください。';
    } else if (complexity < 4 && urgency < 4) {
      additionalAdvice = '比較的シンプルで緊急性の低い問題なので、基本的なアプローチで十分でしょう。';
    }
    
    // テンプレートからランダムに選択し、追加のアドバイスを付加
    const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];
    return additionalAdvice ? `${selectedTemplate} ${additionalAdvice}` : selectedTemplate;
  }
}

/**
 * デフォルトのコンテキスト分析エンジンのインスタンス
 */
export const defaultContextAnalyzer = new ContextAnalyzer();
