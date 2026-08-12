import { clearAiChatTags } from '../src/utils/aiChatTagRuntime'
import type {
  CheckinSpot,
  CheckinSpotView,
  CheckinSpotsResult,
  CheckinSubmitResult,
  CommonVisitor,
  Coupon,
  Order,
  OrderDraft,
  OrderLineItem,
  PersonaId,
  QuizAnswerResult,
  QuizSet,
  ScenicStar,
  TicketProduct,
  TicketTypeId,
  TravelGuideResult,
  UserSnapshot,
  VirtualQueueCatalog,
  VirtualQueueOrder,
  VirtualQueueTakeResult,
} from '../src/types/index'
import demoNew from '../src/mock/users/demo_new.json'
import demoMid from '../src/mock/users/demo_mid.json'
import demoVip from '../src/mock/users/demo_vip.json'
import couponProducts from '../src/mock/products/coupon_products.json'
import ticketProducts from '../src/mock/products/tickets.json'
import contentBlocks from '../src/mock/content/blocks.json'
import activities from '../src/mock/activities.json'
import checkinSpots from '../src/mock/checkin/spots.json'
import virtualQueueSeed from '../src/mock/virtual_queue.json'
import quizSets from '../src/mock/quiz.json'
import scenicStars from '../src/mock/stars.json'
import {
  activityToCardPayload,
  buildActivityRecommendReason,
  pickRecommendActivities,
} from '../src/utils/activityDisplay'
import { resolveProfileRuleTagIds } from '../src/utils/profileTags'
import type { Activity } from '../src/types/index'
import {
  NEW_GUEST_COUPON_PRODUCT_ID,
  NEW_GUEST_COUPON_TITLE,
  buildDemoNewRegisteredAt,
  findNewGuestCoupon,
  isWithinNewGuestClaimWindow,
} from '../src/utils/newGuestCoupon'
import { qualifiesReviewReward } from '../src/utils/reviewForm'
import {
  canAccessScenicReview,
  REVIEW_SHARE_DEMO_TOAST,
  scenicDayKey,
  type ReviewShareChannelKey,
} from '../src/utils/scenicReviewAccess'
import type { ReviewShareChannel, ScenicReviewRecord } from '../src/types/index'
import {
  filterByBusinessScenicId,
  matchesBusinessScenicId,
  resolveBusinessScenicId,
} from '../src/utils/scenicScope'
import { isNearCheckinSpot } from '../src/utils/checkinLocation'
import { pickNearestUpcomingVisitOrder } from '../src/utils/upcomingVisitOrder'

const REVIEW_DINING_PRODUCT_ID = 'cp_prod_review_dining'
const REVIEW_PARKING_PRODUCT_ID = 'cp_prod_review_parking'

type CheckinRecord = { spotId: string; date: string; checkinId: string; checkedAt: string }

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

function cloneVirtualQueueSeed(): VirtualQueueOrder[] {
  return JSON.parse(JSON.stringify(virtualQueueSeed)) as VirtualQueueOrder[]
}

const baselineByPersona: Record<PersonaId, UserSnapshot> = {
  demo_new: demoNew as UserSnapshot,
  demo_mid: demoMid as UserSnapshot,
  demo_vip: demoVip as UserSnapshot,
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

/**
 * vite-plugin-mock 会按文件分别打包，直接 module-level 变量无法跨 mock 文件共享。
 * 挂到 globalThis，保证领券（business）与清空（demo）改的是同一份快照。
 */
const MOCK_RUNTIME_KEY = '__scenic_ai_custom_mock_runtime_v1__'

type MockRuntime = {
  snapshots: Record<PersonaId, UserSnapshot>
  checkinRecordsByPersona: Record<PersonaId, CheckinRecord[]>
  virtualQueueByPersona: Record<PersonaId, VirtualQueueOrder[]>
  plateOverrides: Partial<Record<PersonaId, string>>
  orderDrafts: Map<string, OrderDraft>
  /** `${personaId}:${quizId}` → 下一题下标 */
  quizSessions: Map<string, number>
  scenicReviewsByPersona: Record<PersonaId, ScenicReviewRecord[]>
  /** `${personaId}:${scenicId}` → dayKey 已发点评奖励 */
  reviewRewardDayByKey: Record<string, string>
  /** `${personaId}:${scenicId}:${channel}:${dayKey}` → 1 */
  reviewShareKeys: Record<string, 1>
}

function createMockRuntime(): MockRuntime {
  const snapshots: Record<PersonaId, UserSnapshot> = {
    demo_new: cloneSnapshot(baselineByPersona.demo_new),
    demo_mid: cloneSnapshot(baselineByPersona.demo_mid),
    demo_vip: cloneSnapshot(baselineByPersona.demo_vip),
  }
  ensureDemoNewRegistrationFresh(snapshots.demo_new)
  return {
    snapshots,
    checkinRecordsByPersona: {
      demo_new: [],
      demo_mid: [],
      demo_vip: [],
    },
    virtualQueueByPersona: {
      demo_new: cloneVirtualQueueSeed(),
      demo_mid: cloneVirtualQueueSeed(),
      demo_vip: cloneVirtualQueueSeed(),
    },
    plateOverrides: {},
    orderDrafts: new Map(),
    quizSessions: new Map(),
    scenicReviewsByPersona: {
      demo_new: [],
      demo_mid: [],
      demo_vip: [],
    },
    reviewRewardDayByKey: {},
    reviewShareKeys: {},
  }
}

function getMockRuntime(): MockRuntime {
  const g = globalThis as typeof globalThis & {
    [MOCK_RUNTIME_KEY]?: MockRuntime
  }
  if (!g[MOCK_RUNTIME_KEY]) {
    g[MOCK_RUNTIME_KEY] = createMockRuntime()
  }
  const runtime = g[MOCK_RUNTIME_KEY]!
  if (!runtime.quizSessions) {
    runtime.quizSessions = new Map()
  }
  if (!runtime.scenicReviewsByPersona) {
    runtime.scenicReviewsByPersona = {
      demo_new: [],
      demo_mid: [],
      demo_vip: [],
    }
  }
  if (!runtime.reviewRewardDayByKey) runtime.reviewRewardDayByKey = {}
  if (!runtime.reviewShareKeys) runtime.reviewShareKeys = {}
  return runtime
}

const personaLabels: Record<PersonaId, { nickname: string; memberId: string }> = {
  demo_new: { nickname: '新用户小明', memberId: '10001' },
  demo_mid: { nickname: '中级会员小红', memberId: '10002' },
  demo_vip: { nickname: '高级会员老王', memberId: '10003' },
}

export function parsePersonaFromAuthHeader(auth?: string): PersonaId | null {
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const match = token.match(/^mock_token_(demo_(?:new|mid|vip))_/)
  return (match?.[1] as PersonaId) ?? null
}

function getMutableSnapshot(personaId: PersonaId): UserSnapshot {
  return getMockRuntime().snapshots[personaId]
}

export function getSnapshot(personaId: PersonaId): UserSnapshot {
  const runtime = getMockRuntime()
  const base = cloneSnapshot(runtime.snapshots[personaId])
  if (runtime.plateOverrides[personaId] !== undefined) {
    base.visitorState.boundPlateNo = runtime.plateOverrides[personaId]
  }
  base.visitorState.recentOrders = base.orders
  return base
}

export function bindPlate(personaId: PersonaId, plateNo: string): { ok: boolean; message?: string } {
  const runtime = getMockRuntime()
  const snapshot = runtime.snapshots[personaId]
  if (snapshot.visitorState.boundPlateNo || runtime.plateOverrides[personaId]) {
    return { ok: false, message: '已绑定车牌，演示版不可变更' }
  }
  runtime.plateOverrides[personaId] = plateNo
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
      scenicId: (product as { scenicId?: string }).scenicId,
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
    scenicId: (product as { scenicId?: string }).scenicId,
  }
  snapshot.visitorState.coupons.unshift(coupon)
  return { ok: true, coupon, reason: 'issued' }
}

