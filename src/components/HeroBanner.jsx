import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const HERO_BUCKET   = 'hero_section'
const STRIP_BUCKET  = 'header_ads_imgs'

const DEFAULT_CONFIG = {
  enabled: true,
  title: 'Smart Shopping, Better Living.',
  subtitle: 'Quality products delivered fast in Burewala & across Pakistan.',
  cta_text: 'Shop Now',
  overlay_opacity: 0.55,
  slide_speed: 3000,
  hero_height: 'md',
  strip_speed: 22,
  paused_images: [],
}
const HEIGHT_MAP = {
  sm: 'clamp(180px,38vw,340px)',
  md: 'clamp(240px,52vw,480px)',
  lg: 'clamp(300px,64vw,600px)',
  xl: 'clamp(360px,78vw,720px)',
}

function getBucketImages(bucket, data) {
  return (data || [])
    .filter(f => f.name && /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name))
    .map(f => {
      const { data: pd } = supabase.storage.from(bucket).getPublicUrl(f.name)
      return { url: pd.publicUrl, name: f.name }
    })
}

export default function HeroBanner() {
  const [slides,    setSlides]   = useState([])
  const [active,    setActive]   = useState(0)
  const [loaded,    setLoaded]   = useState(false)
  const [config,    setConfig]   = useState(DEFAULT_CONFIG)
  const [stripImgs, setStrip]    = useState([])
  const timerRef = useRef(null)

  useEffect(() => {
    async function load() {
      let cfg = { ...DEFAULT_CONFIG }
      try {
        const { data } = await supabase.from('site_settings').select('value').eq('key','hero').single()
        if (data?.value) cfg = { ...cfg, ...data.value }
      } catch {}
      setConfig(cfg)

      // Hero section bucket images
      try {
        const { data } = await supabase.storage.from(HERO_BUCKET).list('', { limit: 50 })
        const imgs = getBucketImages(HERO_BUCKET, data)
        const paused = cfg.paused_images || []
        const active_slides = imgs.filter(i => !paused.includes(i.name))
        setSlides(active_slides.length ? active_slides : (imgs.length ? imgs : []))
      } catch {}

      // Strip images from header_ads_imgs
      try {
        const { data } = await supabase.storage.from(STRIP_BUCKET).list('', { limit: 50 })
        setStrip(getBucketImages(STRIP_BUCKET, data))
      } catch {}

      setLoaded(true)
    }
    load()
  }, [])

  useEffect(() => {
    if (!slides.length) return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setActive(a => (a + 1) % slides.length), config.slide_speed || 3000)
    return () => clearInterval(timerRef.current)
  }, [slides, config.slide_speed])

  function goTo(idx) {
    setActive(idx)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setActive(a => (a + 1) % slides.length), config.slide_speed || 3000)
  }

  if (loaded && !config.enabled) return null

  const opa = config.overlay_opacity ?? 0.55
  const h   = HEIGHT_MAP[config.hero_height] || HEIGHT_MAP.md

  return (
    <>
      <style>{`
        .hero-img { animation: kenBurns 9s ease-in-out infinite; object-fit:cover; object-position:center; width:100%; height:100%; }
        .hero-fade { animation: fadeIn 0.5s ease; }
        .headline-anim { animation: headlineSlide 0.5s cubic-bezier(.4,0,.2,1) both; }
        .sub-anim  { animation: headlineSlide 0.5s 0.08s cubic-bezier(.4,0,.2,1) both; }
        .cta-anim  { animation: headlineSlide 0.5s 0.18s cubic-bezier(.4,0,.2,1) both; }
        .strip-track { display:flex; animation: loopScroll ${config.strip_speed || 22}s linear infinite; will-change:transform; }
        .strip-track:hover { animation-play-state:paused; }
        .strip-img { transition: transform 0.25s, opacity 0.25s; }
        .strip-img:hover { transform: scale(1.07); opacity: 0.85; }
      `}</style>

      {/* ── Main Hero ── */}
      <div className="relative w-full overflow-hidden select-none"
        style={{ height: h, background: '#080E1C', borderRadius: '0 0 20px 20px' }}>

        {loaded && slides.length > 0 ? (
          <img key={slides[active]?.url}
            src={slides[active]?.url}
            alt="Viro banner"
            className="hero-img hero-fade absolute inset-0"
            onError={e => { e.target.src = '/logo.jpg' }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#0F172A,#1E293B)' }}>
            <img src="https://rwinhwekqthzsuzobxiw.supabase.co/storage/v1/object/sign/logo/logo.jpeg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV80NGFhNjVhOS00ZGYyLTRiMjctYTNkOS05MzdlNDI1MGE0OWYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb2dvL2xvZ28uanBlZyIsImlhdCI6MTc3NzcyOTM0MCwiZXhwIjozNjY5ODg5MzQwfQ.7fs4-gFvC1sEyf3O6NFj5sFNjuaqgas8SvHhvt7OAkk"
              alt="Viro" className="w-24 h-24 rounded-2xl object-cover opacity-60"
              onError={e => { e.target.src = '/logo.jpg' }} />
          </div>
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(90deg,rgba(8,14,28,${opa}) 0%,rgba(8,14,28,${opa*0.35}) 55%,transparent 100%)` }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(0deg,rgba(8,14,28,${opa*0.9}) 0%,transparent 50%)` }} />

        {/* Text */}
        <div className="absolute inset-0 flex flex-col justify-center px-4 md:px-10 pb-8">
          <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 w-fit"
            style={{ background:'#00BFFF20', color:'#00BFFF', border:'1px solid #00BFFF45' }}>
            🛍️ viro.pk
          </span>
          <h2 className="headline-anim font-extrabold text-white leading-tight drop-shadow-lg"
            style={{ fontSize:'clamp(20px,5vw,42px)', textShadow:'0 2px 16px rgba(0,0,0,0.6)', marginBottom:'8px' }}>
            {config.title}
          </h2>
          <p className="sub-anim leading-relaxed mb-5"
            style={{ color:'rgba(255,255,255,0.72)', fontSize:'clamp(12px,2.4vw,15px)', maxWidth:'300px',
              textShadow:'0 1px 6px rgba(0,0,0,0.5)' }}>
            {config.subtitle}
          </p>
          <Link to="/shop"
            className="cta-anim inline-flex items-center gap-2 font-bold text-white w-fit rounded-xl active:scale-95"
            style={{ background:'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
              boxShadow:'0 4px 22px #8B5CF660',
              padding:'clamp(8px,1.8vw,12px) clamp(16px,3.5vw,24px)',
              fontSize:'clamp(13px,2.3vw,15px)', transition:'opacity 0.2s' }}>
            {config.cta_text} →
          </Link>
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
            {slides.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className="rounded-full transition-all duration-300"
                style={{ width: i===active?'24px':'7px', height:'7px',
                  background: i===active ? 'linear-gradient(90deg,#00BFFF,#8B5CF6)' : 'rgba(255,255,255,0.3)' }} />
            ))}
          </div>
        )}

        {/* Arrows */}
        {slides.length > 1 && (
          <>
            <button onClick={() => goTo((active-1+slides.length)%slides.length)}
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full items-center justify-center text-white text-lg"
              style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(6px)' }}>‹</button>
            <button onClick={() => goTo((active+1)%slides.length)}
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full items-center justify-center text-white text-lg"
              style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(6px)' }}>›</button>
          </>
        )}
      </div>

      {/* ── Animated strip from header_ads_imgs ── */}
      {stripImgs.length > 0 && (
        <div className="relative overflow-hidden mx-3 mt-3 rounded-2xl"
          style={{ height:'clamp(70px,18vw,130px)', background:'var(--viro-bgDeep)', border:'1px solid var(--viro-border)' }}>
          <div className="strip-track h-full items-center px-2" style={{ width:'max-content', display:'flex', gap:'10px' }}>
            {[...stripImgs,...stripImgs].map((s,i) => (
              <div key={i} onClick={() => {}} className="flex-shrink-0 rounded-xl overflow-hidden cursor-pointer strip-img"
                style={{ width:'clamp(60px,16vw,120px)', height:'clamp(56px,14vw,108px)',
                  border:'1px solid var(--viro-border)' }}>
                <img src={s.url} alt="" className="w-full h-full object-cover"
                  onError={e => { e.target.src='/logo.jpg' }} />
              </div>
            ))}
          </div>
          <div className="absolute inset-y-0 left-0 w-12 pointer-events-none"
            style={{ background:'linear-gradient(90deg,var(--viro-bgDeep),transparent)' }} />
          <div className="absolute inset-y-0 right-0 w-12 pointer-events-none"
            style={{ background:'linear-gradient(-90deg,var(--viro-bgDeep),transparent)' }} />
        </div>
      )}
    </>
  )
}
