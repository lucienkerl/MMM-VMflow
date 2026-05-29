'use strict'
const { test } = require('node:test')
const assert = require('node:assert')
const Module = require('module')

// Inject a stub for ./api-client used by fetch-all
const stub = {
  calls: [],
  apiGetAll: async (_b, _k, resource) => { stub.calls.push(resource); return [{ resource }] },
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
