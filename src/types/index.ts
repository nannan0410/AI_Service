export type PersonaId = 'demo_new' | 'demo_mid' | 'demo_vip'

export type SalesChannel = 'self' | 'ota' | 'ta'

export type OrderSource = 'self' | 'ota' | 'ta'

export type VisitorPhase = 'pre' | 'in_park' | 'post_same_day' | 'post_later'

export type IdType = 'id_card' | 'passport' | 'hk_macao_pass' | 'taiwan_pass'

export type OrderStatus = 'pending' | 'paid' | 'completed' | 'refunded'

export type InvoiceStatus = 'none' | 'applied' | 'issued'
export type ReviewStatus = 'none' | 'submitted'

export type TicketTypeId =
  | 'adult'
  | 'child'
  | 'family_bundle'
  | 'family_annual'
  | 'holiday_special'

export type MessageType =
  | 'text'
  | 'coupon'
  | 'ticket'
  | 'activity'
  | 'scene_recommend'
  | 'order'
  | 'content'
  | 'visitor_pick'
  | 'ticket_confirm'
  | 'ticket_fallback'
  | 'page_guide'
  | 'review'
  | 'guide'
  | 'system'

export type AssistantMotionId =
  | 'idle'
  | 'thinking'
  | 'nod'
  | 'shake'
  | 'wave'
  | 'point'

export interface ApiResponse<T> {
  code: number
  data: T
  message?: string
}

export interface UserInfo {
  memberId: string
  personaId: PersonaId
  nickname: string
  avatar?: string
}

export interface AuthResult {
  token: string
  userInfo: UserInfo
}

export interface CommonVisitor {
  name: string
  idType: IdType
  idNumber: string
  birthDate: string
  gender: 'male' | 'female' | 'unknown'
  mobile: string
}

export interface VisitorPreferences {
  hasChildren?: boolean
  avoidThrilling?: boolean
}

export interface Coupon {
  couponId: string
  /** 券产品 ID（如 cp_prod_manual），与金额、标题无关 */
  couponProductId?: string
  title: string
  type: 'discount' | 'cash' | 'parking' | 'dining' | 'retail' | 'express'
  value: number
  condition?: string
  expireAt: string
  status: 'available' | 'used' | 'expired'
  /** 快票/兑换券关联项目 */
  redeemActivityId?: string
  redeemActivityName?: string
}

export interface Order {
  orderId: string
  ticketType: TicketTypeId
  ticketName: string
  quantity: { adult: number; child: number }
  totalAmount: number
  status: OrderStatus
  source?: OrderSource
  visitDate?: string
  completedAt?: string
  invoiceStatus: InvoiceStatus
  reviewStatus?: ReviewStatus
  visitors?: CommonVisitor[]
  createdAt: string
}

export interface ReviewSubmitPayload {
  orderId?: string
  rating: number
  tags?: string[]
  content?: string
  imageIds?: string[]
}

export interface ReviewSubmitResult {
  reviewId: string
  orderId: string
  rewardIssued?: boolean
  rewardCoupons?: Coupon[]
}

export interface VisitorState {
  memberId: string
  memberLevel: string
  points: number
  balance: number
  inPark: boolean
  currentLocation: string
  boundPlateNo: string | null
  recentOrders: Order[]
  coupons: Coupon[]
  commonVisitors: CommonVisitor[]
  preferences: VisitorPreferences
}

export interface MemberInfo {
  memberId: string
  nickname: string
  level: string
  points: number
  balance: number
  /** 账号注册时间（ISO），用于新客券领取窗口判定 */
  registeredAt?: string
}

/** 园区打卡点位（Mock 配置） */
export interface CheckinSpot {
  spotId: string
  name: string
  activityId?: string
  location: string
  rewardPoints: number
  rewardCouponProductId?: string
}

export interface CheckinSpotView extends CheckinSpot {
  checkedInToday: boolean
}

export interface CheckinSpotsResult {
  inPark: boolean
  /** 演示版 Mock 当前位置（与点位 location 匹配才可打卡） */
  currentLocation?: string
  spots: CheckinSpotView[]
  checkedCountToday: number
}

export interface CheckinSubmitResult {
  checkinId: string
  spotId: string
  spotName: string
  rewardPoints: number
  pointsTotal: number
  coupon?: Coupon
  checkedAt: string
}

