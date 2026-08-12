export interface ParsedParty {
  adult: number
  child: number
  elderly: number
}

const EMPTY_PARTY: ParsedParty = { adult: 0, child: 0, elderly: 0 }

function parseChineseNumeral(text: string): number | null {
  const map: Record<string, number> = {
    一: 1,
    两: 2,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  }
  if (/^\d+$/.test(text)) return Number(text)
  if (text in map) return map[text]
  if (text === '十') return 10
  return null
}

/** 从用户消息解析出行人数（老人计入 adult 统计用 elderly 字段） */
export function parsePartyFromMessage(message: string): Partial<ParsedParty> {
  const result: Partial<ParsedParty> = {}

  const bundle = message.match(/(?:2|两|二)\s*大\s*(?:1|一)\s*小/)
  if (bundle) {
    return { adult: 2, child: 1, elderly: 0 }
  }

  const generalBundle = message.match(
    /(\d+|[两二三四五六七八九])\s*大\s*(\d+|[两二三四五六七八九])\s*小/,
  )
  if (generalBundle) {
    const adult = parseChineseNumeral(generalBundle[1])
    const child = parseChineseNumeral(generalBundle[2])
    if (adult != null && child != null) {
      return { adult, child, elderly: 0 }
    }
  }

  const adultMatch = message.match(/(\d+|[两二三四五六七八九])\s*(?:位|个)?\s*(?:大人|成人|成年人)/)
  if (adultMatch) {
    const n = parseChineseNumeral(adultMatch[1])
    if (n) result.adult = n
  }

  const childMatch = message.match(/(\d+|[两二三四五六七八九])\s*(?:位|个)?\s*(?:小孩|儿童|孩子|小朋友)/)
  if (childMatch) {
    const n = parseChineseNumeral(childMatch[1])
    if (n) result.child = n
  }

  const elderlyMatch = message.match(/(\d+|[两二三四五六七八九])\s*(?:位|个)?\s*(?:老人|长辈|父母|爸妈)/)
  if (elderlyMatch) {
    const n = parseChineseNumeral(elderlyMatch[1])
    if (n) result.elderly = n
  }

  if (/没有小孩|无小孩|不带小孩|没小孩|无儿童|没有儿童/.test(message)) {
    result.child = 0
  }

  if (/没有老人|无老人|不带老人/.test(message)) {
    result.elderly = 0
  }

  const totalMatch = message.match(/(\d+|[两二三四五六七八九十])\s*个?\s*人(?:出行|去|玩)?/)
  if (totalMatch && !result.adult && !result.child && !result.elderly) {
    const n = parseChineseNumeral(totalMatch[1])
    if (n && n > 0) result.adult = n
  }

  if (/独自|一个人|单人|就我/.test(message)) {
    return { adult: 1, child: 0, elderly: 0 }
  }

  return result
}

export function mergeParty(
  base: ParsedParty,
  patch: Partial<ParsedParty>,
  message = '',
): ParsedParty {
  const normalized = normalizePartyRestatement(patch, message)
  return {
    adult: normalized.adult ?? base.adult,
    child: normalized.child ?? base.child,
    elderly: normalized.elderly ?? base.elderly,
  }
}

function hasAnyPartyField(patch: Partial<ParsedParty>): boolean {
  return patch.adult != null || patch.child != null || patch.elderly != null
}

/**
 * 用户重报出行构成时，未点名的角色应清零，避免上一轮儿童/老人粘滞。
 * 例：「1个成人1个老人」不得保留上一轮的 child=1。
 */
export function normalizePartyRestatement(
  patch: Partial<ParsedParty>,
  message: string,
): Partial<ParsedParty> {
  if (!hasAnyPartyField(patch)) return patch

  const next: Partial<ParsedParty> = { ...patch }
  const text = message.trim()
  const touchedAdult = patch.adult != null
  const touchedChild = patch.child != null
  const touchedElderly = patch.elderly != null
  const roleTouches = [touchedAdult, touchedChild, touchedElderly].filter(Boolean).length

  const mentionsChildWord =
    /小孩|儿童|孩子|小朋友|\d+\s*小|没有小孩|无儿童|没小孩|不带小孩/.test(text)
  const mentionsElderlyWord = /老人|长辈|父母|爸妈|没有老人|无老人|不带老人/.test(text)

  // 本轮点名 ≥2 类人数：未写入的角色视为 0
  if (roleTouches >= 2) {
    if (!touchedAdult) next.adult = 0
    if (!touchedChild) next.child = 0
    if (!touchedElderly) next.elderly = 0
    return next
  }

  // 仅报成人且未提儿童/老人 → 清儿童与老人（「3个成人」）
  if (
    touchedAdult &&
    !touchedChild &&
    !touchedElderly &&
    !mentionsChildWord &&
    !mentionsElderlyWord
  ) {
    next.child = 0
    next.elderly = 0
  }

  // 仅报老人 → 清儿童；未提成人则成人归零
  if (touchedElderly && !touchedChild && !mentionsChildWord) {
    next.child = 0
    if (!touchedAdult) next.adult = 0
  }

  // 仅报儿童 → 清老人
  if (touchedChild && !touchedElderly && !mentionsElderlyWord) {
    next.elderly = 0
  }

  return next
}

export function isPartyComplete(party: ParsedParty): boolean {
  const total = party.adult + party.child + party.elderly
  return total > 0
}

export function getEffectiveAdultCount(party: ParsedParty): number {
  return party.adult + party.elderly
}

export function formatPartyLabel(party: ParsedParty): string {
  const adult = getEffectiveAdultCount(party)
  const child = party.child
  const total = adult + child
  const parts: string[] = []
  if (adult) parts.push(`${adult} 成人`)
  if (child) parts.push(`${child} 儿童`)
  if (party.elderly) parts.push(`含 ${party.elderly} 位老人`)
  return `${parts.join(' · ')}，共 ${total} 人`
}

export function emptyParty(): ParsedParty {
  return { ...EMPTY_PARTY }
}

export function looksLikePartyIntent(message: string): boolean {
  return (
    /两大一小|2大1小|大人|成人|儿童|小孩|老人|长辈|几位|几人|多少人|出行|个人去/.test(message) ||
    /(\d+|[两二三四五六七八九十])\s*个?\s*人/.test(message)
  )
}
