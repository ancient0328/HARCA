#!/usr/bin/env node
import { ToolMetadataManager, ContextAnalyzer, ToolRecommender } from './tools/index.js';
/**
 * HARCAシーケンシャルシンキングサーバー
 * 構造化された思考プロセスを通じて問題解決を支援するMCPサーバー
 */
export declare class SequentialThinkingServer {
    private thoughtHistory;
    private branches;
    private debugMode;
    private toolMetadataManager;
    private contextAnalyzer;
    private toolRecommender;
    constructor(options?: {
        debug?: boolean;
        toolMetadataManager?: ToolMetadataManager;
        contextAnalyzer?: ContextAnalyzer;
        toolRecommender?: ToolRecommender;
    });
    /**
     * 思考データのバリデーション
     */
    private validateThoughtData;
    /**
     * 思考の整形と表示
     */
    private formatThought;
    /**
     * 思考に基づいてツールを推奨する
     */
    private recommendToolsForThought;
    /**
     * 思考プロセスの処理
     */
    processThought(input: unknown): {
        content: Array<{
            type: string;
            text: string;
        }>;
        isError?: boolean;
    };
    /**
     * サーバーを起動する
     * @param port サーバーのポート番号
     */
    start(port: number): void;
    /**
     * サーバーを停止する
     */
    stop(): Promise<void>;
}
