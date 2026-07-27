/** 演示版：对话关键词 → 封闭目录 AI 标签（正式版改为 LLM 映射到同一目录） */

export type AiChatPreferenceTagId =
  | 'prefer_thrill'
  | 'prefer_photo'
  | 'prefer_slow'

export interface AiChatTagMatch {
  tagId: AiChatPreferenceTagId
  /** 命中的关键词，写入 evidence */
  keyword: string
  label: string
}

const THRILL_RE = /刺激/
const PHOTO_RE = /拍照|出片/
const SLOW_RE = /休闲/

/** 从用户话术匹配偏好标签（固定词，演示用） */
export function matchAiChatPreference(message: string): AiChatTagMatch | null {
  const text = message.trim()
  if (!text) return null

  // 互斥对：同时出现时以后写的意图为准（句子更靠后的优先）
  const hits: Array<{ tagId: AiChatPreferenceTagId; keyword: string; label: string; index: number }> =
    []

  const thrillIdx = text.search(THRILL_RE)
  if (thrillIdx >= 0) {
    hits.push({
      tagId: 'prefer_thrill',
      keyword: '刺激',
      label: '喜欢刺激',
      index: thrillIdx,
    })
  }
  const photoIdx = text.search(PHOTO_RE)
  if (photoIdx >= 0) {
    const keyword = /出片/.test(text) ? '出片' : '拍照'
    hits.push({
      tagId: 'prefer_photo',
      keyword,
      label: '偏好拍照',
      index: photoIdx,
    })
  }
  const slowIdx = text.search(SLOW_RE)
  if (slowIdx >= 0) {
    hits.push({
      tagId: 'prefer_slow',
      keyword: '休闲',
      label: '慢节奏',
      index: slowIdx,
    })
  }

  if (!hits.length) return null

  // 刺激 vs 休闲：取更靠后出现的；拍照可并存，若本句只有拍照则返回拍照
  const thrillOrSlow = hits
    .filter((h) => h.tagId === 'prefer_thrill' || h.tagId === 'prefer_slow')
    .sort((a, b) => b.index - a.index)[0]
  const photo = hits.find((h) => h.tagId === 'prefer_photo')

  // 单句同时有刺激/休闲与拍照：优先写刺激或休闲（主偏好），拍照留给「只提拍照」或单独一句
  if (thrillOrSlow && photo) {
    // 若拍照出现更晚且句子短，也可写拍照；演示策略：主偏好优先
    return {
      tagId: thrillOrSlow.tagId,
      keyword: thrillOrSlow.keyword,
      label: thrillOrSlow.label,
    }
  }
  if (thrillOrSlow) {
    return {
      tagId: thrillOrSlow.tagId,
      keyword: thrillOrSlow.keyword,
      label: thrillOrSlow.label,
    }
  }
  if (photo) {
    return { tagId: photo.tagId, keyword: photo.keyword, label: photo.label }
  }
  return null
}

/**
 * 是否以「表态偏好」为主、可单独确认（不强行抢其它业务）
 * 例：「我喜欢刺激」「想休闲一点」「想出片」
 */
export function isAiChatPreferencePrimary(message: string): boolean {
  const match = matchAiChatPreference(message)
  if (!match) return false
  const text = message.trim()
  // 含明确其它业务线索则不当作纯偏好
  if (
    /附近|在哪|地图|排队|购票|买票|攻略|交通|入园|领券|发票|打卡(?!点)|订单|天气|适合游玩/.test(
      text,
    )
  ) {
    return false
  }
  if (/项目|好玩|推荐|过山车|漂流|怎么玩|路线/.test(text) && text.length > 12) {
    return false
  }
  return (
    text.length <= 24 ||
    /喜欢|想要|想玩|偏好|比较|一点|一些|为主/.test(text)
  )
}

export function buildAiChatTagConfirmText(match: AiChatTagMatch): string {
  return `已记下您的偏好「${match.label}」（关键词：${match.keyword}）。后续推荐会优先参考该标签；正式版将由 LLM 把「惊险」等说法归一到同一目录。`
}
