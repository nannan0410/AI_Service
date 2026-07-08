/**
 * 购票：同条消息人数+日期解析
 * 运行: npx vite-node scripts/test-party-date.mts
 */
import { parsePartyFromMessage } from '../src/utils/ticketPartyParser'
import { parseVisitDateFromMessage } from '../src/utils/visitDateParser'

const refDate = new Date('2026-06-19T10:00:00')

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const partyOnly = parsePartyFromMessage('3人，下周末')
assert(partyOnly.adult === 3, `party adult expected 3, got ${partyOnly.adult}`)

const twoPeopleGe = parsePartyFromMessage('2个人')
assert(twoPeopleGe.adult === 2, `2个人 adult expected 2, got ${twoPeopleGe.adult}`)

const twoPeople = parsePartyFromMessage('2人')
assert(twoPeople.adult === 2, `2人 adult expected 2, got ${twoPeople.adult}`)

const twoPeopleCn = parsePartyFromMessage('两个人')
assert(twoPeopleCn.adult === 2, `两个人 adult expected 2, got ${twoPeopleCn.adult}`)

const dateFromCombo = parseVisitDateFromMessage('3人，下周末', refDate)
assert(dateFromCombo !== null, 'date should parse from combo message')

const dateOnly = parseVisitDateFromMessage('下个周末', refDate)
assert(dateOnly !== null, '下个周末 should parse')

const augFirstWeekend = parseVisitDateFromMessage('8月第一个周末', refDate)
assert(augFirstWeekend === '2026-08-01', `8月第一个周末 expected 2026-08-01, got ${augFirstWeekend}`)

const augFirstWeekendCn = parseVisitDateFromMessage('八月第一个周末', refDate)
assert(augFirstWeekendCn === '2026-08-01', `八月第一个周末 expected 2026-08-01, got ${augFirstWeekendCn}`)

const refLateJune = new Date('2026-06-22T10:00:00')
const augNotThisWeekend = parseVisitDateFromMessage('8月第一个周末', refLateJune)
assert(
  augNotThisWeekend === '2026-08-01',
  `8月第一个周末 should not be this weekend (2026-06-27), got ${augNotThisWeekend}`,
)

console.log('OK: parsers handle combo message')
console.log('  party:', partyOnly)
console.log('  date:', dateFromCombo)
