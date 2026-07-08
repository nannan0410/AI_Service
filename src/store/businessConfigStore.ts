import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchAssistantSkills,
  fetchCardViews,
  fetchFieldCatalog,
  fetchRecommendEntriesConfig,
  fetchWelcomeTemplatesConfig,
} from '@/api/business'
import {
  applyBusinessPatchToRecommendEntries,
  applyBusinessPatchToSkills,
  applyBusinessPatchToWelcomeTemplates,
  coalesceDynamicWelcomeTemplate,
  getAdminBusinessOverride,
  setAdminBusinessOverride,
} from '@/utils/adminBusinessConfig'
import { resolveActiveRecommendEntries } from '@/utils/recommendEntries'
import { normalizeSkillsTriggerKeywords } from '@/utils/skillKeywordValidation'
import type { AdminBusinessPatch } from '@/types/businessConfig'
import defaultSkills from '@/mock/assistant/skills.json'
import defaultFieldCatalog from '@/mock/assistant/field_catalog.json'
import defaultCardViews from '@/mock/assistant/card_views.json'
import defaultRecommendEntries from '@/mock/assistant/recommend_entries.json'
import defaultWelcomeTemplates from '@/mock/assistant/welcome_templates.json'
import type { AssistantSkillConfig, Coupon, Order, PersonaId, RecommendEntry } from '@/types'
import type { CardViewConfig, FieldCatalog, RecommendEntryConfig, WelcomeTemplateConfig } from '@/types/businessConfig'
import { resolveSuggestedQuestions } from '@/utils/welcomeQuestions'
import {
  resolveWelcomeTemplate,
  getDemoSnapshotOrders,
  type WelcomeTemplateVarContext,
} from '@/utils/welcomeTemplateVars'

export const useBusinessConfigStore = defineStore('businessConfig', () => {
  const baseSkills = ref<AssistantSkillConfig[]>([])
  const skills = ref<AssistantSkillConfig[]>([])
  const baseRecommendEntries = ref<RecommendEntryConfig[]>([])
  const recommendEntries = ref<RecommendEntryConfig[]>([])
  const baseWelcomeTemplates = ref<WelcomeTemplateConfig[]>([])
  const welcomeTemplates = ref<WelcomeTemplateConfig[]>([])
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
    try {
      const { data: res } = await fetchAssistantSkills()
      if (res.code === 200 && Array.isArray(res.data)) {
        baseSkills.value = res.data
      } else {
        baseSkills.value = defaultSkills as AssistantSkillConfig[]
      }
    } catch {
      baseSkills.value = defaultSkills as AssistantSkillConfig[]
    }
    return syncSkills()
  }

  async function loadRecommendEntries(force = false) {
    if (!force && baseRecommendEntries.value.length) {
      return syncRecommendEntries()
    }
    try {
      const { data: res } = await fetchRecommendEntriesConfig()
      if (res.code === 200 && Array.isArray(res.data)) {
        baseRecommendEntries.value = res.data as RecommendEntryConfig[]
      } else {
        baseRecommendEntries.value = defaultRecommendEntries as RecommendEntryConfig[]
      }
    } catch {
      baseRecommendEntries.value = defaultRecommendEntries as RecommendEntryConfig[]
    }
    return syncRecommendEntries()
  }

  async function loadWelcomeTemplates(force = false) {
    if (!force && baseWelcomeTemplates.value.length) {
      return syncWelcomeTemplates()
    }
    try {
      const { data: res } = await fetchWelcomeTemplatesConfig()
      if (res.code === 200 && Array.isArray(res.data)) {
        baseWelcomeTemplates.value = res.data as WelcomeTemplateConfig[]
      } else {
        baseWelcomeTemplates.value = defaultWelcomeTemplates as WelcomeTemplateConfig[]
      }
    } catch {
      baseWelcomeTemplates.value = defaultWelcomeTemplates as WelcomeTemplateConfig[]
    }
    return syncWelcomeTemplates()
  }

  async function loadAll(force = false) {
    await Promise.all([
      loadCatalog(force),
      loadCardViews(force),
      loadSkills(force),
      loadRecommendEntries(force),
      loadWelcomeTemplates(force),
    ])
    loaded.value = true
    return {
      skills: skills.value,
      recommendEntries: recommendEntries.value,
      welcomeTemplates: welcomeTemplates.value,
      fieldCatalog: fieldCatalog.value,
      cardViews: cardViews.value,
    }
  }

  function getActiveRecommendEntries(personaId: PersonaId): RecommendEntry[] {
    const merged = syncRecommendEntries()
    return resolveActiveRecommendEntries(merged, personaId)
  }

  function getWelcomeTemplate(personaId: PersonaId): WelcomeTemplateConfig | undefined {
    const merged = syncWelcomeTemplates()
    return merged.find((template) => template.personaId === personaId)
  }

  function getResolvedWelcomeTemplate(
    personaId: PersonaId,
    ctx: WelcomeTemplateVarContext,
  ): WelcomeTemplateConfig | undefined {
    const merged = syncWelcomeTemplates()
    const template = merged.find((item) => item.personaId === personaId)
    const base = baseWelcomeTemplates.value.find((item) => item.personaId === personaId)
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
      coupons: Coupon[]
      registeredAt?: string
    },
    welcomeCtx?: WelcomeTemplateVarContext,
  ) {
    const merged = syncWelcomeTemplates()
    const orders =
      welcomeCtx?.orders?.length
        ? welcomeCtx.orders
        : getDemoSnapshotOrders(personaId)
    const resolvedCtx = welcomeCtx ? { ...welcomeCtx, orders } : undefined
    const templates = resolvedCtx
      ? merged.map((template) => {
          if (template.personaId !== personaId) return template
          const base = baseWelcomeTemplates.value.find(
            (item) => item.personaId === personaId,
          )
          return resolveWelcomeTemplate(
            coalesceDynamicWelcomeTemplate(base, template),
            resolvedCtx,
          )
        })
      : merged
    return resolveSuggestedQuestions(templates, personaId, couponCtx)
  }

  function applyAdminPatch(patch: AdminBusinessPatch) {
    const current = getAdminBusinessOverride() ?? {}
    setAdminBusinessOverride({ ...current, ...patch })
    syncSkills()
    syncRecommendEntries()
    syncWelcomeTemplates()
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

  function clearAdminPatch() {
    setAdminBusinessOverride(null)
    syncSkills()
    syncRecommendEntries()
    syncWelcomeTemplates()
  }

  return {
    baseSkills,
    skills,
    baseRecommendEntries,
    recommendEntries,
    baseWelcomeTemplates,
    welcomeTemplates,
    fieldCatalog,
    cardViews,
    loaded,
    loadAll,
    loadSkills,
    loadRecommendEntries,
    loadWelcomeTemplates,
    loadCatalog,
    loadCardViews,
    syncSkills,
    syncRecommendEntries,
    syncWelcomeTemplates,
    getActiveRecommendEntries,
    getWelcomeTemplate,
    getResolvedWelcomeTemplate,
    getSuggestedQuestions,
    applyAdminPatch,
    saveSkillsOverride,
    saveRecommendEntriesOverride,
    saveWelcomeTemplatesOverride,
    clearAdminPatch,
  }
})
