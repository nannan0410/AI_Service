import {
  hasPartyPatch,
  resolvePurchaseSlotsFromMessage,
} from '@/ai/nlu/resolvePurchaseSlots'
import {
  formatPartyLabel,
  isPartyComplete,
  mergeParty,
} from '@/utils/ticketPartyParser'
import { isTicketConfirmIntent } from '@/utils/ticketPurchaseIntent'
import type {
  ChatMessageDraft,
  Coupon,
  CouponCardPayload,
  LlmChatResult,
  OrderLineItem,
  PersonaId,
  TicketCardPayload,
  TicketEligibilityCardPayload,
  TicketFallbackPayload,
  ToolExecutionCallbacks,
} from '@/types'
import type { PurchaseSession } from '@/store/purchaseStore'
import { fetchCoupons, fetchTicketProducts, issueCoupon } from '@/api/business'
import {
  buildRecommendReason,
  type TicketRecommendation,
} from './recommend'
import type { ToolCallRecord } from '@/ai/tools/formatters'
import { pickBestCoupon } from '@/utils/couponDiscount'
import {
  PURCHASE_MARKETING_COUPON_PRODUCT_ID,
  hasPurchaseMarketingSlot,
  shouldPushPurchaseMarketingCoupon,
} from '@/utils/purchaseMarketing'
import {
  matchPartyToProducts,
  type CartRecommendation,
} from '@/utils/partyProductMatch'
import {
  FALLBACK_COUPON_CAPTION,
  buildPurchaseFallbackMessage,
  TICKET_LIST_PATH,
} from '@/utils/purchaseFallbackCopy'
import {
  FALLBACK_PURCHASE_COUPON_PRODUCT_ID,
  findFallbackPurchaseCoupon,
} from '@/utils/purchaseFallbackCoupon'
import {
  applyPartyEligibility,
  buildChildHeightQuestion,
  buildElderAgeQuestion,
  CHILD_OVER_LIMIT_CAPTION,
  ELDER_UNDER_AGE_CAPTION,
  resolveTicketEligibilityConfig,
} from '@/utils/ticketEligibility'
import { useScenicStore } from '@/store/scenicStore'

export {
  isTicketPurchaseIntent,
  shouldRunTicketWorkflow,
} from '@/utils/ticketPurchaseIntent'

async function unwrapApi<T>(request: Promise<{ data: { code: number; data: T; message?: string } }>): Promise<T> {
  const { data: res } = await request
  if (res.code !== 200) throw new Error(res.message || '请求失败')
  return res.data
}

function nextQuoteToken(): string {
  return `quote_${Date.now()}`
}

function cartLinesToOrderItems(recommendation: CartRecommendation): OrderLineItem[] {
  return recommendation.lines.map((line) => ({
    productId: line.productId,
    productName: line.productName,
    ticketType: (line.ticketTypeId as OrderLineItem['ticketType']) ?? 'adult',
    unitPrice: line.unitPrice,
    purchaseCount: line.purchaseCount,
    purchaseUnit: line.purchaseUnit,
    quantity: { ...line.quantity },
    lineAmount: line.lineAmount,
  }))
}

