import type { AssistantUiConfig } from '@/types'

const ADMIN_UI_OVERRIDE_KEY = 'scenic_admin_ui_override'

export type AdminUiPatch = Partial<
  Pick<
    AssistantUiConfig,
    | 'chatBackgroundUrl'
    | 'assistantAvatarUrl'
    | 'assistantCharacterUrl'
    | 'defaultImageUrl'
    | 'greeting'
    | 'assistantName'
    | 'assistantNickname'
    | 'primaryColor'
    | 'primaryColorLight'
    | 'primaryColorDark'
  >
>

export function getAdminUiOverride(): AdminUiPatch | null {
  const raw = localStorage.getItem(ADMIN_UI_OVERRIDE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminUiPatch
  } catch {
    return null
  }
}

export function setAdminUiOverride(patch: AdminUiPatch | null): void {
  if (!patch || Object.keys(patch).length === 0) {
    localStorage.removeItem(ADMIN_UI_OVERRIDE_KEY)
    return
  }
  try {
    localStorage.setItem(ADMIN_UI_OVERRIDE_KEY, JSON.stringify(patch))
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new Error('配置数据过大，请压缩图片后重试')
    }
    throw e
  }
}

export function mergeUiConfig(base: AssistantUiConfig): AssistantUiConfig {
  const patch = getAdminUiOverride()
  if (!patch) return base

  const merged = { ...base, ...patch }

  if (patch.assistantAvatarUrl) {
    merged.defaultImageUrl = patch.defaultImageUrl ?? patch.assistantAvatarUrl
    merged.motions = base.motions.map((m) =>
      m.actionId === 'idle' ? { ...m, assetUrl: patch.assistantAvatarUrl! } : m,
    )
  }

  return merged
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** 演示版建议单张图 < 500KB，避免 LocalStorage 超限 */
export const MAX_IMAGE_SIZE_BYTES = 800 * 1024
