/** 问停车场位置 / 怎么去停 → 交通攻略，不是缴费 */
export function isParkingLocationIntent(message: string): boolean {
  return /停车位置|停车场在哪|在哪停车|哪里停车|停车在哪|哪儿停车|停车场地/.test(message)
}

/** 停车缴费 / 交车费 → parking_pay Workflow */
export function isParkingPayIntent(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  if (isParkingLocationIntent(text)) return false
  if (/领券|优惠券|新客券/.test(text)) return false

  return (
    /停车费|停车缴费|交停车费|缴停车费|支付停车费|付停车费|交车费|缴车费|停车付/.test(text) ||
    /车牌.*(缴费|支付|交费)|绑定车牌/.test(text) ||
    /^停车[费吗？?]?$/.test(text) ||
    /我要.*停车(?!场|位置)/.test(text)
  )
}

export function shouldRunParkingPayWorkflow(message: string): boolean {
  return isParkingPayIntent(message)
}
