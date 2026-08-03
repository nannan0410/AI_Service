import type { TicketProduct } from '@/types'
import type { ParsedParty } from '@/utils/ticketPartyParser'
import { getEffectiveAdultCount } from '@/utils/ticketPartyParser'

export interface TicketRecommendation {
  product: TicketProduct
  quantity: { adult: number; child: number }
  originalAmount: number
  recommendTag?: string
}

/** 购物车行（仅单品成人/儿童票组合；不与套票混单） */
export interface CartLinePlan {
  productId: string
  productName: string
  ticketTypeId: string
  unitPrice: number
  /** 购买张数 */
  purchaseCount: number
  purchaseUnit: '张' | '套'
  quantity: { adult: number; child: number }
  lineAmount: number
}

export interface CartRecommendation {
  lines: CartLinePlan[]
  /** 出行总人数 */
  partyQuantity: { adult: number; child: number }
  originalAmount: number
  recommendTag?: string
  /** 展示用汇总标题 */
  title: string
}

export type PartyProductMatch =
  | { kind: 'single'; recommendation: TicketRecommendation }
  | { kind: 'cart'; recommendation: CartRecommendation }
  | { kind: 'no_product'; reason: 'no_sku' | 'unsupported_party' }

function getTicketRecommendLabel(product: TicketProduct): string | undefined {
  const label = product.recommendLabel?.trim()
  return label || undefined
}

function filterSelfOnSale(products: TicketProduct[]): TicketProduct[] {
  return products.filter((item) => item.channels.includes('self') && item.status === 'on')
}

export function calcTicketLineAmount(
  product: TicketProduct,
  quantity: { adult: number; child: number },
): number {
  if (product.composition) {
    return product.price
  }
  if (product.ticketTypeId === 'adult') {
    return product.price * Math.max(quantity.adult, 1)
  }
  if (product.ticketTypeId === 'child') {
    return product.price * Math.max(quantity.child, 1)
  }
  return product.price
}

function buildSingleRecommendation(
  product: TicketProduct,
  quantity: { adult: number; child: number },
): TicketRecommendation {
  return {
    product,
    quantity,
    originalAmount: calcTicketLineAmount(product, quantity),
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

function buildAdultChildCart(
  adultProduct: TicketProduct,
  childProduct: TicketProduct,
  totalAdult: number,
  child: number,
): CartRecommendation {
  const lines: CartLinePlan[] = [
    {
      productId: adultProduct.productId,
      productName: adultProduct.name,
      ticketTypeId: adultProduct.ticketTypeId ?? 'adult',
      unitPrice: adultProduct.price,
      purchaseCount: totalAdult,
      purchaseUnit: '张',
      quantity: { adult: totalAdult, child: 0 },
      lineAmount: adultProduct.price * totalAdult,
    },
    {
      productId: childProduct.productId,
      productName: childProduct.name,
      ticketTypeId: childProduct.ticketTypeId ?? 'child',
      unitPrice: childProduct.price,
      purchaseCount: child,
      purchaseUnit: '张',
      quantity: { adult: 0, child },
      lineAmount: childProduct.price * child,
    },
  ]
  const originalAmount = lines.reduce((sum, line) => sum + line.lineAmount, 0)
  return {
    lines,
    partyQuantity: { adult: totalAdult, child },
    originalAmount,
    recommendTag: '单品组合',
    title: `${adultProduct.name} + ${childProduct.name}`,
  }
}

/**
 * 按出行人数匹配可售 SKU。
 * - 精确套票 → single（套票不与单品混单）
 * - 纯成人 / 纯儿童 → single
 * - 成人+儿童且无精确套票 → cart（仅成人票+儿童票）
 * - 否则 no_product → 购票列表
 */
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

  if (totalAdult <= 0 && child <= 0) {
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

  const adultProduct = selfProducts.find((item) => item.ticketTypeId === 'adult')
  const childProduct = selfProducts.find((item) => item.ticketTypeId === 'child')

  if (child === 0 && totalAdult > 0) {
    if (!adultProduct) return { kind: 'no_product', reason: 'no_sku' }
    return {
      kind: 'single',
      recommendation: buildSingleRecommendation(adultProduct, {
        adult: totalAdult,
        child: 0,
      }),
    }
  }

  if (totalAdult === 0 && child > 0) {
    if (!childProduct) return { kind: 'no_product', reason: 'no_sku' }
    return {
      kind: 'single',
      recommendation: buildSingleRecommendation(childProduct, {
        adult: 0,
        child,
      }),
    }
  }

  // 成人+儿童且无精确套票：仅单品购物车，绝不套票+单品混单
  if (totalAdult > 0 && child > 0) {
    if (!adultProduct || !childProduct) {
      return { kind: 'no_product', reason: 'no_sku' }
    }
    return {
      kind: 'cart',
      recommendation: buildAdultChildCart(
        adultProduct,
        childProduct,
        totalAdult,
        child,
      ),
    }
  }

  return { kind: 'no_product', reason: 'no_sku' }
}
