import React, { useEffect, useState, useRef, useCallback } from 'react'

function getTimeLeft(endAt) {
  if (!endAt) return null
  const diff = new Date(endAt).getTime() - Date.now()
  if (diff <= 0) return null
  const totalSecs = Math.floor(diff / 1000)
  const d = Math.floor(totalSecs / 86400)
  const h = Math.floor((totalSecs % 86400) / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return { d, h, m, s, totalSecs }
}

// Shared hook — pauses when tab hidden, fires onExpire callback once when timer hits zero
function useCountdown(endAt, onExpire) {
  const [left, setLeft] = useState(() => getTimeLeft(endAt))
  const timerRef  = useRef(null)
  const firedRef  = useRef(false)   // v46: ensure onExpire fires exactly once
  const onExpireRef = useRef(onExpire)
  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  useEffect(() => {
    firedRef.current = false          // reset when endAt changes
    if (!endAt) return

    function tick() {
      const t = getTimeLeft(endAt)
      setLeft(t)
      // v46: fire onExpire the first time the timer reaches zero
      if (!t && !firedRef.current) {
        firedRef.current = true
        onExpireRef.current?.()
      }
    }

    function start() {
      if (timerRef.current) return
      timerRef.current = setInterval(tick, 1000)
    }
    function stop() {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    function onVisibility() {
      if (document.hidden) stop()
      else { tick(); start() }
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [endAt])

  return left
}

// ── Compact inline badge for ProductCard ──────────────────────
export function CountdownBadge({ endAt, label = '', onExpire }) {
  const left = useCountdown(endAt, onExpire)
  if (!left) return null
  const { d, h, m, s } = left
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:4,padding:'3px 7px',borderRadius:6,
      background:'linear-gradient(135deg,#EF4444,#F97316)',
      boxShadow:'0 2px 6px rgba(239,68,68,0.3)',width:'100%',justifyContent:'center',
    }}>
      <span style={{fontSize:9}}>⏳</span>
      {label ? <span style={{color:'#fff',fontWeight:700,fontSize:9}}>{label}</span> : null}
      {d > 0 && <span style={{color:'#fff',fontWeight:800,fontSize:10}}>{d}d </span>}
      <span style={{color:'#fff',fontWeight:800,fontSize:10,fontVariantNumeric:'tabular-nums'}}>
        {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
      </span>
    </div>
  )
}

// ── Full sale timer for ProductDetail ─────────────────────────
export function CountdownFull({ endAt, label = 'Deal Ends In', onExpire }) {
  const left = useCountdown(endAt, onExpire)
  if (!left) return null
  const { d, h, m, s } = left
  const parts = d > 0
    ? [['Days',d],['Hrs',h],['Min',m],['Sec',s]]
    : [['Hrs',h],['Min',m],['Sec',s]]
  return (
    <>
      <style>{`
        @keyframes cdGlow{0%,100%{box-shadow:0 0 8px rgba(239,68,68,0.2)}50%{box-shadow:0 0 16px rgba(249,115,22,0.4)}}
        .cd-outer{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;background:linear-gradient(135deg,#1a0808,#1a0d04);border:1px solid rgba(239,68,68,0.3);margin-bottom:10px;animation:cdGlow 1.4s ease-in-out infinite}
        .cd-lw{display:flex;flex-direction:column;gap:1px;flex-shrink:0}
        .cd-lt{color:#EF4444;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap}
        .cd-ls{color:#777;font-size:8px;white-space:nowrap}
        .cd-ps{display:flex;align-items:center;gap:3px;flex:1;justify-content:flex-end}
        .cd-u{display:flex;flex-direction:column;align-items:center;background:rgba(239,68,68,0.14);border:1px solid rgba(239,68,68,0.22);border-radius:5px;padding:2px 5px;min-width:28px}
        .cd-d{color:#fff;font-size:13px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
        .cd-l{color:#F97316;font-size:6px;font-weight:700;text-transform:uppercase;margin-top:1px;letter-spacing:.05em}
        .cd-c{color:#EF4444;font-size:12px;font-weight:900;padding-bottom:7px}
        @media(min-width:768px){.cd-outer{padding:10px 14px;gap:12px}.cd-lt{font-size:11px}.cd-ls{font-size:9px}.cd-u{min-width:44px;padding:5px 8px;border-radius:8px}.cd-d{font-size:22px}.cd-l{font-size:7px;margin-top:2px}.cd-c{font-size:18px}}
      `}</style>
      <div className="cd-outer">
        <div className="cd-lw">
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:14}}>⏳</span>
            <span className="cd-lt">{label}</span>
          </div>
          <span className="cd-ls">Grab it before offer expires!</span>
        </div>
        <div className="cd-ps">
          {parts.map(([lbl,val],i) => (
            <React.Fragment key={lbl}>
              {i>0 && <span className="cd-c">:</span>}
              <div className="cd-u">
                <span className="cd-d">{String(val).padStart(2,'0')}</span>
                <span className="cd-l">{lbl}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Launch countdown (purple) for coming soon products ────────
// v46: accepts onExpire — fires once when timer hits zero
export function LaunchCountdownFull({ endAt, label = 'Launching In', onExpire }) {
  const left = useCountdown(endAt, onExpire)
  if (!left) return null
  const { d, h, m, s } = left
  const parts = d > 0
    ? [['Days',d],['Hrs',h],['Min',m],['Sec',s]]
    : [['Hrs',h],['Min',m],['Sec',s]]
  return (
    <>
      <style>{`
        @keyframes lcGlow{0%,100%{box-shadow:0 0 8px rgba(139,92,246,0.2)}50%{box-shadow:0 0 16px rgba(139,92,246,0.5)}}
        .lc-outer{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;background:linear-gradient(135deg,#0d0a1a,#12091a);border:1px solid rgba(139,92,246,0.35);margin-bottom:10px;animation:lcGlow 1.4s ease-in-out infinite}
        .lc-lw{display:flex;flex-direction:column;gap:1px;flex-shrink:0}
        .lc-lt{color:#A78BFA;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap}
        .lc-ls{color:#777;font-size:8px;white-space:nowrap}
        .lc-ps{display:flex;align-items:center;gap:3px;flex:1;justify-content:flex-end}
        .lc-u{display:flex;flex-direction:column;align-items:center;background:rgba(139,92,246,0.14);border:1px solid rgba(139,92,246,0.22);border-radius:5px;padding:2px 5px;min-width:28px}
        .lc-d{color:#fff;font-size:13px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
        .lc-l{color:#A78BFA;font-size:6px;font-weight:700;text-transform:uppercase;margin-top:1px;letter-spacing:.05em}
        .lc-c{color:#A78BFA;font-size:12px;font-weight:900;padding-bottom:7px}
        @media(min-width:768px){.lc-outer{padding:10px 14px;gap:12px}.lc-lt{font-size:11px}.lc-ls{font-size:9px}.lc-u{min-width:44px;padding:5px 8px;border-radius:8px}.lc-d{font-size:22px}.lc-l{font-size:7px;margin-top:2px}.lc-c{font-size:18px}}
      `}</style>
      <div className="lc-outer">
        <div className="lc-lw">
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:14}}>🚀</span>
            <span className="lc-lt">{label}</span>
          </div>
          <span className="lc-ls">Be the first to get it!</span>
        </div>
        <div className="lc-ps">
          {parts.map(([lbl,val],i) => (
            <React.Fragment key={lbl}>
              {i>0 && <span className="lc-c">:</span>}
              <div className="lc-u">
                <span className="lc-d">{String(val).padStart(2,'0')}</span>
                <span className="lc-l">{lbl}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Launch countdown badge (compact, purple) for ProductCard ──
// v46: accepts onExpire
export function LaunchCountdownBadge({ endAt, onExpire }) {
  const left = useCountdown(endAt, onExpire)
  if (!left) return null
  const { d, h, m, s } = left
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:4,padding:'3px 7px',borderRadius:6,
      background:'linear-gradient(135deg,#8B5CF6,#A78BFA)',
      boxShadow:'0 2px 6px rgba(139,92,246,0.35)',width:'100%',justifyContent:'center',
    }}>
      <span style={{fontSize:9}}>🚀</span>
      <span style={{color:'#fff',fontWeight:700,fontSize:9}}>Launches</span>
      {d > 0 && <span style={{color:'#fff',fontWeight:800,fontSize:10}}>{d}d </span>}
      <span style={{color:'#fff',fontWeight:800,fontSize:10,fontVariantNumeric:'tabular-nums'}}>
        {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
      </span>
    </div>
  )
}

export default CountdownFull
