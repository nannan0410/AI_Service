import type { Order, PersonaId, UserSnapshot } from '@/types'
import type { WelcomeTemplateConfig } from '@/types/businessConfig'
import demoNew from '@/mock/users/demo_new.json'
import demoMid from '@/mock/users/demo_mid.json'
import demoVip from '@/mock/users/demo_vip.json'
import {
  getTodayIsoDate,
  getUpcomingVisitOrders,
  hasVisitToday,
  pickNearestUpcomingVisitOrder,
} from '@/utils/upcomingVisitOrder'

const snapshots: Record<PersonaId, UserSnapshot> = {
  demo_new: demoNew as UserSnapshot,
  demo_mid: demoMid as UserSnapshot,
  demo_vip: demoVip as UserSnapshot,
}

export interface WelcomeTemplateVarContext {
  nickname?: string
  orders?: Order[]
  ref?: Date
}

export interface ResolvedWelcomeTemplateVars {
  nickname: string
  nextVisitDate: string
  upcomingVisitOrderCount: number
  hasVisitToday: boolean
  pendingVisitSubtitle: string
}

export function getDemoSnapshotOrders(personaId: PersonaId): Order[] {
  return snapshots[personaId]?.orders ?? []
}

export function buildWelcomeTemplateVars(
  ctx: WelcomeTemplateVarContext,
): ResolvedWelcomeTemplateVars {
  const ref = ctx.ref ?? new Date()
  const orders = ctx.orders ?? []
  const upcoming = getUpcomingVisitOrders(orders, ref)
  const nearest = pickNearestUpcomingVisitOrder(orders, ref)
  const visitToday = hasVisitToday(orders, ref)
  const nextVisitDate = nearest?.visitDate ?? getTodayIsoDate(ref)

  let pendingVisitSubtitle = '试试这些热门问题'
  if (visitToday) {
    pendingVisitSubtitle =
      upcoming.length > 1
        ? `今日出行 · 共 ${upcoming.length} 笔待出行`
        : '今日出行'
  } else if (nearest?.visitDate) {
    pendingVisitSubtitle = `${nearest.visitDate} 待出行`
  }

  return {
    nickname: ctx.nickname ?? '',
    nextVisitDate,
    upcomingVisitOrderCount: upcoming.length,
    hasVisitToday: visitToday,
    pendingVisitSubtitle,
  }
}

function replaceWelcomePlaceholders(
  text: string,
  vars: ResolvedWelcomeTemplateVars,
): string {
  return text
    .replace(/\{\{nickname\}\}/g, vars.nickname)
    .replace(/\{\{nextVisitDate\}\}/g, vars.nextVisitDate)
    .replace(
      /\{\{upcomingVisitOrderCount\}\}/g,
      String(vars.upcomingVisitOrderCount),
    )
    .replace(/\{\{pendingVisitSubtitle\}\}/g, vars.pendingVisitSubtitle)
}

export function resolveWelcomeTemplate(
  template: WelcomeTemplateConfig,
  ctx: WelcomeTemplateVarContext,
): WelcomeTemplateConfig {
  const vars = buildWelcomeTemplateVars(ctx)
  return {
    ...template,
    subtitle: replaceWelcomePlaceholders(template.subtitle, vars),
    body: replaceWelcomePlaceholders(template.body, vars),
    highlights: template.highlights.map((item) =>
      replaceWelcomePlaceholders(item, vars),
    ),
    suggestedQuestions: template.suggestedQuestions.map((question) => ({
      ...question,
      prompt: replaceWelcomePlaceholders(question.prompt, vars),
    })),
  }
}
