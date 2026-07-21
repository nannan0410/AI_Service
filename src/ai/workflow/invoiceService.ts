import { fetchOrders } from '@/api/business'
import { filterInvoiceableOrders } from '@/utils/invoiceableOrders'
import { shouldRunInvoiceWorkflow } from '@/utils/invoiceIntent'
import type {
  LlmChatResult,
  Order,
  PageGuideCardPayload,
  ToolExecutionCallbacks,
} from '@/types'

export { shouldRunInvoiceWorkflow }

const INVOICE_BATCH_PATH = '/invoice/batch'

export async function runInvoiceServiceWorkflow(
  _message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  callbacks?.onToolStart?.('getOrders', '查询可开票订单')
  let orders: Order[] = []
  try {
    const { data: res } = await fetchOrders()
    callbacks?.onToolDone?.('getOrders', res.code === 200)
    if (res.code === 200) orders = res.data
  } catch {
    callbacks?.onToolDone?.('getOrders', false)
    return {
      content: '暂时无法查询订单，请稍后在「发票申请」页重试。',
      skillId: 'invoice_service',
      toolCallsUsed: ['getOrders'],
    }
  }

  const invoiceable = filterInvoiceableOrders(orders)

  if (!invoiceable.length) {
    return {
      content: '当前没有可申请开票的订单。',
      skillId: 'invoice_service',
      toolCallsUsed: ['getOrders'],
    }
  }

  const payload: PageGuideCardPayload = {
    title: '',
    path: INVOICE_BATCH_PATH,
    buttonLabel: '立即开票',
  }

  return {
    content: '',
    skillId: 'invoice_service',
    toolCallsUsed: ['getOrders'],
    cards: [
      {
        type: 'page_guide',
        role: 'assistant',
        content: `您当前有${invoiceable.length}笔订单可以申请开票`,
        payload,
      },
    ],
  }
}
