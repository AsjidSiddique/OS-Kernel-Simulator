import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'

const LOGO_URL = 'https://rwinhwekqthzsuzobxiw.supabase.co/storage/v1/object/sign/logo/logo.jpeg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV80NGFhNjVhOS00ZGYyLTRiMjctYTNkOS05MzdlNDI1MGE0OWYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb2dvL2xvZ28uanBlZyIsImlhdCI6MTc3NzcyOTM0MCwiZXhwIjozNjY5ODg5MzQwfQ.7fs4-gFvC1sEyf3O6NFj5sFNjuaqgas8SvHhvt7OAkk'

const NAV = [
  { path: '/',          label: 'Home',     icon: '🏠' },
  { path: '/shop',      label: 'Shop',     icon: '🛍️' },
  { path: '/wishlist',  label: 'Wishlist', icon: '❤️' },
  { path: '/cart',      label: 'Cart',     icon: '🛒' },
  { path: '/orders',    label: 'Orders',   icon: '📋' },
]

export default function Navbar() {
  const { cartCount } = useCart()
  const { wishlistCount } = useWishlist()
  const location = useLocation()
  const [expanded, setExpanded] = useState(false)

  function toggleSidebar() {
    const next = !expanded
    setExpanded(next)
    const main = document.getElementById('viro-main')
    if (main) main.style.marginLeft = next ? '220px' : '64px'
  }

  return (
    <>
      <style>{`
        .nav-logo-img { animation: logoFloat 3.5s ease-in-out infinite; }
        @keyframes logoFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        .nav-item-d { transition: all 0.18s cubic-bezier(.4,0,.2,1); }
        .nav-item-d:hover { transform: translateX(2px); }
        .sidebar-w { width: 64px; transition: width 0.25s cubic-bezier(.4,0,.2,1); }
        .sidebar-w.open { width: 220px; }
        .sidebar-label { opacity: 0; width: 0; overflow: hidden; transition: opacity 0.2s, width 0.2s; white-space:nowrap; }
        .sidebar-w.open .sidebar-label { opacity: 1; width: auto; }
        .sidebar-w.open .brand-name { opacity: 1; }
        .brand-name { opacity: 0; transition: opacity 0.2s; }
      `}</style>

      {/* ── Desktop sidebar — collapsible icon/expanded ── */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 z-40 py-4 sidebar-w ${expanded ? 'open' : ''}`}
        style={{
          background: 'var(--viro-navBg)',
          borderRight: '1px solid var(--viro-navBorder)',
          top: '36px',   /* sits below TopBar (36px) */
          height: 'calc(100vh - 36px)',
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(.4,0,.2,1), background 0.35s, border-color 0.35s',
        }}>

        {/* Toggle button */}
        <button
          onClick={() => toggleSidebar()}
          className="flex items-center justify-center mb-3 mx-auto rounded-xl transition-all hover:opacity-80"
          style={{ width: 40, height: 40, background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)', flexShrink: 0 }}
          title={expanded ? 'Collapse' : 'Expand'}>
          <span className="text-sm" style={{ color: 'var(--viro-textSub)' }}>
            {expanded ? '◀' : '☰'}
          </span>
        </button>

        {/* Logo */}
        <Link to="/" className="nav-logo-img flex items-center gap-2.5 px-3 mb-5 flex-shrink-0 overflow-hidden">
          <img src={LOGO_URL} alt="Viro"
            className="rounded-xl object-cover flex-shrink-0"
            style={{ width: 40, height: 40, border: '2px solid var(--viro-border)' }}
            onError={e => { e.target.src = '/logo.jpg' }} />
          <div className="brand-name">
            <p className="font-extrabold text-sm leading-tight" style={{ color: 'var(--viro-text)' }}>Viro™</p>
            <p className="text-xs" style={{ color: 'var(--viro-textSub)' }}>viro.pk</p>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 px-2 flex-1">
          {NAV.map(n => {
            const active = location.pathname === n.path
            return (
              <Link key={n.path} to={n.path}
                title={n.label}
                className="nav-item-d flex items-center gap-3 rounded-xl overflow-hidden"
                style={{
                  padding: '10px 10px',
                  background: active ? 'linear-gradient(135deg,#00BFFF18,#8B5CF630)' : 'transparent',
                  color: active ? '#A78BFA' : 'var(--viro-textSub)',
                  border: active ? '1px solid #8B5CF640' : '1px solid transparent',
                  fontWeight: active ? 700 : 500,
                  minWidth: 0,
                }}>
                <span className="text-xl relative flex-shrink-0" style={{ minWidth: 28, textAlign: 'center' }}>
                  {n.icon}
                  {n.label === 'Cart' && cartCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                      style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)', fontSize: 8 }}>
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                  {n.label === 'Wishlist' && wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                      style={{ background: 'linear-gradient(135deg,#F43F5E,#F97316)', fontSize: 8 }}>
                      {wishlistCount > 9 ? '9+' : wishlistCount}
                    </span>
                  )}
                </span>
                <span className="sidebar-label text-sm">{n.label}</span>
                {active && expanded && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#A78BFA' }} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer brand */}
        <div className="px-3 pb-1 pt-3 border-t overflow-hidden" style={{ borderColor: 'var(--viro-navBorder)' }}>
          <p className="text-xs font-bold sidebar-label" style={{ color: 'var(--viro-textSub)', letterSpacing: '0.08em' }}>VIRO © 2026</p>
          <div className="w-7 h-0.5 rounded-full mx-auto" style={{ background: 'linear-gradient(90deg,#00BFFF,#8B5CF6)' }} />
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          background: 'var(--viro-navBg)',
          borderTop: '1px solid var(--viro-navBorder)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transition: 'background 0.35s, border-color 0.35s'
        }}>
        {NAV.map(n => {
          const active = location.pathname === n.path
          return (
            <Link key={n.path} to={n.path} className="flex-1 flex flex-col items-center py-2 gap-0.5 relative transition-all">
              <span className="text-xl relative transition-transform"
                style={{ transform: active ? 'scale(1.15)' : 'scale(1)' }}>
                {n.icon}
                {n.label === 'Cart' && cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                    style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)', fontSize: 9 }}>
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
                {n.label === 'Wishlist' && wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                    style={{ background: 'linear-gradient(135deg,#F43F5E,#F97316)', fontSize: 9 }}>
                    {wishlistCount > 9 ? '9+' : wishlistCount}
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold transition-all" style={{ color: active ? '#A78BFA' : 'var(--viro-textSub)' }}>
                {n.label}
              </span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg,#00BFFF,#8B5CF6)' }} />
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