function findTicketProduct(
  productId?: string,
  ticketType?: TicketTypeId,
  scenicId?: string | null,
): TicketProduct | undefined {
  const list = ticketProducts as TicketProduct[]
  if (productId) return list.find((item) => item.productId === productId)
  if (ticketType) {
    const scoped = scenicId
      ? list.filter((item) => matchesBusinessScenicId(item.scenicId, scenicId))
      : list
    return (
      scoped.find((item) => item.ticketTypeId === ticketType) ||
      list.find((item) => item.ticketTypeId === ticketType)
    )
  }
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

/** Mock 侧本地计价（勿从 src/utils 引入：vite-plugin-mock 无法解析 @/ 别名） */
function calcTicketLineAmount(
  product: TicketProduct,
  quantity: { adult: number; child: number },
): number {
  if (product.composition) {
    return product.price
  }
  if (product.ticketTypeId === 'adult') {
    return product.price * Math.max(quantity.adult, 1)
  }
  if (product.ticketTypeId === 'child') {
    return product.price * Math.max(quantity.child, 1)
  }
  return product.price
}

function buildLineFromProduct(
  product: TicketProduct,
  quantity: { adult: number; child: number },
): OrderLineItem {
  const isAdult = product.ticketTypeId === 'adult'
  const isChild = product.ticketTypeId === 'child'
  const purchaseCount = isAdult
    ? Math.max(quantity.adult, 1)
    : isChild
      ? Math.max(quantity.child, 1)
      : 1
  const purchaseUnit: '张' | '套' = isAdult || isChild ? '张' : '套'
  return {
    productId: product.productId,
    productName: product.name,
    ticketType: product.ticketTypeId ?? 'adult',
    unitPrice: product.price,
    purchaseCount,
    purchaseUnit,
    quantity: { ...quantity },
    lineAmount: calcTicketLineAmount(product, quantity),
  }
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
    scenicId?: string | null
    /** 购物车多行；有值时优先于单 productId */
    items?: Array<{
      productId: string
      quantity: { adult: number; child: number }
    }>
  },
): { ok: boolean; message?: string; draft?: OrderDraft } {
  const productScenicFromId = (productId?: string) =>
    productId
      ? (ticketProducts as TicketProduct[]).find((p) => p.productId === productId)?.scenicId
      : undefined

  const scenicId = resolveBusinessScenicId(
    payload.scenicId ||
      productScenicFromId(payload.productId) ||
      productScenicFromId(payload.items?.[0]?.productId),
  )

  const snapshot = getMutableSnapshot(personaId)
  let items: OrderLineItem[] = []
  let ticketName: string
  let productId: string
  let ticketType: TicketTypeId
  let quantity: { adult: number; child: number }
  let unitPrice: number | undefined
  let purchaseCount: number | undefined
  let purchaseUnit: '张' | '套' | undefined

  if (payload.items?.length) {
    const resolvedProducts = payload.items.map((raw) => {
      const product = findTicketProduct(raw.productId, undefined, scenicId)
      return { raw, product }
    })
    if (resolvedProducts.some((item) => !item.product)) {
      const missing = resolvedProducts.find((item) => !item.product)!
      return { ok: false, message: `票产品不存在：${missing.raw.productId}` }
    }
    // 套票不得与其它行混单（含套票+单品、多套票）
    const hasBundle = resolvedProducts.some((item) => Boolean(item.product!.composition))
    if (hasBundle && payload.items.length > 1) {
      return { ok: false, message: '套票不能与单品合并下单' }
    }
    for (const { raw, product } of resolvedProducts) {
      items.push(buildLineFromProduct(product!, raw.quantity))
    }
    quantity = items.reduce(
      (acc, line) => ({
        adult: acc.adult + line.quantity.adult,
        child: acc.child + line.quantity.child,
      }),
      { adult: 0, child: 0 },
    )
    ticketName =
      items.length === 1
        ? items[0].productName
        : items.map((line) => line.productName).join(' + ')
    productId = items[0].productId
    ticketType = items.length === 1 ? items[0].ticketType : 'adult'
    if (items.length === 1) {
      unitPrice = items[0].unitPrice
      purchaseCount = items[0].purchaseCount
      purchaseUnit = items[0].purchaseUnit
    }
  } else {
    const product = findTicketProduct(payload.productId, payload.ticketType, scenicId)
    if (!product) {
      return { ok: false, message: '票产品不存在' }
    }
    quantity = payload.quantity ?? product.composition ?? { adult: 1, child: 0 }
    const line = buildLineFromProduct(product, quantity)
    items = [line]
    ticketName = product.name
    productId = product.productId
    ticketType = product.ticketTypeId ?? 'adult'
    unitPrice = line.unitPrice
    purchaseCount = line.purchaseCount
    purchaseUnit = line.purchaseUnit
  }

  const required = quantity.adult + quantity.child
  const idNumbers = payload.visitorIdNumbers ?? []
  const visitors = idNumbers.length
    ? snapshot.visitorState.commonVisitors.filter((item) =>
        idNumbers.includes(item.idNumber),
      )
    : []

  if (idNumbers.length > 0 && visitors.length !== required) {
    return {
      ok: false,
      message: `请选择 ${required} 位游客（${quantity.adult} 成人 ${quantity.child} 儿童）`,
    }
  }

  const computedOriginal = items.reduce((sum, line) => sum + line.lineAmount, 0)
  const originalAmount = payload.originalAmount ?? computedOriginal
  const coupon = payload.couponId
    ? snapshot.visitorState.coupons.find((item) => item.couponId === payload.couponId)
    : undefined
  const discountAmount = calcDiscount(originalAmount, coupon)
  const draftId = `DRF${Date.now()}`
  const draft: OrderDraft = {
    draftId,
    productId,
    ticketType,
    ticketName,
    quantity,
    items,
    originalAmount,
    unitPrice,
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
    scenicId: resolveBusinessScenicId(
      items[0]
        ? (ticketProducts as TicketProduct[]).find((p) => p.productId === items[0].productId)
            ?.scenicId || scenicId
        : scenicId,
    ),
  }

  getMockRuntime().orderDrafts.set(`${personaId}:${draftId}`, draft)
  return { ok: true, draft }
}

