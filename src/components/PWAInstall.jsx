import React, { useEffect, useState } from 'react'

export default function PWAInstall() {
  const [prompt, setPrompt] = useState(null)
  const [show, setShow]     = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true); return
    }
    const handler = e => { e.preventDefault(); setPrompt(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setInstalled(true); setShow(false) })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setShow(false)
  }

  if (!show || installed) return null

  return (
    <div className="fixed bottom-20 left-3 right-3 md:left-auto md:right-4 md:w-80 z-50 fade-in"
      style={{ animation: 'slideUp 0.4s ease' }}>
      <div className="rounded-2xl p-4 shadow-2xl"
        style={{ background: 'var(--viro-bgCard)', border: '1px solid var(--viro-border)',
          boxShadow: '0 8px 32px rgba(139,92,246,0.25)' }}>
        <div className="flex items-start gap-3">
          <img src="/logo.jpg" alt="Viro" className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
            onError={e => { e.target.style.display='none' }} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: 'var(--viro-text)' }}>Install Viro App</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--viro-textSub)' }}>
              Add to home screen for faster access & offline browsing
            </p>
          </div>
          <button onClick={() => setShow(false)}
            className="flex-shrink-0 text-xs" style={{ color: 'var(--viro-textSub)' }}>✕</button>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={install}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white"
            style={{ background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)' }}>
            📲 Install App
          </button>
          <button onClick={() => setShow(false)}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: 'var(--viro-bgDeep)', color: 'var(--viro-textMuted)', border: '1px solid var(--viro-border)' }}>
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
