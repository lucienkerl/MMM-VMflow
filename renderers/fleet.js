/* global window, document */
(function () {
  window.VMflowRenderers = window.VMflowRenderers || {}
  window.VMflowRenderers.fleet = function (vm, ctx) {
    const S = window.VMflowShared
    const root = S.el('div', 'vmf-fleet')
    root.appendChild(S.label(ctx.t('FLEET')))
    const grid = S.el('div', 'vmf-grid'); grid.style.marginTop = '8px'
    vm.machines.forEach(m => {
      const cell = S.el('div')
      const head = S.el('div', 'vmf-row')
      const left = S.el('span'); left.appendChild(S.statusDot(m.online ? m.stock_health : 'offline')); left.appendChild(document.createTextNode(m.name))
      head.appendChild(left)
      head.appendChild(S.el('span', 'vmf-dim', m.online ? (m.stock_percent + '%') : '—'))
      cell.appendChild(head)
      cell.appendChild(S.el('div', 'vmf-dim', m.online ? `${S.fmtCurrency(m.today_revenue, ctx.locale)} ${ctx.t('TODAY').toLowerCase()}` : ctx.t('OFFLINE')))
      grid.appendChild(cell)
    })
    root.appendChild(grid)
    return root
  }
})()
