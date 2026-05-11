// ── SiteSettingsContext.jsx ───────────────────────────────────
// Global context so ALL components share ONE fetch from site_settings.
// No prop-drilling, no duplicate fetches, instant everywhere.
//
// Usage anywhere in the app:
//   import { useSite } from '../context/SiteSettingsContext'
//   const { contact, getDeliveryCharge, deliveryRules } = useSite()
// ─────────────────────────────────────────────────────────────
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export const DEFAULT_CONTACT = {
  phone:    '+923277796566',
  whatsapp: '923277796566',
  email:    'support@viro.pk',
  address:  'Mandi Burewala, Punjab, Pakistan',
}

export const DEFAULT_DELIVERY_RULES = [
  { label:'Burewala',         cities:['burewala'], freeThreshold:999,  charge:150 },
  { label:'Vehari',           cities:['vehari'],   freeThreshold:1500, charge:150 },
  { label:'All Other Cities', cities:['*'],        freeThreshold:2500, charge:150 },
]

function parseRules(raw) {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_DELIVERY_RULES
  return raw.map(r => ({
    label:         r.label || 'Delivery',
    cities:        Array.isArray(r.cities) ? r.cities.map(c => c.toLowerCase()) : [String(r.cities||'*').toLowerCase()],
    freeThreshold: Number(r.freeThreshold ?? r.free_threshold ?? 2500),
    charge:        Number(r.charge ?? 150),
  }))
}

function calcCharge(city, subtotal, rules) {
  const c = (city || '').trim().toLowerCase()
  const r = rules || DEFAULT_DELIVERY_RULES
  const match = r.find(rule => rule.cities.includes(c)) || r.find(rule => rule.cities.includes('*'))
  if (!match) return 150
  return subtotal >= match.freeThreshold ? 0 : match.charge
}

const Ctx = createContext(null)

export function SiteSettingsProvider({ children }) {
  const [contact,       setContact]       = useState(DEFAULT_CONTACT)
  const [deliveryRules, setDeliveryRules] = useState(DEFAULT_DELIVERY_RULES)
  const [rawSettings,   setRawSettings]   = useState({})
  const [couponEnabled,      setCouponEnabled]      = useState(false)
  const [ordersBadgeEnabled, setOrdersBadgeEnabled] = useState(false)
  const [reviewsEnabled,     setReviewsEnabled]     = useState(true)
  const [autoApproveReviews, setAutoApproveReviews] = useState(false)
  const [loaded,        setLoaded]        = useState(false)

  const reload = useCallback(async () => {
    try {
      const { data } = await supabase.from('site_settings').select('*')
      const all = {}
      ;(data || []).forEach(r => { all[r.key] = r.value })
      setRawSettings(all)
      if (all.contact) setContact({ ...DEFAULT_CONTACT, ...all.contact })
      if (all.delivery_rules) setDeliveryRules(parseRules(all.delivery_rules))
      if (all.coupon_settings)      setCouponEnabled(!!all.coupon_settings.enabled)
      if (all.orders_badge_settings) setOrdersBadgeEnabled(!!all.orders_badge_settings.enabled)
      if (all.review_settings) {
        setReviewsEnabled(all.review_settings.enabled !== false)
        setAutoApproveReviews(!!all.review_settings.auto_approve)
      }
    } catch {}
    setLoaded(true)
  }, [])

  useEffect(() => { reload() }, [])

  function getDeliveryCharge(city, subtotal) {
    return calcCharge(city, subtotal, deliveryRules)
  }

  return (
    <Ctx.Provider value={{ contact, deliveryRules, getDeliveryCharge, rawSettings, couponEnabled, setCouponEnabled, ordersBadgeEnabled, setOrdersBadgeEnabled, reviewsEnabled, setReviewsEnabled, autoApproveReviews, setAutoApproveReviews, loaded, reload }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSite() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSite must be used inside <SiteSettingsProvider>')
  return ctx
}
