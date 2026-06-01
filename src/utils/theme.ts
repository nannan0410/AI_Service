import type { AssistantUiConfig } from '@/types'

const DEFAULT_PRIMARY = '#07c160'
const DEFAULT_PRIMARY_LIGHT = '#e8f8ef'

export function applyChatTheme(config: Pick<AssistantUiConfig, 'primaryColor' | 'primaryColorLight' | 'primaryColorDark'>) {
  const root = document.documentElement
  const primary = config.primaryColor || DEFAULT_PRIMARY
  const light = config.primaryColorLight || DEFAULT_PRIMARY_LIGHT
  const dark = config.primaryColorDark || primary

  root.style.setProperty('--chat-primary', primary)
  root.style.setProperty('--chat-primary-light', light)
  root.style.setProperty('--chat-primary-dark', dark)
  root.style.setProperty('--van-primary-color', primary)
  root.style.setProperty('--van-button-primary-background', primary)
  root.style.setProperty('--van-button-primary-border-color', primary)
}

export function clearChatTheme() {
  const root = document.documentElement
  root.style.removeProperty('--chat-primary')
  root.style.removeProperty('--chat-primary-light')
  root.style.removeProperty('--chat-primary-dark')
}

export function welcomeDismissedKey(userId: string): string {
  return `scenic_${userId}_welcome_dismissed`
}

export function isWelcomeDismissed(userId: string): boolean {
  return localStorage.getItem(welcomeDismissedKey(userId)) === '1'
}

export function setWelcomeDismissed(userId: string, dismissed: boolean): void {
  if (dismissed) {
    localStorage.setItem(welcomeDismissedKey(userId), '1')
  } else {
    localStorage.removeItem(welcomeDismissedKey(userId))
  }
}
