import type {
  Order,
  PersonaId,
  ProfileTag,
  ProfileTagCategory,
  TagCatalogEntry,
  TagRuleDef,
  UserProfileTags,
  UserSnapshot,
  PersonaTagPreview,
} from '../types'
import tagCatalogJson from '../mock/tags.json'
import tagRulesJson from '../mock/tags/rules.json'
import aiPresetsJson from '../mock/tags/ai_presets.json'
import demoNew from '../mock/users/demo_new.json'
import demoMid from '../mock/users/demo_mid.json'
import demoVip from '../mock/users/demo_vip.json'

const tagCatalog = tagCatalogJson as TagCatalogEntry[]
const tagRules = tagRulesJson as TagRuleDef[]

const snapshots: Record<PersonaId, UserSnapshot> = {
  demo_new: demoNew as UserSnapshot,
  demo_mid: demoMid as UserSnapshot,
  demo_vip: demoVip as UserSnapshot,
}

type AiPresetFile = Record<
  string,
  { aiTags?: Array<{ tagId: string; confidence?: number; evidence?: string }> }
>

const aiPresets = aiPresetsJson as AiPresetFile

function catalogById(tagId: string): TagCatalogEntry | undefined {
  return tagCatalog.find((t) => t.tagId === tagId)
}

function makeTag(
  tagId: string,
  overrides: Partial<ProfileTag> & Pick<ProfileTag, 'source' | 'category'>,
): ProfileTag | null {
  const meta = catalogById(tagId)
  if (!meta) return null
  return {
    tagId,
    name: meta.name,
    category: overrides.category ?? meta.category,
    source: overrides.source,
    createdAt: overrides.createdAt ?? new Date().toISOString().slice(0, 10),
    confidence: overrides.confidence ?? meta.defaultConfidence ?? 1,
    evidence: overrides.evidence,
  }
}

/** 单笔订单命中的订单标签 id（含双写前的主标签） */
export function matchOrderTagIds(order: Order): string[] {
  const { adult, child } = order.quantity
  const total = adult + child
  const ids: string[] = []

  const isFamilyTicket =
    order.ticketType === 'family_bundle' || order.ticketType === 'family_annual'

  if (child >= 1 || isFamilyTicket) {
    ids.push('order_family')
  }

  if (
    adult === 2 &&
    child === 0 &&
    total < 5 &&
    !isFamilyTicket
  ) {
    ids.push('order_couple')
  }

  if (total >= 5) {
    ids.push('order_group')
  }

  return [...new Set(ids)]
}

function applyDualWrite(tagIds: string[]): string[] {
  const out = new Set(tagIds)
  for (const id of tagIds) {
    const meta = catalogById(id)
    for (const alias of meta?.dualWriteAs ?? []) {
      out.add(alias)
    }
  }
  return [...out]
}

function buildFactTags(snapshot: UserSnapshot, personaId: PersonaId): ProfileTag[] {
  const tags: ProfileTag[] = []
  const completed = snapshot.orders.filter((o) => o.status === 'completed')

  if (personaId === 'demo_new' || completed.length === 0) {
    const t = makeTag('new_guest', {
      category: 'fact',
      source: 'member',
      evidence: '无已完成入园订单',
    })
    if (t) tags.push(t)
  }

  if (/黄金/.test(snapshot.memberInfo.level)) {
    const t = makeTag('member_gold', {
      category: 'fact',
      source: 'member',
      evidence: `memberLevel=${snapshot.memberInfo.level}`,
    })
    if (t) tags.push(t)
    const hv = makeTag('high_value', {
      category: 'fact',
      source: 'member',
      evidence: '高等级会员',
    })
    if (hv) tags.push(hv)
  }

  if (completed.length >= 2) {
    const t = makeTag('visit_repeat', {
      category: 'fact',
      source: 'order',
      evidence: `已完成订单 ${completed.length} 笔`,
    })
    if (t) tags.push(t)
  }

  return tags
}