export interface TicketCatalogItem {
  id: TicketTypeId
  name: string
  price: number
  unit?: 'adult' | 'child'
  composition?: { adult: number; child: number }
  validDays?: number
  tags?: string[]
}

export type ActivityCategory = 'dining' | 'retail' | 'ride' | 'show'

/** none=无需排队 waiting=排队中 paused=暂停排队（暂不接收新排队） */
export type ActivityQueueStatus = 'none' | 'waiting' | 'paused'

export type ActivityGuideContext = 'in_park' | 'pre_visit'

export interface ActivityVirtualQueue {
  enabled: boolean
  isFree: boolean
  /** 非免费排队时的价格（元） */
  queuePrice?: number
}

export interface Activity {
  activityId: string
  name: string
  category: ActivityCategory
  location: string
  timeRange: string
  tags: string[]
  queueStatus: ActivityQueueStatus
  waitMinutes?: number
  /** 暂停排队时当前队伍长度（人数） */
  pausedQueueLength?: number
  /** 演出场次，仅 category=show */
  showStartTimes?: string[]
  /** 建议游玩时长，仅 show/ride */
  recommendedDuration?: string
  /** 热门项目（前期攻略中提示提早前往、预留排队时间） */
  isHot?: boolean
  virtualQueue?: ActivityVirtualQueue
}

export interface VirtualQueueOrder {
  queueId: string
  activityId: string
  activityName: string
  status: 'waiting' | 'called' | 'cancelled'
  waitMinutes: number
  position: number
  isFree: boolean
  queuePrice?: number
}

export interface ChatMessage {
  id: string
  type: MessageType
  role: 'user' | 'assistant' | 'system'
  content?: string
  payload?: unknown
  createdAt: string
}

export interface TicketCardPayload {
  productId?: string
  ticketType: TicketTypeId
  ticketName: string
  quantity: { adult: number; child: number }
  /** 商品原价（未抵扣） */
  originalAmount?: number
  /** 产品单价（来自票产品 mock） */
  unitPrice?: number
  /** 购买数量（成人票为张数，套票为套数） */
  purchaseCount?: number
  /** 购买单位：张 / 套 */
  purchaseUnit?: '张' | '套'
  totalAmount: number
  discountAmount?: number
  couponId?: string
  recommendedReason?: string
  visitDate?: string
  /** 推荐卡片底部引导文案 */
  footerHint?: string
  /** 同一会话内多次推荐时，仅最新 quoteToken 可确认下单 */
  quoteToken?: string
  orderId?: string
  status: 'quote' | 'confirm' | 'pending_pay' | 'paid'
  selectable?: boolean
  sessionId?: string
}

export interface TicketFallbackPayload {
  kind: 'no_product' | 'multi_product'
  party: { adult: number; child: number; elderly: number }
  visitDate?: string
  /** 多产品组合时的试算明细（仅展示） */
  plan?: Array<{
    productId: string
    productName: string
    quantity: { adult: number; child: number }
  }>
  listPath: string
  sessionId?: string
}

export interface VisitorPickPayload {
  sessionId: string
  productId: string
  ticketType: TicketTypeId
  ticketName: string
  quantity: { adult: number; child: number }
  totalAmount: number
  discountAmount?: number
  couponId?: string
  visitors: CommonVisitor[]
}

export interface OrderDraft {
  draftId: string
  productId: string
  ticketType: TicketTypeId
  ticketName: string
  quantity: { adult: number; child: number }
  /** 商品原价（未抵扣） */
  originalAmount?: number
  /** 产品单价 */
  unitPrice?: number
  purchaseCount?: number
  purchaseUnit?: '张' | '套'
  totalAmount: number
  discountAmount?: number
  couponId?: string
  visitDate?: string
  requiredVisitorCount: number
  visitors: CommonVisitor[]
  status: 'draft'
  createdAt: string
}

export interface CouponCardPayload {
  couponId: string
  title: string
  type: Coupon['type']
  value: number
  condition?: string
  expireAt: string
  status?: Coupon['status']
  action?: 'claim' | 'use' | 'view'
  /** 可领券预览（尚未入账户） */
  claimable?: boolean
  redeemActivityId?: string
  redeemActivityName?: string
}

