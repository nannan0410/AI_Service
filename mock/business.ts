import type { MockMethod } from 'vite-plugin-mock'
import { getSnapshot, parsePersonaFromAuthHeader } from './_utils'
import tickets from '../src/mock/tickets.json'
import activities from '../src/mock/activities.json'
import parkingConfig from '../src/mock/parking.json'

function requirePersona(headers: Record<string, unknown>) {
  return parsePersonaFromAuthHeader(headers.authorization as string | undefined)
}

export default [
  {
    url: '/api/tickets/catalog',
    method: 'get',
    response: () => ({ code: 200, data: tickets }),
  },
  {
    url: '/api/activities',
    method: 'get',
    response: ({ query }: { query: Record<string, string> }) => {
      let list = [...activities]
      const tag = query.tag
      if (tag) {
        list = list.filter((item) => item.tags.includes(tag))
      }
      return { code: 200, data: list }
    },
  },
  {
    url: '/api/coupons',
    method: 'get',
    response: ({ headers, query }: { headers: Record<string, unknown>; query: Record<string, string> }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      let coupons = getSnapshot(personaId).visitorState.coupons
      if (query.status) {
        coupons = coupons.filter((c) => c.status === query.status)
      }
      return { code: 200, data: coupons }
    },
  },
  {
    url: '/api/order/list',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      return { code: 200, data: getSnapshot(personaId).orders }
    },
  },
  {
    url: '/api/order/create',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { ticketType?: string; ticketName?: string; totalAmount?: number; quantity?: { adult: number; child: number } }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const orderId = `ORD${Date.now()}`
      const order = {
        orderId,
        ticketType: body.ticketType || 'adult',
        ticketName: body.ticketName || '成人票',
        quantity: body.quantity || { adult: 1, child: 0 },
        totalAmount: body.totalAmount || 299,
        status: 'pending' as const,
        invoiceStatus: 'none' as const,
        createdAt: new Date().toISOString(),
      }
      return { code: 200, data: order }
    },
  },
  {
    url: '/api/parking/query',
    method: 'get',
    response: ({ headers, query }: { headers: Record<string, unknown>; query: Record<string, string> }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const plateNo = query.plateNo
      if (!plateNo) return { code: 400, message: '缺少车牌号', data: null }
      return {
        code: 200,
        data: {
          plateNo,
          amount: parkingConfig.defaultPlateFee,
          duration: '2小时15分',
          entryTime: '2026-06-01T10:00:00.000Z',
        },
      }
    },
  },
  {
    url: '/api/parking/pay',
    method: 'post',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      return { code: 200, data: { success: true, paidAmount: parkingConfig.defaultPlateFee } }
    },
  },
  {
    url: '/api/invoice/apply',
    method: 'post',
    response: ({ body }: { body: { orderId?: string } }) => ({
      code: 200,
      data: {
        redirectUrl: `/invoice/external?orderId=${body?.orderId || ''}`,
      },
    }),
  },
  {
    url: '/api/receipt/upload',
    method: 'post',
    response: () => ({ code: 200, data: { uploadId: `upl_${Date.now()}` } }),
  },
  {
    url: '/api/receipt/ocr',
    method: 'post',
    response: () => ({
      code: 200,
      data: {
        merchantName: '景区纪念品商店',
        amount: 88,
        receiptDate: new Date().toISOString().slice(0, 10),
        receiptNo: `RCP${Date.now()}`,
        pointsAwarded: 88,
      },
    }),
  },
] as MockMethod[]
