/** 对话内申请发票 / 报销 → invoice_service Workflow */
export function shouldRunInvoiceWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false

  return (
    /开发票|申请发票|开具发票|我要发票|需要发票/.test(text) ||
    /批量.{0,4}开票|批量.{0,4}发票/.test(text) ||
    (/开票|发票|报销/.test(text) &&
      !/发票是什么|怎么开发票教程|发票政策/.test(text))
  )
}
