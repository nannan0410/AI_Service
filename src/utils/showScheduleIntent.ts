/** 今日演出 / 下一场演出时间 → 演出场次 Workflow */
export function shouldRunShowScheduleWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return (
    /下一场.{0,8}(演出|表演|秀)/.test(text) ||
    /(今天|今日).{0,12}(有哪些|有什么|啥).{0,6}演出/.test(text) ||
    /演出.{0,8}(安排|时间|场次|几点|开始)/.test(text) ||
    /(灯光秀|花车|巡游|水上秀).{0,8}(几点|开始|时间)/.test(text) ||
    /^今天有哪些演出/.test(text)
  )
}
