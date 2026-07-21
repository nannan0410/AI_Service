import type { AssistantSkillConfig } from '@/types'
import type {
  AdminBusinessPatch,
  RecommendEntryConfig,
  WelcomeQuestionConfig,
  WelcomeTemplateConfig,
} from '@/types/businessConfig'

const ADMIN_BUSINESS_OVERRIDE_KEY = 'scenic_admin_business_override'

export function getAdminBusinessOverride(): AdminBusinessPatch | null {
  const raw = localStorage.getItem(ADMIN_BUSINESS_OVERRIDE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminBusinessPatch
  } catch {
    return null
  }
}

export function setAdminBusinessOverride(patch: AdminBusinessPatch | null): void {
  if (!patch || Object.keys(patch).length === 0) {
    localStorage.removeItem(ADMIN_BUSINESS_OVERRIDE_KEY)
    return
  }
  localStorage.setItem(ADMIN_BUSINESS_OVERRIDE_KEY, JSON.stringify(patch))
}

/** 按 skillId 合并本地覆盖，保留 JSON 中新增的 Skill */
export function mergeSkillsConfig(
  base: AssistantSkillConfig[],
  override: AssistantSkillConfig[] | undefined,
): AssistantSkillConfig[] {
  if (!override?.length) {
    return base.map((skill) => ({ ...skill, tools: [...skill.tools] }))
  }

  const overrideMap = new Map(override.map((skill) => [skill.skillId, skill]))
  const merged = base.map((skill) => {
    const patch = overrideMap.get(skill.skillId)
    if (!patch) {
      return { ...skill, tools: [...skill.tools] }
    }
    return {
      ...skill,
      ...patch,
      tools: [...(patch.tools ?? skill.tools)],
      triggerKeywords: [...(patch.triggerKeywords ?? skill.triggerKeywords ?? [])],
    }
  })

  for (const skill of override) {
    if (!base.some((item) => item.skillId === skill.skillId)) {
      merged.push({
        ...skill,
        tools: [...skill.tools],
        triggerKeywords: [...(skill.triggerKeywords ?? [])],
      })
    }
  }

  return merged
}

export function applyBusinessPatchToSkills(
  base: AssistantSkillConfig[],
  patch: AdminBusinessPatch | null,
): AssistantSkillConfig[] {
  return mergeSkillsConfig(base, patch?.skills)
}

function normalizeRecommendEntry(entry: RecommendEntryConfig): RecommendEntryConfig {
  return {
    ...entry,
    enabled: entry.enabled !== false,
    rules: cloneRuleList(entry.rules),
  }
}

function cloneRuleList(rules: RecommendEntryConfig['rules'] | undefined): RecommendEntryConfig['rules'] {
  if (!rules?.length) return []
  return rules.map((rule) => {
    if (rule.op === 'in') {
      return { op: 'in', field: rule.field, values: [...(rule.values ?? [])] }
    }
    if (rule.op === 'and' || rule.op === 'or') {
      return { op: rule.op, rules: cloneRuleList(rule.rules) }
    }
    if (rule.op === 'contains') {
      return { op: 'contains', field: rule.field, value: rule.value }
    }
    return { op: 'eq', field: rule.field, value: rule.value }
  })
}

/** 按 entryId 合并本地覆盖 */
export function mergeRecommendEntriesConfig(
  base: RecommendEntryConfig[],
  override: RecommendEntryConfig[] | undefined,
): RecommendEntryConfig[] {
  if (!override?.length) {
    return base.map((entry) => normalizeRecommendEntry(entry))
  }

  const overrideMap = new Map(override.map((entry) => [entry.entryId, entry]))
  const merged = base.map((entry) => {
    const patch = overrideMap.get(entry.entryId)
    if (!patch) return normalizeRecommendEntry(entry)
    return normalizeRecommendEntry({
      ...entry,
      ...patch,
      // 显式空数组表示「无规则 / 始终展示」，勿回退到 base
      rules: patch.rules !== undefined ? cloneRuleList(patch.rules) : cloneRuleList(entry.rules),
    })
  })

  for (const entry of override) {
    if (!base.some((item) => item.entryId === entry.entryId)) {
      merged.push(normalizeRecommendEntry(entry))
    }
  }

  return merged
}

export function applyBusinessPatchToRecommendEntries(
  base: RecommendEntryConfig[],
  patch: AdminBusinessPatch | null,
): RecommendEntryConfig[] {
  return mergeRecommendEntriesConfig(base, patch?.recommendEntries)
}

function normalizeWelcomeQuestion(
  question: WelcomeQuestionConfig,
): WelcomeQuestionConfig {
  return {
    ...question,
    enabled: question.enabled !== false,
    priority: question.priority ?? 0,
    rules: Array.isArray(question.rules) ? question.rules : [],
  }
}

export function hasWelcomePlaceholders(text: string): boolean {
  return /\{\{[a-zA-Z]+\}\}/.test(text)
}

