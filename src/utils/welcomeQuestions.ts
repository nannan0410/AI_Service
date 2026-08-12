import type { Coupon, PersonaId } from '@/types'
import type { RuleExpression, WelcomeQuestionConfig, WelcomeTemplateConfig } from '@/types/businessConfig'
import { filterNewGuestClaimWelcomeItems } from '@/utils/newGuestCoupon'
import {
  buildDemoRuleContext,
  type DemoRuleLiveOverrides,
} from '@/utils/demoRuleContext'
import { evaluateRules } from '@/utils/ruleEngine'
import { matchesScenicScope } from '@/utils/scenicScope'
import {
  buildWelcomeTemplateVars,
  replaceWelcomePlaceholders,
  type WelcomeTemplateVarContext,
} from '@/utils/welcomeTemplateVars'
import { MAX_WELCOME_RECOMMEND } from '@/utils/welcomeLayout'

/** @deprecated 请使用 MAX_WELCOME_RECOMMEND；保持导出兼容 */
export const MAX_SUGGESTED_QUESTIONS = MAX_WELCOME_RECOMMEND

function cloneRules(rules: RuleExpression[] | undefined): RuleExpression[] {
  return (rules ?? []).map((rule) => {
    if (rule.op === 'in') {
      return { op: 'in' as const, field: rule.field, values: [...(rule.values ?? [])] }
    }
    if (rule.op === 'and' || rule.op === 'or') {
      return {
        op: rule.op,
        rules: rule.rules.map((child) => ({ ...child })),
      }
    }
    return { ...rule }
  })
}

export function cloneWelcomeQuestions(
  questions: WelcomeQuestionConfig[],
): WelcomeQuestionConfig[] {
  return questions.map((question) => ({
    ...question,
    scenicIds: question.scenicIds ? [...question.scenicIds] : undefined,
    targetPath: question.targetPath,
    pinTop: question.pinTop === true,
    target: question.target,
    rules: cloneRules(question.rules),
    enabled: question.enabled !== false,
    priority: question.priority ?? 0,
  }))
}

export function cloneWelcomeTemplates(
  templates: WelcomeTemplateConfig[],
): WelcomeTemplateConfig[] {
  return templates.map((template) => ({
    ...template,
    scenicIds: template.scenicIds ? [...template.scenicIds] : undefined,
    highlights: [...(template.highlights ?? [])],
    suggestedQuestions: [],
  }))
}

/** 旧版：问题挂在 persona 模板下 → 抽出并补 personaId 规则 */
export function extractWelcomeQuestionsFromTemplates(
  templates: WelcomeTemplateConfig[],
): WelcomeQuestionConfig[] {
  const list: WelcomeQuestionConfig[] = []
  for (const template of templates) {
    for (const question of template.suggestedQuestions ?? []) {
      const hasRules = Array.isArray(question.rules) && question.rules.length > 0
      list.push({
        ...question,
        enabled: question.enabled !== false,
        priority: question.priority ?? 0,
        rules: hasRules
          ? cloneRules(question.rules)
          : [{ op: 'eq', field: 'personaId', value: template.personaId }],
      })
    }
  }
  return list
}

export function resolveWelcomeQuestionPlaceholders(
  question: WelcomeQuestionConfig,
  ctx: WelcomeTemplateVarContext,
): WelcomeQuestionConfig {
  const vars = buildWelcomeTemplateVars(ctx)
  return {
    ...question,
    text: replacePlaceholders(question.text, vars),
    desc: question.desc ? replacePlaceholders(question.desc, vars) : question.desc,
    prompt: replacePlaceholders(question.prompt, vars),
  }
}

function replacePlaceholders(
  text: string,
  vars: ReturnType<typeof buildWelcomeTemplateVars>,
): string {
  return replaceWelcomePlaceholders(text, vars)
}

/**
 * 置顶项强制第一：命中列表中 pinTop 取 priority 最高一条置顶，其余按 priority 降序
 */
export function sortWelcomeQuestionsWithPin(
  questions: WelcomeQuestionConfig[],
): WelcomeQuestionConfig[] {
  const byPriority = (a: WelcomeQuestionConfig, b: WelcomeQuestionConfig) =>
    (b.priority ?? 0) - (a.priority ?? 0)

  const pinned = questions.filter((item) => item.pinTop === true).sort(byPriority)
  const top = pinned[0]
  if (!top) {
    return [...questions].sort(byPriority)
  }
  const rest = questions.filter((item) => item.id !== top.id).sort(byPriority)
  return [top, ...rest]
}

/** 按规则过滤游游推荐（与快捷服务同一套 evaluateRules） */
export function resolveSuggestedQuestions(
  questions: WelcomeQuestionConfig[],
  personaId: PersonaId,
  couponCtx: {
    personaId: PersonaId | string | null
    coupons: Coupon[]
    registeredAt?: string
  },
  welcomeCtx?: WelcomeTemplateVarContext,
): WelcomeQuestionConfig[] {
  const live: DemoRuleLiveOverrides = {
    coupons: couponCtx.coupons,
    registeredAt: couponCtx.registeredAt,
    orders: welcomeCtx?.orders,
    nickname: welcomeCtx?.nickname,
    scenicId: welcomeCtx?.scenicId ?? null,
    inPark: welcomeCtx?.inPark,
  }
  const ctx = buildDemoRuleContext(personaId, live)
  const matched = questions
    .filter((question) => question.enabled !== false)
    .filter((question) => matchesScenicScope(question, ctx.scenicId))
    .filter((question) => evaluateRules(question.rules ?? [], ctx))

  const sorted = sortWelcomeQuestionsWithPin(matched)
  const filtered = filterNewGuestClaimWelcomeItems(sorted, couponCtx).slice(
    0,
    MAX_SUGGESTED_QUESTIONS,
  )

  if (!welcomeCtx) return filtered
  return filtered.map((question) =>
    resolveWelcomeQuestionPlaceholders(question, welcomeCtx),
  )
}

/** 预览：命中 / 未命中 */
export function previewWelcomeQuestions(
  questions: WelcomeQuestionConfig[],
  personaId: PersonaId,
  live?: DemoRuleLiveOverrides,
): { matched: WelcomeQuestionConfig[]; unmatched: WelcomeQuestionConfig[] } {
  const ctx = buildDemoRuleContext(personaId, live)
  const enabled = questions
    .filter((question) => question.enabled !== false)
    .filter((question) => matchesScenicScope(question, ctx.scenicId))
  const matched = sortWelcomeQuestionsWithPin(
    enabled.filter((question) => evaluateRules(question.rules ?? [], ctx)),
  )
  const matchedIds = new Set(matched.map((item) => item.id))
  const unmatched = enabled.filter((item) => !matchedIds.has(item.id))
  return { matched, unmatched }
}

export function findQuestionIndex(
  questions: WelcomeQuestionConfig[],
  questionId: string,
): number {
  return questions.findIndex((item) => item.id === questionId)
}
