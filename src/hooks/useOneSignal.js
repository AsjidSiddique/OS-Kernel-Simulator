import { useEffect } from 'react'

export default function useOneSignal() {
  useEffect(() => {
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID
    if (!appId) return

    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId,
          serviceWorkerParam: { scope: '/' },
          notifyButton:       { enable: false },
          allowLocalhostAsSecureOrigin: true,
          notificationIcon:   'https://www.viro.pk/icon-192.png',
        })

        console.log('OneSignal initialized ✅')

        // Ask for permission after 4s on EVERY page load until user accepts
        setTimeout(async () => {
          try {
            const permission = OneSignal.Notifications.permission

            // Already granted — nothing to do
            if (permission === true) return

            // 'denied' — browser blocks it, can't ask again (browser rule)
            // Check via native API
            if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return

            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

            if (isMobile) {
              // Mobile: native browser dialog — shows every time until granted
              await OneSignal.Notifications.requestPermission()
            } else {
              // Desktop: OneSignal slidedown — force:true means show every time
              // until user clicks Allow (after Allow it won't show again)
              await OneSignal.Slidedown.promptPush({ force: true })
            }
          } catch (e) {
            console.warn('OneSignal prompt:', e?.message)
          }
        }, 4000)

      } catch (err) {
        console.warn('OneSignal init:', err?.message)
      }
    })
  }, [])
}
