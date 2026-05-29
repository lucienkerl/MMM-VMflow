/* global window, document */
(function () {
  window.VMflowRenderers = window.VMflowRenderers || {}
  window.VMflowRenderers.combo = function (vm, ctx) {
    const S = window.VMflowShared, k = vm.kpis
    const root = S.el('div', 'vmf-combo')
    root.appendChild(S.label(ctx.t('REVENUE_TODAY')))

    const head = S.el('div', 'vmf-row')
    const big = S.el('span', 'vmf-big'); big.style.fontSize = '40px'; big.textContent = S.fmtCurrency(k.today.revenue, ctx.locale)
    head.appendChild(big)
    head.appendChild(S.kpiTrend(k.trends.today, ctx.t('TODAY')))
    root.appendChild(head)
    root.appendChild(S.el('div', 'vmf-dim', `${ctx.t('SALES_N', { n: k.today.count })} · ${ctx.t('YESTERDAY')} ${S.fmtCurrency(k.yesterday.revenue, ctx.locale)}`))

    const wk = S.el('div', 'vmf-row'); wk.style.marginTop = '14px'
    wk.appendChild(S.periodBlock(ctx, ctx.t('THIS_WEEK'), k.week.revenue, k.trends.week, k.lastWeek.revenue))
    wk.appendChild(S.periodBlock(ctx, ctx.t('THIS_MONTH'), k.month.revenue, k.trends.month, k.lastMonth.revenue))
    root.appendChild(wk)

    root.appendChild(S.el('hr', 'vmf-divider'))

    const need = vm.machines.filter(m => m.stock_health !== 'ok')
    root.appendChild(S.label(`${ctx.t('REFILL_NEEDED')} · ${need.length} ${ctx.t('OF')} ${vm.totals.machinesTotal}`))
    if (need.length === 0) {
      root.appendChild(S.el('div', 'vmf-dim', ctx.t('ALL_OK')))
    } else {
      need.slice(0, 4).forEach(m => {
        const row = S.el('div', 'vmf-row'); row.style.margin = '8px 0'
        const left = S.el('span'); left.appendChild(S.statusDot(m.stock_health)); left.appendChild(document.createTextNode(m.name))
        const right = S.el('span', 'vmf-dim')
        const parts = []
        if (m.empty_trays > 0) parts.push(ctx.t('EMPTY_N', { n: m.empty_trays }))
        if (m.low_trays - m.empty_trays > 0) parts.push(ctx.t('LOW_N', { n: m.low_trays - m.empty_trays }))
        right.textContent = parts.join(' · ') + `  ${m.stock_percent}%`
        row.appendChild(left); row.appendChild(right)
        root.appendChild(row)
      })
      const okCount = vm.totals.machinesTotal - need.length
      if (okCount > 0) root.appendChild(S.el('div', 'vmf-dim', `${ctx.t('REST_OK')} (${okCount})`))
    }
    return root
  }
})()
