/**
 * コンテキスト分析エンジン
 * ユーザーの問題や状況を分析し、最適なツールを推奨するための文脈情報を抽出するモジュール
 */
import { ToolCategory, ToolContext } from './metadata.js';
/**
 * 分析結果の信頼度レベル
 */
export declare enum ConfidenceLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    VERY_HIGH = "very_high"
}
/**
 * コンテキスト分析結果のインターフェース
 */
export interface ContextAnalysisResult {
    categories: Array<{
        category: ToolCategory;
        confidence: number;
    }>;
    contexts: Array<{
        context: ToolContext;
        confidence: number;
    }>;
    keywords: Array<{
        keyword: string;
        relevance: number;
    }>;
    complexityLevel: number;
    urgencyLevel: number;
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
export declare class ContextAnalyzer {
    private categoryKeywords;
    private contextKeywords;
    /**
     * 思考データからコンテキストを分析する
     */
    analyzeThought(thought: string): ThoughtAnalysisResult;
    /**
     * テキストからコンテキスト情報を抽出する
     */
    analyzeContext(text: string): ContextAnalysisResult;
    /**
     * 部分一致を検出する
     */
    private hasPartialMatch;
    /**
     * 日本語の技術用語を抽出する
     */
    private extractTechnicalTerms;
    /**
     * キーワードの関連性を計算する
     */
    private calculateKeywordRelevance;
    /**
     * 複雑さレベルを推定する
     */
    private estimateComplexityLevel;
    /**
     * 緊急度レベルを推定する
     */
    private estimateUrgencyLevel;
    /**
     * 全体的な信頼度を計算する
     */
    private calculateOverallConfidence;
    /**
     * 推奨アプローチを生成する
     */
    private generateSuggestedApproach;
}
/**
 * デフォルトのコンテキスト分析エンジンのインスタンス
 */
export declare const defaultContextAnalyzer: ContextAnalyzer;