export function updateOrderDraftVisitors(
  personaId: PersonaId,
  draftId: string,
  visitorIdNumbers: string[],
): { ok: boolean; message?: string; draft?: OrderDraft } {
  const key = `${personaId}:${draftId}`
  const draft = getMockRuntime().orderDrafts.get(key)
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
  getMockRuntime().orderDrafts.set(key, draft)
  return { ok: true, draft: cloneSnapshot(draft) }
}

export function getOrderDraft(personaId: PersonaId, draftId: string): OrderDraft | null {
  const draft = getMockRuntime().orderDrafts.get(`${personaId}:${draftId}`)
  return draft ? cloneSnapshot(draft) : null
}

/** 园内攻略：按当前排队大致排成时段线路 + 游玩建议（演示） */
function buildInParkGuideSections(
  picked: Activity[],
  options?: {
    hasChildren?: boolean
    preferThrill?: boolean
    preferSlow?: boolean
    preferPhoto?: boolean
  },
): { dayPlan: TravelGuideResult['dayPlan']; tips: TravelGuideResult['tips'] } {
  const ordered = [...picked].sort((a, b) => {
    const wa = a.waitMinutes ?? 99
    const wb = b.waitMinutes ?? 99
    return wa - wb
  })
  const slots = ['上午', '午后', '傍晚', '收尾'] as const
  const routeLines = ordered.map((item, index) => {
    const slot = slots[index] ?? `站点${index + 1}`
    const wait =
      typeof item.waitMinutes === 'number' ? `（约候 ${item.waitMinutes} 分钟）` : ''
    return `${slot}：${item.name}${wait}`
  })
  const chain =
    ordered.length > 0
      ? `推荐顺序：${ordered.map((item) => item.name).join(' → ')}`
      : ''

  const tipLines: string[] = [
    '优先走排队较短的项目，热门项目可先取虚拟号再去玩。',
    '两段项目之间预留步行与用餐时间，避免扎堆热门场次。',
  ]
  if (options?.hasChildren) {
    tipLines.push('亲子同行：刺激项目可错开，中间穿插萌宠/轻娱乐更轻松。')
  }
  if (options?.preferThrill) {
    tipLines.push('喜欢刺激：可把高人气项目排在靠前时段，减少午后人流峰值。')
  }
  if (options?.preferSlow) {
    tipLines.push('偏好慢游：不必赶完全程，重点体验 2–3 个项目即可。')
  }
  if (options?.preferPhoto) {
    tipLines.push('想出片：优先安排萌宠/演艺与光线好的点位，预留打卡时间。')
  }
  tipLines.push('可点下方「打开地图」对照今日线路位置。')

  return {
    dayPlan: {
      title: '今日游玩线路',
      body: [chain, ...routeLines].filter(Boolean).join('\n'),
    },
    tips: {
      title: '游玩建议',
      body: tipLines.map((line) => `· ${line}`).join('\n'),
    },
  }
}