function buildTicketCardPayload(
  recommendation: TicketRecommendation,
  session: PurchaseSession,
  pricing: { originalAmount: number; payAmount: number; discountAmount: number; couponId?: string },
): TicketCardPayload {
  const isAdultTicket = recommendation.product.ticketTypeId === 'adult'
  const isChildTicket = recommendation.product.ticketTypeId === 'child'
  const isElderTicket = recommendation.product.ticketTypeId === 'elderly'
  const purchaseCount = isAdultTicket
    ? Math.max(recommendation.quantity.adult, 1)
    : isChildTicket
      ? Math.max(recommendation.quantity.child, 1)
      : isElderTicket
        ? Math.max(recommendation.quantity.adult, 1)
        : 1
  const purchaseUnit: '张' | '套' =
    isAdultTicket || isChildTicket || isElderTicket ? '张' : '套'

  return {
    productId: recommendation.product.productId,
    ticketType: recommendation.product.ticketTypeId ?? 'adult',
    ticketName: recommendation.product.name,
    quantity: recommendation.quantity,
    items: [
      {
        productId: recommendation.product.productId,
        productName: recommendation.product.name,
        ticketType: recommendation.product.ticketTypeId ?? 'adult',
        unitPrice: recommendation.product.price,
        purchaseCount,
        purchaseUnit,
        quantity: { ...recommendation.quantity },
        lineAmount: recommendation.originalAmount,
      },
    ],
    unitPrice: recommendation.product.price,
    purchaseCount,
    purchaseUnit,
    originalAmount: pricing.originalAmount,
    totalAmount: pricing.payAmount,
    discountAmount: pricing.discountAmount || undefined,
    couponId: pricing.couponId,
    recommendedReason: buildRecommendReason(recommendation),
    visitDate: session.visitDate,
    status: 'quote',
    sessionId: session.sessionId,
    quoteToken: session.quoteToken,
  }
}

function buildCartTicketCardPayload(
  recommendation: CartRecommendation,
  session: PurchaseSession,
  pricing: { originalAmount: number; payAmount: number; discountAmount: number; couponId?: string },
): TicketCardPayload {
  const items = cartLinesToOrderItems(recommendation)
  return {
    productId: items[0]?.productId,
    ticketType: items.length === 1 ? items[0].ticketType : 'adult',
    ticketName: recommendation.title,
    quantity: recommendation.partyQuantity,
    items,
    originalAmount: pricing.originalAmount,
    totalAmount: pricing.payAmount,
    discountAmount: pricing.discountAmount || undefined,
    couponId: pricing.couponId,
    recommendedReason: recommendation.recommendTag,
    visitDate: session.visitDate,
    status: 'quote',
    sessionId: session.sessionId,
    quoteToken: session.quoteToken,
  }
}

export const TICKET_RECOMMEND_FOOTER_HINT =
  '如需调整人数或日期，直接告诉我就好；没有问题请直接确认噢。'

export function buildTicketRecommendIntro(
  session: PurchaseSession,
  captionPrefix?: string,
): string {
  if (captionPrefix) return captionPrefix
  const partyLabel = formatPartyLabel(session.party)
  const datePart = session.visitDate ? `、计划 ${session.visitDate} 出行` : ''
  return `根据 ${partyLabel}${datePart}，为您推荐以下产品。`
}

async function loadPricingByAmount(
  originalAmount: number,
  callbacks?: ToolExecutionCallbacks,
): Promise<{
  originalAmount: number
  payAmount: number
  discountAmount: number
  couponId?: string
  coupons: Coupon[]
}> {
  callbacks?.onToolStart?.('getCoupons', '查询可用优惠券')
  const coupons = await unwrapApi(fetchCoupons('available'))
  callbacks?.onToolDone?.('getCoupons', true)

  const best = pickBestCoupon(coupons, originalAmount)
  const discountAmount = best?.discountAmount ?? 0
  const payAmount = Math.max(originalAmount - discountAmount, 0)

  return {
    originalAmount,
    payAmount,
    discountAmount,
    couponId: best?.coupon.couponId,
    coupons,
  }
}

async function maybeIssueMarketingCoupon(
  session: PurchaseSession,
  coupons: Coupon[],
  callbacks?: ToolExecutionCallbacks,
): Promise<{ coupons: Coupon[]; marketingCard?: ChatMessageDraft }> {
  if (session.marketingIssued || !shouldPushPurchaseMarketingCoupon(coupons)) {
    return { coupons }
  }

  callbacks?.onToolStart?.('issueCoupon', '发放购票优惠券')
  try {
    const coupon = await unwrapApi(issueCoupon(PURCHASE_MARKETING_COUPON_PRODUCT_ID, 'purchase'))
    callbacks?.onToolDone?.('issueCoupon', true)
    session.marketingIssued = true

    const refreshed = await unwrapApi(fetchCoupons('available'))
    const payload: CouponCardPayload = {
      couponId: coupon.couponId,
      title: coupon.title,
      type: coupon.type,
      value: coupon.value,
      condition: coupon.condition,
      expireAt: coupon.expireAt,
      status: coupon.status,
      action: 'use',
    }
    return {
      coupons: refreshed,
      marketingCard: {
        type: 'coupon',
        role: 'assistant',
        content: '为您送上一张购票优惠券，下单时可自动抵扣。',
        payload,
      },
    }
  } catch {
    callbacks?.onToolDone?.('issueCoupon', false)
    return { coupons }
  }
}

