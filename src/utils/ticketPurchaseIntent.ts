import { looksLikePartyIntent } from '@/utils/ticketPartyParser'
import { looksLikeDateIntent } from '@/utils/visitDateParser'

export function shouldRunTicketWorkflow(message: string): boolean {
  return /两大一小|2大1小|买票|购票|门票|套票|家庭票|年卡|首次购票|购票指引/.test(message)
}

export function isTicketPurchaseIntent(message: string): boolean {
  return (
    shouldRunTicketWorkflow(message) ||
    looksLikePartyIntent(message) ||
    looksLikeDateIntent(message)
  )
}

export function isTicketConfirmIntent(message: string): boolean {
  return /确认|就这个|可以|没问题|生成订单/.test(message)
}
