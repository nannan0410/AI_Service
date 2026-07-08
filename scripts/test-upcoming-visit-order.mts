import assert from 'node:assert/strict'
import demoMid from '../src/mock/users/demo_mid.json' with { type: 'json' }
import type { Order } from '../src/types/index.ts'
import {
  getUpcomingVisitOrders,
  hasVisitToday,
  pickNearestUpcomingVisitOrder,
} from '../src/utils/upcomingVisitOrder.ts'

const orders = demoMid.orders as Order[]

const onVisitDay = new Date(2026, 5, 30, 12, 0, 0)
assert.equal(getUpcomingVisitOrders(orders, onVisitDay).length, 3)
assert.equal(
  pickNearestUpcomingVisitOrder(orders, onVisitDay)?.visitDate,
  '2026-06-30',
)
assert.equal(hasVisitToday(orders, onVisitDay), true)

const afterVisitDay = new Date(2026, 6, 1, 12, 0, 0)
assert.equal(getUpcomingVisitOrders(orders, afterVisitDay).length, 2)
assert.equal(
  pickNearestUpcomingVisitOrder(orders, afterVisitDay)?.visitDate,
  '2026-07-30',
)
assert.equal(hasVisitToday(orders, afterVisitDay), false)

console.log('test-upcoming-visit-order: ok')
