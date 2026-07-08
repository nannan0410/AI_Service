/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** 覆盖 config/llm.config.ts 中的 model */
  readonly VITE_LLM_MODEL?: string
  /** 通用 LLM Key（与下方硅基/DeepSeek 变量任选其一） */
  readonly VITE_LLM_API_KEY?: string
  readonly VITE_SILICONFLOW_API_KEY?: string
  readonly VITE_DEEPSEEK_API_KEY?: string
  /** 设为 false 关闭购票 Workflow 内 LLM 槽位提取 */
  readonly VITE_ENABLE_PURCHASE_NLU?: string
  /** 设为 false 关闭 Skill 语义路由 */
  readonly VITE_ENABLE_SKILL_NLU?: string
  /** 设为 false 关闭高置信度 LLM Skill 进入 Workflow（保留 MVP 仅影响 LLM 上下文） */
  readonly VITE_ENABLE_SKILL_WORKFLOW_NLU?: string
  /** 设为 false 关闭游玩攻略子意图 LLM */
  readonly VITE_ENABLE_TRAVEL_GUIDE_NLU?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '*.json' {
  const value: unknown
  export default value
}
