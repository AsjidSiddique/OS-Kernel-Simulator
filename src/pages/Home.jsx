import { openWhatsApp } from '../lib/whatsapp'
import { useSite } from '../context/SiteSettingsContext'
import { getProductRatings, mergeRatings } from '../lib/productRatings'
import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProductCard from '../components/ProductCard'
import HeroBanner from '../components/HeroBanner'

const FEATURES = [
  { icon:'🚀', title:'Fast Delivery',   sub:'Burewala & all Pakistan', color:'#00BFFF' },
  { icon:'✅', title:'Trusted Quality', sub:'Verified products',        color:'#10B981' },
  { icon:'💎', title:'Best Prices',     sub:'Affordable deals',         color:'#8B5CF6' },
  { icon:'🎧', title:'24/7 Support',    sub:'Always here for you',      color:'#F97316' },
]

export default function Home() {
  const { deliveryRules } = useSite()
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [visibleCount, setVisibleCount] = useState(8)
  const sentinelRef = useRef()

  useEffect(() => {
    const load = () =>
      supabase.from('products').select('*, categories(id,name,icon)').or('is_active.eq.true,status.eq.coming_soon').order('created_at', { ascending: false })
        .then(({ data }) => { setProducts(data || []); setLoading(false) })
    load()
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisibleCount(n => n + 8)
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [products.length])

  return (
    <div className="pb-4" style={{ background:'var(--viro-sectionBg)', minHeight:'100vh', transition:'background 0.35s' }}>
      <div className="md:max-w-5xl md:mx-auto">

      <HeroBanner />

      {/* Feature strip — 4 cols on desktop, 2 on mobile */}
      <div className="px-4 mt-5 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FEATURES.map(f => (
            <div key={f.title} className="flex items-center gap-3 p-3 rounded-2xl"
              style={{ background:'var(--viro-featureBg)', border:'1px solid var(--viro-featureBorder)', transition:'background 0.35s, border-color 0.35s' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: f.color+'20', border:`1px solid ${f.color}40` }}>
                {f.icon}
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color:'var(--viro-text)' }}>{f.title}</p>
                <p className="text-xs" style={{ color:'var(--viro-textMuted)' }}>{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Latest Products */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-extrabold" style={{ color:'var(--viro-text)' }}>Latest Products</h2>
            <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Fresh arrivals just for you</p>
          </div>
          <Link to="/shop"
            className="text-xs font-bold px-3 py-1.5 rounded-xl"
            style={{ background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array(8).fill(0).map((_,i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ background:'var(--viro-productWhite)' }}>
                <div style={{ paddingTop:'66%', position:'relative' }} className="skeleton" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                  <div className="skeleton h-8 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12" style={{ color:'var(--viro-textSub)' }}>
            <div className="text-5xl mb-3">📦</div>
            <p className="font-bold" style={{ color:'var(--viro-text)' }}>No products yet</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {products.slice(0, visibleCount).map(p => <ProductCard key={p.id} product={p} />)}
          </div>
          {visibleCount < products.length && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--viro-textSub)' }}>
                <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                Loading more…
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Desktop: Delivery + CTA side by side */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Delivery Info — live from DB via useSite() */}
          <div className="rounded-2xl p-4" style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', transition:'background 0.35s, border-color 0.35s' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🚚</span>
              <h3 className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Delivery Info</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(deliveryRules || []).map((rule, i) => {
                const isWild  = rule.cities?.includes('*')
                const colors  = ['#00BFFF','#A78BFA','#F97316','#10B981']
                const color   = colors[i % colors.length]
                const icon    = isWild ? '🌍' : '📍'
                return (
                  <div key={i} className="p-2.5 rounded-xl" style={{ background: color+'12', border:`1px solid ${color}30` }}>
                    <p className="font-bold" style={{ color:'var(--viro-text)' }}>{icon} {rule.label}</p>
                    <p style={{ color }}>Free ≥ Rs.{rule.freeThreshold?.toLocaleString()}</p>
                    <p style={{ color:'var(--viro-textSub)', fontSize:10 }}>Rs.{rule.charge} otherwise</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-2xl p-5 text-center relative overflow-hidden flex flex-col items-center justify-center"
            style={{ background:'linear-gradient(135deg,#00BFFF15,#8B5CF625,#F9731615)', border:'1px solid #8B5CF640' }}>
            <p className="text-xs font-bold mb-1" style={{ color:'#A78BFA' }}>🎉 Pakistan-wide Delivery</p>
            <h3 className="font-display text-lg font-extrabold mb-1" style={{ color:'var(--viro-text)' }}>Shop with Confidence</h3>
            <p className="text-xs mb-4" style={{ color:'var(--viro-textMuted)' }}>Trusted by customers across Punjab & Pakistan</p>
            <div className="flex gap-3 justify-center">
              <Link to="/shop"
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
                style={{ background:'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)' }}>
                🛍️ Shop Now
              </Link>
              <button type="button" onClick={() => openWhatsApp("Hi Viro! I need assistance.")}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
                style={{ background:'linear-gradient(135deg,#25D366,#128C7E)' }}>
                💬 WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>{/* md:max-w */}
    </div>
  )
}
