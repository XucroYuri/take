/**
 * CLI-side generate commands — thin re-exports of the shared orchestration
 * layer in @take-ai/provider (single source of truth for batch generation).
 */
export { generateImages, generateVideos } from '@take-ai/provider';
export type { BatchGenerateOptions as GenerateOptions } from '@take-ai/provider';
