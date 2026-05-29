'use strict'

const DAY_MS = 24 * 60 * 60 * 1000

function dateKey(ms, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms)) // 'YYYY-MM-DD'
}
function monthKey(ms, tz) { return dateKey(ms, tz).slice(0, 7) }

function prevDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}
function prevMonthKey(mkey) {
  const [y, m] = mkey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, 1)); dt.setUTCMonth(dt.getUTCMonth() - 1)
  return dt.toISOString().slice(0, 7)
}

function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : null
  return Math.round(((current - previous) / previous) * 100)
}

module.exports = { DAY_MS, dateKey, monthKey, prevDateKey, prevMonthKey, pctChange }
