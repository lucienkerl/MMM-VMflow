/**
 * MMM-VMflow — sample MagicMirror config entries
 *
 * Copy the module(s) you want into the `modules` array of your
 * ~/MagicMirror/config/config.js. Replace <BACKEND_URL> and <API_KEY>
 * with your VMflow backend address and the API key from /api-keys.
 *
 * All options and their defaults are documented in README.md.
 */

// ---------------------------------------------------------------------------
// Option 1 — Combo (cockpit): today's revenue + week/month KPIs + refill list
// Recommended position: top_right or top_left
// ---------------------------------------------------------------------------
{
  module: "MMM-VMflow",
  position: "top_right",
  config: {
    baseUrl: "http://<BACKEND_URL>:8000",
    apiKey:  "<API_KEY>",
    layout: "combo",
    timezone: "Europe/Berlin",  // IMPORTANT: your IANA zone — the host (e.g. a Pi) often defaults to UTC,
                                // which drops early-local-day sales from "today". Match the dashboard.
    // updateInterval: 60000,   // poll every 60 s (default)
  }
},

// ---------------------------------------------------------------------------
// Option 2 — KPI only: revenue today/week/month + top product
// Recommended position: top_right
// ---------------------------------------------------------------------------
{
  module: "MMM-VMflow",
  position: "top_right",
  config: {
    baseUrl: "http://<BACKEND_URL>:8000",
    apiKey:  "<API_KEY>",
    layout: "kpi",
  }
},

// ---------------------------------------------------------------------------
// Option 3 — Recent sales feed
// Recommended position: top_left or top_right
// ---------------------------------------------------------------------------
{
  module: "MMM-VMflow",
  position: "top_left",
  config: {
    baseUrl: "http://<BACKEND_URL>:8000",
    apiKey:  "<API_KEY>",
    layout: "feed",
    maxFeedItems: 10,
    // showImages: true,  // enable product thumbnails (requires https + public bucket)
  }
},

// ---------------------------------------------------------------------------
// Option 4 — Refill status: machines needing restocking with fill-% bars
// Recommended position: top_left or top_right
// ---------------------------------------------------------------------------
{
  module: "MMM-VMflow",
  position: "top_left",
  config: {
    baseUrl: "http://<BACKEND_URL>:8000",
    apiKey:  "<API_KEY>",
    layout: "refillStatus",
  }
},

// ---------------------------------------------------------------------------
// Option 5 — Refill products: per-machine product detail (severity + deficits)
// Recommended position: top_left or top_right
// ---------------------------------------------------------------------------
{
  module: "MMM-VMflow",
  position: "top_left",
  config: {
    baseUrl: "http://<BACKEND_URL>:8000",
    apiKey:  "<API_KEY>",
    layout: "refillProducts",
    // machineIds: ["uuid-1", "uuid-2"],  // filter to specific machines
  }
},

// ---------------------------------------------------------------------------
// Option 6 — Fleet grid: compact overview of all machines (status + revenue)
// Recommended position: bottom_bar or lower_third
// ---------------------------------------------------------------------------
{
  module: "MMM-VMflow",
  position: "bottom_bar",
  config: {
    baseUrl: "http://<BACKEND_URL>:8000",
    apiKey:  "<API_KEY>",
    layout: "fleet",
  }
},

// ---------------------------------------------------------------------------
// Option 7 — Ticker: single-line summary for a bar position
// Recommended position: top_bar or bottom_bar
// ---------------------------------------------------------------------------
{
  module: "MMM-VMflow",
  position: "top_bar",
  config: {
    baseUrl: "http://<BACKEND_URL>:8000",
    apiKey:  "<API_KEY>",
    layout: "ticker",
    updateInterval: 30000,  // refresh every 30 s for a live ticker feel
  }
},
