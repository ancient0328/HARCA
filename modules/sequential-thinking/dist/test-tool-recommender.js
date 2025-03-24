#!/usr/bin/env node
/**
 * ツール推奨機能のテストスクリプト
 *
 * 使用方法:
 * ```
 * pnpm run build
 * node dist/test-tool-recommender.js "問題の説明文をここに入力"
 * ```
 */
import chalk from 'chalk';
import { defaultToolMetadataManager, defaultContextAnalyzer, defaultToolRecommender } from './tools/index.js';
import { registerSampleTools } from './tools/sample-tools.js';
// サンプルツールを登録
registerSampleTools(defaultToolMetadataManager);
// コマンドライン引数から思考テキストを取得
const thought = process.argv[2] || `
JavaScriptアプリケーションのパフォーマンスが低下しています。
特に大量のデータを処理する際に遅延が発生し、ユーザー体験に影響を与えています。
メモリ使用量も増加傾向にあり、時々クラッシュすることもあります。
コードの複雑さが増しており、どこに問題があるのか特定するのが難しい状況です。
`;
console.log(chalk.blue('=== ツール推奨テスト ==='));
console.log(chalk.yellow('入力された思考:'));
console.log(thought);
console.log();
// コンテキスト分析を実行
console.log(chalk.green('コンテキスト分析結果:'));
const contextAnalysis = defaultContextAnalyzer.analyzeContext(thought);
console.log(JSON.stringify(contextAnalysis, null, 2));
console.log();
// 思考分析を実行
console.log(chalk.green('思考分析結果:'));
const thoughtAnalysis = defaultContextAnalyzer.analyzeThought(thought);
console.log(JSON.stringify(thoughtAnalysis, null, 2));
console.log();
// ツール推奨を実行
console.log(chalk.green('推奨ツール:'));
const recommendations = defaultToolRecommender.recommendToolsForThought(thought, {
    maxResults: 3,
    minScore: 0.3,
    userExperienceLevel: 7,
    includeUsageHints: true
});
// 推奨ツールを表示
if (recommendations.length === 0) {
    console.log(chalk.red('推奨ツールはありません'));
}
else {
    recommendations.forEach((rec, index) => {
        console.log(chalk.blue(`\n推奨ツール ${index + 1}: ${rec.tool.name} (スコア: ${rec.score.toFixed(2)})`));
        console.log(chalk.yellow('説明:'), rec.tool.description);
        console.log(chalk.yellow('カテゴリ:'), rec.tool.category);
        console.log(chalk.yellow('推奨理由:'));
        rec.reasons.forEach(reason => {
            console.log(`- ${reason}`);
        });
        if (rec.usageHint) {
            console.log(chalk.yellow('使用ヒント:'), rec.usageHint);
        }
    });
}
