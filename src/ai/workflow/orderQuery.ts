import { fetchOrders } from '@/api/business'
import { buildOrderQueryCards, type ToolCallRecord } from '@/ai/tools/formatters'
import { shouldRunOrderQueryWorkflow } from '@/utils/orderQueryIntent'
import type { LlmChatResult, Order, ToolExecutionCallbacks } from '@/types'

export { shouldRunOrderQueryWorkflow } from '@/utils/orderQueryIntent'

async function unwrapApi<T>(request: Promise<{ data: { code: number; data: T; message?: string } }>): Promise<T> {
  const { data: res } = await request
  if (res.code !== 200) throw new Error(res.message || '请求失败')
  return res.data
}

function buildOrderQueryContent(orders: Order[]): string {
  if (!orders.length) {
    return '您目前还没有订单。如需购票，可以直接告诉我「两大一小有优惠吗」。'
  }

  const thirdParty = orders.filter((item) => item.source === 'ota' || item.source === 'ta')
  let content = `为您查到 ${orders.length} 笔订单，详见下方卡片。`
  if (thirdParty.length) {
    content +=
      ` 其中 ${thirdParty.length} 笔为第三方订单（OTA/TA），如需改签或退票请联系原购买平台，本助手无法代为办理。`
  }
  return content
}

export async function runOrderQueryWorkflow(
  _message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const toolRecords: ToolCallRecord[] = []

  callbacks?.onToolStart?.('getOrders', '查询订单')
  const orders = await unwrapApi(fetchOrders())
  toolRecords.push({ name: 'getOrders', result: { success: true, data: orders } })
  callbacks?.onToolDone?.('getOrders', true)

  return {
    content: buildOrderQueryContent(orders),
    skillId: 'order_query',
    toolCallsUsed: toolRecords.map((item) => item.name),
    cards: buildOrderQueryCards(orders),
  }
}

export { buildOrderQueryContent }
