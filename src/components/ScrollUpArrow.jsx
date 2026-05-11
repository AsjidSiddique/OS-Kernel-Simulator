import React, { useEffect, useState, useRef } from 'react'

export default function ScrollUpArrow() {
  const [show, setShow] = useState(false)
  // Fix #17: Throttle scroll handler to max once per 100ms
  const ticking = useRef(false)

  useEffect(() => {
    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true
        requestAnimationFrame(() => {
          setShow(window.scrollY > 300)
          ticking.current = false
        })
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!show) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-all active:scale-90"
      style={{
        bottom: '90px',
        right: '16px',
        width: '42px',
        height: '42px',
        background: 'linear-gradient(135deg,#8B5CF6,#00BFFF)',
        boxShadow: '0 4px 16px rgba(139,92,246,0.4)',
        animation: 'fadeIn 0.25s ease',
      }}
      aria-label="Back to top">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  )
}
