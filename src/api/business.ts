import request from './request'
import type {
  Activity,
  ApiResponse,
  AssistantSkillConfig,
  AssistantUiConfig,
  ContentBlock,
  Coupon,
  MemberInfo,
  Order,
  ParkingQueryResult,
  ReceiptOcrResult,
  RecommendEntry,
  TicketCatalogItem,
  TicketProduct,
  UserTag,
  WelcomePageData,
} from '@/types'

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
  return request.get<ApiResponse<TicketCatalogItem[]>>('/api/tickets/catalog')
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

export function fetchActivities(tag?: string) {
  return request.get<ApiResponse<Activity[]>>('/api/activities', { params: { tag } })
}

export function applyInvoice(orderId: string) {
  return request.post<ApiResponse<{ redirectUrl: string }>>('/api/invoice/apply', { orderId })
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

export function fetchTicketProducts(channel?: string) {
  return request.get<ApiResponse<TicketProduct[]>>('/api/products/tickets', {
    params: channel ? { channel } : undefined,
  })
}

export function fetchContentBlocks(type?: string) {
  return request.get<ApiResponse<ContentBlock[]>>('/api/content/blocks', {
    params: type ? { type } : undefined,
  })
}

export function fetchUserTags() {
  return request.get<ApiResponse<UserTag[]>>('/api/member/tags')
}

export function fetchAssistantSkills() {
  return request.get<ApiResponse<AssistantSkillConfig[]>>('/api/assistant/skills')
}
