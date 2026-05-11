// Viro — WhatsApp opener
// Strategy:
//   Mobile → try whatsapp:// (opens app directly, no chooser)
//             if app not installed → fall back to wa.me (web)
//   Desktop → open web.whatsapp.com in new tab

const PHONE = '923277796566'

export function openWhatsApp(text = '', phone = PHONE) {
  const encoded = encodeURIComponent(text)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  if (isMobile) {
    // Try to open WhatsApp app directly via URI scheme
    // whatsapp:// opens the app without any chooser dialog
    // If WhatsApp isn't installed, it silently fails and we redirect to wa.me
    const appUrl = `whatsapp://send?phone=${phone}&text=${encoded}`
    const webUrl = `https://wa.me/${phone}?text=${encoded}`

    // Create hidden iframe to try whatsapp:// without navigating away
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;opacity:0;border:none'
    iframe.src = appUrl
    document.body.appendChild(iframe)

    // Wait 1.5s — if WhatsApp app opened, it takes focus and this timer is irrelevant
    // If not installed, fall back to wa.me web link
    const fallbackTimer = setTimeout(() => {
      try { document.body.removeChild(iframe) } catch {}  // Fix #15: guard against race
      window.open(webUrl, '_blank', 'noopener,noreferrer')
    }, 1500)

    // If page loses focus = app opened successfully, cancel fallback
    window.addEventListener('blur', function onBlur() {
      clearTimeout(fallbackTimer)
      setTimeout(() => {
        try { document.body.removeChild(iframe) } catch {}  // Fix #15: guard against already-removed
      }, 2000)
      window.removeEventListener('blur', onBlur)
    }, { once: true })

  } else {
    // Desktop — open WhatsApp Web in new tab
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`, '_blank', 'noopener,noreferrer')
  }
}

// Build wa.me href for <a> tags (used where JS click isn't available)
// Use whatsapp:// for mobile, wa.me for desktop
export function waHref(text = '', phone = PHONE) {
  const encoded = encodeURIComponent(text)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  return isMobile
    ? `whatsapp://send?phone=${phone}&text=${encoded}`
    : `https://wa.me/${phone}?text=${encoded}`
}
