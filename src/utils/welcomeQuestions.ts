import type { Coupon, PersonaId } from '@/types'
import type { WelcomeQuestionConfig, WelcomeTemplateConfig } from '@/types/businessConfig'
import { filterNewGuestClaimWelcomeItems } from '@/utils/newGuestCoupon'

export const MAX_SUGGESTED_QUESTIONS = 6

export interface FlatWelcomeQuestion extends WelcomeQuestionConfig {
  personaId: PersonaId
}

export function cloneWelcomeTemplates(
  templates: WelcomeTemplateConfig[],
): WelcomeTemplateConfig[] {
  return templates.map((template) => ({
    ...template,
    highlights: [...(template.highlights ?? [])],
    suggestedQuestions: template.suggestedQuestions.map((question) => ({
      ...question,
    })),
  }))
}

export function flattenWelcomeQuestions(
  templates: WelcomeTemplateConfig[],
): FlatWelcomeQuestion[] {
  return templates.flatMap((template) =>
    template.suggestedQuestions.map((question, index) => ({
      ...question,
      personaId: template.personaId,
      enabled: question.enabled !== false,
      priority: question.priority ?? 10 - index,
    })),
  )
}

export function unflattenWelcomeQuestions(
  templates: WelcomeTemplateConfig[],
  flatQuestions: FlatWelcomeQuestion[],
): WelcomeTemplateConfig[] {
  const byPersona = new Map<PersonaId, FlatWelcomeQuestion[]>()
  for (const question of flatQuestions) {
    const list = byPersona.get(question.personaId) ?? []
    list.push(question)
    byPersona.set(question.personaId, list)
  }

  return templates.map((template) => {
    const questions = (byPersona.get(template.personaId) ?? [])
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .map(({ personaId: _personaId, ...question }) => ({
        ...question,
        enabled: question.enabled !== false,
      }))
    return {
      ...template,
      suggestedQuestions: questions,
    }
  })
}

export function resolveSuggestedQuestions(
  templates: WelcomeTemplateConfig[],
  personaId: PersonaId,
  couponCtx: {
    personaId: PersonaId | string | null
    coupons: Coupon[]
    registeredAt?: string
  },
): WelcomeQuestionConfig[] {
  const template = templates.find((item) => item.personaId === personaId)
  const enabled = (template?.suggestedQuestions ?? [])
    .filter((question) => question.enabled !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  return filterNewGuestClaimWelcomeItems(enabled, couponCtx).slice(
    0,
    MAX_SUGGESTED_QUESTIONS,
  )
}

export function findFlatQuestionIndex(
  flatQuestions: FlatWelcomeQuestion[],
  personaId: PersonaId,
  questionId: string,
): number {
  return flatQuestions.findIndex(
    (item) => item.personaId === personaId && item.id === questionId,
  )
}
