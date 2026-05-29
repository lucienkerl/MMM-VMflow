/* global window */
// Frozen sample view model — exercises every visual state in all 7 renderers.
// Shape must match buildViewModel() output exactly (see lib/compute.js).
// Fixed nowMs for preview: 2026-05-29T14:00:00+02:00 = 1748520000000
;(function () {
  var NOW_MS = Date.parse('2026-05-29T14:00:00+02:00')

  window.VMFLOW_SAMPLE = {
    generatedAt: new Date(NOW_MS).toISOString(),

    // ── KPIs ─────────────────────────────────────────────────────────────────
    kpis: {
      today:     { revenue: 142.50, count: 47 },
      yesterday: { revenue: 127.00, count: 42 },
      week:      { revenue: 890.20, count: 298 },
      lastWeek:  { revenue: 824.00, count: 275 },
      month:     { revenue: 3240.00, count: 1082 },
      lastMonth: { revenue: 3085.00, count: 1031 },
      trends: {
        today: 12,   // ▲12% vs yesterday
        week:   8,   // ▲8%  vs last week
        month:  5,   // ▲5%  vs last month
      },
      topProductToday: { name: 'Coca-Cola 0,5L', units: 12 },
    },

    // ── Feed (~6 recent sales, spread over last few hours) ───────────────────
    feed: [
      {
        id: 'f1',
        productName: 'Coca-Cola 0,5L',
        imagePath: 'p1.jpg',
        price: 2.50,
        machineName: 'Bürohaus Nord',
        createdAt: new Date(NOW_MS -  4 * 60000).toISOString(),  // 4 min ago
      },
      {
        id: 'f2',
        productName: 'Red Bull 250ml',
        imagePath: 'p2.jpg',
        price: 2.80,
        machineName: 'Foyer Süd',
        createdAt: new Date(NOW_MS - 11 * 60000).toISOString(), // 11 min ago
      },
      {
        id: 'f3',
        productName: 'Snickers',
        imagePath: null,
        price: 1.80,
        machineName: 'Kantine West',
        createdAt: new Date(NOW_MS - 23 * 60000).toISOString(), // 23 min ago
      },
      {
        id: 'f4',
        productName: 'Wasser still 0,5L',
        imagePath: null,
        price: 1.50,
        machineName: 'Bürohaus Nord',
        createdAt: new Date(NOW_MS - 58 * 60000).toISOString(), // 58 min ago
      },
      {
        id: 'f5',
        productName: 'Kaffee schwarz',
        imagePath: null,
        price: 1.20,
        machineName: 'Kantine West',
        createdAt: new Date(NOW_MS - 2 * 3600000 - 15 * 60000).toISOString(), // 2h 15m ago
      },
      {
        id: 'f6',
        productName: 'Eistee Pfirsich',
        imagePath: null,
        price: 1.90,
        machineName: 'Foyer Süd',
        createdAt: new Date(NOW_MS - 4 * 3600000).toISOString(), // 4h ago
      },
    ],

    // ── Machines (sorted by urgency: critical → low → ok → offline) ──────────
    machines: [
      // ── 1. Bürohaus Nord — CRITICAL (stock_percent 18%, 3 empty, 5 low) ───
      {
        id: 'm1',
        name: 'Bürohaus Nord',
        online: true,
        stock_health: 'critical',
        stock_percent: 18,
        empty_trays: 3,
        low_trays: 5,
        no_stock_trays: 2,
        total_trays: 12,
        today_revenue: 42.00,
        // In-stock refillable items (appear as colored rows in refillProducts)
        tray_summary: [
          {
            product_id: 'p1',
            product_name: 'Coca-Cola 0,5L',
            image_path: 'p1.jpg',
            sellprice: 2.50,
            discontinued: false,
            deficit: 8,
            in_stock: true,
            severity: 'critical',  // red
          },
          {
            product_id: 'p2',
            product_name: 'Red Bull 250ml',
            image_path: 'p2.jpg',
            sellprice: 2.80,
            discontinued: false,
            deficit: 6,
            in_stock: true,
            severity: 'low',       // amber
          },
          {
            product_id: 'p3',
            product_name: 'Snickers',
            image_path: null,
            sellprice: 1.80,
            discontinued: true,    // shows × badge
            deficit: 5,
            in_stock: true,
            severity: 'fill',      // blue — fill threshold but not empty/low
          },
        ],
        // Non-refillable no-stock items (no warehouse stock)
        no_stock_summary: [
          {
            product_id: 'p4',
            product_name: 'Wasser still 0,5L',
            image_path: null,
            sellprice: 1.50,
            discontinued: false,
            deficit: 3,
            in_stock: false,
            severity: 'critical',  // orange swap row
          },
          {
            product_id: 'p5',
            product_name: 'Eistee Pfirsich',
            image_path: null,
            sellprice: 1.90,
            discontinued: false,
            deficit: 2,
            in_stock: false,
            severity: 'low',       // dimmed (non-critical no-stock)
          },
        ],
      },

      // ── 2. Kantine West — LOW (stock_percent 34%, 0 empty, 1 low) ─────────
      {
        id: 'm2',
        name: 'Kantine West',
        online: true,
        stock_health: 'low',
        stock_percent: 34,
        empty_trays: 0,
        low_trays: 1,
        no_stock_trays: 0,
        total_trays: 8,
        today_revenue: 31.00,
        tray_summary: [
          {
            product_id: 'p6',
            product_name: 'Kaffee schwarz',
            image_path: null,
            sellprice: 1.20,
            discontinued: false,
            deficit: 2,
            in_stock: true,
            severity: 'low',       // amber
          },
        ],
        no_stock_summary: [],
      },

      // ── 3. Foyer Süd — OK (stock_percent 72%, 0 empty, 0 low) ───────────
      {
        id: 'm3',
        name: 'Foyer Süd',
        online: true,
        stock_health: 'ok',
        stock_percent: 72,
        empty_trays: 0,
        low_trays: 0,
        no_stock_trays: 0,
        total_trays: 10,
        today_revenue: 88.00,
        tray_summary: [],
        no_stock_summary: [],
      },

      // ── 4. Lager Ost — OFFLINE ────────────────────────────────────────────
      {
        id: 'm4',
        name: 'Lager Ost',
        online: false,
        stock_health: 'ok',
        stock_percent: 0,
        empty_trays: 0,
        low_trays: 0,
        no_stock_trays: 0,
        total_trays: 6,
        today_revenue: 0,
        tray_summary: [],
        no_stock_summary: [],
      },
    ],

    // ── Totals ────────────────────────────────────────────────────────────────
    totals: {
      machinesTotal: 4,
      machinesOnline: 3,
      refillMachines: 2,  // Bürohaus Nord (critical) + Kantine West (low)
    },
  }
})()
