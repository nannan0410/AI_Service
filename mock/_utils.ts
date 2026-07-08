import type {
  CommonVisitor,
  Coupon,
  Order,
  OrderDraft,
  PersonaId,
  TicketProduct,
  TicketTypeId,
  TravelGuideResult,
  UserSnapshot,
} from '../src/types/index'
import demoNew from '../src/mock/users/demo_new.json'
import demoMid from '../src/mock/users/demo_mid.json'
import demoVip from '../src/mock/users/demo_vip.json'
import couponProducts from '../src/mock/products/coupon_products.json'
import ticketProducts from '../src/mock/products/tickets.json'
import contentBlocks from '../src/mock/content/blocks.json'
import activities from '../src/mock/activities.json'
import {
  activityToCardPayload,
  buildActivityRecommendReason,
  pickRecommendActivities,
} from '../src/utils/activityDisplay'
import type { Activity } from '../src/types/index'
import {
  NEW_GUEST_COUPON_PRODUCT_ID,
  buildDemoNewRegisteredAt,
  findNewGuestCoupon,
  isWithinNewGuestClaimWindow,
} from '../src/utils/newGuestCoupon'
import { qualifiesReviewReward } from '../src/utils/reviewForm'

const REVIEW_DINING_PRODUCT_ID = 'cp_prod_review_dining'
const REVIEW_PARKING_PRODUCT_ID = 'cp_prod_review_parking'

function formatDateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatTodayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function issueReviewRewardCoupons(personaId: PersonaId): Coupon[] {
  const snapshot = getMutableSnapshot(personaId)
  const diningProduct = couponProducts.find((item) => item.productId === REVIEW_DINING_PRODUCT_ID)
  const parkingProduct = couponProducts.find((item) => item.productId === REVIEW_PARKING_PRODUCT_ID)
  const issued: Coupon[] = []
  const stamp = Date.now()

  if (diningProduct) {
    const coupon: Coupon = {
      couponId: `cpn_review_dining_${stamp}`,
      couponProductId: REVIEW_DINING_PRODUCT_ID,
      title: diningProduct.name,
      type: 'dining',
      value: diningProduct.value,
      condition: diningProduct.condition,
      expireAt: formatDateOffset(90),
      status: 'available',
    }
    snapshot.visitorState.coupons.unshift(coupon)
    issued.push(coupon)
  }

  if (parkingProduct) {
    const coupon: Coupon = {
      couponId: `cpn_review_parking_${stamp}`,
      couponProductId: REVIEW_PARKING_PRODUCT_ID,
      title: parkingProduct.name,
      type: 'parking',
      value: parkingProduct.value,
      condition: parkingProduct.condition,
      expireAt: formatTodayDate(),
      status: 'available',
    }
    snapshot.visitorState.coupons.unshift(coupon)
    issued.push(coupon)
  }

  return issued
}
import { pickNearestUpcomingVisitOrder } from '../src/utils/upcomingVisitOrder'

export type IssueCouponPurpose = 'claim' | 'purchase'

export type IssueCouponReason =
  | 'issued'
  | 'already_claimed'
  | 'product_not_found'
  | 'not_eligible_persona'
  | 'claim_window_expired'
  | 'already_consumed'

export type IssueCouponResult =
  | { ok: true; coupon: Coupon; reason: 'issued' | 'already_claimed' }
  | { ok: false; reason: Exclude<IssueCouponReason, 'issued' | 'already_claimed'>; message: string }

function cloneSnapshot<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T
}

const baselineByPersona: Record<PersonaId, UserSnapshot> = {
  demo_new: demoNew as UserSnapshot,
  demo_mid: demoMid as UserSnapshot,
  demo_vip: demoVip as UserSnapshot,
}

const snapshots: Record<PersonaId, UserSnapshot> = {
  demo_new: cloneSnapshot(baselineByPersona.demo_new),
  demo_mid: cloneSnapshot(baselineByPersona.demo_mid),
  demo_vip: cloneSnapshot(baselineByPersona.demo_vip),
}

function refreshDemoNewRegistrationDate(snapshot: UserSnapshot): void {
  snapshot.memberInfo.registeredAt = buildDemoNewRegisteredAt()
}

