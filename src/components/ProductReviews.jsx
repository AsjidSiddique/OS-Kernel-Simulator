// ── ProductReviews.jsx ─────────────────────────────────────────
// Shows star ratings + text reviews on ProductDetail.
// Also used as a "Leave a Review" widget in Orders page (post-delivery).
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteSettingsContext'

// ── Star renderer ─────────────────────────────────────────────
function Stars({ rating, size = 16, interactive = false, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div style={{ display:'flex', gap:2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n}
          onClick={interactive ? () => onChange?.(n) : undefined}
          onMouseEnter={interactive ? () => setHovered(n) : undefined}
          onMouseLeave={interactive ? () => setHovered(0) : undefined}
          style={{
            fontSize: size,
            cursor: interactive ? 'pointer' : 'default',
            color: n <= (hovered || rating) ? '#FBBF24' : '#D1D5DB',
            transition: 'color 0.1s',
            userSelect: 'none',
          }}>★</span>
      ))}
    </div>
  )
}

// ── Average rating bar ────────────────────────────────────────
function RatingBar({ count, total, value }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
      <span style={{ fontSize:11, color:'#FBBF24', width:8 }}>{value}</span>
      <span style={{ fontSize:9 }}>★</span>
      <div style={{ flex:1, height:6, borderRadius:3, background:'var(--viro-border)', overflow:'hidden' }}>
        <div style={{
          width:`${pct}%`, height:'100%', borderRadius:3,
          background:'linear-gradient(90deg,#FBBF24,#F59E0B)',
          transition:'width 0.4s',
        }} />
      </div>
      <span style={{ fontSize:10, color:'var(--viro-textSub)', width:20, textAlign:'right' }}>{count}</span>
    </div>
  )
}

