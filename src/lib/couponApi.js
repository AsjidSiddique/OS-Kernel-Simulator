// ── couponApi.js ──────────────────────────────────────────────
// Client-side coupon validation + redemption (uses anon key).
// Redemption (increment used_count) happens server-side via RPC.
import { supabase } from './supabase'

export async function validateCoupon(code, subtotal) {
  if (!code?.trim()) return { valid: false, error: 'Enter a coupon code' }

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('enabled', true)
    .single()

  if (error || !data) return { valid: false, error: 'Invalid coupon code' }

  // Not started yet
  if (data.starts_at && new Date(data.starts_at) > new Date())
    return { valid: false, error: `Coupon valid from ${new Date(data.starts_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' })}` }

  // Expiry check
  if (data.expires_at && new Date(data.expires_at) < new Date())
    return { valid: false, error: 'This coupon has expired' }

  // Usage limit check
  if (data.max_uses !== null && data.used_count >= data.max_uses)
    return { valid: false, error: 'Coupon usage limit reached' }

  // Minimum order check
  if (data.min_order && subtotal < data.min_order)
    return { valid: false, error: `Minimum order Rs.${data.min_order.toLocaleString()} required` }

  // Compute discount
  const discount = data.type === 'percent'
    ? Math.round(subtotal * data.value / 100)
    : Math.min(data.value, subtotal)

  return { valid: true, coupon: data, discount }
}

export async function redeemCoupon(couponId) {
  // Atomically increment used_count via RPC
  await supabase.rpc('redeem_coupon', { p_coupon_id: couponId })
}
