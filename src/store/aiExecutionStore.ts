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
  const currentMotion = ref<'idle' | 'thinking' | 'nod' | 'shake' | 'wave' | 'point'>('idle')

  function start(stepsLabels: string[]) {
    visible.value = true
    currentMotion.value = 'thinking'
    steps.value = stepsLabels.map((label, i) => ({
      id: `step_${i}`,
      label,
      status: i === 0 ? 'running' : 'pending',
    }))
  }

  function completeStep(index: number) {
    if (steps.value[index]) {
      steps.value[index].status = 'done'
    }
    const next = steps.value[index + 1]
    if (next) next.status = 'running'
  }

  function finish(success = true) {
    currentMotion.value = success ? 'nod' : 'shake'
    steps.value.forEach((s) => {
      if (s.status !== 'done') s.status = 'done'
    })
    window.setTimeout(() => {
      visible.value = false
      currentMotion.value = 'idle'
      steps.value = []
    }, 2000)
  }

  function reset() {
    visible.value = false
    steps.value = []
    currentMotion.value = 'idle'
  }

  return { steps, visible, currentMotion, start, completeStep, finish, reset }
})
