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

  root.VMflowShared = { el, fmtCurrency, fmtPct, timeAgo, label, kpiTrend, fillBar, statusDot, productRow, periodBlock }
})(window)
