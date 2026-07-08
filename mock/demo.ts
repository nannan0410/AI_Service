import type { MockMethod } from 'vite-plugin-mock'
import { resetAllDemoSnapshots } from './_utils'

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
] as MockMethod[]
