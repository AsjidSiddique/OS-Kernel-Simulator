import React from 'react'

// Fix #9: Global error boundary — prevents full blank screen on component crash
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { this.setState({ info }); console.error('Viro ErrorBoundary:', error, info) }
  render() {
    if (this.state.error) return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 32,
        textAlign: 'center', background: '#0F172A', color: '#F1F5F9'
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>😕</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 28, maxWidth: 340 }}>
          We hit an unexpected error. Please tap below to go back to the homepage.
        </p>
        <button
          onClick={() => { this.setState({ error: null }); window.location.href = '/' }}
          style={{
            padding: '12px 32px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
            color: '#fff', fontWeight: 700, fontSize: 15
          }}>
          🏠 Go to Homepage
        </button>
        <a href="https://wa.me/923277796566" style={{ marginTop: 16, color: '#10B981', fontSize: 13 }}>
          💬 Contact Support on WhatsApp
        </a>
      </div>
    )
    return this.props.children
  }
}
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { ThemeProvider } from './context/ThemeContext'
import { SiteSettingsProvider } from './context/SiteSettingsContext'
import ScrollToTop from './components/ScrollToTop'
import TopBar from './components/TopBar'
import Navbar from './components/Navbar'
import WhatsAppButton from './components/WhatsAppButton'
import PWAInstall from './components/PWAInstall'
import ScrollUpArrow from './components/ScrollUpArrow'
import useOneSignal from './hooks/useOneSignal'
import PWAUpdateNotify from './components/PWAUpdateNotify'
import OfflineBanner from './components/OfflineBanner'
import Toast from './components/Toast'
import Footer from './components/Footer'
import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import Admin from './pages/Admin'
import Wishlist from './pages/Wishlist'

function AppInner() {
  const { pathname } = useLocation()
  const isAdmin = pathname === '/adm1n0nly'

  // Init OneSignal push notifications everywhere (runs once)
  useOneSignal()

  if (isAdmin) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--viro-bg)' }}>
        <ScrollToTop />
        <OfflineBanner />
        <Toast />
        <ScrollUpArrow />
        <Routes>
          <Route path="/adm1n0nly" element={<Admin />} />
        </Routes>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--viro-bg)', transition: 'background 0.3s ease' }}>
      <OfflineBanner />
      <TopBar />
      <ScrollToTop />
      <Toast />
      <Navbar />
      <main className="md:ml-16 min-h-screen" id="viro-main" style={{ transition: 'margin-left 0.25s cubic-bezier(.4,0,.2,1)' }}>
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/shop"        element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart"        element={<Cart />} />
          <Route path="/wishlist"    element={<Wishlist />} />
          <Route path="/checkout"    element={<Checkout />} />
          <Route path="/orders"      element={<Orders />} />
          <Route path="/admin"       element={<Navigate to="/" replace />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </main>
      <WhatsAppButton />
      <PWAInstall />
      <PWAUpdateNotify />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <SiteSettingsProvider>
      <ThemeProvider>
        <CartProvider>
          <WishlistProvider>
            <AppInner />
          </WishlistProvider>
        </CartProvider>
      </ThemeProvider>
      </SiteSettingsProvider>
    </ErrorBoundary>
  )
}
