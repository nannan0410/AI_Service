import {
  activityToCardPayload,
  buildActivityRecommendReason,
  pickRecommendActivities,
} from '@/utils/activityDisplay'
import type {
  Activity,
  ChatMessageDraft,
  ContentBlock,
  ContentCardPayload,
  Coupon,
  CouponCardPayload,
  LlmChatResult,
  Order,
  OrderCardPayload,
  OrderDraft,
  TicketProduct,
  TicketCardPayload,
  ToolExecutionResult,
  TravelGuideResult,
} from '@/types'
import { NEW_GUEST_COUPON_COPY } from '@/utils/newGuestCoupon'
import { buildCouponCardPayload } from '@/utils/couponRecommend'
import { getTicketRecommendLabel } from '@/ai/workflow/recommend'

export interface ToolCallRecord {
  name: string
  result: ToolExecutionResult
}

function assistantCard(
  type: ChatMessageDraft['type'],
  payload: unknown,
  content?: string,
): ChatMessageDraft {
  return {
    type,
    role: 'assistant',
    content,
    payload,
  }
}

function formatTicketProducts(data: unknown): ChatMessageDraft[] {
  const products = data as TicketProduct[]
  const sorted = [...products].sort((a, b) => {
    if (a.ticketTypeId === 'family_bundle') return -1
    if (b.ticketTypeId === 'family_bundle') return 1
    return 0
  })

  return sorted.slice(0, 3).map((product) => {
    const quantity = product.composition ?? { adult: 1, child: 0 }
    const payload: TicketCardPayload = {
      ticketType: product.ticketTypeId ?? 'adult',
      ticketName: product.name,
      quantity,
      totalAmount: product.price,
      status: 'quote',
      recommendedReason: getTicketRecommendLabel(product),
    }
    return assistantCard('ticket', payload)
  })
}

function formatCoupons(_data: unknown): ChatMessageDraft[] {
  return []
}

export function buildCouponCardFromCoupon(
  coupon: Coupon,
  action: CouponCardPayload['action'] = 'view',
): ChatMessageDraft {
  return assistantCard('coupon', buildCouponCardPayload(coupon, action))
}

/** 新客领券：单条消息（文案 + 券卡 + 点击查看） */
export function buildNewGuestCouponChatResult(
  coupon: Coupon,
  reason?: string | null,
): Pick<LlmChatResult, 'content' | 'cards'> {
  const alreadyClaimed = reason === 'already_claimed'
  const caption = alreadyClaimed
    ? NEW_GUEST_COUPON_COPY.alreadyClaimed
    : NEW_GUEST_COUPON_COPY.success
  const card = buildCouponCardFromCoupon(coupon, 'view')
  return {
    content: '',
    cards: [{ ...card, content: caption }],
  }
}

function formatOrders(data: unknown): ChatMessageDraft[] {
  return buildOrderQueryCards(data as Order[])
}

export function buildOrderQueryCards(orders: Order[]): ChatMessageDraft[] {
  return orders.slice(0, 5).map((order) => {
    const adult = order.quantity.adult
    const child = order.quantity.child
    const qtyLabel = child > 0 ? `${adult} 成人 ${child} 儿童` : `${adult} 张`
    const visitHint = order.visitDate ? ` · ${order.visitDate} 出行` : ''
    const payload: OrderCardPayload = {
      orderId: order.orderId,
      ticketName: order.ticketName,
      items: [{ name: order.ticketName, qty: adult + child, price: order.totalAmount }],
      totalAmount: order.totalAmount,
      status: order.status,
      source: order.source,
      createdAt: order.createdAt,
      readOnly: order.source === 'ota' || order.source === 'ta',
    }
    return assistantCard('order', payload, `${order.ticketName} · ${qtyLabel}${visitHint}`)
  })
}

function formatContentBlocks(data: unknown): ChatMessageDraft[] {
  const blocks = data as ContentBlock[]
  return blocks.map((block) => {
    const payload: ContentCardPayload = {
      contentId: block.contentId,
      type: block.type,
      title: block.title,
      body: block.body,
    }
    return assistantCard('content', payload)
  })
}

function formatActivities(data: unknown): ChatMessageDraft[] {
  const list = data as Activity[]
  const picked = pickRecommendActivities(list, {
    limit: 4,
    guideContext: 'pre_visit',
  })
  return picked.map((activity) => {
    const guideContext = 'pre_visit' as const
    const reason = buildActivityRecommendReason(activity, { guideContext })
    return assistantCard(
      'activity',
      activityToCardPayload(activity, { reason, guideContext }),
    )
  })
}

function formatOrderDraft(data: unknown): ChatMessageDraft[] {
  const draft = data as OrderDraft
  const payload: OrderCardPayload = {
    orderId: draft.draftId,
    draftId: draft.draftId,
    ticketName: draft.ticketName,
    items: [
      {
        name: draft.ticketName,
        qty: draft.quantity.adult + draft.quantity.child,
        price: draft.totalAmount,
      },
    ],
    totalAmount: draft.totalAmount,
    status: 'pending',
    source: 'self',
    createdAt: draft.createdAt,
  }
  return [assistantCard('order', payload, '订单草稿已生成，请确认并提交')]
}

export function buildTravelGuideCards(guide: TravelGuideResult): ChatMessageDraft[] {
  return [assistantCard('guide', guide)]
}

function formatTravelGuide(data: unknown): ChatMessageDraft[] {
  return buildTravelGuideCards(data as TravelGuideResult)
}

export function formatToolResultToCards(
  toolName: string,
  result: ToolExecutionResult,
): ChatMessageDraft[] {
  if (!result.success || result.data === undefined) return []

  switch (toolName) {
    case 'getProductCatalog':
      return formatTicketProducts(result.data)
    case 'getCoupons':
      return formatCoupons(result.data)
    case 'getOrders':
      return formatOrders(result.data)
    case 'getContentBlocks':
      return formatContentBlocks(result.data)
    case 'getScenicActivities':
      return formatActivities(result.data)
    case 'createOrderDraft':
      return formatOrderDraft(result.data)
    case 'generateTravelGuide':
      return formatTravelGuide(result.data)
    case 'issueCoupon':
      return [buildCouponCardFromCoupon(result.data as Coupon, 'use')]
    default:
      return []
  }
}

export function buildCardsFromToolResults(records: ToolCallRecord[]): ChatMessageDraft[] {
  const cards: ChatMessageDraft[] = []
  const seen = new Set<string>()

  for (const { name, result } of records) {
    for (const card of formatToolResultToCards(name, result)) {
      const key = `${card.type}:${JSON.stringify(card.payload)}`
      if (seen.has(key)) continue
      seen.add(key)
      cards.push(card)
    }
  }

  return cards
}
