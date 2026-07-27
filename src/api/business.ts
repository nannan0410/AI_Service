import request from './request'
import type {
  Activity,
  ApiResponse,
  AssistantSkillConfig,
  AssistantUiConfig,
  CommonVisitor,
  ContentBlock,
  Coupon,
  MemberInfo,
  Order,
  OrderDraft,
  ParkingQueryResult,
  ReceiptOcrResult,
  RecommendEntry,
  TicketProduct,
  TicketTypeId,
  TravelGuideResult,
  UserTag,
  VirtualQueueOrder,
  WelcomePageData,
} from '@/types'
import type { CardViewConfig, FieldCatalog, RecommendEntryConfig, WelcomeTemplateConfig } from '@/types/businessConfig'

export function fetchMemberInfo() {
  return request.get<ApiResponse<MemberInfo>>('/api/member/info')
}

export function fetchPlate() {
  return request.get<ApiResponse<{ plateNo: string | null }>>('/api/member/plate')
}

export function bindPlate(plateNo: string) {
  return request.post<ApiResponse<{ plateNo: string }>>('/api/member/plate/bind', { plateNo })
}

export function fetchTicketCatalog() {
  /** @deprecated 请使用 fetchTicketProducts('self') */
  return fetchTicketProducts('self')
}

export function fetchCommonVisitors() {
  return request.get<ApiResponse<CommonVisitor[]>>('/api/member/visitors')
}

export function issueCoupon(
  couponProductId: string,
  purpose: 'claim' | 'purchase' = 'purchase',
) {
  return request.post<ApiResponse<Coupon>>('/api/coupons/issue', { couponProductId, purpose })
}

export function createOrderDraft(payload: {
  productId?: string
  ticketType?: TicketTypeId
  couponId?: string
  visitorIdNumbers?: string[]
  visitDate?: string
  quantity?: { adult: number; child: number }
  originalAmount?: number
}) {
  return request.post<ApiResponse<OrderDraft>>('/api/order/draft', payload)
}

export function updateOrderDraftVisitors(draftId: string, visitorIdNumbers: string[]) {
  return request.patch<ApiResponse<OrderDraft>>('/api/order/draft', {
    draftId,
    visitorIdNumbers,
  })
}

export function fetchOrderDraft(draftId: string) {
  return request.get<ApiResponse<OrderDraft>>('/api/order/draft', { params: { draftId } })
}

export function submitOrder(draftId: string) {
  return request.post<ApiResponse<Order>>('/api/order/submit', { draftId })
}

export function fetchCoupons(status?: string) {
  return request.get<ApiResponse<Coupon[]>>('/api/coupons', { params: { status } })
}

export function fetchOrders() {
  return request.get<ApiResponse<Order[]>>('/api/order/list')
}

export function createOrder(payload: {
  ticketType: string
  ticketName: string
  totalAmount: number
  quantity: { adult: number; child: number }
}) {
  return request.post<ApiResponse<Order>>('/api/order/create', payload)
}

export function queryParking(plateNo: string) {
  return request.get<ApiResponse<ParkingQueryResult>>('/api/parking/query', { params: { plateNo } })
}

export function payParking(payload: { plateNo: string; amount: number }) {
  return request.post<ApiResponse<{ success: boolean; paidAmount: number }>>('/api/parking/pay', payload)
}

export function fetchActivities(params?: { tag?: string; category?: Activity['category'] }) {
  return request.get<ApiResponse<Activity[]>>('/api/activities', { params })
}

export function fetchVirtualQueue() {
  return request.get<ApiResponse<VirtualQueueOrder[]>>('/api/virtual-queue')
}

export function fetchVirtualQueueCatalog() {
  return request.get<ApiResponse<import('@/types').VirtualQueueCatalog>>(
    '/api/virtual-queue/catalog',
  )
}

export function takeVirtualQueueNumber(activityId: string) {
  return request.post<ApiResponse<import('@/types').VirtualQueueTakeResult>>(
    '/api/virtual-queue/take',
    { activityId },
  )
}

export function payVirtualQueueNumber(activityId: string) {
  return request.post<ApiResponse<import('@/types').VirtualQueueTakeResult>>(
    '/api/virtual-queue/pay',
    { activityId },
  )
}

export function applyInvoice(orderId: string) {
  return request.post<ApiResponse<{ redirectUrl: string }>>('/api/invoice/apply', { orderId })
}

export function applyBatchInvoice(orderIds: string[]) {
  return request.post<
    ApiResponse<{ appliedCount: number; appliedOrderIds: string[]; batchId: string }>
  >('/api/invoice/batch', { orderIds })
}

export function submitReview(payload: {
  orderId?: string
  rating: number
  tags?: string[]
  content?: string
  imageIds?: string[]
}) {
  return request.post<ApiResponse<import('@/types').ReviewSubmitResult>>(
    '/api/reviews/submit',
    payload,
  )
}

export function fetchCheckinSpots() {
  return request.get<ApiResponse<import('@/types').CheckinSpotsResult>>('/api/checkin/spots')
}

export function submitCheckin(spotId: string) {
  return request.post<ApiResponse<import('@/types').CheckinSubmitResult>>('/api/checkin', {
    spotId,
  })
}

export function uploadReviewImage() {
  return request.post<ApiResponse<{ imageId: string }>>('/api/reviews/upload')
}

export function ocrReceipt() {
  return request.post<ApiResponse<ReceiptOcrResult>>('/api/receipt/ocr')
}

export function fetchAssistantUi() {
  return request.get<ApiResponse<AssistantUiConfig>>('/api/assistant/ui')
}

export function fetchAssistantConfig() {
  return request.get<ApiResponse<AssistantUiConfig>>('/api/assistant/config')
}