/** 已拿到人数或日期后再推营销券；仅询问买票、尚未填槽时不发 */
async function replyWithEarlyMarketingCoupon(
  session: PurchaseSession,
  content: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  if (session.marketingIssued) {
    return { content, skillId: 'ticket_purchase', toolCallsUsed: [] }
  }

  if (
    !hasPurchaseMarketingSlot({
      party: session.party,
      visitDate: session.visitDate,
    })
  ) {
    return { content, skillId: 'ticket_purchase', toolCallsUsed: [] }
  }

  try {
    callbacks?.onToolStart?.('getCoupons', '查询可用优惠券')
    const coupons = await unwrapApi(fetchCoupons())
    callbacks?.onToolDone?.('getCoupons', true)
    const marketing = await maybeIssueMarketingCoupon(session, coupons, callbacks)
    if (marketing.marketingCard) {
      return {
        content,
        skillId: 'ticket_purchase',
        toolCallsUsed: ['getCoupons', 'issueCoupon'],
        cards: [marketing.marketingCard],
      }
    }
  } catch {
    callbacks?.onToolDone?.('getCoupons', false)
  }

  return { content, skillId: 'ticket_purchase', toolCallsUsed: [] }
}

async function maybeIssueFallbackCoupon(
  session: PurchaseSession,
  coupons: Coupon[],
  callbacks?: ToolExecutionCallbacks,
): Promise<{ coupons: Coupon[]; marketingCard?: ChatMessageDraft }> {
  const buildFallbackCouponCard = (coupon: Coupon): ChatMessageDraft => {
    const payload: CouponCardPayload = {
      couponId: coupon.couponId,
      title: coupon.title,
      type: coupon.type,
      value: coupon.value,
      condition: coupon.condition,
      expireAt: coupon.expireAt,
      status: coupon.status,
      action: 'view',
    }
    return {
      type: 'coupon',
      role: 'assistant',
      content: FALLBACK_COUPON_CAPTION,
      payload,
    }
  }

  const existing = findFallbackPurchaseCoupon(coupons)
  if (existing) {
    return { coupons, marketingCard: buildFallbackCouponCard(existing) }
  }

  callbacks?.onToolStart?.('issueCoupon', '发放购票优享券')
  try {
    const coupon = await unwrapApi(issueCoupon(FALLBACK_PURCHASE_COUPON_PRODUCT_ID, 'purchase'))
    callbacks?.onToolDone?.('issueCoupon', true)
    session.fallbackCouponIssued = true

    const refreshed = await unwrapApi(fetchCoupons('available'))
    const issued =
      findFallbackPurchaseCoupon(refreshed) ??
      ({
        ...coupon,
        couponProductId: coupon.couponProductId ?? FALLBACK_PURCHASE_COUPON_PRODUCT_ID,
      } as Coupon)
    return {
      coupons: refreshed,
      marketingCard: buildFallbackCouponCard(issued),
    }
  } catch {
    callbacks?.onToolDone?.('issueCoupon', false)
    return { coupons }
  }
}

