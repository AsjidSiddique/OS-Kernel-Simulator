import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { showToast } from '../components/Toast'

const CartContext = createContext()

// ── Universal image parser ──────────────────────────────────
export function parseImages(raw) {
  try {
    if (!raw) return []
    if (Array.isArray(raw)) {
      const flat = raw.flat(3)
      const urls = []
      for (const item of flat) {
        if (typeof item === 'string') {
          if (item.startsWith('http')) {
            urls.push(item)
          } else if (item.startsWith('[')) {
            try {
              const parsed = JSON.parse(item)
              const inner = Array.isArray(parsed) ? parsed.flat(2) : [parsed]
              urls.push(...inner.filter(u => typeof u === 'string' && u.startsWith('http')))
            } catch {}
          }
        }
      }
      return urls
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed)
        return parseImages(parsed)
      }
      if (trimmed.startsWith('http')) return [trimmed]
    }
    return []
  } catch {
    return []
  }
}

export function getThumb(raw, fallback = '/logo.jpg') {
  const imgs = parseImages(raw)
  return imgs[0] || fallback
}

// ── Cart Provider ───────────────────────────────────────────
export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('viro_cart') || '[]')
      return stored.map(item => ({
        ...item,
        images: parseImages(item.images)
      }))
    } catch { return [] }
  })

  // v46: tracks which product IDs had price changes last refresh
  const [priceChanges, setPriceChanges] = useState([]) // [{ id, oldPrice, newPrice, name }]

  useEffect(() => {
    localStorage.setItem('viro_cart', JSON.stringify(cart))
  }, [cart])

  const addToCart = (product, qty = 1) => {
    const cleanImages = parseImages(product.images)
    const cleanProduct = { ...product, images: cleanImages }
    setCart(prev => {
      const existing = prev.find(i => i.id === cleanProduct.id)
      if (existing) {
        return prev.map(i =>
          i.id === cleanProduct.id
            ? { ...i, quantity: i.quantity + qty }
            : i
        )
      }
      return [...prev, { ...cleanProduct, quantity: qty }]
    })
    showToast(cleanProduct)
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id))

  const updateQty = (id, qty) => {
    if (qty < 1) return removeFromCart(id)
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i))
  }

  const clearCart = () => setCart([])

  // ── v46: refreshCartPrices ──────────────────────────────
  // Re-fetches live price data for every item currently in the cart.
  // Updates discount_price / sale_active / sale_ends_at in-place.
  // Returns array of { id, name, oldPrice, newPrice } for items that changed.
  const refreshCartPrices = useCallback(async (supabase) => {
    if (!supabase) return []
    let currentCart
    setCart(prev => { currentCart = prev; return prev })
    if (!currentCart || currentCart.length === 0) return []

    const ids = currentCart.map(i => i.id)
    try {
      const { data: fresh } = await supabase
        .from('products')
        .select('id, price, discount_price, sale_active, sale_ends_at, status, stock, is_active')
        .in('id', ids)

      if (!fresh || fresh.length === 0) return []

      const changes = []
      setCart(prev => prev.map(item => {
        const live = fresh.find(p => p.id === item.id)
        if (!live) return item

        // Determine the live effective price
        const now = new Date()
        // v46 fix: discount active only if timer running OR no expiry set (permanent)
        const saleStillActive =
          live.discount_price && live.discount_price < live.price && (
            (live.sale_active && live.sale_ends_at && new Date(live.sale_ends_at) > now) || // timer running
            (!live.sale_ends_at)  // permanent discount (no expiry)
          )
        const liveEffectivePrice = saleStillActive ? live.discount_price : live.price

        // What price was stored in cart
        const cartEffectivePrice = (item.discount_price && item.discount_price < item.price)
          ? item.discount_price
          : item.price

        if (Math.abs(liveEffectivePrice - cartEffectivePrice) > 0.01) {
          changes.push({
            id: item.id,
            name: item.name,
            oldPrice: cartEffectivePrice,
            newPrice: liveEffectivePrice,
          })
        }

        // Update item with fresh DB values
        return {
          ...item,
          price:         live.price,
          discount_price: saleStillActive ? live.discount_price : null,
          sale_active:   live.sale_active,
          sale_ends_at:  live.sale_ends_at,
          status:        live.status,
          stock:         live.stock,
          is_active:     live.is_active,
        }
      }))

      setPriceChanges(changes)
      return changes
    } catch {
      return []
    }
  }, [])

  const clearPriceChanges = useCallback(() => setPriceChanges([]), [])

  // Computed total uses live effective price from cart state
  const cartTotal = cart.reduce((sum, i) => {
    const now = new Date()
    // v46 fix: same logic as ProductCard/ProductDetail
    const saleOk = i.discount_price && i.discount_price < i.price && (
      (i.sale_active && i.sale_ends_at && new Date(i.sale_ends_at) > now) ||
      (!i.sale_ends_at)
    )
    const price = saleOk ? i.discount_price : i.price
    return sum + price * i.quantity
  }, 0)

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{
      cart, addToCart, removeFromCart, updateQty, clearCart,
      cartTotal, cartCount,
      refreshCartPrices, priceChanges, clearPriceChanges,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
