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
