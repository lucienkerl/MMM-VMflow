'use strict'
const PAGE = 1000

async function apiGet(baseUrl, apiKey, resource, query) {
  const url = new URL(`${String(baseUrl).replace(/\/+$/, '')}/api/v1/${resource}`)
  for (const [k, v] of Object.entries(query || {})) if (v != null) url.searchParams.set(k, String(v))
  let res
  try { res = await fetch(url, { headers: { 'X-API-Key': apiKey } }) }
  catch (err) { const e = new Error('network'); e.code = 'network'; e.cause = err; throw e }
  if (res.status === 401) { const e = new Error('unauthorized'); e.code = 'unauthorized'; throw e }
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}))
    const e = new Error('rate_limited'); e.code = 'rate_limited'; e.retryAfter = body.retry_after || 60; throw e
  }
  if (!res.ok) { const e = new Error(`http_${res.status}`); e.code = 'network'; throw e }
  return res.json()
}

async function apiGetAll(baseUrl, apiKey, resource, query) {
  const all = []
  let offset = 0
  for (;;) {
    const page = await apiGet(baseUrl, apiKey, resource, Object.assign({}, query, { limit: PAGE, offset }))
    all.push(...page)
    if (page.length < PAGE) break
    offset += PAGE
  }
  return all
}

module.exports = { apiGet, apiGetAll, PAGE }
