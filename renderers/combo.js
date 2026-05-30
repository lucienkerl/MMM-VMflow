/* global window */
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

    // Lower section: the per-machine product view (same rendering as the refillProducts layout).
    const need = S.refillNeedingMachines(vm.machines)
    root.appendChild(S.label(`${ctx.t('REFILL_NEEDED')} · ${need.length} ${ctx.t('OF')} ${vm.totals.machinesTotal}`))
    if (need.length === 0) {
      root.appendChild(S.el('div', 'vmf-dim', ctx.t('ALL_OK')))
    } else {
      root.appendChild(S.refillProductGroups(need, ctx))
    }
    return root
  }
})()
