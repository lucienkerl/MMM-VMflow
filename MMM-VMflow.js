/* global Module, Log, config */
Module.register('MMM-VMflow', {
  defaults: {
    baseUrl: '', apiKey: '', layout: 'combo', machineIds: [],
    updateInterval: 60000, showImages: false, maxFeedItems: 8, maxRefillRows: null, maxRowsPerMachine: null, timezone: null,
    header: null,
  },

  getStyles() { return [this.file('MMM-VMflow.css')] },
  getTranslations() { return { en: 'translations/en.json', de: 'translations/de.json' } },
  getScripts() {
    return [
      this.file('renderers/_shared.js'),
      this.file('renderers/combo.js'), this.file('renderers/kpi.js'),
      this.file('renderers/feed.js'), this.file('renderers/refillStatus.js'),
      this.file('renderers/refillProducts.js'), this.file('renderers/fleet.js'),
      this.file('renderers/ticker.js'),
    ]
  },

  start() {
    this.viewModel = null
    this.errorReason = null
    this.lastGoodAt = null
    if (this.config.baseUrl && this.config.apiKey) {
      this.sendSocketNotification('VMFLOW_CONFIG', { identifier: this.identifier, config: this.config })
    }
  },

  socketNotificationReceived(notification, payload) {
    if (!payload || payload.identifier !== this.identifier) return
    if (notification === 'VMFLOW_DATA') {
      this.viewModel = payload.payload
      this.errorReason = null
      this.lastGoodAt = Date.now()
      this.updateDom(300)
    } else if (notification === 'VMFLOW_ERROR') {
      this.errorReason = payload.reason
      this.updateDom(300)
    }
  },

  ctx() {
    const self = this
    return {
      t: (k, v) => self.translate(k, v || {}),
      // Currency/number locale follows the mirror's GLOBAL setting (config.locale, then
      // config.language) — same source as the translated labels, so they never desync.
      locale: (typeof config !== 'undefined' && (config.locale || config.language)) || 'en',
      config: this.config,
      nowMs: Date.now(),
      imageUrl: (path) => `${String(self.config.baseUrl).replace(/\/+$/, '')}/storage/v1/object/public/product-images/${path}`,
    }
  },

  getHeader() { return this.config.header || undefined },

  getDom() {
    const S = window.VMflowShared
    const wrap = document.createElement('div')
    wrap.className = 'MMM-VMflow' + (this.config.layout === 'ticker' ? ' vmf-ticker' : '')

    if (!this.config.baseUrl || !this.config.apiKey) { wrap.appendChild(S.el('div', 'vmf-msg', this.translate('SETUP_NEEDED'))); return wrap }
    if (!this.viewModel) {
      let msg = this.translate('NO_DATA')
      if (this.errorReason) {
        const key = 'ERR_' + String(this.errorReason).toUpperCase()
        const translated = this.translate(key)
        msg = translated === key ? this.translate('NO_DATA') : translated // translate() echoes the key when missing
      }
      wrap.appendChild(S.el('div', 'vmf-msg', msg)); return wrap
    }

    const renderer = (window.VMflowRenderers || {})[this.config.layout] || window.VMflowRenderers.combo
    wrap.appendChild(renderer(this.viewModel, this.ctx()))

    // Stale/error footer when we are showing cached data after a failure.
    if (this.errorReason && this.lastGoodAt) {
      const ago = Math.round((Date.now() - this.lastGoodAt) / 60000)
      wrap.appendChild(S.el('div', 'vmf-asof', this.translate('AS_OF', { t: ago + 'm' })))
    }
    return wrap
  },
})
