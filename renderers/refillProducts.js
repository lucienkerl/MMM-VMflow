/* global window, document */
(function () {
  window.VMflowRenderers = window.VMflowRenderers || {}
  window.VMflowRenderers.refillProducts = function (vm, ctx) {
    const S = window.VMflowShared
    const root = S.el('div', 'vmf-refill-products')
    root.appendChild(S.label(ctx.t('REFILL_PRODUCTS')))
    // Broader than combo/refillStatus' (stock_health !== 'ok'): also include machines whose
    // ONLY deficits are non-refillable no-stock items — this renderer is the one that displays
    // those rows, so it must not drop those machines. Do not "unify" with the narrow filter.
    const need = vm.machines.filter(m => m.stock_health !== 'ok' || (m.no_stock_summary && m.no_stock_summary.length))
    if (need.length === 0) { root.appendChild(S.el('div', 'vmf-dim', ctx.t('ALL_OK'))); return root }
    need.forEach(m => {
      const head = S.el('div', 'vmf-row'); head.style.margin = '14px 0 6px'
      const left = S.el('span'); left.appendChild(S.statusDot(m.stock_health)); left.appendChild(document.createTextNode(m.name))
      head.appendChild(left); head.appendChild(S.el('span', 'vmf-dim', m.stock_percent + '%'))
      root.appendChild(head)
      m.tray_summary.forEach(item => root.appendChild(S.productRow(item, ctx)))
      const swaps = (m.no_stock_summary || []).filter(i => i.severity === 'critical')
      const dimmed = (m.no_stock_summary || []).filter(i => i.severity !== 'critical')
      if (m.tray_summary.length && swaps.length) root.appendChild(S.el('hr', 'vmf-divider'))
      swaps.forEach(item => root.appendChild(S.productRow(item, ctx)))
      dimmed.forEach(item => root.appendChild(S.productRow(item, ctx)))
    })
    return root
  }
})()
