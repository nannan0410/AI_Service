import { shouldRunQueueRecommendWorkflow } from '@/utils/queueRecommendIntent'
import { shouldRunShowScheduleWorkflow } from '@/utils/showScheduleIntent'
import {
  isDiningRecommendIntent,
  isRetailRecommendIntent,
} from '@/utils/proactiveMarketingIntent'

/** 园内今日路线话术（与 travelGuideIntent.isInParkRouteIntent 对齐，避免循环依赖） */
function isTodayRouteGuideUtterance(text: string): boolean {
  if (
    /现在先玩哪里|根据当前位置和排队情况推荐今日路线|根据我在园状态安排今日游玩路线/.test(
      text,
    )
  ) {
    return true
  }
  const inParkCue =
    /在园区内|在园里|在景区里|在园内|园内游玩|在园状态|我现在在园/.test(text)
  const routeCue =
    /今日路线|今日游玩路线|现在先玩|根据当前位置|排队情况|安排今日游玩|游玩路线|先玩哪里/.test(
      text,
    )
  return inParkCue && routeCue
}

/** 项目名 / 位置查询（过山车在哪、附近好玩等） */
export function shouldRunProjectQueryWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  // 餐饮/零售交给 proactive_marketing，避免「附近美食」被抢成游乐项目
  if (isDiningRecommendIntent(text) || isRetailRecommendIntent(text)) {
    return false
  }
  // 「当前位置…推荐今日路线」交给 travel_guide 单条攻略，勿拆成多条项目卡
  if (isTodayRouteGuideUtterance(text)) {
    return false
  }
  // 纯打开地图留给 map_guide
  if (
    /打开地图|查看地图|园区地图|导览地图|看下地图|看一下地图|在地图上看|地图上看看/.test(
      text,
    ) &&
    !/在哪|附近|过山车|漂流|项目/.test(text)
  ) {
    return false
  }
  if (shouldRunQueueRecommendWorkflow(text)) return false
  if (shouldRunShowScheduleWorkflow(text)) return false

  // 问「在哪」；「位置」须贴近项目语境，避免「当前位置」误伤今日路线
  if (
    (/在哪|在哪儿|哪里|怎么走过去|怎么去找/.test(text) ||
      /(?:项目|景点|设施|过山车|漂流|萌宠).{0,6}位置|位置(?:在哪|哪里|怎么样)/.test(
        text,
      )) &&
    !/停车|交通|入园|攻略|怎么去景区|怎么到景区|今日路线|游玩路线/.test(text)
  ) {
    return true
  }
  if (/附近.{0,6}(?:好玩|推荐|项目|有什么)|周围.{0,4}(?:好玩|项目)|周边.{0,4}(?:好玩|项目|推荐)/.test(text)) {
    return true
  }
  if (
    /(?:有什么|哪些).{0,6}(?:项目|好玩)|适合(?:小孩|孩子|儿童).{0,6}(?:项目|玩)/.test(
      text,
    )
  ) {
    return true
  }
  if (
    /(过山车|漂流|萌宠|摩天轮|碰碰车|旋转木马|激流|灯光秀|花车|儿童城堡|4D|影院)/.test(
      text,
    ) &&
    /(在哪|开放|排队|怎么样|介绍|好玩吗|去哪|怎么玩)/.test(text)
  ) {
    return true
  }
  return false
}