function buildOrderTags(snapshot: UserSnapshot): {
  tags: ProfileTag[]
  hits: Array<{ ruleId: string; tagId: string; orderId: string; ticketName: string }>
} {
  const tagToOrders = new Map<string, Order[]>()
  const hits: Array<{ ruleId: string; tagId: string; orderId: string; ticketName: string }> =
    []

  for (const order of snapshot.orders) {
    if (order.status === 'refunded') continue
    const matched = matchOrderTagIds(order)
    for (const tagId of matched) {
      const list = tagToOrders.get(tagId) ?? []
      list.push(order)
      tagToOrders.set(tagId, list)
      const rule = tagRules.find((r) => r.tagId === tagId)
      if (rule) {
        hits.push({
          ruleId: rule.ruleId,
          tagId,
          orderId: order.orderId,
          ticketName: order.ticketName,
        })
      }
    }
  }

  const tags: ProfileTag[] = []
  for (const [tagId, orders] of tagToOrders) {
    const sample = orders[0]
    const t = makeTag(tagId, {
      category: 'order',
      source: 'order',
      evidence: `示例订单 ${sample.orderId}（共 ${orders.length} 笔命中）`,
    })
    if (t) tags.push(t)

    // 双写为独立 ProfileTag（如 family）
    const meta = catalogById(tagId)
    for (const alias of meta?.dualWriteAs ?? []) {
      if (tags.some((x) => x.tagId === alias)) continue
      const dual = makeTag(alias, {
        category: 'order',
        source: 'order',
        evidence: `由 ${tagId} 双写`,
        confidence: 1,
      })
      if (dual) tags.push(dual)
    }
  }

  return { tags, hits }
}

function buildAiTags(personaId: PersonaId): ProfileTag[] {
  const preset = aiPresets[personaId]?.aiTags ?? []
  const tags: ProfileTag[] = []
  for (const item of preset) {
    const t = makeTag(item.tagId, {
      category: 'ai',
      source: 'ai_preset',
      confidence: item.confidence,
      evidence: item.evidence,
    })
    if (t) tags.push(t)
  }
  return tags
}

export function getTagCatalog(): TagCatalogEntry[] {
  return tagCatalog.map((t) => ({ ...t }))
}

export function getTagRules(): TagRuleDef[] {
  return tagRules.map((r) => ({ ...r }))
}

export function buildUserProfileTags(
  personaId: PersonaId,
  snapshot?: UserSnapshot,
): UserProfileTags {
  const snap = snapshot ?? snapshots[personaId]
  const memberTags = buildFactTags(snap, personaId)
  const { tags: orderTags } = buildOrderTags(snap)
  const aiTags = buildAiTags(personaId)

  const all = [...memberTags, ...orderTags, ...aiTags]
  const ruleTagIds = applyDualWrite(all.map((t) => t.tagId))

  return {
    userId: snap.memberInfo.memberId,
    personaId,
    memberTags,
    orderTags,
    consumeTags: [],
    aiTags,
    ruleTagIds,
  }
}

/** 规则引擎 / member_offer 用：含双写后的 tagId */
export function resolveProfileRuleTagIds(personaId: PersonaId): string[] {
  return buildUserProfileTags(personaId).ruleTagIds
}

export function buildPersonaTagPreview(personaId: PersonaId): PersonaTagPreview {
  const snap = snapshots[personaId]
  const profile = buildUserProfileTags(personaId, snap)
  const { hits } = buildOrderTags(snap)
  return {
    personaId,
    nickname: snap.memberInfo.nickname,
    memberLevel: snap.memberInfo.level,
    inPark: snap.visitorState.inPark,
    currentLocation: snap.visitorState.currentLocation,
    profile,
    orderRuleHits: hits,
  }
}

export function listOrderTagsForOrder(order: Order): ProfileTag[] {
  const ids = applyDualWrite(matchOrderTagIds(order))
  return ids
    .map((tagId) =>
      makeTag(tagId, {
        category: (catalogById(tagId)?.category ?? 'order') as ProfileTagCategory,
        source: 'order',
        evidence: order.orderId,
      }),
    )
    .filter((t): t is ProfileTag => Boolean(t))
}

export function flattenProfileTags(profile: UserProfileTags): ProfileTag[] {
  return [
    ...profile.memberTags,
    ...profile.orderTags,
    ...profile.consumeTags,
    ...profile.aiTags,
  ]
}

export function hasFamilyLikeTag(tagIds: string[]): boolean {
  return tagIds.includes('family') || tagIds.includes('order_family')
}

export function hasThrillPreference(tagIds: string[]): boolean {
  return tagIds.includes('prefer_thrill')
}

export function hasSlowPreference(tagIds: string[]): boolean {
  return tagIds.includes('prefer_slow')
}
