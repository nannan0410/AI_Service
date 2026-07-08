/**
 * Skill 触发词校验：全局唯一 + 子意图必选词
 * 运行: npx vite-node scripts/test-skill-keyword-validation.mts
 */
import defaultSkills from '../src/mock/assistant/skills.json'
import type { AssistantSkillConfig } from '../src/types'
import {
  mergeLockedKeywordsIntoTriggerKeywords,
  validateSkillTriggerKeywords,
} from '../src/utils/skillKeywordValidation'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const skills = defaultSkills as AssistantSkillConfig[]

const merged = skills.map((skill) => ({
  ...skill,
  triggerKeywords: mergeLockedKeywordsIntoTriggerKeywords(skill),
}))

const validation = validateSkillTriggerKeywords(merged)
assert(validation.ok, `default skills should pass: ${JSON.stringify(validation)}`)

const dupSkills: AssistantSkillConfig[] = [
  ...merged,
  {
    ...merged[0],
    skillId: 'fake_dup',
    name: '重复测试',
    triggerKeywords: ['买票'],
  },
]
const dupResult = validateSkillTriggerKeywords(dupSkills)
assert(!dupResult.ok && dupResult.conflicts.length > 0, 'duplicate keyword should fail')

const missingSkills = merged.map((skill) =>
  skill.skillId === 'travel_guide'
    ? {
        ...skill,
        triggerKeywords: (skill.triggerKeywords ?? []).filter((w) => w !== '在园区内'),
      }
    : skill,
)
const missingResult = validateSkillTriggerKeywords(missingSkills)
assert(
  !missingResult.ok && missingResult.missingBySkill.some((m) => m.skillId === 'travel_guide'),
  'missing locked keyword should fail',
)

console.log('OK: skill keyword validation')
