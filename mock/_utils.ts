import type { PersonaId, UserSnapshot } from '../src/types/index'
import demoNew from '../src/mock/users/demo_new.json'
import demoMid from '../src/mock/users/demo_mid.json'
import demoVip from '../src/mock/users/demo_vip.json'

const snapshots: Record<PersonaId, UserSnapshot> = {
  demo_new: demoNew as UserSnapshot,
  demo_mid: demoMid as UserSnapshot,
  demo_vip: demoVip as UserSnapshot,
}

const personaLabels: Record<PersonaId, { nickname: string; memberId: string }> = {
  demo_new: { nickname: '新用户小明', memberId: '10001' },
  demo_mid: { nickname: '中级会员小红', memberId: '10002' },
  demo_vip: { nickname: '高级会员老王', memberId: '10003' },
}

/** In-memory plate binding overrides per persona (demo session) */
const plateOverrides: Partial<Record<PersonaId, string>> = {}

export function parsePersonaFromAuthHeader(auth?: string): PersonaId | null {
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const match = token.match(/^mock_token_(demo_(?:new|mid|vip))_/)
  return (match?.[1] as PersonaId) ?? null
}

function cloneSnapshot<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T
}

export function getSnapshot(personaId: PersonaId): UserSnapshot {
  const base = cloneSnapshot(snapshots[personaId])
  if (plateOverrides[personaId] !== undefined) {
    base.visitorState.boundPlateNo = plateOverrides[personaId]
  }
  base.visitorState.recentOrders = base.orders
  return base
}

export function bindPlate(personaId: PersonaId, plateNo: string): { ok: boolean; message?: string } {
  const snapshot = snapshots[personaId]
  if (snapshot.visitorState.boundPlateNo || plateOverrides[personaId]) {
    return { ok: false, message: '已绑定车牌，演示版不可变更' }
  }
  plateOverrides[personaId] = plateNo
  return { ok: true }
}

export function createToken(personaId: PersonaId): string {
  return `mock_token_${personaId}_${Date.now()}`
}

export function getUserInfo(personaId: PersonaId) {
  const label = personaLabels[personaId]
  return {
    memberId: label.memberId,
    personaId,
    nickname: label.nickname,
  }
}

export { snapshots, personaLabels }
