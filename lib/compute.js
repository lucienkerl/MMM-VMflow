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

// ── Product groups (all slots of one product in one machine) ─────────
// Port of management-frontend/app/lib/stock-health.ts (`classifyTrayStock`,
// `groupTraysByProduct`, `groupNeedsRefill`). Stock is judged per product within a
// machine, not per slot: Cola in three spirals at 0/2/9 is 11 Cola, not a sold-out slot.
// Stock, capacity, min_stock and fill_when_below add up over the slots, so a product in
// a single slot classifies exactly as before.

function classifyTrayStock(t) {
  if (t.current_stock === 0) return 'critical'
  if (t.min_stock > 0 && t.current_stock <= t.min_stock) return 'low'
  if (t.fill_when_below > 0 && t.current_stock <= t.fill_when_below) return 'fill'
  return 'ok'
}

// Unassigned trays are skipped; groups keep first-appearance order.
function groupTraysByProduct(trays) {
  const groups = new Map()
  for (const t of trays) {
    if (t.product_id == null) continue
    const key = `${t.machine_id}|${t.product_id}`
    let g = groups.get(key)
    if (!g) {
      g = { machine_id: t.machine_id, product_id: t.product_id, trays: [], current_stock: 0, capacity: 0, min_stock: 0, fill_when_below: 0, state: 'ok', deficit: 0, emptySlots: 0 }
      groups.set(key, g)
    }
    g.trays.push(t)
    g.current_stock += t.current_stock
    g.capacity += t.capacity
    g.min_stock += t.min_stock || 0
    g.fill_when_below += t.fill_when_below || 0
  }
  for (const g of groups.values()) {
    g.state = classifyTrayStock(g)
    g.deficit = Math.max(0, g.capacity - g.current_stock)
    // Slots at 0 while the product still has stock in another slot — a hint, not a refill.
    g.emptySlots = g.current_stock > 0 ? g.trays.filter(t => t.current_stock === 0).length : 0
  }
  return [...groups.values()]
}

// A `fill`-tier group that is already full (fill_when_below >= capacity) moves nothing.
function groupNeedsRefill(g) {
  if (g.state === 'ok') return false
  if (g.state === 'fill' && g.deficit <= 0) return false
  return true
}

// `linkedMachineIds`: machines with vendingMachine.linked_selections — they vend from a
// sibling slot on their own, so an empty slot there is no hint.
function computeMachineStock(trays, productMap, warehouseMap, hasWarehouses, linkedMachineIds = new Set()) {
  const refillable = (pid) => pid != null && (!hasWarehouses || warehouseMap.has(pid))
  const acc = new Map()
  const entryFor = (mid) => {
    let e = acc.get(mid)
    if (!e) { e = { total: 0, refillableEmpty: 0, refillableLow: 0, noStockCount: 0, emptySlotsWithStock: 0, totalStock: 0, totalCapacity: 0, deficits: [], noStockDeficits: [], fillPending: [] }; acc.set(mid, e) }
    return e
  }
  const itemOf = (g, in_stock) => {
    const p = productMap.get(g.product_id) || {}
    return { product_id: g.product_id, product_name: p.name || `Slot ${g.trays[0].item_number}`, image_path: p.image_path || null, sellprice: p.sellprice == null ? null : p.sellprice, discontinued: p.discontinued || false, deficit: g.deficit, in_stock, severity: g.state, slots: g.trays.length }
  }
  const placed = trays.filter(t => t.machine_id)
  for (const t of placed) {
    const e = entryFor(t.machine_id)
    e.total++; e.totalStock += t.current_stock; e.totalCapacity += t.capacity
  }
  // One entry per product: counts below are products, total_trays stays slots.
  for (const g of groupTraysByProduct(placed)) {
    const e = entryFor(g.machine_id)
    if (!groupNeedsRefill(g)) {
      if (!linkedMachineIds.has(g.machine_id)) e.emptySlotsWithStock += g.emptySlots
      continue
    }
    const can = refillable(g.product_id)
    if (g.state === 'fill') { e.fillPending.push(itemOf(g, can)); continue }
    if (can) { if (g.state === 'critical') e.refillableEmpty++; else e.refillableLow++; e.deficits.push(itemOf(g, true)) }
    else { e.noStockCount++; e.noStockDeficits.push(itemOf(g, false)) }
  }
  // Fill-tier products are only listed on a machine that needs a trip anyway
  // (module behaviour: the mirror doesn't flag a machine just to top it off).
  for (const e of acc.values()) {
    if (e.refillableEmpty + e.refillableLow === 0) continue
    for (const item of e.fillPending) (item.in_stock ? e.deficits : e.noStockDeficits).push(item)
  }
  // Finalize. Order: by severity (critical=red → low=amber → fill=blue), then by deficit
  // (needed quantity) descending within each severity.
  const SEV_RANK = { critical: 0, low: 1, fill: 2 }
  const bySeverityThenDeficit = (a, b) =>
    (SEV_RANK[a.severity] - SEV_RANK[b.severity]) || (b.deficit - a.deficit)
  const out = new Map()
  for (const [mid, e] of acc) {
    out.set(mid, {
      total_trays: e.total,
      low_trays: e.refillableEmpty + e.refillableLow,
      empty_trays: e.refillableEmpty,
      no_stock_trays: e.noStockCount,
      empty_slots_with_stock: e.emptySlotsWithStock,
      stock_health: e.refillableEmpty > 0 ? 'critical' : (e.refillableLow > 0 ? 'low' : 'ok'),
      stock_percent: e.totalCapacity > 0 ? Math.round((e.totalStock / e.totalCapacity) * 100) : 0,
      tray_summary: e.deficits.sort(bySeverityThenDeficit),
      no_stock_summary: e.noStockDeficits.sort(bySeverityThenDeficit),
    })
  }
  return out
}

