'use strict'
const NodeHelper = require('node_helper')
const Log = require('logger')
const { fetchAll } = require('./lib/fetch-all')
const { buildViewModel } = require('./lib/compute')

const MIN_INTERVAL = 15000

module.exports = NodeHelper.create({
  start() {
    this.backends = new Map() // key -> { baseUrl, apiKey, interval, timer, instances: Map<id, config>, lastRaw, fetching }
  },

  socketNotificationReceived(notification, payload) {
    if (notification !== 'VMFLOW_CONFIG') return
    const { identifier, config } = payload
    if (!config || !config.baseUrl || !config.apiKey) {
      this.sendSocketNotification('VMFLOW_ERROR', { identifier, reason: 'config' })
      return
    }
    const key = `${config.baseUrl}|${config.apiKey}`
    let b = this.backends.get(key)
    if (!b) {
      b = { baseUrl: config.baseUrl, apiKey: config.apiKey, interval: MIN_INTERVAL, timer: null, instances: new Map(), lastRaw: null, fetching: false }
      this.backends.set(key, b)
    }
    b.instances.set(identifier, config)
    b.interval = Math.max(MIN_INTERVAL, Math.min(...[...b.instances.values()].map(c => c.updateInterval || 60000)))

    // Serve cached data immediately to this new instance.
    if (b.lastRaw) this.emitInstance(b, identifier, config)

    // (Re)arm the timer and fetch now.
    if (b.timer) clearInterval(b.timer)
    b.timer = setInterval(() => this.poll(key), b.interval)
    this.poll(key)
  },

  async poll(key) {
    const b = this.backends.get(key)
    if (!b) return
    // If a previous fetch is still in flight, skip this tick. With the request timeout
    // in api-client this self-clears within ~15s; if you see this line repeating forever,
    // a fetch is wedged (which the timeout is meant to prevent).
    if (b.fetching) { Log.warn(`[MMM-VMflow] poll skipped — previous fetch still running (${b.baseUrl})`); return }
    b.fetching = true
    const t0 = Date.now()
    Log.info(`[MMM-VMflow] poll → ${b.baseUrl}`)
    try {
      const raw = await fetchAll(b.baseUrl, b.apiKey, new Date())
      b.lastRaw = raw
      Log.info(`[MMM-VMflow] poll ok: sales=${raw.sales.length} machines=${raw.machines.length} trays=${raw.trays.length} (${Date.now() - t0}ms)`)
      for (const [identifier, config] of b.instances) this.emitInstance(b, identifier, config)
    } catch (err) {
      const reason = err && err.code ? err.code : 'unknown'
      Log.warn(`[MMM-VMflow] fetch failed: ${reason} (${Date.now() - t0}ms)`)
      for (const [identifier] of b.instances) this.sendSocketNotification('VMFLOW_ERROR', { identifier, reason })
      if (reason === 'rate_limited' && err.retryAfter) {
        // back off: re-arm timer at retryAfter (bounded to MIN_INTERVAL floor)
        clearInterval(b.timer)
        const backoff = Math.max(MIN_INTERVAL, err.retryAfter * 1000)
        b.timer = setTimeout(() => { b.timer = setInterval(() => this.poll(key), b.interval); this.poll(key) }, backoff)
      }
    } finally {
      b.fetching = false
    }
  },

  emitInstance(b, identifier, config) {
    try {
      const vm = buildViewModel(b.lastRaw, config, new Date())
      this.sendSocketNotification('VMFLOW_DATA', { identifier, payload: vm })
    } catch (err) {
      Log.error(`[MMM-VMflow] buildViewModel failed: ${err && err.message}`)
      this.sendSocketNotification('VMFLOW_ERROR', { identifier, reason: 'unknown' })
    }
  },
})
