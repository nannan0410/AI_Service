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
  /** 仅该景区展示；与 scenicIds 二选一或同时用（需都满足） */
  scenicId?: string
  /** 适用景区列表；缺省时运行时仍视为全景区，后台编辑/默认 JSON 应显式列出 */
  scenicIds?: string[]
  rules: RuleExpression[]
}

/** 欢迎页「游游推荐」单条配置（与快捷服务同一套规则模型） */
export interface WelcomeQuestionConfig {
  id: string
  icon: string
  text: string
  /** 点击开聊时的提示词；target=page/h5 时可作兜底文案 */
  prompt: string
  badgeColor?: string
  /** 游游推荐卡片副标题 */
  desc?: string
  /** 默认 true */
  enabled?: boolean
  priority?: number
  scenicId?: string
  /** 适用景区列表；缺省时运行时仍视为全景区，后台编辑/默认 JSON 应显式列出 */
  scenicIds?: string[]
  /**
   * 强制置顶：命中后插到游游推荐第一位（同列表多条置顶时取 priority 最高的一条）
   */
  pinTop?: boolean
  /**
   * 点击行为；缺省 chat（兼容旧配置）
   * - chat：发起对话（用 prompt）
   * - page：跳转小程序/H5 内页
   * - h5：外链或 H5 路径
   */
  target?: RecommendEntryTarget
  /** page / h5 / mini_program 跳转路径或 URL */
  targetPath?: string
  /** 触发规则（与 RecommendEntry.rules 相同） */
  rules: RuleExpression[]
}

/** 按 persona 的欢迎页模板文案（游游推荐已独立为 welcomeQuestions） */
export interface WelcomeTemplateConfig {
  personaId: PersonaId
  /** 仅该景区；缺省表示全景区通用（可用 {{scenicName}}） */
  scenicId?: string
  scenicIds?: string[]
  title: string
  subtitle: string
  body: string
  highlights: string[]
  /** @deprecated 已迁移至全局 welcomeQuestions；保留兼容旧 LocalStorage */
  suggestedQuestions?: WelcomeQuestionConfig[]
}

/** LocalStorage 业务配置覆盖 */
export interface AdminBusinessPatch {
  skills?: AssistantSkillConfig[]
  recommendEntries?: RecommendEntryConfig[]
  welcomeTemplates?: WelcomeTemplateConfig[]
  /** 游游推荐全局列表（规则过滤） */
  welcomeQuestions?: WelcomeQuestionConfig[]
}

/** Skill Workflow 子意图目录（演示版只读，供后台展示与触发词校验） */
export interface SkillSubIntentDef {
  intentId: string
  label: string
  description?: string
  keywords: string[]
}

export type SkillIntentCatalog = Record<string, SkillSubIntentDef[]>
