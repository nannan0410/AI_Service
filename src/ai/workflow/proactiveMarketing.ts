import { fetchActivities, fetchCheckinSpots, fetchCoupons, fetchMemberInfo, issueCoupon } from '@/api/business'
import {
  isNonTicketOrderIntent,
  resolveProactiveMarketingScene,
  shouldRunProactiveMarketingWorkflow,
  type ProactiveMarketingScene,
} from '@/utils/proactiveMarketingIntent'
import {
  buildAvailableCouponRecommendResult,
  buildCouponCardPayload,
  buildCouponRecommendChatResult,
  resolveClaimableCouponPreviews,
} from '@/utils/couponRecommend'
import { activityToCardPayload } from '@/utils/activityDisplay'
import { useAuthStore } from '@/store/authStore'
import type {
  Activity,
  ChatMessageDraft,
  Coupon,
  LlmChatResult,
  SceneRecommendPayload,
  ToolExecutionCallbacks,
} from '@/types'

export { shouldRunProactiveMarketingWorkflow }

const DINING_COUPON_PRODUCT_ID = 'cp_prod_dining_guide'
const RETAIL_COUPON_PRODUCT_ID = 'cp_prod_retail_guide'

function findAvailableByProduct(coupons: Coupon[], productId: string): Coupon | undefined {
  return coupons.find(
    (item) => item.couponProductId === productId && item.status === 'available',
  )
}

async function loadMemberCtx() {
  const authStore = useAuthStore()
  let memberLevel: string | undefined
  let registeredAt: string | undefined
  try {
    const { data: res } = await fetchMemberInfo()
    if (res.code === 200) {
      memberLevel = res.data.level
      registeredAt = res.data.registeredAt
    }
  } catch {
    // ignore
  }
  return {
    personaId: authStore.personaId,
    memberLevel,
    registeredAt,
  }
}

/** 是否在园（餐饮/零售推券门槛） */
async function resolveInPark(): Promise<boolean> {
  try {
    const { data: res } = await fetchCheckinSpots()
    return res.code === 200 && res.data.inPark === true
  } catch {
    return false
  }
}

async function ensureSceneCoupon(
  productId: string,
  coupons: Coupon[],
  callbacks?: ToolExecutionCallbacks,
): Promise<{ coupons: Coupon[]; coupon?: Coupon }> {
  const existing = findAvailableByProduct(coupons, productId)
  if (existing) {
    return { coupons, coupon: existing }
  }

  callbacks?.onToolStart?.('issueCoupon', '发放专属优惠券')
  try {
    const { data: res } = await issueCoupon(productId, 'purchase')
    callbacks?.onToolDone?.('issueCoupon', res.code === 200)
    if (res.code !== 200 || !res.data) {
      return { coupons }
    }
    const { data: listRes } = await fetchCoupons('available')
    const refreshed = listRes.code === 200 ? listRes.data : [res.data, ...coupons]
    const issued = findAvailableByProduct(refreshed, productId) ?? res.data
    return { coupons: refreshed, coupon: issued }
  } catch {
    callbacks?.onToolDone?.('issueCoupon', false)
    return { coupons }
  }
}

function buildSceneRecommendCard(
  scene: 'dining' | 'retail',
  intro: string,
  coupon: Coupon | undefined,
  activities: Activity[],
  reason: string,
  inPark: boolean,
): ChatMessageDraft {
  const payload: SceneRecommendPayload = {
    scene,
    coupon: coupon
      ? buildCouponCardPayload(coupon, 'view', false)
      : undefined,
    activities: activities.slice(0, 3).map((activity) =>
      activityToCardPayload(activity, {
        reason,
        guideContext: inPark ? 'in_park' : 'pre_visit',
      }),
    ),
  }

  return {
    type: 'scene_recommend',
    role: 'assistant',
    content: intro,
    payload,
  }
}