/** 演示自愈：注册时间已过期且未领券时，重置为「昨天注册」 */
function ensureDemoNewRegistrationFresh(snapshot: UserSnapshot): void {
  if (findNewGuestCoupon(snapshot.visitorState.coupons)) return
  if (isWithinNewGuestClaimWindow(snapshot.memberInfo.registeredAt)) return
  refreshDemoNewRegistrationDate(snapshot)
}

ensureDemoNewRegistrationFresh(snapshots.demo_new)

const personaLabels: Record<PersonaId, { nickname: string; memberId: string }> = {
  demo_new: { nickname: '新用户小明', memberId: '10001' },
  demo_mid: { nickname: '中级会员小红', memberId: '10002' },
  demo_vip: { nickname: '高级会员老王', memberId: '10003' },
}

const plateOverrides: Partial<Record<PersonaId, string>> = {}
const orderDrafts = new Map<string, OrderDraft>()

export function parsePersonaFromAuthHeader(auth?: string): PersonaId | null {
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const match = token.match(/^mock_token_(demo_(?:new|mid|vip))_/)
  return (match?.[1] as PersonaId) ?? null
}

function getMutableSnapshot(personaId: PersonaId): UserSnapshot {
  return snapshots[personaId]
}

export function getSnapshot(personaId: PersonaId): UserSnapshot {
  const base = cloneSnapshot(snapshots[personaId])
  if (plateOverrides[personaId] !== undefined) {
    base.visitorState.boundPlateNo = plateOverrides[personaId]
  }
  base.visitorState.recentOrders = base.orders
  return base
}

export function bindPlate(personaId: PersonaId, plateNo: string): { ok: boolean; message?: string } {
  const snapshot = snapshots[personaId]
  if (snapshot.visitorState.boundPlateNo || plateOverrides[personaId]) {
    return { ok: false, message: '已绑定车牌，演示版不可变更' }
  }
  plateOverrides[personaId] = plateNo
  return { ok: true }
}

export function getCommonVisitors(personaId: PersonaId): CommonVisitor[] {
  return cloneSnapshot(getMutableSnapshot(personaId).visitorState.commonVisitors)
}

function findAvailableCouponByProductId(
  coupons: Coupon[],
  couponProductId: string,
): Coupon | undefined {
  return coupons.find(
    (item) => item.couponProductId === couponProductId && item.status === 'available',
  )
}

export function issueCoupon(
  personaId: PersonaId,
  couponProductId: string,
  purpose: IssueCouponPurpose = 'purchase',
): IssueCouponResult {
  const product = couponProducts.find((item) => item.productId === couponProductId)
  if (!product) {
    return { ok: false, reason: 'product_not_found', message: '券产品不存在' }
  }

  const snapshot = getMutableSnapshot(personaId)
  const isNewGuestProduct = couponProductId === NEW_GUEST_COUPON_PRODUCT_ID

  if (isNewGuestProduct) {
    const existing = findNewGuestCoupon(snapshot.visitorState.coupons)

    if (purpose === 'claim') {
      if (personaId !== 'demo_new') {
        return { ok: false, reason: 'not_eligible_persona', message: 'NOT_ELIGIBLE_PERSONA' }
      }
      if (!isWithinNewGuestClaimWindow(snapshot.memberInfo.registeredAt)) {
        return { ok: false, reason: 'claim_window_expired', message: 'CLAIM_WINDOW_EXPIRED' }
      }
      if (existing) {
        return { ok: true, coupon: existing, reason: 'already_claimed' }
      }
    } else {
      if (personaId !== 'demo_new') {
        return { ok: false, reason: 'not_eligible_persona', message: 'NOT_ELIGIBLE_PERSONA' }
      }
      if (existing) {
        if (existing.status === 'available') {
          return { ok: true, coupon: existing, reason: 'already_claimed' }
        }
        return { ok: false, reason: 'already_consumed', message: '新客券已使用或已过期' }
      }
    }

    const coupon: Coupon = {
      couponId: `cpn_${Date.now()}`,
      couponProductId,
      title: product.name,
      type: product.couponType as Coupon['type'],
      value: product.value,
      condition: product.condition,
      expireAt: '2026-12-31',
      status: 'available',
    }
    snapshot.visitorState.coupons.unshift(coupon)
    return { ok: true, coupon, reason: 'issued' }
  }

  const existing = findAvailableCouponByProductId(snapshot.visitorState.coupons, couponProductId)
  if (existing) {
    return { ok: true, coupon: existing, reason: 'already_claimed' }
  }

  const coupon: Coupon = {
    couponId: `cpn_${Date.now()}`,
    couponProductId,
    title: product.name,
    type: product.couponType as Coupon['type'],
    value: product.value,
    condition: product.condition,
    expireAt: '2026-12-31',
    status: 'available',
  }
  snapshot.visitorState.coupons.unshift(coupon)
  return { ok: true, coupon, reason: 'issued' }
}