export function fetchWelcomePage() {
  return request.get<ApiResponse<WelcomePageData>>('/api/assistant/welcome')
}

export function fetchRecommendEntries() {
  return request.get<ApiResponse<RecommendEntry[]>>('/api/assistant/recommend-entries')
}

export function fetchRecommendEntriesConfig() {
  return request.get<ApiResponse<RecommendEntryConfig[]>>('/api/admin/recommend-entries')
}

export function fetchWelcomeTemplatesConfig() {
  return request.get<ApiResponse<WelcomeTemplateConfig[]>>('/api/admin/welcome-templates')
}

export function fetchWelcomeQuestionsConfig() {
  return request.get<
    ApiResponse<import('@/types/businessConfig').WelcomeQuestionConfig[]>
  >('/api/admin/welcome-questions')
}

export function fetchTicketProducts(channel?: string) {
  return request.get<ApiResponse<TicketProduct[]>>('/api/products/tickets', {
    params: channel ? { channel } : undefined,
  })
}

/** 券产品目录（非用户持有券） */
export function fetchCouponProducts() {
  return request.get<ApiResponse<Record<string, unknown>[]>>('/api/products/coupons')
}

export function fetchRetailProducts() {
  return request.get<ApiResponse<Record<string, unknown>[]>>('/api/products/retail')
}

export function fetchContentBlocks(type?: string) {
  return request.get<ApiResponse<ContentBlock[]>>('/api/content/blocks', {
    params: type ? { type } : undefined,
  })
}

export function fetchTagCatalog() {
  return request.get<ApiResponse<UserTag[]>>('/api/tags')
}

export function fetchUserTags() {
  return request.get<ApiResponse<UserTag[]>>('/api/member/tags')
}

export function fetchMemberProfileTags() {
  return request.get<ApiResponse<import('@/types').UserProfileTags>>(
    '/api/member/profile-tags',
  )
}

export function postAiChatTag(body: {
  tagId: string
  evidence?: string
  confidence?: number
}) {
  return request.post<
    ApiResponse<{
      tags: Array<{
        tagId: string
        confidence: number
        evidence: string
        updatedAt: string
      }>
      profile: import('@/types').UserProfileTags
    }>
  >('/api/member/ai-chat-tags', body)
}

export function fetchAdminTagCatalog() {
  return request.get<ApiResponse<import('@/types').TagCatalogEntry[]>>(
    '/api/admin/tag-catalog',
  )
}

export function fetchAdminTagRules() {
  return request.get<ApiResponse<import('@/types').TagRuleDef[]>>('/api/admin/tag-rules')
}

export function fetchPersonaTagPreview(personaId: string) {
  return request.get<ApiResponse<import('@/types').PersonaTagPreview>>(
    '/api/admin/persona-preview',
    { params: { personaId } },
  )
}

export function fetchTravelGuide(scope?: 'full' | 'in_park' | 'recommend') {
  return request.get<ApiResponse<TravelGuideResult>>('/api/travel/guide', {
    params: scope ? { scope } : undefined,
  })
}

export function fetchAssistantSkills() {
  return request.get<ApiResponse<AssistantSkillConfig[]>>('/api/assistant/skills')
}

export function fetchMapConfig(scenicId?: string) {
  return request.get<ApiResponse<import('@/types').MapConfig | null>>('/api/map/config', {
    params: scenicId ? { scenicId } : undefined,
  })
}

export function fetchMapPois(scenicId?: string) {
  return request.get<ApiResponse<import('@/types').MapPoi[]>>('/api/map/pois', {
    params: scenicId ? { scenicId } : undefined,
  })
}

/** Phase 3 契约占位：固定游园线（Demo 无真实节点） */
export function fetchMapRoutes(scenicId?: string) {
  return request.get<ApiResponse<import('@/types').MapRoutePlaceholder[]>>(
    '/api/map/routes',
    { params: scenicId ? { scenicId } : undefined },
  )
}

/** Phase 3 契约占位：线路规划试算（Demo supported=false） */
export function fetchMapPlan(params?: {
  scenicId?: string
  from?: string
  to?: string
}) {
  return request.get<ApiResponse<import('@/types').MapPlanPlaceholder>>(
    '/api/map/plan',
    {
      params: {
        ...(params?.scenicId ? { scenicId: params.scenicId } : {}),
        ...(params?.from ? { from: params.from } : {}),
        ...(params?.to ? { to: params.to } : {}),
      },
    },
  )
}

export function fetchFieldCatalog() {
  return request.get<ApiResponse<FieldCatalog>>('/api/admin/field-catalog')
}

export function fetchCardViews() {
  return request.get<ApiResponse<CardViewConfig[]>>('/api/admin/card-views')
}

/** 演示版：重置全部演示账号 Mock 业务数据（订单、券、草稿、绑牌等） */
export function resetDemoBusinessData() {
  return request.post<ApiResponse<{ ok: boolean }>>('/api/demo/reset')
}

export type DemoOpsAction =
  | 'clear_new_guest_coupon'
  | 'ensure_today_paid_order'
  | 'ensure_today_completed_order'
  | 'reset_invoice_status'
  | 'reset_quiz_progress'

/** 演示版：当前登录账号快捷运维（清空新人券 / upsert 当日订单 / 重置开票 / 重置答题） */
export function postDemoOps(action: DemoOpsAction) {
  return request.post<
    ApiResponse<{
      ok: boolean
      action: DemoOpsAction
      personaId: string
      message: string
      removedCouponCount?: number
      resetInvoiceCount?: number
      resetQuizCount?: number
    }>
  >('/api/demo/ops', { action })
}
