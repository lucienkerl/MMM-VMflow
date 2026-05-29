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
