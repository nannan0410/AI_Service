import type { ParsedParty } from '@/utils/ticketPartyParser'
import ticketEligibilityDefaults from '@/mock/scenic/ticket_eligibility.json'

export interface TicketEligibilityConfig {
  scenicId: string
  /** 身高 ≤ 该值（cm）可买儿童票 */
  childMaxHeightCm: number
  /** 已满该周岁可买老人票 */
  elderMinAgeYears: number
}

const STORAGE_KEY = 'scenic_ticket_eligibility_override'

const DEFAULTS: Omit<TicketEligibilityConfig, 'scenicId'> = {
  childMaxHeightCm: 120,
  elderMinAgeYears: 60,
}

type OverrideMap = Record<
  string,
  Partial<Pick<TicketEligibilityConfig, 'childMaxHeightCm' | 'elderMinAgeYears'>>
>

function readOverrides(): OverrideMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as OverrideMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function getTicketEligibilityOverride(
  scenicId: string,
): Partial<Pick<TicketEligibilityConfig, 'childMaxHeightCm' | 'elderMinAgeYears'>> {
  return readOverrides()[scenicId] ?? {}
}

export function saveTicketEligibilityOverride(
  scenicId: string,
  patch: Partial<Pick<TicketEligibilityConfig, 'childMaxHeightCm' | 'elderMinAgeYears'>>,
): void {
  const all = readOverrides()
  all[scenicId] = { ...all[scenicId], ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function clearTicketEligibilityOverride(scenicId?: string): void {
  if (!scenicId) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  const all = readOverrides()
  delete all[scenicId]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function resolveTicketEligibilityConfig(
  scenicId: string | null | undefined,
): TicketEligibilityConfig {
  const id = scenicId?.trim() || 'scenic_hlg'
  const fromMock = (ticketEligibilityDefaults as TicketEligibilityConfig[]).find(
    (item) => item.scenicId === id,
  )
  const override = getTicketEligibilityOverride(id)
  return {
    scenicId: id,
    childMaxHeightCm:
      override.childMaxHeightCm ??
      fromMock?.childMaxHeightCm ??
      DEFAULTS.childMaxHeightCm,
    elderMinAgeYears:
      override.elderMinAgeYears ??
      fromMock?.elderMinAgeYears ??
      DEFAULTS.elderMinAgeYears,
  }
}

/** 将资格答覆写为有效购票人数（超限儿童/未达龄老人并入成人） */
export function applyPartyEligibility(
  party: ParsedParty,
  answers: {
    childHeightOk?: boolean | null
    elderAgeOk?: boolean | null
  },
): ParsedParty {
  let adult = party.adult
  let child = party.child
  let elderly = party.elderly

  if (child > 0 && answers.childHeightOk === false) {
    adult += child
    child = 0
  }
  if (elderly > 0 && answers.elderAgeOk === false) {
    adult += elderly
    elderly = 0
  }

  return { adult, child, elderly }
}

export function buildChildHeightQuestion(maxHeightCm: number): string {
  return `同行儿童身高是否不超过 ${maxHeightCm} cm？符合则可购儿童票。`
}

export function buildElderAgeQuestion(minAgeYears: number): string {
  return `同行老人是否已满 ${minAgeYears} 周岁？满龄可购老人票。`
}

export const CHILD_OVER_LIMIT_CAPTION =
  '由于身高超过儿童购票限制，推荐购买成人票。'

export const ELDER_UNDER_AGE_CAPTION =
  '未满年龄要求，推荐购买成人票。'
