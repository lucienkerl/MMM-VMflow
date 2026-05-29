/* global window, document */
(function () {
  window.VMflowRenderers = window.VMflowRenderers || {}
  window.VMflowRenderers.refillStatus = function (vm, ctx) {
    const S = window.VMflowShared
    const root = S.el('div', 'vmf-refill')
    root.appendChild(S.label(ctx.t('REFILL_NEEDED')))
    const need = vm.machines.filter(m => m.stock_health !== 'ok')
    if (need.length === 0) { root.appendChild(S.el('div', 'vmf-dim', ctx.t('ALL_OK'))); return root }
    need.forEach(m => {
      const block = S.el('div'); block.style.margin = '11px 0'
      const head = S.el('div', 'vmf-row')
      const left = S.el('span'); left.appendChild(S.statusDot(m.stock_health)); left.appendChild(document.createTextNode(m.name))
      const parts = []
      if (m.empty_trays > 0) parts.push(ctx.t('EMPTY_N', { n: m.empty_trays }))
      if (m.low_trays - m.empty_trays > 0) parts.push(ctx.t('LOW_N', { n: m.low_trays - m.empty_trays }))
      head.appendChild(left); head.appendChild(S.el('span', 'vmf-dim', parts.join(' · ')))
      block.appendChild(head)
      const barRow = S.el('div', 'vmf-row'); barRow.style.marginTop = '6px'
      barRow.appendChild(S.fillBar(m.stock_percent))
      barRow.appendChild(S.el('span', 'vmf-dim', m.stock_percent + '%'))
      block.appendChild(barRow)
      root.appendChild(block)
    })
    return root
  }
})()
