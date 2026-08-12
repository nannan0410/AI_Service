import type { TicketProduct } from '@/types'
import type { ParsedParty } from '@/utils/ticketPartyParser'

export interface TicketRecommendation {
  product: TicketProduct
  quantity: { adult: number; child: number }
  originalAmount: number
  recommendTag?: string
}

/** 购物车行（仅单品组合；不与套票混单） */
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
  /** 出行总人数（展示用；老人并入 adult 计数时以匹配结果为准） */
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
  if (product.ticketTypeId === 'elderly') {
    return product.price * Math.max(quantity.adult, 1)
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

function buildLine(
  product: TicketProduct,
  purchaseCount: number,
  quantity: { adult: number; child: number },
): CartLinePlan {
  return {
    productId: product.productId,
    productName: product.name,
    ticketTypeId: product.ticketTypeId ?? 'adult',
    unitPrice: product.price,
    purchaseCount,
    purchaseUnit: '张',
    quantity: { ...quantity },
    lineAmount: product.price * purchaseCount,
  }
}

function buildCartFromLines(
  lines: CartLinePlan[],
  partyQuantity: { adult: number; child: number },
  recommendTag?: string,
): CartRecommendation {
  const originalAmount = lines.reduce((sum, line) => sum + line.lineAmount, 0)
  return {
    lines,
    partyQuantity,
    originalAmount,
    recommendTag: recommendTag || '单品组合',
    title: lines.map((line) => line.productName).join(' + '),
  }
}

/**
 * 按出行人数匹配可售 SKU。
 * - 精确套票 → single（套票不与单品混单；含老人时不走套票）
 * - 纯成人 / 纯儿童 / 纯老人 → single
 * - 多票种组合 → cart
 * - 否则 no_product → 购票列表
 */
export function matchPartyToProducts(
  products: TicketProduct[],
  party: ParsedParty,
): PartyProductMatch {
  const selfProducts = filterSelfOnSale(products)
  const adult = Math.max(party.adult, 0)
  const child = Math.max(party.child, 0)
  const elderly = Math.max(party.elderly, 0)

  if (adult <= 0 && child <= 0 && elderly <= 0) {
    return { kind: 'no_product', reason: 'unsupported_party' }
  }

  const adultProduct = selfProducts.find((item) => item.ticketTypeId === 'adult')
  const childProduct = selfProducts.find((item) => item.ticketTypeId === 'child')
  const elderlyProduct = selfProducts.find((item) => item.ticketTypeId === 'elderly')

  // 无老人：保留原套票 / 成人+儿童逻辑
  if (elderly === 0) {
    const exactBundle = findExactBundle(selfProducts, adult, child)
    if (exactBundle) {
      return {
        kind: 'single',
        recommendation: buildSingleRecommendation(exactBundle, { adult, child }),
      }
    }

    if (child === 0 && adult > 0) {
      if (!adultProduct) return { kind: 'no_product', reason: 'no_sku' }
      return {
        kind: 'single',
        recommendation: buildSingleRecommendation(adultProduct, { adult, child: 0 }),
      }
    }

    if (adult === 0 && child > 0) {
      if (!childProduct) return { kind: 'no_product', reason: 'no_sku' }
      return {
        kind: 'single',
        recommendation: buildSingleRecommendation(childProduct, {
          adult: 0,
          child,
        }),
      }
    }

    if (adult > 0 && child > 0) {
      if (!adultProduct || !childProduct) {
        return { kind: 'no_product', reason: 'no_sku' }
      }
      return {
        kind: 'cart',
        recommendation: buildCartFromLines(
          [
            buildLine(adultProduct, adult, { adult, child: 0 }),
            buildLine(childProduct, child, { adult: 0, child }),
          ],
          { adult, child },
        ),
      }
    }

    return { kind: 'no_product', reason: 'no_sku' }
  }

  // 含老人：不走家庭套票；缺老人票 SKU → 兜底列表
  if (!elderlyProduct) {
    return { kind: 'no_product', reason: 'unsupported_party' }
  }

  if (adult === 0 && child === 0 && elderly > 0) {
    return {
      kind: 'single',
      recommendation: buildSingleRecommendation(elderlyProduct, {
        adult: elderly,
        child: 0,
      }),
    }
  }

  const lines: CartLinePlan[] = []
  if (adult > 0) {
    if (!adultProduct) return { kind: 'no_product', reason: 'no_sku' }
    lines.push(buildLine(adultProduct, adult, { adult, child: 0 }))
  }
  if (child > 0) {
    if (!childProduct) return { kind: 'no_product', reason: 'no_sku' }
    lines.push(buildLine(childProduct, child, { adult: 0, child }))
  }
  lines.push(
    buildLine(elderlyProduct, elderly, { adult: elderly, child: 0 }),
  )

  if (lines.length === 1) {
    return {
      kind: 'single',
      recommendation: buildSingleRecommendation(elderlyProduct, {
        adult: elderly,
        child: 0,
      }),
    }
  }

  return {
    kind: 'cart',
    recommendation: buildCartFromLines(lines, {
      adult: adult + elderly,
      child,
    }),
  }
}
