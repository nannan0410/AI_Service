const WEEKDAY_MAP: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** 区间内距 reference 最近且严格晚于 reference 的日期 */
function nearestFutureInRange(
  rangeStart: Date,
  rangeEnd: Date,
  reference: Date,
): Date | null {
  const ref = startOfDay(reference)
  let cursor = startOfDay(rangeStart)
  const end = startOfDay(rangeEnd)
  let candidate: Date | null = null

  while (cursor <= end) {
    if (cursor > ref && !isSameDay(cursor, ref)) {
      if (!candidate || cursor < candidate) {
        candidate = cursor
      }
    }
    cursor = addDays(cursor, 1)
  }
  return candidate
}

function parseExplicitDate(message: string, today: Date): string | null {
  const iso = message.match(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})/)
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    if (!isSameDay(date, today) && date > today) return formatDate(date)
    if (!isSameDay(date, today) && date <= today) return null
  }

  const md = message.match(/(\d{1,2})[-/月](\d{1,2})日?/)
  if (md) {
    const date = new Date(today.getFullYear(), Number(md[1]) - 1, Number(md[2]))
    if (!isSameDay(date, today) && date > today) return formatDate(date)
  }

  return null
}

function getThisWeekendRange(ref: Date): { saturday: Date; sunday: Date } {
  const day = ref.getDay()
  const saturdayOffset = day === 6 ? 0 : day === 0 ? -1 : 6 - day
  const saturday = addDays(ref, saturdayOffset)
  return { saturday, sunday: addDays(saturday, 1) }
}

function getNextWeekendRange(ref: Date): { saturday: Date; sunday: Date } {
  const day = ref.getDay()
  const daysUntilNextSaturday = ((6 - day + 7) % 7) + 7
  const saturday = addDays(ref, daysUntilNextSaturday)
  return { saturday, sunday: addDays(saturday, 1) }
}

const MONTH_CN_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
}

const ORDINAL_CN_MAP: Record<string, number> = {
  一: 1,
  两: 1,
  二: 2,
  三: 3,
  四: 4,
}

function parseMonthToken(text: string): number | null {
  if (/^\d{1,2}$/.test(text)) {
    const n = Number(text)
    return n >= 1 && n <= 12 ? n : null
  }
  if (text in MONTH_CN_MAP) return MONTH_CN_MAP[text]
  return null
}

function parseOrdinalToken(text: string): number | null {
  if (/^\d$/.test(text)) {
    const n = Number(text)
    return n >= 1 && n <= 4 ? n : null
  }
  return ORDINAL_CN_MAP[text] ?? null
}

/** 某月第 N 个周末（以当月第 N 个周六为起点） */
function getNthWeekendInMonth(
  year: number,
  month: number,
  nth: number,
): { saturday: Date; sunday: Date } | null {
  if (nth < 1) return null
  let count = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    if (date.getDay() === 6) {
      count++
      if (count === nth) {
        return { saturday: date, sunday: addDays(date, 1) }
      }
    }
  }
  return null
}

/** 如「8月第一个周末」「八月第二个周末」 */
function parseMonthOrdinalWeekend(
  message: string,
  today: Date,
): { saturday: Date; sunday: Date } | null {
  const match = message.match(
    /(\d{1,2}|十[一二]?|十一|十二|[一二三四五六七八九])月\s*第\s*([一两二三四1-4])\s*个?\s*周末/,
  )
  if (!match) return null

  const month = parseMonthToken(match[1])
  const nth = parseOrdinalToken(match[2])
  if (!month || !nth) return null

  const ref = startOfDay(today)
  let year = ref.getFullYear()
  if (month < ref.getMonth() + 1) {
    year += 1
  }

  let range = getNthWeekendInMonth(year, month, nth)
  if (!range) return null

  if (startOfDay(range.sunday) <= ref) {
    range = getNthWeekendInMonth(year + 1, month, nth)
  }
  return range
}

