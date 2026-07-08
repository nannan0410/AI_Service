import { llmConfig } from '@config/llm.config'
import type { LlmMessage } from '@/types'

interface ChatCompletionChoice {
  message?: LlmMessage
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[]
  error?: { message?: string }
  message?: string
  code?: number
}

export function getLlmModel(): string {
  return import.meta.env.VITE_LLM_MODEL?.trim() || llmConfig.model
}

export function parseLlmApiError(data: ChatCompletionResponse, status: number): string {
  return data.error?.message || data.message || `LLM 请求失败 (${status})`
}

export function getLlmApiKey(): string | undefined {
  const apiKey =
    import.meta.env.VITE_LLM_API_KEY ||
    import.meta.env.VITE_SILICONFLOW_API_KEY ||
    import.meta.env.VITE_DEEPSEEK_API_KEY ||
    import.meta.env.DEEPSEEK_API_KEY
  if (
    !apiKey ||
    apiKey === 'your_api_key_here' ||
    apiKey === 'your_siliconflow_api_key_here'
  ) {
    return undefined
  }
  return apiKey
}

export function isLlmAvailable(): boolean {
  return Boolean(getLlmApiKey())
}

export async function requestLlmChatCompletion(
  messages: LlmMessage[],
  options?: {
    temperature?: number
    maxTokens?: number
    responseFormat?: 'json_object' | 'text'
    timeoutMs?: number
  },
): Promise<LlmMessage> {
  const apiKey = getLlmApiKey()
  if (!apiKey) {
    throw new Error('OFFLINE')
  }

  const body: Record<string, unknown> = {
    model: getLlmModel(),
    messages,
    temperature: options?.temperature ?? llmConfig.temperature,
    max_tokens: options?.maxTokens ?? llmConfig.maxTokens,
  }

  if (options?.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' }
  }

  const controller = new AbortController()
  const timeoutMs = options?.timeoutMs ?? 0
  const timer =
    timeoutMs > 0 ? window.setTimeout(() => controller.abort(), timeoutMs) : undefined

  let response: Response
  try {
    response = await fetch(`${llmConfig.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM 请求超时')
    }
    throw error
  } finally {
    if (timer != null) window.clearTimeout(timer)
  }

  const data = (await response.json()) as ChatCompletionResponse

  if (!response.ok) {
    throw new Error(parseLlmApiError(data, response.status))
  }

  const message = data.choices?.[0]?.message
  if (!message?.content?.trim()) {
    throw new Error('LLM 返回内容为空')
  }

  return message
}
