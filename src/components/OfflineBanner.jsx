import React, { useEffect, useState, useRef } from 'react'

export default function OfflineBanner() {
  const [visible, setVisible] = useState(false)
  const [isBack, setIsBack]   = useState(false)
  const hideTimer = useRef(null)

  function showBriefly(type) {
    clearTimeout(hideTimer.current)
    setIsBack(type === 'back')
    setVisible(true)
    // Always auto-hide after 2.5s — never stays permanently
    hideTimer.current = setTimeout(() => setVisible(false), 2500)
  }

  useEffect(() => {
    // Only show on actual disconnect — not on first load if already offline
    function handleOffline() { showBriefly('offline') }
    function handleOnline()  { showBriefly('back') }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online',  handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online',  handleOnline)
      clearTimeout(hideTimer.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '8px 16px',
        background: isBack ? '#10B981' : '#EF4444',
        color: '#fff', fontSize: 12, fontWeight: 700,
        boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
        animation: 'offlineIn 0.3s cubic-bezier(.4,0,.2,1)',
      }}>
      <style>{`
        @keyframes offlineIn  { from{opacity:0;transform:translateY(-100%)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <span>{isBack ? '✅' : '📵'}</span>
      <span>{isBack ? 'Back online!' : 'No internet — you\'re offline'}</span>
    </div>
  )
}
