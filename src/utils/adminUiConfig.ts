import type { AssistantUiConfig } from '@/types'
import { withBaseUrl } from '@/utils/publicUrl'

const ADMIN_UI_OVERRIDE_KEY = 'scenic_admin_ui_override'

export type AdminUiPatch = Partial<
  Pick<
    AssistantUiConfig,
    | 'chatBackgroundUrl'
    | 'assistantAvatarUrl'
    | 'memberDefaultAvatarUrl'
    | 'assistantCharacterUrl'
    | 'dialogTitle'
    | 'defaultImageUrl'
    | 'assistantName'
    | 'assistantNickname'
    | 'primaryColor'
    | 'primaryColorLight'
    | 'primaryColorDark'
    | 'motions'
  >
>

function resolveUiAssetUrls(config: AssistantUiConfig): AssistantUiConfig {
  return {
    ...config,
    chatBackgroundUrl: withBaseUrl(config.chatBackgroundUrl),
    assistantAvatarUrl: withBaseUrl(config.assistantAvatarUrl),
    memberDefaultAvatarUrl: withBaseUrl(
      config.memberDefaultAvatarUrl || '/member/default-avatar.svg',
    ),
    assistantCharacterUrl: config.assistantCharacterUrl
      ? withBaseUrl(config.assistantCharacterUrl)
      : config.assistantCharacterUrl,
    defaultImageUrl: withBaseUrl(config.defaultImageUrl),
    motions: config.motions.map((m) => ({
      ...m,
      assetUrl: withBaseUrl(m.assetUrl),
    })),
  }
}

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
  if (!patch) {
    return resolveUiAssetUrls({
      ...base,
      motions: base.motions.map((m) => ({ ...m })),
    })
  }

  const merged: AssistantUiConfig = {
    ...base,
    ...patch,
    motions: (patch.motions ?? base.motions).map((m) => ({ ...m })),
  }

  const idleAsset = merged.motions.find((m) => m.actionId === 'idle')?.assetUrl
  merged.assistantAvatarUrl = patch.assistantAvatarUrl ?? merged.assistantAvatarUrl ?? idleAsset
  merged.memberDefaultAvatarUrl =
    patch.memberDefaultAvatarUrl ?? merged.memberDefaultAvatarUrl ?? '/member/default-avatar.svg'
  merged.defaultImageUrl = patch.defaultImageUrl ?? merged.defaultImageUrl

  return resolveUiAssetUrls(merged)
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
