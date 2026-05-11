// ── adminApi.js ───────────────────────────────────────────────
// Sends authenticated requests to the admin-action Edge Function.
// The admin token (stored in localStorage after login) is included
// in every request — the Edge Function validates it server-side.
//
// Usage:
//   import { adminApi } from './adminApi'
//   const { ok, warnings } = await adminApi('order_status', { order_id, new_status })
// ─────────────────────────────────────────────────────────────

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-action`

export async function adminApi(action, payload = {}) {
  const token = localStorage.getItem('viro_admin_token')
  if (!token) throw new Error('Not authenticated — please log in again')

  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  })

  const data = await res.json()

  if (res.status === 401) {
    // Session expired — clear local storage and force re-login
    localStorage.removeItem('viro_admin_token')
    window.location.reload()
    throw new Error(data.error || 'Session expired')
  }

  if (!res.ok) throw new Error(data.error || `Admin action failed (${res.status})`)

  return data
}
