/* global window */
(function () {
  window.VMflowRenderers = window.VMflowRenderers || {}
  window.VMflowRenderers.refillProducts = function (vm, ctx) {
    const S = window.VMflowShared
    const root = S.el('div', 'vmf-refill-products')
    root.appendChild(S.label(ctx.t('REFILL_PRODUCTS')))
    const need = S.refillNeedingMachines(vm.machines)
    if (need.length === 0) { root.appendChild(S.el('div', 'vmf-dim', ctx.t('ALL_OK'))); return root }
    root.appendChild(S.refillProductGroups(need, ctx))
    return root
  }
})()
