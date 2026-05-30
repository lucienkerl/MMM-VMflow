'use strict'
const PAGE = 1000
// Per-request timeout. WITHOUT it, a stalled socket (e.g. a stale keep-alive
// connection to an https backend behind a proxy) makes `fetch` hang forever, which
// wedges node_helper's poll loop (the `fetching` flag never resets) — the module
// loads once and then never refreshes. The AbortController makes a hang a normal,
// self-healing error: the request aborts and the next poll retries on a fresh socket.
const REQUEST_TIMEOUT_MS = 15000

async function apiGet(baseUrl, apiKey, resource, query, timeoutMs = REQUEST_TIMEOUT_MS) {
  const url = new URL(`${String(baseUrl).replace(/\/+$/, '')}/api/v1/${resource}`)
  for (const [k, v] of Object.entries(query || {})) if (v != null) url.searchParams.set(k, String(v))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: { 'X-API-Key': apiKey }, signal: controller.signal })
    if (res.status === 401) { const e = new Error('unauthorized'); e.code = 'unauthorized'; throw e }
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}))
      const e = new Error('rate_limited'); e.code = 'rate_limited'; e.retryAfter = body.retry_after || 60; throw e
    }
    if (!res.ok) { const e = new Error(`http_${res.status}`); e.code = 'network'; throw e }
    return await res.json()
  } catch (err) {
    if (err && err.code) throw err // already mapped (unauthorized / rate_limited / network)
    const code = err && err.name === 'AbortError' ? 'timeout' : 'network'
    const e = new Error(code); e.code = code; e.cause = err; throw e
  } finally {
    clearTimeout(timer)
  }
}

// NOTE: PAGE=1000 assumes the PostgREST backend's db-max-rows is >= 1000 (the
// self-hosted default). If a deployment sets db-max-rows lower, each page will
// be capped at that lower limit, the `page.length < PAGE` condition will never
// be false for a full page, and large result sets will be silently truncated.
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
