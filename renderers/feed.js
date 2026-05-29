/* global window */
(function () {
  window.VMflowRenderers = window.VMflowRenderers || {}
  window.VMflowRenderers.feed = function (vm, ctx) {
    const S = window.VMflowShared
    const root = S.el('div', 'vmf-feed')
    root.appendChild(S.label(ctx.t('RECENT_SALES')))
    vm.feed.forEach(s => {
      const row = S.el('div', 'vmf-prow')
      const left = S.el('div', 'vmf-pleft')
      if (ctx.config.showImages && s.imagePath) { const img = S.el('img', 'vmf-thumb'); img.src = ctx.imageUrl(s.imagePath); left.appendChild(img) }
      const txt = S.el('span', null, s.productName || ('#' + (s.id || '')))
      left.appendChild(txt)
      if (s.machineName) left.appendChild(S.el('span', 'vmf-dim', s.machineName))
      const right = S.el('span', 'vmf-dim', `${S.fmtCurrency(s.price, ctx.locale)} · ${S.timeAgo(s.createdAt, ctx)}`)
      row.appendChild(left); row.appendChild(right)
      root.appendChild(row)
    })
    if (vm.feed.length === 0) root.appendChild(S.el('div', 'vmf-dim', ctx.t('NO_DATA')))
    return root
  }
})()
