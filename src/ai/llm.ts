import { llmConfig } from '@config/llm.config'
import { systemPrompt } from './prompts/system'
import type { LlmChatResult, LlmMessage } from '@/types'

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string }
  }>
  error?: { message?: string }
}

export async function chatCompletion(
  messages: LlmMessage[],
  options?: { temperature?: number },
): Promise<LlmChatResult> {
  const apiKey =
    import.meta.env.VITE_SILICONFLOW_API_KEY ||
    import.meta.env.VITE_DEEPSEEK_API_KEY ||
    import.meta.env.DEEPSEEK_API_KEY
  if (!apiKey || apiKey === 'your_api_key_here') {
    return {
      content:
        '【演示提示】请在项目根目录创建 .env 文件并设置 VITE_SILICONFLOW_API_KEY（或 VITE_DEEPSEEK_API_KEY）即可启用真实 AI 对话。当前为离线占位回复。',
    }
  }

  const response = await fetch(`${llmConfig.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: llmConfig.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: options?.temperature ?? llmConfig.temperature,
      max_tokens: llmConfig.maxTokens,
    }),
  })

  const data = (await response.json()) as ChatCompletionResponse

  if (!response.ok) {
    throw new Error(data.error?.message || `LLM 请求失败 (${response.status})`)
  }

  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('LLM 返回内容为空')
  }

  return { content }
}

/** 统一 AI 调用入口 — 所有 LLM 请求必须经此文件 */
export async function sendChatMessage(history: LlmMessage[], userMessage: string): Promise<string> {
  const messages: LlmMessage[] = [...history, { role: 'user', content: userMessage }]
  const result = await chatCompletion(messages)
  return result.content
}
