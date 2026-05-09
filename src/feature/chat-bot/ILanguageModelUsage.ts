export interface ILanguageModelUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  costUsd?: number
  provider?: string
  model?: string
}