/** 单条消息内聚合多张券推荐 */
export interface CouponRecommendPayload {
  items: CouponCardPayload[]
  action: 'view'
}

export interface ActivityCardPayload {
  activityId: string
  name: string
  category?: ActivityCategory
  location: string
  timeRange: string
  tags: string[]
  queueStatus?: ActivityQueueStatus
  waitMinutes?: number
  pausedQueueLength?: number
  showStartTimes?: string[]
  recommendedDuration?: string
  isHot?: boolean
  virtualQueue?: ActivityVirtualQueue
  /** 攻略卡片上下文：在园展示实时排队，前期攻略隐藏排队时长 */
  guideContext?: ActivityGuideContext
  reason?: string
  /** 虚拟排队推荐：每卡下方取号 / 付费 CTA */
  queueAction?: {
    label: string
    path: string
  }
}

/** 餐饮/零售/演出/虚拟排队场景推荐：合并为一条消息 */
export interface SceneRecommendPayload {
  scene: 'dining' | 'retail' | 'show' | 'queue'
  /** 演出查询日（仅 scene=show） */
  dayKind?: 'today' | 'tomorrow' | 'day_after' | 'general'
  /** 当日是否仍有未开演场次（仅 scene=show 且 dayKind=today） */
  hasRemainingSlots?: boolean
  coupon?: CouponCardPayload
  activities: ActivityCardPayload[]
}

/** 虚拟排队目录（含在园状态） */
export interface VirtualQueueCatalog {
  inPark: boolean
  activities: Activity[]
}

export interface VirtualQueueTakeResult {
  queueId: string
  activityId: string
  activityName: string
  isFree: boolean
  waitMinutes: number
  position: number
  queuePrice?: number
}

export interface OrderCardPayload {
  orderId: string
  draftId?: string
  ticketName?: string
  items: Array<{ name: string; qty: number; price: number }>
  totalAmount: number
  status: OrderStatus
  source?: OrderSource
  createdAt: string
  readOnly?: boolean
}

export interface ContentCardPayload {
  contentId: string
  type: 'traffic' | 'entry_notice' | 'faq' | 'guide' | 'strategy'
  title: string
  body: string
}

/** 对话内引导跳转 App/H5 功能页（停车缴费、开票等） */
export interface PageGuideCardPayload {
  title: string
  description?: string
  /** 停车缴费等场景：展示在按钮上方的车牌信息 */
  plateNo?: string
  path: string
  buttonLabel: string
  tag?: string
  /** 对话内即时动作（如打卡），有值时优先于 path 跳转 */
  inlineAction?: 'checkin'
  /** inlineAction=checkin 时的点位 */
  spotId?: string
  spotName?: string
  /** 已完成动作后禁用按钮 */
  actionDone?: boolean
}

export interface ReviewOrderOption {
  orderId: string
  ticketName: string
  visitDate?: string
  completedAt?: string
  totalAmount: number
}

/** 对话内服务点评表单 */
export interface ReviewCardPayload {
  cardId: string
  orders: ReviewOrderOption[]
  defaultOrderId?: string
}

export interface ReviewSubmitDraft {
  orderId: string
  rating: number
  tags: string[]
  content: string
  imageIds: string[]
}

export interface TravelGuideSection {
  title: string
  body: string
}

export type TravelGuideScope = 'full' | 'in_park' | 'recommend'

export interface TravelGuidePayload {
  guideId: string
  title: string
  /** full：含交通+入园；in_park：园内路线；recommend：项目推荐（无交通/入园） */
  scope?: TravelGuideScope
  visitDate?: string
  ticketName?: string
  /** 出行游客总人数（成人 + 儿童） */
  visitorCount?: number
  traffic?: TravelGuideSection
  entryNotice?: TravelGuideSection
  dayPlan?: TravelGuideSection
  activities: ActivityCardPayload[]
  guideImageUrl?: string
}

export interface TravelGuideResult extends TravelGuidePayload {}

export type ChatMessageDraft = Omit<ChatMessage, 'id' | 'createdAt'>

export interface AssistantMotionConfig {
  actionId: AssistantMotionId
  assetUrl: string
  durationMs?: number
}

