import tickets from '../src/mock/products/tickets.json'
import { matchPartyToProducts } from '../src/utils/partyProductMatch'

const products = tickets as import('../src/types').TicketProduct[]

const cases = [
  { label: '2大1小', party: { adult: 2, child: 1, elderly: 0 }, expect: 'single' },
  { label: '2大0小', party: { adult: 2, child: 0, elderly: 0 }, expect: 'single' },
  { label: '3大1小', party: { adult: 3, child: 1, elderly: 0 }, expect: 'multi_product' },
  { label: '1大1小', party: { adult: 1, child: 1, elderly: 0 }, expect: 'multi_product' },
  { label: '2大1老', party: { adult: 2, child: 0, elderly: 1 }, expect: 'no_product' },
] as const

let failed = 0
for (const item of cases) {
  const match = matchPartyToProducts(products, item.party)
  const ok = match.kind === item.expect
  if (!ok) {
    failed += 1
    console.error(`FAIL ${item.label}: expected ${item.expect}, got ${match.kind}`)
  } else {
    console.log(`OK ${item.label} → ${match.kind}`)
  }
}

if (failed > 0) {
  process.exit(1)
}