function findTicketProduct(productId?: string, ticketType?: TicketTypeId): TicketProduct | undefined {
  const list = ticketProducts as TicketProduct[]
  if (productId) return list.find((item) => item.productId === productId)
  if (ticketType) return list.find((item) => item.ticketTypeId === ticketType)
  return undefined
}

function calcDiscount(totalAmount: number, coupon?: Coupon): number {
  if (!coupon || coupon.status !== 'available') return 0
  if (coupon.type === 'cash') {
    if (coupon.condition?.includes('200') && totalAmount < 200) return 0
    return Math.min(coupon.value, totalAmount)
  }
  if (coupon.type === 'dining') {
    if (coupon.condition?.includes('100') && totalAmount < 100) return 0
    return Math.min(coupon.value, totalAmount)
  }
  return 0
}

function calcOriginalAmount(
  product: TicketProduct,
  quantity: { adult: number; child: number },
): number {
  if (product.ticketTypeId === 'adult') {
    return product.price * Math.max(quantity.adult, 1)
  }
  return product.price
}

export function createOrderDraft(
  personaId: PersonaId,
  payload: {
    productId?: string
    ticketType?: TicketTypeId
    couponId?: string
    visitorIdNumbers?: string[]
    visitDate?: string
    quantity?: { adult: number; child: number }
    originalAmount?: number
  },
): { ok: boolean; message?: string; draft?: OrderDraft } {
  const product = findTicketProduct(payload.productId, payload.ticketType)
  if (!product) {
    return { ok: false, message: '票产品不存在' }
  }

  const snapshot = getMutableSnapshot(personaId)
  const quantity = payload.quantity ?? product.composition ?? { adult: 1, child: 0 }
  const required = quantity.adult + quantity.child
  const idNumbers = payload.visitorIdNumbers ?? []
  const visitors = idNumbers.length
    ? snapshot.visitorState.commonVisitors.filter((item) => idNumbers.includes(item.idNumber))
    : []

  if (idNumbers.length > 0 && visitors.length !== required) {
    return {
      ok: false,
      message: `请选择 ${required} 位游客（${quantity.adult} 成人 ${quantity.child} 儿童）`,
    }
  }

  const originalAmount = payload.originalAmount ?? calcOriginalAmount(product, quantity)
  const isAdultTicket = product.ticketTypeId === 'adult'
  const purchaseCount = isAdultTicket ? Math.max(quantity.adult, 1) : 1
  const purchaseUnit: '张' | '套' = isAdultTicket ? '张' : '套'
  const coupon = payload.couponId
    ? snapshot.visitorState.coupons.find((item) => item.couponId === payload.couponId)
    : undefined
  const discountAmount = calcDiscount(originalAmount, coupon)
  const draftId = `DRF${Date.now()}`
  const draft: OrderDraft = {
    draftId,
    productId: product.productId,
    ticketType: product.ticketTypeId ?? 'adult',
    ticketName: product.name,
    quantity,
    originalAmount,
    unitPrice: product.price,
    purchaseCount,
    purchaseUnit,
    totalAmount: Math.max(originalAmount - discountAmount, 0),
    discountAmount: discountAmount || undefined,
    couponId: coupon?.couponId,
    visitDate: payload.visitDate,
    requiredVisitorCount: required,
    visitors: cloneSnapshot(visitors),
    status: 'draft',
    createdAt: new Date().toISOString(),
  }

  orderDrafts.set(`${personaId}:${draftId}`, draft)
  return { ok: true, draft }
}

export function updateOrderDraftVisitors(
  personaId: PersonaId,
  draftId: string,
  visitorIdNumbers: string[],
): { ok: boolean; message?: string; draft?: OrderDraft } {
  const key = `${personaId}:${draftId}`
  const draft = orderDrafts.get(key)
  if (!draft) {
    return { ok: false, message: '草稿不存在' }
  }

  const snapshot = getMutableSnapshot(personaId)
  const visitors = snapshot.visitorState.commonVisitors.filter((item) =>
    visitorIdNumbers.includes(item.idNumber),
  )
  if (visitors.length !== draft.requiredVisitorCount) {
    return {
      ok: false,
      message: `请选择 ${draft.requiredVisitorCount} 位实名出行人`,
    }
  }

  draft.visitors = cloneSnapshot(visitors)
  orderDrafts.set(key, draft)
  return { ok: true, draft: cloneSnapshot(draft) }
}