export function generateTravelGuide(
  personaId: PersonaId,
  options?: { scope?: 'full' | 'in_park' | 'recommend'; scenicId?: string | null },
): TravelGuideResult {
  const scope = options?.scope ?? 'recommend'
  const scenicId = options?.scenicId ?? null
  const snapshot = getSnapshot(personaId)
  const scopedBlocks = filterByBusinessScenicId(
    contentBlocks as Array<{ type: string; title: string; body: string; scenicId?: string }>,
    scenicId,
  )
  const trafficBlock = scopedBlocks.find((item) => item.type === 'traffic')
  const entryBlock = scopedBlocks.find((item) => item.type === 'entry_notice')
  const guideBlock = scopedBlocks.find((item) => item.type === 'guide')

  const scopedOrders = filterByBusinessScenicId(snapshot.orders, scenicId)
  const order = pickNearestUpcomingVisitOrder(scopedOrders)

  const hasChildren =
    snapshot.visitorState.preferences?.hasChildren === true ||
    (order?.quantity.child ?? 0) > 0
  const profileTagIds = resolveProfileRuleTagIds(personaId)
  const familyLike =
    profileTagIds.includes('family') || profileTagIds.includes('order_family')
  const activityTag = hasChildren || familyLike ? '亲子' : undefined
  const guideContext = scope === 'in_park' ? 'in_park' : 'pre_visit'

  const scopedActivities = filterByBusinessScenicId(activities as Activity[], scenicId)
  const picked = pickRecommendActivities(scopedActivities, {
    limit: 4,
    tag: activityTag,
    guideContext,
    hasChildren: hasChildren || familyLike,
    profileTagIds,
  })

  const inParkSections =
    scope === 'in_park'
      ? buildInParkGuideSections(picked, {
          hasChildren: hasChildren || familyLike,
          preferThrill: profileTagIds.includes('prefer_thrill'),
          preferSlow: profileTagIds.includes('prefer_slow'),
          preferPhoto: profileTagIds.includes('prefer_photo'),
        })
      : null

  const orderedForCards =
    scope === 'in_park'
      ? [...picked].sort((a, b) => (a.waitMinutes ?? 99) - (b.waitMinutes ?? 99))
      : picked

  const activityCards = orderedForCards.map((item) =>
    activityToCardPayload(item, {
      guideContext,
      reason: buildActivityRecommendReason(item, {
        guideContext,
        hasChildren: hasChildren || familyLike,
        preferThrill: profileTagIds.includes('prefer_thrill'),
        preferSlow: profileTagIds.includes('prefer_slow'),
        preferPhoto: profileTagIds.includes('prefer_photo'),
      }),
    }),
  )

  const visitorCount = order
    ? order.quantity.adult + order.quantity.child
    : undefined

  const title =
    scope === 'in_park'
      ? '今日园内游玩攻略'
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
    dayPlan: inParkSections
      ? inParkSections.dayPlan
      : guideBlock
        ? { title: guideBlock.title, body: guideBlock.body }
        : undefined,
    tips: inParkSections?.tips,
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
  const draft = getMockRuntime().orderDrafts.get(key)
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
    items: draft.items ? cloneSnapshot(draft.items) : undefined,
    totalAmount: draft.totalAmount,
    status: 'paid',
    source: 'self',
    visitDate: draft.visitDate ?? new Date().toISOString().slice(0, 10),
    invoiceStatus: 'none',
    visitors: cloneSnapshot(draft.visitors),
    createdAt: new Date().toISOString(),
    scenicId: resolveBusinessScenicId(draft.scenicId),
  }

  snapshot.orders.unshift(order)
  snapshot.visitorState.recentOrders = snapshot.orders
  getMockRuntime().orderDrafts.delete(key)
  return { ok: true, order: cloneSnapshot(order) }
}

export function applyBatchInvoice(
  personaId: PersonaId,
  orderIds: string[],
  scenicId?: string | null,
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
    if (scenicId && !matchesBusinessScenicId(order.scenicId, scenicId)) continue
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

export function getReviewEligibility(
  personaId: PersonaId,
  scenicId?: string | null,
  inParkOverride?: boolean,
): {
  canReview: boolean
  reviewedToday: boolean
  reason?: string
  scenicId: string
} {
  const resolvedScenicId = resolveBusinessScenicId(scenicId)
  const snapshot = getSnapshot(personaId)
  const orders = filterByBusinessScenicId(snapshot.orders, resolvedScenicId)
  const inPark =
    inParkOverride !== undefined
      ? inParkOverride
      : snapshot.visitorState.inPark === true
  const day = scenicDayKey()
  const reviewedToday = (getMockRuntime().scenicReviewsByPersona[personaId] ?? []).some(
    (item) => item.scenicId === resolvedScenicId && item.dayKey === day,
  )
  const access = canAccessScenicReview({ orders, inPark })
  if (!access) {
    return {
      canReview: false,
      reviewedToday,
      reason: '需有已核销订单/票，或当前在园（含自报）后才能点评',
      scenicId: resolvedScenicId,
    }
  }
  if (reviewedToday) {
    return {
      canReview: false,
      reviewedToday: true,
      reason: '今天已经点评过啦，明天再来分享体验吧～',
      scenicId: resolvedScenicId,
    }
  }
  return { canReview: true, reviewedToday: false, scenicId: resolvedScenicId }
}

export function listRecommendActivitiesForReview(scenicId?: string | null): Array<{
  activityId: string
  name: string
  hot?: boolean
}> {
  const resolved = resolveBusinessScenicId(scenicId)
  const list = filterByBusinessScenicId(activities as Activity[], resolved)
  return list
    .filter((item) => item.category === 'ride' || item.category === 'show' || !item.category)
    .map((item) => ({
      activityId: item.activityId,
      name: item.name,
      hot: (item.tags ?? []).includes('热门'),
    }))
    .sort((a, b) => Number(Boolean(b.hot)) - Number(Boolean(a.hot)))
}

export function submitReview(
  personaId: PersonaId,
  body: {
    orderId?: string
    rating: number
    tags?: string[]
    content?: string
    imageIds?: string[]
    recommendedActivityIds?: string[]
    scenicId?: string | null
    inParkOverride?: boolean
  },
):
  | {
      ok: true
      reviewId: string
      orderId?: string
      rewardIssued: boolean
      rewardCoupons: Coupon[]
      qualityEligible: boolean
      shareHint: string
    }
  | { ok: false; message: string } {
  const rating = body.rating
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, message: '请选择 1～5 星评分' }
  }

  const content = body.content?.trim() ?? ''
  if (content.length > 200) {
    return { ok: false, message: '评价内容不超过 200 字' }
  }

  const eligibility = getReviewEligibility(
    personaId,
    body.scenicId,
    body.inParkOverride,
  )
  if (!eligibility.canReview) {
    return { ok: false, message: eligibility.reason || '当前不可点评' }
  }

  const scenicId = eligibility.scenicId
  const imageIds = body.imageIds ?? []
  const qualityEligible = qualifiesReviewReward(content, imageIds.length)
  const reviewId = `rev_${Date.now()}`
  const day = scenicDayKey()
  const record: ScenicReviewRecord = {
    reviewId,
    scenicId,
    personaId,
    rating,
    tags: body.tags ?? [],
    content,
    imageIds,
    recommendedActivityIds: body.recommendedActivityIds ?? [],
    submittedAt: new Date().toISOString(),
    dayKey: day,
    qualityEligible,
    showOnMiniProgram: false,
    sharedChannels: [],
    rewardIssued: false,
  }

  const runtime = getMockRuntime()
  const list = runtime.scenicReviewsByPersona[personaId] ?? []
  list.unshift(record)
  runtime.scenicReviewsByPersona[personaId] = list

  // 兼容：若仍传入 orderId，标记该单已评（旧数据路径）
  const orderId = body.orderId?.trim()
  if (orderId) {
    const order = getMutableSnapshot(personaId).orders.find((item) => item.orderId === orderId)
    if (order) order.reviewStatus = 'submitted'
  }

  return {
    ok: true,
    reviewId,
    orderId: orderId || undefined,
    rewardIssued: false,
    rewardCoupons: [],
    qualityEligible,
    shareHint: qualityEligible
      ? '评价很棒！分享到社交平台后可领取优质评价礼哦～'
      : '感谢点评！写满 20 字并上传至少 2 张图后，分享可领优质评价礼。',
  }
}