async function buildPurchaseFallbackResult(
  session: PurchaseSession,
  match: Extract<ReturnType<typeof matchPartyToProducts>, { kind: 'no_product' }>,
  callbacks?: ToolExecutionCallbacks,
  captionPrefix?: string,
): Promise<LlmChatResult> {
  const toolRecords: ToolCallRecord[] = []

  session.step = 'fallback'
  session.productId = undefined
  session.couponId = undefined
  session.quoteToken = undefined

  callbacks?.onToolStart?.('getCoupons', '查询可用优惠券')
  let coupons = await unwrapApi(fetchCoupons('available'))
  toolRecords.push({ name: 'getCoupons', result: { success: true, data: coupons } })
  callbacks?.onToolDone?.('getCoupons', true)

  const fallbackCoupon = await maybeIssueFallbackCoupon(session, coupons, callbacks)
  if (fallbackCoupon.marketingCard) {
    toolRecords.push({
      name: 'issueCoupon',
      result: { success: true, data: fallbackCoupon.marketingCard.payload },
    })
    coupons = fallbackCoupon.coupons
  }

  const body = buildPurchaseFallbackMessage(match, session.party, session.visitDate)
  const content = captionPrefix ? `${captionPrefix}\n${body}` : body

  const payload: TicketFallbackPayload = {
    kind: match.kind,
    party: { ...session.party },
    visitDate: session.visitDate,
    listPath: TICKET_LIST_PATH,
    sessionId: session.sessionId,
  }

  const cards: ChatMessageDraft[] = [
    {
      type: 'ticket_fallback',
      role: 'assistant',
      content,
      payload,
    },
  ]
  if (fallbackCoupon.marketingCard) {
    cards.unshift(fallbackCoupon.marketingCard)
  }

  return {
    content: '',
    skillId: 'ticket_purchase',
    toolCallsUsed: toolRecords.map((item) => item.name),
    cards,
  }
}

async function buildRecommendationResult(
  session: PurchaseSession,
  _personaId: PersonaId,
  callbacks?: ToolExecutionCallbacks,
  captionPrefix?: string,
): Promise<LlmChatResult> {
  const toolRecords: ToolCallRecord[] = []

  callbacks?.onToolStart?.('getProductCatalog', '查询票产品')
  const products = await unwrapApi(fetchTicketProducts('self'))
  toolRecords.push({ name: 'getProductCatalog', result: { success: true, data: products } })
  callbacks?.onToolDone?.('getProductCatalog', true)

  const effectiveParty = applyPartyEligibility(session.party, {
    childHeightOk: session.childHeightOk,
    elderAgeOk: session.elderAgeOk,
  })
  const match = matchPartyToProducts(products, effectiveParty)
  if (match.kind === 'no_product') {
    return buildPurchaseFallbackResult(session, match, callbacks, captionPrefix)
  }

  const originalAmount = match.recommendation.originalAmount

  let pricing = await loadPricingByAmount(originalAmount, callbacks)
  toolRecords.push({ name: 'getCoupons', result: { success: true, data: pricing.coupons } })

  const marketing = await maybeIssueMarketingCoupon(session, pricing.coupons, callbacks)
  if (marketing.marketingCard) {
    toolRecords.push({
      name: 'issueCoupon',
      result: { success: true, data: marketing.marketingCard.payload },
    })
    pricing = await loadPricingByAmount(originalAmount, callbacks)
  }

  session.productId =
    match.kind === 'single'
      ? match.recommendation.product.productId
      : match.recommendation.lines[0]?.productId
  session.couponId = pricing.couponId
  session.step = 'recommend'
  session.quoteToken = nextQuoteToken()

  const ticketPayload =
    match.kind === 'single'
      ? buildTicketCardPayload(match.recommendation, session, pricing)
      : buildCartTicketCardPayload(match.recommendation, session, pricing)

  const rewriteBits: string[] = []
  if (session.party.child > 0 && session.childHeightOk === false) {
    rewriteBits.push(CHILD_OVER_LIMIT_CAPTION)
  }
  if (session.party.elderly > 0 && session.elderAgeOk === false) {
    rewriteBits.push(ELDER_UNDER_AGE_CAPTION)
  }
  const introBase = buildTicketRecommendIntro(session, captionPrefix)
  const intro = [...rewriteBits, introBase].filter(Boolean).join('\n')

  if (marketing.marketingCard?.payload) {
    ticketPayload.offerCoupon = marketing.marketingCard.payload as CouponCardPayload
    ticketPayload.offerCouponHint =
      marketing.marketingCard.content?.trim() ||
      '为您送上一张购票优惠券，下单时可自动抵扣。'
  }

  return {
    content: '',
    skillId: 'ticket_purchase',
    toolCallsUsed: toolRecords.map((item) => item.name),
    cards: [
      {
        type: 'ticket',
        role: 'assistant',
        content: intro,
        payload: {
          ...ticketPayload,
          footerHint: TICKET_RECOMMEND_FOOTER_HINT,
        },
      },
    ],
  }
}