async function runDiningOrRetailScene(
  scene: Extract<
    ProactiveMarketingScene,
    'dining' | 'retail' | 'order_intent_dining' | 'order_intent_retail'
  >,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const isDining = scene === 'dining' || scene === 'order_intent_dining'
  const category = isDining ? 'dining' : 'retail'
  const productId = isDining ? DINING_COUPON_PRODUCT_ID : RETAIL_COUPON_PRODUCT_ID
  const label = isDining ? '餐饮' : '零售'
  const isOrder = scene.startsWith('order_intent')
  const inPark = await resolveInPark()

  callbacks?.onToolStart?.('getScenicActivities', `查询${label}推荐`)
  let activities: Activity[] = []
  try {
    const { data: res } = await fetchActivities({ category })
    callbacks?.onToolDone?.('getScenicActivities', res.code === 200)
    if (res.code === 200) activities = res.data
  } catch {
    callbacks?.onToolDone?.('getScenicActivities', false)
  }

  /** 仅在园才推送/展示餐饮·零售场景券；园外只做项目推荐 */
  let coupon: Coupon | undefined
  const toolCallsUsed = ['getScenicActivities']
  if (inPark) {
    callbacks?.onToolStart?.('getCoupons', '查询可用优惠券')
    let coupons: Coupon[] = []
    try {
      const { data: res } = await fetchCoupons('available')
      callbacks?.onToolDone?.('getCoupons', res.code === 200)
      if (res.code === 200) coupons = res.data
    } catch {
      callbacks?.onToolDone?.('getCoupons', false)
    }
    toolCallsUsed.push('getCoupons', 'issueCoupon')
    const issued = await ensureSceneCoupon(productId, coupons, callbacks)
    coupon = issued.coupon
  }

  const intro = !inPark
    ? activities.length
      ? `为您推荐以下${label}（入园后可领取专属优惠券）：`
      : `暂时没有更多${label}推荐，入园后可为您推送专属优惠。`
    : isOrder
      ? activities.length
        ? `看您有购买意向，已推荐${activities.length}处${label}，并送上优惠券：`
        : `看您有购买意向，先送上${label}优惠券方便下单：`
      : activities.length
        ? `为您推荐以下${label}，并附上可用优惠：`
        : `暂时没有更多${label}推荐，先送上优惠券供您使用：`

  if (!coupon && !activities.length) {
    return {
      content: inPark
        ? `暂时无法获取${label}推荐与优惠，请稍后在「优惠券」页查看。`
        : `暂时无法获取${label}推荐，请稍后再试。`,
      skillId: 'proactive_marketing',
      toolCallsUsed,
    }
  }

  return {
    content: '',
    skillId: 'proactive_marketing',
    toolCallsUsed,
    cards: [
      buildSceneRecommendCard(
        isDining ? 'dining' : 'retail',
        intro,
        coupon,
        activities,
        isDining ? '园内热门餐饮' : '园内热门零售',
        inPark,
      ),
    ],
  }
}

export async function runProactiveMarketingWorkflow(
  message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const scene = resolveProactiveMarketingScene(message) ?? 'coupon_query'

  if (scene !== 'coupon_query') {
    return runDiningOrRetailScene(scene, callbacks)
  }

  callbacks?.onToolStart?.('getCoupons', '查询可用优惠')
  try {
    const { data: res } = await fetchCoupons()
    callbacks?.onToolDone?.('getCoupons', res.code === 200)
    if (res.code !== 200) {
      return {
        content: '暂时无法获取优惠信息，请稍后在「优惠券」页查看。',
        skillId: 'proactive_marketing',
        toolCallsUsed: ['getCoupons'],
      }
    }

    const member = await loadMemberCtx()
    const claimable = resolveClaimableCouponPreviews({
      ...member,
      coupons: res.data,
    })

    if (isNonTicketOrderIntent(message) && claimable.length) {
      return {
        ...buildCouponRecommendChatResult(
          '看您有购买意向，为您推荐以下可领取优惠券，领取后下单即可使用：',
          claimable,
          { claimable: true },
        ),
        skillId: 'proactive_marketing',
        toolCallsUsed: ['getCoupons'],
      }
    }

    const recommend = buildAvailableCouponRecommendResult(res.data, claimable)
    return {
      ...recommend,
      skillId: 'proactive_marketing',
      toolCallsUsed: ['getCoupons'],
    }
  } catch {
    callbacks?.onToolDone?.('getCoupons', false)
    return {
      content: '暂时无法获取优惠信息，请稍后在「优惠券」页查看。',
      skillId: 'proactive_marketing',
      toolCallsUsed: ['getCoupons'],
    }
  }
}
