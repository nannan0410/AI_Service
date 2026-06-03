const TOAST_ID = 'app-custom-toast'

export type AppToastOptions = {
  message?: string
  duration?: number
  onClose?: () => void
}

type ToastInput = string | AppToastOptions

let hideTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null

function clearTimers() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function ensureToastEl(): HTMLDivElement {
  let el = document.getElementById(TOAST_ID) as HTMLDivElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = TOAST_ID
    el.className = 'app-custom-toast'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    document.body.appendChild(el)
  }
  return el
}

/** 关闭自定义 Toast */
export function closeAppToast() {
  clearTimers()
  const el = document.getElementById(TOAST_ID)
  if (el) el.style.display = 'none'
}

/**
 * 自定义黑底 Toast（直接挂载到 body，不依赖 Vant 函数式组件）
 */
export function appToast(options: ToastInput) {
  const opts: AppToastOptions =
    typeof options === 'string' ? { message: options } : options
  const message = opts.message ?? ''
  const duration = opts.duration ?? 2000

  clearTimers()

  const el = ensureToastEl()
  el.textContent = message
  el.style.display = 'block'
  el.style.opacity = '1'

  hideTimer = setTimeout(() => {
    el.style.opacity = '0'
    closeTimer = setTimeout(() => {
      el.style.display = 'none'
      el.style.opacity = '1'
      opts.onClose?.()
    }, 200)
  }, duration)

  return { close: closeAppToast }
}
