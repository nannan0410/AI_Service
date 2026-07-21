import { requestLlmChatCompletion, isLlmAvailable } from '@/ai/llm/client'
import scenic from '@/mock/scenic.json'
import { REVIEW_CONTENT_MAX } from '@/utils/reviewForm'

/** 目标生成字数（约 50 字） */
export const REVIEW_DRAFT_TARGET_CHARS = 50
const REVIEW_DRAFT_MIN_CHARS = 40
const REVIEW_DRAFT_MAX_CHARS = 60

export interface GenerateReviewDraftInput {
  rating?: number
  tags?: string[]
  ticketName?: string
  visitDate?: string
}

const SCENIC_KEYWORDS = [
  '亲子漂流',
  '水上灯光秀',
  '花车巡游',
  '萌宠乐园',
  '美食广场',
  '入园顺畅',
  '夜场氛围',
]

function scenicName(): string {
  return (scenic as { name?: string }).name?.trim() || '欢乐景区'
}

function clampDraft(text: string): string {
  const cleaned = text
    .replace(/^["「『]|["」』]$/g, '')
    .replace(/\s+/g, '')
    .trim()
  if (cleaned.length <= REVIEW_CONTENT_MAX) return cleaned
  return cleaned.slice(0, REVIEW_CONTENT_MAX)
}

/** 无 API Key 或 LLM 失败时的模板草稿（约 50 字） */
export function buildOfflineReviewDraft(input: GenerateReviewDraftInput): string {
  const name = scenicName()
  const ticket = input.ticketName?.trim() || '门票'
  const tags = (input.tags ?? []).slice(0, 3)
  const rating = input.rating && input.rating >= 1 ? input.rating : 5
  const keyword = tags[0] || SCENIC_KEYWORDS[Math.floor(Math.random() * SCENIC_KEYWORDS.length)]

  let draft: string
  if (rating <= 2) {
    draft = `${name}整体一般，${ticket}体验一般，${keyword}还有提升空间，希望后续改进排队与服务。`
  } else if (rating === 3) {
    draft = `${name}体验中规中矩，${ticket}可玩性尚可，${keyword}印象不错，适合周末带娃轻松逛一圈。`
  } else {
    const tagPart = tags.length ? tags.slice(0, 2).join('、') : keyword
    draft = `${name}真不错！${ticket}玩得开心，${tagPart}很加分，灯光秀和美食也很棒，值得再来。`
  }

  return clampDraft(draft).slice(0, REVIEW_DRAFT_MAX_CHARS)
}

function buildPrompt(input: GenerateReviewDraftInput): string {
  const name = scenicName()
  const rating = input.rating && input.rating >= 1 ? input.rating : undefined
  const tags = (input.tags ?? []).filter(Boolean)
  const keywords = [...new Set([...tags, ...SCENIC_KEYWORDS.slice(0, 4)])]

  return [
    `请为「${name}」写一条游客服务点评草稿。`,
    `要求：口语化、真实感；长度约 ${REVIEW_DRAFT_TARGET_CHARS} 字（${REVIEW_DRAFT_MIN_CHARS}-${REVIEW_DRAFT_MAX_CHARS} 字）；不要标题、不要引号、不要表情堆砌；不要编造未提及的具体价格或排队分钟数。`,
    input.ticketName ? `票种/订单：${input.ticketName}` : '',
    input.visitDate ? `游玩日期：${input.visitDate}` : '',
    rating != null ? `用户星级：${rating} 星（请与星级语气一致）` : '用户星级未选，默认正面评价',
    tags.length ? `用户已选标签：${tags.join('、')}` : '',
    `可参考景区关键词（择 1-2 个自然写入）：${keywords.join('、')}`,
    '只输出评价正文。',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * 生成点评草稿：优先 LLM；无 Key / 失败时用模板。
 */
export async function generateReviewDraft(
  input: GenerateReviewDraftInput,
): Promise<{ text: string; source: 'llm' | 'offline' }> {
  if (!isLlmAvailable()) {
    return { text: buildOfflineReviewDraft(input), source: 'offline' }
  }

  try {
    const message = await requestLlmChatCompletion(
      [
        {
          role: 'system',
          content:
            '你是景区点评助手，只输出一条简短中文评价正文，不要解释、不要列表。',
        },
        { role: 'user', content: buildPrompt(input) },
      ],
      {
        temperature: 0.7,
        maxTokens: 120,
        timeoutMs: 20000,
      },
    )

    const text = clampDraft(String(message.content ?? ''))
    if (text.length < 12) {
      return { text: buildOfflineReviewDraft(input), source: 'offline' }
    }
    // 过长时压到约 60 字，避免占满输入框
    const trimmed =
      text.length > REVIEW_DRAFT_MAX_CHARS
        ? text.slice(0, REVIEW_DRAFT_MAX_CHARS)
        : text
    return { text: trimmed, source: 'llm' }
  } catch {
    return { text: buildOfflineReviewDraft(input), source: 'offline' }
  }
}