function askPartyMessage(): string {
  return '好的，我来帮您选票。请问本次几人出行？同行是否有老人和小孩？您也可以分步告诉我，例如「2 大 1 小，没有老人」。'
}

function askDateMessage(session: PurchaseSession): string {
  return `已记录 ${formatPartyLabel(session.party)}。请问预计哪天出行？支持具体日期（如 2026-07-01）或模糊说法（如这周末、8 月中旬）。`
}

const TICKET_CONFIRM_BUTTON_HINT =
  '请点击推荐卡上的「确认并生成订单」按钮完成下单。'

function toSlotSessionContext(session: PurchaseSession) {
  return {
    step: session.step,
    party: session.party,
    visitDate: session.visitDate,
  }
}

const TICKET_FALLBACK_HINT =
  '如需调整人数或日期请直接说明；也可点击「去购票列表选购」自行搭配。'

function parseEligibilityYesNo(message: string): boolean | null {
  const text = message.trim()
  if (!text) return null
  if (
    /^(是|对|符合|可以|满龄|已满|yes|ok)\b/i.test(text) ||
    /符合|不超过|已满|满\s*\d+|可以买/.test(text)
  ) {
    return true
  }
  if (
    /^(否|不|没|超了|未满|no)\b/i.test(text) ||
    /超过|未满|不满|不够|不行/.test(text)
  ) {
    return false
  }
  return null
}

function needsChildHeightAsk(session: PurchaseSession): boolean {
  return session.party.child > 0 && session.childHeightOk == null
}

function needsElderAgeAsk(session: PurchaseSession): boolean {
  return session.party.elderly > 0 && session.elderAgeOk == null
}

function buildEligibilityAskResult(
  session: PurchaseSession,
  kind: 'child_height' | 'elder_age',
): LlmChatResult {
  const scenicId = useScenicStore().currentScenicId
  const config = resolveTicketEligibilityConfig(scenicId)
  const payload: TicketEligibilityCardPayload =
    kind === 'child_height'
      ? {
          kind: 'child_height',
          sessionId: session.sessionId,
          question: buildChildHeightQuestion(config.childMaxHeightCm),
          yesLabel: `是，不超过 ${config.childMaxHeightCm} cm`,
          noLabel: '否，已超过',
          status: 'active',
        }
      : {
          kind: 'elder_age',
          sessionId: session.sessionId,
          question: buildElderAgeQuestion(config.elderMinAgeYears),
          yesLabel: `是，已满 ${config.elderMinAgeYears} 周岁`,
          noLabel: '否，未满',
          status: 'active',
        }

  session.step = kind === 'child_height' ? 'ask_child_height' : 'ask_elder_age'

  return {
    content: '',
    skillId: 'ticket_purchase',
    toolCallsUsed: [],
    cards: [
      {
        type: 'ticket_eligibility',
        role: 'assistant',
        content: '购票前请确认一下优惠票资格～',
        payload,
      },
    ],
  }
}

/** 卡片点选资格答覆后继续流程 */
export async function answerTicketEligibility(
  session: PurchaseSession,
  kind: 'child_height' | 'elder_age',
  ok: boolean,
  personaId: PersonaId,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  if (kind === 'child_height') {
    session.childHeightOk = ok
  } else {
    session.elderAgeOk = ok
  }
  return runTicketPurchaseWorkflow('', personaId, callbacks, session)
}

