import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProductReviews, { Stars } from '../components/ProductReviews'
import { openWhatsApp } from '../lib/whatsapp'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { CountdownFull, CountdownBadge, LaunchCountdownFull } from '../components/CountdownTimer'
import ProductCard from '../components/ProductCard'
import { useSite } from '../context/SiteSettingsContext'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { contact, deliveryRules, ordersBadgeEnabled } = useSite()
  const { addToCart } = useCart()
  const { toggleWishlist, isInWishlist } = useWishlist()
  const [product, setProduct]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty]             = useState(1)
  const [added, setAdded]         = useState(false)

  // Fix #8: abort guard prevents state updates on unmounted component
  useEffect(() => {
    let alive = true
    setLoading(true)
    const fetchProduct = () =>
      supabase.from('products')
        .select('*, categories(id,name,icon,parent_id, parent:parent_id(id,name,icon))')
        .eq('id', id).single()
        .then(({ data }) => { if (alive) { setProduct(data); setLoading(false) } })
        .catch(() => { if (alive) setLoading(false) })
    fetchProduct()
    const timer = setInterval(fetchProduct, 30000)
    return () => { alive = false; clearInterval(timer) }
  }, [id])

  // v46: When launch_at expires, immediately call combined_timer_check() RPC so the DB
  // flips status→active right now (no waiting for the 1-min cron job).
  // Then refetch the product to reflect the new active status in the UI.
  const activatedDetailRef = React.useRef(false)
  const handleDetailLaunchExpire = useCallback(async () => {
    if (activatedDetailRef.current) return
    activatedDetailRef.current = true
    try {
      await supabase.rpc('combined_timer_check')
      await new Promise(r => setTimeout(r, 800))
      const { data } = await supabase
        .from('products')
        .select('*, categories(id,name,icon,parent_id, parent:parent_id(id,name,icon))')
        .eq('id', id).single()
      if (data) {
        setProduct(data)
        // Fetch approved review stats
        const { data: revs } = await supabase
          .from('reviews')
          .select('rating')
          .eq('product_id', id)
          .eq('status', 'approved')
        if (revs?.length) {
          const avg = revs.reduce((s,r) => s+r.rating, 0) / revs.length
          setReviewStats({ avg: avg.toFixed(1), total: revs.length })
        }
      }
    } catch (_) {
      // Silently fail — 30s poll will catch it
    }
  }, [id])

  // v46: when sale timer hits zero → call RPC + refetch so price reverts to original live
  const saleExpiredRef = React.useRef(false)
  const handleSaleExpire = useCallback(async () => {
    if (saleExpiredRef.current) return
    saleExpiredRef.current = true
    // v46 fix: immediately clear sale fields in local state so price reverts NOW
    // (don't wait for the DB round-trip — user sees original price instantly)
    setProduct(prev => prev ? {
      ...prev,
      sale_active:    false,
      discount_price: null,
      sale_ends_at:   null,   // ← critical: clear so future discounts aren't blocked
    } : prev)
    try {
      await supabase.rpc('combined_timer_check')
      await new Promise(r => setTimeout(r, 800))
      const { data } = await supabase
        .from('products')
        .select('*, categories(id,name,icon,parent_id, parent:parent_id(id,name,icon))')
        .eq('id', id).single()
      if (data) {
        setProduct(data)
        // Fetch approved review stats
        const { data: revs } = await supabase
          .from('reviews')
          .select('rating')
          .eq('product_id', id)
          .eq('status', 'approved')
        if (revs?.length) {
          const avg = revs.reduce((s,r) => s+r.rating, 0) / revs.length
          setReviewStats({ avg: avg.toFixed(1), total: revs.length })
        }
      }
    } catch (_) {}
  }, [id])

  if (loading) return (
    <div className="p-4 animate-pulse" style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh' }}>
      <div className="skeleton rounded-xl mb-3" style={{ height: '60vw', maxHeight: 480 }} />
      <div className="skeleton h-6 w-3/4 mb-2 rounded" />
      <div className="skeleton h-4 w-1/2 rounded" />
    </div>
  )

  if (!product) return (
    <div className="text-center py-20 px-4" style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh' }}>
      <div className="text-5xl mb-4">😕</div>
      <p className="font-bold" style={{ color: 'var(--viro-text)' }}>Product not found</p>
      <button onClick={() => navigate('/shop')} className="btn-primary mt-4 mx-auto px-6 py-3">← Back to Shop</button>
    </div>
  )

  if (product.is_active === false && product.status !== 'coming_soon') {
    navigate('/shop'); return null
  }

  const images      = Array.isArray(product.images) ? product.images
    : (typeof product.images === 'string' ? JSON.parse(product.images || '[]') : [])
  const imgList     = images.length > 0 ? images : ['/logo.jpg']
  const hasDiscount = product.discount_price && product.discount_price < product.price
  // v46 Timer priority logic:
  // launch_at  → Coming Soon timer (purple, PRIORITY). On end → product goes active.
  // sale_ends_at → Sale/deal timer (red). Hidden while coming_soon timer runs.
  // Discount PRICE is visible during coming_soon, but the sale COUNTDOWN is not.
  const now = new Date()
  // isComingSoon = DB status only. Never flip it client-side from launch_at expiry.
  // When launch_at hits zero, keep showing "Coming Soon" until DB cron flips
  // status → 'active' and our poll (or scheduled refetch above) picks it up.
  const isComingSoon    = product.status === 'coming_soon'
  const isLaunching     = isComingSoon && !!product.launch_at && new Date(product.launch_at) > now
  const hasSaleTimer    = product.sale_active && product.sale_ends_at && new Date(product.sale_ends_at) > now
  const hasLegacyCountdown = !hasSaleTimer && product.countdown_ends_at && new Date(product.countdown_ends_at) > now
  const saleTimerExpired = product.sale_ends_at && !hasSaleTimer

  // v46 fix: discount is effective ONLY when:
  //   a) sale_active=true AND sale_ends_at is in the future (timer running), OR
  //   b) discount_price is set AND there is NO sale_ends_at at all (permanent discount), OR
  //   c) product is coming_soon (discount reserved for launch)
  // If sale_ends_at exists but is in the past → discount is EXPIRED, show original price.
  // This fixes the bug where bulk-applying a new discount on a product with an old
  // expired sale_ends_at would still fail to show the discount.
  const saleEndedInPast = product.sale_ends_at && new Date(product.sale_ends_at) <= now
  const effectiveHasDiscount = hasDiscount && (
    hasSaleTimer ||                           // timer actively running
    (!product.sale_ends_at && !saleEndedInPast) || // permanent (no expiry set)
    isComingSoon                              // coming soon pre-launch discount
  )
  const hasCountdown = hasSaleTimer || hasLegacyCountdown
  const displayPrice = effectiveHasDiscount ? product.discount_price : product.price
  const inStock     = product.stock > 0 && product.status !== 'out_of_stock' && !isComingSoon
  const isOutOfStock = !inStock && !isComingSoon
  const savings     = effectiveHasDiscount ? product.price - product.discount_price : 0
  const discountPct = effectiveHasDiscount ? Math.round((savings / product.price) * 100) : 0

  function handleAddToCart() {
    for (let i = 0; i < qty; i++) addToCart(product)
    setAdded(true); setTimeout(() => setAdded(false), 2000)
  }
  function handleOrderNow() {
    sessionStorage.setItem('viro_quick_order', JSON.stringify([{ ...product, quantity: qty }]))
    navigate('/checkout?quick=1')
  }
  function prevImg() { setActiveImg(i => (i - 1 + imgList.length) % imgList.length) }
  function nextImg() { setActiveImg(i => (i + 1) % imgList.length) }

  const waBookMsg = `Hi Viro! I'd like to book in advance: ${product.name}. Please notify me when it's back in stock!`
  const waPreMsg  = `Hi Viro! I want to pre-register for: ${product.name}. Please notify me when it launches!`

  // ── Info panel (shared between mobile & desktop) ──────────────
  const InfoPanel = () => (
    <div className="flex flex-col gap-3">

      {/* Name + stock badge */}
      <div className="flex items-start justify-between gap-2">
        <h1 className="font-display font-bold leading-tight flex-1"
          style={{ color: 'var(--viro-text)', fontSize: 'clamp(17px,2.5vw,24px)' }}>
          {product.name}
        </h1>
        <div className="px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 mt-0.5 whitespace-nowrap"
          style={isComingSoon
            ? { background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }
            : inStock
              ? { background:'#10B98115', color:'#10B981', border:'1px solid #10B98140' }
              : { background:'#EF444415', color:'#EF4444', border:'1px solid #EF444440' }}>
          {isComingSoon ? '🚀 Soon' : inStock ? `✓ ${product.stock} left` : '✗ Out of Stock'}
        </div>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-extrabold" style={{ color: '#7C3AED', fontSize: 'clamp(22px,3vw,30px)' }}>
          Rs. {displayPrice?.toLocaleString()}
        </span>
        {effectiveHasDiscount && (
          <div className="flex flex-col">
            <span className="line-through text-sm" style={{ color: 'var(--viro-textSub)' }}>
              Rs. {product.price?.toLocaleString()}
            </span>
            <span className="text-xs font-bold" style={{ color: '#10B981' }}>
              Save Rs. {savings?.toLocaleString()}
              {discountPct > 0 && <span style={{ color:'#F97316' }}> ({discountPct}% OFF)</span>}
            </span>
          </div>
        )}
      </div>

      {/* ── v45 Timer Display Logic ──
          Priority rules:
          1. coming_soon + launch timer active → show ONLY launch countdown
             (customer sees discounted price but NOT the sale countdown)
          2. NOT coming_soon + sale timer active → show sale countdown
          3. Legacy countdown_ends_at fallback
      ── */}
      {isComingSoon && isLaunching && (
        <LaunchCountdownFull endAt={product.launch_at} label="🚀 Launching In" onExpire={handleDetailLaunchExpire} />
      )}
      {/* v45: sale countdown only visible AFTER coming_soon timer expires */}
      {!isComingSoon && !isLaunching && hasSaleTimer && (
        <CountdownFull endAt={product.sale_ends_at} label={product.countdown_label || 'Deal Ends In'} onExpire={handleSaleExpire} />
      )}
      {/* Legacy compat — old countdown_ends_at field */}
      {!isComingSoon && !isLaunching && !hasSaleTimer && hasLegacyCountdown && (
        <CountdownFull endAt={product.countdown_ends_at} label={product.countdown_label || 'Deal Ends In'} onExpire={handleSaleExpire} />
      )}

      {/* Order badge — social proof */}
      {ordersBadgeEnabled && product.show_order_count && (product.stock_complete ?? 0) > 0 && (
        <div style={{
          display:'inline-flex', alignItems:'center', gap:6,
          padding:'5px 14px', borderRadius:20, marginBottom:10,
          background:'linear-gradient(135deg,#EF444415,#F9731615)',
          border:'1.5px solid #F9731640', alignSelf:'flex-start',
        }}>
          <span style={{ fontSize:14 }}>🔥</span>
          <span style={{ fontSize:12, fontWeight:800, color:'#F97316' }}>
            {product.stock_complete} people ordered this
          </span>
        </div>
      )}

      {/* In Stock: qty + CTAs */}
      {inStock && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'var(--viro-textMuted)' }}>Qty:</span>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-lg font-bold flex items-center justify-center"
                style={{ color: 'var(--viro-text)' }}>−</button>
              <span className="w-7 text-center font-bold" style={{ color: 'var(--viro-text)' }}>{qty}</span>
              <button onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                className="w-7 h-7 rounded-lg font-bold flex items-center justify-center"
                style={{ color: 'var(--viro-text)' }}>+</button>
            </div>
          </div>

          {inStock && product.stock <= 5 && (
            <p className="text-xs font-semibold" style={{ color: '#F97316' }}>⚠️ Only {product.stock} left!</p>
          )}

          <button onClick={handleOrderNow}
            className="w-full py-4 rounded-2xl text-base font-bold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)', boxShadow: '0 4px 20px #8B5CF650' }}>
            ⚡ Order Now — Rs.{((displayPrice || 0) * qty).toLocaleString()}
          </button>

          <button onClick={handleAddToCart}
            className="w-full py-3.5 rounded-2xl text-base font-bold transition-all active:scale-95"
            style={added
              ? { background:'#10B98120', color:'#10B981', border:'2px solid #10B98150' }
              : { background:'transparent', color:'var(--viro-text)', border:'2px solid var(--viro-border)' }}>
            {added ? '✓ Added to Cart!' : '🛒 Add to Cart'}
          </button>

          {/* Wishlist toggle */}
          <button
            onClick={() => toggleWishlist(product)}
            className="w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
            style={isInWishlist(product.id)
              ? { background:'#FFF1F2', color:'#F43F5E', border:'1.5px solid #FECDD3' }
              : { background:'transparent', color:'var(--viro-textSub)', border:'1.5px solid var(--viro-border)' }}>
            {isInWishlist(product.id) ? '❤️ Saved to Wishlist' : '🤍 Save to Wishlist'}
          </button>
        </>
      )}

      {/* Out of Stock */}
      {isOutOfStock && (
        <div className="rounded-2xl p-4 text-center"
          style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
          <p className="text-base font-bold mb-1" style={{ color: 'var(--viro-text)' }}>😔 Currently Out of Stock</p>
          <p className="text-sm mb-3" style={{ color: 'var(--viro-textMuted)' }}>
            Book in advance via WhatsApp — we'll notify you when it's back!
          </p>
          <button type="button" onClick={() => openWhatsApp(waBookMsg, contact.whatsapp)}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-base font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
            💬 Book in Advance via WhatsApp
          </button>
        </div>
      )}
      {/* Wishlist — always visible on out-of-stock and coming-soon too */}
      {(isOutOfStock || isComingSoon) && (
        <button
          onClick={() => toggleWishlist(product)}
          className="w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
          style={isInWishlist(product.id)
            ? { background:'#FFF1F2', color:'#F43F5E', border:'1.5px solid #FECDD3' }
            : { background:'transparent', color:'var(--viro-textSub)', border:'1.5px solid var(--viro-border)' }}>
          {isInWishlist(product.id) ? '❤️ Saved to Wishlist' : '🤍 Save to Wishlist'}
        </button>
      )}

      {/* Coming Soon */}
      {isComingSoon && (
        <div className="rounded-2xl p-4 text-center"
          style={{ background: '#8B5CF610', border: '1px solid #8B5CF640' }}>
          <p className="text-2xl mb-1">🚀</p>
          <p className="text-base font-bold mb-1" style={{ color: '#A78BFA' }}>Coming Soon!</p>
          <p className="text-sm mb-3" style={{ color: 'var(--viro-textMuted)' }}>
            Launching soon — pre-register to be first!
          </p>
          <button type="button" onClick={() => openWhatsApp(waPreMsg, contact.whatsapp)}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-base font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
            💬 Pre-Register via WhatsApp
          </button>
        </div>
      )}

      {/* Reviews section */}
      <ProductReviews
        productId={product.id}
        productReviewsEnabled={product.reviews_enabled !== false}
      />

      {/* Delivery strip */}
      <div className="rounded-xl p-3" style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)' }}>
        <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>
          {(() => {
            const rules = deliveryRules || []
            const local  = rules.find(r => r.cities && !r.cities.includes('*'))
            const other  = rules.find(r => r.cities && r.cities.includes('*'))
            const charge = other?.charge ?? 150
            if (local) return `🚚 Free ${local.label} ≥ Rs.${local.freeThreshold?.toLocaleString()} · ${other?.label ?? 'Other cities'} ≥ Rs.${other?.freeThreshold?.toLocaleString() ?? 2500} · Otherwise Rs.${charge}`
            return `🚚 Free delivery ≥ Rs.${other?.freeThreshold?.toLocaleString() ?? 2500} · Otherwise Rs.${charge}`
          })()}
        </p>
      </div>

      {/* Description — simple text */}
      {product.description && (
        <div className="rounded-2xl p-4"
          style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--viro-textSub)' }}>
            Description
          </h3>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--viro-textMuted)' }}>
            {product.description}
          </p>
        </div>
      )}
    </div>
  )

  // ── Daraz-style rich details renderer ──────────────────────────────────────
  // product_details is a multiline string like:
  //   • Fabric: **Soft cotton jersey**
  //   • Sizes: **S, M, L, XL**
  // or plain bullet lines. Renders bold (**text**) inline.
  function RichDetails({ text }) {
    if (!text) return null
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    return (
      <div className="text-sm leading-relaxed" style={{ color: 'var(--viro-text)' }}>
        {lines.map((line, i) => {
          // Parse inline **bold**
          const parts = line.split(/(\*\*[^*]+\*\*)/g)
          const rendered = parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} style={{ color: 'var(--viro-text)', fontWeight: 700 }}>{p.slice(2,-2)}</strong>
              : <span key={j}>{p}</span>
          )
          // If line starts with •, -, or *, show as list item
          const isBullet = /^[•\-\*]\s/.test(line)
          return isBullet ? (
            <div key={i} className="flex gap-2 mb-1.5">
              <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-purple-500" style={{ marginTop: 7 }} />
              <span>{rendered.map((p, j) => {
                // Strip leading bullet char from first part
                if (j === 0 && typeof p.props?.children === 'string') {
                  return <span key={j}>{p.props.children.replace(/^[•\-\*]\s/, '')}</span>
                }
                return p
              })}</span>
            </div>
          ) : (
            <p key={i} className="mb-1.5">{rendered}</p>
          )
        })}
      </div>
    )
  }

  return (
    <div className="pb-10 slide-up" style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh' }}>
      <style>{`
        .pd-thumb { transition: all 0.18s; cursor: pointer; }
        .pd-thumb:hover { opacity: 0.85; transform: scale(1.03); }
        .pd-arrow { transition: background 0.15s, transform 0.15s; }
        .pd-arrow:hover { transform: scale(1.1); }
        .pd-arrow:active { transform: scale(0.94); }
      `}</style>

      {/* Breadcrumb: Home > Category > Sub > Product */}
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 overflow-x-auto mb-3"
        style={{ background: 'var(--viro-bgCard)', borderBottom: '1px solid var(--viro-border)' }}>
        <style>{`.bc-sep{color:var(--viro-textSub);font-size:11px;flex-shrink:0}.bc-link{font-size:12px;font-weight:600;white-space:nowrap;flex-shrink:0;color:var(--viro-textSub)}.bc-link:hover{color:var(--viro-text)}.bc-cur{font-size:12px;font-weight:700;white-space:nowrap;color:var(--viro-text);overflow:hidden;text-overflow:ellipsis}`}</style>
        <Link to="/" className="bc-link">Home</Link>
        <span className="bc-sep">›</span>
        <Link to="/shop" className="bc-link">Shop</Link>
        {product.categories?.parent && (
          <>
            <span className="bc-sep">›</span>
            <Link to={`/shop?cat=${product.categories.parent.id}`} className="bc-link">
              {product.categories.parent.icon} {product.categories.parent.name}
            </Link>
          </>
        )}
        {product.categories && (
          <>
            <span className="bc-sep">›</span>
            <Link to={product.categories.parent
              ? `/shop?cat=${product.categories.parent.id}&sub=${product.categories.id}`
              : `/shop?cat=${product.categories.id}`} className="bc-link">
              {product.categories.icon} {product.categories.name}
            </Link>
          </>
        )}
        <span className="bc-sep">›</span>
        <span className="bc-cur">{product.name}</span>
      </div>

      {/* ════════════════════════════════════════════
          MOBILE layout: image full-width top, info below
          DESKTOP layout: thumbnails left | image center | info right
      ════════════════════════════════════════════ */}

      {/* ── DESKTOP (md+): 3-column layout ── */}
      <div className="hidden md:flex gap-4 px-4 items-start">

        {/* Col 1: Thumbnail strip — vertical, shifted down, larger */}
        {imgList.length > 1 && (
          <div className="flex flex-col gap-2.5 flex-shrink-0 mt-10" style={{ width: 96 }}>
            {imgList.map((img, i) => (
              <div key={i} onClick={() => setActiveImg(i)}
                className="pd-thumb rounded-xl overflow-hidden border-2"
                style={{ width: 90, height: 90, flexShrink: 0,
                  borderColor: i === activeImg ? '#8B5CF6' : 'var(--viro-border)',
                  background: 'var(--viro-productWhite)',
                  boxShadow: i === activeImg ? '0 0 0 3px #8B5CF650' : 'none',
                  transition: 'all 0.18s' }}>
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Col 2: Main image */}
        <div className="flex-shrink-0 relative rounded-2xl overflow-hidden"
          style={{ width: 'clamp(300px, 45vw, 560px)', background: 'var(--viro-productWhite)' }}>
          <img src={imgList[activeImg]} alt={product.name}
            key={activeImg}
            className="w-full fade-in"
            style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'contain' }} />

          {hasDiscount && (
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)', fontSize: '11px' }}>
              -{discountPct}%
            </div>
          )}

          {imgList.length > 1 && (
            <>
              <button onClick={prevImg}
                className="pd-arrow absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold z-10"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>‹</button>
              <button onClick={nextImg}
                className="pd-arrow absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold z-10"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>›</button>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                {imgList.map((_, i) => (
                  <span key={i} className="rounded-full transition-all"
                    style={{ width: i === activeImg ? 16 : 6, height: 6,
                      background: i === activeImg ? '#8B5CF6' : 'rgba(139,92,246,0.3)' }} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Col 3: Info + buttons */}
        <div className="flex-1 min-w-0">
          <InfoPanel />
        </div>
      </div>

      {/* ── MOBILE: stacked layout ── */}
      <div className="md:hidden">

        {/* Full-width image — natural height, no forced square */}
        <div className="relative overflow-hidden w-full"
          style={{ background: 'var(--viro-productWhite)' }}>
          <img src={imgList[activeImg]} alt={product.name}
            key={activeImg}
            className="w-full fade-in"
            style={{ display: 'block', width: '100%', height: 'auto',
              maxHeight: '85vw', objectFit: 'cover', objectPosition: 'center' }} />

          {hasDiscount && (
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)', fontSize: '10px' }}>
              -{discountPct}%
            </div>
          )}

          {imgList.length > 1 && (
            <>
              <button onClick={prevImg}
                className="pd-arrow absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold z-10"
                style={{ background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(3px)' }}>‹</button>
              <button onClick={nextImg}
                className="pd-arrow absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold z-10"
                style={{ background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(3px)' }}>›</button>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                {imgList.map((_, i) => (
                  <span key={i} className="rounded-full transition-all"
                    style={{ width: i === activeImg ? 16 : 6, height: 6,
                      background: i === activeImg ? '#8B5CF6' : 'rgba(139,92,246,0.3)' }} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Horizontal thumbnail strip — mobile */}
        {imgList.length > 1 && (
          <div className="flex gap-1.5 px-3 pt-2 pb-1 overflow-x-auto scrollbar-hide">
            {imgList.map((img, i) => (
              <div key={i} onClick={() => setActiveImg(i)}
                className="pd-thumb flex-shrink-0 rounded-xl overflow-hidden border-2"
                style={{ width: 52, height: 52,
                  borderColor: i === activeImg ? '#8B5CF6' : 'var(--viro-border)',
                  background: 'var(--viro-productWhite)' }}>
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Info below image */}
        <div className="px-4 pt-3">
          <InfoPanel />
        </div>
      </div>

      {/* ── Product Details (Daraz-style) — shown below on all screens ── */}
      {(product.product_details || product.highlights) && (
        <div className="px-4 mt-4">
          <div className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--viro-border)', background: 'var(--viro-bgCard)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--viro-border)', background: 'var(--viro-sectionBg)' }}>
              <h2 className="font-bold text-base" style={{ color: 'var(--viro-text)' }}>Product details of {product.name}</h2>
            </div>
            <div className="px-4 py-4">
              {product.highlights && (
                <div className="mb-4 pb-4" style={{ borderBottom: product.product_details ? '1px solid var(--viro-border)' : 'none' }}>
                  <RichDetails text={product.highlights} />
                </div>
              )}
              {product.product_details && (
                <div>
                  <RichDetails text={product.product_details} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Recommended For You ── */}
      <RecommendedProducts categoryId={product.category_id} currentId={product.id} />
    </div>
  )
}

// ── Recommended Products (same category) ─────────────────────
function RecommendedProducts({ categoryId, currentId }) {
  const [products, setProducts] = useState([])
  const { contact, deliveryRules, ordersBadgeEnabled } = useSite()
  const { addToCart } = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    if (!categoryId) return
    supabase.from('products')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .neq('id', currentId)
      .limit(8)
      .then(({ data }) => setProducts(data || []))
  }, [categoryId, currentId])

  if (!products.length) return null

  return (
    <div className="px-4 md:px-8 pb-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-3 mt-6">
        <div className="flex-1 h-px" style={{ background: 'var(--viro-border)' }} />
        <p className="text-sm font-bold px-3" style={{ color: 'var(--viro-textSub)' }}>✨ Recommended For You</p>
        <div className="flex-1 h-px" style={{ background: 'var(--viro-border)' }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {products.map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  )
}