export interface AssistantAvatarConfig {
  avatarUrl: string
  name: string
  greeting: string
  themeColor?: string
}

export interface AssistantUiConfig {
  chatBackgroundUrl: string
  /** 助手头像，用于顶部头像、静态头像展示 */
  assistantAvatarUrl: string
  /** 会员默认头像，用于首页欢迎区、对话中用户消息等 */
  memberDefaultAvatarUrl: string
  /** 欢迎页全身形象图，建议 9:16 */
  assistantCharacterUrl?: string
  dialogTitle: string
  assistantName: string
  assistantNickname: string
  /** 助手默认图，用于欢迎页全身形象图 */
  defaultImageUrl: string
  /** 欢迎语，用于聊天欢迎气泡等 */
  greeting: string
  /** 主色：对话框按钮、强调色、用户气泡等 */
  primaryColor: string
  primaryColorLight?: string
  primaryColorDark?: string
  motions: AssistantMotionConfig[]
  defaultMotion: AssistantMotionId
}

/** @deprecated 使用 AssistantUiConfig，保留兼容 */
export interface AssistantConfig extends AssistantUiConfig {
  avatar?: AssistantAvatarConfig
}

export interface WelcomeTemplate {
  personaId: PersonaId
  title: string
  subtitle: string
  body: string
  highlights: string[]
}

export interface WelcomePageData extends WelcomeTemplate {
  ui: Pick<
    AssistantUiConfig,
    | 'dialogTitle'
    | 'assistantNickname'
    | 'assistantAvatarUrl'
    | 'assistantCharacterUrl'
    | 'defaultImageUrl'
    | 'chatBackgroundUrl'
    | 'primaryColor'
    | 'primaryColorLight'
    | 'primaryColorDark'
    | 'greeting'
  >
}

export interface RecommendEntry {
  entryId: string
  title: string
  icon: string
  target: 'chat' | 'page' | 'h5' | 'mini_program'
  targetPath?: string
  skillId?: string
  promptHint?: string
  priority: number
}

export interface UserTag {
  tagId: string
  name: string
  description: string
}

export interface ContentBlock {
  contentId: string
  type: 'traffic' | 'entry_notice' | 'faq' | 'guide' | 'strategy'
  title: string
  body: string
  media?: string[]
}

export interface TicketProduct {
  productId: string
  name: string
  type: 'ticket'
  channels: SalesChannel[]
  status: 'on' | 'off'
  price: number
  ticketTypeId?: TicketTypeId
  composition?: { adult: number; child: number }
  tags?: string[]
  /** 购票卡片右上角推荐标签；留空则不展示 */
  recommendLabel?: string
}

export interface AssistantSkillConfig {
  skillId: string
  name: string
  description: string
  icon?: string
  enabled: boolean
  triggerKeywords?: string[]
  tools: string[]
  promptAddon: string
  linkedMotions?: {
    onStart?: AssistantMotionId
    onSuccess?: AssistantMotionId
    onFail?: AssistantMotionId
  }
}

export interface UserSnapshot {
  memberInfo: MemberInfo
  visitorState: VisitorState
  orders: Order[]
}

export interface ParkingQueryResult {
  plateNo: string
  amount: number
  duration: string
  entryTime: string
}

export interface ReceiptOcrResult {
  merchantName: string
  amount: number
  receiptDate: string
  receiptNo: string
  pointsAwarded: number
}

export interface LlmToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: LlmToolCall[]
  tool_call_id?: string
  name?: string
}

export interface LlmChatResult {
  content: string
  toolCallsUsed?: string[]
  skillId?: string | null
  cards?: ChatMessageDraft[]
}

export interface ToolJsonSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}

export interface ToolDefinition {
  name: string
  label: string
  description: string
  parameters: ToolJsonSchema
}

export interface ToolExecutionResult {
  success: boolean
  data?: unknown
  error?: string
  /** issueCoupon 等业务原因码，如 already_claimed */
  issueReason?: string
}

export interface ToolExecutionCallbacks {
  onToolStart?: (toolName: string, label: string) => void
  onToolDone?: (toolName: string, success: boolean) => void
}

export interface SendChatOptions extends ToolExecutionCallbacks {
  toolNames?: string[]
  skill?: AssistantSkillConfig | null
  temperature?: number
}