export function getOrderDraft(personaId: PersonaId, draftId: string): OrderDraft | null {
  const draft = orderDrafts.get(`${personaId}:${draftId}`)
  return draft ? cloneSnapshot(draft) : null
}

export function generateTravelGuide(
  personaId: PersonaId,
  options?: { scope?: 'full' | 'in_park' | 'recommend' },
): TravelGuideResult {
  const scope = options?.scope ?? 'recommend'
  const snapshot = getSnapshot(personaId)
  const trafficBlock = contentBlocks.find((item) => item.type === 'traffic')
  const entryBlock = contentBlocks.find((item) => item.type === 'entry_notice')
  const guideBlock = contentBlocks.find((item) => item.type === 'guide')

  const order = pickNearestUpcomingVisitOrder(snapshot.orders)

  const hasChildren =
    snapshot.visitorState.preferences?.hasChildren === true ||
    (order?.quantity.child ?? 0) > 0
  const activityTag = hasChildren ? '亲子' : undefined
  const guideContext = scope === 'in_park' ? 'in_park' : 'pre_visit'

  const picked = pickRecommendActivities(activities as Activity[], {
    limit: 4,
    tag: activityTag,
    guideContext,
    hasChildren,
  })

  const activityCards = picked.map((item) =>
    activityToCardPayload(item, {
      guideContext,
      reason: buildActivityRecommendReason(item, { guideContext, hasChildren }),
    }),
  )

  const visitorCount = order
    ? order.quantity.adult + order.quantity.child
    : undefined

  const title =
    scope === 'in_park'
      ? '今日园内路线推荐'
      : scope === 'recommend'
        ? order
          ? `${order.ticketName} 游玩推荐`
          : '景区游玩攻略'
        : order
          ? `${order.ticketName} 出行攻略`
          : '景区游玩攻略'

  const result: TravelGuideResult = {
    guideId: `guide_${Date.now()}`,
    scope,
    title,
    visitDate: scope === 'in_park' ? undefined : order?.visitDate,
    ticketName: scope === 'in_park' ? undefined : order?.ticketName,
    visitorCount,
    dayPlan: guideBlock
      ? { title: guideBlock.title, body: guideBlock.body }
      : undefined,
    activities: activityCards,
    guideImageUrl: '/assistant/chat-bg.svg',
  }

  if (scope === 'full') {
    result.traffic = {
      title: trafficBlock?.title ?? '交通指南',
      body: trafficBlock?.body ?? '',
    }
    result.entryNotice = {
      title: entryBlock?.title ?? '入园提醒',
      body: entryBlock?.body ?? '',
    }
  }

  return result
}

export function submitOrderFromDraft(
  personaId: PersonaId,
  draftId: string,
): { ok: boolean; message?: string; order?: Order } {
  const key = `${personaId}:${draftId}`
  const draft = orderDrafts.get(key)
  if (!draft) {
    return { ok: false, message: '草稿不存在或已提交' }
  }

  if (!draft.visitors.length || draft.visitors.length !== draft.requiredVisitorCount) {
    return { ok: false, message: '请先选择实名出行人' }
  }

  const snapshot = getMutableSnapshot(personaId)
  if (draft.couponId) {
    const coupon = snapshot.visitorState.coupons.find((item) => item.couponId === draft.couponId)
    if (coupon && coupon.status === 'available') {
      coupon.status = 'used'
    }
  }

  const orderId = `ORD${Date.now()}`
  const order: Order = {
    orderId,
    ticketType: draft.ticketType,
    ticketName: draft.ticketName,
    quantity: draft.quantity,
    totalAmount: draft.totalAmount,
    status: 'paid',
    source: 'self',
    visitDate: draft.visitDate ?? new Date().toISOString().slice(0, 10),
    invoiceStatus: 'none',
    visitors: cloneSnapshot(draft.visitors),
    createdAt: new Date().toISOString(),
  }

  snapshot.orders.unshift(order)
  snapshot.visitorState.recentOrders = snapshot.orders
  orderDrafts.delete(key)
  return { ok: true, order: cloneSnapshot(order) }
}

