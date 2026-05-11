import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// ── Force cache bust on v28 deploy ──────────────────────────
// Clears ALL old CacheStorage entries so stale JS never runs
const CURRENT_VERSION = 'viro-v31'
;(async () => {
  try {
    const keys = await caches.keys()
    for (const k of keys) {
      if (k !== CURRENT_VERSION) {
        await caches.delete(k)
        console.log('[Viro] Cleared old cache:', k)
      }
    }
  } catch {}
})()

// ── Remove StrictMode — it double-fires useEffect in dev causing realtime crashes ──
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
