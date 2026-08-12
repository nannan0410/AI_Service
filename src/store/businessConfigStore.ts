import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchAssistantSkills,
  fetchCardViews,
  fetchFieldCatalog,
  fetchRecommendEntriesConfig,
  fetchWelcomeQuestionsConfig,
  fetchWelcomeTemplatesConfig,
} from '@/api/business'
import {
  applyBusinessPatchToRecommendEntries,
  applyBusinessPatchToSkills,
  applyBusinessPatchToWelcomeQuestions,
  applyBusinessPatchToWelcomeTemplates,
  coalesceDynamicWelcomeTemplate,
  getAdminBusinessOverride,
  setAdminBusinessOverride,
} from '@/utils/adminBusinessConfig'
import { resolveActiveRecommendEntries } from '@/utils/recommendEntries'
import { matchesScenicScope } from '@/utils/scenicScope'
import { normalizeSkillsTriggerKeywords } from '@/utils/skillKeywordValidation'
import type { AdminBusinessPatch } from '@/types/businessConfig'
import defaultSkills from '@/mock/assistant/skills.json'
import defaultFieldCatalog from '@/mock/assistant/field_catalog.json'
import defaultCardViews from '@/mock/assistant/card_views.json'
import defaultRecommendEntries from '@/mock/assistant/recommend_entries.json'
import defaultWelcomeTemplates from '@/mock/assistant/welcome_templates.json'
import defaultWelcomeQuestions from '@/mock/assistant/welcome_questions.json'
import type { AssistantSkillConfig, PersonaId, RecommendEntry } from '@/types'
import type {
  CardViewConfig,
  FieldCatalog,
  RecommendEntryConfig,
  WelcomeQuestionConfig,
  WelcomeTemplateConfig,
} from '@/types/businessConfig'
import { resolveSuggestedQuestions } from '@/utils/welcomeQuestions'
import {
  resolveWelcomeTemplate,
  getDemoSnapshotOrders,
  type WelcomeTemplateVarContext,
} from '@/utils/welcomeTemplateVars'

