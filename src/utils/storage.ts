import { storageKey, STORAGE_SUFFIX } from './storageKeys'

export function getItem<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function removeItem(key: string): void {
  localStorage.removeItem(key)
}

export function getUserStorage<T>(userId: string, suffix: string, fallback: T): T {
  return getItem(storageKey(userId, suffix), fallback)
}

export function setUserStorage<T>(userId: string, suffix: string, value: T): void {
  setItem(storageKey(userId, suffix), value)
}

export function removeUserStorage(userId: string, suffix: string): void {
  removeItem(storageKey(userId, suffix))
}

export { storageKey, STORAGE_SUFFIX }
