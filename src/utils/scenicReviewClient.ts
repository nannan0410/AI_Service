const STORAGE_KEY = 'scenic_review_client_v1'

type Store = {
  /** `${memberId}:${scenicId}` → dayKey */
  reviewedDay: Record<string, string>
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { reviewedDay: {} }
    const parsed = JSON.parse(raw) as Store
    return { reviewedDay: parsed.reviewedDay ?? {} }
  } catch {
    return { reviewedDay: {} }
  }
}

function writeStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function key(memberId: string, scenicId: string) {
  return `${memberId}:${scenicId}`
}

export function markScenicReviewedToday(input: {
  memberId: string
  scenicId: string
  dayKey: string
}) {
  const store = readStore()
  store.reviewedDay[key(input.memberId, input.scenicId)] = input.dayKey
  writeStore(store)
}

export function hasScenicReviewedTodayLocal(input: {
  memberId: string
  scenicId: string | null | undefined
  dayKey: string
}): boolean {
  if (!input.scenicId) return false
  const store = readStore()
  return store.reviewedDay[key(input.memberId, input.scenicId)] === input.dayKey
}
