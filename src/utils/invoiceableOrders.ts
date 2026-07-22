import type { Order } from '@/types'

const INVOICE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000

/** 90 天内已完成且未开票的自营等可开票订单（不含 OTA/TA 只读渠道的改签逻辑） */
export function filterInvoiceableOrders(orders: Order[], now = Date.now()): Order[] {
  return orders.filter((order) => {
    if (order.status !== 'completed' || order.invoiceStatus !== 'none') return false
    const completed = order.completedAt ? new Date(order.completedAt).getTime() : 0
    return completed > 0 && now - completed <= INVOICE_WINDOW_MS
  })
}

export function sumOrderAmounts(orders: Order[]): number {
  return orders.reduce((sum, order) => sum + order.totalAmount, 0)
}
