import type { PersonaId } from '@/types'
import type { AiChatPreferenceTagId } from '@/utils/aiChatTagIntent'

export interface AiChatTagRecord {
  tagId: AiChatPreferenceTagId
  confidence: number
  evidence: string
  updatedAt: string
}

const RUNTIME_KEY = '__scenic_ai_custom_ai_chat_tags_v1__'

type Store = Partial<Record<PersonaId, AiChatTagRecord[]>>

function getStore(): Store {
  const g = globalThis as typeof globalThis & { [RUNTIME_KEY]?: Store }
  if (!g[RUNTIME_KEY]) g[RUNTIME_KEY] = {}
  return g[RUNTIME_KEY]!
}

/** 刺激 ↔ 休闲互斥；拍照可与任一并存 */
export function upsertAiChatTag(
  personaId: PersonaId,
  tagId: AiChatPreferenceTagId,
  evidence: string,
  confidence = 0.75,
): AiChatTagRecord[] {
  const store = getStore()
  const list = [...(store[personaId] ?? [])]
  const next: AiChatTagRecord = {
    tagId,
    confidence,
    evidence,
    updatedAt: new Date().toISOString(),
  }

  if (tagId === 'prefer_thrill') {
    const filtered = list.filter((t) => t.tagId !== 'prefer_slow' && t.tagId !== 'prefer_thrill')
    filtered.push(next)
    store[personaId] = filtered
  } else if (tagId === 'prefer_slow') {
    const filtered = list.filter((t) => t.tagId !== 'prefer_thrill' && t.tagId !== 'prefer_slow')
    filtered.push(next)
    store[personaId] = filtered
  } else {
    const filtered = list.filter((t) => t.tagId !== tagId)
    filtered.push(next)
    store[personaId] = filtered
  }

  return store[personaId] ?? []
}

export function listAiChatTags(personaId: PersonaId): AiChatTagRecord[] {
  return [...(getStore()[personaId] ?? [])]
}

export function clearAiChatTags(personaId?: PersonaId): void {
  const store = getStore()
  if (personaId) {
    delete store[personaId]
    return
  }
  for (const key of Object.keys(store) as PersonaId[]) {
    delete store[key]
  }
}
