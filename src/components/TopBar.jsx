import React, { useEffect, useState, useMemo } from 'react'
import { useSite } from '../context/SiteSettingsContext'
import { supabase } from '../lib/supabase'

// Fallback messages — used only when DB has no announcement saved
// Delivery values are injected dynamically from deliveryRules below
const BASE_FALLBACK = [
  '📞 Call / WhatsApp: 03277796566',
  '✅ Trusted Quality · Best Prices · Fast Delivery',
  '🛍️ Smart Shopping, Better Living — viro.pk',
]

export default function TopBar() {
  const { deliveryRules, contact } = useSite()

  // Build dynamic fallback from live delivery rules
  const dynamicFallback = useMemo(() => {
    if (!deliveryRules?.length) return BASE_FALLBACK
    const msgs = deliveryRules
      .filter(r => !r.cities?.includes('*'))
      .map(r => `🚚 FREE Delivery in ${r.label} on orders Rs.${r.freeThreshold?.toLocaleString()}+`)
    const wild = deliveryRules.find(r => r.cities?.includes('*'))
    if (wild) msgs.push(`🌍 ${wild.label} — Free on Rs.${wild.freeThreshold?.toLocaleString()}+ · Rs.${wild.charge} otherwise`)
    if (contact?.whatsapp) msgs.push(`📞 Call / WhatsApp: ${contact.phone || contact.whatsapp}`)
    return [...msgs, ...BASE_FALLBACK.slice(-2)]
  }, [deliveryRules, contact])

  // Sync dynamic fallback into messages once deliveryRules load from DB
  useEffect(() => {
    // Only update if still showing static BASE_FALLBACK (no DB announcement loaded yet)
    setMessages(prev => {
      const isStillDefault = prev.length <= BASE_FALLBACK.length &&
        prev.every(m => BASE_FALLBACK.includes(m))
      return isStillDefault ? dynamicFallback : prev
    })
  }, [dynamicFallback])

  // Fix #11: Cache with 5-minute TTL so admin announcement changes propagate promptly.
  const [messages, setMessages] = useState(() => {
    try {
      const raw = sessionStorage.getItem('viro_announcement')
      if (raw) {
        const parsed = JSON.parse(raw)
        // Guard: old v43 format was a plain array, v44 is { msgs, ts }
        if (Array.isArray(parsed)) {
          // Old format — clear it so we refetch with timestamp
          sessionStorage.removeItem('viro_announcement')
        } else {
          const { msgs, ts } = parsed
          if (Date.now() - ts < 5 * 60 * 1000) return msgs  // still fresh
        }
      }
    } catch {}
    return BASE_FALLBACK
  })

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'announcement').single()
      .then(({ data }) => {
        if (data?.value?.messages?.length) {
          setMessages(data.value.messages)
          sessionStorage.setItem('viro_announcement', JSON.stringify({ msgs: data.value.messages, ts: Date.now() }))
        }
      }).catch(() => {})
  }, [])

  return (
    // No md:pl offset — TopBar sits above EVERYTHING including sidebar
    <div className="sticky top-0 z-50 w-full overflow-hidden"
      style={{ height: '36px', background: 'linear-gradient(90deg,#00BFFF,#8B5CF6,#F97316,#8B5CF6,#00BFFF)', backgroundSize: '300% 100%', animation: 'gradShift 8s ease infinite' }}>
      <style>{`
        @keyframes gradShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes ticker { 0%{transform:translateX(100vw)} 100%{transform:translateX(-100%)} }
        .ticker { display:flex; white-space:nowrap; animation:ticker 32s linear infinite; gap:3rem; }
        .ticker:hover { animation-play-state:paused; }
      `}</style>
      <div className="flex items-center h-full overflow-hidden">
        <div className="ticker">
          {[...messages,...messages].map((m,i) => (
            <span key={i} className="text-white font-semibold text-xs px-6 flex-shrink-0"
              style={{textShadow:'0 1px 3px rgba(0,0,0,0.3)'}}>
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
