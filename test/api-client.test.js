'use strict'
const { test } = require('node:test')
const assert = require('node:assert')
const { apiGetAll, apiGet } = require('../lib/api-client')

function stubFetch(pages) {
  let call = 0
  global.fetch = async () => {
    const body = pages[call++] ?? []
    return { ok: true, status: 200, json: async () => body }
  }
}

test('apiGetAll paginates until a short page', async () => {
  const full = Array.from({ length: 1000 }, (_, i) => ({ i }))
  const half = Array.from({ length: 500 }, (_, i) => ({ i }))
  stubFetch([full, half])
  const rows = await apiGetAll('http://x:8000', 'k', 'sales')
  assert.equal(rows.length, 1500)
})

test('apiGet maps 401 and 429', async () => {
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) })
  await assert.rejects(() => apiGet('http://x:8000', 'k', 'sales'), /unauthorized/)
  global.fetch = async () => ({ ok: false, status: 429, json: async () => ({ retry_after: 7 }) })
  await assert.rejects(() => apiGet('http://x:8000', 'k', 'sales'), (e) => e.code === 'rate_limited' && e.retryAfter === 7)
})
