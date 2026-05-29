/* global window */
(function () {
  window.VMflowRenderers = window.VMflowRenderers || {}
  window.VMflowRenderers.ticker = function (vm, ctx) {
    const S = window.VMflowShared, k = vm.kpis
    const parts = [
      `${S.fmtCurrency(k.today.revenue, ctx.locale)} ${ctx.t('TODAY').toLowerCase()}`,
      ctx.t('SALES_N', { n: k.today.count }),
    ]
    const root = S.el('div', 'vmf-ticker-line')
    root.appendChild(S.el('span', null, parts.join(' · ')))
    if (vm.totals.refillMachines > 0) {
      root.appendChild(document.createTextNode('  '))
      root.appendChild(S.el('span', 'vmf-name-low', `⚠ ${vm.totals.refillMachines} ${ctx.t('REFILL_NEEDED')}`))
    }
    return root
  }
})()
