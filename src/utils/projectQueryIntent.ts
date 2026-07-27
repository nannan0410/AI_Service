import { shouldRunQueueRecommendWorkflow } from '@/utils/queueRecommendIntent'
import { shouldRunShowScheduleWorkflow } from '@/utils/showScheduleIntent'

/** 项目名 / 位置查询（过山车在哪、附近好玩等） */
export function shouldRunProjectQueryWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false
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

  if (
    /在哪|在哪儿|哪里|位置|怎么走过去|怎么去找/.test(text) &&
    !/停车|交通|入园|攻略|怎么去景区|怎么到景区/.test(text)
  ) {
    return true
  }
  if (/附近.{0,6}(?:好玩|推荐|项目|有什么)|周围.{0,4}(?:好玩|项目)/.test(text)) {
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
