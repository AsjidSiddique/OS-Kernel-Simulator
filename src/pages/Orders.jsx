import { openWhatsApp } from '../lib/whatsapp'
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ORDER_STATUS_META } from '../lib/constants'
import { LeaveReview } from '../components/ProductReviews'

// v46: full pipeline order — CANCELLED is side-track, not in the main flow
const PIPELINE = ['UNPAID','QUEUE','CONFIRMED','PROCESSING','SHIPPED','DELIVERED']

function getSavedUser() {
  try { return JSON.parse(localStorage.getItem('viro_user_info') || '{}') } catch { return {} }
}

function PhoneSearch({ onSearch }) {
  const [phone, setPhone] = useState('')
  const [err, setErr]     = useState('')

  function handleSearch(e) {
    e.preventDefault()
    const d = phone.replace(/[\s\-()]/g, '')
    const valid = (d.startsWith('03') && d.length === 11) || (d.startsWith('92') && d.length === 12)
    if (!valid) { setErr('Enter a valid number: 03XXXXXXXXX or 923XXXXXXXXX'); return }
    setErr('')
    onSearch(phone.trim())
  }

  return (
    <form onSubmit={handleSearch}>
      <div style={{ position: 'relative' }}>
        <input
          value={phone} onChange={e => { setPhone(e.target.value); setErr('') }}
          placeholder="03XX XXXXXXX" type="tel" inputMode="numeric"
          style={err ? { borderColor: '#EF4444', marginBottom: 6 } : { marginBottom: 6 }}
        />
        {err && <p className="text-xs mb-3" style={{ color: '#EF4444' }}>{err}</p>}
      </div>
      <button type="submit" className="btn-primary w-full py-3 font-bold">
        🔍 Find My Orders
      </button>
    </form>
  )
}

