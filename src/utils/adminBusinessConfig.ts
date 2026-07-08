import type { AssistantSkillConfig } from '@/types'
import type { AdminBusinessPatch, RecommendEntryConfig, WelcomeTemplateConfig } from '@/types/businessConfig'

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
    rules: entry.rules?.length ? [...entry.rules] : [],
  }
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
      rules: patch.rules?.length ? [...patch.rules] : [...entry.rules],
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
  question: WelcomeTemplateConfig['suggestedQuestions'][number],
): WelcomeTemplateConfig['suggestedQuestions'][number] {
  return {
    ...question,
    enabled: question.enabled !== false,
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
  }
}

function normalizeWelcomeTemplate(template: WelcomeTemplateConfig): WelcomeTemplateConfig {
  return {
    ...template,
    highlights: [...(template.highlights ?? [])],
    suggestedQuestions: (template.suggestedQuestions ?? []).map(normalizeWelcomeQuestion),
  }
}

/** 按 personaId 合并欢迎模板；suggestedQuestions 按 id 合并 */
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

    const questionMap = new Map(
      (patch.suggestedQuestions ?? []).map((question) => [question.id, question]),
    )
    const mergedQuestions = template.suggestedQuestions.map((question) => {
      const questionPatch = questionMap.get(question.id)
      if (!questionPatch) return normalizeWelcomeQuestion(question)
      return normalizeWelcomeQuestion({ ...question, ...questionPatch })
    })

    for (const question of patch.suggestedQuestions ?? []) {
      if (!template.suggestedQuestions.some((item) => item.id === question.id)) {
        mergedQuestions.push(normalizeWelcomeQuestion(question))
      }
    }

    return normalizeWelcomeTemplate(
      coalesceDynamicWelcomeTemplate(template, {
        ...template,
        ...patch,
        highlights: patch.highlights?.length ? [...patch.highlights] : [...template.highlights],
        suggestedQuestions: mergedQuestions,
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
