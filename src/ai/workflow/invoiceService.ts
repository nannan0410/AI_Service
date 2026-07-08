import { fetchOrders } from '@/api/business'
import { filterInvoiceableOrders, sumOrderAmounts } from '@/utils/invoiceableOrders'
import { shouldRunInvoiceWorkflow } from '@/utils/invoiceIntent'
import type {
  LlmChatResult,
  Order,
  PageGuideCardPayload,
  ToolExecutionCallbacks,
} from '@/types'

export { shouldRunInvoiceWorkflow }

const INVOICE_PAGE_PATH = '/invoice'
const INVOICE_BATCH_PATH = '/invoice/batch'

function buildInvoiceGuide(
  invoiceable: Order[],
  preferBatch: boolean,
): { caption: string; payload: PageGuideCardPayload } {
  const count = invoiceable.length
  const total = sumOrderAmounts(invoiceable)
  const useBatch = preferBatch || count >= 2
  const path = useBatch ? INVOICE_BATCH_PATH : INVOICE_PAGE_PATH

  const payload: PageGuideCardPayload = {
    title: useBatch ? '批量开发票' : '发票申请',
    description: `共 ${count} 笔可开票订单，合计 ¥${total}（30 天内已完成且未开票）`,
    path,
    buttonLabel: useBatch ? '前往批量开发票' : '前往申请开票',
    tag: '游后服务',
  }

  const caption = useBatch
    ? `为您查到 ${count} 笔可开票订单，可在开票页勾选后一次性提交申请。`
    : `为您查到 ${count} 笔可开票订单，请填写抬头后提交开票申请。`

  return { caption, payload }
}

export async function runInvoiceServiceWorkflow(
  message: string,
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
  const preferBatch = /批量/.test(message)

  if (!invoiceable.length) {
    return {
      content:
        '您当前暂无 30 天内已完成且未开票的订单。如有疑问可先查看「我的订单」确认订单状态。',
      skillId: 'invoice_service',
      toolCallsUsed: ['getOrders'],
    }
  }

  const { caption, payload } = buildInvoiceGuide(invoiceable, preferBatch)

  return {
    content: '',
    skillId: 'invoice_service',
    toolCallsUsed: ['getOrders'],
    cards: [
      {
        type: 'page_guide',
        role: 'assistant',
        content: caption,
        payload,
      },
    ],
  }
}
