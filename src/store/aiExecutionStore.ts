import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToolStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
}

export const useAiExecutionStore = defineStore('aiExecution', () => {
  const steps = ref<ToolStep[]>([])
  const visible = ref(false)

  function reset() {
    visible.value = false
    steps.value = []
  }

  function startPipeline() {
    visible.value = true
    steps.value = [
      { id: 'intent', label: '理解用户意图', status: 'running' },
      { id: 'model', label: '调用 AI 模型', status: 'pending' },
    ]
  }

  function markIntentDone() {
    const intent = steps.value.find((s) => s.id === 'intent')
    if (intent) intent.status = 'done'
  }

  function addSkillStep(skillName: string) {
    const existing = steps.value.find((s) => s.id === 'skill')
    if (existing) {
      existing.label = `识别场景：${skillName}`
      existing.status = 'done'
      return
    }
    steps.value.push({
      id: 'skill',
      label: `识别场景：${skillName}`,
      status: 'done',
    })
    const model = steps.value.find((s) => s.id === 'model')
    if (model && model.status === 'pending') model.status = 'running'
  }

  function markIntentDoneAndStartModel() {
    markIntentDone()
    const model = steps.value.find((s) => s.id === 'model')
    if (model && model.status === 'pending') model.status = 'running'
  }

  function addToolStep(toolName: string, label: string) {
    const model = steps.value.find((s) => s.id === 'model')
    if (model && model.status === 'running') model.status = 'done'

    const existing = steps.value.find((s) => s.id === `tool_${toolName}`)
    if (existing) {
      existing.status = 'running'
      return
    }

    steps.value.push({
      id: `tool_${toolName}`,
      label,
      status: 'running',
    })
  }

  function completeToolStep(toolName: string, success: boolean) {
    const step = steps.value.find((s) => s.id === `tool_${toolName}`)
    if (step) step.status = success ? 'done' : 'error'
  }

  function beginCompose() {
    const compose = steps.value.find((s) => s.id === 'compose')
    if (compose) {
      compose.status = 'running'
      return
    }
    steps.value.push({ id: 'compose', label: '组织回复', status: 'running' })
  }

  function finish(success = true) {
    steps.value.forEach((s) => {
      if (s.status === 'running' || s.status === 'pending') {
        s.status = success ? 'done' : 'error'
      }
    })
    window.setTimeout(() => {
      reset()
    }, 2000)
  }

  /** @deprecated 兼容旧调用 */
  function start(stepsLabels: string[]) {
    visible.value = true
    steps.value = stepsLabels.map((label, i) => ({
      id: `step_${i}`,
      label,
      status: i === 0 ? 'running' : 'pending',
    }))
  }

  /** @deprecated 兼容旧调用 */
  function completeStep(index: number) {
    if (steps.value[index]) {
      steps.value[index].status = 'done'
    }
    const next = steps.value[index + 1]
    if (next) next.status = 'running'
  }

  return {
    steps,
    visible,
    reset,
    startPipeline,
    markIntentDone,
    markIntentDoneAndStartModel,
    addSkillStep,
    addToolStep,
    completeToolStep,
    beginCompose,
    finish,
    start,
    completeStep,
  }
})
