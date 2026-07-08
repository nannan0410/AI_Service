export function shouldRunOrderQueryWorkflow(message: string): boolean {
  return /订单|查订单|我的订单|OTA|第三方|订票记录|我的票|TA/.test(message)
}
