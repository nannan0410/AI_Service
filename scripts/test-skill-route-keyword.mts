/**
 * Skill 路由：关键词优先（不调 LLM）
 * 运行: npx vite-node scripts/test-skill-route-keyword.mts
 */
import { resolveSkillRoute } from '../src/ai/nlu/resolveSkillRoute'
import skills from '../src/mock/assistant/skills.json'
import type { AssistantSkillConfig } from '../src/types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const list = skills as AssistantSkillConfig[]

const r1 = await resolveSkillRoute('查一下我的订单', list)
assert(r1.source === 'keyword' && r1.skill?.skillId === 'order_query', 'keyword order')

const r2 = await resolveSkillRoute('怎么去景区', list)
assert(r2.source === 'keyword' && r2.skill?.skillId === 'travel_guide', 'keyword travel')

const r3 = await resolveSkillRoute('买票', list)
assert(r3.source === 'keyword' && r3.skill?.skillId === 'ticket_purchase', 'keyword ticket')

console.log('OK: keyword skill routing')
