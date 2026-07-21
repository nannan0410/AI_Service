/** 今日 / 明日 / 演出推荐等 → 演出场次 Workflow */
export function shouldRunShowScheduleWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return (
    /下一场.{0,8}(演出|表演|秀)/.test(text) ||
    /(今天|今日|明天|后天).{0,16}(演出|表演)/.test(text) ||
    /演出.{0,8}(安排|时间|场次|几点|开始|吗|推荐|项目)/.test(text) ||
    /(推荐|介绍).{0,8}(演出|表演|秀)/.test(text) ||
    /(有没有|有哪些|有什么|啥).{0,8}(演出|表演)/.test(text) ||
    /(灯光秀|花车|巡游|水上秀).{0,8}(几点|开始|时间|吗|推荐)/.test(text) ||
    /^(演出|表演)推荐$/.test(text) ||
    /^今天有哪些演出/.test(text)
  )
}

/** today=当日场次；tomorrow/day_after=指定日；general=未指定日期的项目推荐 */
export type ShowDayKind = 'today' | 'tomorrow' | 'day_after' | 'general'

/** 从用户说法解析查询哪一天的演出（演示：场次表按日复用） */
export function resolveShowDayKind(message: string): ShowDayKind {
  const text = message.trim()
  if (/后天/.test(text)) return 'day_after'
  if (/明天/.test(text)) return 'tomorrow'
  if (/今天|今日/.test(text)) return 'today'
  // 「演出推荐」等未点名日期 → 按项目推荐（非当日下一场逻辑）
  if (
    /推荐|介绍|项目/.test(text) ||
    /(有哪些|有什么|看看).{0,8}(演出|表演)/.test(text) ||
    /^(演出|表演)$/.test(text)
  ) {
    return 'general'
  }
  // 「下一场」「有没有演出」等默认按今日
  return 'today'
}

export function showDayLabel(kind: ShowDayKind): string {
  if (kind === 'tomorrow') return '明天'
  if (kind === 'day_after') return '后天'
  if (kind === 'general') return '园区'
  return '今日'
}
