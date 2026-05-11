// ── siteSettings.js ──────────────────────────────────────────
// Single source of truth for all live site settings loaded from
// Supabase site_settings table.
//
// Usage:
//   import { useSiteSettings } from './siteSettings'
//   const { contact, getDeliveryCharge, deliveryRules, loading } = useSiteSettings()
//
// Admin saves to site_settings table → customers get fresh data on next load.
// Values are cached in localStorage for instant render, then refreshed from DB.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// ── Hardcoded fallbacks (used until DB loads) ─────────────────
export const DEFAULT_CONTACT = {
  phone:    '+923277796566',
  whatsapp: '923277796566',
  email:    'support@viro.pk',
  address:  'Mandi Burewala, Punjab, Pakistan',
}

// Delivery rules: array of { cities: string[], freeThreshold: number, charge: number, label: string }
// Cities is comma-separated lowercase match. '*' = all other cities.
export const DEFAULT_DELIVERY_RULES = [
  { cities: ['burewala'], freeThreshold: 550,  charge: 150, label: 'Burewala' },
  { cities: ['*'],        freeThreshold: 2500, charge: 150, label: 'Other Cities' },
]

const CACHE_KEY = 'viro_site_settings_cache'

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch {}
}

// Parse delivery rules from DB value (array of rule objects)
function parseDeliveryRules(raw) {
  if (!raw || !Array.isArray(raw)) return DEFAULT_DELIVERY_RULES
  return raw.map(r => ({
    cities:        Array.isArray(r.cities) ? r.cities.map(c => c.toLowerCase()) : [r.cities?.toLowerCase() ?? '*'],
    freeThreshold: Number(r.freeThreshold ?? r.free_threshold ?? 2500),
    charge:        Number(r.charge ?? 150),
    label:         r.label || 'Delivery',
  }))
}

// The actual delivery charge calculator — uses live rules from DB
export function calcDeliveryCharge(city, subtotal, rules) {
  const r = rules || DEFAULT_DELIVERY_RULES
  const c = (city || '').trim().toLowerCase()
  // Find first matching rule
  const match =
    r.find(rule => rule.cities.includes(c)) ||
    r.find(rule => rule.cities.includes('*'))
  if (!match) return 150
  return subtotal >= match.freeThreshold ? 0 : match.charge
}

// ── Global singleton to avoid duplicate fetches ───────────────
let _cache = null
let _promise = null

export async function fetchSiteSettings() {
  if (_cache) return _cache
  if (_promise) return _promise
  _promise = (async () => {
    try {
      const { data } = await supabase.from('site_settings').select('*')
      const all = {}
      ;(data || []).forEach(r => { all[r.key] = r.value })
      _cache = all
      saveCache(all)
      return all
    } catch {
      const cached = loadCache()
      _cache = cached
      return cached
    }
  })()
  return _promise
}

// Invalidate cache (call after admin saves a setting)
export function invalidateSiteSettings() {
  _cache = null
  _promise = null
}

// ── React hook ────────────────────────────────────────────────
export function useSiteSettings() {
  const cached = loadCache()
  const [settings, setSettings] = useState(cached)
  const [loading,  setLoading]  = useState(!Object.keys(cached).length)

  useEffect(() => {
    invalidateSiteSettings() // always re-fetch on mount
    fetchSiteSettings().then(s => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  const contact = settings.contact
    ? { ...DEFAULT_CONTACT, ...settings.contact }
    : DEFAULT_CONTACT

  const deliveryRules = parseDeliveryRules(settings.delivery_rules)

  function getDeliveryCharge(city, subtotal) {
    return calcDeliveryCharge(city, subtotal, deliveryRules)
  }

  return { settings, contact, deliveryRules, getDeliveryCharge, loading }
}
