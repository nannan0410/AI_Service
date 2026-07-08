import type { Order } from '@/types'

export function formatIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getTodayIsoDate(ref = new Date()): string {
  return formatIsoDate(ref)
}

export function isTravelOrder(order: Order): boolean {
  return order.status === 'paid' || order.status === 'pending'
}

/** 已支付/待支付且出行日在今天或之后 */
export function isUpcomingVisitOrder(order: Order, ref = new Date()): boolean {
  if (!isTravelOrder(order) || !order.visitDate) return false
  return order.visitDate >= getTodayIsoDate(ref)
}

export function getUpcomingVisitOrders(orders: Order[], ref = new Date()): Order[] {
  return orders
    .filter((order) => isUpcomingVisitOrder(order, ref))
    .sort((a, b) => a.visitDate!.localeCompare(b.visitDate!))
}

export function pickNearestUpcomingVisitOrder(
  orders: Order[],
  ref = new Date(),
): Order | undefined {
  return getUpcomingVisitOrders(orders, ref)[0]
}

export function hasVisitToday(orders: Order[], ref = new Date()): boolean {
  const today = getTodayIsoDate(ref)
  return orders.some(
    (order) => isTravelOrder(order) && order.visitDate === today,
  )
}
