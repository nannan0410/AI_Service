import assert from 'node:assert/strict'
import activities from '../src/mock/activities.json' with { type: 'json' }
import type { Activity } from '../src/types/index.ts'
import {
  buildShowScheduleReply,
  findNextShowSlot,
  listTodayShowSlots,
} from '../src/utils/showSchedule.ts'
import { shouldRunShowScheduleWorkflow } from '../src/utils/showScheduleIntent.ts'

const shows = activities as Activity[]

assert.equal(shouldRunShowScheduleWorkflow('今天有哪些演出？下一场几点开始？'), true)

const afternoon = new Date(2026, 5, 30, 15, 0, 0)
const slots = listTodayShowSlots(shows, afternoon)
assert.equal(slots.length, 4)
assert.equal(findNextShowSlot(slots, afternoon)?.startTime, '16:00')
assert.equal(findNextShowSlot(slots, afternoon)?.activityName, '花车巡游')

const evening = new Date(2026, 5, 30, 17, 0, 0)
assert.equal(findNextShowSlot(slots, evening)?.startTime, '20:00')
assert.equal(findNextShowSlot(slots, evening)?.activityName, '水上灯光秀')

const reply = buildShowScheduleReply(slots, afternoon)
assert.match(reply, /16:00 花车巡游/)
assert.match(reply, /20:00/)

console.log('test-show-schedule: ok')
