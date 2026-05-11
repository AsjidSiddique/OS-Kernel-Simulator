import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { parseImages } from '../context/CartContext'
import { supabase } from '../lib/supabase'
import { getProductRatings, mergeRatings } from '../lib/productRatings'
import ProductCard from '../components/ProductCard'

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest',       icon: '🆕' },
  { value: 'price_asc',  label: 'Price ↑',      icon: '💸' },
  { value: 'price_desc', label: 'Price ↓',      icon: '💰' },
  { value: 'discount',   label: 'Best Deals',   icon: '🔥' },
  { value: 'name',       label: 'A → Z',        icon: '🔤' },
]

function useOutsideClick(ref, cb) {
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) cb() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [cb])
}

// ── CatGridCard defined BEFORE Shop to avoid hoisting error ──────────────────
function CatGridCard({ cat, count, subCount, onSelect, small }) {
  const isComingSoon = cat._effectiveStatus === 'coming_soon'
  const h = small ? 56 : 64
  return (
    <button onClick={onSelect} disabled={isComingSoon}
      className="text-left transition-all active:scale-95 w-full"
      style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--viro-bgCard)',
        border: isComingSoon ? '1.5px solid #F59E0B40' : '1.5px solid var(--viro-border)',
        opacity: isComingSoon ? 0.85 : 1, cursor: isComingSoon ? 'default' : 'pointer' }}>
      <div className="relative flex items-center justify-center"
        style={{ height: h, background: isComingSoon ? 'linear-gradient(135deg,#F59E0B12,transparent)' : 'linear-gradient(135deg,#8B5CF610,#7C3AED08)' }}>
        {cat.image_url
          ? <img src={cat.image_url} alt={cat.name} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity: isComingSoon?0.5:0.9 }} />
          : <span style={{ fontSize: small?24:30, filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>{cat.icon}</span>}
        {isComingSoon
          ? <div className="absolute inset-0 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.45)' }}>
              <span className="font-extrabold px-2 py-0.5 rounded-lg" style={{ background:'#F59E0B', color:'#1a1a1a', fontSize:10 }}>🚀 Soon</span>
            </div>
          : <div className="absolute top-1 right-1 font-black px-1.5 py-0.5 rounded-lg"
              style={{ background:'rgba(0,0,0,0.5)', color:'#fff', fontSize:9, backdropFilter:'blur(4px)' }}>
              {count}
            </div>
        }
      </div>
      <div className="px-1.5 py-1.5">
        <p className="font-extrabold leading-tight line-clamp-1" style={{ fontSize:11, color:'var(--viro-text)' }}>{cat.name}</p>
        <p style={{ fontSize:9, color: isComingSoon?'#F59E0B':'var(--viro-textSub)', marginTop:1 }}>
          {isComingSoon ? 'Coming soon' : (subCount>0?`${subCount} types · `:'') + `${count} items`}
        </p>
      </div>
    </button>
  )
}

