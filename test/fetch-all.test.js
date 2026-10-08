'use strict'
const { test } = require('node:test')
const assert = require('node:assert')
const Module = require('module')

// Inject a stub for ./api-client used by fetch-all
const stub = {
  calls: [],
  failLinked: false,
  apiGetAll: async (_b, _k, resource, query) => {
    stub.calls.push(resource)
    if (stub.failLinked && resource === 'machines' && /linked_selections/.test(query.select)) {
      const e = new Error('http_400'); e.code = 'network'; throw e
    }
    return [{ resource, select: query && query.select }]
  },
}
const orig = Module._load
Module._load = function (request, parent, isMain) {
  if (request === './api-client') return stub
  return orig(request, parent, isMain)
}
const { fetchAll } = require('../lib/fetch-all')
Module._load = orig

test('fetchAll requests all six resources and shapes raw', async () => {
  const raw = await fetchAll('http://x:8000', 'k')
  assert.deepEqual(new Set(stub.calls), new Set(['machines', 'devices', 'sales', 'trays', 'stock-batches', 'products']))
  assert.ok(raw.machines && raw.devices && raw.sales && raw.trays && raw.batches && raw.products)
})

test('fetchAll asks for linked_selections and falls back when the backend lacks the column', async () => {
  stub.failLinked = false
  let raw = await fetchAll('http://x:8000', 'k')
  assert.match(raw.machines[0].select, /linked_selections/)
  stub.failLinked = true
  raw = await fetchAll('http://x:8000', 'k')
  assert.equal(raw.machines[0].select, 'id,name,embedded')
  stub.failLinked = false
})