export function applyBatchInvoice(
  personaId: PersonaId,
  orderIds: string[],
):
  | { ok: true; appliedCount: number; appliedOrderIds: string[]; batchId: string }
  | { ok: false; message: string } {
  const snapshot = getMutableSnapshot(personaId)
  const uniqueIds = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))]
  if (!uniqueIds.length) {
    return { ok: false, message: '请选择订单' }
  }

  const appliedOrderIds: string[] = []
  for (const orderId of uniqueIds) {
    const order = snapshot.orders.find((item) => item.orderId === orderId)
    if (!order || order.status !== 'completed' || order.invoiceStatus !== 'none') continue
    order.invoiceStatus = 'applied'
    appliedOrderIds.push(orderId)
  }

  if (!appliedOrderIds.length) {
    return { ok: false, message: '所选订单不可开票' }
  }

  return {
    ok: true,
    appliedCount: appliedOrderIds.length,
    appliedOrderIds,
    batchId: `inv_batch_${Date.now()}`,
  }
}

export function submitReview(
  personaId: PersonaId,
  body: {
    orderId?: string
    rating: number
    tags?: string[]
    content?: string
    imageIds?: string[]
  },
):
  | { ok: true; reviewId: string; orderId: string; rewardIssued: boolean; rewardCoupons: Coupon[] }
  | { ok: false; message: string } {
  const rating = body.rating
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, message: '请选择 1～5 星评分' }
  }

  const content = body.content?.trim() ?? ''
  if (content.length > 200) {
    return { ok: false, message: '评价内容不超过 200 字' }
  }

  const snapshot = getMutableSnapshot(personaId)
  const now = Date.now()
  const ninetyDays = 90 * 24 * 60 * 60 * 1000

  let orderId = body.orderId?.trim()
  if (orderId) {
    const order = snapshot.orders.find((item) => item.orderId === orderId)
    if (!order || order.status !== 'completed' || (order.reviewStatus ?? 'none') !== 'none') {
      return { ok: false, message: '该订单不可评价' }
    }
    const completed = order.completedAt ? new Date(order.completedAt).getTime() : 0
    if (!completed || now - completed > ninetyDays) {
      return { ok: false, message: '该订单已超过评价期限' }
    }
  } else {
    const candidates = snapshot.orders
      .filter((order) => {
        if (order.status !== 'completed' || (order.reviewStatus ?? 'none') !== 'none') return false
        const completed = order.completedAt ? new Date(order.completedAt).getTime() : 0
        return completed > 0 && now - completed <= ninetyDays
      })
      .sort((a, b) => {
        const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0
        return tb - ta
      })
    if (!candidates.length) {
      return { ok: false, message: '暂无可评价订单' }
    }
    orderId = candidates[0].orderId
  }

  const order = snapshot.orders.find((item) => item.orderId === orderId)
  if (!order) {
    return { ok: false, message: '订单不存在' }
  }

  order.reviewStatus = 'submitted'

  const rewardEligible = qualifiesReviewReward(content, body.imageIds?.length ?? 0)
  const rewardCoupons = rewardEligible ? issueReviewRewardCoupons(personaId) : []

  return {
    ok: true,
    reviewId: `rev_${Date.now()}`,
    orderId,
    rewardIssued: rewardCoupons.length > 0,
    rewardCoupons,
  }
}

export function createToken(personaId: PersonaId): string {
  return `mock_token_${personaId}_${Date.now()}`
}

export function getUserInfo(personaId: PersonaId) {
  const label = personaLabels[personaId]
  return {
    memberId: label.memberId,
    personaId,
    nickname: label.nickname,
  }
}

/** 演示版：将全部 persona 业务快照恢复为 JSON 初始态 */
export function resetAllDemoSnapshots(): void {
  const personas: PersonaId[] = ['demo_new', 'demo_mid', 'demo_vip']
  for (const personaId of personas) {
    snapshots[personaId] = cloneSnapshot(baselineByPersona[personaId])
  }
  refreshDemoNewRegistrationDate(snapshots.demo_new)
  orderDrafts.clear()
  for (const key of Object.keys(plateOverrides) as PersonaId[]) {
    delete plateOverrides[key]
  }
}

export { snapshots, personaLabels, ticketProducts }