function ListCard({ product }) {
  const hasDiscount = product.discount_price && product.discount_price < product.price
  const timerExpired = product.countdown_ends_at && new Date(product.countdown_ends_at) <= new Date()
  const effectiveHasDiscount = hasDiscount && !timerExpired
  const displayPrice = effectiveHasDiscount ? product.discount_price : product.price
  const discount = effectiveHasDiscount ? Math.round((1 - product.discount_price / product.price) * 100) : 0
  // Fix #13: Use shared parseImages for consistent image parsing
  const thumb = parseImages(product.images)[0] || null
  // isComingSoon = DB status only. launch_at only controls countdown display.
  const isComingSoon = product.status === 'coming_soon'
  const isSoldOut = !isComingSoon && (product.stock <= 0 || product.status === 'out_of_stock')
  const isLowStock = !isComingSoon && !isSoldOut && product.stock > 0 && product.stock <= 5
  const inStock = !isComingSoon && !isSoldOut

  // Status badge config
  const statusBadge = isComingSoon
    ? { label: '🚀 Coming Soon', bg: '#EDE9FE', color: '#7C3AED', border: '#DDD6FE' }
    : isSoldOut
    ? { label: 'Sold Out', bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' }
    : isLowStock
    ? { label: `⚠️ Only ${product.stock} left`, bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' }
    : { label: '✓ In Stock', bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' }

  return (
    <Link to={`/product/${product.id}`} className="list-card">
      <div className="relative flex-shrink-0" style={{ width: 90, height: 90 }}>
        <img src={thumb || 'https://placehold.co/90x90/F1F5F9/8B5CF6?text=Viro'} alt={product.name}
          style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 14 }} />
        {effectiveHasDiscount && (
          <span className="absolute top-1 left-1 text-white font-black px-1.5 py-0.5 rounded-lg"
            style={{ background: '#EF4444', fontSize: 10 }}>-{discount}%</span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          {product.categories && (
            <div className="flex items-center gap-1 mb-0.5">
              {product.categories.image_url
                ? <img src={product.categories.image_url} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                : <span style={{ fontSize: 11 }}>{product.categories.icon}</span>}
              <span className="text-xs font-bold" style={{ color: '#A78BFA' }}>{product.categories.name}</span>
            </div>
          )}
          <p className="font-bold text-sm leading-snug line-clamp-2" style={{ color: 'var(--viro-text)' }}>{product.name}</p>
          {product.description && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--viro-textSub)' }}>{product.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold text-base" style={{ color: '#7C3AED' }}>Rs.{displayPrice?.toLocaleString()}</span>
            {effectiveHasDiscount && <span className="line-through text-xs" style={{ color: '#94A3B8' }}>Rs.{product.price?.toLocaleString()}</span>}
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: statusBadge.bg, color: statusBadge.color, border: `1px solid ${statusBadge.border}` }}>
            {statusBadge.label}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── CatMarquee — animated auto-scrolling category row ───────────────────────
function CatItem({ cat, countForCat, selectParentCat }) {
  const isComingSoon = cat._effectiveStatus === 'coming_soon'
  const hasNoItems = countForCat(cat.id) === 0
  const disabled = isComingSoon || hasNoItems
  return (
    <button
      onClick={() => !disabled && selectParentCat(cat.id)}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-all active:scale-95"
      style={{ cursor: disabled ? 'default' : 'pointer', background: 'none', border: 'none', padding: 0, width: 72 }}>
      <div className="relative"
        style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden',
          border: '2.5px solid var(--viro-border)',
          background: 'var(--viro-bgCard)',
          opacity: disabled ? 0.5 : 1,
          boxShadow: disabled ? 'none' : '0 2px 8px rgba(0,0,0,0.12)' }}>
        {cat.image_url
          ? <img src={cat.image_url} alt={cat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 28 }}>{cat.icon}</div>
        }
        {isComingSoon && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.93)', paddingTop: 2, paddingBottom: 2 }}>
            <span style={{ color: '#1a1a1a', fontSize: 8, fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1.3 }}>SOON</span>
          </div>
        )}
      </div>
      <span className="text-center leading-tight line-clamp-2 font-semibold"
        style={{ fontSize: 10, color: disabled ? 'var(--viro-textSub)' : 'var(--viro-text)', width: '100%' }}>
        {cat.name}
      </span>
    </button>
  )
}

