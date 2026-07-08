import assert from 'node:assert/strict'
import defaultWelcome from '../src/mock/assistant/welcome_templates.json' with { type: 'json' }
import demoMid from '../src/mock/users/demo_mid.json' with { type: 'json' }
import type { Order } from '../src/types/index.ts'
import {
  coalesceDynamicWelcomeTemplate,
  hasWelcomePlaceholders,
} from '../src/utils/adminBusinessConfig.ts'
import type { WelcomeTemplateConfig } from '../src/types/businessConfig.ts'
import {
  buildWelcomeTemplateVars,
  resolveWelcomeTemplate,
} from '../src/utils/welcomeTemplateVars.ts'

const base = (defaultWelcome as WelcomeTemplateConfig[]).find(
  (item) => item.personaId === 'demo_mid',
)!
const staleOverride: WelcomeTemplateConfig = {
  ...base,
  subtitle: '2026-06-15 待出行订单已就绪',
  body: '我是{{nickname}}，您有 2026-06-15 的待出行订单。',
  highlights: ['2026-06-15 待出行订单'],
}

assert.equal(hasWelcomePlaceholders(base.subtitle), true)
const coalesced = coalesceDynamicWelcomeTemplate(base, staleOverride)
assert.equal(coalesced.subtitle, '{{pendingVisitSubtitle}}')

const orders = demoMid.orders as Order[]
const onVisitDay = new Date(2026, 5, 30, 10, 0, 0)
const vars = buildWelcomeTemplateVars({ orders, ref: onVisitDay })
assert.equal(vars.pendingVisitSubtitle, '今日出行 · 共 3 笔待出行')

const resolved = resolveWelcomeTemplate(coalesced, { orders, ref: onVisitDay })
assert.equal(resolved.subtitle, '今日出行 · 共 3 笔待出行')

const beforeVisit = new Date(2026, 5, 29, 10, 0, 0)
const futureVars = buildWelcomeTemplateVars({ orders, ref: beforeVisit })
assert.equal(futureVars.pendingVisitSubtitle, '2026-06-30 待出行')

console.log('test-welcome-subtitle: ok')
