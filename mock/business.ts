import type { MockMethod } from 'vite-plugin-mock'
import {
  createOrderDraft,
  generateTravelGuide,
  getCommonVisitors,
  getOrderDraft,
  getSnapshot,
  issueCoupon,
  applyBatchInvoice,
  parsePersonaFromAuthHeader,
  submitOrderFromDraft,
  submitReview,
  ticketProducts,
  updateOrderDraftVisitors,
} from './_utils'
import activities from '../src/mock/activities.json'
import parkingConfig from '../src/mock/parking.json'

function requirePersona(headers: Record<string, unknown>) {
  return parsePersonaFromAuthHeader(headers.authorization as string | undefined)
}

export default [
  {
    url: '/api/tickets/catalog',
    method: 'get',
    response: () => ({
      code: 200,
      data: ticketProducts.filter((item) => item.channels.includes('self')),
    }),
  },
  {
    url: '/api/activities',
    method: 'get',
    response: ({ query }: { query: Record<string, string> }) => {
      let list = [...activities] as import('../src/types').Activity[]
      const tag = query.tag
      const category = query.category
      if (category) {
        list = list.filter((item) => item.category === category)
      }
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
    url: '/api/member/visitors',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      return { code: 200, data: getCommonVisitors(personaId) }
    },
  },
  {
    url: '/api/coupons/issue',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { couponProductId?: string; purpose?: 'claim' | 'purchase' }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const purpose = body?.purpose === 'claim' ? 'claim' : 'purchase'
      const result = issueCoupon(personaId, body?.couponProductId || '', purpose)
      if (!result.ok) return { code: 400, message: result.message, data: null }
      return { code: 200, data: result.coupon, message: result.reason }
    },
  },
  {
    url: '/api/order/draft',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: {
        productId?: string
        ticketType?: string
        couponId?: string
        visitorIdNumbers?: string[]
        visitDate?: string
        quantity?: { adult: number; child: number }
        originalAmount?: number
      }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const result = createOrderDraft(personaId, {
        productId: body?.productId,
        ticketType: body?.ticketType as import('../src/types/index').TicketTypeId | undefined,
        couponId: body?.couponId,
        visitorIdNumbers: body?.visitorIdNumbers,
        visitDate: body?.visitDate,
        quantity: body?.quantity,
        originalAmount: body?.originalAmount,
      })
      if (!result.ok) return { code: 400, message: result.message, data: null }
      return { code: 200, data: result.draft }
    },
  },
  {
    url: '/api/order/draft',
    method: 'get',
    response: ({
      headers,
      query,
    }: {
      headers: Record<string, unknown>
      query: Record<string, string>
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const draft = query.draftId ? getOrderDraft(personaId, query.draftId) : null
      if (!draft) return { code: 404, message: '草稿不存在', data: null }
      return { code: 200, data: draft }
    },
  },
  {
    url: '/api/order/draft',
    method: 'patch',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { draftId?: string; visitorIdNumbers?: string[] }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const draftId = body?.draftId?.trim()
      if (!draftId) return { code: 400, message: '缺少 draftId', data: null }
      const result = updateOrderDraftVisitors(personaId, draftId, body?.visitorIdNumbers ?? [])
      if (!result.ok) return { code: 400, message: result.message, data: null }
      return { code: 200, data: result.draft }
    },
  },
  {
    url: '/api/order/submit',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { draftId?: string }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const draftId = body?.draftId?.trim()
      if (!draftId) return { code: 400, message: '缺少 draftId', data: null }
      const result = submitOrderFromDraft(personaId, draftId)
      if (!result.ok) return { code: 400, message: result.message, data: null }
      return { code: 200, data: result.order }
    },
  },
  {
    url: '/api/travel/guide',
    method: 'get',
    response: ({
      headers,
      query,
    }: {
      headers: Record<string, unknown>
      query: Record<string, string>
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const scopeRaw = query.scope
      const scope =
        scopeRaw === 'in_park'
          ? 'in_park'
          : scopeRaw === 'full'
            ? 'full'
            : 'recommend'
      return { code: 200, data: generateTravelGuide(personaId, { scope }) }
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
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { orderId?: string }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const orderId = body?.orderId?.trim()
      if (!orderId) return { code: 400, message: '缺少订单号', data: null }
      const result = applyBatchInvoice(personaId, [orderId])
      if (!result.ok) return { code: 400, message: result.message, data: null }
      return {
        code: 200,
        data: {
          redirectUrl: `/invoice/external?orderId=${orderId}`,
        },
      }
    },
  },
  {
    url: '/api/invoice/batch',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { orderIds?: string[] }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const result = applyBatchInvoice(personaId, body?.orderIds ?? [])
      if (!result.ok) return { code: 400, message: result.message, data: null }
      return { code: 200, data: result }
    },
  },
  {
    url: '/api/reviews/submit',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: {
        orderId?: string
        rating?: number
        tags?: string[]
        content?: string
        imageIds?: string[]
      }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const rating = body?.rating
      if (rating == null) return { code: 400, message: '缺少评分', data: null }
      const result = submitReview(personaId, {
        orderId: body?.orderId,
        rating,
        tags: body?.tags,
        content: body?.content,
        imageIds: body?.imageIds,
      })
      if (!result.ok) return { code: 400, message: result.message, data: null }
      return {
        code: 200,
        data: {
          reviewId: result.reviewId,
          orderId: result.orderId,
          rewardIssued: result.rewardIssued,
          rewardCoupons: result.rewardCoupons,
        },
      }
    },
  },
  {
    url: '/api/reviews/upload',
    method: 'post',
    response: () => ({
      code: 200,
      data: { imageId: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` },
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
