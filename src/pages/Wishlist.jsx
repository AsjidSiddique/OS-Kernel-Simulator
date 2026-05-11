import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWishlist } from '../context/WishlistContext'
import { useCart, parseImages } from '../context/CartContext'

export default function Wishlist() {
  const { wishlist, removeFromWishlist } = useWishlist()
  const { addToCart } = useCart()
  const navigate = useNavigate()

  function handleAddToCart(product) {
    addToCart(product)
  }

  if (wishlist.length === 0) {
    return (
      <div style={{
        minHeight: '80vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '32px 16px',
        textAlign: 'center', background: 'var(--viro-sectionBg)'
      }}>
        <div style={{ fontSize: 72, marginBottom: 16, filter: 'grayscale(0.2)' }}>🤍</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--viro-text)', marginBottom: 8 }}>
          Your Wishlist is Empty
        </h2>
        <p style={{ color: 'var(--viro-textSub)', fontSize: 14, marginBottom: 28, maxWidth: 300 }}>
          Save products you love and come back to them anytime.
        </p>
        <Link to="/shop" style={{
          padding: '12px 32px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
          color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none',
          display: 'inline-block'
        }}>
          🛍️ Browse Shop
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--viro-sectionBg)', padding: '16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--viro-text)', margin: 0 }}>
              ❤️ My Wishlist
            </h1>
            <p style={{ fontSize: 13, color: 'var(--viro-textSub)', margin: '4px 0 0' }}>
              {wishlist.length} saved item{wishlist.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 14,
        }}>
          {wishlist.map(product => {
            const images = parseImages(product.images)
            const thumb = images[0] || 'https://placehold.co/400x300/F1F5F9/8B5CF6?text=Viro'
            const hasDiscount = product.discount_price && product.discount_price < product.price
            const displayPrice = hasDiscount ? product.discount_price : product.price
            const inStock = product.stock > 0 && product.status !== 'out_of_stock' && product.status !== 'coming_soon'

            return (
              <div key={product.id}
                style={{
                  background: 'var(--viro-bgCard)',
                  border: '1px solid var(--viro-border)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(139,92,246,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.07)' }}
              >
                {/* Image */}
                <div style={{ position: 'relative', paddingTop: '66%', background: '#F8FAFC', overflow: 'hidden' }}>
                  <Link to={`/product/${product.id}`}>
                    <img
                      src={thumb} alt={product.name}
                      style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%',
                        objectFit: 'cover', transition: 'transform 0.4s',
                      }}
                      onError={e => { e.target.src = 'https://placehold.co/400x266/F1F5F9/8B5CF6?text=Viro' }}
                    />
                  </Link>
                  {/* Remove heart button */}
                  <button
                    onClick={() => removeFromWishlist(product.id)}
                    title="Remove from wishlist"
                    style={{
                      position: 'absolute', top: 7, right: 7,
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.92)',
                      border: '1px solid #FFB3C1',
                      cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      transition: 'transform 0.15s',
                    }}
                    onMouseDown={e => e.currentTarget.style.transform='scale(0.9)'}
                    onMouseUp={e => e.currentTarget.style.transform=''}
                  >❤️</button>

                  {hasDiscount && (
                    <div style={{
                      position: 'absolute', top: 7, left: 7,
                      background: 'linear-gradient(135deg,#8B5CF6,#F97316)',
                      color: '#fff', fontWeight: 800, fontSize: 9,
                      padding: '2px 6px', borderRadius: 6,
                    }}>
                      -{Math.round((1 - product.discount_price / product.price) * 100)}%
                    </div>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: '9px 10px 10px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <Link to={`/product/${product.id}`} style={{ textDecoration: 'none' }}>
                    <p style={{
                      margin: '0 0 5px', color: 'var(--viro-text)', fontWeight: 600,
                      fontSize: 11, lineHeight: 1.35,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>{product.name}</p>
                  </Link>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                    <span style={{ color: '#7C3AED', fontWeight: 900, fontSize: 13 }}>
                      Rs.{displayPrice?.toLocaleString()}
                    </span>
                    {hasDiscount && (
                      <span style={{ color: '#94A3B8', fontSize: 10, textDecoration: 'line-through' }}>
                        Rs.{product.price?.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', gap: 5 }}>
                    {inStock ? (
                      <>
                        <button
                          onClick={() => handleAddToCart(product)}
                          style={{
                            flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9,
                            padding: '6px 0', fontSize: 10, fontWeight: 700,
                            background: '#1E293B', color: '#E2E8F0',
                          }}
                        >🛒 Cart</button>
                        <button
                          onClick={() => {
                            sessionStorage.setItem('viro_quick_order', JSON.stringify([{ ...product, quantity: 1 }]))
                            navigate('/checkout?quick=1')
                          }}
                          style={{
                            flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9,
                            padding: '6px 0', fontSize: 10, fontWeight: 700,
                            background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
                            color: '#fff',
                          }}
                        >⚡ Order</button>
                      </>
                    ) : (
                      <div style={{
                        flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700,
                        color: product.status === 'coming_soon' ? '#7C3AED' : '#DC2626',
                        padding: '6px 0',
                        background: product.status === 'coming_soon' ? '#EDE9FE' : '#FEE2E2',
                        borderRadius: 9,
                      }}>
                        {product.status === 'coming_soon' ? '🚀 Coming Soon' : '❌ Out of Stock'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
