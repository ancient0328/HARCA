#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// Fixed chalk import for ESM
import chalk from 'chalk';
// ツール推奨機能のインポート
import { defaultToolMetadataManager, defaultContextAnalyzer, defaultToolRecommender } from './tools/index.js';
import { registerSampleTools } from './tools/sample-tools.js';
/**
 * HARCAシーケンシャルシンキングサーバー
 * 構造化された思考プロセスを通じて問題解決を支援するMCPサーバー
 */
export class SequentialThinkingServer {
    thoughtHistory = [];
    branches = {};
    debugMode;
    toolMetadataManager;
    contextAnalyzer;
    toolRecommender;
    constructor(options = {}) {
        this.debugMode = options.debug || false;
        // ツール関連コンポーネントの初期化
        this.toolMetadataManager = options.toolMetadataManager || defaultToolMetadataManager;
        this.contextAnalyzer = options.contextAnalyzer || defaultContextAnalyzer;
        this.toolRecommender = options.toolRecommender || defaultToolRecommender;
        // サンプルツールの登録
        registerSampleTools(this.toolMetadataManager);
        if (this.debugMode) {
            console.error(chalk.blue('HARCA Sequential Thinking Server initialized in debug mode'));
            console.error(chalk.blue(`Registered tools: ${this.toolMetadataManager.getAllTools().length}`));
        }
    }
    /**
     * 思考データのバリデーション
     */
    validateThoughtData(input) {
        const data = input;
        if (!data.thought || typeof data.thought !== 'string') {
            throw new Error('Invalid thought: must be a string');
        }
        if (!data.thoughtNumber || typeof data.thoughtNumber !== 'number') {
            throw new Error('Invalid thoughtNumber: must be a number');
        }
        if (!data.totalThoughts || typeof data.totalThoughts !== 'number') {
            throw new Error('Invalid totalThoughts: must be a number');
        }
        if (typeof data.nextThoughtNeeded !== 'boolean') {
            throw new Error('Invalid nextThoughtNeeded: must be a boolean');
        }
        return {
            thought: data.thought,
            thoughtNumber: data.thoughtNumber,
            totalThoughts: data.totalThoughts,
            nextThoughtNeeded: data.nextThoughtNeeded,
            isRevision: data.isRevision,
            revisesThought: data.revisesThought,
            branchFromThought: data.branchFromThought,
            branchId: data.branchId,
            needsMoreThoughts: data.needsMoreThoughts,
            includeToolRecommendations: data.includeToolRecommendations,
        };
    }
    /**
     * 思考の整形と表示
     */
    formatThought(thoughtData) {
        const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } = thoughtData;
        let prefix = '';
        let context = '';
        if (isRevision) {
            prefix = chalk.yellow('🔄 修正');
            context = ` (思考 ${revisesThought} の修正)`;
        }
        else if (branchFromThought) {
            prefix = chalk.green('🌿 分岐');
            context = ` (思考 ${branchFromThought} から分岐, ID: ${branchId})`;
        }
        else {
            prefix = chalk.blue('💭 思考');
            context = '';
        }
        const header = `${prefix} ${thoughtNumber}/${totalThoughts}${context}`;
        const border = '─'.repeat(Math.max(header.length, thought.length) + 4);
        return `
┌${border}┐
│ ${header} │
├${border}┤
│ ${thought.padEnd(border.length - 2)} │
└${border}┘`;
    }
    /**
     * 思考に基づいてツールを推奨する
     */
    recommendToolsForThought(thought) {
        try {
            if (this.debugMode) {
                console.error(chalk.green('Generating tool recommendations for thought...'));
            }
            // ツール推奨オプション
            const options = {
                maxResults: 3,
                minScore: 0.4,
                userExperienceLevel: 7,
                includeUsageHints: true
            };
            // ツール推奨を取得
            const recommendations = this.toolRecommender.recommendToolsForThought(thought, options);
            if (this.debugMode) {
                console.error(chalk.green(`Generated ${recommendations.length} tool recommendations`));
            }
            return recommendations;
        }
        catch (error) {
            console.error(chalk.red('Error generating tool recommendations:'), error);
            return [];
        }
    }
    /**
     * 思考プロセスの処理
     */
    processThought(input) {
        try {
            const validatedInput = this.validateThoughtData(input);
            if (validatedInput.thoughtNumber > validatedInput.totalThoughts) {
                validatedInput.totalThoughts = validatedInput.thoughtNumber;
            }
            this.thoughtHistory.push(validatedInput);
            if (validatedInput.branchFromThought && validatedInput.branchId) {
                if (!this.branches[validatedInput.branchId]) {
                    this.branches[validatedInput.branchId] = [];
                }
                this.branches[validatedInput.branchId].push(validatedInput);
            }
            const formattedThought = this.formatThought(validatedInput);
            if (this.debugMode) {
                console.error(formattedThought);
            }
            // 結果オブジェクトを作成
            const result = {
                thoughtNumber: validatedInput.thoughtNumber,
                totalThoughts: validatedInput.totalThoughts,
                nextThoughtNeeded: validatedInput.nextThoughtNeeded,
                branches: Object.keys(this.branches),
                thoughtHistoryLength: this.thoughtHistory.length
            };
            // ツール推奨が要求されている場合は追加
            if (validatedInput.includeToolRecommendations) {
                result.toolRecommendations = this.recommendToolsForThought(validatedInput.thought);
            }
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error),
                            status: 'failed'
                        }, null, 2)
                    }],
                isError: true
            };
        }
    }
    /**
     * サーバーを起動する
     * @param port サーバーのポート番号
     */
    start(port) {
        if (this.debugMode) {
            console.error(chalk.green(`Starting HARCA Sequential Thinking Server on port ${port}`));
        }
        // 実際のHTTPサーバー起動はstart-server.tsで行うため、ここでは何もしない
    }
    /**
     * サーバーを停止する
     */
    async stop() {
        if (this.debugMode) {
            console.error(chalk.yellow('Stopping HARCA Sequential Thinking Server'));
        }
        // クリーンアップ処理
        this.thoughtHistory = [];
        this.branches = {};
        return Promise.resolve();
    }
}
/**
 * Sequential Thinkingツール定義
 */