export function shareScenicReview(
  personaId: PersonaId,
  body: { reviewId?: string; channel?: string },
):
  | {
      ok: true
      reviewId: string
      channel: ReviewShareChannel
      alreadySharedToday?: boolean
      rewardIssued: boolean
      rewardCoupons: Coupon[]
      message: string
    }
  | { ok: false; message: string } {
  const reviewId = body.reviewId?.trim()
  const channel = body.channel?.trim() as ReviewShareChannelKey | undefined
  if (!reviewId || !channel) {
    return { ok: false, message: '缺少点评或分享渠道' }
  }
  const validChannels: ReviewShareChannelKey[] = [
    'wechat_moments',
    'xiaohongshu',
    'douyin',
    'dianping',
  ]
  if (!validChannels.includes(channel)) {
    return { ok: false, message: '不支持的分享渠道' }
  }

  const runtime = getMockRuntime()
  const list = runtime.scenicReviewsByPersona[personaId] ?? []
  const review = list.find((item) => item.reviewId === reviewId)
  if (!review) return { ok: false, message: '点评不存在' }

  const day = scenicDayKey()
  const shareKey = `${personaId}:${review.scenicId}:${channel}:${day}`
  if (runtime.reviewShareKeys[shareKey]) {
    return {
      ok: true,
      reviewId,
      channel,
      alreadySharedToday: true,
      rewardIssued: false,
      rewardCoupons: [],
      message: '今日已在该平台分享过',
    }
  }

  runtime.reviewShareKeys[shareKey] = 1
  if (!review.sharedChannels.includes(channel)) {
    review.sharedChannels = [...review.sharedChannels, channel]
  }

  let rewardCoupons: Coupon[] = []
  const rewardKey = `${personaId}:${review.scenicId}`
  const alreadyRewardedToday = runtime.reviewRewardDayByKey[rewardKey] === day
  if (review.qualityEligible && !alreadyRewardedToday && !review.rewardIssued) {
    rewardCoupons = issueReviewRewardCoupons(personaId)
    if (rewardCoupons.length) {
      review.rewardIssued = true
      runtime.reviewRewardDayByKey[rewardKey] = day
    }
  }

  return {
    ok: true,
    reviewId,
    channel,
    rewardIssued: rewardCoupons.length > 0,
    rewardCoupons,
    message: REVIEW_SHARE_DEMO_TOAST,
  }
}

export function listScenicReviewsForAdmin(scenicId?: string | null): ScenicReviewRecord[] {
  const runtime = getMockRuntime()
  const all = (
    Object.keys(runtime.scenicReviewsByPersona) as PersonaId[]
  ).flatMap((personaId) => runtime.scenicReviewsByPersona[personaId] ?? [])
  const resolved = scenicId ? resolveBusinessScenicId(scenicId) : null
  const filtered = resolved
    ? all.filter((item) => item.scenicId === resolved)
    : all
  return filtered.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  )
}

export function setScenicReviewMiniProgramDisplay(
  reviewId: string,
  showOnMiniProgram: boolean,
): { ok: true; review: ScenicReviewRecord } | { ok: false; message: string } {
  const runtime = getMockRuntime()
  for (const personaId of Object.keys(runtime.scenicReviewsByPersona) as PersonaId[]) {
    const list = runtime.scenicReviewsByPersona[personaId] ?? []
    const hit = list.find((item) => item.reviewId === reviewId)
    if (hit) {
      hit.showOnMiniProgram = showOnMiniProgram
      return { ok: true, review: hit }
    }
  }
  return { ok: false, message: '点评不存在' }
}

/** @deprecated 旧订单点评路径保留名；请用景区点评 submitReview */
export function submitOrderBoundReviewLegacy() {
  return null
}

export function listCheckinSpots(
  personaId: PersonaId,
  scenicId?: string | null,
): CheckinSpotsResult {
  const snapshot = getSnapshot(personaId)
  const today = formatTodayDate()
  const records = getMockRuntime().checkinRecordsByPersona[personaId] ?? []
  const checkedToday = new Set(
    records.filter((item) => item.date === today).map((item) => item.spotId),
  )
  const scopedSpots = filterByBusinessScenicId(checkinSpots as CheckinSpot[], scenicId)
  const spots: CheckinSpotView[] = scopedSpots.map((spot) => ({
    ...spot,
    checkedInToday: checkedToday.has(spot.spotId),
  }))
  return {
    inPark: snapshot.visitorState.inPark === true,
    currentLocation: snapshot.visitorState.currentLocation || '',
    spots,
    checkedCountToday: spots.filter((item) => item.checkedInToday).length,
  }
}

export function getVirtualQueueOrders(personaId: PersonaId): VirtualQueueOrder[] {
  return getMockRuntime().virtualQueueByPersona[personaId] ?? cloneVirtualQueueSeed()
}

