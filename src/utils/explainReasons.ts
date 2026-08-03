/**
 * 演示「解释层」：因画像/标签推荐的说明文案。
 * 与产品信息（项目 tags chips、票种 recommendLabel、排队/场次、相对距离等）区分。
 */

const PURE_EXPLAIN_REASON = /^因.+推荐$/

/** 嵌入在「步行约 X 分钟 · 东区 · 因亲子标签推荐」等混合文案中的标签解释 */
const EMBEDDED_PROFILE_EXPLAIN = /\s*·\s*因.+推荐/g

/** 附近关怀置顶的歇脚说明（可单独成段，也可跟在相对距离后面） */
const REST_SPOT_EXPLAIN =
  /(?:^|\s*·\s*)歇脚推荐(?:\s*·\s*美食广场)?(?=\s*·\s*|$)/g

/** 会员权益选品 reason 中的标签片段 */
const MEMBER_TAG_HINT = /\s*·\s*(亲子标签|高价值标签|会员画像)/g

export function isPureExplainReason(reason?: string | null): boolean {
  if (!reason) return false
  const t = reason.trim()
  return PURE_EXPLAIN_REASON.test(t) || /^歇脚推荐/.test(t)
}

function tidyMixedReason(text: string): string {
  return text
    .replace(/\s*·\s*·\s*/g, ' · ')
    .replace(/^\s*·\s*/, '')
    .replace(/\s*·\s*$/, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/**
 * 开关关闭时：纯解释文案整段隐藏；混合文案去掉标签/歇脚说明，保留距离、分区、等级折扣等。
 */
export function filterExplainReason(
  reason: string | undefined | null,
  showExplainReasons: boolean,
): string | undefined {
  if (!reason?.trim()) return undefined
  if (showExplainReasons) return reason

  const raw = reason.trim()
  if (isPureExplainReason(raw)) return undefined

  const stripped = tidyMixedReason(
    raw
      .replace(EMBEDDED_PROFILE_EXPLAIN, '')
      .replace(REST_SPOT_EXPLAIN, '')
      .replace(MEMBER_TAG_HINT, ''),
  )
  return stripped || undefined
}
