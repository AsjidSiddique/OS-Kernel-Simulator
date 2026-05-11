import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ThemeContext = createContext({ theme: 'dark', setTheme: () => {} })
export const useTheme = () => useContext(ThemeContext)

export const DARK = {
  '--viro-bg':        '#0F172A',
  '--viro-bgDeep':    '#080E1C',
  '--viro-bgCard':    '#1E293B',
  '--viro-bgInput':   '#1E293B',
  '--viro-border':    '#334155',
  '--viro-text':      '#F1F5F9',
  '--viro-textMuted': '#94A3B8',
  '--viro-textSub':   '#64748B',
  '--viro-navBg':     '#080E1C',
  '--viro-navBorder': '#1E293B',
  '--viro-featureBg': '#1E293B',
  '--viro-featureBorder': '#334155',
  '--viro-sectionBg': '#0F172A',
  '--viro-searchBg':  '#0F172A',
  '--viro-productWhite': '#1E293B',
}
export const LIGHT = {
  '--viro-bg':        '#F0F4F8',
  '--viro-bgDeep':    '#E2E8F0',
  '--viro-bgCard':    '#FFFFFF',
  '--viro-bgInput':   '#FFFFFF',
  '--viro-border':    '#CBD5E1',
  '--viro-text':      '#0F172A',
  '--viro-textMuted': '#334155',
  '--viro-textSub':   '#64748B',
  '--viro-navBg':     '#FFFFFF',
  '--viro-navBorder': '#E2E8F0',
  '--viro-featureBg': '#FFFFFF',
  '--viro-featureBorder': '#CBD5E1',
  '--viro-sectionBg': '#F0F4F8',
  '--viro-searchBg':  '#F0F4F8',
  '--viro-productWhite': '#FFFFFF',
}

export function applyTheme(mode) {
  const vars = mode === 'light' ? LIGHT : DARK
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.setAttribute('data-theme', mode)
  document.body.style.backgroundColor = vars['--viro-bg']
  document.body.style.color = vars['--viro-text']
}

export function ThemeProvider({ children }) {
  // Fix #19: Read theme from localStorage synchronously to prevent dark→light flash
  const [theme, setThemeState] = useState(() => {
    const cached = localStorage.getItem('viro_theme') || 'dark'
    applyTheme(cached)
    return cached
  })

  useEffect(() => {
    // Then sync from DB in background to pick up admin changes
    supabase.from('site_settings').select('value').eq('key', 'theme').single()
      .then(({ data }) => {
        const mode = data?.value?.mode || 'dark'
        if (mode !== localStorage.getItem('viro_theme')) {
          setThemeState(mode)
          applyTheme(mode)
          localStorage.setItem('viro_theme', mode)
        }
      })
      .catch(() => {})
  }, [])

  function setTheme(mode) {
    setThemeState(mode)
    applyTheme(mode)
    localStorage.setItem('viro_theme', mode)
    supabase.from('site_settings')
      .upsert({ key: 'theme', value: { mode }, updated_at: new Date().toISOString() })
      .then(() => {}).catch(() => {})
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
