import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { uploadProductImage, deleteProductImage, uploadCategoryImage } from '../lib/storage'
import { showSimpleToast } from '../components/Toast'
import { ORDER_STATUSES, ORDER_STATUS_META } from '../lib/constants'
import { adminApi } from '../lib/adminApi'
import { useSite } from '../context/SiteSettingsContext'
import { PK_CITIES } from '../lib/pakistanCities'


// Convert UTC ISO string to local datetime-local value for the input
function isoToLocalInput(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  // Get local YYYY-MM-DDTHH:MM
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Convert datetime-local string (local time) to ISO string (UTC)
// Fixes the 5-hour shift issue with PKT (UTC+5) timezone
function localDateToISO(localStr) {
  if (!localStr) return null
  // datetime-local gives "YYYY-MM-DDTHH:MM" in LOCAL time
  // new Date(str) without 'Z' treats as local → .toISOString() correctly gives UTC
  const d = new Date(localStr)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}



// Simple promise-based confirm dialog
function adminConfirm(msg) {
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent('viro-admin-confirm', { detail: { msg, resolve } }))
  })
}

function AdminConfirmDialog() {
  const [dialog, setDialog] = useState(null)
  useEffect(() => {
    function handler(e) { setDialog(e.detail) }
    window.addEventListener('viro-admin-confirm', handler)
    return () => window.removeEventListener('viro-admin-confirm', handler)
  }, [])
  if (!dialog) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#1E293B', border: '1px solid #334155' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#334155' }}>
          <p className="font-bold text-white text-sm">{dialog.msg}</p>
        </div>
        <div className="flex gap-2 p-3">
          <button onClick={() => { dialog.resolve(false); setDialog(null) }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#0F172A', color: '#94A3B8', border: '1px solid #334155' }}>
            Cancel
          </button>
          <button onClick={() => { dialog.resolve(true); setDialog(null) }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

const TABS = ['Products', 'Add Product', 'Orders', 'Coupons', 'Reviews', 'Categories', 'Site Settings']

// ─────────────────────────────────────────────────────────────
// Image Uploader Component
// ─────────────────────────────────────────────────────────────
function ImageUploader({ images, onChange }) {
  const inputRef              = useRef()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState([])   // per-file status
  const [dragOver, setDragOver]   = useState(false)

  async function handleFiles(files) {
    if (!files?.length) return
    const fileArr = Array.from(files)
    setUploading(true)
    setProgress(fileArr.map(f => ({ name: f.name, status: 'uploading' })))

    const uploaded = []
    for (let i = 0; i < fileArr.length; i++) {
      try {
        const url = await uploadProductImage(fileArr[i])
        uploaded.push(url)
        setProgress(p => p.map((x, idx) => idx === i ? { ...x, status: 'done', url } : x))
      } catch (e) {
        setProgress(p => p.map((x, idx) => idx === i ? { ...x, status: 'error', msg: e.message } : x))
      }
    }

    onChange([...images, ...uploaded])
    setUploading(false)
    setTimeout(() => setProgress([]), 2500)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  function removeImage(idx) {
    const removed = images[idx]
    // Optionally delete from bucket too — comment out if you want to keep originals
    deleteProductImage(removed).catch(() => {})
    onChange(images.filter((_, i) => i !== idx))
  }

  function moveLeft(idx) {
    if (idx === 0) return
    const arr = [...images]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    onChange(arr)
  }
  function moveRight(idx) {
    if (idx === images.length - 1) return
    const arr = [...images]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    onChange(arr)
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="relative flex flex-col items-center justify-center gap-2 rounded-2xl cursor-pointer transition-all py-8 px-4 text-center"
        style={{
          border: `2px dashed ${dragOver ? '#8B5CF6' : '#1E2A45'}`,
          background: dragOver ? '#8B5CF610' : '#0A0E1A',
        }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3"/>
              <path className="opacity-80" fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-sm text-purple-400 font-semibold">Uploading…</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg,#00BFFF15,#8B5CF620)' }}>
              📸
            </div>
            <p className="text-sm font-semibold text-white">Tap to upload images</p>
            <p className="text-xs text-slate-500">or drag & drop • JPG, PNG, WEBP • multiple allowed</p>
            <p className="text-xs text-slate-600">Uploads to <span className="text-purple-400 font-mono">products_img</span> bucket</p>
          </>
        )}
      </div>

      {/* Per-file progress */}
      {progress.length > 0 && (
        <div className="space-y-1.5">
          {progress.map((p, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{
                background: p.status === 'done' ? '#10B98115' : p.status === 'error' ? '#EF444415' : '#8B5CF615',
                border: `1px solid ${p.status === 'done' ? '#10B98140' : p.status === 'error' ? '#EF444440' : '#8B5CF640'}`,
              }}>
              <span>{p.status === 'done' ? '✅' : p.status === 'error' ? '❌' : '⏳'}</span>
              <span className="flex-1 truncate text-slate-300">{p.name}</span>
              {p.status === 'error' && <span className="text-red-400">{p.msg}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Uploaded images grid */}
      {images.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">
            {images.length} image{images.length > 1 ? 's' : ''} · drag thumbnails to reorder · first = thumbnail
          </p>
          <div className="flex gap-2 flex-wrap">
            {images.map((url, i) => (
              <div key={url} className="relative group flex-shrink-0">
                <img src={url} alt=""
                  className="w-20 h-20 rounded-xl object-cover border-2 transition-all"
                  style={{ borderColor: i === 0 ? '#8B5CF6' : '#1E2A45' }} />

                {/* Badge for first */}
                {i === 0 && (
                  <span className="absolute -top-1.5 -left-1.5 text-xs bg-purple-600 text-white rounded-full px-1.5 py-0.5 font-bold leading-none">
                    cover
                  </span>
                )}

                {/* Controls */}
                <div className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <div className="flex gap-1">
                    <button onClick={() => moveLeft(i)} disabled={i === 0}
                      className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs disabled:opacity-30 flex items-center justify-center">
                      ←
                    </button>
                    <button onClick={() => moveRight(i)} disabled={i === images.length - 1}
                      className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs disabled:opacity-30 flex items-center justify-center">
                      →
                    </button>
                  </div>
                  <button onClick={() => removeImage(i)}
                    className="w-6 h-6 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-xs flex items-center justify-center">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Admin Login
// ─────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showPass, setShowPass] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Fix #6: Hash the entered password client-side before comparing
    // This matches the SHA-256 hash stored in DB by viro-v43-patches.sql
    let hashedPassword = password
    try {
      const msgBuffer = new TextEncoder().encode(password)
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch {
      // crypto.subtle unavailable (non-HTTPS) — fall back to plain text
      hashedPassword = password
    }

    const { data, error: dbErr } = await supabase
      .from('admin_credentials')
      .select('id, username')
      .eq('username', username.trim())
      .eq('password_hash', hashedPassword)
      .single()

    if (dbErr || !data) {
      setError('Invalid username or password.')
      setLoading(false)
      return
    }

    const token = crypto.randomUUID()
    // Fix #20: Include expires_at so session auto-invalidates after 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('admin_sessions').insert({ token, expires_at: expiresAt })
    localStorage.setItem('viro_admin_token', token)
    localStorage.setItem('viro_admin_user', data.username)
    onLogin(data.username)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at 30% 40%, #00BFFF0A 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, #8B5CF615 0%, transparent 50%), #0A0E1A' }}>
      <div className="w-full max-w-sm slide-up">
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <img src="/logo.jpg" alt="Viro" className="w-20 h-20 rounded-2xl object-cover"
              style={{ boxShadow: '0 0 40px #8B5CF640' }} />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)' }}>🔐</div>
          </div>
          <h1 className="font-display text-2xl font-extrabold gradient-text">Admin Panel</h1>
          <p className="text-slate-500 text-sm mt-1">viro.pk — Secure Access</p>
        </div>

        <div className="viro-card p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">👤</span>
                <input value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="admin" required autoComplete="username"
                  style={{ paddingLeft: '2.5rem' }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔑</span>
                <input type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl text-sm text-red-400 fade-in"
                style={{ background: '#EF444415', border: '1px solid #EF444440' }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base font-bold mt-2">
              {loading
                ? <span className="flex items-center gap-2 justify-center">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Signing in...
                  </span>
                : '🔐 Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-slate-600 mt-6">VIRO — VALUE | VARIETY | VISION</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Admin export
// ─────────────────────────────────────────────────────────────
export default function Admin() {
  const [authed, setAuthed]     = useState(false)
  const [adminUser, setAdminUser] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkSession() {
      const token = localStorage.getItem('viro_admin_token')
      const user  = localStorage.getItem('viro_admin_user')
      if (!token) { setChecking(false); return }

      const { data } = await supabase
        .from('admin_sessions')
        .select('id, expires_at')
        .eq('token', token)
        .single()

      if (data && new Date(data.expires_at) > new Date()) {
        setAuthed(true)
        setAdminUser(user || 'admin')
      } else {
        localStorage.removeItem('viro_admin_token')
        localStorage.removeItem('viro_admin_user')
      }
      setChecking(false)
    }
    checkSession()
  }, [])

  async function handleLogout() {
    const token = localStorage.getItem('viro_admin_token')
    if (token) await supabase.from('admin_sessions').delete().eq('token', token)
    localStorage.removeItem('viro_admin_token')
    localStorage.removeItem('viro_admin_user')
    setAuthed(false)
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.jpg" alt="Viro" className="w-16 h-16 rounded-xl object-cover animate-pulse" />
        <p className="text-slate-500 text-sm">Checking session…</p>
      </div>
    </div>
  )

  if (!authed) return <AdminLogin onLogin={u => { setAuthed(true); setAdminUser(u) }} />
  return <AdminDashboard adminUser={adminUser} onLogout={handleLogout} />
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────
function AdminDashboard({ adminUser, onLogout }) {
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [tab, setTab]               = useState('Products')
  const [products, setProducts]     = useState([])
  const [orders, setOrders]         = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [stats, setStats]           = useState({ products: 0, orders: 0, revenue: 0, unpaid: 0 })

  const emptyForm = { name: '', description: '', highlights: '', product_details: '', price: '', discount_price: '', stock: '', images: [], is_active: true, status: 'active', category_id: '', launch_at: '', sale_ends_at: '', sale_active: false, countdown_label: 'Deal Ends In', show_order_count: false }
  const [form, setForm] = useState(emptyForm)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select('*, categories(id,name,icon)').order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }, [])

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order')
    setCategories(data || [])
  }, [])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, customers(*), order_items(*, products(name))')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    const [{ count: pCount }, { count: oCount }, { data: rev }, { count: unpaid }] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('final_total').neq('status', 'CANCELLED'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'UNPAID'),
    ])
    const revenue = (rev || []).reduce((s, o) => s + (o.final_total || 0), 0)
    setStats({ products: pCount || 0, orders: oCount || 0, revenue, unpaid: unpaid || 0 })
  }, [])

  useEffect(() => {
    loadStats()
    loadCategories()
    if (tab === 'Products') loadProducts()
    if (tab === 'Orders')   loadOrders()
  }, [tab])

  function resetForm() {
    setForm(emptyForm)
    setEditProduct(null)
  }

  function startEdit(product) {
    const imgs = Array.isArray(product.images) ? product.images
      : (typeof product.images === 'string' ? JSON.parse(product.images || '[]') : [])
    setForm({
      name:           product.name || '',
      description:    product.description || '',
      highlights:     product.highlights || '',
      product_details: product.product_details || '',
      price:          product.price || '',
      discount_price: product.discount_price || '',
      stock:          product.stock || '',
      images:         imgs,
      is_active:      product.is_active !== false,
      status:         product.status || 'active',
      category_id:    product.category_id || '',
      countdown_ends_at: isoToLocalInput(product.countdown_ends_at),
      launch_at:         isoToLocalInput(product.launch_at),
      sale_ends_at:      isoToLocalInput(product.sale_ends_at),
      sale_active:       product.sale_active || false,
      countdown_label:   product.countdown_label || 'Deal Ends In',
    })
    setEditProduct(product)
    setTab('Add Product')
    window.scrollTo(0, 0)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.images.length === 0) {
      showSimpleToast('⚠️ Please upload at least one product image.', 'info'); return
    }
    setLoading(true)
    const payload = {
      name:              form.name,
      description:       form.description,
      highlights:        form.highlights || null,
      product_details:   form.product_details || null,
      price:             parseFloat(form.price),
      discount_price:    form.discount_price ? parseFloat(form.discount_price) : null,
      stock:             parseInt(form.stock) || 0,
      images:            form.images,
      is_active:         form.is_active,
      // v45: if launch_at is set, status must be coming_soon (stored in DB correctly)
      status:            form.launch_at ? 'coming_soon' : form.status,
      category_id:       form.category_id || null,
      countdown_ends_at: form.countdown_ends_at ? localDateToISO(form.countdown_ends_at) : null,
      launch_at:         form.launch_at ? localDateToISO(form.launch_at) : null,
      sale_ends_at:      form.sale_ends_at ? localDateToISO(form.sale_ends_at) : null,
      sale_active:       form.sale_active || false,
      countdown_label:   form.countdown_label || 'Deal Ends In',
    }
    let err
    if (editProduct) {
      ;({ error: err } = await supabase.from('products').update(payload).eq('id', editProduct.id))
    } else {
      ;({ error: err } = await supabase.from('products').insert(payload))
    }
    setLoading(false)
    if (err) { showSimpleToast('❌ Error: ' + err.message, 'info'); return }
    showSimpleToast(editProduct ? '✅ Product updated!' : '✅ Product added!', 'success')
    resetForm()
    setTab('Products')
  }

  async function deleteProduct(id) {
    if (!(await adminConfirm('Delete this product? This cannot be undone.'))) return
    await supabase.from('products').delete().eq('id', id)
    loadProducts()
    loadStats()
  }

  async function updateOrderStatus(orderId, newStatus) {
    try {
      const result = await adminApi('order_status', { order_id: orderId, new_status: newStatus })
      if (result.message === 'no-op') return
      // Show any stock warnings returned by the Edge Function
      if (result.warnings?.length) {
        result.warnings.forEach(w => showSimpleToast(`⚠️ ${w}`, 'info'))
      }
      // Toast based on new status
      if      (newStatus === 'QUEUE')     showSimpleToast('🕐 Order queued — stock reserved', 'success')
      else if (newStatus === 'CONFIRMED') showSimpleToast('✅ Order confirmed — stock deducted', 'success')
      else if (newStatus === 'CANCELLED') showSimpleToast('↩️ Order cancelled — stock reversed', 'success')
      else showSimpleToast(`📋 Order → ${newStatus}`, 'success')
    } catch (err) {
      showSimpleToast('❌ ' + err.message, 'info')
    }
    loadOrders(); loadStats(); loadProducts()
  }

  // Derived from ORDER_STATUS_META for convenience
  const statusColors = Object.fromEntries(
    Object.entries(ORDER_STATUS_META).map(([k,v]) => [k, v.color])
  )

  return (
    <div className="pb-6 min-h-screen">
      <AdminConfirmDialog />
      <style>{`
        @keyframes adminFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes adminSlideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes statPop {
          0%   { transform: scale(0.88); opacity: 0; }
          70%  { transform: scale(1.04); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes tabFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .admin-stat { animation: statPop 0.4s cubic-bezier(.4,0,.2,1) both; }
        .admin-tab-content { animation: tabFade 0.3s cubic-bezier(.4,0,.2,1) both; }
        .admin-header { animation: adminSlideIn 0.35s cubic-bezier(.4,0,.2,1) both; }
        .admin-tab-btn { transition: all 0.2s; }
        .admin-tab-btn:hover { transform: translateY(-1px); }
        .admin-tab-btn:active { transform: scale(0.97); }
        .stat-card:hover { transform: translateY(-2px); transition: transform 0.2s; }
      `}</style>

      {/* Header */}
      <div className="admin-header px-4 py-3 border-b flex items-center justify-between sticky top-0 z-30"
        style={{ borderColor: '#1E2A45', background: '#0A0E1A' }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Viro" className="w-9 h-9 rounded-xl object-cover" />
          <div>
            <h1 className="font-display text-base font-bold text-white leading-tight">Admin Panel</h1>
            <p className="text-xs text-slate-500">👤 {adminUser}</p>
          </div>
        </div>
        <button onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
          style={{ background: '#EF444415', color: '#F87171', border: '1px solid #EF444430' }}>
          🚪 Logout
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 pt-4 pb-2">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Products', value: stats.products,                        icon: '📦', color: '#00BFFF' },
            { label: 'Orders',   value: stats.orders,                          icon: '📋', color: '#8B5CF6' },
            { label: 'Revenue',  value: `${(stats.revenue/1000).toFixed(1)}k`, icon: '💰', color: '#10B981' },
            { label: 'Unpaid',   value: stats.unpaid,                          icon: '⚠️', color: '#F97316' },
          ].map((s, i) => (
            <div key={s.label} className="admin-stat stat-card viro-card p-3 text-center cursor-default"
              style={{ animationDelay: `${i * 80}ms` }}>
              <div className="text-lg">{s.icon}</div>
              <div className="font-extrabold text-base leading-tight" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide px-4 pt-3 pb-3 gap-2">
        {TABS.map(t => (
          <button key={t} onClick={() => { resetForm(); setTab(t) }}
            className="admin-tab-btn flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold"
            style={tab === t ? {
              background: 'linear-gradient(135deg,#00BFFF,#8B5CF6)', color: '#fff',
              boxShadow: '0 4px 16px #8B5CF640',
            } : { background: '#0F1629', color: 'var(--viro-textMuted)', border: '1px solid #1E2A45' }}>
            {t === 'Products' ? '📦' : t === 'Add Product' ? '➕' : t === 'Orders' ? '📋' : t === 'Coupons' ? '🎟️' : t === 'Reviews' ? '⭐' : t === 'Categories' ? '🗂️' : '⚙️'} {t}
          </button>
        ))}
      </div>

      {/* ── PRODUCTS ── */}

      {/* ══════════════════════════════════════════════════════
          PRODUCTS TAB — bulk select, quick controls, dual timers
      ══════════════════════════════════════════════════════ */}
      {tab === 'Products' && (
        <ProductsTab
          products={products}
          categories={categories}
          loading={loadingProducts}
          onEdit={startEdit}
          onDelete={deleteProduct}
          onToggleVisibility={async (p) => {
            await adminApi('product_update', { id: p.id, patch: { is_active: p.is_active === false } })
            loadProducts()
          }}
          onToggleStatus={async (p, status) => {
            await adminApi('product_update', { id: p.id, patch: { status } })
            loadProducts()
          }}
          onBulkUpdate={async (ids, patch) => {
            await adminApi('product_update', { ids, patch })
            loadProducts()
          }}
          loadProducts={loadProducts}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          ADD / EDIT PRODUCT TAB — dual timers
      ══════════════════════════════════════════════════════ */}
      {tab === 'Add Product' && (
        <div className="px-4">
          {/* Desktop: 2-col — images left, fields right */}
          <div className="md:flex md:gap-5 md:items-start">

            {/* Left col: image uploader */}
            <div className="md:w-72 md:flex-shrink-0 mb-4 md:mb-0">
              <div className="viro-card p-4 md:sticky md:top-16">
                <h2 className="font-bold text-white mb-1 text-sm">
                  {editProduct ? '✏️ Edit Product' : '➕ New Product'}
                </h2>
                <p className="text-xs text-slate-500 mb-3">
                  Images → <span className="text-purple-400 font-mono">products_img</span>
                </p>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Product Images *
                </label>
                <ImageUploader
                  images={form.images}
                  onChange={imgs => setForm(f => ({ ...f, images: imgs }))}
                />
              </div>
            </div>

            {/* Right col: all fields */}
            <div className="flex-1">
              <form onSubmit={handleSubmit} className="viro-card p-4 space-y-3">

                {/* Status + Active toggle row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="rounded-xl text-sm w-full" style={{ padding: '10px 12px' }}>
                      <option value="active">✅ Active</option>
                      <option value="out_of_stock">🚫 Out of Stock</option>
                      <option value="coming_soon">🚀 Coming Soon</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Visibility</label>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                      className="w-full rounded-xl text-sm font-bold py-2.5 transition-all"
                      style={form.is_active
                        ? { background: '#10B98120', color: '#10B981', border: '1px solid #10B98150' }
                        : { background: '#EF444415', color: '#EF4444', border: '1px solid #EF444440' }}>
                      {form.is_active ? '👁 Visible' : '🙈 Hidden'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Product Name *</label>
                  <input value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Samsung Galaxy Buds Pro" required />
                </div>

                {/* Category combobox — main + sub */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Category <span className="text-red-400">*</span>
                    {!form.category_id && <span className="ml-1 text-yellow-400 font-normal normal-case">(required)</span>}
                  </label>
                  {(() => {
                    const parentCats = categories.filter(c => !c.parent_id)
                    const subCats = (pid) => categories.filter(c => c.parent_id === pid)
                    const selectedCat = categories.find(c => c.id === form.category_id)
                    const selectedParentId = selectedCat?.parent_id || (selectedCat ? selectedCat.id : null)
                    const subs = selectedParentId ? subCats(selectedParentId) : []
                    return (
                      <div className="space-y-2">
                        {/* Main category row */}
                        <div className="flex flex-wrap gap-1.5">
                          {parentCats.map(c => {
                            const isActiveParent = form.category_id === c.id || (selectedCat?.parent_id === c.id)
                            return (
                              <button key={c.id} type="button"
                                onClick={() => setForm(f => ({ ...f, category_id: f.category_id === c.id ? '' : c.id }))}
                                className="text-xs px-2.5 py-1.5 rounded-xl transition-all font-bold"
                                style={isActiveParent
                                  ? { background:'#8B5CF6', color:'#fff', boxShadow:'0 2px 8px rgba(139,92,246,0.4)' }
                                  : { background:'#1E2A45', color:'#94A3B8', border:'1px solid #334155' }}>
                                {c.icon} {c.name}
                              </button>
                            )
                          })}
                        </div>
                        {/* Sub-category row (shown when parent selected) */}
                        {subs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-2" style={{ borderLeft:'3px solid #8B5CF650' }}>
                            <button type="button"
                              onClick={() => setForm(f => ({ ...f, category_id: selectedParentId }))}
                              className="text-xs px-2.5 py-1.5 rounded-xl font-bold transition-all"
                              style={form.category_id === selectedParentId
                                ? { background:'#00BFFF', color:'#0B1221' }
                                : { background:'#1E2A45', color:'#64748B', border:'1px solid #334155' }}>
                              All (main)
                            </button>
                            {subs.map(s => (
                              <button key={s.id} type="button"
                                onClick={() => setForm(f => ({ ...f, category_id: f.category_id === s.id ? selectedParentId : s.id }))}
                                className="text-xs px-2.5 py-1.5 rounded-xl font-bold transition-all"
                                style={form.category_id === s.id
                                  ? { background:'#00BFFF', color:'#0B1221' }
                                  : { background:'#1E2A45', color:'#94A3B8', border:'1px solid #334155' }}>
                                {s.icon} {s.name}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Selected display */}
                        {selectedCat && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{ background:'#8B5CF615', border:'1px solid #8B5CF630' }}>
                            <span style={{ fontSize:16 }}>{selectedCat.icon}</span>
                            <span className="text-xs font-bold" style={{ color:'#C4B5FD' }}>
                              {selectedCat.parent_id
                                ? `${parentCats.find(p=>p.id===selectedCat.parent_id)?.name} › ${selectedCat.name}`
                                : selectedCat.name}
                            </span>
                            <button type="button" onClick={()=>setForm(f=>({...f,category_id:''}))}
                              className="ml-auto text-xs font-bold" style={{ color:'#F87171' }}>✕ Clear</button>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</label>
                  <textarea value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the product…" rows={3} style={{ resize: 'none' }} />
                </div>

                {/* Highlights — top bullet features (like Daraz top section) */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Highlights <span className="normal-case font-normal text-slate-600">(bullet features, shown in product details)</span>
                  </label>
                  <textarea value={form.highlights}
                    onChange={e => setForm(f => ({ ...f, highlights: e.target.value }))}
                    placeholder={"• Soft Cotton Jersey – airy comfort for Pakistan summers\n• Gift-Ready – birthdays/Eid\n• Fast Delivery + Easy Returns"}
                    rows={4} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
                  <p className="text-xs mt-1" style={{ color: '#64748b' }}>Each line = one bullet. Use **bold** for emphasis. e.g. <code>• Fabric: **Cotton Jersey**</code></p>
                </div>

                {/* Product Details — specs table (like Daraz bottom section) */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Product Details <span className="normal-case font-normal text-slate-600">(specs & attributes, shown below highlights)</span>
                  </label>
                  <textarea value={form.product_details}
                    onChange={e => setForm(f => ({ ...f, product_details: e.target.value }))}
                    placeholder={"• Fabric: **Soft, breathable cotton jersey** (summer weight)\n• Top: Black crew-neck, half sleeves; **front \"love\" + heart** print\n• Sizes: **S, M, L, XL**\n• Care: Cold machine wash inside-out; no bleach\n• Service: COD | **14-Day Easy Exchange/Return** | Quick Dispatch"}
                    rows={6} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
                  <p className="text-xs mt-1" style={{ color: '#64748b' }}>Each line = one spec row. Use **bold** for values. e.g. <code>• Sizes: **S, M, L, XL**</code></p>
                </div>

                {/* Price row — 3 cols on desktop */}
                {/* Price + Stock row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Price (Rs.) *</label>
                    <input type="number" value={form.price}
                      onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="2000" min="0" step="0.01" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Stock *</label>
                    <input type="number" value={form.stock}
                      onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                      placeholder="50" min="0" required />
                  </div>
                </div>

                {/* ══════════════════════════════════════════
                    v46 DISCOUNT SECTION
                    - Collapsed (button) when no discount_price set
                    - Expanded/maximized when discount_price is set
                    - Optional expiry timer:
                        • No date set → discount is permanent (no expiry)
                        • Date set → when expired, discount_price auto-nulled in DB
                    - While coming_soon timer runs: customer sees discounted price
                      but NOT the sale countdown timer
                    - After coming_soon expires: sale countdown becomes visible
                ══════════════════════════════════════════ */}
                {form.discount_price && parseFloat(form.discount_price) > 0 && parseFloat(form.discount_price) < parseFloat(form.price || 0) ? (
                  /* EXPANDED — discount is set */
                  <div className="p-3 rounded-xl space-y-3" style={{ background:'#F9731610', border:'2px solid #F9731650' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold flex items-center gap-1.5" style={{ color:'#F97316' }}>
                          🔥 Discount Price
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:'#F9731625', color:'#FED7AA' }}>ACTIVE</span>
                        </p>
                        <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                          Customer sees discounted price. Set an expiry to auto-remove it when the timer ends.
                        </p>
                      </div>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, discount_price: '', sale_ends_at: '', sale_active: false }))}
                        className="text-xs underline flex-shrink-0 ml-2" style={{ color:'#EF4444' }}>
                        Remove discount
                      </button>
                    </div>

                    {/* Discount price input */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Discount Price (Rs.)
                      </label>
                      <input type="number" value={form.discount_price}
                        onChange={e => setForm(f => ({ ...f, discount_price: e.target.value }))}
                        placeholder="1500" min="0" step="0.01"
                        style={{ border:'1px solid #F9731650' }} />
                      {form.price && form.discount_price && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:'#10B98120', color:'#10B981' }}>
                            -{Math.round((1 - parseFloat(form.discount_price)/parseFloat(form.price))*100)}% OFF
                          </span>
                          <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                            Customer saves Rs.{(parseFloat(form.price)-parseFloat(form.discount_price)).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Optional expiry timer for discount */}
                    <div className="pt-2" style={{ borderTop:'1px solid #F9731630' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-bold" style={{ color:'#F97316' }}>⏰ Discount Expiry (optional)</p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                            No date = discount is <strong>permanent</strong>. Set a date → price reverts to original when expired.
                          </p>
                        </div>
                        {/* Toggle sale_active */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-xs font-bold" style={{ color: form.sale_active ? '#F97316' : 'var(--viro-textSub)' }}>
                            {form.sale_active ? 'Timer ON' : 'No expiry'}
                          </span>
                          <div
                            onClick={() => setForm(f => ({ ...f, sale_active: !f.sale_active, sale_ends_at: !f.sale_active ? f.sale_ends_at : '' }))}
                            className="relative cursor-pointer rounded-full flex-shrink-0"
                            style={{ width:44, height:24, background: form.sale_active ? '#F97316' : 'var(--viro-border)', transition:'background 0.2s' }}>
                            <div style={{ position:'absolute', top:2, width:20, height:20, borderRadius:'50%', background:'#fff',
                              transform: form.sale_active ? 'translateX(20px)' : 'translateX(2px)', transition:'transform 0.2s',
                              boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
                          </div>
                        </div>
                      </div>

                      {form.sale_active && (
                        <>
                          <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                            <input
                              type="datetime-local"
                              value={form.sale_ends_at || ''}
                              onChange={e => setForm(f => ({ ...f, sale_ends_at: e.target.value }))}
                              style={{ colorScheme:'dark', paddingRight:40, width:'100%' }}
                            />
                            <button type="button"
                              onClick={e => { e.currentTarget.previousSibling.showPicker?.() }}
                              style={{
                                position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
                                width:28, height:28, borderRadius:8, border:'none', cursor:'pointer',
                                background:'linear-gradient(135deg,#F97316,#EF4444)',
                                display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                                boxShadow:'0 2px 6px rgba(249,115,22,0.4)'
                              }}>🗓️</button>
                          </div>

                          <label className="viro-label mt-2">Timer Label (shown on countdown)</label>
                          <input
                            value={form.countdown_label || 'Deal Ends In'}
                            onChange={e => setForm(f => ({ ...f, countdown_label: e.target.value }))}
                            placeholder="e.g. Eid Sale Ends In, Flash Deal"
                          />
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {['Deal Ends In','Eid Sale Ends In','Flash Deal','Weekend Special','Limited Offer'].map(s => (
                              <button key={s} type="button"
                                onClick={() => setForm(f => ({ ...f, countdown_label: s }))}
                                className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                                style={form.countdown_label === s
                                  ? { background:'#F97316', color:'#fff' }
                                  : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
                                {s}
                              </button>
                            ))}
                          </div>

                          {form.sale_ends_at && (
                            <div className="mt-2 p-2 rounded-lg" style={{ background:'#F9731615' }}>
                              <p className="text-xs font-bold" style={{ color:'#F97316' }}>
                                🔥 Discount expires: {new Date(form.sale_ends_at).toLocaleString('en-PK')}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                                After this, price reverts to Rs.{parseFloat(form.price||0).toLocaleString()} automatically
                              </p>
                              {(form.status === 'coming_soon' || form.launch_at) && (
                                <p className="text-xs mt-1" style={{ color:'#A78BFA' }}>
                                  🚀 While Coming Soon timer runs → customer sees discounted price but NOT this countdown. Timer shows after launch.
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {!form.sale_active && (
                        <p className="text-xs" style={{ color:'#10B981' }}>
                          ✅ Discount is permanent — no expiry date set
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* COLLAPSED — no discount set, show a button */
                  <div className="p-3 rounded-xl" style={{ background:'#F9731608', border:'1px dashed #F9731640' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold" style={{ color:'#F97316' }}>🔥 Discount Price</p>
                        <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                          Add a discounted price — section expands to show expiry options
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <input type="number" value={form.discount_price}
                          onChange={e => setForm(f => ({ ...f, discount_price: e.target.value }))}
                          placeholder="e.g. 1500" min="0" step="0.01"
                          style={{ width:110, padding:'8px 10px', borderRadius:10, fontSize:13,
                            background:'var(--viro-bgDeep)', border:'1px solid #F9731650', color:'var(--viro-text)' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Live price preview */}
                {/* ══════════════════════════════════════════
                    v45 DUAL TIMER SECTION
                    Timer 1 (PRIORITY): Coming Soon launch timer
                      - Only visible/expanded when status=coming_soon OR launch_at already set
                      - Button shown when status≠coming_soon & no launch_at — click sets status=coming_soon & expands
                      - When timer ends → DB trigger auto-changes status to active
                      - While active: hides discount timer from customer
                    Timer 2: Sale/discount timer
                      - Only visible to customer when NO coming_soon timer is running
                ══════════════════════════════════════════ */}
                <div className="viro-card p-4 space-y-4" style={{ border:'2px solid #F9731430' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏳</span>
                    <div>
                      <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Dual Timer System</p>
                      <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Coming Soon timer has priority — while active, customers see launch countdown only</p>
                      <p className="text-xs mt-1" style={{ color:'#10B981' }}>✅ Times are in your local timezone — no conversion needed</p>
                    </div>
                  </div>

                  {/* ── Timer 1: Coming Soon → Active (PRIORITY TIMER) ── */}
                  {/* Expanded when: status is coming_soon OR launch_at is set */}
                  {/* Collapsed (button) when: status is NOT coming_soon AND no launch_at */}
                  {(form.status === 'coming_soon' || form.launch_at) ? (
                    <div className="p-3 rounded-xl" style={{ background:'#8B5CF610', border:'2px solid #8B5CF660' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold flex items-center gap-1.5" style={{ color:'#A78BFA' }}>
                            🚀 Timer 1: Coming Soon Launch
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:'#8B5CF630', color:'#C4B5FD' }}>PRIORITY</span>
                          </p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                            When this expires → status auto-changes to <strong style={{color:'#10B981'}}>Active</strong> · Customers won't see discount timer while this runs
                          </p>
                        </div>
                      </div>

                      {/* Status badge — shows current status is coming_soon */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background:'#8B5CF625', color:'#A78BFA', border:'1px solid #8B5CF650' }}>
                          🚀 Status: Coming Soon
                        </span>
                        <button type="button"
                          onClick={() => setForm(f => ({ ...f, status: 'active', launch_at: '' }))}
                          className="text-xs underline" style={{ color:'var(--viro-textSub)' }}>
                          Cancel & set Active
                        </button>
                      </div>

                      <label className="viro-label">Launch Date & Time (stored in DB as UTC)</label>
                      <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                        <input
                          type="datetime-local"
                          value={form.launch_at || ''}
                          onChange={e => setForm(f => ({ ...f, launch_at: e.target.value, status: 'coming_soon' }))}
                          style={{ colorScheme:'dark', paddingRight:40, width:'100%' }}
                        />
                        <button type="button"
                          onClick={e => { e.currentTarget.previousSibling.showPicker?.() }}
                          style={{
                            position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
                            width:28, height:28, borderRadius:8, border:'none', cursor:'pointer',
                            background:'linear-gradient(135deg,#8B5CF6,#A78BFA)',
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                            boxShadow:'0 2px 6px rgba(139,92,246,0.4)'
                          }}>📅</button>
                      </div>

                      {form.launch_at ? (
                        <div className="mt-2 p-2 rounded-lg flex items-center justify-between" style={{ background:'#8B5CF615' }}>
                          <p className="text-xs font-bold" style={{ color:'#A78BFA' }}>
                            🚀 Launches: {new Date(form.launch_at).toLocaleString('en-PK')}
                            {' '}→ then goes <strong style={{color:'#10B981'}}>Active</strong>
                          </p>
                          <button type="button" onClick={() => setForm(f => ({ ...f, launch_at: '' }))}
                            className="text-xs underline flex-shrink-0 ml-2" style={{ color:'#EF4444' }}>Clear timer</button>
                        </div>
                      ) : (
                        <p className="text-xs mt-2" style={{ color:'#F97316' }}>
                          ⚠️ Status is Coming Soon but no timer set — set a date above so it auto-activates, or save as-is to keep it Coming Soon indefinitely
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Collapsed: show a button to enable coming soon timer */
                    <div className="p-3 rounded-xl" style={{ background:'#8B5CF608', border:'1px dashed #8B5CF640' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold" style={{ color:'#A78BFA' }}>🚀 Timer 1: Coming Soon Launch</p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Set a launch countdown — status updates to Coming Soon automatically</p>
                        </div>
                        <button type="button"
                          onClick={() => setForm(f => ({ ...f, status: 'coming_soon' }))}
                          style={{
                            padding:'7px 14px', borderRadius:10, border:'none', cursor:'pointer', flexShrink:0,
                            background:'linear-gradient(135deg,#8B5CF6,#A78BFA)', color:'#fff',
                            fontWeight:700, fontSize:12, boxShadow:'0 2px 8px rgba(139,92,246,0.4)'
                          }}>
                          Set Coming Soon
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Combined timer logic preview */}
                  {(form.launch_at || (form.sale_active && form.sale_ends_at)) && (
                    <div className="p-3 rounded-xl" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                      <p className="text-xs font-bold mb-2" style={{ color:'var(--viro-text)' }}>📋 What Customer Sees</p>
                      {form.launch_at && (
                        <p className="text-xs mb-1" style={{ color:'#A78BFA' }}>
                          🚀 <strong>While Coming Soon:</strong> launch countdown shown
                          {form.discount_price && parseFloat(form.discount_price) < parseFloat(form.price||0)
                            ? ` · Discounted price (Rs.${parseFloat(form.discount_price).toLocaleString()}) visible — but NO sale timer yet`
                            : ''}
                        </p>
                      )}
                      {form.sale_active && form.sale_ends_at && (
                        <p className="text-xs mb-1" style={{ color:'#F97316' }}>
                          🔥 <strong>{form.launch_at ? 'After launch:' : 'Now:'}</strong> discount timer runs until{' '}
                          {new Date(form.sale_ends_at).toLocaleString('en-PK')} → then price reverts to Rs.{parseFloat(form.price||0).toLocaleString()}
                        </p>
                      )}
                      {form.launch_at && form.sale_active && form.sale_ends_at && (
                        <p className="text-xs mt-1" style={{ color:'#10B981' }}>
                          ✅ Coming Soon timer runs first → after launch, discount countdown becomes visible
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {form.price && (
                  <div className="p-3 rounded-xl" style={{ background: '#080C18', border: '1px solid #1E2A45' }}>
                    <p className="text-xs text-slate-500 mb-1.5">👁️ Customer sees:</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-lg font-extrabold" style={{ color: '#00BFFF' }}>
                        Rs. {parseFloat(form.discount_price || form.price || 0).toLocaleString()}
                      </span>
                      {form.discount_price && parseFloat(form.discount_price) < parseFloat(form.price) && (
                        <>
                          <span className="text-slate-500 line-through text-sm">
                            Rs. {parseFloat(form.price).toLocaleString()}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full text-white font-bold"
                            style={{ background: 'linear-gradient(135deg,#8B5CF6,#F97316)' }}>
                            -{Math.round((1 - parseFloat(form.discount_price) / parseFloat(form.price)) * 100)}% OFF
                          </span>
                          <span className="text-xs text-emerald-400">
                            Save Rs. {(parseFloat(form.price) - parseFloat(form.discount_price)).toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={loading} className="btn-primary flex-1 py-3 font-bold text-sm">
                    {loading
                      ? <span className="flex items-center gap-2 justify-center">
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          Saving…
                        </span>
                      : editProduct ? '✅ Update Product' : '➕ Add Product'}
                  </button>
                  {editProduct && (
                    <button type="button" onClick={resetForm} className="btn-ghost px-5 py-3 text-sm">Cancel</button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDERS ── */}
      {tab === 'Orders' && (
        <OrdersTab
          orders={orders}
          loading={loading}
          statusColors={statusColors}
          updateOrderStatus={updateOrderStatus}
          onReload={loadOrders}
        />
      )}
      {/* ── CATEGORIES ── */}
      {tab === 'Coupons'  && <CouponsTab />}
      {tab === 'Reviews'  && <ReviewsTab />}

      {tab === 'Categories' && (
        <CategoriesTab
          categories={categories}
          onReload={loadCategories}
        />
      )}
      {/* ── SITE SETTINGS ── */}
      {tab === 'Site Settings' && (
        <SiteSettingsTab />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ProductsTab — with bulk select, quick controls, inline timers
// ══════════════════════════════════════════════════════════════
function ProductsTab({ products, categories, loading, onEdit, onDelete, onToggleVisibility, onToggleStatus, onBulkUpdate, loadProducts }) {
  const [selected,     setSelected]     = useState(new Set())
  const [filterCat,    setFilterCat]    = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search,       setSearch]       = useState('')
  const [bulkPanel,    setBulkPanel]    = useState(false)
  const [bulkAction,   setBulkAction]   = useState('')
  const [bulkDiscount, setBulkDiscount] = useState('')
  const [bulkLaunch,   setBulkLaunch]   = useState('')
  const [bulkSaleEnd,  setBulkSaleEnd]  = useState('')
  const [bulkStatus,   setBulkStatus]   = useState('')
  const [applying,     setApplying]     = useState(false)

  const parentCats = (categories||[]).filter(c => !c.parent_id)

  const filtered = products.filter(p => {
    if (search && !p.name?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCat !== 'all') {
      const childIds = (categories||[]).filter(c=>c.parent_id===filterCat).map(c=>c.id)
      if (p.category_id !== filterCat && !childIds.includes(p.category_id)) return false
    }
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    return true
  })

  const allSelected  = filtered.length > 0 && filtered.every(p => selected.has(p.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map(p => p.id)))
  }
  function toggle(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function deselect(id) { setSelected(s => { const n = new Set(s); n.delete(id); return n }) }

  async function applyBulk() {
    if (!selected.size) return
    setApplying(true)
    const ids = [...selected]
    let patch = {}

    if (bulkAction === 'hide')       patch = { is_active: false }
    if (bulkAction === 'show')       patch = { is_active: true }
    if (bulkAction === 'coming_soon')patch = { status: 'coming_soon' }
    if (bulkAction === 'active')     patch = { status: 'active' }
    if (bulkAction === 'out_of_stock') patch = { status: 'out_of_stock' }
    if (bulkAction === 'discount' && bulkDiscount) {
      // Apply % discount to each product individually.
      // IMPORTANT: always clear sale_ends_at so any old expired timer
      // doesn't block the new discount from being shown (v46 fix).
      for (const id of ids) {
        const prod = products.find(p => p.id === id)
        if (prod?.price) {
          const disc = prod.price * (1 - parseFloat(bulkDiscount)/100)
          await adminApi('product_update', { id, patch: {
            discount_price: Math.round(disc),
            sale_active:    false,   // no timer — permanent discount until removed
            sale_ends_at:   null,    // clear any old expired timer
          }})
        }
      }
      loadProducts(); setApplying(false); setBulkPanel(false); setSelected(new Set()); return
    }
    if (bulkAction === 'remove_discount') patch = { discount_price: null, sale_active: false, sale_ends_at: null }
    if (bulkAction === 'launch_timer' && bulkLaunch) patch = { launch_at: new Date(bulkLaunch).toISOString(), status: 'coming_soon' }
    if (bulkAction === 'sale_timer' && bulkSaleEnd)  patch = { sale_ends_at: new Date(bulkSaleEnd).toISOString(), sale_active: true }
    if (bulkAction === 'clear_timers') patch = { launch_at: null, sale_ends_at: null, sale_active: false, countdown_ends_at: null }

    if (Object.keys(patch).length) {
      await adminApi('product_update', { ids, patch })
    }
    loadProducts()
    setApplying(false)
    setBulkPanel(false)
    setSelected(new Set())
  }

  const STATUS_COLORS = {
    active:'#10B981', coming_soon:'#8B5CF6', out_of_stock:'#EF4444', coming_soon_hidden:'#F97316'
  }

  if (loading) return (
    <div className="px-4 py-8 flex items-center justify-center gap-2">
      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3"/>
        <path className="opacity-75" fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span style={{ color:'var(--viro-textSub)' }}>Loading…</span>
    </div>
  )

  return (
    <div className="px-3 md:px-4 pb-6 fade-in">

      {/* ── Search + category + status filters ── */}
      <div className="space-y-2 mb-3">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Search products…"
          style={{ background:'var(--viro-bgCard)', borderColor:'var(--viro-border)' }} />
        <div className="flex gap-2 flex-wrap">
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
            className="flex-1 text-sm rounded-xl" style={{ padding:'8px 10px', minWidth:0 }}>
            <option value="all">All Categories</option>
            {parentCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
            className="flex-1 text-sm rounded-xl" style={{ padding:'8px 10px', minWidth:0 }}>
            <option value="all">All Status</option>
            <option value="active">✅ Active</option>
            <option value="coming_soon">🚀 Coming Soon</option>
            <option value="out_of_stock">⛔ Out of Stock</option>
          </select>
        </div>
      </div>

      {/* ── Select all + bulk action bar ── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold"
          style={{ color:'var(--viro-text)' }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll}
            style={{ width:16, height:16, accentColor:'#8B5CF6', cursor:'pointer' }} />
          {someSelected ? `${selected.size} selected` : `Select All (${filtered.length})`}
        </label>

        {someSelected && (
          <button onClick={() => setBulkPanel(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
            style={{ background:'linear-gradient(135deg,#8B5CF6,#F97316)' }}>
            ⚡ Bulk Action ({selected.size})
          </button>
        )}
        {someSelected && (
          <button onClick={() => setSelected(new Set())}
            className="text-xs" style={{ color:'var(--viro-textSub)' }}>
            Deselect
          </button>
        )}
      </div>

      {/* ── Products list ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-10" style={{ color:'var(--viro-textSub)' }}>
          <div className="text-4xl mb-2">📦</div>
          <p className="font-semibold" style={{ color:'var(--viro-text)' }}>No products found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const imgs     = Array.isArray(p.images) ? p.images : JSON.parse(p.images||'[]')
            const thumb    = imgs[0] || 'https://placehold.co/100/1E293B/8B5CF6?text=V'
            const hasDisc  = p.discount_price && p.discount_price < p.price
            const isSelected = selected.has(p.id)
            const sc       = STATUS_COLORS[p.status] || '#94A3B8'
            const hasLaunch= p.launch_at && new Date(p.launch_at) > new Date()
            const hasSale  = p.sale_active && p.sale_ends_at && new Date(p.sale_ends_at) > new Date()

            return (
              <div key={p.id}
                className="rounded-2xl overflow-hidden transition-all cursor-pointer group"
                onClick={e => {
                  // Don't open edit if clicking checkbox or action buttons
                  if (e.target.closest('button') || e.target.closest('input[type=checkbox]')) return
                  onEdit(p)
                }}
                style={{
                  background:'var(--viro-bgCard)',
                  border: isSelected ? '2px solid #8B5CF6' : '1px solid var(--viro-border)',
                  boxShadow: isSelected ? '0 0 0 3px #8B5CF620' : '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}>
                {/* Main row */}
                <div className="p-3 flex gap-3 items-start">
                  {/* Checkbox */}
                  <input type="checkbox" checked={isSelected}
                    onChange={e => { e.stopPropagation(); toggle(p.id) }}
                    onClick={e => e.stopPropagation()}
                    className="mt-1 flex-shrink-0"
                    style={{ width:16, height:16, accentColor:'#8B5CF6', cursor:'pointer' }} />

                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0">
                    <img src={thumb} alt={p.name} className="w-16 h-16 rounded-xl object-cover group-hover:opacity-90 transition-opacity" />
                    {imgs.length > 1 && (
                      <span className="absolute -bottom-1 -right-1 text-xs rounded-full w-5 h-5 flex items-center justify-center"
                        style={{ background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)', fontSize:9 }}>
                        {imgs.length}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-bold text-sm leading-tight" style={{ color:'var(--viro-text)' }}>{p.name}</p>
                      <span className="text-xs flex-shrink-0 ml-1" style={{ color:'var(--viro-textSub)' }}>
                        {p.categories?.icon}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-sm font-black" style={{ color:'#A78BFA' }}>
                        Rs.{(hasDisc?p.discount_price:p.price)?.toLocaleString()}
                      </span>
                      {hasDisc && (
                        <>
                          <span className="text-xs line-through" style={{ color:'var(--viro-textSub)' }}>Rs.{p.price?.toLocaleString()}</span>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background:'#10B98120', color:'#10B981' }}>
                            -{Math.round((1-p.discount_price/p.price)*100)}%
                          </span>
                        </>
                      )}
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background:sc+'20', color:sc }}>
                        {p.status==='coming_soon' ? '🚀 Soon'
                          : p.status==='out_of_stock' ? '⛔ Out'
                          : (
                            <span style={{ fontSize:10 }}>
                              <span style={{ fontWeight:800 }}>{p.stock}</span>
                              <span style={{ color:'var(--viro-textSub)' }}> stk</span>
                              {(p.stock_queue ?? 0) > 0 && (
                                <span> · <span style={{ color:'#EAB308', fontWeight:700 }}>{p.stock_queue}Q</span></span>
                              )}
                              {(p.stock_complete ?? 0) > 0 && (
                                <span> · <span style={{ color:'#10B981', fontWeight:700 }}>{p.stock_complete}✓</span>
                                {p.show_order_count && <span style={{ color:'#F97316', fontSize:8 }}> 🔥</span>}
                                </span>
                              )}
                            </span>
                          )}
                      </span>
                      {p.is_active===false && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background:'#F9731620', color:'#F97316' }}>🙈 Hidden</span>
                      )}
                      {hasLaunch && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background:'#8B5CF620', color:'#A78BFA' }}>🚀 Launches {new Date(p.launch_at).toLocaleDateString('en-PK')}</span>}
                      {hasSale   && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background:'#F9731620', color:'#F97316' }}>🔥 Sale until {new Date(p.sale_ends_at).toLocaleDateString('en-PK')}</span>}
                    </div>
                  </div>

                  {/* Quick actions — vertical stack */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => onEdit(p)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{ background:'#8B5CF615', border:'1px solid #8B5CF640', color:'#A78BFA' }}>
                      ✏️
                    </button>
                    <button
                      onClick={async () => {
                        await adminApi('product_update', { id: p.id, patch: { is_active: p.is_active === false } })
                        loadProducts()
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={p.is_active===false
                        ? { background:'#10B98115', border:'1px solid #10B98140', color:'#10B981' }
                        : { background:'#F9731315', border:'1px solid #F9731340', color:'#FB923C' }}>
                      {p.is_active===false ? '👁' : '🙈'}
                    </button>
                    <button onClick={() => onDelete(p.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{ background:'#EF444415', border:'1px solid #EF444430', color:'#F87171' }}>
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Quick inline controls row */}
                <div className="px-3 pb-2.5 flex gap-1.5 flex-wrap border-t" style={{ borderColor:'var(--viro-border)', paddingTop:8 }}>
                  {/* Status quick set */}
                  {['active','coming_soon','out_of_stock'].map(s => (
                    <button key={s}
                      onClick={async () => {
                        await adminApi('product_update', { id: p.id, patch: { status:s, ...(s==='active'?{is_active:true}:{}) } })
                        loadProducts()
                      }}
                      className="px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                      style={p.status===s
                        ? { background:(STATUS_COLORS[s]||'#94A3B8')+'30', color:STATUS_COLORS[s]||'#94A3B8', border:`1px solid ${(STATUS_COLORS[s]||'#94A3B8')}60` }
                        : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
                      {s==='active'?'✅ Active':s==='coming_soon'?'🚀 Soon':'⛔ Out'}
                    </button>
                  ))}
                  {/* Quick discount remove */}
                  {hasDisc && (
                    <button
                      onClick={async () => {
                        await adminApi('product_update', { id: p.id, patch: { discount_price:null, sale_active:false, sale_ends_at:null } })
                        loadProducts()
                      }}
                      className="px-2 py-1 rounded-lg text-xs font-semibold"
                      style={{ background:'#EF444415', color:'#F87171', border:'1px solid #EF444430' }}>
                      ✕ Discount
                    </button>
                  )}
                  {/* Clear timers if any */}
                  {(hasLaunch||hasSale) && (
                    <button
                      onClick={async () => {
                        await adminApi('product_update', { id: p.id, patch: { launch_at:null, sale_ends_at:null, sale_active:false } })
                        loadProducts()
                      }}
                      className="px-2 py-1 rounded-lg text-xs font-semibold"
                      style={{ background:'#8B5CF615', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
                      ⏹ Clear Timers
                    </button>
                  )}

                  {/* ── Reviews per-product toggle ── */}
                  <button
                    title={p.reviews_enabled !== false ? 'Disable reviews for this product' : 'Enable reviews'}
                    onClick={async e => {
                      e.stopPropagation()
                      await adminApi('product_update', { id: p.id, patch: { reviews_enabled: p.reviews_enabled === false } })
                      loadProducts()
                    }}
                    style={{
                      fontSize:10, padding:'3px 8px', borderRadius:8, cursor:'pointer', border:'none',
                      background: p.reviews_enabled !== false ? '#FBBF2415' : '#1E293B',
                      color:      p.reviews_enabled !== false ? '#FBBF24'   : '#64748B',
                      fontWeight:700,
                      outline: p.reviews_enabled !== false ? '1.5px solid #FBBF2440' : '1px solid #334155',
                    }}>
                    {p.reviews_enabled !== false ? '⭐ Reviews ON' : '⭐ Reviews OFF'}
                  </button>

                  {/* ── Order badge per-product toggle ── */}
                  <button
                    title={p.show_order_count ? 'Hide order count badge' : 'Show order count badge'}
                    onClick={async e => {
                      e.stopPropagation()
                      await adminApi('product_update', { id: p.id, patch: { show_order_count: !p.show_order_count } })
                      loadProducts()
                    }}
                    style={{
                      fontSize:10, padding:'3px 8px', borderRadius:8, cursor:'pointer', border:'none',
                      background: p.show_order_count ? '#F9731615' : '#1E293B',
                      color:      p.show_order_count ? '#F97316'   : '#64748B',
                      fontWeight:700,
                      outline: p.show_order_count ? '1.5px solid #F9731640' : '1px solid #334155',
                    }}>
                    {p.show_order_count ? '🔥 Badge ON' : '🔥 Badge OFF'}
                  </button>

                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          BULK ACTION MODAL
      ══════════════════════════════════════════════════════ */}
      {bulkPanel && (
        <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center"
          style={{ background:'rgba(0,0,0,0.65)', backdropFilter:'blur(6px)' }}
          onClick={e => e.target===e.currentTarget && setBulkPanel(false)}>
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-3xl overflow-hidden"
            style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)',
              maxHeight:'90vh', display:'flex', flexDirection:'column',
              animation:'popIn 0.3s cubic-bezier(.4,0,.2,1)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor:'var(--viro-border)' }}>
              <div>
                <h2 className="font-extrabold text-base" style={{ color:'var(--viro-text)' }}>
                  ⚡ Bulk Action
                </h2>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                  Apply to {selected.size} selected product{selected.size!==1?'s':''}
                </p>
              </div>
              <button onClick={() => setBulkPanel(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background:'var(--viro-bgDeep)', color:'var(--viro-textSub)' }}>✕</button>
            </div>

            {/* Category filter for deselecting */}
            <div className="px-5 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>
                Selected products:
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {[...selected].map(id => {
                  const p = products.find(x=>x.id===id)
                  if (!p) return null
                  return (
                    <span key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
                      {p.name.slice(0,20)}{p.name.length>20?'…':''}
                      <button onClick={() => deselect(id)} className="text-xs opacity-60 hover:opacity-100 ml-0.5">✕</button>
                    </span>
                  )
                })}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Action selector */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>Choose Action</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v:'show',           l:'👁 Show All',          c:'#10B981' },
                    { v:'hide',           l:'🙈 Hide All',          c:'#F97316' },
                    { v:'active',         l:'✅ Set Active',         c:'#10B981' },
                    { v:'coming_soon',    l:'🚀 Set Coming Soon',   c:'#8B5CF6' },
                    { v:'out_of_stock',   l:'⛔ Set Out of Stock',  c:'#EF4444' },
                    { v:'discount',       l:'💸 Set % Discount',    c:'#00BFFF' },
                    { v:'remove_discount',l:'✕ Remove Discount',   c:'#94A3B8' },
                    { v:'launch_timer',   l:'🚀 Set Launch Timer',  c:'#A78BFA' },
                    { v:'sale_timer',     l:'🔥 Set Sale Timer',    c:'#F97316' },
                    { v:'clear_timers',   l:'⏹ Clear All Timers',  c:'#64748B' },
                  ].map(a => (
                    <button key={a.v} onClick={() => setBulkAction(a.v)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-left transition-all"
                      style={bulkAction===a.v
                        ? { background:a.c+'25', color:a.c, border:`1px solid ${a.c}60` }
                        : { background:'var(--viro-bgDeep)', color:'var(--viro-textMuted)', border:'1px solid var(--viro-border)' }}>
                      {a.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount % input */}
              {bulkAction==='discount' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                    Discount Percentage (%)
                  </label>
                  <input type="number" value={bulkDiscount} onChange={e=>setBulkDiscount(e.target.value)}
                    placeholder="e.g. 20 for 20% off" min="1" max="99" />
                  <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                    Each product's discount price will be set to original price × (1 - %/100)
                  </p>
                </div>
              )}

              {/* Launch timer input */}
              {bulkAction==='launch_timer' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                    Launch Date & Time
                  </label>
                  <input type="datetime-local" value={bulkLaunch} onChange={e=>setBulkLaunch(e.target.value)}
                    style={{ colorScheme:'dark' }} />
                  <p className="text-xs mt-1" style={{ color:'#A78BFA' }}>
                    All selected products will be set to Coming Soon until this date
                  </p>
                </div>
              )}

              {/* Sale timer input */}
              {bulkAction==='sale_timer' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                    Sale End Date & Time
                  </label>
                  <input type="datetime-local" value={bulkSaleEnd} onChange={e=>setBulkSaleEnd(e.target.value)}
                    style={{ colorScheme:'dark' }} />
                  <p className="text-xs mt-1" style={{ color:'#F97316' }}>
                    Sale timer will be activated on all selected products
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor:'var(--viro-border)' }}>
              <button onClick={() => setBulkPanel(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm border"
                style={{ background:'transparent', color:'var(--viro-textMuted)', borderColor:'var(--viro-border)' }}>
                Cancel
              </button>
              <button onClick={applyBulk} disabled={!bulkAction || applying}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                style={{ background:'linear-gradient(135deg,#8B5CF6,#F97316)' }}>
                {applying ? 'Applying…' : `Apply to ${selected.size} products`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}





// ─────────────────────────────────────────────────────────────
// Orders Tab — LinkedIn-style multi-filter panel + full analytics
// ─────────────────────────────────────────────────────────────
function OrdersTab({ orders, loading, statusColors, updateOrderStatus, onReload }) {
  const [showFilters, setShowFilters]   = useState(false)
  const [expanded,    setExpanded]      = useState(null)
  const [viewMode,    setViewMode]      = useState('list') // 'list' | 'grid'

  // ── Filter state ─────────────────────────────────────────
  const [selectedStatuses, setSelectedStatuses] = useState([])
  const [selectedCities,   setSelectedCities]   = useState([])
  const [minAmount, setMinAmount]   = useState('')
  const [maxAmount, setMaxAmount]   = useState('')
  const [minItems,  setMinItems]    = useState('')
  const [maxItems,  setMaxItems]    = useState('')
  const [dateFrom,  setDateFrom]    = useState('')
  const [dateTo,    setDateTo]      = useState('')
  const [search,    setSearch]      = useState('')
  const [sortBy,    setSortBy]      = useState('newest')
  const [pendingFilters, setPending] = useState({
    statuses: [], cities: [], minAmount: '', maxAmount: '',
    minItems: '', maxItems: '', dateFrom: '', dateTo: ''
  })

  // Draft state for the modal
  const [draft, setDraft] = useState(pendingFilters)

  const STATUS_LIST = ['UNPAID','QUEUE','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED']

  // Unique cities from real orders
  const orderCities = [...new Set(orders.map(o => o.customers?.city).filter(Boolean))].sort()

  // ── Analytics ────────────────────────────────────────────
  const today    = new Date().toDateString()
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today)
  const unpaid   = orders.filter(o => o.status === 'UNPAID').length
  const delivered= orders.filter(o => o.status === 'DELIVERED').length
  const totalRev = orders.filter(o => o.status !== 'CANCELLED').reduce((s,o) => s + (o.final_total||0), 0)
  const avgOrder = orders.length ? Math.round(totalRev / orders.length) : 0

  // Top products
  const productCounts = {}
  orders.forEach(o => (o.order_items||[]).forEach(i => {
    const n = i.products?.name || 'Unknown'
    productCounts[n] = (productCounts[n]||0) + i.quantity
  }))
  const topProducts = Object.entries(productCounts).sort((a,b)=>b[1]-a[1]).slice(0,5)

  // Revenue by city
  const cityRev = {}
  orders.filter(o=>o.status!=='CANCELLED').forEach(o => {
    const c = o.customers?.city || 'Unknown'
    cityRev[c] = (cityRev[c]||0) + (o.final_total||0)
  })
  const topCities = Object.entries(cityRev).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const maxCityRev = topCities[0]?.[1] || 1

  // Status breakdown
  const statusCounts = {}
  STATUS_LIST.forEach(s => { statusCounts[s] = orders.filter(o=>o.status===s).length })

  // ── Apply / Reset filters ────────────────────────────────
  function applyFilters() {
    setSelectedStatuses(draft.statuses)
    setSelectedCities(draft.cities)
    setMinAmount(draft.minAmount)
    setMaxAmount(draft.maxAmount)
    setMinItems(draft.minItems)
    setMaxItems(draft.maxItems)
    setDateFrom(draft.dateFrom)
    setDateTo(draft.dateTo)
    setPending(draft)
    setShowFilters(false)
  }
  function resetFilters() {
    const empty = { statuses:[], cities:[], minAmount:'', maxAmount:'', minItems:'', maxItems:'', dateFrom:'', dateTo:'' }
    setDraft(empty); setPending(empty)
    setSelectedStatuses([]); setSelectedCities([])
    setMinAmount(''); setMaxAmount('')
    setMinItems(''); setMaxItems('')
    setDateFrom(''); setDateTo('')
  }
  function openFilters() { setDraft(pendingFilters); setShowFilters(true) }

  const activeFilterCount = selectedStatuses.length + selectedCities.length +
    (minAmount||maxAmount?1:0) + (minItems||maxItems?1:0) + (dateFrom||dateTo?1:0)

  // ── Filter + sort orders ─────────────────────────────────
  const filtered = orders.filter(o => {
    const q = search.toLowerCase().replace(/^#/, '') // strip leading # if typed
    if (q && !(
      o.customers?.name?.toLowerCase().includes(q) ||
      o.customers?.phone?.includes(q) ||
      o.customers?.city?.toLowerCase().includes(q) ||
      o.customers?.address?.toLowerCase().includes(q) ||
      (o.order_items||[]).some(i => i.products?.name?.toLowerCase().includes(q)) ||
      (o.id || '').toLowerCase().includes(q) ||                          // full UUID
      (o.id || '').slice(0,8).toLowerCase().includes(q)                 // short order #
    )) return false
    if (selectedStatuses.length && !selectedStatuses.includes(o.status)) return false
    if (selectedCities.length  && !selectedCities.includes(o.customers?.city)) return false
    if (minAmount && (o.final_total||0) < parseFloat(minAmount)) return false
    if (maxAmount && (o.final_total||0) > parseFloat(maxAmount)) return false
    const items = (o.order_items||[]).reduce((s,i)=>s+i.quantity,0)
    if (minItems && items < parseInt(minItems)) return false
    if (maxItems && items > parseInt(maxItems)) return false
    if (dateFrom && new Date(o.created_at) < new Date(dateFrom)) return false
    if (dateTo   && new Date(o.created_at) > new Date(dateTo + 'T23:59:59')) return false
    return true
  }).sort((a,b) => {
    if (sortBy === 'newest')   return new Date(b.created_at) - new Date(a.created_at)
    if (sortBy === 'oldest')   return new Date(a.created_at) - new Date(b.created_at)
    if (sortBy === 'highest')  return (b.final_total||0) - (a.final_total||0)
    if (sortBy === 'lowest')   return (a.final_total||0) - (b.final_total||0)
    return 0
  })

  // ── Draft helpers ────────────────────────────────────────
  function toggleDraftStatus(s) {
    setDraft(d => ({ ...d, statuses: d.statuses.includes(s) ? d.statuses.filter(x=>x!==s) : [...d.statuses, s] }))
  }
  function toggleDraftCity(c) {
    setDraft(d => ({ ...d, cities: d.cities.includes(c) ? d.cities.filter(x=>x!==c) : [...d.cities, c] }))
  }

  if (loading) return (
    <div className="px-4 py-10 flex items-center justify-center gap-3">
      <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#8B5CF6" strokeWidth="3"/>
        <path className="opacity-75" fill="#8B5CF6" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span style={{ color:'var(--viro-textSub)' }}>Loading orders…</span>
    </div>
  )

  return (
    <div className="px-3 md:px-4 pb-10 fade-in">

      {/* ── Analytics Strip ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {[
          { label:'Total',    value: orders.length,        icon:'📋', color:'#8B5CF6' },
          { label:'Today',    value: todayOrders.length,   icon:'📅', color:'#00BFFF' },
          { label:'Unpaid',   value: unpaid,               icon:'⚠️', color:'#F97316' },
          { label:'Queue',    value: orders.filter(o => o.status === 'QUEUE').length, icon:'🕐', color:'#EAB308' },
          { label:'Delivered',value: delivered,            icon:'📦', color:'#10B981' },
          { label:'Avg Order',value: `Rs.${avgOrder.toLocaleString()}`, icon:'💰', color:'#EC4899' },
        ].map((s,i) => (
          <div key={s.label} className="viro-card p-3 text-center"
            style={{ animation: `statPop 0.35s ${i*0.05}s ease both` }}>
            <div className="text-xl mb-0.5">{s.icon}</div>
            <div className="font-extrabold text-base leading-tight" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color:'var(--viro-textSub)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Status + Revenue Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* Status breakdown */}
        <div className="viro-card p-3">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>Status Breakdown</p>
          <div className="space-y-1.5">
            {STATUS_LIST.map(s => {
              const cnt   = statusCounts[s] || 0
              const pct   = orders.length ? (cnt/orders.length)*100 : 0
              const sc    = statusColors[s] || '#94A3B8'
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-20 flex-shrink-0" style={{ color: sc }}>{s}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:'var(--viro-bgDeep)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width:`${pct}%`, background: sc }} />
                  </div>
                  <span className="text-xs w-5 text-right font-bold" style={{ color:'var(--viro-text)' }}>{cnt}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Revenue by city */}
        <div className="viro-card p-3">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>Revenue by City</p>
          {topCities.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color:'var(--viro-textSub)' }}>No data yet</p>
          ) : (
            <div className="space-y-1.5">
              {topCities.map(([city, rev]) => (
                <div key={city} className="flex items-center gap-2">
                  <span className="text-xs w-20 truncate flex-shrink-0" style={{ color:'var(--viro-text)' }}>{city}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:'var(--viro-bgDeep)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width:`${(rev/maxCityRev)*100}%`, background:'linear-gradient(90deg,#00BFFF,#8B5CF6)' }} />
                  </div>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color:'#00BFFF', minWidth:50, textAlign:'right' }}>
                    Rs.{(rev/1000).toFixed(1)}k
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Top Products ── */}
      {topProducts.length > 0 && (
        <div className="viro-card p-3 mb-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>🏆 Top Selling Products</p>
          <div className="flex flex-wrap gap-2">
            {topProducts.map(([name, qty], i) => (
              <div key={name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: i===0 ? 'linear-gradient(135deg,#F9731620,#F9731640)' : 'var(--viro-bgDeep)',
                  border:`1px solid ${i===0?'#F97316':'var(--viro-border)'}`,
                  color: i===0 ? '#F97316' : 'var(--viro-text)' }}>
                {i===0 && '🥇'}{i===1 && '🥈'}{i===2 && '🥉'}
                <span className="truncate max-w-[120px]">{name}</span>
                <span className="ml-1 font-bold">{qty} sold</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Search + Filter bar ── */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base" style={{ color:'var(--viro-textSub)' }}>🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, phone, city, product…"
            style={{ paddingLeft:'2.5rem', background:'var(--viro-bgCard)', borderColor:'var(--viro-border)' }}
          />
        </div>

        {/* Filter button */}
        <button onClick={openFilters}
          className="flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm flex-shrink-0 transition-all relative"
          style={{
            background: activeFilterCount > 0 ? 'linear-gradient(135deg,#00BFFF,#8B5CF6)' : 'var(--viro-bgCard)',
            color: activeFilterCount > 0 ? '#fff' : 'var(--viro-text)',
            border: `1px solid ${activeFilterCount > 0 ? 'transparent' : 'var(--viro-border)'}`,
          }}>
          ⚙️ Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
              style={{ background:'#F97316' }}>{activeFilterCount}</span>
          )}
        </button>

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="flex-shrink-0 text-sm rounded-xl px-2"
          style={{ background:'var(--viro-bgCard)', borderColor:'var(--viro-border)', color:'var(--viro-text)', width:'auto', padding:'8px 10px' }}>
          <option value="newest">↓ Newest</option>
          <option value="oldest">↑ Oldest</option>
          <option value="highest">↓ Highest</option>
          <option value="lowest">↑ Lowest</option>
        </select>

        {/* View toggle */}
        <button onClick={() => setViewMode(v => v==='list'?'grid':'list')}
          className="flex-shrink-0 px-3 py-2 rounded-xl text-sm"
          style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', color:'var(--viro-text)' }}>
          {viewMode==='list' ? '⊞' : '☰'}
        </button>

        <button onClick={onReload} className="flex-shrink-0 px-3 py-2 rounded-xl text-sm"
          style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)', color:'var(--viro-text)' }}
          title="Refresh">🔄</button>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedStatuses.map(s => (
            <button key={s} onClick={() => setSelectedStatuses(p => p.filter(x=>x!==s))}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: (statusColors[s]||'#94A3B8')+'25', color: statusColors[s]||'#94A3B8', border:`1px solid ${(statusColors[s]||'#94A3B8')}50` }}>
              {s} ✕
            </button>
          ))}
          {selectedCities.map(c => (
            <button key={c} onClick={() => setSelectedCities(p => p.filter(x=>x!==c))}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background:'#8B5CF625', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
              📍{c} ✕
            </button>
          ))}
          {(minAmount||maxAmount) && (
            <button onClick={() => { setMinAmount(''); setMaxAmount('') }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background:'#10B98125', color:'#10B981', border:'1px solid #10B98140' }}>
              Rs.{minAmount||0}–{maxAmount||'∞'} ✕
            </button>
          )}
          {(dateFrom||dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background:'#00BFFF25', color:'#00BFFF', border:'1px solid #00BFFF40' }}>
              📅 {dateFrom||'start'} → {dateTo||'now'} ✕
            </button>
          )}
          <button onClick={resetFilters}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background:'#EF444415', color:'#F87171', border:'1px solid #EF444430' }}>
            Clear all
          </button>
        </div>
      )}

      <p className="text-xs mb-3" style={{ color:'var(--viro-textSub)' }}>
        {filtered.length} of {orders.length} orders
      </p>

      {/* ── Orders list ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-bold" style={{ color:'var(--viro-text)' }}>No orders match your filters</p>
          <button onClick={resetFilters} className="btn-primary mt-4 mx-auto px-6 py-2 text-sm">Clear Filters</button>
        </div>
      ) : (
        <div className={viewMode==='grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-3'}>
          {filtered.map(order => {
            const st       = statusColors[order.status] || '#94A3B8'
            const items    = order.order_items || []
            const isFree   = (order.delivery_charges||0) === 0
            const isOpen   = expanded === order.id
            const itemQty  = items.reduce((s,i)=>s+i.quantity,0)

            return (
              <div key={order.id} className="viro-card overflow-hidden transition-all"
                style={{ borderLeft:`3px solid ${st}` }}>

                {/* Header — always visible, click to expand */}
                <div className="px-4 py-3 cursor-pointer flex items-start justify-between gap-3"
                  onClick={() => setExpanded(isOpen ? null : order.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold" style={{ color:'var(--viro-textSub)' }}>
                        #{order.id?.slice(0,8).toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background:st+'20', color:st, border:`1px solid ${st}40` }}>
                        {order.status}
                      </span>
                    </div>
                    <p className="font-bold text-sm mt-0.5" style={{ color:'var(--viro-text)' }}>
                      {order.customers?.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      {order.customers?.phone} · {order.customers?.city}
                    </p>
                    {/* Preview items */}
                    {!isOpen && items.length > 0 && (
                      <p className="text-xs mt-0.5 truncate" style={{ color:'var(--viro-textSub)' }}>
                        {items.slice(0,2).map(i=>`${i.products?.name||'?'} ×${i.quantity}`).join(', ')}
                        {items.length > 2 && ` +${items.length-2} more`}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-extrabold text-base" style={{ color:'#7C3AED' }}>
                      Rs.{order.final_total?.toLocaleString()}
                    </p>
                    <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                      {itemQty} item{itemQty!==1?'s':''}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      {new Date(order.created_at).toLocaleDateString('en-PK', { day:'2-digit',month:'short',year:'2-digit' })}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      {isOpen ? '▲ less' : '▼ more'}
                    </p>
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t fade-in" style={{ borderColor:'var(--viro-border)' }}>
                    {/* Full address */}
                    <div className="px-4 py-2" style={{ background:'var(--viro-bgDeep)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color:'var(--viro-textSub)' }}>Delivery Address</p>
                      <p className="text-sm" style={{ color:'var(--viro-text)' }}>
                        {order.customers?.name} · {order.customers?.phone}
                      </p>
                      <p className="text-sm" style={{ color:'var(--viro-textMuted)' }}>
                        {order.customers?.address}, {order.customers?.city}
                      </p>
                      <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                        📅 {new Date(order.created_at).toLocaleString('en-PK', {
                          day:'2-digit',month:'short',year:'numeric',
                          hour:'2-digit',minute:'2-digit'
                        })}
                      </p>
                    </div>

                    {/* Items */}
                    <div className="px-4 py-2 border-t" style={{ borderColor:'var(--viro-border)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'var(--viro-textSub)' }}>Items</p>
                      {items.map((item,i) => (
                        <div key={i} className="flex justify-between text-sm py-0.5">
                          <span className="truncate flex-1 mr-2" style={{ color:'var(--viro-text)' }}>
                            {item.products?.name || 'Product'} <span style={{ color:'var(--viro-textSub)' }}>×{item.quantity}</span>
                          </span>
                          <span className="font-semibold flex-shrink-0" style={{ color:'var(--viro-textMuted)' }}>
                            Rs.{(item.price*item.quantity)?.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Bill */}
                    <div className="px-4 py-2 border-t" style={{ borderColor:'var(--viro-border)' }}>
                      <div className="flex justify-between text-sm">
                        <span style={{ color:'var(--viro-textSub)' }}>Subtotal</span>
                        <span style={{ color:'var(--viro-text)' }}>Rs.{order.total_price?.toLocaleString()}</span>
                      </div>
                      {order.coupon_code && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color:'#10B981' }}>🎟️ Coupon ({order.coupon_code})</span>
                          <span className="font-bold" style={{ color:'#10B981' }}>-Rs.{order.coupon_discount?.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span style={{ color:'var(--viro-textSub)' }}>Delivery</span>
                        <span className={isFree ? 'text-emerald-400 font-semibold' : ''} style={isFree?{}:{color:'var(--viro-text)'}}>
                          {isFree ? '🎉 FREE' : `Rs.${order.delivery_charges}`}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-sm border-t mt-1 pt-1" style={{ borderColor:'var(--viro-border)' }}>
                        <span style={{ color:'var(--viro-text)' }}>Total</span>
                        <span style={{ color:'#7C3AED' }}>Rs.{order.final_total?.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Status + Actions */}
                    <div className="px-4 py-3 border-t" style={{ borderColor:'var(--viro-border)' }}>
                      {/* Pipeline visualizer */}
                      <div className="mb-3 overflow-x-auto">
                        <div className="flex items-center gap-0 min-w-max">
                          {['UNPAID','QUEUE','CONFIRMED','PROCESSING','SHIPPED','DELIVERED'].map((s,i) => {
                            const meta = ORDER_STATUS_META[s]
                            const isActive = order.status === s
                            const isCancelled = order.status === 'CANCELLED'
                            const statusIdx = ['UNPAID','QUEUE','CONFIRMED','PROCESSING','SHIPPED','DELIVERED'].indexOf(order.status)
                            const isPast = statusIdx > i && !isCancelled
                            return (
                              <React.Fragment key={s}>
                                {i > 0 && (
                                  <div className="h-0.5 w-4 flex-shrink-0"
                                    style={{ background: isPast || isActive ? meta.color : 'var(--viro-border)' }} />
                                )}
                                <button
                                  onClick={() => updateOrderStatus(order.id, s)}
                                  title={`Move to ${s}`}
                                  className="flex flex-col items-center gap-0.5 flex-shrink-0 transition-all"
                                  style={{ opacity: isCancelled ? 0.4 : 1 }}>
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs border-2 transition-all"
                                    style={{
                                      background: isActive ? meta.color+'30' : isPast ? meta.color+'15' : 'var(--viro-bgDeep)',
                                      borderColor: isActive ? meta.color : isPast ? meta.color+'60' : 'var(--viro-border)',
                                      boxShadow: isActive ? `0 0 8px ${meta.color}60` : 'none',
                                    }}>
                                    {meta.icon}
                                  </div>
                                  <span className="text-[8px] font-bold leading-tight text-center"
                                    style={{ color: isActive ? meta.color : 'var(--viro-textSub)', maxWidth: 30 }}>
                                    {s.slice(0,4)}
                                  </span>
                                </button>
                              </React.Fragment>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold" style={{ color:'var(--viro-textSub)' }}>Status:</span>
                        <select value={order.status}
                          onChange={e => updateOrderStatus(order.id, e.target.value)}
                          className="flex-1 rounded-lg text-xs" style={{ padding:'6px 10px' }}>
                          {ORDER_STATUSES.map(s => {
                            const m = ORDER_STATUS_META[s]
                            return <option key={s} value={s}>{m?.icon} {s} — {m?.label}</option>
                          })}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <a href={`tel:${order.customers?.phone}`}
                          className="flex-1 text-center py-2 rounded-xl text-xs font-bold transition-all"
                          style={{ background:'#00BFFF15', color:'#00BFFF', border:'1px solid #00BFFF30' }}>
                          📞 Call
                        </a>
                        <a href={`https://wa.me/92${order.customers?.phone?.replace(/^0/,'')}?text=${encodeURIComponent(`Hi ${order.customers?.name}! Your Viro order #${order.id?.slice(0,8).toUpperCase()} is now: ${order.status}. For queries call +92 327 7796566`)}`}
                          target="_blank" rel="noopener"
                          className="flex-1 text-center py-2 rounded-xl text-xs font-bold"
                          style={{ background:'#25D36615', color:'#25D366', border:'1px solid #25D36630' }}>
                          💬 WhatsApp
                        </a>
                        <a href={`sms:${order.customers?.phone}`}
                          className="flex-1 text-center py-2 rounded-xl text-xs font-bold"
                          style={{ background:'#8B5CF615', color:'#A78BFA', border:'1px solid #8B5CF630' }}>
                          💬 SMS
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── LinkedIn-style Filter Modal ── */}
      {showFilters && (
        <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center"
          style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}
          onClick={e => e.target===e.currentTarget && setShowFilters(false)}>
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-3xl overflow-hidden"
            style={{ background:'var(--viro-bgCard)', border:'1px solid var(--viro-border)',
              maxHeight:'85vh', display:'flex', flexDirection:'column',
              animation:'popIn 0.3s cubic-bezier(.4,0,.2,1)' }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor:'var(--viro-border)' }}>
              <h2 className="font-extrabold text-lg" style={{ color:'var(--viro-text)' }}>
                All Filters
              </h2>
              <button onClick={() => setShowFilters(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background:'var(--viro-bgDeep)', color:'var(--viro-textMuted)' }}>✕</button>
            </div>

            {/* Scrollable filter body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">

              {/* Status */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color:'var(--viro-text)' }}>Order Status</h3>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_LIST.map(s => {
                    const sc    = statusColors[s] || '#94A3B8'
                    const check = draft.statuses.includes(s)
                    return (
                      <label key={s} className="flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-all"
                        style={{ background: check ? sc+'18' : 'var(--viro-bgDeep)',
                          border:`1px solid ${check ? sc+'60' : 'var(--viro-border)'}` }}>
                        <input type="checkbox" checked={check} onChange={() => toggleDraftStatus(s)}
                          className="w-4 h-4 rounded flex-shrink-0" style={{ accentColor: sc }} />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: check ? sc : 'var(--viro-text)' }}>{s}</p>
                          <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>{statusCounts[s]||0} orders</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* City */}
              {orderCities.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm mb-3" style={{ color:'var(--viro-text)' }}>City</h3>
                  <div className="flex flex-wrap gap-2">
                    {orderCities.map(c => {
                      const check = draft.cities.includes(c)
                      return (
                        <label key={c} className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer text-sm font-semibold transition-all"
                          style={{ background: check ? '#8B5CF625' : 'var(--viro-bgDeep)',
                            color: check ? '#A78BFA' : 'var(--viro-textMuted)',
                            border:`1px solid ${check ? '#8B5CF660' : 'var(--viro-border)'}` }}>
                          <input type="checkbox" checked={check} onChange={() => toggleDraftCity(c)}
                            className="w-3.5 h-3.5" style={{ accentColor:'#8B5CF6' }} />
                          📍 {c}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Order Amount Range */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color:'var(--viro-text)' }}>Order Amount (Rs.)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color:'var(--viro-textSub)' }}>Min Amount</label>
                    <input type="number" placeholder="e.g. 500" min="0"
                      value={draft.minAmount} onChange={e => setDraft(d=>({...d,minAmount:e.target.value}))} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color:'var(--viro-textSub)' }}>Max Amount</label>
                    <input type="number" placeholder="e.g. 5000" min="0"
                      value={draft.maxAmount} onChange={e => setDraft(d=>({...d,maxAmount:e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Items qty range */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color:'var(--viro-text)' }}>Item Quantity Range</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color:'var(--viro-textSub)' }}>Min Items</label>
                    <input type="number" placeholder="1" min="0"
                      value={draft.minItems} onChange={e => setDraft(d=>({...d,minItems:e.target.value}))} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color:'var(--viro-textSub)' }}>Max Items</label>
                    <input type="number" placeholder="10" min="0"
                      value={draft.maxItems} onChange={e => setDraft(d=>({...d,maxItems:e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <h3 className="font-bold text-sm mb-3" style={{ color:'var(--viro-text)' }}>Date Range</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color:'var(--viro-textSub)' }}>From</label>
                    <input type="date" value={draft.dateFrom}
                      onChange={e => setDraft(d=>({...d,dateFrom:e.target.value}))}
                      style={{ colorScheme:'dark' }} />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color:'var(--viro-textSub)' }}>To</label>
                    <input type="date" value={draft.dateTo}
                      onChange={e => setDraft(d=>({...d,dateTo:e.target.value}))}
                      style={{ colorScheme:'dark' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer — Reset + Show Results */}
            <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor:'var(--viro-border)' }}>
              <button onClick={() => setDraft({ statuses:[], cities:[], minAmount:'', maxAmount:'', minItems:'', maxItems:'', dateFrom:'', dateTo:'' })}
                className="flex-1 py-3 rounded-xl font-bold text-sm border transition-all"
                style={{ background:'transparent', color:'var(--viro-textMuted)', borderColor:'var(--viro-border)' }}>
                Reset
              </button>
              <button onClick={applyFilters}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all"
                style={{ background:'linear-gradient(135deg,#00BFFF,#8B5CF6)' }}>
                Show {filtered.length} results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Categories Tab — add / edit / delete / reorder categories
// ─────────────────────────────────────────────────────────────
const CATEGORY_ICONS = ['📱','👗','👟','👜','⌚','💍','💄','🏠','🏋️','🧸','📚','🛒','🚗','📦','🎮','🍕','💻','📷','🎵','🌿','🐾','✈️','💊','🔧','🧴','👔','🧒','🎧','🔌','🧥']
const EMPTY_CAT = { name: '', icon: '📦', parent_id: '', image_url: '', description: '', is_visible: true, status: 'active' }

function CatImageUpload({ value, onChange, small }) {
  const [uploading, setUploading] = useState(false)
  const ref = useRef()
  async function handle(file) {
    if (!file) return
    setUploading(true)
    try { const url = await uploadCategoryImage(file); onChange(url) }
    catch(e) { showSimpleToast('❌ Upload failed: ' + e.message, 'info') }
    setUploading(false)
  }
  const size = small ? 56 : 80
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }} onClick={() => ref.current?.click()}>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => handle(e.target.files?.[0])} />
      <div className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center cursor-pointer"
        style={{ background: '#1E293B', border: '2px dashed ' + (value ? '#8B5CF6' : '#334155') }}>
        {uploading ? <span className="text-xs" style={{ color: '#8B5CF6' }}>⏳</span>
          : value ? <img src={value} alt="cat" className="w-full h-full object-cover" />
          : <div className="flex flex-col items-center gap-0.5">
              <span style={{ fontSize: small ? 18 : 22 }}>🖼️</span>
              <span style={{ color: '#475569', fontSize: 9, fontWeight: 700 }}>Upload</span>
            </div>}
      </div>
      {value && !uploading && (
        <button type="button" onClick={e => { e.stopPropagation(); onChange('') }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
          style={{ background: '#EF4444', fontSize: 10, fontWeight: 900 }}>✕</button>
      )}
    </div>
  )
}

function CategoriesTab({ categories, onReload }) {
  const [newCat,    setNewCat]    = useState(EMPTY_CAT)
  const [editId,    setEditId]    = useState(null)
  const [editData,  setEditData]  = useState({})
  const [saving,    setSaving]    = useState(false)
  const [iconOpen,  setIconOpen]  = useState(false)
  const [products,  setProducts]  = useState([])
  const [collapsed, setCollapsed] = useState({})

  const parents  = categories.filter(c => !c.parent_id)
  const children = (pid) => categories.filter(c => c.parent_id === pid)

  // Load products to compute counts
  useEffect(() => {
    supabase.from('products').select('id,category_id,is_active').then(({ data }) => setProducts(data || []))
  }, [categories])

  function countDirect(catId) { return products.filter(p => p.category_id === catId).length }
  function countTotal(catId) {
    const childIds = categories.filter(c => c.parent_id === catId).map(c => c.id)
    return products.filter(p => p.category_id === catId || childIds.includes(p.category_id)).length
  }
  function countActive(catId) {
    const childIds = categories.filter(c => c.parent_id === catId).map(c => c.id)
    return products.filter(p => (p.category_id === catId || childIds.includes(p.category_id)) && p.is_active).length
  }

  const totalProducts = products.length
  const uncategorised = products.filter(p => !p.category_id).length

  async function addCategory() {
    if (!newCat.name.trim()) return
    setSaving(true)
    const slug = newCat.name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + Date.now().toString(36)
    const { error } = await supabase.from('categories').insert({
      name: newCat.name.trim(), slug, icon: newCat.icon,
      image_url: newCat.image_url || null, parent_id: newCat.parent_id || null,
      sort_order: categories.filter(c => c.parent_id === (newCat.parent_id||null)).length + 1,
      is_visible: newCat.is_visible !== false,
      status: newCat.status || 'active',
    })
    setSaving(false)
    if (error) { showSimpleToast('❌ ' + error.message, 'info'); return }
    showSimpleToast('✅ Category added!', 'success')
    setNewCat(EMPTY_CAT); onReload()
  }

  async function saveEdit(id) {
    setSaving(true)
    const { error } = await supabase.from('categories').update({
      name: editData.name, icon: editData.icon,
      image_url: editData.image_url || null, parent_id: editData.parent_id || null,
      is_visible: editData.is_visible !== false,
      status: editData.status || 'active',
    }).eq('id', id)
    setSaving(false)
    if (error) { showSimpleToast('❌ ' + error.message, 'info'); return }
    showSimpleToast('✅ Updated!', 'success')
    setEditId(null); onReload()
  }

  async function deleteCategory(id, name) {
    if (!(await adminConfirm(`Delete "${name}"? Sub-categories will be unlinked.`))) return
    await supabase.from('categories').update({ parent_id: null }).eq('parent_id', id)
    await supabase.from('categories').delete().eq('id', id)
    showSimpleToast('🗑️ Deleted', 'info'); onReload()
  }

  async function toggleVisibility(cat) {
    const newVisible = !cat.is_visible
    const newStatus = newVisible ? (cat.status === 'hidden' ? 'active' : cat.status) : 'hidden'
    await supabase.from('categories').update({ is_visible: newVisible, status: newStatus }).eq('id', cat.id)
    onReload()
  }

  async function setStatus(cat, status) {
    const is_visible = status !== 'hidden'
    await supabase.from('categories').update({ status, is_visible }).eq('id', cat.id)
    onReload()
  }

  async function moveOrder(id, dir) {
    const cat = categories.find(c => c.id === id)
    const siblings = categories.filter(c => c.parent_id === cat.parent_id).sort((a,b) => a.sort_order - b.sort_order)
    const idx = siblings.findIndex(c => c.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const a = siblings[idx], b = siblings[swapIdx]
    await Promise.all([
      supabase.from('categories').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('categories').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    onReload()
  }

  function IconPickerDropdown({ value, onChange, which }) {
    if (iconOpen !== which) return null
    return (
      <div className="absolute z-50 rounded-2xl shadow-2xl" style={{ background:'#1E293B', border:'1px solid #334155', width:272, top:'110%', left:0 }}>
        <p className="text-xs font-bold px-3 pt-2 pb-1" style={{ color:'#94A3B8' }}>Pick icon</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, padding:'0 8px 10px' }}>
          {CATEGORY_ICONS.map(ic => (
            <button key={ic} type="button" onClick={() => { onChange(ic); setIconOpen(false) }}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              style={{ background: value===ic?'#8B5CF6':'transparent', fontSize:18 }}>{ic}</button>
          ))}
        </div>
      </div>
    )
  }

  // ── Directory-style CatRow (Folder = main, File = sub) ──
  function CatRow({ cat, isChild, siblings, idx }) {
    const isEditing = editId === cat.id
    const subs = children(cat.id).sort((a,b) => a.sort_order - b.sort_order)
    const direct = countDirect(cat.id)
    const total  = countTotal(cat.id)
    const active = countActive(cat.id)
    const isOpen = !collapsed[cat.id]

    if (isEditing) return (
      <div className="mb-2 rounded-2xl overflow-hidden" style={{ border:'2px solid #8B5CF660', background:'#111827' }}>
        {/* Edit header */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ background:'#8B5CF615', borderBottom:'1px solid #8B5CF630' }}>
          <span style={{ fontSize:16 }}>✏️</span>
          <span className="text-sm font-extrabold" style={{ color:'#C4B5FD' }}>Editing: {cat.name}</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-3 items-start">
            <CatImageUpload value={editData.image_url} onChange={v=>setEditData(d=>({...d,image_url:v}))} />
            <div className="flex-1 space-y-2">
              <div className="relative">
                <button type="button" onClick={()=>setIconOpen(iconOpen===`e${cat.id}`?false:`e${cat.id}`)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold w-full"
                  style={{ background:'#0F172A', border:'1px solid #334155', color:'#E2E8F0' }}>
                  <span style={{ fontSize:20 }}>{editData.icon}</span>
                  <span className="text-sm flex-1 text-left font-bold" style={{ color:'#E2E8F0' }}>Icon</span>
                  <span className="text-xs" style={{ color:'#64748B' }}>▼</span>
                </button>
                <IconPickerDropdown value={editData.icon} onChange={v=>setEditData(d=>({...d,icon:v}))} which={`e${cat.id}`} />
              </div>
              <input value={editData.name} onChange={e=>setEditData(d=>({...d,name:e.target.value}))} placeholder="Category name"
                style={{ background:'#0F172A', border:'1px solid #334155', color:'#E2E8F0', borderRadius:12, padding:'10px 14px', fontSize:14, width:'100%' }} />
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color:'#64748B' }}>Parent</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={()=>setEditData(d=>({...d,parent_id:''}))}
                className="text-xs px-3 py-1.5 rounded-full font-bold"
                style={!editData.parent_id?{background:'#8B5CF6',color:'#fff'}:{background:'#1E293B',color:'#94A3B8',border:'1px solid #334155'}}>
                📂 Top Level
              </button>
              {parents.filter(p=>p.id!==cat.id).map(p=>(
                <button key={p.id} type="button" onClick={()=>setEditData(d=>({...d,parent_id:p.id}))}
                  className="text-xs px-3 py-1.5 rounded-full font-bold"
                  style={editData.parent_id===p.id?{background:'#8B5CF6',color:'#fff'}:{background:'#1E293B',color:'#94A3B8',border:'1px solid #334155'}}>
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>saveEdit(cat.id)} className="flex-1 py-2.5 rounded-xl text-sm font-extrabold"
              style={{ background:'linear-gradient(135deg,#10B981,#059669)', color:'#fff' }}>
              {saving ? '⏳ Saving…' : '✅ Save'}
            </button>
            <button onClick={()=>setEditId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background:'#1E293B', color:'#94A3B8', border:'1px solid #334155' }}>Cancel</button>
          </div>
          {/* Status & Visibility */}
          <div className="mt-3">
            <p className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color:'#64748B' }}>Status & Visibility</p>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {[
                { val:'active',      label:'✅ Active',       bg:'#10B981', desc:'Shown in shop' },
                { val:'coming_soon', label:'🚀 Coming Soon',  bg:'#F59E0B', desc:'Teaser shown' },
                { val:'hidden',      label:'🙈 Hidden',       bg:'#EF4444', desc:'Not shown' },
              ].map(s=>(
                <button key={s.val} type="button" onClick={()=>setEditData(d=>({...d,status:s.val,is_visible:s.val!=='hidden'}))}
                  className="py-2 rounded-xl text-xs font-bold transition-all text-center"
                  style={editData.status===s.val
                    ?{background:s.bg,color:'#fff',boxShadow:`0 2px 8px ${s.bg}50`}
                    :{background:'#1E293B',color:'#64748B',border:'1px solid #334155'}}>
                  {s.label}<br/><span style={{ fontSize:9, opacity:0.7 }}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )

    if (isChild) return (
      <div style={{ marginBottom: 3, opacity: cat.is_visible===false ? 0.55 : 1 }}>
        <div className="flex items-center gap-0">
          <div style={{ width:20, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:4 }}>
            <div style={{ width:12, height:1, background:'#334155' }} />
          </div>
          <div className="flex-1 rounded-xl overflow-hidden" style={{ background:'#0F172A', border:'1px solid #1E2A3A' }}>
            {/* Top row: icon + name + actions */}
            <div className="flex items-center gap-2.5 px-3 py-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
                style={{ background:'#1E293B', border:'1px solid #334155' }}>
                {cat.image_url
                  ? <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                  : <span style={{ fontSize:16 }}>{cat.icon}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color:'#E2E8F0' }}>{cat.name}</p>
                <p className="text-xs" style={{ color: direct>0?'#A78BFA':'#475569' }}>{direct} product{direct!==1?'s':''}{active>0?` · ${active} active`:''}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={()=>moveOrder(cat.id,-1)} disabled={idx===0}
                  className="w-6 h-6 rounded-lg text-xs flex items-center justify-center"
                  style={{ background:'#1E293B', color:idx===0?'#1E2A3A':'#64748B' }}>↑</button>
                <button onClick={()=>moveOrder(cat.id,1)} disabled={idx===siblings.length-1}
                  className="w-6 h-6 rounded-lg text-xs flex items-center justify-center"
                  style={{ background:'#1E293B', color:idx===siblings.length-1?'#1E2A3A':'#64748B' }}>↓</button>
                <button onClick={()=>{setEditId(cat.id);setEditData({name:cat.name,icon:cat.icon,image_url:cat.image_url||'',parent_id:cat.parent_id||'',is_visible:cat.is_visible!==false,status:cat.status||'active'});setIconOpen(false)}}
                  className="w-6 h-6 rounded-lg text-xs flex items-center justify-center"
                  style={{ background:'#8B5CF625', color:'#A78BFA' }}>✏️</button>
                <button onClick={()=>deleteCategory(cat.id,cat.name)}
                  className="w-6 h-6 rounded-lg text-xs flex items-center justify-center"
                  style={{ background:'#EF444420', color:'#F87171' }}>🗑</button>
              </div>
            </div>
            {/* Status pills row — always visible */}
            <div className="flex items-center gap-1.5 px-3 pb-2">
              {[
                {val:'active',      label:'✅ Active',  bg:'#10B981', dim:'#10B98120'},
                {val:'coming_soon', label:'🚀 Soon',    bg:'#F59E0B', dim:'#F59E0B20'},
                {val:'hidden',      label:'🙈 Hidden',  bg:'#EF4444', dim:'#EF444420'},
              ].map(s => (
                <button key={s.val} type="button"
                  onClick={()=>setStatus(cat, s.val)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                  style={(cat.status||'active')===s.val
                    ?{background:s.bg, color:'#fff'}
                    :{background:s.dim, color:'#64748B', border:'1px solid transparent'}}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )

    // ── FOLDER style (main / parent category) ──
    return (
      <div className="mb-3" style={{ opacity: cat.is_visible===false ? 0.6 : 1 }}>
        {/* Folder header row */}
        <div className="flex items-stretch overflow-hidden rounded-2xl group"
          style={{ background:'#1a2235', border:'2px solid #1E2A45' }}>
          {/* Expand/collapse toggle */}
          <button onClick={()=>setCollapsed(c=>({...c,[cat.id]:!c[cat.id]}))}
            className="flex-shrink-0 flex items-center justify-center transition-all"
            style={{ width:36, background:'#8B5CF610', borderRight:'1px solid #8B5CF620', color:'#8B5CF6', fontSize:11, fontWeight:900 }}>
            {subs.length > 0 ? (isOpen ? '▾' : '▸') : ''}
          </button>

          {/* Folder icon */}
          <div className="flex-shrink-0 flex items-center justify-center"
            style={{ width:52, background:'#8B5CF610', borderRight:'1px solid #8B5CF615' }}>
            {cat.image_url
              ? <img src={cat.image_url} alt={cat.name} style={{ width:36, height:36, borderRadius:10, objectFit:'cover' }} />
              : <span style={{ fontSize:26 }}>{cat.icon}</span>}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0 px-3 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold" style={{ color:'#F1F5F9', fontSize:15 }}>{cat.name}</span>
              {subs.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background:'#8B5CF625', color:'#C4B5FD', border:'1px solid #8B5CF630' }}>
                  📁 {subs.length} sub
                </span>
              )}
              {cat.image_url && <span style={{ fontSize:11, color:'#10B981' }}>📷</span>}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-xs font-bold" style={{ color: total>0?'#A78BFA':'#475569' }}>
                {total} product{total!==1?'s':''}
                {subs.length > 0 && direct > 0 ? ` (${direct} direct)` : ''}
              </span>
              {active > 0 && <span className="text-xs font-semibold" style={{ color:'#34D399' }}>• {active} active</span>}
              {/* Status badge */}
              {cat.status === 'coming_soon' && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:'#F59E0B20', color:'#FCD34D', border:'1px solid #F59E0B40' }}>🚀 Coming Soon</span>
              )}
              {cat.is_visible === false && cat.status !== 'coming_soon' && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:'#EF444415', color:'#FCA5A5', border:'1px solid #EF444430' }}>🙈 Hidden</span>
              )}
              <span className="text-xs font-mono" style={{ color:'#334155' }}>/{cat.slug?.split('-').slice(0,-1).join('-')||cat.slug}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col justify-center gap-1 px-2 py-2 flex-shrink-0">
            {/* Status pills — always visible */}
            <div className="flex items-center gap-1">
              {[
                {val:'active',      label:'✅',  bg:'#10B981', title:'Active'},
                {val:'coming_soon', label:'🚀',  bg:'#F59E0B', title:'Coming Soon'},
                {val:'hidden',      label:'🙈',  bg:'#EF4444', title:'Hidden'},
              ].map(s => (
                <button key={s.val} type="button"
                  onClick={() => setStatus(cat, s.val)}
                  title={s.title}
                  className="w-7 h-7 rounded-xl text-xs flex items-center justify-center font-bold transition-all"
                  style={(cat.status||'active')===s.val
                    ?{background:s.bg, color:'#fff', boxShadow:`0 2px 6px ${s.bg}60`}
                    :{background:'#0F172A', color:'#475569', border:'1px solid #1E2A3A'}}>
                  {s.label}
                </button>
              ))}
            </div>
            {/* Move + edit + delete */}
            <div className="flex items-center gap-1">
              <button onClick={()=>moveOrder(cat.id,-1)} disabled={idx===0}
                className="w-7 h-7 rounded-xl text-xs flex items-center justify-center transition-all"
                style={{ background:'#0F172A', color:idx===0?'#1E2A3A':'#94A3B8', border:'1px solid #1E2A3A' }}>↑</button>
              <button onClick={()=>moveOrder(cat.id,1)} disabled={idx===siblings.length-1}
                className="w-7 h-7 rounded-xl text-xs flex items-center justify-center transition-all"
                style={{ background:'#0F172A', color:idx===siblings.length-1?'#1E2A3A':'#94A3B8', border:'1px solid #1E2A3A' }}>↓</button>
              <button onClick={()=>{setEditId(cat.id);setEditData({name:cat.name,icon:cat.icon,image_url:cat.image_url||'',parent_id:cat.parent_id||'',is_visible:cat.is_visible!==false,status:cat.status||'active'});setIconOpen(false)}}
                className="w-7 h-7 rounded-xl text-xs flex items-center justify-center transition-all"
                style={{ background:'#8B5CF625', color:'#C4B5FD', border:'1px solid #8B5CF635' }}>✏️</button>
              <button onClick={()=>deleteCategory(cat.id,cat.name)}
                className="w-7 h-7 rounded-xl text-xs flex items-center justify-center transition-all"
                style={{ background:'#EF444418', color:'#FCA5A5', border:'1px solid #EF444430' }}>🗑</button>
            </div>
          </div>
        </div>

        {/* Children (files inside folder) — shown when open */}
        {subs.length > 0 && isOpen && (
          <div className="mt-1 ml-4 pl-2" style={{ borderLeft:'2px solid #1E2A45' }}>
            {subs.map((sub,si)=>(
              <CatRow key={sub.id} cat={sub} isChild siblings={subs} idx={si} />
            ))}
            {/* Add sub-cat quick button */}
            <div className="flex items-center gap-0 mt-1">
              <div style={{ width:20, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:4 }}>
                <div style={{ width:12, height:1, background:'#334155' }} />
              </div>
              <button onClick={()=>{setNewCat(n=>({...n,parent_id:cat.id}));document.getElementById('new-cat-name')?.focus()}}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{ background:'#8B5CF610', color:'#8B5CF6', border:'1px dashed #8B5CF640' }}>
                + Add sub-category under "{cat.name}"
              </button>
            </div>
          </div>
        )}

        {/* If folder is empty — quick add sub */}
        {subs.length === 0 && (
          <div className="mt-1 ml-4">
            <button onClick={()=>{setNewCat(n=>({...n,parent_id:cat.id}));document.getElementById('new-cat-name')?.focus()}}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{ background:'transparent', color:'#475569', border:'1px dashed #334155' }}>
              + Add sub-category
            </button>
          </div>
        )}
      </div>
    )
  }

  const sortedParents = parents.sort((a,b) => a.sort_order - b.sort_order)
  const totalSubs = categories.filter(c=>c.parent_id).length

  return (
    <div className="px-3 pb-8 max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 mt-1">
        <div>
          <h2 className="font-extrabold text-xl" style={{ color:'#F1F5F9' }}>📁 Categories</h2>
          <p className="text-xs mt-0.5" style={{ color:'#64748B' }}>
            {sortedParents.length} folders · {totalSubs} files · {totalProducts} products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={()=>{
              const allCollapsed = sortedParents.every(p=>collapsed[p.id])
              const next = {}
              if (allCollapsed) { sortedParents.forEach(p=>{next[p.id]=false}) }
              else { sortedParents.forEach(p=>{next[p.id]=true}) }
              setCollapsed(next)
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{ background:'#1E293B', color:'#94A3B8', border:'1px solid #334155' }}>
            {sortedParents.every(p=>collapsed[p.id]) ? '▸ Expand All' : '▾ Collapse All'}
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label:'Main Folders', val:sortedParents.length, color:'#8B5CF6', icon:'📂' },
          { label:'Sub Files',    val:totalSubs,             color:'#60A5FA', icon:'📄' },
          { label:'Products',     val:totalProducts,          color:'#34D399', icon:'📦' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-3 flex items-center gap-2.5"
            style={{ background:'#0F172A', border:`1px solid ${s.color}25` }}>
            <span style={{ fontSize:22 }}>{s.icon}</span>
            <div>
              <p className="text-xl font-black leading-none" style={{ color:s.color }}>{s.val}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color:'#64748B' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      {uncategorised > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{ background:'#EF444415', border:'1px solid #EF444430' }}>
          <span style={{ fontSize:16 }}>⚠️</span>
          <span className="text-sm font-bold" style={{ color:'#FCA5A5' }}>
            {uncategorised} product{uncategorised!==1?'s':''} without a category
          </span>
        </div>
      )}

      {/* ── Add New Category form ── */}
      <div className="rounded-2xl p-4 mb-5" style={{ background:'#0F172A', border:'2px dashed #334155' }}>
        <p className="text-xs font-extrabold uppercase tracking-widest mb-4" style={{ color:'#64748B' }}>
          ➕ {newCat.parent_id ? `New file under "${parents.find(p=>p.id===newCat.parent_id)?.name||''}"` : 'New top-level folder'}
        </p>
        <div className="flex gap-3 mb-3 items-start">
          <CatImageUpload value={newCat.image_url} onChange={v=>setNewCat(n=>({...n,image_url:v}))} />
          <div className="flex-1 space-y-2">
            <div className="relative">
              <button type="button" onClick={()=>setIconOpen(iconOpen==='new'?false:'new')}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold w-full"
                style={{ background:'#1E293B', border:'1px solid #334155', color:'#E2E8F0' }}>
                <span style={{ fontSize:20 }}>{newCat.icon}</span>
                <span className="text-sm flex-1 text-left font-bold" style={{ color:'#E2E8F0' }}>Icon</span>
                <span className="text-xs" style={{ color:'#64748B' }}>▼</span>
              </button>
              {iconOpen==='new' && (
                <div className="absolute z-50 rounded-2xl shadow-2xl" style={{ background:'#1E293B', border:'1px solid #334155', width:272, top:'110%', left:0 }}>
                  <p className="text-xs font-bold px-3 pt-2 pb-1" style={{ color:'#94A3B8' }}>Pick icon</p>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, padding:'0 8px 10px' }}>
                    {CATEGORY_ICONS.map(ic=>(
                      <button key={ic} type="button" onClick={()=>{setNewCat(n=>({...n,icon:ic}));setIconOpen(false)}}
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background:newCat.icon===ic?'#8B5CF6':'transparent', fontSize:18 }}>{ic}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <input id="new-cat-name" value={newCat.name} onChange={e=>setNewCat(n=>({...n,name:e.target.value}))}
              onKeyDown={e=>e.key==='Enter'&&addCategory()} placeholder="e.g. Men's Fashion"
              style={{ background:'#1E293B', border:'1px solid #334155', color:'#E2E8F0', borderRadius:12, padding:'10px 14px', width:'100%', fontSize:14 }} />
          </div>
        </div>

        {/* Parent selector */}
        <div className="mb-4">
          <p className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color:'#64748B' }}>
            Place inside folder <span className="font-normal normal-case" style={{ color:'#475569' }}>(or Top Level)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={()=>setNewCat(n=>({...n,parent_id:''}))}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold transition-all"
              style={!newCat.parent_id
                ?{background:'#8B5CF6',color:'#fff',boxShadow:'0 2px 8px #8B5CF640'}
                :{background:'#1E293B',color:'#94A3B8',border:'1px solid #334155'}}>
              📂 Top Level
            </button>
            {parents.map(p=>(
              <button key={p.id} type="button" onClick={()=>setNewCat(n=>({...n,parent_id:n.parent_id===p.id?'':p.id}))}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold transition-all"
                style={newCat.parent_id===p.id
                  ?{background:'#8B5CF6',color:'#fff',boxShadow:'0 2px 8px #8B5CF640'}
                  :{background:'#1E293B',color:'#94A3B8',border:'1px solid #334155'}}>
                {p.icon} {p.name}
              </button>
            ))}
          </div>
        </div>

        <button onClick={addCategory} disabled={saving || !newCat.name.trim()}
          className="w-full py-3 rounded-2xl text-sm font-extrabold transition-all"
          style={{
            background: newCat.name.trim() ? 'linear-gradient(135deg,#8B5CF6,#7C3AED)' : '#1E293B',
            color: newCat.name.trim() ? '#fff' : '#475569',
            boxShadow: newCat.name.trim() ? '0 4px 16px rgba(139,92,246,0.3)' : 'none'
          }}>
          {saving ? '⏳ Saving…'
            : newCat.parent_id
              ? `📄 Add under "${parents.find(p=>p.id===newCat.parent_id)?.name||''}"`
              : '📂 Create New Folder'}
        </button>
        {/* Status for new category */}
        <div className="mt-3">
          <p className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color:'#64748B' }}>Initial Status</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { val:'active',      label:'✅ Active',      bg:'#10B981' },
              { val:'coming_soon', label:'🚀 Coming Soon', bg:'#F59E0B' },
              { val:'hidden',      label:'🙈 Hidden',      bg:'#EF4444' },
            ].map(s=>(
              <button key={s.val} type="button" onClick={()=>setNewCat(n=>({...n,status:s.val,is_visible:s.val!=='hidden'}))}
                className="py-2 rounded-xl text-xs font-bold transition-all"
                style={newCat.status===s.val
                  ?{background:s.bg,color:'#fff',boxShadow:`0 2px 8px ${s.bg}40`}
                  :{background:'#1E293B',color:'#64748B',border:'1px solid #334155'}}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Directory tree ── */}
      {categories.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">📂</div>
          <p className="text-sm font-bold" style={{ color:'#E2E8F0' }}>No categories yet</p>
          <p className="text-xs mt-1" style={{ color:'#475569' }}>Create your first folder above</p>
        </div>
      ) : (
        <div>
          {sortedParents.map((cat,idx)=>(
            <CatRow key={cat.id} cat={cat} isChild={false} siblings={sortedParents} idx={idx} />
          ))}
        </div>
      )}
    </div>
  )
}

function SiteSettingsTab() {
  const { reload: reloadSiteSettings, ordersBadgeEnabled, setOrdersBadgeEnabled } = useSite()
  const { theme, setTheme } = useTheme()
  const [orderBadgeSaving, setOrderBadgeSaving] = React.useState(false)

  // ── State ─────────────────────────────────────────────────
  const [contact,       setContact]       = useState({ phone:'', whatsapp:'', email:'', address:'' })
  const [deliveryRules, setDeliveryRules] = useState([
    { label:'Burewala',         cities:'burewala', freeThreshold:999,  charge:150 },
    { label:'Vehari',           cities:'vehari',   freeThreshold:1500, charge:150 },
    { label:'All Other Cities', cities:'*',        freeThreshold:2500, charge:150 },
  ])
  const [messages,      setMessages]      = useState('')
  const [heroData,      setHeroData]      = useState({ title:'', subtitle:'', badge:'' })
  const [hotAds,        setHotAds]        = useState({ title:'', enabled:true, images:[] })
  const [heroImages,    setHeroImages]    = useState([])
  const [stripImages,   setStripImages]   = useState([])
  const [saving,        setSaving]        = useState({})
  const [loaded,        setLoaded]        = useState(false)
  const [activeSection, setActiveSection] = useState('contact')
  const [testCity,      setTestCity]      = useState('')
  const [testAmount,    setTestAmount]    = useState(0)
  const heroRef  = useRef()
  const stripRef = useRef()

  const testCharge = React.useMemo(() => {
    if (!testCity || !testAmount) return null
    const c = testCity.trim().toLowerCase()
    const rules = deliveryRules.map(r => ({
      ...r,
      cities: typeof r.cities === 'string'
        ? r.cities.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
        : r.cities,
    }))
    const match = rules.find(r => r.cities.includes(c)) || rules.find(r => r.cities.includes('*'))
    if (!match) return 150
    return testAmount >= match.freeThreshold ? 0 : match.charge
  }, [testCity, testAmount, deliveryRules])

  // ── Load settings ─────────────────────────────────────────
  useEffect(() => {
    supabase.from('site_settings').select('*').then(({ data }) => {
      const all = {}
      ;(data||[]).forEach(r => { all[r.key] = r.value })
      if (all.contact) setContact(c => ({ ...c, ...all.contact }))
      if (all.delivery_rules) {
        setDeliveryRules(all.delivery_rules.map(r => ({
          ...r,
          cities: Array.isArray(r.cities) ? r.cities.join(',') : r.cities,
        })))
      }
      if (all.announcement?.messages) setMessages(all.announcement.messages.join('\n'))
      if (all.hero) setHeroData(all.hero)
      if (all.hot_ads) setHotAds(all.hot_ads)
      if (all.hero?.images) setHeroImages(all.hero.images)
      if (all.strip_images) setStripImages(all.strip_images)
      setLoaded(true)
    })
  }, [])

  async function saveSetting(key, value) {
    setSaving(s => ({ ...s, [key]: true }))
    await supabase.from('site_settings').upsert({ key, value }, { onConflict: 'key' })
    setSaving(s => ({ ...s, [key]: false }))
    reloadSiteSettings()
    showSimpleToast('✅ Saved', 'success')
  }

  async function uploadToBucket(bucket, files, setImages, setUploading) {
    setUploading(true)
    const urls = []
    for (const file of files) {
      const url = await uploadCategoryImage(bucket, file)
      if (url) urls.push(url)
    }
    setImages(prev => {
      const next = [...prev, ...urls]
      saveSetting(bucket === 'header_ads_imgs' ? 'strip_images' : 'hero_images', next)
      return next
    })
    setUploading(false)
  }

  // ── Section nav items ──────────────────────────────────────
  const SECTIONS = [
    { id:'contact',      icon:'📞', label:'Contact' },
    { id:'delivery',     icon:'🚚', label:'Delivery' },
    { id:'announcement', icon:'📢', label:'Announcements' },
    { id:'hero',         icon:'🎨', label:'Hero Banner' },
    { id:'hotads',       icon:'🔥', label:'Hot Deals' },
    { id:'orderbadge',   icon:'🔥', label:'Order Badge' },
    { id:'reviews',      icon:'⭐', label:'Reviews' },
    { id:'theme',        icon:'🌙', label:'Theme' },
  ]

  return (
    <div className="pb-24">
      {/* ── Section Tabs ── */}
      <div className="flex overflow-x-auto scrollbar-hide gap-2 px-4 py-3 border-b"
        style={{ borderColor:'var(--viro-border)', background:'var(--viro-bgDeep)' }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
            style={activeSection === s.id
              ? { background:'linear-gradient(135deg,#00BFFF,#8B5CF6)', color:'#fff', boxShadow:'0 2px 8px #8B5CF640' }
              : { background:'var(--viro-bgCard)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ══════════ CONTACT ══════════ */}
        {activeSection === 'contact' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ background:'#25D36608', borderColor:'#25D36620' }}>
                <div>
                  <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>
                    📞 Contact & WhatsApp
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                    Used on checkout, footer, order alerts, WhatsApp buttons
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-bold"
                  style={{ background:'#25D36615', color:'#25D366', border:'1px solid #25D36630' }}>🌐 Live</span>
              </div>

              <div className="p-4 space-y-3">
                {/* WhatsApp — highlighted */}
                <div className="rounded-xl p-3" style={{ background:'#25D36608', border:'1.5px solid #25D36625' }}>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color:'#25D366' }}>
                    💬 WhatsApp Number *
                  </label>
                  <input value={contact.whatsapp}
                    onChange={e => setContact(c => ({ ...c, whatsapp: e.target.value.replace(/\D/g,'') }))}
                    placeholder="923277796566"
                    style={{ fontFamily:'monospace', fontWeight:700, fontSize:15 }} />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                      No + or spaces. e.g. <code style={{ background:'var(--viro-bgDeep)', padding:'1px 5px', borderRadius:4, color:'#A78BFA' }}>923277796566</code>
                    </p>
                    {contact.whatsapp && (
                      <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener"
                        className="text-xs font-semibold hover:underline flex-shrink-0"
                        style={{ color:'#25D366' }}>🔗 Test link</a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>📞 Display Phone</label>
                    <input value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} placeholder="+923277796566" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>✉️ Email</label>
                    <input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} placeholder="support@viro.pk" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>📍 Address</label>
                    <input value={contact.address} onChange={e => setContact(c => ({ ...c, address: e.target.value }))} placeholder="Mandi Burewala, Punjab, Pakistan" />
                  </div>
                </div>

                {/* Live preview */}
                <div className="rounded-xl p-3 flex flex-wrap gap-3 text-xs"
                  style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  <span style={{ color:'#25D366' }}>💬 {contact.whatsapp||'—'}</span>
                  <span style={{ color:'#00BFFF' }}>📞 {contact.phone||'—'}</span>
                  <span style={{ color:'#A78BFA' }}>✉️ {contact.email||'—'}</span>
                  <span style={{ color:'var(--viro-textSub)' }}>📍 {contact.address||'—'}</span>
                </div>

                <button onClick={() => saveSetting('contact', contact)} disabled={saving.contact}
                  className="btn-primary w-full py-3 font-bold">
                  {saving.contact ? '⏳ Saving…' : '💾 Save Contact Info'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ DELIVERY ══════════ */}
        {activeSection === 'delivery' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ background:'#00BFFF08', borderColor:'#00BFFF20' }}>
                <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🚚 Delivery Charges — City by City</h3>
                <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                  Rules checked top→bottom. First match wins.
                  Use <code style={{ background:'var(--viro-bgDeep)', padding:'1px 6px', borderRadius:4, color:'#A78BFA' }}>*</code> to catch all remaining cities.
                </p>
                <div className="mt-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background:'#EAB30815', border:'1px solid #EAB30830' }}>
                  <span style={{ color:'#EAB308', fontWeight:700 }}>💡 Tip: </span>
                  <span style={{ color:'var(--viro-textSub)' }}>
                    Change the <strong>Flat Delivery Fee</strong> today (e.g. 150→160) and every customer order immediately shows the new amount.
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {deliveryRules.map((rule, idx) => {
                  const isWild = rule.cities === '*' || rule.cities === ''
                  const color  = isWild ? '#8B5CF6' : '#00BFFF'
                  return (
                    <div key={idx} className="rounded-xl overflow-hidden"
                      style={{ border:`1.5px solid ${color}30` }}>
                      <div className="px-3 py-2 flex items-center justify-between"
                        style={{ background:`${color}08` }}>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                            style={{ background:color }}>{idx+1}</span>
                          <span className="text-sm font-bold" style={{ color:'var(--viro-text)' }}>
                            {rule.label || 'Unnamed Rule'}
                          </span>
                          {isWild && <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ background:'#8B5CF620', color:'#A78BFA' }}>Wildcard</span>}
                        </div>
                        {deliveryRules.length > 1 && (
                          <button onClick={() => setDeliveryRules(r => r.filter((_,i) => i!==idx))}
                            className="text-xs px-2 py-1 rounded-lg"
                            style={{ color:'#F87171', background:'#EF444415', border:'1px solid #EF444430' }}>
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold block mb-1" style={{ color:'var(--viro-textSub)' }}>Label</label>
                          <input value={rule.label}
                            onChange={e => setDeliveryRules(r => r.map((x,i) => i===idx ? {...x,label:e.target.value} : x))}
                            placeholder="Burewala" style={{ fontSize:12 }} />
                        </div>
                        <div>
                          <label className="text-xs font-bold block mb-1" style={{ color:'var(--viro-textSub)' }}>Cities (comma or *)</label>
                          <input value={rule.cities}
                            onChange={e => setDeliveryRules(r => r.map((x,i) => i===idx ? {...x,cities:e.target.value} : x))}
                            placeholder="burewala,multan or *" style={{ fontSize:12 }} />
                        </div>
                        <div>
                          <label className="text-xs font-bold block mb-1" style={{ color:'var(--viro-textSub)' }}>🎉 Free Delivery ≥ Rs.</label>
                          <input type="number" value={rule.freeThreshold}
                            onChange={e => setDeliveryRules(r => r.map((x,i) => i===idx ? {...x,freeThreshold:parseInt(e.target.value)||0} : x))}
                            placeholder="999" style={{ fontSize:12 }} />
                        </div>
                        <div>
                          <label className="text-xs font-bold block mb-1" style={{ color:'var(--viro-textSub)' }}>📦 Flat Delivery Fee Rs.</label>
                          <input type="number" value={rule.charge}
                            onChange={e => setDeliveryRules(r => r.map((x,i) => i===idx ? {...x,charge:parseInt(e.target.value)||0} : x))}
                            placeholder="150" style={{ fontSize:12 }} />
                        </div>
                      </div>
                      <div className="mx-3 mb-3 px-3 py-2 rounded-xl text-xs"
                        style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                        🚚 <strong style={{ color:'var(--viro-text)' }}>{rule.label||'Rule'}:</strong>
                        {' '}Below Rs.{rule.freeThreshold?.toLocaleString()} →
                        <span style={{ color:'#EF4444', fontWeight:700 }}> Rs.{rule.charge} charge</span>
                        {' · '}Rs.{rule.freeThreshold?.toLocaleString()}+ →
                        <span style={{ color:'#10B981', fontWeight:700 }}> FREE 🎉</span>
                      </div>
                    </div>
                  )
                })}

                {/* Simulator */}
                <div className="rounded-xl p-3" style={{ background:'var(--viro-bgDeep)', border:'1px dashed var(--viro-border)' }}>
                  <p className="text-xs font-bold mb-2" style={{ color:'var(--viro-textSub)' }}>🧪 Test Charge Calculator</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs block mb-1" style={{ color:'var(--viro-textSub)' }}>City</label>
                      <input value={testCity} onChange={e => setTestCity(e.target.value)} placeholder="burewala" style={{ fontSize:12 }} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs block mb-1" style={{ color:'var(--viro-textSub)' }}>Order Rs.</label>
                      <input type="number" value={testAmount||''} onChange={e => setTestAmount(parseInt(e.target.value)||0)} placeholder="1000" style={{ fontSize:12 }} />
                    </div>
                    <div className="px-3 py-2 rounded-xl text-sm font-bold flex-shrink-0"
                      style={{
                        background: testCharge === 0 ? '#10B98120' : testCharge !== null ? '#EF444420' : 'var(--viro-bgCard)',
                        color: testCharge === 0 ? '#10B981' : testCharge !== null ? '#EF4444' : 'var(--viro-textSub)',
                        border: `1px solid ${testCharge === 0 ? '#10B98140' : testCharge !== null ? '#EF444440' : 'var(--viro-border)'}`,
                      }}>
                      {testCharge === null ? '—' : testCharge === 0 ? '🎉 FREE' : `Rs.${testCharge}`}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setDeliveryRules(r => [...r, { label:'New City', cities:'', freeThreshold:2500, charge:150 }])}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background:'var(--viro-bgDeep)', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
                    + Add Rule
                  </button>
                  <button
                    onClick={() => {
                      const norm = deliveryRules.map(r => ({
                        label:r.label,
                        cities: typeof r.cities==='string' ? r.cities.split(',').map(c=>c.trim().toLowerCase()).filter(Boolean) : r.cities,
                        freeThreshold:r.freeThreshold, charge:r.charge,
                      }))
                      saveSetting('delivery_rules', norm)
                    }}
                    disabled={saving.delivery_rules}
                    className="flex-1 btn-primary py-2.5 text-sm font-bold">
                    {saving.delivery_rules ? '⏳ Saving…' : '💾 Save Delivery Rules'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ANNOUNCEMENTS ══════════ */}
        {activeSection === 'announcement' && (
          <div className="viro-card overflow-hidden fade-in">
            <div className="px-4 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
              <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>📢 Announcement Bar Messages</h3>
              <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                One message per line. They scroll in the top bar. Leave blank to hide.
              </p>
            </div>
            <div className="p-4">
              <textarea rows={8} value={messages}
                onChange={e => setMessages(e.target.value)}
                placeholder={"🚚 FREE Delivery in Burewala on orders Rs.999+\n🌍 Other Cities — Free Delivery on Rs.2500+\n⚡ Flash Sale — Use coupon VIRO20 for 20% off\n📞 Call / WhatsApp: 03277796566"}
                style={{ width:'100%', resize:'vertical', lineHeight:1.7 }} />
              <p className="text-xs mt-2 mb-3" style={{ color:'var(--viro-textSub)' }}>
                💡 Tip: Use emoji at the start of each line to make messages pop.
              </p>
              <button
                onClick={() => {
                  const msgs = messages.split('\n').map(m=>m.trim()).filter(Boolean)
                  saveSetting('announcement', { messages: msgs })
                }}
                disabled={saving.announcement}
                className="btn-primary w-full py-3 font-bold">
                {saving.announcement ? '⏳ Saving…' : '💾 Save Messages'}
              </button>
            </div>
          </div>
        )}

        {/* ══════════ HERO BANNER ══════════ */}
        {activeSection === 'hero' && (
          <div className="space-y-4 fade-in">
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
                <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🎨 Hero Banner Text</h3>
                <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>Main homepage headline</p>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Badge Text</label>
                  <input value={heroData.badge||''} onChange={e => setHeroData(h=>({...h,badge:e.target.value}))} placeholder="🎉 Pakistan-wide Delivery" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Main Headline</label>
                  <input value={heroData.title||''} onChange={e => setHeroData(h=>({...h,title:e.target.value}))} placeholder="Smart Shopping, Better Living." />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Subtitle</label>
                  <input value={heroData.subtitle||''} onChange={e => setHeroData(h=>({...h,subtitle:e.target.value}))} placeholder="Trusted by customers across Punjab & Pakistan" />
                </div>
                <button onClick={() => saveSetting('hero', { ...heroData, images: heroImages })}
                  disabled={saving.hero} className="btn-primary w-full py-3 font-bold">
                  {saving.hero ? '⏳ Saving…' : '💾 Save Hero Text'}
                </button>
              </div>
            </div>

            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor:'var(--viro-border)' }}>
                <div>
                  <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🖼️ Hero Images</h3>
                  <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>Bucket: <code style={{ color:'#A78BFA' }}>hero_img</code></p>
                </div>
                <button onClick={() => heroRef.current?.click()} className="px-3 py-2 rounded-xl text-xs font-bold text-white"
                  style={{ background:'linear-gradient(135deg,#8B5CF6,#F97316)' }}>📸 Upload</button>
                <input ref={heroRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => uploadToBucket('hero_img', Array.from(e.target.files||[]), setHeroImages, ()=>{}).then(()=>{ e.target.value='' })} />
              </div>
              <div className="p-4">
                <ImageGrid images={heroImages} bucket="hero_img" setImages={setHeroImages} label="Hero Images" />
              </div>
            </div>
          </div>
        )}

        {/* ══════════ HOT DEALS ══════════ */}
        {activeSection === 'hotads' && (
          <div className="viro-card overflow-hidden fade-in">
            <div className="px-4 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
              <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🔥 Hot Deals Strip</h3>
              <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>Promotional banner below hero</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                <div>
                  <p className="text-xs font-bold" style={{ color:'var(--viro-text)' }}>Show Hot Deals Strip</p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                    {hotAds.enabled ? 'Visible to customers' : 'Hidden from customers'}
                  </p>
                </div>
                <button onClick={() => setHotAds(h => ({ ...h, enabled: !h.enabled }))}
                  className="w-12 h-6 rounded-full transition-all relative"
                  style={{ background: hotAds.enabled ? '#10B981' : '#334155' }}>
                  <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                    style={{ left: hotAds.enabled ? '26px' : '2px' }} />
                </button>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>Strip Title</label>
                <input value={hotAds.title||''} onChange={e => setHotAds(h=>({...h,title:e.target.value}))} placeholder="🔥 Hot Deals" />
              </div>
              <button onClick={() => saveSetting('hot_ads', hotAds)} disabled={saving.hot_ads}
                className="btn-primary w-full py-3 font-bold">
                {saving.hot_ads ? '⏳ Saving…' : '💾 Save Hot Deals'}
              </button>
            </div>
          </div>
        )}

        {/* ══════════ ORDER BADGE ══════════ */}
        {activeSection === 'orderbadge' && (
          <div className="space-y-4 fade-in">
            {/* Global toggle */}
            <div className="viro-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ background:'#F9731608', borderColor:'#F9731620' }}>
                <div>
                  <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>
                    🔥 Order Count Badge
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                    Show "X ordered" social-proof badge on product cards
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-bold"
                  style={ordersBadgeEnabled
                    ? { background:'#F9731615', color:'#F97316', border:'1px solid #F9731630' }
                    : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
                  {ordersBadgeEnabled ? '🔥 Active' : '⬛ Hidden'}
                </span>
              </div>

              <div className="p-4 space-y-3">
                {/* Big toggle */}
                <div className="flex items-center gap-4 p-4 rounded-2xl"
                  style={{ background: ordersBadgeEnabled ? '#F9731610' : 'var(--viro-bgDeep)',
                           border: `2px solid ${ordersBadgeEnabled ? '#F9731640' : 'var(--viro-border)'}`,
                           transition: 'all 0.2s' }}>
                  <div className="flex-1">
                    <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>
                      Show Order Badges Site-Wide
                    </p>
                    <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                      {ordersBadgeEnabled
                        ? 'Customers see "🔥 X ordered" on products where you enabled the badge'
                        : 'All order badges hidden — no "X ordered" shown anywhere'}
                    </p>
                  </div>
                  <button
                    disabled={orderBadgeSaving}
                    onClick={async () => {
                      const next = !ordersBadgeEnabled
                      setOrderBadgeSaving(true)
                      await supabase.from('site_settings')
                        .upsert({ key:'orders_badge_settings', value:{ enabled: next } }, { onConflict:'key' })
                      setOrdersBadgeEnabled(next)
                      setOrderBadgeSaving(false)
                      showSimpleToast(next ? '🔥 Order badges enabled' : '⬛ Order badges hidden', 'success')
                    }}
                    style={{
                      width:64, height:32, borderRadius:16, position:'relative', border:'none',
                      background: ordersBadgeEnabled ? 'linear-gradient(135deg,#EF4444,#F97316)' : '#334155',
                      boxShadow: ordersBadgeEnabled ? '0 0 12px #F9731650' : 'none',
                      cursor: orderBadgeSaving ? 'not-allowed' : 'pointer',
                      opacity: orderBadgeSaving ? 0.7 : 1, flexShrink:0,
                    }}>
                    <span style={{
                      position:'absolute', top:4, width:24, height:24, borderRadius:'50%',
                      background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.3)',
                      left: ordersBadgeEnabled ? 36 : 4, transition:'left 0.2s',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:12,
                    }}>{orderBadgeSaving ? '⏳' : ordersBadgeEnabled ? '🔥' : '⬛'}</span>
                  </button>
                </div>

                {/* Preview badge */}
                <div className="rounded-xl p-3" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                  <p className="text-xs font-bold mb-2" style={{ color:'var(--viro-textSub)' }}>👁️ Preview — what customers see on product cards</p>
                  <div className="flex items-center gap-3">
                    <div style={{ width:80, height:60, background:'#F1F5F9', borderRadius:10, position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,#E2E8F0,#CBD5E1)' }} />
                      {ordersBadgeEnabled && (
                        <div style={{
                          position:'absolute', bottom:5, right:5,
                          background:'linear-gradient(135deg,#EF4444,#F97316)',
                          color:'#fff', fontWeight:800, fontSize:8,
                          padding:'1px 5px', borderRadius:10,
                          boxShadow:'0 2px 6px rgba(239,68,68,0.4)',
                        }}>🔥 47 ordered</div>
                      )}
                    </div>
                    <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                      {ordersBadgeEnabled
                        ? '✅ Badge visible — builds trust & urgency'
                        : '❌ Badge hidden — turn on to boost conversions'}
                    </p>
                  </div>
                </div>

                {/* How to use */}
                <div className="rounded-xl p-3 space-y-1.5" style={{ background:'#8B5CF608', border:'1px solid #8B5CF620' }}>
                  <p className="text-xs font-bold" style={{ color:'#A78BFA' }}>📋 How to use</p>
                  <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                    1. Enable the global toggle above (master switch)
                  </p>
                  <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                    2. Go to <strong style={{ color:'var(--viro-text)' }}>Products</strong> tab → click <strong style={{ color:'#F97316' }}>🔥 Badge OFF</strong> on each product you want to show the count
                  </p>
                  <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                    3. Badge auto-hides if count is 0 — no clutter on new products
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ REVIEWS (quick link) ══════════ */}
        {activeSection === 'reviews' && (
          <div className="viro-card overflow-hidden fade-in">
            <div className="px-4 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
              <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>⭐ Review System</h3>
              <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
                Manage reviews, approvals, and global settings
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-xl p-4" style={{ background:'#FBBF2408', border:'1px solid #FBBF2420' }}>
                <p className="text-sm font-bold mb-1" style={{ color:'var(--viro-text)' }}>
                  Full review management is in the <span style={{ color:'#FBBF24' }}>⭐ Reviews</span> tab
                </p>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
                  Approve, hide, or delete customer reviews. Toggle auto-approve. Enable/disable per product from the Products tab.
                </p>
              </div>
              <div className="rounded-xl p-3 space-y-2" style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                <p className="text-xs font-bold" style={{ color:'var(--viro-textSub)' }}>How it works:</p>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>1. Customer orders a product and it gets delivered</p>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>2. "Rate Your Purchase" section appears in their Orders page</p>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>3. They give 1–5 stars + optional title + text</p>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>4. Review shows in ⭐ Reviews tab for your approval</p>
                <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>5. Once approved → visible on product page with star rating</p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ THEME ══════════ */}
        {activeSection === 'theme' && (
          <div className="viro-card overflow-hidden fade-in">
            <div className="px-4 py-3 border-b" style={{ borderColor:'var(--viro-border)' }}>
              <h3 className="font-bold" style={{ color:'var(--viro-text)' }}>🌙 Site Theme</h3>
              <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>Controls light/dark mode for customers</p>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val:'dark',  label:'🌙 Dark Mode',  desc:'Dark background, light text' },
                  { val:'light', label:'☀️ Light Mode', desc:'Light background, dark text' },
                ].map(t => (
                  <button key={t.val} onClick={() => { setTheme(t.val); saveSetting('theme', { mode: t.val }) }}
                    className="p-4 rounded-xl text-left transition-all"
                    style={theme === t.val
                      ? { background:'linear-gradient(135deg,#8B5CF620,#00BFFF20)', border:'2px solid #8B5CF6', boxShadow:'0 0 16px #8B5CF630' }
                      : { background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
                    <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>{t.label}</p>
                    <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>{t.desc}</p>
                    {theme === t.val && <p className="text-xs mt-1 font-bold" style={{ color:'#10B981' }}>✓ Active</p>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

}

// ══════════════════════════════════════════════════════════════
//  CouponsTab — full coupon management + analytics
// ══════════════════════════════════════════════════════════════
function CouponsTab() {
  const { couponEnabled, setCouponEnabled } = useSite()
  const [globalToggleSaving, setGlobalToggleSaving] = useState(false)
  const [coupons, setCoupons]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [form, setForm]         = useState({
    code:'', type:'percent', value:'', min_order:'', max_uses:'', starts_at:'', expires_at:'', enabled:true
  })
  const [editId,  setEditId]    = useState(null)
  const [filter,  setFilter]    = useState('all') // 'all' | 'active' | 'expired' | 'disabled'
  const [err,     setErr]       = useState('')

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setCoupons(data || [])
    } catch(e) {
      // Table may not exist yet — show empty state, don't crash
      if (e.message?.includes('relation') || e.message?.includes('does not exist') || e.code === '42P01') {
        setErr('⚠️ Run viro-v46-complete.sql in Supabase to create the coupons table first.')
      }
      setCoupons([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setForm({ code:'', type:'percent', value:'', min_order:'', max_uses:'', expires_at:'', enabled:true })
    setEditId(null)
    setErr('')
  }

  function startEdit(c) {
    setForm({
      code:      c.code,
      type:      c.type,
      value:     String(c.value),
      min_order: c.min_order ? String(c.min_order) : '',
      max_uses:  c.max_uses  ? String(c.max_uses)  : '',
      starts_at:  c.starts_at  ? c.starts_at.slice(0,16)  : '',
      expires_at: c.expires_at ? c.expires_at.slice(0,16) : '',
      enabled:   c.enabled,
    })
    setEditId(c.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave() {
    setErr('')
    if (!form.code.trim())  return setErr('Coupon code is required')
    if (!form.value)        return setErr('Discount value is required')
    if (form.type === 'percent' && (Number(form.value) < 1 || Number(form.value) > 100))
      return setErr('Percentage must be 1–100')

    setSaving(true)
    const payload = {
      code:       form.code.toUpperCase().trim(),
      type:       form.type,
      value:      Number(form.value),
      min_order:  Number(form.min_order) || 0,
      max_uses:   form.max_uses ? Number(form.max_uses) : null,
      starts_at:  form.starts_at  ? new Date(form.starts_at).toISOString()  : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      enabled:    form.enabled,
    }

    try {
      if (editId) {
        await adminApi('coupon_update', { id: editId, patch: payload })
        showSimpleToast('✅ Coupon updated', 'success')
      } else {
        const r = await adminApi('coupon_create', payload)
        if (!r.ok) throw new Error(r.error || 'Failed to create coupon')
        showSimpleToast('🎟️ Coupon created!', 'success')
      }
      resetForm()
      load()
    } catch(e) {
      setErr(e.message?.includes('duplicate') ? 'Code already exists' : (e.message || 'Save failed'))
    }
    setSaving(false)
  }

  async function toggleEnabled(c) {
    await adminApi('coupon_update', { id: c.id, patch: { enabled: !c.enabled } })
    load()
  }

  async function deleteCoupon(c) {
    if (!confirm(`Delete coupon "${c.code}"? This cannot be undone.`)) return
    await adminApi('coupon_delete', { id: c.id })
    showSimpleToast('🗑️ Coupon deleted', 'info')
    load()
  }

  // Analytics
  const totalIssued = coupons.length
  const totalUsed   = coupons.reduce((s, c) => s + (c.used_count || 0), 0)
  const activeCount = coupons.filter(c => c.enabled && (!c.expires_at || new Date(c.expires_at) > new Date())).length
  const expiredCount= coupons.filter(c => c.expires_at && new Date(c.expires_at) <= new Date()).length

  const now = new Date()
  const filtered = coupons.filter(c => {
    if (filter === 'active')   return c.enabled && (!c.expires_at || new Date(c.expires_at) > now)
    if (filter === 'expired')  return c.expires_at && new Date(c.expires_at) <= now
    if (filter === 'disabled') return !c.enabled
    return true
  })

  return (
    <div className="px-4 pb-24 space-y-4">

      {/* ── Global Coupon Visibility Toggle ── */}
      <div className="viro-card overflow-hidden" style={{ marginTop: 16 }}>
        <div className="p-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🎟️</span>
              <h3 className="font-bold text-base" style={{ color:'var(--viro-text)' }}>
                Show Coupon Field on Checkout
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={couponEnabled
                  ? { background:'#10B98120', color:'#10B981', border:'1px solid #10B98140' }
                  : { background:'#EF444420', color:'#EF4444', border:'1px solid #EF444440' }}>
                {couponEnabled ? '✅ Visible' : '🚫 Hidden'}
              </span>
            </div>
            <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>
              {couponEnabled
                ? 'Customers see a coupon code field at checkout — they can apply any active coupon.'
                : 'Coupon field is hidden. E.g. when you already have a 30% sale running and don't want extra codes applied.'}
            </p>
          </div>
          {/* Big prominent toggle */}
          <button
            onClick={() => saveGlobalCouponToggle(!couponEnabled)}
            disabled={globalToggleSaving}
            className="flex-shrink-0 transition-all"
            style={{
              width: 64, height: 32, borderRadius: 16, position:'relative',
              background: couponEnabled
                ? 'linear-gradient(135deg,#10B981,#059669)'
                : '#334155',
              boxShadow: couponEnabled ? '0 0 12px #10B98150' : 'none',
              border: 'none', cursor: globalToggleSaving ? 'not-allowed' : 'pointer',
              opacity: globalToggleSaving ? 0.7 : 1,
            }}>
            <span style={{
              position:'absolute', top: 4,
              left: couponEnabled ? 36 : 4,
              width: 24, height: 24, borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              transition: 'left 0.2s',
              display: 'flex', alignItems:'center', justifyContent:'center',
              fontSize: 12,
            }}>
              {globalToggleSaving ? '⏳' : couponEnabled ? '✓' : '✕'}
            </span>
          </button>
        </div>
        {/* Contextual hint */}
        <div className="px-4 pb-3">
          <div className="px-3 py-2 rounded-xl text-xs"
            style={{ background: couponEnabled ? '#10B98108' : '#EF444408',
                     border: `1px solid ${couponEnabled ? '#10B98120' : '#EF444420'}` }}>
            {couponEnabled
              ? '💡 Tip: Hide this when running a sitewide sale so customers can't stack discounts.'
              : '💡 Tip: Enable when you want to run a targeted promo — create a code below and share it.'}
          </div>
        </div>
      </div>

      {/* ── Analytics Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {[
          { label:'Total Coupons', value: totalIssued, icon:'🎟️', color:'#8B5CF6' },
          { label:'Times Used',    value: totalUsed,   icon:'✅', color:'#10B981' },
          { label:'Active Now',    value: activeCount, icon:'🟢', color:'#00BFFF' },
          { label:'Expired',       value: expiredCount,icon:'⏰', color:'#F97316' },
        ].map(s => (
          <div key={s.label} className="viro-card p-3 flex flex-col items-center text-center gap-1">
            <span className="text-2xl">{s.icon}</span>
            <span className="text-xl font-black" style={{ color: s.color }}>{s.value}</span>
            <span className="text-xs" style={{ color: 'var(--viro-textSub)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Create / Edit Form ── */}
      <div className="viro-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between"
          style={{ background:'var(--viro-bgDeep)', borderColor:'var(--viro-border)' }}>
          <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>
            {editId ? '✏️ Edit Coupon' : '➕ Create Coupon'}
          </h3>
          {editId && (
            <button onClick={resetForm} className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background:'#EF444420', color:'#EF4444', border:'1px solid #EF444440' }}>
              ✕ Cancel Edit
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          {err && (
            <div className="px-3 py-2 rounded-xl text-sm" style={{ background:'#EF444420', color:'#EF4444', border:'1px solid #EF444440' }}>
              ⚠️ {err}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Code */}
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Coupon Code *
              </label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g,'') }))}
                placeholder="e.g. VIRO20, EID50, SAVE100"
                disabled={!!editId}
                style={{ fontFamily:'monospace', fontWeight:700, fontSize:15, letterSpacing:'0.1em',
                         opacity: editId ? 0.7 : 1 }}
                maxLength={20}
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Discount Type *
              </label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="percent">% Percentage</option>
                <option value="fixed">Rs. Fixed Amount</option>
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                {form.type === 'percent' ? 'Discount % (1–100) *' : 'Discount Amount (Rs.) *'}
              </label>
              <input type="number" min="1" max={form.type === 'percent' ? 100 : undefined}
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder={form.type === 'percent' ? '20' : '200'} />
              {form.value && (
                <p className="text-xs mt-1 font-semibold" style={{ color:'#10B981' }}>
                  {form.type === 'percent'
                    ? `Customer saves ${form.value}% off their order`
                    : `Customer saves Rs.${Number(form.value).toLocaleString()} off`}
                </p>
              )}
            </div>

            {/* Min Order */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Min. Order (Rs.)
              </label>
              <input type="number" min="0"
                value={form.min_order}
                onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))}
                placeholder="0 = no minimum" />
            </div>

            {/* Max Uses */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Max Uses (blank = unlimited)
              </label>
              <input type="number" min="1"
                value={form.max_uses}
                onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                placeholder="e.g. 50, 100" />
            </div>

            {/* Start Date */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Start Date & Time (optional)
              </label>
              <input type="datetime-local"
                value={form.starts_at}
                onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
              {form.starts_at && new Date(form.starts_at) > new Date()
                ? <p className="text-xs mt-1 font-semibold" style={{ color:'#EAB308' }}>⏳ Coupon activates on {new Date(form.starts_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                : <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>Blank = active immediately</p>
              }
            </div>

            {/* Expiry */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color:'var(--viro-textSub)' }}>
                Expiry Date & Time (optional)
              </label>
              <input type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
              {!form.expires_at && <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>No expiry = valid forever</p>}
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center gap-3 p-3 rounded-xl col-span-2 md:col-span-1"
              style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
              <div className="flex-1">
                <p className="text-xs font-bold" style={{ color:'var(--viro-text)' }}>Show Coupon Button to Customers</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                  {form.enabled ? 'Customers will see the coupon field at checkout' : 'Hidden — customers cannot apply this coupon'}
                </p>
              </div>
              <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                className="w-12 h-6 rounded-full transition-all flex-shrink-0 relative"
                style={{ background: form.enabled ? '#10B981' : '#334155' }}>
                <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                  style={{ left: form.enabled ? '26px' : '2px' }} />
              </button>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 font-bold text-sm">
            {saving ? '⏳ Saving…' : editId ? '💾 Update Coupon' : '🎟️ Create Coupon'}
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[['all','All'],['active','🟢 Active'],['expired','⏰ Expired'],['disabled','🔴 Disabled']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={filter === v
              ? { background:'linear-gradient(135deg,#8B5CF6,#00BFFF)', color:'#fff' }
              : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
            {l} {v === 'all' ? `(${coupons.length})` : ''}
          </button>
        ))}
      </div>

      {/* ── Coupon List ── */}
      {loading ? (
        <div className="text-center py-12" style={{ color:'var(--viro-textSub)' }}>Loading coupons…</div>
      ) : filtered.length === 0 ? (
        <div className="viro-card p-8 text-center">
          <p className="text-3xl mb-2">🎟️</p>
          <p className="font-bold" style={{ color:'var(--viro-text)' }}>No coupons found</p>
          <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>Create your first coupon above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const isExpired  = c.expires_at && new Date(c.expires_at) <= now
            const isFull     = c.max_uses && c.used_count >= c.max_uses
            const notStarted = c.starts_at && new Date(c.starts_at) > now
            const isActive   = c.enabled && !isExpired && !isFull && !notStarted
            const usageRatio = c.max_uses ? c.used_count / c.max_uses : 0

            return (
              <div key={c.id} className="viro-card overflow-hidden"
                style={{ borderLeft: `4px solid ${isActive ? '#10B981' : isExpired ? '#F97316' : '#EF4444'}` }}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Code + badge */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-base tracking-widest" style={{ color:'var(--viro-text)', fontFamily:'monospace' }}>
                            {c.code}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: isActive ? '#10B98120' : '#EF444420',
                                     color:      isActive ? '#10B981'   : '#EF4444',
                                     border: `1px solid ${isActive ? '#10B98140' : '#EF444440'}` }}>
                            {isActive ? '🟢 Active' : notStarted ? '📅 Scheduled' : isExpired ? '⏰ Expired' : isFull ? '🔴 Limit Reached' : '⛔ Disabled'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color:'var(--viro-textSub)' }}>
                          <span className="font-bold" style={{ color:'#A78BFA' }}>
                            {c.type === 'percent' ? `${c.value}% OFF` : `Rs.${c.value} OFF`}
                          </span>
                          {c.min_order > 0 && <span>Min. Rs.{c.min_order.toLocaleString()}</span>}
                          {c.expires_at && (
                            <span style={{ color: isExpired ? '#EF4444' : 'var(--viro-textSub)' }}>
                              {isExpired ? '⚠️ Expired' : '⏰ Expires'}: {new Date(c.expires_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                            </span>
                          )}
                          {c.starts_at && new Date(c.starts_at) > new Date() && (
                            <span style={{ color:'#EAB308' }}>
                              ⏳ Starts: {new Date(c.starts_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})}
                            </span>
                          )}
                          {!c.expires_at && <span>⟾ No expiry</span>}
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Enable/disable toggle */}
                      <button onClick={() => toggleEnabled(c)} title={c.enabled ? 'Disable' : 'Enable'}
                        className="w-10 h-5 rounded-full relative transition-all"
                        style={{ background: c.enabled ? '#10B981' : '#334155' }}>
                        <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                          style={{ left: c.enabled ? '22px' : '2px' }} />
                      </button>
                      <button onClick={() => startEdit(c)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background:'#8B5CF620', color:'#A78BFA', border:'1px solid #8B5CF640' }}>
                        ✏️
                      </button>
                      <button onClick={() => deleteCoupon(c)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background:'#EF444420', color:'#EF4444', border:'1px solid #EF444440' }}>
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Usage stats */}
                  <div className="mt-3 pt-3 border-t flex items-center gap-4" style={{ borderColor:'var(--viro-border)' }}>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color:'var(--viro-textSub)' }}>
                          Used: <strong style={{ color:'var(--viro-text)' }}>{c.used_count}</strong>
                          {c.max_uses && <span style={{ color:'var(--viro-textSub)' }}> / {c.max_uses}</span>}
                        </span>
                        {c.max_uses && (
                          <span style={{ color: usageRatio > 0.8 ? '#EF4444' : 'var(--viro-textSub)' }}>
                            {Math.round(usageRatio * 100)}% used
                          </span>
                        )}
                      </div>
                      {c.max_uses ? (
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--viro-bgDeep)' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, usageRatio * 100)}%`,
                              background: usageRatio > 0.8 ? '#EF4444' : usageRatio > 0.5 ? '#F97316' : '#10B981'
                            }} />
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color:'var(--viro-textSub)' }}>Unlimited uses</p>
                      )}
                    </div>
                    <div className="text-xs text-right flex-shrink-0" style={{ color:'var(--viro-textSub)' }}>
                      Created<br/>{new Date(c.created_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short' })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  ReviewsTab — moderation panel + global settings
// ══════════════════════════════════════════════════════════════
function ReviewsTab() {
  const { reviewsEnabled, setReviewsEnabled, autoApproveReviews, setAutoApproveReviews } = useSite()
  const [reviews,      setReviews]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('pending')
  const [settingSaving,setSettingSaving] = useState(false)

  // Analytics
  const [stats, setStats] = useState({ total:0, pending:0, approved:0, hidden:0, avgRating:0 })

  async function load() {
    setLoading(true)
    try {
      // Admin reads ALL reviews via service role — needs RLS bypass
      // We use the anon key but service_role policy allows it via supabase directly
      const { data } = await supabase
        .from('reviews')
        .select('*, products(name, images), customers(name, phone)')
        .order('created_at', { ascending: false })

      const all = data || []
      setReviews(all)
      setStats({
        total:    all.length,
        pending:  all.filter(r => r.status === 'pending').length,
        approved: all.filter(r => r.status === 'approved').length,
        hidden:   all.filter(r => r.status === 'hidden').length,
        avgRating: all.length ? (all.reduce((s,r) => s+r.rating,0)/all.length).toFixed(1) : 0,
      })
    } catch { setReviews([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setStatus(id, status) {
    await supabase.from('reviews').update({ status }).eq('id', id)
    load()
    showSimpleToast(status === 'approved' ? '✅ Review approved' : status === 'hidden' ? '🚫 Review hidden' : '🗑️ Deleted', 'success')
  }

  async function deleteReview(id) {
    if (!confirm('Delete this review permanently?')) return
    await supabase.from('reviews').delete().eq('id', id)
    load()
    showSimpleToast('🗑️ Review deleted', 'info')
  }

  async function saveGlobalSettings(enabled, autoApprove) {
    setSettingSaving(true)
    await supabase.from('site_settings')
      .upsert({ key:'review_settings', value:{ enabled, auto_approve: autoApprove } }, { onConflict:'key' })
    setReviewsEnabled(enabled)
    setAutoApproveReviews(autoApprove)
    setSettingSaving(false)
    showSimpleToast('✅ Review settings saved', 'success')
  }

  const filtered = reviews.filter(r =>
    filter === 'all' ? true : r.status === filter
  )

  const STAR_COLORS = ['','#EF4444','#F97316','#EAB308','#84CC16','#10B981']

  return (
    <div className="px-4 pb-24 space-y-4">

      {/* ── Global Settings Card ── */}
      <div className="viro-card overflow-hidden" style={{ marginTop:16 }}>
        <div className="px-4 py-3 border-b flex items-center justify-between"
          style={{ background:'#FBBF2408', borderColor:'#FBBF2420' }}>
          <div>
            <h3 className="font-bold flex items-center gap-2" style={{ color:'var(--viro-text)' }}>
              ⭐ Review System Settings
            </h3>
            <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
              Global controls — also set per-product in Products tab
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full font-bold"
            style={reviewsEnabled
              ? { background:'#10B98115', color:'#10B981', border:'1px solid #10B98130' }
              : { background:'#EF444415', color:'#EF4444', border:'1px solid #EF444430' }}>
            {reviewsEnabled ? '✅ On' : '🚫 Off'}
          </span>
        </div>

        <div className="p-4 space-y-3">
          {/* Master on/off */}
          <div className="flex items-center gap-4 p-3 rounded-xl"
            style={{ background: reviewsEnabled ? '#10B98110' : 'var(--viro-bgDeep)',
                     border:`2px solid ${reviewsEnabled ? '#10B98130' : 'var(--viro-border)'}` }}>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Show Reviews on Products</p>
              <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                {reviewsEnabled ? 'Reviews visible on product pages & delivery orders' : 'All reviews hidden sitewide'}
              </p>
            </div>
            <button onClick={() => saveGlobalSettings(!reviewsEnabled, autoApproveReviews)}
              disabled={settingSaving}
              style={{
                width:56, height:28, borderRadius:14, position:'relative', border:'none', flexShrink:0,
                background: reviewsEnabled ? 'linear-gradient(135deg,#10B981,#059669)' : '#334155',
                boxShadow: reviewsEnabled ? '0 0 10px #10B98150' : 'none',
                cursor: settingSaving ? 'not-allowed' : 'pointer',
              }}>
              <span style={{
                position:'absolute', top:3, width:22, height:22, borderRadius:'50%',
                background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.2)',
                left: reviewsEnabled ? 30 : 3, transition:'left 0.2s',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:11,
              }}>{settingSaving ? '⏳' : reviewsEnabled ? '✓' : '✕'}</span>
            </button>
          </div>

          {/* Auto-approve toggle */}
          <div className="flex items-center gap-4 p-3 rounded-xl"
            style={{ background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color:'var(--viro-text)' }}>Auto-Approve Reviews</p>
              <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                {autoApproveReviews
                  ? 'Reviews go live immediately — no manual approval needed'
                  : 'Reviews wait for your approval before showing publicly'}
              </p>
            </div>
            <button onClick={() => saveGlobalSettings(reviewsEnabled, !autoApproveReviews)}
              disabled={settingSaving}
              style={{
                width:56, height:28, borderRadius:14, position:'relative', border:'none', flexShrink:0,
                background: autoApproveReviews ? '#8B5CF6' : '#334155',
                cursor: settingSaving ? 'not-allowed' : 'pointer',
              }}>
              <span style={{
                position:'absolute', top:3, width:22, height:22, borderRadius:'50%',
                background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.2)',
                left: autoApproveReviews ? 30 : 3, transition:'left 0.2s',
              }}/>
            </button>
          </div>
        </div>
      </div>

      {/* ── Analytics Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label:'Total',    value:stats.total,    icon:'📝', color:'#8B5CF6' },
          { label:'Pending',  value:stats.pending,  icon:'⏳', color:'#EAB308' },
          { label:'Approved', value:stats.approved, icon:'✅', color:'#10B981' },
          { label:'Hidden',   value:stats.hidden,   icon:'🚫', color:'#EF4444' },
          { label:'Avg Rating', value:stats.avgRating > 0 ? `${stats.avgRating}⭐` : '—', icon:'⭐', color:'#FBBF24' },
        ].map(s => (
          <div key={s.label} className="viro-card p-3 flex flex-col items-center text-center gap-1">
            <span className="text-xl">{s.icon}</span>
            <span className="text-lg font-black" style={{ color:s.color }}>{s.value}</span>
            <span className="text-xs" style={{ color:'var(--viro-textSub)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          ['pending','⏳ Pending'],['approved','✅ Approved'],
          ['hidden','🚫 Hidden'],['all','All'],
        ].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={filter===v
              ? { background:'linear-gradient(135deg,#FBBF24,#F59E0B)', color:'#1a1a1a' }
              : { background:'var(--viro-bgDeep)', color:'var(--viro-textSub)', border:'1px solid var(--viro-border)' }}>
            {l}
            {v !== 'all' && stats[v] > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                style={{ background:'rgba(0,0,0,0.15)' }}>{stats[v]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Review List ── */}
      {loading ? (
        <div className="text-center py-12" style={{ color:'var(--viro-textSub)' }}>Loading reviews…</div>
      ) : filtered.length === 0 ? (
        <div className="viro-card p-8 text-center">
          <p className="text-3xl mb-2">⭐</p>
          <p className="font-bold" style={{ color:'var(--viro-text)' }}>
            {filter === 'pending' ? 'No reviews awaiting approval' : 'No reviews found'}
          </p>
          <p className="text-xs mt-1" style={{ color:'var(--viro-textSub)' }}>
            {filter === 'pending' ? 'All caught up! 🎉' : 'Switch filter to see other reviews'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const product = r.products
            const customer = r.customers
            const imgs = Array.isArray(product?.images) ? product.images
              : (typeof product?.images==='string' ? (() => { try { return JSON.parse(product.images) } catch { return [] } })() : [])
            const thumb = imgs[0]
            const isPending  = r.status === 'pending'
            const isApproved = r.status === 'approved'
            const isHidden   = r.status === 'hidden'

            return (
              <div key={r.id} className="viro-card overflow-hidden"
                style={{ borderLeft:`4px solid ${isPending ? '#EAB308' : isApproved ? '#10B981' : '#EF4444'}` }}>

                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-3 border-b"
                  style={{ background:'var(--viro-bgDeep)', borderColor:'var(--viro-border)' }}>
                  {thumb && (
                    <img src={thumb} alt={product?.name} style={{ width:36, height:36, borderRadius:8, objectFit:'cover', flexShrink:0 }}
                      onError={e => { e.target.style.display='none' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color:'var(--viro-text)' }}>{product?.name || 'Unknown Product'}</p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--viro-textSub)' }}>
                      by <strong>{r.reviewer_name || customer?.name || 'Anonymous'}</strong>
                      {customer?.phone && <span> · {customer.phone}</span>}
                      {' · '}{new Date(r.created_at).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-bold flex-shrink-0"
                    style={{
                      background: isPending ? '#EAB30820' : isApproved ? '#10B98120' : '#EF444420',
                      color:      isPending ? '#EAB308'   : isApproved ? '#10B981'   : '#EF4444',
                      border:`1px solid ${isPending ? '#EAB30840' : isApproved ? '#10B98140' : '#EF444440'}`,
                    }}>
                    {isPending ? '⏳ Pending' : isApproved ? '✅ Live' : '🚫 Hidden'}
                  </span>
                </div>

                <div className="p-4">
                  {/* Stars */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} style={{ fontSize:16, color: n<=r.rating ? '#FBBF24' : '#374151' }}>★</span>
                      ))}
                    </div>
                    <span className="text-sm font-black" style={{ color:STAR_COLORS[r.rating] }}>
                      {['','😞','😕','😐','😊','🤩'][r.rating]} {r.rating}/5
                    </span>
                  </div>

                  {r.title && <p className="font-bold text-sm mb-1" style={{ color:'var(--viro-text)' }}>"{r.title}"</p>}
                  {r.body  && <p className="text-xs leading-relaxed" style={{ color:'var(--viro-textSub)' }}>{r.body}</p>}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {!isApproved && (
                      <button onClick={() => setStatus(r.id, 'approved')}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background:'#10B98120', color:'#10B981', border:'1px solid #10B98140' }}>
                        ✅ Approve
                      </button>
                    )}
                    {!isHidden && (
                      <button onClick={() => setStatus(r.id, 'hidden')}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background:'#EF444420', color:'#EF4444', border:'1px solid #EF444440' }}>
                        🚫 Hide
                      </button>
                    )}
                    {isHidden && (
                      <button onClick={() => setStatus(r.id, 'pending')}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background:'#EAB30820', color:'#EAB308', border:'1px solid #EAB30840' }}>
                        ↩️ Restore
                      </button>
                    )}
                    <button onClick={() => deleteReview(r.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background:'#1E293B', color:'#94A3B8', border:'1px solid var(--viro-border)' }}>
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
