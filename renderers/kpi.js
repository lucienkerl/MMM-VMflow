/* global window */
(function () {
  window.VMflowRenderers = window.VMflowRenderers || {}
  window.VMflowRenderers.kpi = function (vm, ctx) {
    const S = window.VMflowShared, k = vm.kpis
    const root = S.el('div', 'vmf-kpi')
    root.appendChild(S.label(ctx.t('REVENUE_TODAY')))
    const head = S.el('div', 'vmf-row')
    const big = S.el('span', 'vmf-big'); big.style.fontSize = '40px'; big.textContent = S.fmtCurrency(k.today.revenue, ctx.locale)
    head.appendChild(big); head.appendChild(S.kpiTrend(k.trends.today, ctx.t('TODAY')))
    root.appendChild(head)
    root.appendChild(S.el('div', 'vmf-dim', `${ctx.t('SALES_N', { n: k.today.count })} · ${ctx.t('YESTERDAY')} ${S.fmtCurrency(k.yesterday.revenue, ctx.locale)}`))
    const wk = S.el('div', 'vmf-row'); wk.style.marginTop = '16px'
    wk.appendChild(S.periodBlock(ctx, ctx.t('THIS_WEEK'), k.week.revenue, k.trends.week, k.lastWeek.revenue))
    wk.appendChild(S.periodBlock(ctx, ctx.t('THIS_MONTH'), k.month.revenue, k.trends.month, k.lastMonth.revenue))
    root.appendChild(wk)
    if (k.topProductToday) {
      root.appendChild(S.el('hr', 'vmf-divider'))
      const r = S.el('div', 'vmf-row')
      r.appendChild(S.el('span', 'vmf-dim', '🏆 ' + ctx.t('TOP_TODAY')))
      r.appendChild(S.el('span', null, `${k.topProductToday.name} · ${k.topProductToday.units}×`))
      root.appendChild(r)
    }
    return root
  }
})()
