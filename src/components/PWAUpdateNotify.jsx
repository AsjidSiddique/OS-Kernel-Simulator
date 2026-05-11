import React, { useEffect, useState } from 'react'

// Shows a branded notification when a new SW version is available
export default function PWAUpdateNotify() {
  const [show, setShow] = useState(false)
  const [reg, setReg]   = useState(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistration().then(r => {
      if (!r) return
      setReg(r)

      // If there's already a waiting worker (new version ready)
      if (r.waiting) { setShow(true); return }

      // Listen for new SW installing
      r.addEventListener('updatefound', () => {
        const newWorker = r.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setShow(true)
          }
        })
      })
    })

    // Also re-check on focus (user returns to tab)
    const onFocus = () => {
      navigator.serviceWorker.getRegistration().then(r => {
        if (r?.waiting) setShow(true)
      })
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  function applyUpdate() {
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    setShow(false)
    // Reload after SW takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload())
    setTimeout(() => window.location.reload(), 800)
  }

  if (!show) return null

  return (
    <>
      <style>{`
        @keyframes updateSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .update-notify { animation: updateSlideUp 0.35s cubic-bezier(.4,0,.2,1) both; }
      `}</style>
      <div className="update-notify fixed bottom-24 left-3 right-3 md:left-auto md:right-5 md:w-80 z-[9990]"
        style={{
          background: 'var(--viro-bgCard)',
          border: '1px solid var(--viro-border)',
          borderRadius: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}>
        {/* Gradient top bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg,#00BFFF,#8B5CF6,#F97316)' }} />

        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            {/* Viro logo */}
            <img src="/icon-192.png" alt="Viro"
              style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: 'var(--viro-text)', fontWeight: 700, fontSize: 14, margin: 0 }}>
                🎉 Viro Updated!
              </p>
              <p style={{ color: 'var(--viro-textSub)', fontSize: 12, margin: '2px 0 0' }}>
                A new version is ready with improvements.
              </p>
            </div>
            <button onClick={() => setShow(false)}
              style={{ color: 'var(--viro-textSub)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1 }}>
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShow(false)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: 'var(--viro-bgDeep)', color: 'var(--viro-textSub)',
                border: '1px solid var(--viro-border)', cursor: 'pointer'
              }}>
              Later
            </button>
            <button onClick={applyUpdate}
              style={{
                flex: 2, padding: '9px 0', borderRadius: 12, fontSize: 12, fontWeight: 700,
                background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
                color: '#fff', border: 'none', cursor: 'pointer'
              }}>
              🔄 Update Now
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
