'use strict'
const { apiGetAll } = require('./api-client')

// sales fetched since the start of the previous calendar month (covers today/yesterday/
// week/lastWeek/month/lastMonth in all cases). Computed in the helper's local tz — the
// ~30-60d headroom over the deepest window (14d) makes any tz mismatch with
// config.timezone harmless (intentional over-fetch).
function salesSinceIso(now) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return d.toISOString()
}

async function fetchAll(baseUrl, apiKey, now = new Date()) {
  const since = salesSinceIso(now)
  const [machines, devices, sales, trays, batches, products] = await Promise.all([
    apiGetAll(baseUrl, apiKey, 'machines', { select: 'id,name,embedded' }),
    apiGetAll(baseUrl, apiKey, 'devices', { select: 'id,status' }),
    apiGetAll(baseUrl, apiKey, 'sales', { select: 'id,created_at,item_price,machine_id,item_number,product_id', created_at: `gte.${since}` }),
    apiGetAll(baseUrl, apiKey, 'trays', { select: 'machine_id,item_number,product_id,capacity,current_stock,min_stock,fill_when_below' }),
    apiGetAll(baseUrl, apiKey, 'stock-batches', { select: 'product_id,quantity', quantity: 'gt.0' }),
    apiGetAll(baseUrl, apiKey, 'products', { select: 'id,name,image_path,sellprice,discontinued' }),
  ])
  return { machines, devices, sales, trays, batches, products }
}

module.exports = { fetchAll, salesSinceIso }
