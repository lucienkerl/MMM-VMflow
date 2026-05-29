const { test } = require('node:test')
const assert = require('node:assert')
const C = require('../lib/compute')

test('dateKey formats YYYY-MM-DD in the given tz', () => {
  // 2026-05-29T22:30:00Z is already 2026-05-30 00:30 in Berlin (UTC+2 summer)
  const ms = Date.parse('2026-05-29T22:30:00Z')
  assert.equal(C.dateKey(ms, 'Europe/Berlin'), '2026-05-30')
  assert.equal(C.dateKey(ms, 'UTC'), '2026-05-29')
})

test('prevDateKey / prevMonthKey do calendar arithmetic', () => {
  assert.equal(C.prevDateKey('2026-03-01'), '2026-02-28')
  assert.equal(C.prevMonthKey('2026-01'), '2025-12')
})

test('pctChange matches the frontend formula', () => {
  assert.equal(C.pctChange(120, 100), 20)
  assert.equal(C.pctChange(50, 100), -50)
  assert.equal(C.pctChange(5, 0), 100)   // prev 0, cur > 0
  assert.equal(C.pctChange(0, 0), null)  // prev 0, cur 0
})

test('computeKpis buckets revenue/count into the six windows', () => {
  const now = new Date('2026-05-29T12:00:00Z') // Berlin 14:00, key 2026-05-29
  const tz = 'Europe/Berlin'
  const sales = [
    { item_price: 2.5, created_at: '2026-05-29T08:00:00Z' }, // today
    { item_price: 1.5, created_at: '2026-05-29T06:00:00Z' }, // today
    { item_price: 3.0, created_at: '2026-05-28T08:00:00Z' }, // yesterday
    { item_price: 4.0, created_at: '2026-05-24T08:00:00Z' }, // within 7d (week)
    { item_price: 9.0, created_at: '2026-05-10T08:00:00Z' }, // 19d ago: month, not week
    { item_price: 5.0, created_at: '2026-04-15T08:00:00Z' }, // last month
  ]
  const k = C.computeKpis(sales, now, tz)
  assert.equal(k.today.revenue, 4.0); assert.equal(k.today.count, 2)
  assert.equal(k.yesterday.revenue, 3.0)
  assert.equal(k.week.revenue, 4.0 + 2.5 + 1.5 + 3.0) // last 7 days incl today+yesterday
  assert.equal(k.month.revenue, 2.5 + 1.5 + 3.0 + 4.0 + 9.0) // May sales
  assert.equal(k.lastMonth.revenue, 5.0)
  assert.equal(k.trends.today, C.pctChange(4.0, 3.0))
})

test('computeTopProductToday picks most-sold product today (snapshot + tray fallback)', () => {
  const now = new Date('2026-05-29T12:00:00Z')
  const tz = 'Europe/Berlin'
  const productMap = new Map([['p1', { name: 'Cola' }], ['p2', { name: 'Water' }]])
  const trayLookup = new Map([['m1:3', { product_id: 'p2', name: 'Water' }]])
  const sales = [
    { product_id: 'p1', created_at: '2026-05-29T08:00:00Z' },
    { product_id: 'p1', created_at: '2026-05-29T09:00:00Z' },
    { product_id: null, machine_id: 'm1', item_number: 3, created_at: '2026-05-29T10:00:00Z' },
    { product_id: 'p1', created_at: '2026-05-28T09:00:00Z' }, // yesterday, ignored
  ]
  const top = C.computeTopProductToday(sales, now, tz, productMap, trayLookup)
  assert.deepEqual(top, { name: 'Cola', units: 2 })
})

function pm() {
  return new Map([
    ['p1', { name: 'Cola', image_path: 'p1.jpg', sellprice: 2.5, discontinued: false }],
    ['p2', { name: 'Water', image_path: null, sellprice: 1.5, discontinued: false }],
    ['p3', { name: 'Old', image_path: null, sellprice: 1.0, discontinued: true }],
  ])
}

test('computeMachineStock: empty=critical, low, fill, with warehouse availability', () => {
  const trays = [
    { machine_id: 'm1', item_number: 1, product_id: 'p1', capacity: 10, current_stock: 0, min_stock: 2, fill_when_below: 0 }, // empty -> critical, refillable
    { machine_id: 'm1', item_number: 2, product_id: 'p2', capacity: 10, current_stock: 2, min_stock: 3, fill_when_below: 0 }, // low -> amber, refillable
    { machine_id: 'm1', item_number: 3, product_id: 'p1', capacity: 10, current_stock: 4, min_stock: 0, fill_when_below: 6 }, // fill (machine already has refillable) -> aggregates into p1
    { machine_id: 'm1', item_number: 4, product_id: 'p3', capacity: 10, current_stock: 0, min_stock: 1, fill_when_below: 0 }, // empty but NO warehouse -> swap
  ]
  const warehouse = new Map([['p1', 50], ['p2', 20]]) // p3 missing
  const out = C.computeMachineStock(trays, pm(), warehouse, true).get('m1')
  assert.equal(out.stock_health, 'critical')
  assert.equal(out.empty_trays, 1)
  assert.equal(out.low_trays, 2) // empty(p1) + low(p2)
  // p1 deficit aggregated: empty tray (10-0=10) + fill tray (10-4=6) = 16, severity critical
  const p1 = out.tray_summary.find(i => i.product_id === 'p1')
  assert.equal(p1.deficit, 16); assert.equal(p1.severity, 'critical'); assert.equal(p1.in_stock, true)
  // sorted by deficit desc
  assert.equal(out.tray_summary[0].product_id, 'p1')
  // p3 -> no_stock_summary, swap (severity critical), in_stock false
  const p3 = out.no_stock_summary.find(i => i.product_id === 'p3')
  assert.equal(p3.severity, 'critical'); assert.equal(p3.in_stock, false); assert.equal(p3.discontinued, true)
})

test('computeMachineStock: no warehouses => everything refillable (backward compat)', () => {
  const trays = [{ machine_id: 'm1', item_number: 1, product_id: 'p1', capacity: 5, current_stock: 0, min_stock: 1, fill_when_below: 0 }]
  const out = C.computeMachineStock(trays, pm(), new Map(), false).get('m1')
  assert.equal(out.tray_summary.length, 1)
  assert.equal(out.no_stock_summary.length, 0)
})

test('computeMachineStock: fill trays ignored when machine has no critical/low', () => {
  const trays = [{ machine_id: 'm1', item_number: 1, product_id: 'p1', capacity: 10, current_stock: 8, min_stock: 0, fill_when_below: 9 }]
  const out = C.computeMachineStock(trays, pm(), new Map([['p1', 5]]), true).get('m1')
  assert.equal(out.stock_health, 'ok')
  assert.equal(out.tray_summary.length, 0)
})