function CatMarquee({ parentCats, enrichedCats, countForCat, selectParentCat }) {
  const trackRef = useRef(null)
  const posRef   = useRef(0)       // current translateX (negative = scrolled right)
  const pausedRef = useRef(false)
  const rafRef   = useRef(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartPos = useRef(0)

  // sorted: active first, coming-soon after
  const sorted = [
    ...parentCats.filter(c => c._effectiveStatus === 'active'),
    ...parentCats.filter(c => c._effectiveStatus !== 'active'),
  ]

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const SPEED = 0.5 // px per frame

    function getMaxScroll() {
      return track.scrollWidth / 2  // duplicated, so half
    }

    function tick() {
      if (!pausedRef.current && !isDragging.current) {
        posRef.current -= SPEED
        if (Math.abs(posRef.current) >= getMaxScroll()) {
          posRef.current = 0 // seamless reset to start
        }
        track.style.transform = `translateX(${posRef.current}px)`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    // Pause on hover (desktop)
    const container = track.parentElement
    const onEnter = () => { pausedRef.current = true }
    const onLeave = () => { pausedRef.current = false }
    container.addEventListener('mouseenter', onEnter)
    container.addEventListener('mouseleave', onLeave)

    // Touch / drag support
    const onTouchStart = (e) => {
      pausedRef.current = true
      isDragging.current = true
      dragStartX.current = e.touches ? e.touches[0].clientX : e.clientX
      dragStartPos.current = posRef.current
    }
    const onTouchMove = (e) => {
      if (!isDragging.current) return
      const dx = (e.touches ? e.touches[0].clientX : e.clientX) - dragStartX.current
      const maxScroll = getMaxScroll()
      let newPos = dragStartPos.current + dx
      // clamp within infinite loop range
      if (newPos > 0) newPos = 0
      if (newPos < -maxScroll) newPos = -maxScroll
      posRef.current = newPos
      track.style.transform = `translateX(${newPos}px)`
    }
    const onTouchEnd = () => {
      isDragging.current = false
      // resume auto-scroll after 1.5s pause
      setTimeout(() => { pausedRef.current = false }, 1500)
    }
    const onMouseDown = (e) => {
      pausedRef.current = true
      isDragging.current = true
      dragStartX.current = e.clientX
      dragStartPos.current = posRef.current
      e.preventDefault()
    }
    const onMouseMove = (e) => {
      if (!isDragging.current) return
      const dx = e.clientX - dragStartX.current
      const maxScroll = getMaxScroll()
      let newPos = dragStartPos.current + dx
      if (newPos > 0) newPos = 0
      if (newPos < -maxScroll) newPos = -maxScroll
      posRef.current = newPos
      track.style.transform = `translateX(${newPos}px)`
    }
    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      setTimeout(() => { pausedRef.current = false }, 1500)
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove',  onTouchMove,  { passive: true })
    container.addEventListener('touchend',   onTouchEnd)
    container.addEventListener('mousedown',  onMouseDown)
    window.addEventListener('mousemove',     onMouseMove)
    window.addEventListener('mouseup',       onMouseUp)

    return () => {
      cancelAnimationFrame(rafRef.current)
      container.removeEventListener('mouseenter', onEnter)
      container.removeEventListener('mouseleave', onLeave)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove',  onTouchMove)
      container.removeEventListener('touchend',   onTouchEnd)
      container.removeEventListener('mousedown',  onMouseDown)
      window.removeEventListener('mousemove',     onMouseMove)
      window.removeEventListener('mouseup',       onMouseUp)
    }
  }, [parentCats.length])

  return (
    <div className="pt-3 pb-1">
      <p className="text-xs font-extrabold uppercase tracking-widest px-4 mb-2" style={{ color: 'var(--viro-textSub)' }}>Categories</p>
      {/* Overflow hidden — track slides inside */}
      <div style={{ overflow: 'hidden', paddingBottom: 8, cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none' }}>
        {/* Track — duplicated for seamless loop */}
        <div ref={trackRef} className="flex gap-3 will-change-transform" style={{ width: 'max-content', paddingLeft: 12 }}>
          {/* First copy */}
          {sorted.map(cat => (
            <CatItem key={`a-${cat.id}`} cat={cat} countForCat={countForCat} selectParentCat={selectParentCat} />
          ))}
          {/* Duplicate for seamless loop */}
          {sorted.map(cat => (
            <CatItem key={`b-${cat.id}`} cat={cat} countForCat={countForCat} selectParentCat={selectParentCat} />
          ))}
        </div>
      </div>
      <div className="px-4 pt-1 pb-1">
        <div style={{ height: 1, background: 'var(--viro-border)' }} />
        <p className="text-xs font-extrabold uppercase tracking-widest mt-3 mb-1" style={{ color: 'var(--viro-textSub)' }}>All Products</p>
      </div>
    </div>
  )
}

// ── Main Shop component ────────────────────────────────────────────────────────
export default function Shop() {
  const [products,     setProducts]     = useState([])
  const [categories,   setCategories]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [searchParams] = useSearchParams()
  const [activeCat,    setActiveCat]    = useState(() => searchParams.get('cat') || 'all')
  const [activeSubCat, setActiveSubCat] = useState(() => searchParams.get('sub') || 'all')
  const [sortBy,       setSortBy]       = useState('newest')
  const [minPrice,     setMinPrice]     = useState('')
  const [maxPrice,     setMaxPrice]     = useState('')
  const [onlyDeals,    setOnlyDeals]    = useState(false)
  const [onlyInStock,  setOnlyInStock]  = useState(false)
  const [gridCols,     setGridCols]     = useState(2)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [visibleCount, setVisibleCount] = useState(12)
  const sentinelRef = useRef()
  const drawerRef = useRef()
  useOutsideClick(drawerRef, useCallback(() => setDrawerOpen(false), []))
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order')
      .then(({ data }) => setCategories(data || []))
    const load = () =>
      supabase.from('products').select('*, categories(id,name,icon,image_url,parent_id,status,is_visible)')
        .eq('is_active', true).order('created_at', { ascending: false })
        .then(({ data }) => { setProducts(data || []); setLoading(false) })
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(12) }, [search, activeCat, activeSubCat, sortBy, minPrice, maxPrice, onlyDeals, onlyInStock])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  // ── Category visibility logic ──────────────────────────────────────────────
  // For each category, compute its "effective status" considering:
  //   1. If parent is hidden → child is hidden
  //   2. If parent is coming_soon → child is coming_soon (unless already hidden)
  //   3. If category has no sort_order (null/0) → auto-hidden (not shown)
  //   4. If category has no products and no coming_soon override → coming_soon
  //   5. The admin-set status takes priority for individual overrides

  function getRawProductCount(catId) {
    const childIds = categories.filter(c => c.parent_id === catId).map(c => c.id)
    return products.filter(p => p.category_id === catId || childIds.includes(p.category_id)).length
  }

  function getEffectiveStatus(cat) {
    // Hidden if admin explicitly hid it
    if (cat.status === 'hidden' || cat.is_visible === false) return 'hidden'

    // Check parent status — parent hidden/coming_soon cascades down
    if (cat.parent_id) {
      const parent = categories.find(c => c.id === cat.parent_id)
      if (parent) {
        const parentStatus = getEffectiveStatus(parent)
        if (parentStatus === 'hidden') return 'hidden'
        if (parentStatus === 'coming_soon' && cat.status !== 'active') return 'coming_soon'
      }
    }

    // If no sort_order set (null), treat as hidden until admin orders it
    if (cat.sort_order === null || cat.sort_order === undefined) return 'hidden'

    // If admin explicitly set coming_soon, honour it
    if (cat.status === 'coming_soon') return 'coming_soon'

    // If no products, auto show as coming_soon
    const count = getRawProductCount(cat.id)
    if (count === 0) return 'coming_soon'

    return 'active'
  }

  // Build enriched category list with effective status
  const enrichedCats = categories.map(cat => ({
    ...cat,
    _effectiveStatus: getEffectiveStatus(cat),
  }))

  // Only visible or coming_soon categories shown in shop (hidden = fully invisible)
  const visibleCats = enrichedCats.filter(c => c._effectiveStatus !== 'hidden')
  const parentCats  = visibleCats.filter(c => !c.parent_id)
  const subCats     = (parentId) => visibleCats.filter(c => c.parent_id === parentId)
  const activeParent = parentCats.find(c => c.id === activeCat)
  const activeSubs   = activeParent ? subCats(activeParent.id) : []

  // Count active (purchasable) products for a category
  function countForCat(catId) {
    const cat = enrichedCats.find(c => c.id === catId)
    if (!cat) return 0
    const catStatus = cat._effectiveStatus

    // If category is coming_soon, count only individually-visible products
    if (catStatus === 'coming_soon') {
      const childIds = enrichedCats.filter(c => c.parent_id === catId && c._effectiveStatus !== 'hidden').map(c => c.id)
      // Products individually marked active in a coming_soon cat show as purchasable
      return products.filter(p =>
        (p.category_id === catId || childIds.includes(p.category_id)) &&
        p.status === 'active' && p.is_active
      ).length
    }

    const childIds = enrichedCats.filter(c => c.parent_id === catId && c._effectiveStatus !== 'hidden').map(c => c.id)
    return products.filter(p => p.category_id === catId || childIds.includes(p.category_id)).length
  }

  // ── Product visibility logic ───────────────────────────────────────────────
  // A product is visible if:
  //   - Its category is not hidden
  //   - If category is coming_soon, only show product if product.status === 'active' (individually overridden)
  //   - If category is active, show product normally
  function isProductVisible(product) {
    const cat = enrichedCats.find(c => c.id === product.category_id)
    if (!cat) return false // no category = hidden
    const catStatus = cat._effectiveStatus
    if (catStatus === 'hidden') return false
    if (catStatus === 'coming_soon') {
      // Only show if product is individually marked active/visible
      return product.status === 'active' && product.is_active !== false
    }
    return true
  }

  const getDisplayPrice = p => (p.discount_price && p.discount_price < p.price) ? p.discount_price : p.price

  const filtered = products
    .filter(p => {
      if (!isProductVisible(p)) return false
      if (search && !(p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase()))) return false

      if (activeCat !== 'all') {
        if (activeSubCat !== 'all') {
          if (p.category_id !== activeSubCat) return false
        } else {
          const childIds = enrichedCats.filter(c => c.parent_id === activeCat).map(c => c.id)
          if (p.category_id !== activeCat && !childIds.includes(p.category_id)) return false
        }
      }

      const dp = getDisplayPrice(p)
      if (minPrice !== '' && dp < Number(minPrice)) return false
      if (maxPrice !== '' && dp > Number(maxPrice)) return false
      if (onlyDeals && !(p.discount_price && p.discount_price < p.price)) return false
      if (onlyInStock) {
        if (p.stock <= 0 || p.status === 'out_of_stock' || p.status === 'coming_soon') return false
      }
      return true
    })
    .sort((a, b) => {
      const pa = getDisplayPrice(a), pb = getDisplayPrice(b)
      if (sortBy === 'price_asc')  return pa - pb
      if (sortBy === 'price_desc') return pb - pa
      if (sortBy === 'discount') {
        const da = a.discount_price && a.price ? (a.price - a.discount_price) / a.price : 0
        const db = b.discount_price && b.price ? (b.price - b.discount_price) / b.price : 0
        return db - da
      }
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      return new Date(b.created_at) - new Date(a.created_at)
    })

  const activeFilterCount =
    (activeCat !== 'all' ? 1 : 0) + (activeSubCat !== 'all' ? 1 : 0) +
    (minPrice !== '' ? 1 : 0) + (maxPrice !== '' ? 1 : 0) +
    (onlyDeals ? 1 : 0) + (onlyInStock ? 1 : 0)

  function resetFilters() {
    setActiveCat('all'); setActiveSubCat('all')
    setMinPrice(''); setMaxPrice('')
    setOnlyDeals(false); setOnlyInStock(false); setSortBy('newest')
  }

  function selectParentCat(id) {
    setActiveCat(id === activeCat ? 'all' : id)
    setActiveSubCat('all')
  }

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisibleCount(n => n + 12)
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [filtered.length])

  return (
    <div style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh', paddingBottom: 96 }}>
      <style>{`
        .sb::-webkit-scrollbar{display:none}.sb{-ms-overflow-style:none;scrollbar-width:none}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeBg{from{opacity:0}to{opacity:1}}
        .drawer-panel{animation:slideUp 0.28s cubic-bezier(.32,0,.15,1)}
        .drawer-bg{animation:fadeBg 0.22s ease}
        .cat-img-pill{flex-shrink:0;display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:40px;font-size:13px;font-weight:700;white-space:nowrap;cursor:pointer;transition:all 0.18s;border:2px solid transparent}
        .cat-img-pill.on{background:linear-gradient(135deg,#8B5CF6,#7C3AED);color:#fff;box-shadow:0 3px 12px rgba(139,92,246,0.4)}
        .cat-img-pill.off{background:var(--viro-bgCard);color:var(--viro-textSub);border-color:var(--viro-border)}
        .sub-pill{flex-shrink:0;padding:5px 14px;border-radius:30px;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer;transition:all 0.15s;border:1.5px solid transparent}
        .sub-pill.on{background:#00BFFF;color:#0B1221;border-color:transparent}
        .sub-pill.off{background:var(--viro-bgCard);color:var(--viro-textSub);border-color:var(--viro-border)}
        .sort-chip{flex-shrink:0;display:flex;align-items:center;gap:5px;padding:7px 13px;border-radius:30px;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.15s}
        .sort-chip.on{background:#00BFFF;color:#0B1221}
        .sort-chip.off{background:var(--viro-bgCard);color:var(--viro-textSub);border:1.5px solid var(--viro-border)}
        .toggle-track{width:44px;height:24px;border-radius:12px;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0}
        .toggle-thumb{position:absolute;top:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform 0.2s cubic-bezier(.4,0,.2,1);box-shadow:0 1px 4px rgba(0,0,0,0.3)}
        .filter-tag{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#8B5CF620;color:#A78BFA;border:1px solid #8B5CF640;cursor:pointer}
        .cat-grid-card{position:relative;border-radius:18px;overflow:hidden;cursor:pointer;transition:all 0.2s;aspect-ratio:1}
        .cat-grid-card:hover{transform:scale(1.03);box-shadow:0 6px 20px rgba(0,0,0,0.3)}
        .cat-grid-card.selected{box-shadow:0 0 0 3px #8B5CF6,0 6px 20px rgba(139,92,246,0.4)}
        .list-card{display:flex;gap:12px;padding:12px;border-radius:16px;background:var(--viro-bgCard);border:1px solid var(--viro-border);text-decoration:none}
        @media(min-width:768px){
          .pc-header-title{font-size:15px!important;padding-top:8px!important;padding-bottom:4px!important}
          .pc-search-row{padding-bottom:4px!important}
          .pc-sort-row{padding-bottom:4px!important}
          .pc-cat-row{padding-bottom:4px!important}
          .sort-chip{padding:4px 10px!important;font-size:11px!important}
          .cat-img-pill{padding:4px 10px 4px 4px!important;font-size:11px!important;gap:5px!important}
          .sub-pill{padding:3px 10px!important;font-size:11px!important}
        }
      `}</style>

      {/* ══ STICKY HEADER ══════════════════════════════════════════ */}
      <div className="sticky top-9 z-30" style={{ background: 'var(--viro-searchBg)', borderBottom: '1px solid var(--viro-border)' }}>

        {/* Title + count + grid toggle */}
        <div className="pc-header-title flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="font-display text-xl font-extrabold" style={{ color: 'var(--viro-text)' }}>Shop</h1>
          <div className="flex items-center gap-2">
            {!loading && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: '#8B5CF615', color: '#A78BFA', border: '1px solid #8B5CF630' }}>
                {filtered.length} items
              </span>
            )}
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--viro-border)' }}>
              {[2, 1].map(n => (
                <button key={n} onClick={() => setGridCols(n)}
                  className="w-8 h-8 flex items-center justify-center transition-all"
                  style={gridCols === n ? { background: '#8B5CF6', color: '#fff' } : { background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)' }}>
                  {n === 2
                    ? <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="0" y="0" width="5.5" height="5.5" rx="1"/><rect x="7.5" y="0" width="5.5" height="5.5" rx="1"/><rect x="0" y="7.5" width="5.5" height="5.5" rx="1"/><rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="0" y="0" width="13" height="3.5" rx="1"/><rect x="0" y="4.75" width="13" height="3.5" rx="1"/><rect x="0" y="9.5" width="13" height="3.5" rx="1"/></svg>
                  }
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search + Filter button */}
        <div className="pc-search-row flex gap-2 px-4 pb-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--viro-textSub)', fontSize: 15 }}>🔍</span>
            <input type="search" placeholder="Search products…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2.4rem', paddingRight: search ? '2rem' : '1rem', borderRadius: 30 }} />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none"
                style={{ color: 'var(--viro-textSub)' }}>×</button>
            )}
          </div>
          <button onClick={() => setDrawerOpen(true)}
            className="relative flex items-center gap-1.5 px-4 rounded-3xl font-bold text-sm flex-shrink-0 transition-all"
            style={activeFilterCount > 0
              ? { background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', boxShadow: '0 3px 12px rgba(139,92,246,0.35)' }
              : { background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)' }}>
            <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
              <rect x="0" y="0" width="14" height="2" rx="1"/><rect x="2" y="5" width="10" height="2" rx="1"/><rect x="4" y="10" width="6" height="2" rx="1"/>
            </svg>
            Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center font-black text-white"
                style={{ background: '#EF4444', fontSize: 10 }}>{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Sort chips */}
        <div className="pc-sort-row flex gap-2 px-4 pb-2 overflow-x-auto sb">
          {SORT_OPTIONS.map(s => (
            <button key={s.value} onClick={() => setSortBy(s.value)}
              className={`sort-chip ${sortBy === s.value ? 'on' : 'off'}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Category pills with images — only active categories (not coming_soon) in pills */}
        {parentCats.filter(c => c._effectiveStatus === 'active').length > 0 && (
          <div className="pc-cat-row flex gap-2 px-4 pb-2 overflow-x-auto sb">
            <button onClick={() => { setActiveCat('all'); setActiveSubCat('all') }}
              className={`cat-img-pill ${activeCat === 'all' ? 'on' : 'off'}`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: activeCat === 'all' ? 'rgba(255,255,255,0.2)' : 'var(--viro-border)', fontSize: 16 }}>🏷️</div>
              All
            </button>

            {parentCats.filter(c => c._effectiveStatus === 'active').map(cat => {
              const count = countForCat(cat.id)
              const isOn = activeCat === cat.id
              return (
                <button key={cat.id} onClick={() => selectParentCat(cat.id)}
                  className={`cat-img-pill ${isOn ? 'on' : 'off'}`}>
                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ background: isOn ? 'rgba(255,255,255,0.2)' : 'var(--viro-border)' }}>
                    {cat.image_url
                      ? <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                      : <span style={{ fontSize: 16 }}>{cat.icon}</span>
                    }
                  </div>
                  {cat.name}
                  <span style={{ opacity: 0.65, fontWeight: 400, fontSize: 11 }}>({count})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Sub-category pills */}
        {activeSubs.filter(c => c._effectiveStatus === 'active').length > 0 && (
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto sb">
            <button onClick={() => setActiveSubCat('all')}
              className={`sub-pill ${activeSubCat === 'all' ? 'on' : 'off'}`}>
              All {activeParent?.name}
            </button>
            {activeSubs.filter(c => c._effectiveStatus === 'active').map(sub => {
              const count = products.filter(p => p.category_id === sub.id && isProductVisible(p)).length
              if (!count) return null
              return (
                <button key={sub.id} onClick={() => setActiveSubCat(activeSubCat === sub.id ? 'all' : sub.id)}
                  className={`sub-pill ${activeSubCat === sub.id ? 'on' : 'off'}`}>
                  {sub.image_url
                    ? <img src={sub.image_url} alt={sub.name} className="inline-block w-4 h-4 rounded-full object-cover mr-1" />
                    : <span className="mr-1">{sub.icon}</span>
                  }
                  {sub.name}
                  <span style={{ opacity: 0.6, fontWeight: 400 }}> ({count})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="flex gap-2 px-4 pb-2 flex-wrap">
            {activeCat !== 'all' && (() => { const c = parentCats.find(x => x.id === activeCat); return c ? (
              <span className="filter-tag" onClick={() => { setActiveCat('all'); setActiveSubCat('all') }}>{c.icon} {c.name} ✕</span>
            ) : null })()}
            {activeSubCat !== 'all' && (() => { const c = enrichedCats.find(x => x.id === activeSubCat); return c ? (
              <span className="filter-tag" onClick={() => setActiveSubCat('all')}>{c.icon} {c.name} ✕</span>
            ) : null })()}
            {onlyDeals    && <span className="filter-tag" onClick={() => setOnlyDeals(false)}>🔥 On Sale ✕</span>}
            {onlyInStock  && <span className="filter-tag" onClick={() => setOnlyInStock(false)}>✅ In Stock ✕</span>}
            {minPrice !== '' && <span className="filter-tag" onClick={() => setMinPrice('')}>Min Rs.{minPrice} ✕</span>}
            {maxPrice !== '' && <span className="filter-tag" onClick={() => setMaxPrice('')}>Max Rs.{maxPrice} ✕</span>}
            <button onClick={resetFilters} className="filter-tag" style={{ background: '#EF444415', color: '#F87171', border: '1px solid #EF444430' }}>
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* ══ CATEGORY CIRCLES — animated auto-scroll marquee ═══════ */}
      {!loading && activeCat === 'all' && !search && parentCats.length > 0 && (
        <CatMarquee
          parentCats={parentCats}
          enrichedCats={enrichedCats}
          countForCat={countForCat}
          selectParentCat={selectParentCat}
        />
      )}

      {/* ══ PRODUCTS with infinite scroll ═══════════════════════════ */}
      <div className="px-4 pt-1 pb-6">
        {loading ? (
          <div className={`grid gap-2 sm:gap-3 ${gridCols === 2 ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ background: 'var(--viro-productWhite)' }}>
                <div style={{ paddingTop:'72%', position:'relative' }} className="skeleton" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" /><div className="skeleton h-3 w-1/2 rounded" />
                  <div className="skeleton h-8 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div style={{ fontSize: 52 }}>🛍️</div>
            <p className="font-bold text-base" style={{ color: 'var(--viro-text)' }}>No products found</p>
            <p className="text-sm" style={{ color: 'var(--viro-textSub)' }}>Try adjusting filters or search</p>
            <button onClick={resetFilters} className="mt-1 px-6 py-2.5 rounded-full text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' }}>Reset Filters</button>
          </div>
        ) : (
          <>
            {gridCols === 2 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                {filtered.slice(0, visibleCount).map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.slice(0, visibleCount).map(p => <ListCard key={p.id} product={p} />)}
              </div>
            )}
            {/* Infinite scroll sentinel */}
            {visibleCount < filtered.length && (
              <div ref={sentinelRef} className="flex justify-center py-6">
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--viro-textSub)' }}>
                  <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  Loading more…
                </div>
              </div>
            )}
            {visibleCount >= filtered.length && filtered.length > 12 && (
              <p className="text-center text-xs py-4" style={{ color: 'var(--viro-textSub)' }}>
                ✅ All {filtered.length} products loaded
              </p>
            )}
          </>
        )}
      </div>

      {/* ══ FILTER DRAWER ═════════════════════════════════════════ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[200]">
          <div className="drawer-bg absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setDrawerOpen(false)} />

          <div ref={drawerRef}
            className="drawer-panel absolute bottom-0 left-0 right-0 flex flex-col rounded-t-3xl overflow-hidden"
            style={{ background: 'var(--viro-bg)', maxHeight: '92vh', boxShadow: '0 -8px 40px rgba(0,0,0,0.4)' }}>

            <div className="flex justify-center pt-3 pb-1">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--viro-border)' }} />
            </div>

            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--viro-border)' }}>
              <div>
                <h2 className="font-extrabold text-base" style={{ color: 'var(--viro-text)' }}>Filters</h2>
                {activeFilterCount > 0 && <p className="text-xs" style={{ color: '#A78BFA' }}>{activeFilterCount} active</p>}
              </div>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="text-xs font-bold" style={{ color: '#EF4444' }}>Reset all</button>
                )}
                <button onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)' }}>✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Sort */}
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--viro-border)' }}>
                <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--viro-textSub)' }}>Sort By</p>
                <div className="grid grid-cols-2 gap-2">
                  {SORT_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => setSortBy(s.value)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-bold text-left transition-all"
                      style={sortBy === s.value
                        ? { background: '#8B5CF6', color: '#fff', boxShadow: '0 3px 10px rgba(139,92,246,0.35)' }
                        : { background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)' }}>
                      <span style={{ fontSize: 16 }}>{s.icon}</span>
                      <span className="text-xs">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Category in drawer — horizontal scroll row, active only */}
              {parentCats.filter(c => c._effectiveStatus === 'active').length > 0 && (
                <div className="py-4" style={{ borderBottom: '1px solid var(--viro-border)' }}>
                  <p className="text-xs font-extrabold uppercase tracking-widest mb-3 px-5" style={{ color: 'var(--viro-textSub)' }}>Category</p>
                  <div className="overflow-x-auto sb" style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 4 }}>
                    <div className="flex gap-3" style={{ width: 'max-content' }}>
                      {/* All button */}
                      <button onClick={() => { setActiveCat('all'); setActiveSubCat('all') }}
                        className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-all active:scale-95"
                        style={{ background: 'none', border: 'none', padding: 0, width: 64 }}>
                        <div className="flex items-center justify-center"
                          style={{ width: 56, height: 56, borderRadius: '50%', fontSize: 26,
                            background: activeCat === 'all' ? '#8B5CF6' : 'var(--viro-bgCard)',
                            border: activeCat === 'all' ? '2.5px solid #8B5CF6' : '2px solid var(--viro-border)',
                            boxShadow: activeCat === 'all' ? '0 3px 12px rgba(139,92,246,0.4)' : 'none' }}>
                          🏷️
                        </div>
                        <span className="text-center font-bold" style={{ fontSize: 10, color: activeCat === 'all' ? '#8B5CF6' : 'var(--viro-text)', width: 64 }}>All</span>
                      </button>

                      {parentCats.filter(c => c._effectiveStatus === 'active').map(cat => {
                        const count = countForCat(cat.id)
                        const isOn = activeCat === cat.id
                        return (
                          <button key={cat.id} onClick={() => selectParentCat(cat.id)}
                            className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-all active:scale-95"
                            style={{ background: 'none', border: 'none', padding: 0, width: 64, opacity: count ? 1 : 0.4 }}>
                            <div className="relative overflow-hidden"
                              style={{ width: 56, height: 56, borderRadius: '50%',
                                border: isOn ? '2.5px solid #8B5CF6' : '2px solid var(--viro-border)',
                                background: isOn ? '#8B5CF615' : 'var(--viro-bgCard)',
                                boxShadow: isOn ? '0 3px 12px rgba(139,92,246,0.35)' : '0 1px 4px rgba(0,0,0,0.08)' }}>
                              {cat.image_url
                                ? <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 26 }}>{cat.icon}</div>
                              }
                            </div>
                            <span className="text-center leading-tight line-clamp-2 font-semibold"
                              style={{ fontSize: 10, color: isOn ? '#8B5CF6' : 'var(--viro-text)', width: 64 }}>
                              {cat.name}
                              {count > 0 && <span style={{ color: isOn ? '#A78BFA' : 'var(--viro-textSub)', display: 'block', fontSize: 9 }}>{count}</span>}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {activeSubs.filter(c => c._effectiveStatus === 'active').length > 0 && (
                    <div>
                      <p className="text-xs font-bold mb-2" style={{ color: 'var(--viro-textSub)' }}>
                        {activeParent?.icon} {activeParent?.name} — Sub-categories
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setActiveSubCat('all')}
                          className="sub-pill" style={activeSubCat==='all'?{background:'#00BFFF',color:'#0B1221'}:{background:'var(--viro-bgCard)',color:'var(--viro-textSub)',border:'1.5px solid var(--viro-border)'}}>
                          All
                        </button>
                        {activeSubs.filter(c => c._effectiveStatus === 'active').map(sub => {
                          const cnt = products.filter(p => p.category_id === sub.id && isProductVisible(p)).length
                          if (!cnt) return null
                          return (
                            <button key={sub.id} onClick={() => setActiveSubCat(activeSubCat===sub.id?'all':sub.id)}
                              className="sub-pill" style={activeSubCat===sub.id?{background:'#00BFFF',color:'#0B1221'}:{background:'var(--viro-bgCard)',color:'var(--viro-textSub)',border:'1.5px solid var(--viro-border)'}}>
                              {sub.icon} {sub.name} ({cnt})
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Price range */}
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--viro-border)' }}>
                <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--viro-textSub)' }}>Price Range (Rs.)</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--viro-textSub)' }}>Min</label>
                    <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)}
                      placeholder="Rs. 0" min={0} style={{ borderRadius: 14, fontSize: 14 }} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--viro-textSub)' }}>Max</label>
                    <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                      placeholder="Any" min={0} style={{ borderRadius: 14, fontSize: 14 }} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[['Under 1k','','1000'],['1k–3k','1000','3000'],['3k–5k','3000','5000'],['5k+','5000','']].map(([lbl,mn,mx]) => (
                    <button key={lbl} onClick={() => { setMinPrice(mn); setMaxPrice(mx) }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={minPrice===mn&&maxPrice===mx
                        ? { background: '#8B5CF6', color: '#fff' }
                        : { background: 'var(--viro-bgCard)', color: 'var(--viro-textSub)', border: '1px solid var(--viro-border)' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="px-5 py-4">
                <p className="text-xs font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--viro-textSub)' }}>More</p>
                {[
                  { label: '🔥 On Sale Only', sub: 'Discounted products only', val: onlyDeals, set: setOnlyDeals, color: '#F97316' },
                  { label: '✅ In Stock Only', sub: 'Hide sold-out items', val: onlyInStock, set: setOnlyInStock, color: '#10B981' },
                ].map(t => (
                  <div key={t.label} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--viro-border)' }}>
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--viro-text)' }}>{t.label}</p>
                      <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>{t.sub}</p>
                    </div>
                    <div className="toggle-track" onClick={() => t.set(v => !v)}
                      style={{ background: t.val ? t.color : 'var(--viro-border)' }}>
                      <div className="toggle-thumb" style={{ transform: t.val ? 'translateX(20px)' : 'translateX(0)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-4" style={{ borderTop: '1px solid var(--viro-border)' }}>
              <button onClick={() => setDrawerOpen(false)}
                className="w-full py-4 rounded-2xl font-extrabold text-base text-white"
                style={{ background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', boxShadow: '0 4px 16px rgba(139,92,246,0.35)' }}>
                Show {filtered.length} Result{filtered.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