export function getVirtualQueueCatalog(
  personaId: PersonaId,
  scenicId?: string | null,
): VirtualQueueCatalog {
  const snapshot = getMutableSnapshot(personaId)
  const list = filterByBusinessScenicId(activities as Activity[], scenicId).filter(
    (item) => item.virtualQueue?.enabled,
  )
  return {
    inPark: snapshot.visitorState.inPark === true,
    activities: list,
  }
}

export function takeVirtualQueue(
  personaId: PersonaId,
  activityId: string,
  mode: 'free' | 'paid',
  scenicId?: string | null,
):
  | { ok: true; data: VirtualQueueTakeResult }
  | { ok: false; message: string } {
  const snapshot = getMutableSnapshot(personaId)
  if (!snapshot.visitorState.inPark) {
    return { ok: false, message: '入园后才可使用虚拟排队' }
  }

  const activity = filterByBusinessScenicId(activities as Activity[], scenicId).find(
    (item) => item.activityId === activityId,
  )
  if (!activity?.virtualQueue?.enabled) {
    return { ok: false, message: '该项目不支持虚拟排队' }
  }

  const vq = activity.virtualQueue
  if (mode === 'free' && !vq.isFree) {
    return { ok: false, message: '该项目为付费快速排队，请走支付取号' }
  }
  if (mode === 'paid' && vq.isFree) {
    return { ok: false, message: '该项目支持免费取号，无需支付' }
  }

  const orders = getMockRuntime().virtualQueueByPersona[personaId] ?? cloneVirtualQueueSeed()
  getMockRuntime().virtualQueueByPersona[personaId] = orders

  const existing = orders.find(
    (item) => item.activityId === activityId && item.status === 'waiting',
  )
  if (existing) {
    return {
      ok: true,
      data: {
        queueId: existing.queueId,
        activityId: existing.activityId,
        activityName: existing.activityName,
        isFree: existing.isFree,
        waitMinutes: existing.waitMinutes,
        position: existing.position,
        queuePrice: existing.queuePrice,
      },
    }
  }

  const queueId = `vq_${Date.now().toString(36)}`
  const order: VirtualQueueOrder = {
    queueId,
    activityId: activity.activityId,
    activityName: activity.name,
    status: 'waiting',
    waitMinutes: activity.waitMinutes ?? (mode === 'paid' ? 5 : 15),
    position: mode === 'paid' ? 3 : 12,
    isFree: vq.isFree,
    queuePrice: vq.isFree ? undefined : vq.queuePrice,
  }
  orders.unshift(order)

  return {
    ok: true,
    data: {
      queueId: order.queueId,
      activityId: order.activityId,
      activityName: order.activityName,
      isFree: order.isFree,
      waitMinutes: order.waitMinutes,
      position: order.position,
      queuePrice: order.queuePrice,
    },
  }
}

