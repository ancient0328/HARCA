/**
 * サンプルツールメタデータ
 * ツール推奨機能のテストと例示のために使用
 */
import { ToolMetadata, ToolMetadataManager } from './metadata.js';
/**
 * サンプルツールメタデータを作成する
 */
export declare function createSampleTools(): ToolMetadata[];
/**
 * サンプルツールをツールメタデータマネージャーに登録する
 */
export declare function registerSampleTools(manager: ToolMetadataManager): void;
