const { test } = require('node:test')
const assert = require('node:assert')
const C = require('../lib/compute')

test('dateKey formats YYYY-MM-DD in the given tz', () => {
  // 2026-05-29T22:30:00Z is already 2026-05-30 00:30 in Berlin (UTC+2 summer)
  const ms = Date.parse('2026-05-29T22:30:00Z')
  assert.equal(C.dateKey(ms, 'Europe/Berlin'), '2026-05-30')
  assert.equal(C.dateKey(ms, 'UTC'), '2026-05-29')
})

test('resolveTimezone prefers config.timezone, falls back to the host tz', () => {
  assert.equal(C.resolveTimezone({ timezone: 'Europe/Berlin' }), 'Europe/Berlin')
  const host = C.resolveTimezone({})
  assert.equal(typeof host, 'string')
  assert.ok(host.length > 0)
})

test('early-local-day sale counts as today under the operator tz, but is dropped under UTC (the midnight-sales bug)', () => {
  const now = new Date('2026-05-30T10:00:00Z') // 12:00 in Berlin (CEST, UTC+2)
  // A sale at 00:30 Berlin on 2026-05-30 == 22:30 UTC on 2026-05-29.
  const sale = { item_price: 3, created_at: '2026-05-29T22:30:00Z' }
  const berlin = C.computeKpis([sale], now, 'Europe/Berlin')
  assert.equal(berlin.today.revenue, 3) // ✓ counted as today in Berlin (matches the dashboard)
  const utc = C.computeKpis([sale], now, 'UTC')
  assert.equal(utc.today.revenue, 0)    // ✗ dropped from "today" under UTC — the reported bug
  assert.equal(utc.yesterday.revenue, 3)
})

test('dateKey is DST-correct across the Europe/Berlin spring-forward', () => {
  // 2026-03-29 at 02:00 CET clocks spring forward to 03:00 CEST (UTC+2).
  // 21:30 UTC = 23:30 CEST -> still 2026-03-29 locally
  assert.equal(C.dateKey(Date.parse('2026-03-29T21:30:00Z'), 'Europe/Berlin'), '2026-03-29')
  // 22:30 UTC = 00:30 CEST next day -> rolls over to 2026-03-30 locally
  assert.equal(C.dateKey(Date.parse('2026-03-29T22:30:00Z'), 'Europe/Berlin'), '2026-03-30')
})

test('prevDateKey / prevMonthKey do calendar arithmetic', () => {
  assert.equal(C.prevDateKey('2026-03-01'), '2026-02-28')
  assert.equal(C.prevMonthKey('2026-01'), '2025-12')
})

test('pctChange matches the frontend formula', () => {
  assert.equal(C.pctChange(120, 100), 20)
  assert.equal(C.pctChange(50, 100), -50)
  assert.equal(C.pctChange(5, 0), 100)    // prev 0, cur > 0
  assert.equal(C.pctChange(0, 0), null)   // prev 0, cur 0
  assert.equal(C.pctChange(0, 5), -100)   // negative: drop to zero
  assert.equal(C.pctChange(1015, 1000), 2) // Math.round(1.5%) rounds up to 2
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

test('computeMachineStock sorts tray_summary by severity (critical→low→fill), then deficit desc', () => {
  // A high-deficit fill product must NOT outrank a low-deficit critical one.
  const trays = [
    { machine_id: 'm1', item_number: 1, product_id: 'pFill', capacity: 20, current_stock: 5, min_stock: 0, fill_when_below: 10 }, // fill, deficit 15
    { machine_id: 'm1', item_number: 2, product_id: 'pCrit', capacity: 3, current_stock: 0, min_stock: 1, fill_when_below: 0 },    // empty → critical, deficit 3
    { machine_id: 'm1', item_number: 3, product_id: 'pLow', capacity: 10, current_stock: 2, min_stock: 3, fill_when_below: 0 },    // low, deficit 8
  ]
  const out = C.computeMachineStock(trays, new Map(), new Map(), false).get('m1') // no warehouses → all refillable
  assert.deepEqual(out.tray_summary.map(i => i.severity), ['critical', 'low', 'fill'])
  assert.deepEqual(out.tray_summary.map(i => i.product_id), ['pCrit', 'pLow', 'pFill'])
})

test('buildViewModel assembles kpis/machines/feed/totals and honors machineIds filter', () => {
  const now = new Date('2026-05-29T12:00:00Z')
  const raw = {
    machines: [{ id: 'm1', name: 'North', embedded: 'd1' }, { id: 'm2', name: 'South', embedded: 'd2' }],
    devices: [{ id: 'd1', status: 'online' }, { id: 'd2', status: 'offline' }],
    products: [{ id: 'p1', name: 'Cola', image_path: 'p1.jpg', sellprice: 2.5, discontinued: false }],
    trays: [{ machine_id: 'm1', item_number: 1, product_id: 'p1', capacity: 10, current_stock: 0, min_stock: 2, fill_when_below: 0 }],
    batches: [{ product_id: 'p1', quantity: 100 }],
    sales: [{ id: 's1', created_at: '2026-05-29T08:00:00Z', item_price: 2.5, machine_id: 'm1', item_number: 1, product_id: 'p1' }],
  }
  const vm = C.buildViewModel(raw, { machineIds: [], maxFeedItems: 5, timezone: 'Europe/Berlin' }, now)
  assert.equal(vm.machines.length, 2)
  assert.equal(vm.totals.machinesOnline, 1)
  assert.equal(vm.totals.refillMachines, 1)
  assert.equal(vm.kpis.today.revenue, 2.5)
  assert.equal(vm.feed[0].productName, 'Cola')
  assert.equal(vm.feed[0].machineName, 'North')
  // filter to m2 only -> no sales, m1 excluded
  const vm2 = C.buildViewModel(raw, { machineIds: ['m2'], maxFeedItems: 5, timezone: 'Europe/Berlin' }, now)
  assert.equal(vm2.machines.length, 1)
  assert.equal(vm2.kpis.today.revenue, 0)
})
