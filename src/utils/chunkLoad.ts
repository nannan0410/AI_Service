/**
 * Vite 懒加载分片失败检测与一次性整页刷新。
 *
 * 典型场景：线上刚换包，浏览器还握着旧的主包，去拉已经不存在的 `OrderSubmitPage-旧hash.js`，
 * 控制台出现 `Failed to fetch dynamically imported module`。整页刷新可拿到新 index.html。
 */

const RELOAD_FLAG = 'ai_assistant_chunk_reload'

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    message,
  )
}

/** 分片加载失败时整页刷新一次；同一会话只刷一次，避免死循环 */
export function reloadOnceForChunkError(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') return false
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    /* 隐私模式等无法写 sessionStorage 时仍尝试刷新 */
  }
  window.location.reload()
  return true
}

export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG)
  } catch {
    /* ignore */
  }
}
