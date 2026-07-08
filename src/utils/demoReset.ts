import { removeUserStorage, STORAGE_SUFFIX } from '@/utils/storage'

/** 三个演示账号 memberId（与 mock/_utils personaLabels 一致） */
export const DEMO_MEMBER_IDS = ['10001', '10002', '10003'] as const

/** 清除浏览器侧演示业务数据（小票记录等） */
export function clearDemoClientStorage(): void {
  for (const memberId of DEMO_MEMBER_IDS) {
    removeUserStorage(memberId, STORAGE_SUFFIX.RECEIPTS)
  }
}
