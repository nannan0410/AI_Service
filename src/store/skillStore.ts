import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRegisteredToolNames } from '@/ai/tools'
import { routeSkillByKeywords } from '@/ai/skills/router'
import { resolveSkillRoute, type SkillRouteResult } from '@/ai/nlu/resolveSkillRoute'
import {
  collectStage2ToolNames,
  isRoutableSkill,
  resolveSkillTools,
  STAGE2_SKILL_IDS,
} from '@/ai/skills/utils'
import { useBusinessConfigStore } from '@/store/businessConfigStore'
import type { AssistantSkillConfig, ToolExecutionCallbacks } from '@/types'

export const useSkillStore = defineStore('skill', () => {
  const skills = ref<AssistantSkillConfig[]>([])
  const loaded = ref(false)
  const activeSkillId = ref<string | null>(null)

  async function loadSkills(force = false) {
    if (loaded.value && !force) return skills.value
    const businessConfigStore = useBusinessConfigStore()
    skills.value = await businessConfigStore.loadSkills(force)
    loaded.value = true
    return skills.value
  }

  function getRoutableSkills(): AssistantSkillConfig[] {
    return skills.value.filter(isRoutableSkill)
  }

  function resolveSkill(message: string): AssistantSkillConfig | null {
    return routeSkillByKeywords(message, skills.value)
  }

  async function resolveSkillAsync(
    message: string,
    callbacks?: ToolExecutionCallbacks,
  ): Promise<SkillRouteResult> {
    return resolveSkillRoute(message, skills.value, callbacks)
  }

  function getToolNamesForSkill(skill: AssistantSkillConfig | null): string[] | undefined {
    const registry = new Set(getRegisteredToolNames())
    if (skill) {
      const names = resolveSkillTools(skill, registry)
      return names.length ? names : undefined
    }
    const fallback = collectStage2ToolNames(skills.value, registry)
    return fallback.length ? fallback : undefined
  }

  function setActiveSkill(skillId: string | null) {
    activeSkillId.value = skillId
  }

  return {
    skills,
    loaded,
    activeSkillId,
    stage2SkillIds: STAGE2_SKILL_IDS,
    loadSkills,
    getRoutableSkills,
    resolveSkill,
    resolveSkillAsync,
    getToolNamesForSkill,
    setActiveSkill,
  }
})