const SEQUENTIAL_THINKING_TOOL = {
    name: "sequentialthinking",
    description: `構造化された思考プロセスを通じて問題解決を支援するツール。
このツールは、複雑な問題を段階的に分析し、理解を深めながら思考を発展させることができます。
各思考は、前の洞察を基に構築したり、疑問を投げかけたり、修正したりすることができます。

このツールの使用タイミング:
- 複雑な問題を段階的に分解する
- 修正の余地を残した計画や設計
- 軌道修正が必要な可能性のある分析
- 最初は全体像が明確でない問題
- 複数のステップによる解決が必要な問題
- 文脈を維持する必要があるタスク
- 無関係な情報をフィルタリングする状況

主な特徴:
- 進行に応じて思考の総数を調整可能
- 以前の思考を疑問視または修正可能
- 一度終了したと思われても追加の思考が可能
- 不確実性を表現し、代替アプローチを探索可能
- 思考は必ずしも線形に構築される必要はなく、分岐や後戻りが可能
- 解決策の仮説を生成
- 思考の連鎖に基づいて仮説を検証
- 満足するまでプロセスを繰り返す
- 正確な回答を提供
- 問題に適したツールを推奨

パラメータの説明:
- thought: 現在の思考ステップ（以下を含む）:
  * 通常の分析ステップ
  * 以前の思考の修正
  * 以前の決定に関する質問
  * より多くの分析が必要であるという認識
  * アプローチの変更
  * 仮説の生成
  * 仮説の検証
- nextThoughtNeeded: 終了したと思われても、さらに思考が必要な場合はtrue
- thoughtNumber: シーケンス内の現在の番号（必要に応じて初期の合計を超えることも可能）
- totalThoughts: 必要な思考の現在の見積もり（上下に調整可能）
- isRevision: この思考が以前の思考を修正するかどうかを示すブール値
- revisesThought: isRevisionがtrueの場合、どの思考番号が再考されているか
- branchFromThought: この思考が分岐する場合、どの思考番号から分岐するか
- branchId: 分岐の識別子（同じ分岐の思考をグループ化するため）
- needsMoreThoughts: 現在の見積もりよりも多くの思考が必要な場合はtrue
- includeToolRecommendations: 思考に基づいたツール推奨を含めるかどうか

使用上の注意:
1. 思考プロセスの各ステップを明確に表現する
2. 不確実性や疑問を隠さない
3. 必要に応じて以前の思考を修正する
4. 複数の可能性を探索するために分岐を使用する
5. 思考の数を動的に調整する
6. 仮説を生成し、検証する
7. 問題に適したツールを活用する
8. 思考プロセスが完了したら、明確な結論を提供する
9. 複雑な問題には、より多くの思考ステップを使用する
10. 思考プロセスを通じて学んだことを統合する
11. 本当に終了し、満足のいく回答に達した場合にのみnextThoughtNeededをfalseに設定する`,
    inputSchema: {
        type: "object",
        properties: {
            thought: {
                type: "string",
                description: "現在の思考ステップ"
            },
            thoughtNumber: {
                type: "number",
                description: "シーケンス内の現在の思考番号"
            },
            totalThoughts: {
                type: "number",
                description: "必要な思考の現在の見積もり"
            },
            nextThoughtNeeded: {
                type: "boolean",
                description: "さらに思考が必要かどうか"
            },
            isRevision: {
                type: "boolean",
                description: "この思考が以前の思考を修正するかどうか"
            },
            revisesThought: {
                type: "number",
                description: "修正する思考の番号"
            },
            branchFromThought: {
                type: "number",
                description: "分岐元の思考番号"
            },
            branchId: {
                type: "string",
                description: "分岐の識別子"
            },
            needsMoreThoughts: {
                type: "boolean",
                description: "現在の見積もりよりも多くの思考が必要かどうか"
            },
            includeToolRecommendations: {
                type: "boolean",
                description: "思考に基づいたツール推奨を含めるかどうか"
            }
        },
        required: ["thought", "thoughtNumber", "totalThoughts", "nextThoughtNeeded"]
    }
};
/**
 * サーバーの実行
 */
async function runServer() {
    const debug = process.env.DEBUG === 'true';
    const server = new Server({
        name: "harca-sequential-thinking-server",
        version: "1.0.0",
    }, {
        capabilities: {
            tools: {},
        },
    });
    const sequentialThinkingServer = new SequentialThinkingServer({ debug });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [SEQUENTIAL_THINKING_TOOL],
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        if (request.params.name === "sequentialthinking") {
            return sequentialThinkingServer.processThought(request.params.arguments);
        }
        return {
            content: [{
                    type: "text",
                    text: `Unknown tool: ${request.params.name}`
                }],
            isError: true
        };
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(chalk.green('HARCA Sequential Thinking MCP Server started'));
}
runServer().catch((error) => {
    console.error(chalk.red("Fatal error running server:"), error);
    process.exit(1);
});
