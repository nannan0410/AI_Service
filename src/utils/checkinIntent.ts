/** 园区打卡 → checkin_service Workflow */
export function shouldRunCheckinWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return (
    /打卡|签到/.test(text) ||
    /景点打卡|园区打卡|打卡领券|我要打卡|去打卡/.test(text)
  )
}
