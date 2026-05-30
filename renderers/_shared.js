/* global window, document, Intl */
(function (root) {
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e }
  function fmtCurrency(v, locale) { try { return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(v || 0) } catch (_) { return (v || 0).toFixed(2) + ' €' } }
  function fmtPct(n) { return (n >= 0 ? '+' : '') + n + '%' }

  function timeAgo(iso, ctx) {
    const diff = Math.max(0, (ctx.nowMs - new Date(iso).getTime()))
    const m = Math.floor(diff / 60000)
    if (m < 1) return ctx.t('AGO_NOW')
    if (m < 60) return ctx.t('AGO_MIN', { n: m })
    const h = Math.floor(m / 60)
    if (h < 24) return ctx.t('AGO_HOUR', { n: h })
    return ctx.t('AGO_DAY', { n: Math.floor(h / 24) })
  }

  function label(text) { return el('div', 'vmf-label', text) }

  // KPI block: big value + trend; trend null -> period label. `pct` is number|null.
  function kpiTrend(pct, fallbackLabel) {
    if (pct == null) return el('span', 'vmf-dim', fallbackLabel)
    const s = el('span', pct >= 0 ? 'vmf-up' : 'vmf-down', (pct >= 0 ? '▲ ' : '▼ ') + fmtPct(pct))
    return s
  }

  function fillBar(pct) {
    const w = el('div', 'vmf-bar'); const s = el('span')
    s.className = pct < 20 ? 'vmf-crit-bg' : pct < 50 ? 'vmf-low-bg' : 'vmf-ok-bg'
    s.style.width = Math.max(0, Math.min(100, pct)) + '%'
    w.appendChild(s); return w
  }

  function statusDot(health) {
    var bg = health === 'critical' ? 'vmf-crit-bg' : health === 'low' ? 'vmf-low-bg' : health === 'offline' ? 'vmf-off-bg' : 'vmf-ok-bg'
    return el('span', 'vmf-dot ' + bg)
  }

  // Period KPI block (week/month): label + value + trend + "vs <prev>". Used by combo + kpi.
  function periodBlock(ctx, title, value, trend, prev) {
    const box = el('div')
    box.appendChild(label(title))
    const v = el('span', 'vmf-big'); v.style.fontSize = '22px'; v.textContent = fmtCurrency(value, ctx.locale)
    box.appendChild(v); box.appendChild(document.createTextNode(' ')); box.appendChild(kpiTrend(trend, ''))
    box.appendChild(el('div', 'vmf-dim', `${ctx.t('VS')} ${fmtCurrency(prev, ctx.locale)}`))
    return box
  }

  // Faithful machines-page product row. `item` from tray_summary/no_stock_summary.
  function productRow(item, ctx) {
    const row = el('div', 'vmf-prow' + (item.in_stock ? '' : (item.severity === 'critical' ? '' : ' vmf-dimmed')))
    const left = el('div', 'vmf-pleft')
    if (ctx.config.showImages && item.image_path) {
      const img = el('img', 'vmf-thumb'); img.src = ctx.imageUrl(item.image_path); img.alt = ''; left.appendChild(img)
    }
    // Match machines page: in-stock → severity color; swap (no-stock+critical) → orange;
    // dimmed no-stock (low/fill) → neutral (no color class), like the frontend's plain <span>.
    const nameCls = item.in_stock ? ('vmf-name-' + item.severity) : (item.severity === 'critical' ? 'vmf-name-swap' : '')
    const name = el('span', nameCls)
    name.appendChild(document.createTextNode((!item.in_stock && item.severity === 'critical' ? '⇄ ' : '') + item.product_name + ' '))
    name.appendChild(el('span', 'vmf-def', `(-${item.deficit})`))
    left.appendChild(name)
    if (item.sellprice != null) left.appendChild(el('span', 'vmf-price', fmtCurrency(item.sellprice, ctx.locale)))
    if (item.discontinued) left.appendChild(el('span', 'vmf-disc', '×'))
    row.appendChild(left)
    const tag = item.in_stock ? el('span', 'vmf-tag-in', ctx.t('IN_STOCK'))
      : item.severity === 'critical' ? el('span', 'vmf-tag-swap', ctx.t('SWAP'))
        : el('span', 'vmf-tag-no', ctx.t('NO_STOCK'))
    row.appendChild(tag)
    return row
  }

  // Machines with something to show in the per-product refill view: not 'ok', OR with
  // non-refillable no-stock items. Shared by the refillProducts and combo layouts.
  function refillNeedingMachines(machines) {
    return (machines || []).filter(m => m.stock_health !== 'ok' || (m.no_stock_summary && m.no_stock_summary.length))
  }

  // Per-machine product groups (header + tray_summary rows + swap + dimmed no-stock rows),
  // faithful to the /machines page. Pass an already-filtered list (refillNeedingMachines).
  // Returns a DocumentFragment so callers can append it under any heading.
  // Optional caps (both default null = unlimited; from ctx.config):
  //  - maxRowsPerMachine: max product rows PER machine → "+K more" under that machine (breadth)
  //  - maxRefillRows:     max product rows TOTAL across machines → "… N more products" at the end (height)
  // They compose; truncation is never silent. Machine headers/dividers don't count toward caps.
  // Rows are pre-sorted by compute.js: tray_summary by severity (critical=red → low=amber
  // → fill=blue) then deficit desc; then swap, then dimmed no-stock.
  function refillProductGroups(machines, ctx) {
    const frag = document.createDocumentFragment()
    const cfg = ctx.config || {}
    const norm = (v) => (v == null || v <= 0) ? Infinity : v
    const cap = norm(cfg.maxRefillRows)
    const perCap = norm(cfg.maxRowsPerMachine)
    let total = 0
    for (const m of machines) total += m.tray_summary.length + (m.no_stock_summary || []).length
    let shown = 0, announced = 0
    for (const m of machines) {
      if (shown >= cap) break
      const swaps = (m.no_stock_summary || []).filter(i => i.severity === 'critical')
      const dimmed = (m.no_stock_summary || []).filter(i => i.severity !== 'critical')
      const avail = m.tray_summary.length + swaps.length + dimmed.length
      const take = Math.min(perCap, avail, cap - shown)
      if (take <= 0) break
      const head = el('div', 'vmf-row'); head.style.margin = '14px 0 6px'
      const left = el('span'); left.appendChild(statusDot(m.stock_health)); left.appendChild(document.createTextNode(m.name))
      head.appendChild(left); head.appendChild(el('span', 'vmf-dim', m.stock_percent + '%'))
      frag.appendChild(head)
      let taken = 0, trayShown = 0
      for (const item of m.tray_summary) { if (taken >= take) break; frag.appendChild(productRow(item, ctx)); taken++; trayShown++ }
      if (trayShown > 0 && swaps.length > 0 && taken < take) frag.appendChild(el('hr', 'vmf-divider'))
      for (const item of swaps) { if (taken >= take) break; frag.appendChild(productRow(item, ctx)); taken++ }
      for (const item of dimmed) { if (taken >= take) break; frag.appendChild(productRow(item, ctx)); taken++ }
      shown += taken
      // per-machine "+K more" only when the PER-MACHINE cap (not the global cap) hid this machine's rows
      if (take < avail && take === perCap) {
        frag.appendChild(el('div', 'vmf-dim vmf-more-m', ctx.t('MORE_PER_N', { n: avail - take })))
        announced += avail - take
      }
    }
    const remainder = total - shown - announced // rows hidden by the GLOBAL cap (not already announced per machine)
    if (remainder > 0) frag.appendChild(el('div', 'vmf-dim vmf-more', ctx.t('MORE_N', { n: remainder })))
    return frag
  }

  root.VMflowShared = { el, fmtCurrency, fmtPct, timeAgo, label, kpiTrend, fillBar, statusDot, productRow, periodBlock, refillNeedingMachines, refillProductGroups }
})(window)
