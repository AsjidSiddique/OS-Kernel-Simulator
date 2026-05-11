import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ProductImage from '../components/ProductImage'
import { useCart } from '../context/CartContext'
import { supabase } from '../lib/supabase'
import { sendOrderEmail } from '../lib/email'
import { showSimpleToast } from '../components/Toast'
import { openWhatsApp } from '../lib/whatsapp'
import { PK_CITIES } from '../lib/pakistanCities'
import { useSite } from '../context/SiteSettingsContext'
import { validateCoupon, redeemCoupon } from '../lib/couponApi'

const STORAGE_KEY = 'viro_user_info'
function loadSaved() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} } }

function calcTotal(items) {
  return items.reduce((s, i) => s + (i.discount_price || i.price) * (i.quantity || 1), 0)
}

// Pakistani phone validator: 03XXXXXXXXX (11 digits) or 923XXXXXXXXX (12 digits)
function validatePkPhone(phone) {
  const digits = phone.replace(/[\s\-()]/g, '')
  if (digits.startsWith('92') && digits.length === 12) return true
  if (digits.startsWith('03') && digits.length === 11) return true
  return false
}

function CityAutocomplete({ value, onChange, isValid }) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)
  const ref = useRef()

  const filtered = query.length > 0
    ? PK_CITIES.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function pick(city) { setQuery(city); onChange(city); setOpen(false) }

  // Determine if we should show red border: typed something but not a valid city
  const showError = query.trim().length >= 2 && isValid === false

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Type city name…"
        autoComplete="off"
        required
        style={showError ? { borderColor: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.15)' } : {}}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', borderRadius: 12,
          marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
        }}>
          {filtered.map(city => (
            <button key={city} type="button"
              onMouseDown={() => pick(city)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', fontSize: 13, color: 'var(--viro-text)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid var(--viro-border)',
                transition: 'background 0.12s'
              }}
              onMouseEnter={e => e.target.style.background = 'var(--viro-bgDeep)'}
              onMouseLeave={e => e.target.style.background = 'transparent'}>
              📍 {city}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Checkout() {
  const { contact, getDeliveryCharge, deliveryRules, couponEnabled } = useSite()
  const { cart, cartTotal, clearCart, refreshCartPrices } = useCart()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // v46: refresh cart prices on mount so stale discounts are corrected before checkout
  useEffect(() => {
    refreshCartPrices(supabase)
  }, [])
  const emailRef = useRef(null)
  const cityRef  = useRef(null)
  const isQuick = searchParams.get('quick') === '1'

  // Fix #7: Lazy initializer guarantees snapshotCart is correct on first render (no race)
  const [snapshotCart] = useState(() => {
    if (isQuick) {
      try {
        const q = JSON.parse(sessionStorage.getItem('viro_quick_order') || 'null')
        if (q && q.length > 0) return q
      } catch {}
    }
    return cart
  })

  const quickItems = isQuick && snapshotCart !== cart ? snapshotCart : null
  const activeCartItems = quickItems || cart
  const activeCartTotal = quickItems ? calcTotal(quickItems) : cartTotal

  // Snapshot totals at mount so they survive clearCart
  const [snapshotTotal] = useState(() =>
    isQuick ? calcTotal(snapshotCart) : cartTotal
  )

  const saved = loadSaved()
  const [form, setForm] = useState({
    name:    saved.name    || '',
    phone:   saved.phone   || '',
    email:   saved.email   || '',
    city:    saved.city    || '',
    address: saved.address || '',
  })
  const [step, setStep]       = useState('form')
  const [loading, setLoading]   = useState(false)
  const [orderId, setOrderId]   = useState(null)
  const [frozenOrderValues, setFrozenOrderValues] = useState(null)
  const [couponCode,    setCouponCode]    = useState('')
  const [couponResult,  setCouponResult]  = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)

  // Use snapshot for review/success display
  const activeCart  = step === 'form' ? activeCartItems : snapshotCart
  const activeTotal = step === 'form' ? activeCartTotal  : snapshotTotal

  const cityLower      = form.city.trim().toLowerCase()
  const localRules     = deliveryRules || []
  const isBurewala     = cityLower === 'burewala'
  // Live rule match for current city — used for all delivery text display
  const cityRule = React.useMemo(() => {
    if (!cityLower || !deliveryRules?.length) return null
    return deliveryRules.find(r => r.cities?.includes(cityLower))
        || deliveryRules.find(r => r.cities?.includes('*'))
        || null
  }, [cityLower, deliveryRules])
  // Fix #5: Soft validation — any city ≥3 chars is accepted. PK_CITIES list is just an autocomplete helper.
  const isCityKnown    = form.city.trim().length >= 2 && PK_CITIES.some(c => c.toLowerCase() === cityLower)
  const isCityValid    = form.city.trim().length >= 3  // only block if truly too short
  const isPhoneValid   = form.phone.trim().length === 0 ? null : validatePkPhone(form.phone)
  const couponDiscount = couponResult?.valid ? (couponResult.discount || 0) : 0
  const discountedTotal = Math.max(0, activeTotal - couponDiscount)
  const deliveryCharge = form.city.trim() ? getDeliveryCharge(form.city.trim(), discountedTotal) : 150
  const isFree         = deliveryCharge === 0
  const finalTotal     = discountedTotal + deliveryCharge

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    const result = await validateCoupon(couponCode, activeTotal)
    setCouponResult(result)
    setCouponLoading(false)
  }

  function removeCoupon() {
    setCouponCode('')
    setCouponResult(null)
  }

  function goToReview(e) {
    e.preventDefault()
    // Scroll to first empty required field
    if (!form.email) {
      emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      emailRef.current?.querySelector('input')?.focus()
      return
    }
    if (!form.name || !form.phone || !form.city || !form.address) return
    if (isPhoneValid === false) {
      showSimpleToast('⚠️ Enter a valid Pakistani number: 03XXXXXXXXX or 923XXXXXXXXX', 'info')
      return
    }
    // Allow any city ≥3 chars (Fix #5 — soft validation only)
    if (form.city.trim().length < 3) {
      cityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      showSimpleToast('⚠️ Please enter your city name', 'info')
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: form.name, phone: form.phone, email: form.email, city: form.city, address: form.address }))
    setStep('review')
    window.scrollTo(0, 0)
  }

  // Fix #10: Frozen values captured at place-order time so success screen
  // always shows the correct amounts regardless of any city change mid-flow.
  async function placeOrder() {
    const frozenDelivery  = deliveryCharge
    const frozenFinal     = discountedTotal + frozenDelivery  // includes coupon discount
    const frozenFree      = frozenDelivery === 0
    const frozenBurewala  = form.city.trim().toLowerCase() === 'burewala'

    setLoading(true)
    try {
      // Fix #2: Upsert by phone to prevent a new customer row on every order.
      // Requires UNIQUE constraint on customers.phone — added in v44 SQL patch.
      const { data: customer, error: cErr } = await supabase
        .from('customers')
        .upsert(
          { name: form.name, phone: form.phone, email: form.email, city: form.city, address: form.address },
          { onConflict: 'phone', ignoreDuplicates: false }
        )
        .select().single()
      if (cErr) throw cErr

      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({ customer_id: customer.id, total_price: snapshotTotal, delivery_charges: frozenDelivery, final_total: frozenFinal, status: 'UNPAID' })
        .select().single()
      if (oErr) throw oErr

      await supabase.from('order_items').insert(
        snapshotCart.map(i => ({ order_id: order.id, product_id: i.id, quantity: i.quantity, price: i.discount_price || i.price }))
      )

      // Stock is NOT decremented here — it's decremented when admin CONFIRMS the order.
      // This prevents permanent stock loss on unconfirmed/cancelled orders.
      // See Admin.jsx updateOrderStatus() for the confirm/cancel stock logic.

      const history = JSON.parse(localStorage.getItem('viro_orders') || '[]')
      history.unshift({
        id: order.id, created_at: new Date().toISOString(), status: 'UNPAID',
        final_total: frozenFinal, delivery_charges: frozenDelivery, total_price: snapshotTotal,
        city: form.city, name: form.name,
        items: snapshotCart.map(i => ({ name: i.name, quantity: i.quantity, price: i.discount_price || i.price }))
      })
      localStorage.setItem('viro_orders', JSON.stringify(history.slice(0, 50)))

      await sendOrderEmail({ name: form.name, email: form.email, orderId: order.id,
          items: snapshotCart.map(i => ({ name: i.name, quantity: i.quantity, price: i.discount_price || i.price })),
          subtotal: snapshotTotal, deliveryCharge: frozenDelivery, finalTotal: frozenFinal, city: form.city, coupon_code: couponResult?.valid ? couponCode.toUpperCase() : null, coupon_discount: couponResult?.valid ? couponResult.discount : 0 })

      setOrderId(order.id)
      setFrozenOrderValues({ delivery: frozenDelivery, total: frozenFinal, isFree: frozenFree, isBurewala: frozenBurewala })
      if (isQuick) sessionStorage.removeItem('viro_quick_order')
      else clearCart()
      setStep('success')
      window.scrollTo(0, 0)
    } catch (err) {
      console.error(err)
      showSimpleToast('❌ Something went wrong. Please try again or contact us on WhatsApp.', 'info')
    } finally {
      setLoading(false)
    }
  }

  if (!isQuick && activeCartItems.length === 0 && step === 'form') { navigate('/cart'); return null }

  /* ── SUCCESS ── */
  if (step === 'success') return (
    <div className="px-4 py-10 flex flex-col items-center text-center justify-center slide-up"
      style={{ background: 'var(--viro-sectionBg)', minHeight: '85vh' }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 text-4xl border-2 border-emerald-500"
        style={{ background: '#10B98120' }}>✅</div>
      <h1 className="font-display text-2xl font-bold  mb-4">Order Placed!</h1>

      <div className="viro-card p-4 mb-5 max-w-sm w-full text-left">
        <p className="text-sm mb-3" style={{ color: '#CBD5E1' }}>
          Order <span className="font-bold ">#{orderId?.slice(0,8).toUpperCase()}</span>
        </p>

        {/* Status */}
        <div className="p-3 rounded-xl mb-3" style={{ background: '#F9731312', border: '1px solid #F9731440' }}>
          <p className="text-orange-400 font-bold text-sm">⚠️ Status: UNPAID</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textMuted)' }}>We will confirm via phone or WhatsApp</p>
        </div>

        {/* COD */}
        <div className="p-3 rounded-xl mb-4" style={{ background: '#8B5CF612', border: '1px solid #8B5CF640' }}>
          <p className="text-purple-400 font-bold text-sm">💵 Payment: Cash on Delivery</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textMuted)' }}>Pay when your order arrives at your door</p>
        </div>

        {/* Bill — frozen values captured at order placement time */}
        <div className="space-y-1.5 text-sm border-t pt-3" style={{ borderColor: 'var(--viro-border)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--viro-textMuted)' }}>Subtotal</span>
            <span style={{ color: "var(--viro-text)", fontWeight: 600 }}>Rs.{snapshotTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--viro-textMuted)' }}>Delivery</span>
            <span className="font-semibold" style={frozenOrderValues?.isFree ? {color:'#10B981'} : {color:'var(--viro-text)'}}>
              {frozenOrderValues?.isFree ? '🎉 FREE' : `Rs.${frozenOrderValues?.delivery ?? deliveryCharge}`}
            </span>
          </div>
          <div className="flex justify-between font-bold border-t pt-2 mt-1" style={{ borderColor: 'var(--viro-border)' }}>
            <span style={{ color: "var(--viro-text)" }} className="text-base">Total to Pay</span>
            <span className="text-xl" style={{ color: '#7C3AED' }}>Rs.{(frozenOrderValues?.total ?? finalTotal).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={() => openWhatsApp(`Hi Viro! I placed order #${orderId?.slice(0,8).toUpperCase()}. Name: ${form.name}, City: ${form.city}, Total: Rs.${frozenOrderValues?.total ?? finalTotal}. Please confirm.`, contact.whatsapp)}
          className="w-full py-3.5 rounded-xl font-bold text-center text-sm text-white"
          style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
          💬 Confirm via WhatsApp
        </button>
        <button onClick={() => navigate('/orders')} className="btn-ghost w-full py-3">📋 View My Orders</button>
        <button onClick={() => navigate('/')} className="btn-ghost w-full py-3">🏠 Back to Home</button>
      </div>
    </div>
  )

  /* ── REVIEW ── */
  if (step === 'review') return (
    <div className="pb-6 slide-up" style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh' }}>
      <div className="px-4 md:px-8 max-w-5xl mx-auto">
      <div className="py-4 flex items-center gap-2">
        <button onClick={() => setStep('form')} className="text-lg" style={{ color: 'var(--viro-textSub)' }}>←</button>
        <h1 className="font-display text-xl font-bold ">Order Review</h1>
      </div>

      {/* Desktop: 2-col grid */}
      <div className="md:grid md:grid-cols-2 md:gap-6">
      <div className="md:col-span-1 space-y-4">
      {/* Customer */}
      <div className="viro-card p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--viro-textSub)' }}>Delivery Details</h3>
        {[['Name', form.name], ['Phone', form.phone], ['City', form.city], ['Address', form.address]].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-1.5 text-sm border-b last:border-0" style={{ borderColor: '#1E293B' }}>
            <span style={{ color: 'var(--viro-textMuted)' }} className="flex-shrink-0">{k}</span>
            <span style={{ color: 'var(--viro-text)' }} className="font-medium text-right">{v}</span>
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="viro-card p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--viro-textSub)' }}>Items</h3>
        <div className="space-y-3">
          {snapshotCart.map(item => {
            const price = item.discount_price || item.price
            return (
              <div key={item.id} className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.href=`/product/${item.id}`}>
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
                    style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)' }}>
                    <ProductImage
                      images={item.images}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                    />
                  </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:underline" style={{color:'var(--viro-text)'}}>{item.name}</p>
                  <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>×{item.quantity} @ Rs.{price?.toLocaleString()}</p>
                </div>
                <span className="text-sm font-bold flex-shrink-0" style={{ color: '#7C3AED' }}>
                  Rs.{(price * item.quantity).toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      </div>{/* end left col */}
      <div className="md:col-span-1 space-y-4">
      {/* Bill */}
      <div className="viro-card p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--viro-textSub)' }}>Bill Breakdown</h3>

        {/* ── Coupon input — only shown when admin enables it ── */}
        {couponEnabled && <div className="mb-3">
          {!couponResult?.valid ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={couponCode}
                    onChange={e => {
                      setCouponCode(e.target.value.toUpperCase().replace(/\s/g,''))
                      setCouponResult(null) // clear feedback on type
                    }}
                    onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                    placeholder="Enter coupon code"
                    maxLength={20}
                    style={{
                      fontFamily:'monospace', fontWeight:700, fontSize:14,
                      letterSpacing:'0.08em', paddingRight: 32,
                      borderColor: couponResult && !couponResult.valid ? '#EF4444' : undefined,
                    }}
                  />
                  {couponCode && (
                    <button onClick={removeCoupon}
                      style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                               color:'var(--viro-textSub)', fontSize:14, lineHeight:1 }}>✕</button>
                  )}
                </div>
                <button onClick={applyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
                  style={{
                    background: couponCode.trim() ? 'linear-gradient(135deg,#8B5CF6,#A78BFA)' : 'var(--viro-bgDeep)',
                    color: couponCode.trim() ? '#fff' : 'var(--viro-textSub)',
                    border: '1px solid #8B5CF640',
                    minWidth: 64,
                  }}>
                  {couponLoading ? (
                    <svg className="animate-spin w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : 'Apply'}
                </button>
              </div>

              {/* Rich feedback — shown immediately after Apply */}
              {couponResult && !couponResult.valid && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl"
                  style={{ background:'#EF444412', border:'1.5px solid #EF444430' }}>
                  <span className="text-sm flex-shrink-0 mt-0.5">
                    {couponResult.error?.includes('expired')   ? '⏰' :
                     couponResult.error?.includes('valid from') ? '📅' :
                     couponResult.error?.includes('Invalid')    ? '❌' :
                     couponResult.error?.includes('Minimum')    ? '💰' :
                     couponResult.error?.includes('limit')      ? '🔴' : '⚠️'}
                  </span>
                  <p className="text-xs font-semibold" style={{ color:'#EF4444' }}>{couponResult.error}</p>
                </div>
              )}
            </div>
          ) : (
            /* Success state */
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background:'#10B98112', border:'1.5px solid #10B98140' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎟️</span>
                <div>
                  <p className="text-xs font-black" style={{ color:'#10B981', letterSpacing:'0.08em', fontFamily:'monospace' }}>
                    {couponResult.coupon.code}
                  </p>
                  <p className="text-xs" style={{ color:'#10B981' }}>
                    {couponResult.coupon.type === 'percent'
                      ? `${couponResult.coupon.value}% off — you save Rs.${couponDiscount.toLocaleString()}!`
                      : `Rs.${couponResult.coupon.value} off applied!`}
                  </p>
                </div>
              </div>
              <button onClick={removeCoupon}
                className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                style={{ color:'#EF4444', background:'#EF444415', border:'1px solid #EF444430' }}>
                ✕ Remove
              </button>
            </div>
          )}
        </div>}

        {/* ── Bill rows ── */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: 'var(--viro-textMuted)' }}>Items subtotal</span>
            <span style={{ color: "var(--viro-text)" }}>Rs.{snapshotTotal.toLocaleString()}</span>
          </div>
          {couponResult?.valid && (
            <div className="flex justify-between">
              <span style={{ color:'#10B981' }}>🎟️ Coupon ({couponResult.coupon.code})</span>
              <span className="font-bold" style={{ color:'#10B981' }}>−Rs.{couponDiscount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span style={{ color: 'var(--viro-textMuted)' }}>Delivery charge</span>
            <span style={isFree ? {color:'#10B981'} : {color:'var(--viro-text)'}} className="font-semibold">
              {isFree ? '🎉 FREE' : `Rs.${deliveryCharge}`}
            </span>
          </div>
          {isFree && (
            <p className="text-xs text-right" style={{ color: '#6EE7B7' }}>
              {cityRule ? `✓ Free delivery ≥ Rs.${cityRule.freeThreshold?.toLocaleString()}` : '✓ Free delivery'}
            </p>
          )}
          <div className="flex justify-between font-bold border-t pt-2" style={{ borderColor: 'var(--viro-border)' }}>
            <span style={{ color: "var(--viro-text)" }} className="text-base">Total to Pay</span>
            <span className="text-xl" style={{ color: '#7C3AED' }}>Rs.{finalTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* COD */}
      <div className="flex items-center gap-3 p-3 rounded-xl mb-5"
        style={{ background: '#8B5CF610', border: '1px solid #8B5CF640' }}>
        <span className="text-2xl">💵</span>
        <div>
          <p className="text-sm font-bold ">Cash on Delivery</p>
          <p className="text-xs" style={{ color: 'var(--viro-textMuted)' }}>Pay Rs.{finalTotal.toLocaleString()} when order arrives</p>
        </div>
      </div>

      </div>{/* end right col */}
      </div>{/* end grid */}
      <button onClick={placeOrder} disabled={loading} className="btn-primary w-full py-4 text-base font-bold md:mt-4">
        {loading
          ? <span className="flex items-center gap-2 justify-center">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>Placing…
            </span>
          : `✅ Place Order — Rs.${finalTotal.toLocaleString()} (COD)`}
      </button>
      <p className="text-center text-xs mt-2" style={{ color: '#475569' }}>💵 No payment now · Pay on delivery</p>
      </div>{/* button wrapper */}
    </div>
  )

  /* ── FORM ── */
  return (
    <div className="pb-6 slide-up" style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh' }}>
      <div className="px-4 md:px-8 max-w-2xl mx-auto">
      <h1 className="font-display text-xl font-bold  py-4">Checkout</h1>

      {(saved.name || saved.phone) && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-2 text-xs fade-in"
          style={{ background: '#8B5CF610', border: '1px solid #8B5CF640' }}>
          <span>💾</span>
          <span style={{ color: '#A78BFA' }}>Info pre-filled from your last order. Just review and continue!</span>
          <button onClick={() => { setForm({ name:'', phone:'', email:'', city:'', address:'' }); localStorage.removeItem(STORAGE_KEY) }}
            className="ml-auto text-xs underline flex-shrink-0" style={{ color: 'var(--viro-textSub)' }}>Clear</button>
        </div>
      )}

      <form onSubmit={goToReview} className="space-y-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--viro-textSub)' }}>Full Name *</label>
          <input name="name" value={form.name} onChange={handleChange} placeholder="Muhammad Ali" required />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--viro-textSub)' }}>Phone Number *</label>
          <div style={{ position: 'relative' }}>
            <input name="phone" value={form.phone} onChange={handleChange}
              placeholder="03XX XXXXXXX"
              type="tel" inputMode="numeric" required
              style={isPhoneValid === false
                ? { borderColor: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' }
                : isPhoneValid === true
                  ? { borderColor: '#10B981', boxShadow: '0 0 0 3px rgba(16,185,129,0.12)' }
                  : {}}
            />
            {isPhoneValid === true && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base" style={{ color: '#10B981' }}>✓</span>
            )}
            {isPhoneValid === false && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base" style={{ color: '#EF4444' }}>✗</span>
            )}
          </div>
          {isPhoneValid === false && (
            <p className="text-xs mt-1.5 font-semibold" style={{ color: '#EF4444' }}>
              ⚠️ Use 03XXXXXXXXX (11 digits) or 923XXXXXXXXX (12 digits starting with 92)
            </p>
          )}
          {isPhoneValid === true && (
            <p className="text-xs mt-1 font-semibold" style={{ color: '#10B981' }}>✓ Valid Pakistani number</p>
          )}
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--viro-textSub)' }}>
            Email *
          </label>
          <input ref={emailRef} name="email" value={form.email} onChange={handleChange} placeholder="you@email.com" type="email" required />
        </div>

        <div ref={cityRef} style={{ position: 'relative' }}>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--viro-textSub)' }}>City *</label>
          <CityAutocomplete value={form.city} onChange={val => setForm(f => ({ ...f, city: val }))} isValid={form.city.trim().length < 2 ? null : isCityValid} />

          {/* Fix #5: Soft info banner — doesn't block order, just informs */}
          {form.city.trim().length >= 2 && !isCityKnown && (
            <div className="mt-2 p-3 rounded-xl fade-in" style={{ background:'#FFF7ED', border:'1px solid #FED7AA' }}>
              <p style={{ color:'#C2410C', fontWeight:700, fontSize:13, margin:'0 0 3px' }}>📍 City not in autocomplete list</p>
              <p style={{ color:'#EA580C', fontSize:12, margin:0, lineHeight:1.5 }}>
                No problem — you can still place your order! For delivery enquiries:&nbsp;
                <a href="mailto:support@viro.pk" style={{ color:'#C2410C', fontWeight:700, textDecoration:'underline' }}>support@viro.pk</a>
                &nbsp;/&nbsp;
                <button type="button"
                  onClick={() => openWhatsApp(`Hi Viro! I'm ordering from "${form.city}". Please confirm delivery. Thanks!`, contact.whatsapp)}
                  style={{ color:'#C2410C', fontWeight:700, textDecoration:'underline', background:'none', border:'none', padding:0, cursor:'pointer', fontSize:12 }}>
                  WhatsApp
                </button>
              </p>
            </div>
          )}

          {form.city.trim().length > 1 && isCityValid && (
            <div className="mt-2 p-3 rounded-xl text-sm fade-in"
              style={isFree
                ? { background: '#10B98115', border: '1px solid #10B98140' }
                : { background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)' }}>
              {isFree
                ? <span className="text-emerald-400 font-semibold">🎉 {isBurewala ? 'Free delivery in Burewala!' : 'Free delivery on this order!'}</span>
                : <span style={{ color: 'var(--viro-textMuted)' }}>🚚 Rs.{deliveryCharge} delivery charge
                    <span className="ml-1" style={{ color: '#60A5FA' }}>
                      {cityRule ? `(Free ≥ Rs.${cityRule.freeThreshold?.toLocaleString()})` : ''}
                    </span>
                  </span>
              }
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--viro-textSub)' }}>Full Address *</label>
          <textarea name="address" value={form.address} onChange={handleChange}
            placeholder="House #, Street, Mohalla, Landmark…" rows={3} required style={{ resize: 'none' }} />
        </div>

        {/* Live bill preview — always shows with correct values */}
        {form.city.trim().length > 1 && (
          <div className="viro-card p-4 fade-in">
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--viro-textSub)' }}>💰 Bill Preview</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--viro-textMuted)' }}>Subtotal ({activeCartItems.length} item{activeCartItems.length !== 1 ? 's' : ''})</span>
                <span style={{ color: 'var(--viro-text)', fontWeight: 600 }}>Rs.{activeTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--viro-textMuted)' }}>Delivery</span>
                <span className={isFree ? 'text-emerald-400 font-bold' : ''} style={isFree ? {} : { color: 'var(--viro-text)', fontWeight: 600 }}>
                  {isFree ? '🎉 FREE' : 'Rs.' + deliveryCharge}
                </span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2" style={{ borderColor: 'var(--viro-border)' }}>
                <span style={{ color: 'var(--viro-text)' }}>Total to Pay</span>
                <span className="text-lg" style={{ color: '#7C3AED' }}>Rs.{finalTotal.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t flex items-center gap-2" style={{ borderColor: 'var(--viro-border)' }}>
              <span className="text-lg">💵</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--viro-textSub)' }}>Cash on Delivery — Pay when order arrives</span>
            </div>
          </div>
        )}
        <button type="submit" className="btn-primary w-full py-4 text-base font-bold">Review Order →</button>
      </form>
      </div>{/* max-w */}
    </div>
  )
}