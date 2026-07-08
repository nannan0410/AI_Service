import type { AssistantSkillConfig, MessageType, PersonaId } from './index'

export type RecommendEntryTarget = 'chat' | 'page' | 'h5' | 'mini_program'
export type FieldValueType = 'boolean' | 'string' | 'string[]' | 'enum'

export interface FieldEnumOption {
  value: string
  label: string
}

export interface FieldCatalogItem {
  fieldId: string
  label: string
  description?: string
  valueType: FieldValueType
  source: 'computed' | 'mock_api' | 'api'
  computeHint?: string
  enumOptions?: FieldEnumOption[]
  ruleEligible: boolean
  group: 'user' | 'order' | 'visit' | 'tag'
}

export interface TagCatalogItem {
  tagId: string
  name: string
  description?: string
  demoPersonas?: PersonaId[]
}

export interface FieldCatalog {
  version: string
  fields: FieldCatalogItem[]
  tags: TagCatalogItem[]
}

export type RuleExpression =
  | { op: 'eq'; field: string; value: unknown }
  | { op: 'in'; field: string; values: unknown[] }
  | { op: 'contains'; field: string; value: string }
  | { op: 'and' | 'or'; rules: RuleExpression[] }

export interface CardFieldDef {
  fieldKey: string
  label: string
  visible: boolean
  order: number
  format?: 'money' | 'date' | 'badge' | 'plain'
}

export interface CardViewConfig {
  cardType: MessageType
  label: string
  maxItems?: number
  fields: CardFieldDef[]
  sourceTools?: string[]
}

/** 欢迎页/聊天推荐入口完整配置（含规则，供后台与 merge 使用） */
export interface RecommendEntryConfig {
  entryId: string
  title: string
  icon: string
  target: RecommendEntryTarget
  targetPath?: string
  skillId?: string
  promptHint?: string
  priority: number
  /** 默认 true */
  enabled?: boolean
  rules: RuleExpression[]
}

/** 欢迎页「猜你想问」单条配置 */
export interface WelcomeQuestionConfig {
  id: string
  icon: string
  text: string
  prompt: string
  badgeColor?: string
  /** 游游推荐卡片副标题 */
  desc?: string
  /** 默认 true */
  enabled?: boolean
  priority?: number
}

/** 按 persona 的欢迎页模板（含猜你想问） */
export interface WelcomeTemplateConfig {
  personaId: PersonaId
  title: string
  subtitle: string
  body: string
  highlights: string[]
  suggestedQuestions: WelcomeQuestionConfig[]
}

/** LocalStorage 业务配置覆盖 */
export interface AdminBusinessPatch {
  skills?: AssistantSkillConfig[]
  recommendEntries?: RecommendEntryConfig[]
  welcomeTemplates?: WelcomeTemplateConfig[]
}

/** Skill Workflow 子意图目录（演示版只读，供后台展示与触发词校验） */
export interface SkillSubIntentDef {
  intentId: string
  label: string
  description?: string
  keywords: string[]
}

export type SkillIntentCatalog = Record<string, SkillSubIntentDef[]>
