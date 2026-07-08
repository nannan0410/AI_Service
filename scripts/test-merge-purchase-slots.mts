/**
 * 购票槽位合并（正则 + LLM 结构）单测，不调用 LLM
 * 运行: npx vite-node scripts/test-merge-purchase-slots.mts
 */
import { mergePartyPatch } from '../src/ai/nlu/resolvePurchaseSlots'
import { parsePartyFromMessage } from '../src/utils/ticketPartyParser'
import { parseVisitDateFromMessage, validateIsoVisitDate } from '../src/utils/visitDateParser'

const refDate = new Date('2026-06-19T10:00:00')

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// 正则：3人 + 下周末
const regexParty = parsePartyFromMessage('3人，下周末')
const regexDate = parseVisitDateFromMessage('3人，下周末', refDate)
assert(regexParty.adult === 3, 'regex adult')
assert(regexDate != null, 'regex date')

// LLM 填补：一家三口（正则通常解析不到）
const llmFamily = { adult: 2, child: 1 }
const mergedFamily = mergePartyPatch(parsePartyFromMessage('一家三口下周末去玩'), llmFamily)
assert(mergedFamily.adult === 2 && mergedFamily.child === 1, 'llm fills family party')

// 冲突时正则优先
const mergedConflict = mergePartyPatch({ adult: 3 }, { adult: 2, child: 1 })
assert(mergedConflict.adult === 3 && mergedConflict.child === 1, 'regex wins adult, llm fills child')

// ISO 日期校验
assert(validateIsoVisitDate('2026-06-20', refDate) === '2026-06-20', 'future iso ok')
assert(validateIsoVisitDate('2026-06-19', refDate) === null, 'today rejected')
assert(validateIsoVisitDate('invalid', refDate) === null, 'bad iso rejected')

console.log('OK: merge purchase slots (offline merge helper)')
