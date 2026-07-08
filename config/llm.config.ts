export const llmConfig = {
  provider: 'siliconflow',
  baseURL: 'https://api.siliconflow.cn/v1',
  /** 默认模型；可用 .env 的 VITE_LLM_MODEL 覆盖 */
  model: 'deepseek-ai/DeepSeek-V3.2',
  temperature: 0.7,
  toolTemperature: 0.3,
  maxTokens: 2048,
  /** NLU 增强（购票槽位等） */
  nlu: {
    /** 购票 Workflow 内 LLM 抽槽位；可用 VITE_ENABLE_PURCHASE_NLU=false 关闭 */
    purchaseSlots: true,
    purchaseSlotsTemperature: 0.1,
    /** 关键词未命中时 LLM 语义路由 Skill；可用 VITE_ENABLE_SKILL_NLU=false 关闭 */
    skillRouting: true,
    skillRoutingTemperature: 0,
    /** P0-2 增强：LLM 置信度 ≥ 阈值时进入对应 Workflow；可用 VITE_ENABLE_SKILL_WORKFLOW_NLU=false 关闭 */
    skillRoutingWorkflowEnhancement: true,
    skillRoutingWorkflowThreshold: 0.8,
    /** Skill 语义分类 LLM 超时（毫秒），避免短句卡住 */
    skillRoutingTimeoutMs: 15_000,
    /** 游玩攻略 Workflow 内 LLM 子意图；可用 VITE_ENABLE_TRAVEL_GUIDE_NLU=false 关闭 */
    travelGuideIntent: true,
    travelGuideIntentTemperature: 0,
  },
} as const

export type LlmConfig = typeof llmConfig
