import { fetchCoupons, fetchMemberInfo, fetchTicketProducts } from '@/api/business'
import { shouldRunMemberOfferWorkflow } from '@/utils/memberOfferIntent'
import { pickMemberOffers, type MemberOfferPick } from '@/utils/memberOfferRecommend'
import { buildCouponRecommendChatResult } from '@/utils/couponRecommend'
import { resolveTagsForPersona } from '@/utils/demoRuleContext'
import { DEFAULT_SCENIC_ID } from '@/utils/scenicScope'
import { useAuthStore } from '@/store/authStore'
import { useScenicStore } from '@/store/scenicStore'
import type { PurchaseSession } from '@/store/purchaseStore'
import type {
  ChatMessageDraft,
  Coupon,
  LlmChatResult,
  TicketCardPayload,
  TicketProduct,
  ToolExecutionCallbacks,
} from '@/types'

export { shouldRunMemberOfferWorkflow }

async function unwrapApi<T>(
  request: Promise<{ data: { code: number; data: T; message?: string } }>,
): Promise<T> {
  const { data: res } = await request
  if (res.code !== 200) throw new Error(res.message || '请求失败')
  return res.data
}

function nextQuoteToken(): string {
  return `quote_${Date.now()}`
}

function defaultVisitDate(daysAhead = 7): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + daysAhead)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatTagLine(tags: string[]): string {
  const labels: string[] = []
  if (tags.includes('family')) labels.push('亲子')
  if (tags.includes('high_value')) labels.push('高价值')
  if (tags.includes('new_guest')) labels.push('新客')
  return labels.length ? `，标签：${labels.join(' / ')}` : ''
}

function buildTicketPayload(
  pick: MemberOfferPick,
  session: PurchaseSession,
  combinedDiscount: number,
): TicketCardPayload {
  const isAdultTicket = pick.product.ticketTypeId === 'adult'
  const purchaseCount = isAdultTicket ? Math.max(pick.quantity.adult, 1) : 1
  const purchaseUnit: '张' | '套' = isAdultTicket ? '张' : '套'
  return {
    productId: pick.product.productId,
    ticketType: pick.product.ticketTypeId ?? 'adult',
    ticketName: pick.product.name,
    quantity: pick.quantity,
    unitPrice: pick.product.price,
    purchaseCount,
    purchaseUnit,
    originalAmount: pick.listAmount,
    totalAmount: pick.payAmount,
    discountAmount: combinedDiscount || undefined,
    couponId: pick.coupon?.couponId,
    recommendedReason: pick.reason,
    visitDate: session.visitDate,
    status: 'quote',
    sessionId: session.sessionId,
    quoteToken: session.quoteToken,
    footerHint:
      '以上为会员权益组合价。如需调整人数或日期可直接告诉我；确认请点「确认并生成订单」。',
  }
}

export async function runMemberOfferWorkflow(
  _message: string,
  session: PurchaseSession,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const authStore = useAuthStore()
  const scenicStore = useScenicStore()
  const scenicId = scenicStore.currentScenicId || DEFAULT_SCENIC_ID
  const personaId = authStore.personaId ?? 'demo_vip'
  const tags = resolveTagsForPersona(personaId)

  callbacks?.onToolStart?.('getMemberInfo', '查询会员等级与权益')
  let memberLevel: string | undefined
  try {
    const member = await unwrapApi(fetchMemberInfo())
    memberLevel = member.level
    callbacks?.onToolDone?.('getMemberInfo', true)
  } catch {
    callbacks?.onToolDone?.('getMemberInfo', false)
  }

  callbacks?.onToolStart?.('getProductCatalog', '筛选景区可售票品')
  let products: TicketProduct[] = []
  try {
    products = await unwrapApi(fetchTicketProducts('self'))
    callbacks?.onToolDone?.('getProductCatalog', true)
  } catch {
    callbacks?.onToolDone?.('getProductCatalog', false)
    return {
      content: '暂时无法获取门票产品，请稍后再试。',
      skillId: 'member_offer',
    }
  }

  callbacks?.onToolStart?.('getCoupons', '匹配可用优惠券')
  let coupons: Coupon[] = []
  try {
    coupons = await unwrapApi(fetchCoupons('available'))
    callbacks?.onToolDone?.('getCoupons', true)
  } catch {
    callbacks?.onToolDone?.('getCoupons', false)
  }

  const picks = pickMemberOffers({
    products,
    coupons,
    tags,
    memberLevel,
    scenicId,
    limit: 1,
  })

  if (!picks.length) {
    return {
      content:
        '当前景区暂无可匹配的会员组合票品。会员权益选品演示票挂在上海奇趣乐园，请切换景区后再试，或直接说「买票」。',
      skillId: 'member_offer',
    }
  }

  const primary = picks[0]
  if (!session.visitDate) {
    session.visitDate = defaultVisitDate(7)
  }
  session.party = {
    adult: primary.quantity.adult,
    child: primary.quantity.child,
    elderly: 0,
  }
  session.productId = primary.product.productId
  session.couponId = primary.coupon?.couponId
  session.step = 'recommend'
  session.quoteToken = nextQuoteToken()

  const intro = `${
    memberLevel ? `已识别您为「${memberLevel}」` : '已根据会员画像'
  }${formatTagLine(tags)}。为您推荐以下「等级折扣 + 可用券 + 标签票品」组合：`

  const cards: ChatMessageDraft[] = []

  const offerCoupons = picks
    .map((p) => p.coupon)
    .filter((c): c is Coupon => Boolean(c))
  const uniqueCoupons = [
    ...new Map(offerCoupons.map((c) => [c.couponId, c])).values(),
  ]
  if (uniqueCoupons.length) {
    const couponResult = buildCouponRecommendChatResult(
      '可叠加的会员专属优惠：',
      uniqueCoupons,
    )
    if (couponResult.cards?.length) {
      cards.push(...couponResult.cards)
    }
  }

  picks.forEach((pick, index) => {
    const combinedDiscount =
      pick.memberDiscountAmount + pick.couponDiscountAmount
    cards.push({
      type: 'ticket',
      role: 'assistant',
      content: index === 0 ? intro : undefined,
      payload: buildTicketPayload(pick, session, combinedDiscount),
    })
  })

  return {
    content: '',
    skillId: 'member_offer',
    toolCallsUsed: ['getMemberInfo', 'getProductCatalog', 'getCoupons'],
    cards,
  }
}
