import type { ParsedParty } from '@/utils/ticketPartyParser'
import { formatPartyLabel } from '@/utils/ticketPartyParser'
import type { PartyProductMatch } from '@/utils/partyProductMatch'

export const TICKET_LIST_PATH = '/tickets'

export function buildPurchaseFallbackMessage(
  match: Extract<PartyProductMatch, { kind: 'no_product' | 'multi_product' }>,
  party: ParsedParty,
  visitDate?: string,
): string {
  const partyPart = formatPartyLabel(party)
  const datePart = visitDate ? `，计划 ${visitDate} 出行` : ''
  const prefix = `根据 ${partyPart}${datePart}，`

  if (match.kind === 'no_product') {
    return `${prefix}当前没有符合规则的可售产品。建议前往购票列表查看其它票种，或调整出行人数后我再帮您推荐。`
  }

  const hint =
    match.plan.length > 1
      ? `已查询到 ${match.plan.map((line) => line.productName).join('、')} 等组合`
      : '已查询到多款产品'
  return `${prefix}${hint}，但智能助手暂不支持购物车合并下单。建议前往购票列表自行组合选购。`
}

export const FALLBACK_COUPON_CAPTION =
  '为您准备了一张购票优享券，可在购票列表下单时使用。'