function cloneJsonDefault<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const useBusinessConfigStore = defineStore('businessConfig', () => {
  const baseSkills = ref<AssistantSkillConfig[]>([])
  const skills = ref<AssistantSkillConfig[]>([])
  const baseRecommendEntries = ref<RecommendEntryConfig[]>([])
  const recommendEntries = ref<RecommendEntryConfig[]>([])
  const baseWelcomeTemplates = ref<WelcomeTemplateConfig[]>([])
  const welcomeTemplates = ref<WelcomeTemplateConfig[]>([])
  const baseWelcomeQuestions = ref<WelcomeQuestionConfig[]>([])
  const welcomeQuestions = ref<WelcomeQuestionConfig[]>([])
  const fieldCatalog = ref<FieldCatalog>(defaultFieldCatalog as FieldCatalog)
  const cardViews = ref<CardViewConfig[]>(defaultCardViews as CardViewConfig[])
  const loaded = ref(false)

  function syncSkills(base = baseSkills.value) {
    const merged = applyBusinessPatchToSkills(base, getAdminBusinessOverride())
    skills.value = normalizeSkillsTriggerKeywords(merged)
    return skills.value
  }

  function syncRecommendEntries(base = baseRecommendEntries.value) {
    const merged = applyBusinessPatchToRecommendEntries(base, getAdminBusinessOverride())
    recommendEntries.value = merged
    return merged
  }

  function syncWelcomeTemplates(base = baseWelcomeTemplates.value) {
    const merged = applyBusinessPatchToWelcomeTemplates(base, getAdminBusinessOverride())
    welcomeTemplates.value = merged
    return merged
  }

  function syncWelcomeQuestions(base = baseWelcomeQuestions.value) {
    const merged = applyBusinessPatchToWelcomeQuestions(base, getAdminBusinessOverride())
    welcomeQuestions.value = merged
    return merged
  }

  async function loadCatalog(force = false) {
    if (fieldCatalog.value.fields.length && !force) return fieldCatalog.value
    try {
      const { data: res } = await fetchFieldCatalog()
      if (res.code === 200 && res.data) {
        fieldCatalog.value = res.data
      }
    } catch {
      fieldCatalog.value = defaultFieldCatalog as FieldCatalog
    }
    return fieldCatalog.value
  }

  async function loadCardViews(force = false) {
    if (cardViews.value.length && !force) return cardViews.value
    try {
      const { data: res } = await fetchCardViews()
      if (res.code === 200 && Array.isArray(res.data)) {
        cardViews.value = res.data
      }
    } catch {
      cardViews.value = defaultCardViews as CardViewConfig[]
    }
    return cardViews.value
  }

  async function loadSkills(force = false) {
    if (!force && baseSkills.value.length) {
      return syncSkills()
    }
    if (force) {
      // 强制恢复：直接用客户端打包的 JSON，避免 mock 进程缓存旧 import
      baseSkills.value = cloneJsonDefault(defaultSkills) as AssistantSkillConfig[]
      return syncSkills()
    }
    try {
      const { data: res } = await fetchAssistantSkills()
      if (res.code === 200 && Array.isArray(res.data)) {
        baseSkills.value = res.data
      } else {
        baseSkills.value = cloneJsonDefault(defaultSkills) as AssistantSkillConfig[]
      }
    } catch {
      baseSkills.value = cloneJsonDefault(defaultSkills) as AssistantSkillConfig[]
    }
    return syncSkills()
  }

  async function loadRecommendEntries(force = false) {
    if (!force && baseRecommendEntries.value.length) {
      return syncRecommendEntries()
    }
    if (force) {
      baseRecommendEntries.value = cloneJsonDefault(
        defaultRecommendEntries,
      ) as RecommendEntryConfig[]
      return syncRecommendEntries()
    }
    try {
      const { data: res } = await fetchRecommendEntriesConfig()
      if (res.code === 200 && Array.isArray(res.data)) {
        baseRecommendEntries.value = res.data as RecommendEntryConfig[]
      } else {
        baseRecommendEntries.value = cloneJsonDefault(
          defaultRecommendEntries,
        ) as RecommendEntryConfig[]
      }
    } catch {
      baseRecommendEntries.value = cloneJsonDefault(
        defaultRecommendEntries,
      ) as RecommendEntryConfig[]
    }
    return syncRecommendEntries()
  }

  async function loadWelcomeTemplates(force = false) {
    if (!force && baseWelcomeTemplates.value.length) {
      return syncWelcomeTemplates()
    }
    if (force) {
      baseWelcomeTemplates.value = cloneJsonDefault(
        defaultWelcomeTemplates,
      ) as WelcomeTemplateConfig[]
      return syncWelcomeTemplates()
    }
    try {
      const { data: res } = await fetchWelcomeTemplatesConfig()
      if (res.code === 200 && Array.isArray(res.data)) {
        baseWelcomeTemplates.value = res.data as WelcomeTemplateConfig[]
      } else {
        baseWelcomeTemplates.value = cloneJsonDefault(
          defaultWelcomeTemplates,
        ) as WelcomeTemplateConfig[]
      }
    } catch {
      baseWelcomeTemplates.value = cloneJsonDefault(
        defaultWelcomeTemplates,
      ) as WelcomeTemplateConfig[]
    }
    return syncWelcomeTemplates()
  }

  async function loadWelcomeQuestions(force = false) {
    if (!force && baseWelcomeQuestions.value.length) {
      return syncWelcomeQuestions()
    }
    if (force) {
      baseWelcomeQuestions.value = cloneJsonDefault(
        defaultWelcomeQuestions,
      ) as WelcomeQuestionConfig[]
      return syncWelcomeQuestions()
    }
    try {
      const { data: res } = await fetchWelcomeQuestionsConfig()
      if (res.code === 200 && Array.isArray(res.data)) {
        baseWelcomeQuestions.value = res.data as WelcomeQuestionConfig[]
      } else {
        baseWelcomeQuestions.value = cloneJsonDefault(
          defaultWelcomeQuestions,
        ) as WelcomeQuestionConfig[]
      }
    } catch {
      baseWelcomeQuestions.value = cloneJsonDefault(
        defaultWelcomeQuestions,
      ) as WelcomeQuestionConfig[]
    }
    return syncWelcomeQuestions()
  }

  async function loadAll(force = false) {
    await Promise.all([
      loadCatalog(force),
      loadCardViews(force),
      loadSkills(force),
      loadRecommendEntries(force),
      loadWelcomeTemplates(force),
      loadWelcomeQuestions(force),
    ])
    loaded.value = true
    return {
      skills: skills.value,
      recommendEntries: recommendEntries.value,
      welcomeTemplates: welcomeTemplates.value,
      welcomeQuestions: welcomeQuestions.value,
      fieldCatalog: fieldCatalog.value,
      cardViews: cardViews.value,
    }
  }

  function getActiveRecommendEntries(
    personaId: PersonaId,
    live?: {
      coupons?: import('@/types').Coupon[]
      orders?: import('@/types').Order[]
      registeredAt?: string
      nickname?: string
      memberLevel?: string
      inPark?: boolean
      scenicId?: string | null
    },
  ): RecommendEntry[] {
    const merged = syncRecommendEntries()
    return resolveActiveRecommendEntries(merged, personaId, live)
  }

  function pickWelcomeTemplate(
    templates: WelcomeTemplateConfig[],
    personaId: PersonaId,
    scenicId?: string | null,
  ): WelcomeTemplateConfig | undefined {
    const forPersona = templates.filter((item) => item.personaId === personaId)
    const scoped = forPersona.filter((item) => matchesScenicScope(item, scenicId))
    if (!scoped.length) return undefined
    if (scenicId) {
      const exact = scoped.find(
        (item) =>
          item.scenicId === scenicId || item.scenicIds?.includes(scenicId),
      )
      if (exact) return exact
    }
    const generic = scoped.find((item) => !item.scenicId && !item.scenicIds?.length)
    return generic ?? scoped[0]
  }

  function getWelcomeTemplate(
    personaId: PersonaId,
    scenicId?: string | null,
  ): WelcomeTemplateConfig | undefined {
    const merged = syncWelcomeTemplates()
    return pickWelcomeTemplate(merged, personaId, scenicId)
  }

  function getResolvedWelcomeTemplate(
    personaId: PersonaId,
    ctx: WelcomeTemplateVarContext,
  ): WelcomeTemplateConfig | undefined {
    const merged = syncWelcomeTemplates()
    const template = pickWelcomeTemplate(merged, personaId, ctx.scenicId)
    const base = pickWelcomeTemplate(
      baseWelcomeTemplates.value,
      personaId,
      ctx.scenicId,
    )
    if (!template) return undefined
    const source = coalesceDynamicWelcomeTemplate(base, template)
    const orders =
      ctx.orders?.length ? ctx.orders : getDemoSnapshotOrders(personaId)
    return resolveWelcomeTemplate(source, { ...ctx, orders })
  }

  function getSuggestedQuestions(
    personaId: PersonaId,
    couponCtx: {
      personaId: PersonaId | string | null
      coupons: import('@/types').Coupon[]
      registeredAt?: string
    },
    welcomeCtx?: WelcomeTemplateVarContext,
  ) {
    const questions = syncWelcomeQuestions()
    const orders =
      welcomeCtx && 'orders' in welcomeCtx && welcomeCtx.orders !== undefined
        ? welcomeCtx.orders
        : getDemoSnapshotOrders(personaId)
    const resolvedCtx: WelcomeTemplateVarContext = {
      nickname: welcomeCtx?.nickname,
      orders,
      ref: welcomeCtx?.ref,
      scenicId: welcomeCtx?.scenicId,
      scenicName: welcomeCtx?.scenicName,
      inPark: welcomeCtx?.inPark,
    }
    return resolveSuggestedQuestions(questions, personaId, couponCtx, resolvedCtx)
  }

  function applyAdminPatch(patch: AdminBusinessPatch) {
    const current = getAdminBusinessOverride() ?? {}
    setAdminBusinessOverride({ ...current, ...patch })
    syncSkills()
    syncRecommendEntries()
    syncWelcomeTemplates()
    syncWelcomeQuestions()
  }

  function saveSkillsOverride(nextSkills: AssistantSkillConfig[]) {
    applyAdminPatch({ skills: nextSkills })
  }

  function saveRecommendEntriesOverride(nextEntries: RecommendEntryConfig[]) {
    applyAdminPatch({ recommendEntries: nextEntries })
  }

  function saveWelcomeTemplatesOverride(nextTemplates: WelcomeTemplateConfig[]) {
    applyAdminPatch({ welcomeTemplates: nextTemplates })
  }

  function saveWelcomeQuestionsOverride(nextQuestions: WelcomeQuestionConfig[]) {
    applyAdminPatch({ welcomeQuestions: nextQuestions })
  }

  function clearAdminPatch() {
    setAdminBusinessOverride(null)
    // 同步用仓库 JSON 覆盖内存基线，避免「清了 LocalStorage 仍显示旧 override 合并前的缓存」
    baseSkills.value = cloneJsonDefault(defaultSkills) as AssistantSkillConfig[]
    baseRecommendEntries.value = cloneJsonDefault(
      defaultRecommendEntries,
    ) as RecommendEntryConfig[]
    baseWelcomeTemplates.value = cloneJsonDefault(
      defaultWelcomeTemplates,
    ) as WelcomeTemplateConfig[]
    baseWelcomeQuestions.value = cloneJsonDefault(
      defaultWelcomeQuestions,
    ) as WelcomeQuestionConfig[]
    syncSkills()
    syncRecommendEntries()
    syncWelcomeTemplates()
    syncWelcomeQuestions()
  }

  return {
    baseSkills,
    skills,
    baseRecommendEntries,
    recommendEntries,
    baseWelcomeTemplates,
    welcomeTemplates,
    baseWelcomeQuestions,
    welcomeQuestions,
    fieldCatalog,
    cardViews,
    loaded,
    loadAll,
    loadSkills,
    loadRecommendEntries,
    loadWelcomeTemplates,
    loadWelcomeQuestions,
    loadCatalog,
    loadCardViews,
    syncSkills,
    syncRecommendEntries,
    syncWelcomeTemplates,
    syncWelcomeQuestions,
    getActiveRecommendEntries,
    getWelcomeTemplate,
    getResolvedWelcomeTemplate,
    getSuggestedQuestions,
    applyAdminPatch,
    saveSkillsOverride,
    saveRecommendEntriesOverride,
    saveWelcomeTemplatesOverride,
    saveWelcomeQuestionsOverride,
    clearAdminPatch,
  }
})