// ── Order pipeline progress bar ──────────────────────────────
function OrderPipeline({ status }) {
  const isCancelled = status === 'CANCELLED'
  const currentIdx  = PIPELINE.indexOf(status)

  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--viro-border)' }}>
      {isCancelled ? (
        <div className="flex items-center gap-2 py-1">
          <span className="text-xl">❌</span>
          <div>
            <p className="text-sm font-bold" style={{ color: '#EF4444' }}>Order Cancelled</p>
            <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>
              {ORDER_STATUS_META.CANCELLED.desc}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Step dots + connectors */}
          <div className="flex items-center mb-2 overflow-x-auto pb-1">
            {PIPELINE.map((s, i) => {
              const meta     = ORDER_STATUS_META[s]
              const isActive = s === status
              const isPast   = currentIdx > i
              const color    = meta.color
              return (
                <React.Fragment key={s}>
                  {i > 0 && (
                    <div className="flex-1 h-0.5 min-w-[12px] mx-0.5 rounded-full transition-all duration-500"
                      style={{ background: isPast ? color : 'var(--viro-border)' }} />
                  )}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all duration-300"
                      style={{
                        background: isActive ? color+'25' : isPast ? color+'15' : 'var(--viro-bgDeep)',
                        borderColor: isActive || isPast ? color : 'var(--viro-border)',
                        boxShadow: isActive ? `0 0 12px ${color}50` : 'none',
                        transform: isActive ? 'scale(1.15)' : 'scale(1)',
                      }}>
                      {isPast ? (
                        <span style={{ color }}>✓</span>
                      ) : (
                        <span style={{ filter: isActive ? 'none' : 'grayscale(1)', opacity: isActive ? 1 : 0.4 }}>
                          {meta.icon}
                        </span>
                      )}
                    </div>
                    <span className="text-[8px] font-bold mt-0.5 whitespace-nowrap"
                      style={{ color: isActive ? color : isPast ? color+'99' : 'var(--viro-textSub)' }}>
                      {s === 'UNPAID' ? 'Placed' : s === 'QUEUE' ? 'Queued' : s}
                    </span>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
          {/* Current status description */}
          <div className="flex items-center gap-2 mt-1 px-1 py-2 rounded-xl"
            style={{ background: (ORDER_STATUS_META[status]?.color || '#94A3B8') + '12' }}>
            <span className="text-base">{ORDER_STATUS_META[status]?.icon}</span>
            <div>
              <p className="text-xs font-bold" style={{ color: ORDER_STATUS_META[status]?.color }}>
                {ORDER_STATUS_META[status]?.label}
              </p>
              <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>
                {ORDER_STATUS_META[status]?.desc}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function Orders() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [hasUser, setHasUser] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const saved = getSavedUser()
    if (saved.phone) {
      setHasUser(true)
      setUserName(saved.name || '')
      fetchOrders(saved.phone)
    } else {
      setHasUser(false)
      setLoading(false)
    }
  }, [])

  async function fetchOrders(phone) {
    setLoading(true)
    try {
      const rawPhone = phone.trim()
      const altPhone = rawPhone.startsWith('0')
        ? '92' + rawPhone.slice(1)
        : rawPhone.startsWith('92') ? '0' + rawPhone.slice(2) : rawPhone
      const { data: customers } = await supabase
        .from('customers').select('id').or(`phone.eq.${rawPhone},phone.eq.${altPhone}`)

      if (!customers?.length) {
        const local = JSON.parse(localStorage.getItem('viro_orders') || '[]')
        setOrders(local); setLoading(false); return
      }

      const ids = customers.map(c => c.id)
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, customers(name, phone, city, address), order_items(quantity, price, products(id, name, images)), coupon_code, coupon_discount')
        .in('customer_id', ids)
        .order('created_at', { ascending: false })

      setOrders(ordersData || [])
    } catch {
      const local = JSON.parse(localStorage.getItem('viro_orders') || '[]')
      setOrders(local)
    }
    setLoading(false)
  }

  if (!hasUser && !loading) return (
    <div className="pb-24 min-h-screen px-4 pt-10 max-w-md mx-auto"
      style={{ background: 'var(--viro-sectionBg)' }}>
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">📋</div>
        <h2 className="font-display text-xl font-bold mb-2" style={{ color: 'var(--viro-text)' }}>Track Your Order</h2>
        <p className="text-sm" style={{ color: 'var(--viro-textSub)' }}>
          Enter your phone number to view all your past orders.
        </p>
      </div>
      <div className="viro-card p-5 mb-5">
        <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--viro-textSub)' }}>
          Phone Number
        </label>
        <PhoneSearch onSearch={(phone) => {
          setHasUser(true); setLoading(true); fetchOrders(phone)
        }} />
      </div>
      <div className="text-center">
        <Link to="/shop" className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-sm text-white"
          style={{ background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)' }}>
          🛍️ Shop Now
        </Link>
      </div>
    </div>
  )

  return (
    <div className="pb-28 slide-up" style={{ background: 'var(--viro-sectionBg)', minHeight: '100vh' }}>

      {/* Header */}
      <div className="px-4 md:px-8 pt-5 pb-3 border-b" style={{ borderColor: 'var(--viro-border)' }}>
        <div className="max-w-5xl mx-auto">
          <h1 className="font-display text-xl font-bold mb-0.5" style={{ color: 'var(--viro-text)' }}>My Orders</h1>
          {userName
            ? <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>Orders for <span style={{ color: '#A78BFA' }}>{userName}</span></p>
            : <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>Track your order status in real-time</p>
          }
        </div>
      </div>

      <div className="px-4 md:px-8 pt-5 max-w-5xl mx-auto">

        {loading && (
          <div className="flex flex-col items-center py-16 gap-3">
            <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3"/>
              <path className="opacity-75" fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-sm" style={{ color: 'var(--viro-textSub)' }}>Loading your orders…</p>
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="text-center py-14" style={{ color: 'var(--viro-textSub)' }}>
            <div className="text-5xl mb-4">📭</div>
            <p className="font-bold" style={{ color: 'var(--viro-text)' }}>No orders found</p>
            <p className="text-sm mt-1 mb-6">No orders found for that number. Try a different one?</p>
            <div className="viro-card p-5 mb-5 text-left max-w-sm mx-auto">
              <PhoneSearch onSearch={(phone) => { setLoading(true); fetchOrders(phone) }} />
            </div>
            <Link to="/shop" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white"
              style={{ background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)' }}>
              🛍️ Start Shopping
            </Link>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="md:grid md:grid-cols-2 md:gap-5 space-y-4 md:space-y-0">
            {orders.map((order, idx) => {
              const meta     = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.UNPAID
              const customer = order.customers
              const items    = order.order_items || order.items || []
              const isFree   = (order.delivery_charges || 0) === 0

              return (
                <div key={order.id || idx} className="viro-card overflow-hidden fade-in"
                  style={{
                    animationDelay: `${idx * 60}ms`, height: 'fit-content',
                    borderTop: `3px solid ${meta.color}`,
                  }}>

                  {/* Order header */}
                  <div className="px-4 py-3 flex items-center justify-between border-b"
                    style={{ background: 'var(--viro-bgDeep)', borderColor: 'var(--viro-border)' }}>
                    <div>
                      <p className="text-xs font-mono font-bold" style={{ color: 'var(--viro-text)' }}>
                        #{(order.id || '').slice(0,8).toUpperCase()}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textSub)' }}>
                        {new Date(order.created_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' })}
                        {' · '}
                        {new Date(order.created_at).toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                      style={{ background: meta.color+'20', color: meta.color, border: `1px solid ${meta.color}40` }}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>

                  {/* Pipeline tracker */}
                  <OrderPipeline status={order.status} />

                  {/* Items */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--viro-border)' }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--viro-textSub)' }}>Items</p>
                    <div className="space-y-2">
                      {items.map((item, i) => {
                        const productId   = item.products?.id
                        const productName = item.products?.name || item.name || 'Product'
                        const imgs = Array.isArray(item.products?.images)
                          ? item.products.images
                          : (typeof item.products?.images === 'string' ? JSON.parse(item.products?.images || '[]') : [])
                        const thumb = imgs[0] || '/logo.jpg'
                        return (
                          <div key={i}
                            className="flex items-center gap-2 cursor-pointer group"
                            onClick={() => productId && navigate(`/product/${productId}`)}>
                            <img src={thumb} alt={productName}
                              className="w-9 h-9 rounded-lg object-cover flex-shrink-0 group-hover:opacity-80 transition-opacity"
                              style={{ border: '1px solid var(--viro-border)', background: 'var(--viro-productWhite)' }}
                              onError={e => { e.target.src = '/logo.jpg' }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate group-hover:underline font-medium"
                                style={{ color: 'var(--viro-text)' }}>{productName}</p>
                              <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>×{item.quantity}</p>
                            </div>
                            <span className="text-sm font-semibold flex-shrink-0" style={{ color: '#A78BFA' }}>
                              Rs.{(item.price * item.quantity)?.toLocaleString()}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Bill */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--viro-border)' }}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'var(--viro-textMuted)' }}>Subtotal</span>
                      <span style={{ color: 'var(--viro-text)', fontWeight: 600 }}>
                        Rs.{(order.total_price || order.subtotal)?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span style={{ color: 'var(--viro-textMuted)' }}>Delivery</span>
                      <span className="font-semibold" style={{ color: isFree ? '#10B981' : 'var(--viro-text)' }}>
                        {isFree ? '🎉 FREE' : `Rs.${order.delivery_charges}`}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2" style={{ borderColor: 'var(--viro-border)' }}>
                      <span style={{ color: 'var(--viro-text)' }}>Total to Pay</span>
                      <span className="text-lg" style={{ color: '#7C3AED' }}>Rs.{(order.final_total)?.toLocaleString()}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--viro-textSub)' }}>💵 Cash on Delivery</p>
                  </div>

                  {/* Delivery address */}
                  {customer && (
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--viro-border)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--viro-textSub)' }}>Delivery To</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--viro-text)' }}>{customer.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textMuted)' }}>{customer.city} · {customer.address}</p>
                    </div>
                  )}

                  {/* Leave a Review — only for delivered orders */}
                  {order.status === 'DELIVERED' && items.length > 0 && (
                    <div className="px-4 py-3 border-t space-y-3" style={{ borderColor:'var(--viro-border)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color:'var(--viro-textSub)' }}>
                        ⭐ Rate Your Purchase
                      </p>
                      {items.map((item, i) => {
                        const productId   = item.products?.id
                        const productName = item.products?.name || item.name || 'Product'
                        const imgs        = Array.isArray(item.products?.images) ? item.products.images
                          : (typeof item.products?.images==='string' ? (() => { try { return JSON.parse(item.products.images) } catch { return [] } })() : [])
                        const thumb = imgs[0] || null
                        if (!productId) return null
                        return (
                          <LeaveReview
                            key={i}
                            orderId={order.id}
                            productId={productId}
                            productName={productName}
                            productThumb={thumb}
                            customerId={order.customers?.id || null}
                            reviewerName={customer?.name || null}
                          />
                        )
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-4 py-3 flex gap-2">
                    <a href={`https://wa.me/923277796566?text=${encodeURIComponent(`Hi Viro! Order #${(order.id||'').slice(0,8).toUpperCase()} — can I get a status update?`)}`}
                      target="_blank" rel="noopener"
                      className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: '#25D36615', color: '#25D366', border: '1px solid #25D36630' }}>
                      💬 WhatsApp
                    </a>
                    <a href="tel:+923277796566"
                      className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold"
                      style={{ background: '#00BFFF15', color: '#00BFFF', border: '1px solid #00BFFF30' }}>
                      📞 Call Us
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