function parseFuzzyRange(message: string, today: Date): Date | null {
  const ref = startOfDay(today)

  if (/明后天|后明/.test(message)) {
    return nearestFutureInRange(addDays(ref, 2), addDays(ref, 3), ref)
  }
  if (/明天|明儿|次日/.test(message)) {
    const d = addDays(ref, 1)
    return isSameDay(d, ref) ? null : d
  }
  if (/后天/.test(message)) {
    const d = addDays(ref, 2)
    return isSameDay(d, ref) ? null : d
  }

  // 下周末须先于「周末」匹配，避免「下个周末」误命中这周末
  if (/下周末|下个周末/.test(message)) {
    const { saturday, sunday } = getNextWeekendRange(ref)
    return nearestFutureInRange(saturday, sunday, ref)
  }

  if (/这周末|本周末|这个周末/.test(message)) {
    const { saturday, sunday } = getThisWeekendRange(ref)
    return nearestFutureInRange(saturday, sunday, ref)
  }

  // 「N月第M个周末」须先于泛化「周末」，避免误解析为这周末
  const monthWeekend = parseMonthOrdinalWeekend(message, ref)
  if (monthWeekend) {
    return nearestFutureInRange(monthWeekend.saturday, monthWeekend.sunday, ref)
  }

  // 单独「周末」= 这周末（走到此处时已排除下周末与某月第N周末）
  if (/周末/.test(message)) {
    const { saturday, sunday } = getThisWeekendRange(ref)
    return nearestFutureInRange(saturday, sunday, ref)
  }

  // 下周（排除下周末）；下个星期 = 下一自然周
  if (/下周(?!末)|下礼拜|下个星期/.test(message)) {
    const day = ref.getDay() || 7
    const monday = addDays(ref, 8 - day)
    const sunday = addDays(monday, 6)
    return nearestFutureInRange(monday, sunday, ref)
  }

  if (/这周|本周|这个星期/.test(message)) {
    const day = ref.getDay() || 7
    const monday = addDays(ref, 1 - day)
    const sunday = addDays(monday, 6)
    return nearestFutureInRange(ref, sunday, ref)
  }

  const weekdayMatch = message.match(/周([日天一二三四五六])|星期([日天一二三四五六])/)
  if (weekdayMatch) {
    const target = WEEKDAY_MAP[weekdayMatch[1] || weekdayMatch[2]]
    const current = ref.getDay()
    let offset = (target - current + 7) % 7
    if (offset === 0) offset = 7
    const date = addDays(ref, offset)
    return isSameDay(date, ref) ? null : date
  }

  return null
}

/** 校验 LLM 等返回的 ISO 日期：须为 YYYY-MM-DD 且严格晚于今天 */
export function validateIsoVisitDate(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso || typeof iso !== 'string') return null
  const trimmed = iso.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null

  const [y, m, d] = trimmed.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null
  }

  const today = startOfDay(now)
  if (date <= today) return null
  return trimmed
}

/** 从用户消息解析出行日期；模糊时段取距今天最近且不可为当日 */
export function parseVisitDateFromMessage(message: string, now = new Date()): string | null {
  const today = startOfDay(now)
  const explicit = parseExplicitDate(message, today)
  if (explicit) return explicit

  const fuzzy = parseFuzzyRange(message, today)
  if (fuzzy) return formatDate(fuzzy)

  return null
}

export function looksLikeDateIntent(message: string): boolean {
  return (
    /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})|(\d{1,2}[-/月]\d{1,2})/.test(message) ||
    /(\d{1,2}|十[一二]?|十一|十二|[一二三四五六七八九])月\s*第\s*[一两二三四1-4]\s*个?\s*周末/.test(
      message,
    ) ||
    /明后天|明天|后天|下周末|下个周末|这周末|本周末|周末|下周|这周|星期|周[日天一二三四五六]|出行日期|什么时候去|几号/.test(
      message,
    )
  )
}
