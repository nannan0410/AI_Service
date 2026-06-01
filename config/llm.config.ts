export const llmConfig = {
  provider: 'deepseek',
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
  temperature: 0.7,
  toolTemperature: 0.3,
  maxTokens: 2048,
} as const

export type LlmConfig = typeof llmConfig
