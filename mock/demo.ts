import type { MockMethod } from 'vite-plugin-mock'
import {
  parsePersonaFromAuthHeader,
  resetAllDemoSnapshots,
  runDemoOps,
  type DemoOpsAction,
} from './_utils'

const DEMO_OPS_ACTIONS: DemoOpsAction[] = [
  'clear_new_guest_coupon',
  'ensure_today_paid_order',
  'ensure_today_completed_order',
  'reset_invoice_status',
]

function isDemoOpsAction(value: unknown): value is DemoOpsAction {
  return typeof value === 'string' && (DEMO_OPS_ACTIONS as string[]).includes(value)
}

export default [
  {
    url: '/api/demo/reset',
    method: 'post',
    response: () => {
      resetAllDemoSnapshots()
      return {
        code: 200,
        data: { ok: true },
        message: '演示业务数据已重置',
      }
    },
  },
  {
    url: '/api/demo/ops',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { action?: string }
    }) => {
      const personaId = parsePersonaFromAuthHeader(headers.authorization as string | undefined)
      if (!personaId) {
        return { code: 401, message: '请先登录演示账号', data: null }
      }
      if (!isDemoOpsAction(body?.action)) {
        return {
          code: 400,
          message: `无效操作，可选：${DEMO_OPS_ACTIONS.join(' / ')}`,
          data: null,
        }
      }
      const result = runDemoOps(personaId, body.action)
      return { code: 200, data: result, message: result.message }
    },
  },
] as MockMethod[]
