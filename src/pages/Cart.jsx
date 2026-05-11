import React, { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteSettingsContext'
import ProductImage from '../components/ProductImage'

export default function Cart() {
  const {
    cart, removeFromCart, updateQty, cartTotal, cartCount,
    refreshCartPrices, priceChanges, clearPriceChanges,
  } = useCart()
  const { deliveryRules } = useSite()
  const navigate = useNavigate()
  const refreshedRef = useRef(false)

  // v46: refresh prices on mount — catches any stale discount prices
  // (e.g. user added item during sale, sale expired, they open cart later)
  useEffect(() => {
    if (refreshedRef.current || cart.length === 0) return
    refreshedRef.current = true
    refreshCartPrices(supabase)
  }, [cart.length])

  // Helper: get live effective price for a cart item
  function effectivePrice(item) {
    const now = new Date()
    const saleOk = item.sale_active && item.sale_ends_at && new Date(item.sale_ends_at) > now
    return (saleOk && item.discount_price && item.discount_price < item.price)
      ? item.discount_price
      : item.price
  }

  if (cart.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-7xl mb-4">🛒</div>
      <h2 className="font-display text-xl font-bold mb-2" style={{ color: 'var(--viro-text)' }}>Your cart is empty</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--viro-textSub)' }}>Add some products to get started!</p>
      <Link to="/shop" className="btn-primary px-8 py-3">Browse Products</Link>
    </div>
  )

  return (
    <div className="px-4 pb-24 md:pb-8 pt-4">
      <h1 className="font-display text-xl font-bold mb-4" style={{ color: 'var(--viro-text)' }}>
        My Cart <span className="text-base font-normal" style={{ color: 'var(--viro-textSub)' }}>({cartCount} items)</span>
      </h1>

      {/* v46: Price-change banner — shown when a sale expired after items were added */}
      {priceChanges.length > 0 && (
        <div className="mb-4 rounded-2xl p-4" style={{
          background: 'linear-gradient(135deg,#FEF3C7,#FEF9C3)',
          border: '1.5px solid #F59E0B',
          boxShadow: '0 2px 12px rgba(245,158,11,0.15)',
        }}>
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="font-bold text-sm mb-1" style={{ color: '#92400E' }}>
                Prices updated — sale has ended
              </p>
              {priceChanges.map(c => (
                <p key={c.id} className="text-xs mb-0.5" style={{ color: '#78350F' }}>
                  <strong>{c.name}</strong>: Rs.{c.oldPrice?.toLocaleString()}
                  {' '}→{' '}
                  <strong>Rs.{c.newPrice?.toLocaleString()}</strong>
                </p>
              ))}
              <p className="text-xs mt-1" style={{ color: '#92400E' }}>
                Your cart has been updated to reflect current prices.
              </p>
            </div>
            <button
              onClick={clearPriceChanges}
              className="text-amber-600 hover:text-amber-800 text-lg leading-none flex-shrink-0 mt-0.5"
              title="Dismiss"
            >✕</button>
          </div>
        </div>
      )}

      <div className="md:flex md:gap-6 md:items-start">

        {/* Cart items */}
        <div className="space-y-3 mb-6 md:mb-0 md:flex-1">
          {cart.map(item => {
            const itemPrice = effectivePrice(item)
            const hasDiscount = item.discount_price && item.discount_price < item.price
            const now = new Date()
            const saleOk = item.sale_active && item.sale_ends_at && new Date(item.sale_ends_at) > now
            const showStrike = hasDiscount && saleOk
            const wasChanged = priceChanges.some(c => c.id === item.id)

            return (
              <div key={item.id}
                className="viro-card p-3 flex gap-3 items-center slide-up"
                style={wasChanged ? { border: '1.5px solid #F59E0B', boxShadow: '0 0 0 3px rgba(245,158,11,0.08)' } : {}}
              >
                {/* Product image */}
                <Link to={`/product/${item.id}`} className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
                    style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)' }}>
                    <ProductImage
                      images={item.images}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${item.id}`}>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--viro-text)' }}>{item.name}</p>
                  </Link>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <p className="text-sm font-bold" style={{ color: '#00BFFF' }}>
                      Rs. {itemPrice?.toLocaleString()}
                    </p>
                    {showStrike && (
                      <p className="text-xs line-through" style={{ color: 'var(--viro-textSub)' }}>
                        Rs. {item.price?.toLocaleString()}
                      </p>
                    )}
                  </div>
                  {wasChanged && (
                    <p className="text-xs font-semibold mt-0.5" style={{ color: '#D97706' }}>
                      ⚠️ Price updated
                    </p>
                  )}
                </div>

                {/* Controls */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button onClick={() => removeFromCart(item.id)}
                    className="text-red-400/60 hover:text-red-400 text-xs transition-colors leading-none">✕</button>
                  <div className="flex items-center gap-1 rounded-xl px-2 py-1"
                    style={{ background: 'var(--viro-bgDeep)', border: '1px solid var(--viro-border)' }}>
                    <button onClick={() => updateQty(item.id, item.quantity - 1)}
                      className="w-6 h-6 flex items-center justify-center font-bold"
                      style={{ color: 'var(--viro-textSub)' }}>−</button>
                    <span className="w-6 text-center text-sm font-bold" style={{ color: 'var(--viro-text)' }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, item.quantity + 1)}
                      className="w-6 h-6 flex items-center justify-center font-bold"
                      style={{ color: 'var(--viro-textSub)' }}>+</button>
                  </div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--viro-textSub)' }}>
                    Rs. {(itemPrice * item.quantity)?.toLocaleString()}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Order Summary */}
        <div className="md:w-72 md:sticky md:top-16 flex-shrink-0">
          <div className="viro-card p-5 mb-4">
            <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--viro-text)' }}>Order Summary</h3>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span style={{ color: 'var(--viro-textSub)' }}>Subtotal ({cartCount} items)</span>
                <span className="font-semibold" style={{ color: 'var(--viro-text)' }}>Rs. {cartTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--viro-textSub)' }}>Delivery</span>
                <span className="text-xs" style={{ color: '#A78BFA' }}>Calculated at checkout</span>
              </div>
            </div>
            <div className="border-t pt-4 mb-5" style={{ borderColor: 'var(--viro-border)' }}>
              <div className="flex justify-between font-bold">
                <span style={{ color: 'var(--viro-text)' }}>Total</span>
                <span className="text-lg" style={{ color: '#00BFFF' }}>Rs. {cartTotal.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => navigate('/checkout')} className="btn-primary w-full py-3.5 text-sm font-bold">
              Proceed to Checkout →
            </button>
          </div>

          <div className="viro-card p-4 text-xs">
            <p className="font-bold text-sm mb-3" style={{ color: 'var(--viro-text)' }}>🚚 Delivery Charges</p>
            <div className="space-y-2">
              {deliveryRules.map((rule, i) => {
                const isWild = rule.cities?.includes('*')
                const color  = isWild ? '#8B5CF6' : '#00BFFF'
                return (
                  <div key={i} className="p-2.5 rounded-xl" style={{ background: color + '10', border: `1px solid ${color}30` }}>
                    <p className="font-bold mb-0.5" style={{ color: 'var(--viro-text)' }}>
                      {isWild ? '🌍' : '📍'} {rule.label}
                    </p>
                    <p style={{ color: 'var(--viro-textSub)' }}>
                      Free delivery on Rs.{rule.freeThreshold?.toLocaleString()}+
                      {' · '}otherwise <span style={{ color, fontWeight: 700 }}>Rs.{rule.charge}</span>
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