// ── Main reviews display + submit ─────────────────────────────
export function ProductReviews({ productId, productReviewsEnabled = true }) {
  const { reviewsEnabled } = useSite()
  const [reviews,   setReviews]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showAll,   setShowAll]   = useState(false)

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    const { data } = await supabase
      .from('reviews')
      .select('id,rating,title,body,reviewer_name,created_at')
      .eq('product_id', productId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    setReviews(data || [])
    setLoading(false)
  }, [productId])

  useEffect(() => { load() }, [load])

  // Don't render if disabled globally or per-product
  if (!reviewsEnabled || !productReviewsEnabled) return null

  const total   = reviews.length
  const avg     = total > 0 ? (reviews.reduce((s,r) => s + r.rating, 0) / total).toFixed(1) : null
  const dist    = [5,4,3,2,1].map(v => ({ value:v, count: reviews.filter(r => r.rating === v).length }))
  const visible = showAll ? reviews : reviews.slice(0, 3)

  return (
    <div style={{
      borderRadius:16, overflow:'hidden',
      border:'1px solid var(--viro-border)',
      background:'var(--viro-bgCard)',
      marginTop:0,
    }}>
      {/* Header */}
      <div style={{
        padding:'12px 16px', borderBottom:'1px solid var(--viro-border)',
        background:'var(--viro-bgDeep)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div>
          <h3 style={{ fontWeight:700, fontSize:14, color:'var(--viro-text)', margin:0 }}>
            ⭐ Customer Reviews
          </h3>
          {avg && <p style={{ fontSize:11, color:'var(--viro-textSub)', marginTop:2 }}>
            {avg} out of 5 · {total} review{total !== 1 ? 's' : ''}
          </p>}
        </div>
        {avg && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:28, fontWeight:900, color:'#FBBF24', lineHeight:1 }}>{avg}</div>
            <Stars rating={Math.round(parseFloat(avg))} size={12} />
          </div>
        )}
      </div>

      <div style={{ padding:'14px 16px' }}>
        {loading ? (
          <p style={{ fontSize:12, color:'var(--viro-textSub)', textAlign:'center', padding:16 }}>Loading reviews…</p>
        ) : total === 0 ? (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <p style={{ fontSize:28, marginBottom:6 }}>💬</p>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--viro-text)' }}>No reviews yet</p>
            <p style={{ fontSize:11, color:'var(--viro-textSub)', marginTop:4 }}>Be the first to review this product after your order is delivered.</p>
          </div>
        ) : (
          <>
            {/* Rating distribution */}
            <div style={{ marginBottom:14 }}>
              {dist.map(d => (
                <RatingBar key={d.value} value={d.value} count={d.count} total={total} />
              ))}
            </div>

            {/* Review cards */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {visible.map(r => (
                <div key={r.id} style={{
                  padding:'10px 12px', borderRadius:12,
                  background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{
                        width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#8B5CF6,#00BFFF)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:12, fontWeight:700, color:'#fff', flexShrink:0,
                      }}>{(r.reviewer_name||'A')[0].toUpperCase()}</div>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--viro-text)' }}>
                        {r.reviewer_name || 'Verified Customer'}
                      </span>
                      <span style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background:'#10B98115', color:'#10B981', fontWeight:600 }}>
                        ✓ Verified
                      </span>
                    </div>
                    <span style={{ fontSize:10, color:'var(--viro-textSub)' }}>
                      {new Date(r.created_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' })}
                    </span>
                  </div>
                  <Stars rating={r.rating} size={13} />
                  {r.title && <p style={{ fontSize:13, fontWeight:700, color:'var(--viro-text)', margin:'5px 0 2px' }}>{r.title}</p>}
                  {r.body  && <p style={{ fontSize:12, color:'var(--viro-textMuted)', lineHeight:1.5, marginTop:4 }}>{r.body}</p>}
                </div>
              ))}
            </div>

            {total > 3 && (
              <button
                onClick={() => setShowAll(v => !v)}
                style={{
                  width:'100%', marginTop:10, padding:'8px 0', borderRadius:10,
                  background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)',
                  color:'var(--viro-textSub)', fontSize:12, fontWeight:600, cursor:'pointer',
                }}>
                {showAll ? '▲ Show fewer' : `▼ Show all ${total} reviews`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Leave a Review widget (used in Orders page after DELIVERED) ──
export function LeaveReview({ orderId, productId, productName, productThumb, customerId, reviewerName, onSubmitted }) {
  const { reviewsEnabled, autoApproveReviews } = useSite()
  const [rating,    setRating]    = useState(0)
  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [existing,  setExisting]  = useState(null)
  const [checked,   setChecked]   = useState(false)
  const [err,       setErr]       = useState('')

  // Check if already reviewed
  useEffect(() => {
    if (!orderId || !productId) return
    supabase.from('reviews')
      .select('id,rating,title,body,status')
      .eq('order_id', orderId)
      .eq('product_id', productId)
      .maybeSingle()
      .then(({ data }) => { setExisting(data); setChecked(true) })
  }, [orderId, productId])

  if (!reviewsEnabled) return null
  if (!checked) return null

  if (existing) return (
    <div style={{ padding:'10px 12px', borderRadius:12, background:'#10B98110', border:'1.5px solid #10B98130' }}>
      <p style={{ fontSize:12, fontWeight:700, color:'#10B981' }}>✓ Review submitted</p>
      <Stars rating={existing.rating} size={14} />
      {existing.status === 'pending' && (
        <p style={{ fontSize:10, color:'var(--viro-textSub)', marginTop:4 }}>⏳ Awaiting admin approval</p>
      )}
    </div>
  )

  if (submitted) return (
    <div style={{ padding:'12px', borderRadius:12, background:'#10B98110', border:'1.5px solid #10B98130', textAlign:'center' }}>
      <p style={{ fontSize:18, marginBottom:4 }}>🎉</p>
      <p style={{ fontSize:13, fontWeight:700, color:'#10B981' }}>Thank you for your review!</p>
      <p style={{ fontSize:11, color:'var(--viro-textSub)', marginTop:2 }}>
        {autoApproveReviews ? 'Your review is now live.' : 'Your review is pending approval.'}
      </p>
    </div>
  )

  async function submit() {
    if (rating === 0) { setErr('Please select a star rating'); return }
    setErr(''); setLoading(true)
    const { error } = await supabase.from('reviews').insert({
      product_id:    productId,
      order_id:      orderId,
      customer_id:   customerId || null,
      rating,
      title:         title.trim() || null,
      body:          body.trim()  || null,
      reviewer_name: reviewerName || null,
      status:        autoApproveReviews ? 'approved' : 'pending',
    })
    setLoading(false)
    if (error) {
      if (error.code === '23505') { setExisting({ rating, title, body, status:'pending' }); return }
      setErr('Failed to submit. Please try again.')
      return
    }
    setSubmitted(true)
    onSubmitted?.()
  }

  return (
    <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid var(--viro-border)', background:'var(--viro-bgDeep)' }}>
      {/* Product info header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderBottom:'1px solid var(--viro-border)', background:'var(--viro-bgCard)' }}>
        {productThumb && (
          <img src={productThumb} alt={productName} style={{ width:36, height:36, borderRadius:8, objectFit:'cover', flexShrink:0 }} onError={e => { e.target.style.display='none' }} />
        )}
        <div>
          <p style={{ fontSize:11, color:'var(--viro-textSub)' }}>Rate your purchase</p>
          <p style={{ fontSize:13, fontWeight:700, color:'var(--viro-text)' }}>{productName}</p>
        </div>
      </div>

      <div style={{ padding:'12px' }}>
        {/* Star picker */}
        <div style={{ marginBottom:10 }}>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--viro-textSub)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Your Rating *</p>
          <Stars rating={rating} size={28} interactive onChange={setRating} />
          {rating > 0 && (
            <p style={{ fontSize:11, color:'#FBBF24', marginTop:4, fontWeight:600 }}>
              {['','😞 Poor','😕 Fair','😐 OK','😊 Good','🤩 Excellent!'][rating]}
            </p>
          )}
        </div>

        {/* Optional text */}
        <div style={{ marginBottom:8 }}>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--viro-textSub)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Title (optional)</p>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Great quality!" maxLength={80} />
        </div>
        <div style={{ marginBottom:10 }}>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--viro-textSub)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Review (optional)</p>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Tell others what you think about this product…"
            rows={3} maxLength={500}
            style={{ width:'100%', resize:'vertical', fontSize:13 }} />
        </div>

        {err && <p style={{ fontSize:12, color:'#EF4444', marginBottom:8 }}>⚠️ {err}</p>}

        <button onClick={submit} disabled={loading || rating === 0}
          style={{
            width:'100%', padding:'10px 0', borderRadius:12, border:'none',
            background: rating > 0 ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : 'var(--viro-bgCard)',
            color: rating > 0 ? '#1a1a1a' : 'var(--viro-textSub)',
            fontWeight:800, fontSize:13, cursor: rating > 0 ? 'pointer' : 'not-allowed',
            transition:'all 0.2s',
          }}>
          {loading ? '⏳ Submitting…' : rating === 0 ? 'Select stars to review' : `⭐ Submit ${rating}-Star Review`}
        </button>
      </div>
    </div>
  )
}

export { Stars }
export default ProductReviews
