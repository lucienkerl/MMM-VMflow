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

function computeKpis(sales, now, tz) {
  const nowMs = now.getTime()
  const todayK = dateKey(nowMs, tz), yK = prevDateKey(todayK)
  const monthK = monthKey(nowMs, tz), lastMonthK = prevMonthKey(monthK)
  const weekFrom = nowMs - 7 * DAY_MS, lastWeekFrom = nowMs - 14 * DAY_MS
  const z = () => ({ revenue: 0, count: 0 })
  const r = { today: z(), yesterday: z(), week: z(), lastWeek: z(), month: z(), lastMonth: z() }
  for (const s of sales) {
    const ms = new Date(s.created_at).getTime()
    const price = s.item_price || 0
    const dk = dateKey(ms, tz), mk = dk.slice(0, 7)
    if (dk === todayK) { r.today.revenue += price; r.today.count++ }
    else if (dk === yK) { r.yesterday.revenue += price; r.yesterday.count++ }
    if (ms >= weekFrom) { r.week.revenue += price; r.week.count++ }
    else if (ms >= lastWeekFrom) { r.lastWeek.revenue += price; r.lastWeek.count++ }
    if (mk === monthK) { r.month.revenue += price; r.month.count++ }
    else if (mk === lastMonthK) { r.lastMonth.revenue += price; r.lastMonth.count++ }
  }
  r.trends = {
    today: pctChange(r.today.revenue, r.yesterday.revenue),
    week: pctChange(r.week.revenue, r.lastWeek.revenue),
    month: pctChange(r.month.revenue, r.lastMonth.revenue),
  }
  return r
}

function resolveProduct(sale, productMap, trayLookup) {
  let id = sale.product_id || null
  let name = id ? (productMap.get(id) && productMap.get(id).name) || null : null
  if (!id && sale.machine_id != null) {
    const t = trayLookup.get(`${sale.machine_id}:${sale.item_number}`)
    if (t) { id = t.product_id; name = t.name }
  }
  return id && name ? { id, name } : null
}

function computeTopProductToday(sales, now, tz, productMap, trayLookup) {
  const todayK = dateKey(now.getTime(), tz)
  const agg = new Map()
  for (const s of sales) {
    if (dateKey(new Date(s.created_at).getTime(), tz) !== todayK) continue
    const p = resolveProduct(s, productMap, trayLookup)
    if (!p) continue
    const e = agg.get(p.id) || { name: p.name, units: 0 }
    e.units++; agg.set(p.id, e)
  }
  let top = null
  for (const v of agg.values()) if (!top || v.units > top.units) top = v
  return top ? { name: top.name, units: top.units } : null
}

module.exports = { DAY_MS, dateKey, monthKey, prevDateKey, prevMonthKey, pctChange, computeKpis, resolveProduct, computeTopProductToday }