/** 基线 JSON 使用占位符时，忽略 LocalStorage 里写死的旧文案（如过期日期） */
function shouldKeepBaseDynamicField(base: string, current: string | undefined): boolean {
  if (!current) return true
  return hasWelcomePlaceholders(base) && !hasWelcomePlaceholders(current)
}

export function coalesceDynamicWelcomeTemplate(
  base: WelcomeTemplateConfig | undefined,
  current: WelcomeTemplateConfig,
): WelcomeTemplateConfig {
  if (!base) return current
  return {
    ...current,
    subtitle: shouldKeepBaseDynamicField(base.subtitle, current.subtitle)
      ? base.subtitle
      : current.subtitle,
    body: shouldKeepBaseDynamicField(base.body, current.body)
      ? base.body
      : current.body,
    highlights:
      base.highlights.some(hasWelcomePlaceholders) &&
      !current.highlights.some(hasWelcomePlaceholders)
        ? [...base.highlights]
        : [...(current.highlights ?? base.highlights)],
    suggestedQuestions: [],
  }
}

function normalizeWelcomeTemplate(template: WelcomeTemplateConfig): WelcomeTemplateConfig {
  return {
    ...template,
    highlights: [...(template.highlights ?? [])],
    suggestedQuestions: [],
  }
}

/** 按 personaId 合并欢迎模板文案（不再合并 suggestedQuestions） */
export function mergeWelcomeTemplatesConfig(
  base: WelcomeTemplateConfig[],
  override: WelcomeTemplateConfig[] | undefined,
): WelcomeTemplateConfig[] {
  if (!override?.length) {
    return base.map((template) => normalizeWelcomeTemplate(template))
  }

  const overrideMap = new Map(override.map((template) => [template.personaId, template]))
  return base.map((template) => {
    const patch = overrideMap.get(template.personaId)
    if (!patch) return normalizeWelcomeTemplate(template)

    return normalizeWelcomeTemplate(
      coalesceDynamicWelcomeTemplate(template, {
        ...template,
        ...patch,
        highlights: patch.highlights?.length ? [...patch.highlights] : [...template.highlights],
        suggestedQuestions: [],
      }),
    )
  })
}

export function applyBusinessPatchToWelcomeTemplates(
  base: WelcomeTemplateConfig[],
  patch: AdminBusinessPatch | null,
): WelcomeTemplateConfig[] {
  return mergeWelcomeTemplatesConfig(base, patch?.welcomeTemplates)
}

function cloneQuestionRules(rules: WelcomeQuestionConfig['rules']): WelcomeQuestionConfig['rules'] {
  return (rules ?? []).map((rule) => {
    if (rule.op === 'in') {
      return { op: 'in' as const, field: rule.field, values: [...(rule.values ?? [])] }
    }
    if (rule.op === 'and' || rule.op === 'or') {
      return { op: rule.op, rules: rule.rules.map((child) => ({ ...child })) }
    }
    return { ...rule }
  })
}

/** 按 id 合并游游推荐；兼容旧 LocalStorage 中挂在模板下的问题 */
export function mergeWelcomeQuestionsConfig(
  base: WelcomeQuestionConfig[],
  override: WelcomeQuestionConfig[] | undefined,
  legacyTemplates?: WelcomeTemplateConfig[],
): WelcomeQuestionConfig[] {
  const legacy =
    legacyTemplates?.length ? extractWelcomeQuestionsFromTemplates(legacyTemplates) : []
  const effectiveOverride =
    override?.length ? override : legacy.length ? legacy : undefined

  if (!effectiveOverride?.length) {
    return base.map((question) => normalizeWelcomeQuestion(question))
  }

  const overrideMap = new Map(effectiveOverride.map((question) => [question.id, question]))
  const merged = base.map((question) => {
    const patch = overrideMap.get(question.id)
    if (!patch) return normalizeWelcomeQuestion(question)
    return normalizeWelcomeQuestion({
      ...question,
      ...patch,
      rules: patch.rules?.length ? cloneQuestionRules(patch.rules) : cloneQuestionRules(question.rules),
    })
  })

  for (const question of effectiveOverride) {
    if (!base.some((item) => item.id === question.id)) {
      merged.push(normalizeWelcomeQuestion(question))
    }
  }

  return merged.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

export function applyBusinessPatchToWelcomeQuestions(
  base: WelcomeQuestionConfig[],
  patch: AdminBusinessPatch | null,
): WelcomeQuestionConfig[] {
  return mergeWelcomeQuestionsConfig(
    base,
    patch?.welcomeQuestions,
    patch?.welcomeTemplates,
  )
}

function extractWelcomeQuestionsFromTemplates(
  templates: WelcomeTemplateConfig[],
): WelcomeQuestionConfig[] {
  const list: WelcomeQuestionConfig[] = []
  for (const template of templates) {
    for (const question of template.suggestedQuestions ?? []) {
      const hasRules = Array.isArray(question.rules) && question.rules.length > 0
      list.push(
        normalizeWelcomeQuestion({
          ...question,
          rules: hasRules
            ? question.rules
            : [{ op: 'eq', field: 'personaId', value: template.personaId }],
        }),
      )
    }
  }
  return list
}
