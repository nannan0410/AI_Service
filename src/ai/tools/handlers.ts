import {
  createOrderDraft,
  fetchActivities,
  fetchCommonVisitors,
  fetchContentBlocks,
  fetchCoupons,
  fetchMemberInfo,
  fetchOrders,
  fetchTicketProducts,
  fetchTravelGuide,
  issueCoupon as issueCouponApi,
} from '@/api/business'
import {
  NEW_GUEST_COUPON_COPY,
  NEW_GUEST_COUPON_PRODUCT_ID,
  formatClaimWindowExpiredCopy,
} from '@/utils/newGuestCoupon'
import type { ApiResponse, TicketTypeId, ToolExecutionResult } from '@/types'

async function unwrapApi<T>(request: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data: res } = await request
  if (res.code !== 200) {
    throw new Error(res.message || '接口请求失败')
  }
  return res.data
}

export async function handleGetMemberInfo(): Promise<ToolExecutionResult> {
  try {
    const data = await unwrapApi(fetchMemberInfo())
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '查询会员信息失败' }
  }
}

export async function handleGetOrders(): Promise<ToolExecutionResult> {
  try {
    const data = await unwrapApi(fetchOrders())
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '查询订单失败' }
  }
}

export async function handleGetCoupons(args: { status?: string }): Promise<ToolExecutionResult> {
  try {
    const data = await unwrapApi(fetchCoupons(args.status))
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '查询优惠券失败' }
  }
}

export async function handleGetProductCatalog(args: {
  channel?: string
}): Promise<ToolExecutionResult> {
  try {
    const channel = args.channel || 'self'
    const data = await unwrapApi(fetchTicketProducts(channel))
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '查询票产品失败' }
  }
}

export async function handleGenerateTravelGuide(args?: {
  scope?: 'full' | 'in_park' | 'recommend'
}): Promise<ToolExecutionResult> {
  try {
    const data = await unwrapApi(fetchTravelGuide(args?.scope))
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '生成游玩攻略失败' }
  }
}

export async function handleGetContentBlocks(args: {
  type?: string
}): Promise<ToolExecutionResult> {
  try {
    const data = await unwrapApi(fetchContentBlocks(args.type))
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '查询内容块失败' }
  }
}

export async function handleGetScenicActivities(args: {
  tag?: string
}): Promise<ToolExecutionResult> {
  try {
    const data = await unwrapApi(fetchActivities(args.tag ? { tag: args.tag } : undefined))
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '查询园区项目失败' }
  }
}

export async function handleGetCommonVisitors(): Promise<ToolExecutionResult> {
  try {
    const data = await unwrapApi(fetchCommonVisitors())
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '查询常用游客失败' }
  }
}

export async function handleIssueCoupon(args: {
  couponProductId: string
  purpose?: 'claim' | 'purchase'
}): Promise<ToolExecutionResult> {
  try {
    const purpose =
      args.purpose ??
      (args.couponProductId === NEW_GUEST_COUPON_PRODUCT_ID ? 'claim' : 'purchase')
    const { data: res } = await issueCouponApi(args.couponProductId, purpose)
    if (res.code !== 200 || !res.data) {
      if (res.message === 'NOT_ELIGIBLE_PERSONA') {
        return { success: false, error: NEW_GUEST_COUPON_COPY.notEligiblePersona }
      }
      if (res.message === 'CLAIM_WINDOW_EXPIRED') {
        return { success: false, error: formatClaimWindowExpiredCopy() }
      }
      return { success: false, error: res.message || '发券失败' }
    }
    return { success: true, data: res.data, issueReason: res.message }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '发券失败' }
  }
}

export async function handleCreateOrderDraft(args: {
  productId?: string
  ticketType?: string
  couponId?: string
  visitorIdNumbers?: string[]
  visitDate?: string
  quantity?: { adult: number; child: number }
  originalAmount?: number
  items?: Array<{
    productId: string
    quantity: { adult: number; child: number }
  }>
}): Promise<ToolExecutionResult> {
  try {
    const data = await unwrapApi(
      createOrderDraft({
        productId: args.productId,
        ticketType: args.ticketType as TicketTypeId | undefined,
        couponId: args.couponId,
        visitorIdNumbers: args.visitorIdNumbers,
        visitDate: args.visitDate,
        quantity: args.quantity,
        originalAmount: args.originalAmount,
        items: args.items,
      }),
    )
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '创建订单草稿失败' }
  }
}
