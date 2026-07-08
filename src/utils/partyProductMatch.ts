import type { TicketProduct } from '@/types'
import type { ParsedParty } from '@/utils/ticketPartyParser'
import { getEffectiveAdultCount } from '@/utils/ticketPartyParser'

export interface TicketRecommendation {
  product: TicketProduct
  quantity: { adult: number; child: number }
  originalAmount: number
  recommendTag?: string
}

function getTicketRecommendLabel(product: TicketProduct): string | undefined {
  const label = product.recommendLabel?.trim()
  return label || undefined
}

export interface ProductLinePlan {
  productId: string
  productName: string
  quantity: { adult: number; child: number }
}

export type PartyProductMatch =
  | { kind: 'single'; recommendation: TicketRecommendation }
  | { kind: 'no_product'; reason: 'no_sku' | 'unsupported_party' }
  | { kind: 'multi_product'; plan: ProductLinePlan[] }

function filterSelfOnSale(products: TicketProduct[]): TicketProduct[] {
  return products.filter((item) => item.channels.includes('self') && item.status === 'on')
}

function buildSingleRecommendation(
  product: TicketProduct,
  quantity: { adult: number; child: number },
): TicketRecommendation {
  const isAdultTicket = product.ticketTypeId === 'adult'
  const originalAmount = isAdultTicket
    ? product.price * Math.max(quantity.adult, 1)
    : product.price
  return {
    product,
    quantity,
    originalAmount,
    recommendTag: getTicketRecommendLabel(product),
  }
}

function findExactBundle(
  products: TicketProduct[],
  totalAdult: number,
  child: number,
): TicketProduct | undefined {
  return products.find((item) => {
    const composition = item.composition
    return composition?.adult === totalAdult && composition.child === child
  })
}

/** 试算最少 SKU 组合；返回 null 表示目录无法覆盖 */
function tryBuildProductPlan(
  products: TicketProduct[],
  totalAdult: number,
  child: number,
): ProductLinePlan[] | null {
  const adultProduct = products.find((item) => item.ticketTypeId === 'adult')
  const childProduct = products.find((item) => item.ticketTypeId === 'child')
  const bundles = products.filter((item) => item.composition)

  for (const bundle of bundles) {
    const composition = bundle.composition!
    const remainAdult = totalAdult - composition.adult
    const remainChild = child - composition.child
    if (remainAdult < 0 || remainChild < 0) continue

    const lines: ProductLinePlan[] = [
      {
        productId: bundle.productId,
        productName: bundle.name,
        quantity: { ...composition },
      },
    ]

    if (remainAdult === 0 && remainChild === 0) {
      return lines
    }

    if (remainChild > 0) continue

    if (remainAdult > 0) {
      if (!adultProduct) return null
      lines.push({
        productId: adultProduct.productId,
        productName: adultProduct.name,
        quantity: { adult: remainAdult, child: 0 },
      })
      return lines
    }
  }

  if (child === 0 && totalAdult > 0) {
    if (!adultProduct) return null
    return [
      {
        productId: adultProduct.productId,
        productName: adultProduct.name,
        quantity: { adult: totalAdult, child: 0 },
      },
    ]
  }

  if (totalAdult === 0 && child > 0) {
    if (!childProduct) return null
    return [
      {
        productId: childProduct.productId,
        productName: childProduct.name,
        quantity: { adult: 0, child },
      },
    ]
  }

  if (totalAdult > 0 && child > 0) {
    if (!adultProduct || !childProduct) return null
    return [
      {
        productId: adultProduct.productId,
        productName: adultProduct.name,
        quantity: { adult: totalAdult, child: 0 },
      },
      {
        productId: childProduct.productId,
        productName: childProduct.name,
        quantity: { adult: 0, child },
      },
    ]
  }

  return null
}

/** 按出行人数匹配可售 SKU；仅 `single` 可在助手内一键下单 */
export function matchPartyToProducts(
  products: TicketProduct[],
  party: ParsedParty,
): PartyProductMatch {
  const selfProducts = filterSelfOnSale(products)
  const totalAdult = getEffectiveAdultCount(party)
  const { child, elderly } = party

  if (elderly > 0) {
    return { kind: 'no_product', reason: 'unsupported_party' }
  }

  const exactBundle = findExactBundle(selfProducts, totalAdult, child)
  if (exactBundle) {
    return {
      kind: 'single',
      recommendation: buildSingleRecommendation(exactBundle, {
        adult: totalAdult,
        child,
      }),
    }
  }

  if (child === 0 && totalAdult > 0) {
    const adultProduct = selfProducts.find((item) => item.ticketTypeId === 'adult')
    if (!adultProduct) {
      return { kind: 'no_product', reason: 'no_sku' }
    }
    return {
      kind: 'single',
      recommendation: buildSingleRecommendation(adultProduct, {
        adult: totalAdult,
        child: 0,
      }),
    }
  }

  const plan = tryBuildProductPlan(selfProducts, totalAdult, child)
  if (!plan) {
    return { kind: 'no_product', reason: 'no_sku' }
  }

  if (plan.length === 1) {
    const line = plan[0]
    const product = selfProducts.find((item) => item.productId === line.productId)
    if (!product) {
      return { kind: 'no_product', reason: 'no_sku' }
    }
    return {
      kind: 'single',
      recommendation: buildSingleRecommendation(product, line.quantity),
    }
  }

  return { kind: 'multi_product', plan }
}
