export const llmConfig = {
  provider: 'siliconflow',
  baseURL: 'https://api.siliconflow.cn/v1',
  model: 'deepseek-ai/DeepSeek-V3',
  temperature: 0.7,
  toolTemperature: 0.3,  
  maxTokens: 2048,
} as const

export type LlmConfig = typeof llmConfig