export async function runTicketPurchaseWorkflow(
  message: string,
  personaId: PersonaId,
  callbacks?: ToolExecutionCallbacks,
  existingSession?: PurchaseSession | null,
): Promise<LlmChatResult> {
  const session: PurchaseSession =
    existingSession ?? {
      sessionId: `purchase_${Date.now()}`,
      step: 'ask_party',
      party: { adult: 0, child: 0, elderly: 0 },
      marketingIssued: false,
      fallbackCouponIssued: false,
      childHeightOk: null,
      elderAgeOk: null,
    }

  if (session.step === 'recommend' && isTicketConfirmIntent(message)) {
    return {
      content: TICKET_CONFIRM_BUTTON_HINT,
      skillId: 'ticket_purchase',
      toolCallsUsed: [],
    }
  }

  // 资格确认步：优先解析是/否；空消息（卡片回调）则继续往下问/出票
  if (
    (session.step === 'ask_child_height' || session.step === 'ask_elder_age') &&
    message.trim()
  ) {
    const yn = parseEligibilityYesNo(message)
    if (yn != null) {
      if (session.step === 'ask_child_height') session.childHeightOk = yn
      else session.elderAgeOk = yn
    }
  }

  const slots = await resolvePurchaseSlotsFromMessage(message, {
    callbacks,
    session: existingSession ? toSlotSessionContext(session) : null,
  })

  const partyUpdated = hasPartyPatch(slots.partyPatch)
  const dateUpdated = slots.visitDate != null
  const slotsChanged = partyUpdated || dateUpdated

  if (partyUpdated) {
    session.party = mergeParty(session.party, slots.partyPatch, message)
    session.childHeightOk = null
    session.elderAgeOk = null
  }
  if (dateUpdated) {
    session.visitDate = slots.visitDate!
  }

  if (!isPartyComplete(session.party)) {
    session.step = 'ask_party'
    if (slotsChanged) {
      return replyWithEarlyMarketingCoupon(
        session,
        '我还不太确定出行人数，请告诉我几位成人、是否有儿童或老人同行。',
        callbacks,
      )
    }
    return replyWithEarlyMarketingCoupon(session, askPartyMessage(), callbacks)
  }

  if (!session.visitDate) {
    session.step = 'ask_date'
    if (dateUpdated) {
      return replyWithEarlyMarketingCoupon(
        session,
        '出行日期需要晚于今天，请重新告诉我，例如「7 月 5 日」「这周末」或「8 月中旬」。',
        callbacks,
      )
    }
    return replyWithEarlyMarketingCoupon(session, askDateMessage(session), callbacks)
  }

  if (needsChildHeightAsk(session)) {
    return buildEligibilityAskResult(session, 'child_height')
  }
  if (needsElderAgeAsk(session)) {
    return buildEligibilityAskResult(session, 'elder_age')
  }

  if (session.step === 'recommend' && !slotsChanged) {
    return {
      content: `如需调整人数或日期请直接说明；${TICKET_CONFIRM_BUTTON_HINT}`,
      skillId: 'ticket_purchase',
      toolCallsUsed: [],
    }
  }

  if (session.step === 'fallback' && !slotsChanged) {
    return {
      content: TICKET_FALLBACK_HINT,
      skillId: 'ticket_purchase',
      toolCallsUsed: [],
    }
  }

  const captionPrefix =
    (session.step === 'recommend' || session.step === 'fallback') && slotsChanged
      ? '已根据您的最新信息更新：'
      : undefined

  return buildRecommendationResult(session, personaId, callbacks, captionPrefix)
}

export async function continueTicketPurchaseWorkflow(
  message: string,
  personaId: PersonaId,
  session: PurchaseSession,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  return runTicketPurchaseWorkflow(message, personaId, callbacks, session)
}
