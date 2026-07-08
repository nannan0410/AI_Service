import type { ToolExecutionCallbacks, ToolExecutionResult } from '@/types'
import {
  handleGetContentBlocks,
  handleGenerateTravelGuide,
  handleGetCommonVisitors,
  handleCreateOrderDraft,
  handleGetCoupons,
  handleGetMemberInfo,
  handleGetOrders,
  handleGetProductCatalog,
  handleGetScenicActivities,
  handleIssueCoupon,
} from './handlers'
import { getToolByName } from './registry'

type ToolHandler = (args: Record<string, unknown>) => Promise<ToolExecutionResult>

const handlerMap: Record<string, ToolHandler> = {
  getMemberInfo: () => handleGetMemberInfo(),
  getOrders: () => handleGetOrders(),
  getCoupons: (args) => handleGetCoupons({ status: args.status as string | undefined }),
  getProductCatalog: (args) =>
    handleGetProductCatalog({ channel: (args.channel as string | undefined) || 'self' }),
  generateTravelGuide: (args) =>
    handleGenerateTravelGuide({
      scope: args.scope as 'full' | 'in_park' | 'recommend' | undefined,
    }),
  getContentBlocks: (args) =>
    handleGetContentBlocks({ type: args.type as string | undefined }),
  getScenicActivities: (args) =>
    handleGetScenicActivities({ tag: args.tag as string | undefined }),
  getCommonVisitors: () => handleGetCommonVisitors(),
  issueCoupon: (args) =>
    handleIssueCoupon({
      couponProductId: String(args.couponProductId || ''),
      purpose: args.purpose === 'claim' ? 'claim' : 'purchase',
    }),
  createOrderDraft: (args) =>
    handleCreateOrderDraft({
      productId: args.productId as string | undefined,
      ticketType: args.ticketType as string | undefined,
      couponId: args.couponId as string | undefined,
      visitorIdNumbers: (args.visitorIdNumbers as string[]) ?? [],
    }),
}

export async function executeTool(
  name: string,
  argsJson: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<ToolExecutionResult> {
  const tool = getToolByName(name)
  if (!tool) {
    return { success: false, error: `未知 Tool: ${name}` }
  }

  const handler = handlerMap[name]
  if (!handler) {
    return { success: false, error: `Tool 尚未实现: ${name}` }
  }

  let args: Record<string, unknown> = {}
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {}
  } catch {
    return { success: false, error: `Tool 参数解析失败: ${name}` }
  }

  callbacks?.onToolStart?.(name, tool.label)

  try {
    const result = await handler(args)
    callbacks?.onToolDone?.(name, result.success)
    return result
  } catch (e) {
    callbacks?.onToolDone?.(name, false)
    return { success: false, error: e instanceof Error ? e.message : 'Tool 执行异常' }
  }
}