function buildFeed(salesDesc, productMap, trayLookup, machineNameMap, max) {
  const out = []
  for (const s of salesDesc) {
    const p = resolveProduct(s, productMap, trayLookup)
    out.push({
      id: s.id,
      productName: p ? p.name : null,
      imagePath: p ? ((productMap.get(p.id) || {}).image_path || null) : null,
      price: s.item_price || 0,
      machineName: s.machine_id != null ? (machineNameMap.get(s.machine_id) || null) : null,
      createdAt: s.created_at,
    })
    if (out.length >= max) break
  }
  return out
}

// Precondition: caller must supply all six raw arrays: machines, devices, sales, trays, batches, products.
// Note: this view model intentionally omits criticalProductIds / noStockEmptyCount that the frontend's
// useMachines composable exposes — the mirror module doesn't render those fields.
function buildViewModel(raw, config, now) {
  const tz = resolveTimezone(config)
  const filter = Array.isArray(config.machineIds) && config.machineIds.length
    ? new Set(config.machineIds) : null
  // An empty or absent machineIds means "no filter — all machines".
  const machines = filter ? raw.machines.filter(m => filter.has(m.id)) : raw.machines
  const allowed = new Set(machines.map(m => m.id))
  const sales = filter ? raw.sales.filter(s => allowed.has(s.machine_id)) : raw.sales
  const trays = filter ? raw.trays.filter(t => allowed.has(t.machine_id)) : raw.trays

  const productMap = new Map(raw.products.map(p => [p.id, p]))
  const deviceMap = new Map(raw.devices.map(d => [d.id, d]))
  const machineNameMap = new Map(machines.map(m => [m.id, m.name]))
  const trayLookup = new Map()
  for (const t of trays) if (t.product_id != null) trayLookup.set(`${t.machine_id}:${t.item_number}`, { product_id: t.product_id, name: (productMap.get(t.product_id) || {}).name || null })
  const warehouseMap = new Map()
  for (const b of raw.batches) if (b.product_id) warehouseMap.set(b.product_id, (warehouseMap.get(b.product_id) || 0) + b.quantity)
  const hasWarehouses = raw.batches.length > 0

  const kpis = computeKpis(sales, now, tz)
  kpis.topProductToday = computeTopProductToday(sales, now, tz, productMap, trayLookup)

  const linked = new Set(machines.filter(m => m.linked_selections).map(m => m.id))
  const stock = computeMachineStock(trays, productMap, warehouseMap, hasWarehouses, linked)
  const todayK = dateKey(now.getTime(), tz)
  const todayRev = new Map()
  for (const s of sales) {
    if (s.machine_id == null) continue
    if (dateKey(new Date(s.created_at).getTime(), tz) === todayK)
      todayRev.set(s.machine_id, (todayRev.get(s.machine_id) || 0) + (s.item_price || 0))
  }

  const empty = { total_trays: 0, low_trays: 0, empty_trays: 0, no_stock_trays: 0, empty_slots_with_stock: 0, stock_health: 'ok', stock_percent: 0, tray_summary: [], no_stock_summary: [] }
  const order = { critical: 0, low: 1, ok: 2 }
  const machinesOut = machines.map(m => {
    const st = stock.get(m.id) || empty
    const dev = m.embedded ? deviceMap.get(m.embedded) : null
    const status = dev ? dev.status : null
    return Object.assign({ id: m.id, name: m.name, online: !!status && status !== 'offline', today_revenue: todayRev.get(m.id) || 0 }, st)
  }).sort((a, b) => {
    const d = (order[a.stock_health] != null ? order[a.stock_health] : 2) - (order[b.stock_health] != null ? order[b.stock_health] : 2)
    return d !== 0 ? d : (b.low_trays - a.low_trays)
  })

  const salesDesc = [...sales].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const feed = buildFeed(salesDesc, productMap, trayLookup, machineNameMap, config.maxFeedItems || 8)

  return {
    generatedAt: new Date(now.getTime()).toISOString(),
    kpis, feed, machines: machinesOut,
    totals: {
      machinesOnline: machinesOut.filter(m => m.online).length,
      machinesTotal: machinesOut.length,
      refillMachines: machinesOut.filter(m => m.stock_health !== 'ok').length,
    },
  }
}

// IANA timezone used for calendar-day/month bucketing ("today"/"yesterday"/"month").
// Defaults to the HOST (node_helper) system timezone — which on many Raspberry Pis is
// UTC. If that doesn't match the operator's local time, day/month boundaries shift and
// early-local-day sales get bucketed into the previous day (they vanish from "today").
// Set config.timezone (e.g. "Europe/Berlin") to align the mirror with the dashboard.
function resolveTimezone(config) {
  return (config && config.timezone) || Intl.DateTimeFormat().resolvedOptions().timeZone
}

module.exports = { DAY_MS, dateKey, monthKey, prevDateKey, prevMonthKey, pctChange, resolveTimezone, computeKpis, resolveProduct, computeTopProductToday, classifyTrayStock, groupTraysByProduct, groupNeedsRefill, computeMachineStock, buildFeed, buildViewModel }
