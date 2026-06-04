export type PersonaId = 'demo_new' | 'demo_mid' | 'demo_vip'

export type SalesChannel = 'self' | 'ota' | 'ta'

export type OrderSource = 'self' | 'ota' | 'ta'

export type VisitorPhase = 'pre' | 'in_park' | 'post_same_day' | 'post_later'

export type IdType = 'id_card' | 'passport' | 'hk_macao_pass' | 'taiwan_pass'

export type OrderStatus = 'pending' | 'paid' | 'completed' | 'refunded'

export type InvoiceStatus = 'none' | 'applied' | 'issued'

export type TicketTypeId =
  | 'adult'
  | 'child'
  | 'family_bundle'
  | 'family_annual'
  | 'holiday_special'

export type MessageType = 'text' | 'coupon' | 'ticket' | 'activity' | 'order' | 'system'

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
  title: string
  type: 'discount' | 'cash' | 'parking' | 'dining'
  value: number
  condition?: string
  expireAt: string
  status: 'available' | 'used' | 'expired'
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
  visitors?: CommonVisitor[]
  createdAt: string
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

export interface Activity {
  activityId: string
  name: string
  location: string
  timeRange: string
  tags: string[]
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
  ticketType: TicketTypeId
  ticketName: string
  quantity: { adult: number; child: number }
  totalAmount: number
  discountAmount?: number
  couponId?: string
  recommendedReason?: string
  orderId?: string
  status: 'quote' | 'pending_pay' | 'paid'
}

export interface CouponCardPayload {
  couponId: string
  title: string
  type: Coupon['type']
  value: number
  condition?: string
  expireAt: string
  action?: 'claim' | 'use' | 'view'
}

export interface ActivityCardPayload {
  activityId: string
  name: string
  location: string
  timeRange: string
  tags: string[]
  reason?: string
}

export interface OrderCardPayload {
  orderId: string
  items: Array<{ name: string; qty: number; price: number }>
  totalAmount: number
  status: OrderStatus
  createdAt: string
}

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

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmChatResult {
  content: string
}
