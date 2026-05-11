import React, { useState, useEffect, useCallback, useRef } from 'react'
import { CountdownBadge, LaunchCountdownBadge } from './CountdownTimer'
import { Link, useNavigate } from 'react-router-dom'
import { useCart, parseImages } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { useSite } from '../context/SiteSettingsContext'
import { Stars } from './ProductReviews'
import { openWhatsApp } from '../lib/whatsapp'
import { supabase } from '../lib/supabase'

/**
 * ProductCard — single unified card used on Home, Shop, ProductDetail (related), and any future page.
 * Props:
 *   product  — product object from Supabase
 *   compact  — (optional) boolean: slightly smaller text for dense grids (default false)
 *
 * v46 — Launch timer auto-activate:
 *   When launch_at expires the card immediately calls combined_timer_check() RPC
 *   then re-fetches the product from DB. This means the card flips from
 *   "Coming Soon" → "Active" on its own — no full page reload needed.
 */
export default function ProductCard({ product: initialProduct, compact = false }) {
  const { contact, ordersBadgeEnabled } = useSite()
  const { addToCart } = useCart()
  const { toggleWishlist, isInWishlist } = useWishlist()
  const navigate = useNavigate()

  // v46: local product state so card can self-update after timer expiry
  const [product, setProduct] = useState(initialProduct)
  const [activating, setActivating] = useState(false)
  const activatedRef = useRef(false)

  // Keep in sync when parent passes a fresh product (e.g. parent re-fetches)
  useEffect(() => { setProduct(initialProduct) }, [initialProduct])

  const images = parseImages(product.images)
  const thumb = images[0] || 'https://placehold.co/400x300/F1F5F9/8B5CF6?text=Viro'

  const now = new Date()
  const isComingSoon  = product.status === 'coming_soon'
  const isLaunching   = isComingSoon && !!product.launch_at && new Date(product.launch_at) > now
  const hasSaleTimer  = product.sale_active && product.sale_ends_at && new Date(product.sale_ends_at) > now
  const hasLegacyTimer= !hasSaleTimer && product.countdown_ends_at && new Date(product.countdown_ends_at) > now
  const saleExpired   = product.sale_ends_at && !hasSaleTimer
  const hasDiscount   = product.discount_price && product.discount_price < product.price
  // v46 fix: if sale_ends_at exists and is in the past, discount is expired — show original price.
  // This fixes bulk % discount not applying on products with old expired timers.
  const saleEndedInPast = product.sale_ends_at && new Date(product.sale_ends_at) <= now
  const effectiveDisc = hasDiscount && (
    hasSaleTimer ||                             // active timer running
    (!product.sale_ends_at && !saleEndedInPast) // permanent discount (no expiry)
  )
  const displayPrice  = effectiveDisc ? product.discount_price : product.price
  const inStock       = product.stock > 0 && product.status !== 'out_of_stock' && !isComingSoon
  const discountPct   = effectiveDisc ? Math.round((1 - product.discount_price / product.price) * 100) : 0

  // v46: called by CountdownBadge (sale) when sale timer hits zero — update price live
  const saleExpiredCardRef = useRef(false)
  const handleSaleExpire = useCallback(async () => {
    if (saleExpiredCardRef.current) return
    saleExpiredCardRef.current = true
    // v46 fix: clear sale fields immediately in local state — instant price revert
    setProduct(prev => ({
      ...prev,
      sale_active:    false,
      discount_price: null,
      sale_ends_at:   null,  // ← clear so future discounts aren't blocked
    }))
    try {
      await supabase.rpc('combined_timer_check')
      await new Promise(r => setTimeout(r, 800))
      const { data } = await supabase
        .from('products')
        .select('*, categories(id,name,icon,parent_id)')
        .eq('id', product.id)
        .single()
      if (data) setProduct(data)
    } catch (_) {}
  }, [product.id])

  // v46: called by LaunchCountdownBadge when countdown hits zero
  const handleLaunchExpire = useCallback(async () => {
    if (activatedRef.current) return
    activatedRef.current = true
    setActivating(true)
    try {
      // 1. Tell the DB to flip status now (don't wait for cron)
      await supabase.rpc('combined_timer_check')
      // 2. Small buffer for DB write to settle
      await new Promise(r => setTimeout(r, 800))
      // 3. Re-fetch this product so card shows new status
      const { data } = await supabase
        .from('products')
        .select('*, categories(id,name,icon,parent_id)')
        .eq('id', product.id)
        .single()
      if (data) setProduct(data)
    } catch (_) {
      // Silently fail — next 30s poll in ProductDetail will catch it
    } finally {
      setActivating(false)
    }
  }, [product.id])

  function handleAddToCart(e) { e.preventDefault(); e.stopPropagation(); addToCart(product) }
  function handleOrderNow(e) {
    e.preventDefault(); e.stopPropagation()
    sessionStorage.setItem('viro_quick_order', JSON.stringify([{ ...product, quantity: 1 }]))
    navigate('/checkout?quick=1')
  }
  function handleWhatsApp(e) {
    e.preventDefault(); e.stopPropagation()
    const msg = isComingSoon
      ? `Hi Viro! I want to pre-register for: ${product.name}. Notify me when it launches!`
      : `Hi Viro! I'd like to book: ${product.name}. Notify me when it's back in stock!`
    openWhatsApp(msg, contact.whatsapp)
  }

  const nameSize  = compact ? '11px' : '12px'
  const priceSize = compact ? '12px' : '13px'
  const btnSize   = compact ? '10px' : '11px'
  const btnPad    = compact ? '5px 0' : '7px 0'

  return (
    <div
      className="group rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{ background: '#fff', border: '1px solid #E8EAF0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer' }}
    >
      {/* ── Image — 3:2 ratio ── */}
      <Link to={`/product/${product.id}`} className="block flex-shrink-0 relative overflow-hidden"
        style={{ paddingTop: '66%', background: '#F8FAFC' }}>
        <img
          src={thumb}
          alt={product.name}
          className="transition-transform duration-500 group-hover:scale-105"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.target.src = 'https://placehold.co/400x266/F1F5F9/8B5CF6?text=Viro' }}
        />

        {/* Discount badge — top left */}
        {effectiveDisc && (
          <div style={{
            position: 'absolute', top: 7, left: 7,
            background: 'linear-gradient(135deg,#8B5CF6,#F97316)',
            color: '#fff', fontWeight: 800, fontSize: 10,
            padding: '2px 7px', borderRadius: 6,
            boxShadow: '0 2px 6px rgba(139,92,246,0.35)'
          }}>-{discountPct}%</div>
        )}

        {/* Orders badge — bottom right of image
            Shown only when: global toggle ON + per-product toggle ON + count > 0 */}
        {ordersBadgeEnabled && product.show_order_count && (product.stock_complete ?? 0) > 0 && (
          <div style={{
            position: 'absolute', bottom: 7, right: 7,
            background: 'linear-gradient(135deg,#EF4444,#F97316)',
            color: '#fff', fontWeight: 800, fontSize: 9,
            padding: '2px 7px', borderRadius: 20,
            boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
            display: 'flex', alignItems: 'center', gap: 3,
            backdropFilter: 'blur(4px)',
          }}>
            🔥 {product.stock_complete} ordered
          </div>
        )}

        {/* Wishlist heart button */}
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product) }}
          title={isInWishlist(product.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
          style={{
            position: 'absolute', bottom: 7, left: 7,
            width: 28, height: 28, borderRadius: '50%',
            background: isInWishlist(product.id) ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.85)',
            border: isInWishlist(product.id) ? '1.5px solid #F43F5E' : '1.5px solid #E2E8F0',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            transition: 'transform 0.15s, border-color 0.2s, background 0.2s',
          }}
          onMouseDown={e => e.currentTarget.style.transform='scale(0.88)'}
          onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
          onTouchStart={e => { e.stopPropagation(); e.currentTarget.style.transform='scale(0.88)' }}
          onTouchEnd={e => { e.stopPropagation(); e.currentTarget.style.transform='scale(1)' }}
        >
          {isInWishlist(product.id) ? '❤️' : '🤍'}
        </button>

        {/* Status badge — top right */}
        {activating ? (
          <div style={{
            position: 'absolute', top: 7, right: 7,
            background: '#FEF9C3', color: '#92400E',
            border: '1px solid #FDE68A', fontWeight: 600,
            fontSize: 10, padding: '2px 7px', borderRadius: 20
          }}>⏳ Activating…</div>
        ) : inStock ? (
          <div style={{
            position: 'absolute', top: 7, right: 7,
            background: '#DCFCE7', color: '#16A34A',
            border: '1px solid #BBF7D0', fontWeight: 600,
            fontSize: 10, padding: '2px 7px', borderRadius: 20
          }}>✓ In Stock</div>
        ) : isComingSoon ? (
          <div style={{
            position: 'absolute', top: 7, right: 7,
            background: '#EDE9FE', color: '#7C3AED',
            border: '1px solid #DDD6FE', fontWeight: 600,
            fontSize: 10, padding: '2px 7px', borderRadius: 20
          }}>🚀 Soon</div>
        ) : (
          <div style={{
            position: 'absolute', top: 7, right: 7,
            background: '#FEE2E2', color: '#DC2626',
            border: '1px solid #FECACA', fontWeight: 600,
            fontSize: 10, padding: '2px 7px', borderRadius: 20
          }}>Out of Stock</div>
        )}
      </Link>

      {/* ── Card body ── */}
      <div style={{ padding: '8px 9px 9px', display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* Category pill */}
        {product.categories && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
            background: '#8B5CF612', color: '#A78BFA',
            border: '1px solid #8B5CF625', marginBottom: 4, alignSelf: 'flex-start'
          }}>
            {product.categories.icon} {product.categories.name}
          </div>
        )}

        {/* Name */}
        <Link to={`/product/${product.id}`} style={{ textDecoration: 'none' }}>
          <p style={{
            margin: '0 0 6px', color: '#0F172A', fontWeight: 600,
            fontSize: nameSize, lineHeight: 1.35,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>{product.name}</p>
        </Link>

        {/* Star rating mini */}
        {product.review_count > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
            <Stars rating={Math.round(product.avg_rating || 0)} size={11} />
            <span style={{ fontSize:10, color:'#FBBF24', fontWeight:700 }}>{Number(product.avg_rating||0).toFixed(1)}</span>
            <span style={{ fontSize:9, color:'var(--viro-textSub)' }}>({product.review_count})</span>
          </div>
        )}

        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
          <span style={{ color: '#7C3AED', fontWeight: 900, fontSize: priceSize }}>
            Rs.{displayPrice?.toLocaleString()}
          </span>
          {effectiveDisc && (
            <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: 10, textDecoration: 'line-through' }}>
              Rs.{product.price?.toLocaleString()}
            </span>
          )}
        </div>

        {/* Timer badges:
            - coming_soon + launch_at in future → LaunchCountdownBadge with onExpire
            - coming_soon + no launch_at (or expired) → "Coming Soon" static badge (no timer)
            - not coming_soon + sale timer → sale countdown
            - legacy fallback
        */}
        {isComingSoon ? (
          <div style={{ marginBottom: 5 }}>
            {isLaunching
              ? <LaunchCountdownBadge endAt={product.launch_at} onExpire={handleLaunchExpire} />
              : <div style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                  padding:'3px 7px', borderRadius:6, width:'100%',
                  background:'linear-gradient(135deg,#8B5CF6,#A78BFA)',
                  boxShadow:'0 2px 6px rgba(139,92,246,0.3)',
                }}>
                  <span style={{fontSize:9}}>🚀</span>
                  <span style={{color:'#fff',fontWeight:800,fontSize:10}}>Coming Soon</span>
                </div>
            }
          </div>
        ) : hasSaleTimer ? (
          <div style={{ marginBottom: 5 }}>
            <CountdownBadge endAt={product.sale_ends_at} label="🔥 Sale" onExpire={handleSaleExpire} />
          </div>
        ) : hasLegacyTimer ? (
          <div style={{ marginBottom: 5 }}>
            <CountdownBadge endAt={product.countdown_ends_at} />
          </div>
        ) : product.description ? (
          <p style={{
            fontSize: 10, color: '#64748B', lineHeight: 1.4, marginBottom: 5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>{product.description}</p>
        ) : null}

        {/* Low stock nudge */}
        {inStock && product.stock <= 5 && (
          <p style={{ color: '#F97316', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
            ⚠️ Only {product.stock} left
          </p>
        )}

        {/* CTA buttons — always at bottom */}
        <div style={{ marginTop: 'auto', paddingTop: 4 }}>
          {inStock ? (
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={handleAddToCart}
                style={{
                  flex: 1, border: 'none', cursor: 'pointer', borderRadius: 10,
                  padding: btnPad, fontSize: btnSize, fontWeight: 700,
                  background: '#1E293B', color: '#E2E8F0',
                  transition: 'transform 0.1s'
                }}
                onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e => e.currentTarget.style.transform=''}
                onTouchStart={e => e.currentTarget.style.transform='scale(0.96)'}
                onTouchEnd={e => e.currentTarget.style.transform=''}
              >🛒 Add</button>
              <button onClick={handleOrderNow}
                style={{
                  flex: 1, border: 'none', cursor: 'pointer', borderRadius: 10,
                  padding: btnPad, fontSize: btnSize, fontWeight: 700,
                  background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
                  color: '#fff', transition: 'transform 0.1s'
                }}
                onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'}
                onMouseUp={e => e.currentTarget.style.transform=''}
                onTouchStart={e => e.currentTarget.style.transform='scale(0.96)'}
                onTouchEnd={e => e.currentTarget.style.transform=''}
              >⚡ Order</button>
            </div>
          ) : (
            <button onClick={handleWhatsApp}
              style={{
                width: '100%', border: 'none', cursor: 'pointer', borderRadius: 10,
                padding: btnPad, fontSize: btnSize, fontWeight: 700,
                background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff'
              }}
              onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'}
              onMouseUp={e => e.currentTarget.style.transform=''}
              onTouchStart={e => e.currentTarget.style.transform='scale(0.96)'}
              onTouchEnd={e => e.currentTarget.style.transform=''}
            >💬 {isComingSoon ? 'Notify Me' : 'Book via WhatsApp'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