export function submitCheckin(
  personaId: PersonaId,
  spotId: string,
  scenicId?: string | null,
):
  | { ok: true; data: CheckinSubmitResult }
  | { ok: false; message: string } {
  const snapshot = getMutableSnapshot(personaId)
  if (!snapshot.visitorState.inPark) {
    return { ok: false, message: '入园后才可打卡' }
  }

  const spot = filterByBusinessScenicId(checkinSpots as CheckinSpot[], scenicId).find(
    (item) => item.spotId === spotId,
  )
  if (!spot) {
    return { ok: false, message: '打卡点不存在' }
  }

  const currentLocation = snapshot.visitorState.currentLocation?.trim() ?? ''
  if (!isNearCheckinSpot(currentLocation, spot.location)) {
    return {
      ok: false,
      message: `未识别到您在「${spot.name}」附近（当前：${currentLocation || '未知'}），请靠近后再试`,
    }
  }

  const today = formatTodayDate()
  const records = getMockRuntime().checkinRecordsByPersona[personaId] ?? []
  if (records.some((item) => item.spotId === spotId && item.date === today)) {
    return { ok: false, message: '该点位今日已打卡' }
  }

  const checkedAt = new Date().toISOString()
  const checkinId = `ck_${Date.now()}`
  records.push({ spotId, date: today, checkinId, checkedAt })
  getMockRuntime().checkinRecordsByPersona[personaId] = records

  const rewardPoints = Math.max(0, spot.rewardPoints || 0)
  snapshot.visitorState.points += rewardPoints
  snapshot.memberInfo.points += rewardPoints

  let coupon: Coupon | undefined
  if (spot.rewardCouponProductId) {
    const issued = issueCoupon(personaId, spot.rewardCouponProductId, 'purchase')
    if (issued.ok && issued.reason === 'issued') {
      coupon = issued.coupon
    } else if (issued.ok && issued.reason === 'already_claimed') {
      coupon = undefined
    }
  }

  return {
    ok: true,
    data: {
      checkinId,
      spotId: spot.spotId,
      spotName: spot.name,
      rewardPoints,
      pointsTotal: snapshot.memberInfo.points,
      coupon,
      checkedAt,
    },
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

function todayIsoDate(ref = new Date()): string {
  const y = ref.getFullYear()
  const m = String(ref.getMonth() + 1).padStart(2, '0')
  const d = String(ref.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 演示快捷：当前账号 upsert 用固定 orderId，重复点击不堆单 */
export const DEMO_TODAY_PAID_ORDER_ID = 'ORD_DEMO_TODAY_PAID'
export const DEMO_TODAY_COMPLETED_ORDER_ID = 'ORD_DEMO_TODAY_DONE'

export type DemoOpsAction =
  | 'clear_new_guest_coupon'
  | 'ensure_today_paid_order'
  | 'ensure_today_completed_order'
  | 'reset_invoice_status'
  | 'reset_quiz_progress'

export type DemoOpsResult = {
  ok: true
  action: DemoOpsAction
  personaId: PersonaId
  message: string
  order?: Order
  removedCouponCount?: number
  resetInvoiceCount?: number
  resetQuizCount?: number
}

/** 清空当前账号全部景区的新人券（可再领）；同时刷新注册时间为昨天，避免领取窗口已过仍不可见入口 */
export function clearNewGuestCoupon(personaId: PersonaId): DemoOpsResult {
  const snapshot = getMutableSnapshot(personaId)
  const before = snapshot.visitorState.coupons.length
  snapshot.visitorState.coupons = snapshot.visitorState.coupons.filter(
    (item) =>
      item.couponProductId !== NEW_GUEST_COUPON_PRODUCT_ID &&
      item.title !== NEW_GUEST_COUPON_TITLE,
  )
  const removedCouponCount = before - snapshot.visitorState.coupons.length
  if (personaId === 'demo_new') {
    ensureDemoNewRegistrationFresh(snapshot)
  }
  return {
    ok: true,
    action: 'clear_new_guest_coupon',
    personaId,
    removedCouponCount,
    message:
      removedCouponCount > 0
        ? `已清空本账号全部景区共 ${removedCouponCount} 张新人券，可再次领取（请重新打开聊天页）`
        : '当前账号无新人券（已确保领取窗口有效，请重新打开聊天页）',
  }
}

function upsertDemoOrder(personaId: PersonaId, order: Order): Order {
  const snapshot = getMutableSnapshot(personaId)
  const index = snapshot.orders.findIndex((item) => item.orderId === order.orderId)
  if (index >= 0) {
    snapshot.orders[index] = order
  } else {
    snapshot.orders.unshift(order)
  }
  snapshot.visitorState.recentOrders = snapshot.orders
  return cloneSnapshot(order)
}

/** upsert 当日待出行订单（paid + visitDate=今天） */
export function ensureTodayPaidOrder(
  personaId: PersonaId,
  scenicId?: string | null,
): DemoOpsResult {
  const today = todayIsoDate()
  const resolvedScenicId = resolveBusinessScenicId(scenicId)
  const order: Order = {
    orderId: `${DEMO_TODAY_PAID_ORDER_ID}__${resolvedScenicId}`,
    ticketType: 'family_bundle',
    ticketName: '家庭套票（2大1小）· 演示待出行',
    quantity: { adult: 2, child: 1 },
    totalAmount: 669,
    status: 'paid',
    source: 'self',
    visitDate: today,
    invoiceStatus: 'none',
    createdAt: new Date().toISOString(),
    scenicId: resolvedScenicId,
  }
  const saved = upsertDemoOrder(personaId, order)
  return {
    ok: true,
    action: 'ensure_today_paid_order',
    personaId,
    order: saved,
    message: `已设置当日待出行订单（${today} / ${resolvedScenicId}）`,
  }
}

/** upsert 当日已核销订单（completed + visitDate=今天；核销时间固定今日 10:00 便于演示「逛久了」） */
export function ensureTodayCompletedOrder(
  personaId: PersonaId,
  scenicId?: string | null,
): DemoOpsResult {
  const today = todayIsoDate()
  const now = new Date()
  const entryAt = new Date(now)
  entryAt.setHours(10, 0, 0, 0)
  const resolvedScenicId = resolveBusinessScenicId(scenicId)
  const order: Order = {
    orderId: `${DEMO_TODAY_COMPLETED_ORDER_ID}__${resolvedScenicId}`,
    ticketType: 'family_bundle',
    ticketName: '家庭套票（2大1小）· 演示已核销',
    quantity: { adult: 2, child: 1 },
    totalAmount: 669,
    status: 'completed',
    source: 'self',
    visitDate: today,
    completedAt: entryAt.toISOString(),
    invoiceStatus: 'none',
    reviewStatus: 'none',
    createdAt: now.toISOString(),
    scenicId: resolvedScenicId,
  }
  const saved = upsertDemoOrder(personaId, order)
  return {
    ok: true,
    action: 'ensure_today_completed_order',
    personaId,
    order: saved,
    message: `已设置当日已核销订单（${today} 10:00 入园 / ${resolvedScenicId}）`,
  }
}

/** 当前账号全部订单发票状态重置为未开票（不按景区过滤） */
export function resetInvoiceStatus(personaId: PersonaId): DemoOpsResult {
  const snapshot = getMutableSnapshot(personaId)
  let resetInvoiceCount = 0
  for (const order of snapshot.orders) {
    if (order.invoiceStatus !== 'none') {
      order.invoiceStatus = 'none'
      resetInvoiceCount += 1
    }
  }
  return {
    ok: true,
    action: 'reset_invoice_status',
    personaId,
    resetInvoiceCount,
    message:
      resetInvoiceCount > 0
        ? `已将本账号全部景区共 ${resetInvoiceCount} 笔订单重置为未开票（请重新打开聊天页）`
        : '当前账号订单均为未开票，无需重置',
  }
}

/** 清空当前账号全部答题成功记录（可再次出现答题邀请） */
export function resetQuizProgress(personaId: PersonaId): DemoOpsResult {
  const snapshot = getMutableSnapshot(personaId)
  const resetQuizCount = snapshot.visitorState.completedQuizIds?.length ?? 0
  snapshot.visitorState.completedQuizIds = []

  const runtime = getMockRuntime()
  const prefix = `${personaId}:`
  for (const key of [...runtime.quizSessions.keys()]) {
    if (key.startsWith(prefix)) runtime.quizSessions.delete(key)
  }

  return {
    ok: true,
    action: 'reset_quiz_progress',
    personaId,
    resetQuizCount,
    message:
      resetQuizCount > 0
        ? `已清空本账号 ${resetQuizCount} 套答题成功记录，可再次演示答题邀请（请重新打开聊天页）`
        : '当前账号无已完成答题记录，已清除进行中的答题会话（请重新打开聊天页）',
  }
}

export function runDemoOps(
  personaId: PersonaId,
  action: DemoOpsAction,
  scenicId?: string | null,
): DemoOpsResult {
  switch (action) {
    case 'clear_new_guest_coupon':
      return clearNewGuestCoupon(personaId)
    case 'ensure_today_paid_order':
      return ensureTodayPaidOrder(personaId, scenicId)
    case 'ensure_today_completed_order':
      return ensureTodayCompletedOrder(personaId, scenicId)
    case 'reset_invoice_status':
      return resetInvoiceStatus(personaId)
    case 'reset_quiz_progress':
      return resetQuizProgress(personaId)
    default: {
      const _exhaustive: never = action
      throw new Error(`未知演示操作: ${_exhaustive}`)
    }
  }
}

/** 演示版：将全部 persona 业务快照恢复为 JSON 初始态 */
export function resetAllDemoSnapshots(): void {
  const runtime = getMockRuntime()
  const personas: PersonaId[] = ['demo_new', 'demo_mid', 'demo_vip']
  for (const personaId of personas) {
    runtime.snapshots[personaId] = cloneSnapshot(baselineByPersona[personaId])
    runtime.checkinRecordsByPersona[personaId] = []
    runtime.virtualQueueByPersona[personaId] = cloneVirtualQueueSeed()
    runtime.scenicReviewsByPersona[personaId] = []
  }
  refreshDemoNewRegistrationDate(runtime.snapshots.demo_new)
  runtime.orderDrafts.clear()
  runtime.quizSessions.clear()
  runtime.reviewRewardDayByKey = {}
  runtime.reviewShareKeys = {}
  clearAiChatTags()
  for (const key of Object.keys(runtime.plateOverrides) as PersonaId[]) {
    delete runtime.plateOverrides[key]
  }
}

function quizSessionKey(personaId: PersonaId, quizId: string): string {
  return `${personaId}:${quizId}`
}

export function listQuizSets(): QuizSet[] {
  return cloneSnapshot(quizSets as QuizSet[])
}

export function getQuizSet(quizId: string): QuizSet | null {
  const found = (quizSets as QuizSet[]).find((item) => item.quizId === quizId)
  return found ? cloneSnapshot(found) : null
}

export function listScenicStars(scenicId?: string | null): ScenicStar[] {
  const list = scenicStars as ScenicStar[]
  if (!scenicId) return cloneSnapshot(list)
  return cloneSnapshot(list.filter((item) => item.scenicId === scenicId))
}

export function findScenicStarByMessage(
  message: string,
  scenicId?: string | null,
): ScenicStar | null {
  const text = message.trim()
  if (!text) return null
  const list = listScenicStars(scenicId)
  for (const star of list) {
    const keys = [star.species, star.name, ...(star.aliases ?? [])]
    if (keys.some((key) => key && text.includes(key))) return star
  }
  return null
}

export function isQuizCompleted(personaId: PersonaId, quizId: string): boolean {
  const ids = getMutableSnapshot(personaId).visitorState.completedQuizIds ?? []
  return ids.includes(quizId)
}

export function buildQuizInvite(
  personaId: PersonaId,
  quizId: string,
): { quizId: string; hint: string; buttonLabel: string } | undefined {
  if (!getQuizSet(quizId) || isQuizCompleted(personaId, quizId)) return undefined
  return {
    quizId,
    hint: '想跟我做个答题游戏么？全部答对可领消费券和积分～',
    buttonLabel: '开始答题',
  }
}

export function startQuiz(
  personaId: PersonaId,
  quizId: string,
):
  | {
      ok: true
      quiz: QuizSet
      questionIndex: number
      alreadyCompleted?: boolean
    }
  | { ok: false; message: string; alreadyCompleted?: boolean } {
  const quiz = getQuizSet(quizId)
  if (!quiz) return { ok: false, message: '题集不存在' }
  if (isQuizCompleted(personaId, quizId)) {
    return { ok: false, message: '您已完成本套答题并领取过奖励', alreadyCompleted: true }
  }
  const runtime = getMockRuntime()
  runtime.quizSessions.set(quizSessionKey(personaId, quizId), 0)
  return { ok: true, quiz, questionIndex: 0 }
}

export function submitQuizAnswer(
  personaId: PersonaId,
  quizId: string,
  questionIndex: number,
  optionKey: string,
): QuizAnswerResult {
  const quiz = getQuizSet(quizId)
  if (!quiz) {
    return { correct: false, finished: true, message: '题集不存在' }
  }
  if (isQuizCompleted(personaId, quizId)) {
    return {
      correct: false,
      finished: true,
      alreadyCompleted: true,
      message: '您已完成本套答题，无需重复作答',
    }
  }

  const runtime = getMockRuntime()
  const key = quizSessionKey(personaId, quizId)
  const expected = runtime.quizSessions.get(key)
  if (expected == null) {
    return { correct: false, finished: true, message: '请先点击「开始答题」' }
  }
  if (questionIndex !== expected) {
    return { correct: false, finished: true, message: '请按顺序作答当前题目' }
  }

  const question = quiz.questions[questionIndex]
  if (!question) {
    return { correct: false, finished: true, message: '题目不存在' }
  }

  if (optionKey !== question.correctKey) {
    runtime.quizSessions.delete(key)
    return {
      correct: false,
      finished: true,
      message: '答错了，本次挑战结束。下次查询相关项目或明星时仍可再试～',
    }
  }

  const nextIndex = questionIndex + 1
  if (nextIndex >= quiz.questions.length) {
    runtime.quizSessions.delete(key)
    const snapshot = getMutableSnapshot(personaId)
    snapshot.visitorState.points += quiz.rewardPoints
    snapshot.memberInfo.points = snapshot.visitorState.points
    const completed = snapshot.visitorState.completedQuizIds ?? []
    if (!completed.includes(quizId)) {
      snapshot.visitorState.completedQuizIds = [...completed, quizId]
    }
    let coupon: Coupon | undefined
    const issued = issueCoupon(personaId, quiz.rewardCouponProductId, 'purchase')
    if (issued.ok) coupon = issued.coupon

    return {
      correct: true,
      finished: true,
      rewardPoints: quiz.rewardPoints,
      pointsTotal: snapshot.visitorState.points,
      coupon,
      message: `全部答对！已获得 ${quiz.rewardPoints} 积分${coupon ? `和「${coupon.title}」` : ''}。`,
    }
  }

  runtime.quizSessions.set(key, nextIndex)
  const next = quiz.questions[nextIndex]
  return {
    correct: true,
    finished: false,
    nextQuestion: {
      questionIndex: nextIndex,
      questionId: next.questionId,
      question: next.question,
      options: next.options,
    },
    message: '回答正确，继续下一题！',
  }
}

export { personaLabels, ticketProducts }
