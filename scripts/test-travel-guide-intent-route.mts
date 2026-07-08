/**
 * 攻略子意图：正则明确命中不调 LLM
 * 运行: npx vite-node scripts/test-travel-guide-intent-route.mts
 */
import {
  isSpecificTravelGuideRegex,
  resolveTravelGuideIntentRoute,
} from '../src/ai/nlu/resolveTravelGuideIntent'
import { resolveTravelGuideIntent, travelGuideIntentToScope } from '../src/utils/travelGuideIntent'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(isSpecificTravelGuideRegex('交通指南'), '交通指南 is specific')
assert(isSpecificTravelGuideRegex('入园要带什么'), 'entry specific')
assert(isSpecificTravelGuideRegex('按订单做游玩攻略'), 'full specific')
assert(isSpecificTravelGuideRegex('帮我生成游玩攻略'), 'recommend specific')
assert(
  isSpecificTravelGuideRegex('我现在在园区内，请根据当前位置和排队情况推荐今日路线。'),
  'in_park specific',
)
assert(!isSpecificTravelGuideRegex('出行指南'), '出行指南 is generic')

assert(resolveTravelGuideIntent('帮我生成游玩攻略') === 'recommend', 'plain 游玩攻略 → recommend')
assert(resolveTravelGuideIntent('按订单做游玩攻略') === 'full', '按订单 → full')
assert(
  resolveTravelGuideIntent('请根据我最近的待出行订单，做一份当天游玩攻略。') === 'full',
  '最近待出行当天攻略 → full',
)
assert(
  travelGuideIntentToScope('recommend') === 'recommend',
  'recommend scope mapping',
)

const r1 = await resolveTravelGuideIntentRoute('交通指南')
assert(r1.intent === 'traffic' && r1.source === 'regex', 'regex traffic')

const r2 = await resolveTravelGuideIntentRoute('入园须知')
assert(r2.intent === 'entry_notice' && r2.source === 'regex', 'regex entry')

const r3 = await resolveTravelGuideIntentRoute(
  '我现在在园区内，请根据当前位置和排队情况推荐今日路线。',
)
assert(r3.intent === 'in_park' && r3.source === 'regex', 'regex in_park')

const r4 = await resolveTravelGuideIntentRoute('帮我生成游玩攻略')
assert(r4.intent === 'recommend' && r4.source === 'regex', 'regex recommend')

console.log('OK: travel guide intent route (regex path)')
