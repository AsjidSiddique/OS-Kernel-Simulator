import React from 'react'
import { useSite } from '../context/SiteSettingsContext'

const LOGO_URL = 'https://rwinhwekqthzsuzobxiw.supabase.co/storage/v1/object/sign/logo/logo.jpeg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV80NGFhNjVhOS00ZGYyLTRiMjctYTNkOS05MzdlNDI1MGE0OWYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb2dvL2xvZ28uanBlZyIsImlhdCI6MTc3NzcyOTM0MCwiZXhwIjozNjY5ODg5MzQwfQ.7fs4-gFvC1sEyf3O6NFj5sFNjuaqgas8SvHhvt7OAkk'

const SOCIAL = [
  { name:'Instagram', href:'https://instagram.com/viro.pk',           handle:'@viro.pk',            color:'#E1306C', gradient:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
    icon:<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
  { name:'Facebook',  href:'https://facebook.com/viro.pk',            handle:'@viro.pk',            color:'#1877F2', gradient:'linear-gradient(135deg,#1877F2,#0a5dc7)',
    icon:<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  { name:'LinkedIn',  href:'https://linkedin.com/company/viro-pk',    handle:'/company/viro-pk',    color:'#0A66C2', gradient:'linear-gradient(135deg,#0A66C2,#004182)',
    icon:<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  { name:'WhatsApp',  href:'https://wa.me/923277796566',               handle:'03277796566',          color:'#25D366', gradient:'linear-gradient(135deg,#25D366,#128C7E)',
    icon:<svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> },
]

export default function Footer() {
  const { contact, deliveryRules } = useSite()
  return (
    <footer className="mt-12 pb-24 md:pb-0 border-t"
      style={{ borderColor:'var(--viro-border)', background:'var(--viro-bgDeep)', transition:'background 0.35s,border-color 0.35s' }}>
      <div className="max-w-6xl mx-auto px-5 pt-10">

        {/* Main grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <img src={LOGO_URL} alt="Viro" className="w-12 h-12 rounded-xl object-cover"
                onError={e => { e.target.src='/logo.jpg' }} />
              <div>
                <p className="font-extrabold text-base" style={{color:'var(--viro-text)'}}>Viro</p>
                <p className="text-xs" style={{color:'var(--viro-textSub)'}}>viro.pk</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{color:'var(--viro-textMuted)'}}>
              Smart Shopping, Better Living.
            </p>
            <p className="text-xs mt-1" style={{color:'var(--viro-textSub)'}}>
              Your trusted online store in Punjab, Pakistan.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold mb-4" style={{color:'var(--viro-text)'}}>Quick Links</h4>
            <ul className="space-y-2.5">
              {[['🏠','Home','/'],['🛍️','Shop','/shop'],['🛒','Cart','/cart'],['📋','Orders','/orders']].map(([icon,label,path]) => (
                <li key={path}>
                  <a href={path} className="text-sm flex items-center gap-2 hover:text-purple-400 transition-colors"
                    style={{color:'var(--viro-textMuted)'}}>
                    <span>{icon}</span>{label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-bold mb-4" style={{color:'var(--viro-text)'}}>Contact Us</h4>
            <ul className="space-y-2.5">
              <li>
                <a href={`tel:${contact.phone}`} className="text-sm flex items-center gap-2 hover:text-blue-400 transition-colors"
                  style={{color:'var(--viro-textMuted)'}}>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'#00BFFF15',border:'1px solid #00BFFF30'}}>📞</span>
                  {contact.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${contact.email}`} className="text-sm flex items-center gap-2 hover:text-purple-400 transition-colors"
                  style={{color:'var(--viro-textMuted)'}}>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'#8B5CF615',border:'1px solid #8B5CF630'}}>✉️</span>
                  {contact.email}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)'}}>📍</span>
                <span className="text-sm" style={{color:'var(--viro-textSub)'}}>{contact.address}</span>
              </li>
              <li>
                <a href="https://viro.pk" target="_blank" rel="noopener" className="text-sm flex items-center gap-2 hover:text-orange-400 transition-colors"
                  style={{color:'var(--viro-textMuted)'}}>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'#F9731615',border:'1px solid #F9731630'}}>🌐</span>
                  viro.pk
                </a>
              </li>
            </ul>
          </div>

          {/* Delivery */}
          <div>
            <h4 className="text-sm font-bold mb-4" style={{color:'var(--viro-text)'}}>Delivery Cities</h4>
            <div className="space-y-2">
              {(deliveryRules || [{label:'Burewala',freeThreshold:550,charge:150},{label:'Other Cities',freeThreshold:2500,charge:150}]).map((r,i) => {
                const color = i === 0 ? '#00BFFF' : '#8B5CF6'
                return (
                  <div key={r.label} className="flex items-center gap-2 p-2 rounded-lg"
                    style={{background:color+'10',border:`1px solid ${color}30`}}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:color}}/>
                    <span className="text-xs font-semibold" style={{color:'var(--viro-text)'}}>{r.label}</span>
                    <span className="text-xs ml-auto font-bold" style={{color}}>Free ≥ Rs.{r.freeThreshold}</span>
                  </div>
                )
              })}
              <p className="text-xs" style={{color:'var(--viro-textSub)'}}>
                Otherwise Rs.{(deliveryRules?.[0]?.charge ?? 150)} charge
              </p>
            </div>
          </div>
        </div>

        {/* Social row */}
        <div className="border-t border-b py-6 mb-6" style={{borderColor:'var(--viro-border)'}}>
          <p className="text-xs font-bold uppercase tracking-widest text-center mb-4" style={{color:'var(--viro-textSub)'}}>
            Follow Us For Updates
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {SOCIAL.map(s => (
              <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl transition-all hover:scale-105 active:scale-95"
                style={{background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)'}}>
                <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{background:s.gradient}}>
                  {s.icon}
                </span>
                <div>
                  <p className="text-xs font-bold leading-tight" style={{color:'var(--viro-text)'}}>{s.name}</p>
                  <p className="text-xs leading-tight" style={{color:s.color}}>{s.handle}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="text-center pb-8">
          <p className="font-display font-bold tracking-widest text-sm gradient-text mb-1">
            VIRO — VALUE | VARIETY | VISION
          </p>
          <p className="text-xs" style={{color:'var(--viro-textSub)'}}>
            {`© ${new Date().getFullYear()} Viro. All rights reserved. · viro.pk · ${contact?.address || 'Mandi Burewala, Punjab, Pakistan'}`}
          </p>
        </div>
      </div>
    </footer>
  )
}
