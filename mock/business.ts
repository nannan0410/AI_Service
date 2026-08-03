import type { MockMethod } from 'vite-plugin-mock'
import {
  createOrderDraft,
  generateTravelGuide,
  getCommonVisitors,
  getOrderDraft,
  getSnapshot,
  issueCoupon,
  applyBatchInvoice,
  listCheckinSpots,
  parsePersonaFromAuthHeader,
  submitCheckin,
  submitOrderFromDraft,
  submitReview,
  getVirtualQueueCatalog,
  takeVirtualQueue,
  ticketProducts,
  updateOrderDraftVisitors,
  getQuizSet,
  listScenicStars,
  findScenicStarByMessage,
  buildQuizInvite,
  startQuiz,
  submitQuizAnswer,
  isQuizCompleted,
} from './_utils'
import activities from '../src/mock/activities.json'
import parkingConfig from '../src/mock/parking.json'
import { getScenicIdFromHeaders } from './rules'
import {
  filterByBusinessScenicId,
  filterCouponsByScenic,
  resolveBusinessScenicId,
} from '../src/utils/scenicScope'

function requirePersona(headers: Record<string, unknown>) {
  return parsePersonaFromAuthHeader(headers.authorization as string | undefined)
}

export default [
  {
    url: '/api/tickets/catalog',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const scenicId = getScenicIdFromHeaders(headers)
      const list = filterByBusinessScenicId(
        ticketProducts.filter((item) => item.channels.includes('self')),
        scenicId,
      )
      return { code: 200, data: list }
    },
  },
  {
    url: '/api/activities',
    method: 'get',
    response: ({
      headers,
      query,
    }: {
      headers: Record<string, unknown>
      query: Record<string, string>
    }) => {
      const scenicId = getScenicIdFromHeaders(headers)
      let list = filterByBusinessScenicId(
        [...activities] as import('../src/types').Activity[],
        scenicId,
      )
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
      const scenicId = getScenicIdFromHeaders(headers)
      let coupons = filterCouponsByScenic(getSnapshot(personaId).visitorState.coupons, scenicId)
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
      const scenicId = getScenicIdFromHeaders(headers)
      const orders = filterByBusinessScenicId(getSnapshot(personaId).orders, scenicId)
      return { code: 200, data: orders }
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
        items?: Array<{
          productId: string
          quantity: { adult: number; child: number }
        }>
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
        items: body?.items,
        scenicId: getScenicIdFromHeaders(headers),
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
      return {
        code: 200,
        data: generateTravelGuide(personaId, {
          scope,
          scenicId: getScenicIdFromHeaders(headers),
        }),
      }
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
        scenicId: resolveBusinessScenicId(getScenicIdFromHeaders(headers)),
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
      const result = applyBatchInvoice(personaId, [orderId], getScenicIdFromHeaders(headers))
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
      const result = applyBatchInvoice(
        personaId,
        body?.orderIds ?? [],
        getScenicIdFromHeaders(headers),
      )
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
        scenicId: getScenicIdFromHeaders(headers),
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
    url: '/api/checkin/spots',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      return { code: 200, data: listCheckinSpots(personaId, getScenicIdFromHeaders(headers)) }
    },
  },
  {
    url: '/api/checkin',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { spotId?: string }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const spotId = body?.spotId?.trim()
      if (!spotId) return { code: 400, message: '缺少打卡点', data: null }
      const result = submitCheckin(personaId, spotId, getScenicIdFromHeaders(headers))
      if (!result.ok) return { code: 400, message: result.message, data: null }
      return { code: 200, data: result.data }
    },
  },
  {
    url: '/api/virtual-queue/catalog',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      return {
        code: 200,
        data: getVirtualQueueCatalog(personaId, getScenicIdFromHeaders(headers)),
      }
    },
  },
  {
    url: '/api/virtual-queue/take',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { activityId?: string }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const activityId = body?.activityId?.trim()
      if (!activityId) return { code: 400, message: '缺少项目', data: null }
      const result = takeVirtualQueue(
        personaId,
        activityId,
        'free',
        getScenicIdFromHeaders(headers),
      )
      if (!result.ok) return { code: 400, message: result.message, data: null }
      return { code: 200, data: result.data }
    },
  },
  {
    url: '/api/virtual-queue/pay',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { activityId?: string }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const activityId = body?.activityId?.trim()
      if (!activityId) return { code: 400, message: '缺少项目', data: null }
      const result = takeVirtualQueue(
        personaId,
        activityId,
        'paid',
        getScenicIdFromHeaders(headers),
      )
      if (!result.ok) return { code: 400, message: result.message, data: null }
      return { code: 200, data: result.data }
    },
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
  {
    url: '/api/stars',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const scenicId = getScenicIdFromHeaders(headers)
      return { code: 200, data: listScenicStars(scenicId) }
    },
  },
  {
    url: '/api/stars/match',
    method: 'get',
    response: ({
      headers,
      query,
    }: {
      headers: Record<string, unknown>
      query: Record<string, string>
    }) => {
      const scenicId = getScenicIdFromHeaders(headers)
      const star = findScenicStarByMessage(query.q || '', scenicId)
      if (!star) return { code: 200, data: null }
      const personaId = requirePersona(headers)
      const quizInvite =
        personaId && star.quizId ? buildQuizInvite(personaId, star.quizId) : undefined
      return { code: 200, data: { ...star, quizInvite } }
    },
  },
  {
    url: '/api/quiz/detail',
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
      const quiz = getQuizSet(query.quizId || '')
      if (!quiz) return { code: 404, message: '题集不存在', data: null }
      return {
        code: 200,
        data: {
          ...quiz,
          completed: isQuizCompleted(personaId, quiz.quizId),
          // 不把 correctKey 暴露给前端作答前窥看——仍返回完整题供演示；正式环境可裁剪
        },
      }
    },
  },
  {
    url: '/api/quiz/invite',
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
      return {
        code: 200,
        data: buildQuizInvite(personaId, query.quizId || '') ?? null,
      }
    },
  },
  {
    url: '/api/quiz/start',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { quizId?: string }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const result = startQuiz(personaId, body.quizId || '')
      if (!result.ok) {
        return {
          code: result.alreadyCompleted ? 409 : 400,
          message: result.message,
          data: { alreadyCompleted: result.alreadyCompleted === true },
        }
      }
      const q = result.quiz.questions[result.questionIndex]
      return {
        code: 200,
        data: {
          quizId: result.quiz.quizId,
          title: result.quiz.title,
          questionIndex: result.questionIndex,
          totalQuestions: result.quiz.questions.length,
          questionId: q.questionId,
          question: q.question,
          options: q.options,
        },
      }
    },
  },
  {
    url: '/api/quiz/answer',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { quizId?: string; questionIndex?: number; optionKey?: string }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const result = submitQuizAnswer(
        personaId,
        body.quizId || '',
        Number(body.questionIndex ?? -1),
        body.optionKey || '',
      )
      return { code: 200, data: result }
    },
  },
] as MockMethod[]
