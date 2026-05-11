// Email via Supabase Edge Function proxy
// This avoids the CORS error from calling api.resend.com directly from the browser.
// The Edge Function (supabase/functions/send-email/index.ts) calls Resend server-side.

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function sendOrderEmail({ name, email, orderId, items, subtotal, deliveryCharge, finalTotal, city }) {
  if (!email || !SUPABASE_URL) return

  const itemsHtml = items.map(i =>
    `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #1E293B;color:#CBD5E1">${i.name}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #1E293B;color:#94A3B8;text-align:center">×${i.quantity}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #1E293B;color:#A78BFA;text-align:right;font-weight:700">Rs.${(i.price * i.quantity).toLocaleString()}</td>
    </tr>`
  ).join('')

  const deliveryRow = deliveryCharge === 0
    ? `<span style="color:#10B981;font-weight:700">FREE 🎉</span>`
    : `<span style="color:#F97316">Rs.${deliveryCharge}</span>`

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#0F172A;font-family:'Segoe UI',Arial,sans-serif">
    <div style="max-width:520px;margin:30px auto;border-radius:20px;overflow:hidden;border:1px solid #1E293B">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316);padding:28px 24px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px">VIRO</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px">Smart Shopping, Better Living</p>
      </div>
      <!-- Body -->
      <div style="background:#0F172A;padding:24px">
        <p style="color:#94A3B8;font-size:14px;margin:0 0 6px">Hi <strong style="color:#E2E8F0">${name}</strong>,</p>
        <p style="color:#94A3B8;font-size:14px;margin:0 0 20px">We've received your order. We'll confirm via phone or WhatsApp shortly.</p>

        <!-- Order info -->
        <div style="background:#1E293B;border-radius:12px;padding:14px 16px;margin-bottom:16px">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="color:#64748B;font-size:12px;padding:3px 0">Order ID</td>
              <td style="color:#A78BFA;font-size:12px;font-weight:700;text-align:right">#${orderId?.slice?.(0,8)?.toUpperCase?.() ?? orderId}</td>
            </tr>
            <tr>
              <td style="color:#64748B;font-size:12px;padding:3px 0">City</td>
              <td style="color:#E2E8F0;font-size:12px;text-align:right">${city}</td>
            </tr>
            <tr>
              <td style="color:#64748B;font-size:12px;padding:3px 0">Payment</td>
              <td style="color:#10B981;font-size:12px;font-weight:700;text-align:right">Cash on Delivery</td>
            </tr>
          </table>
        </div>

        <!-- Items -->
        <div style="background:#1E293B;border-radius:12px;overflow:hidden;margin-bottom:16px">
          <p style="margin:0;padding:10px 16px;color:#94A3B8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #334155">Order Items</p>
          <table style="width:100%;border-collapse:collapse">
            ${itemsHtml}
          </table>
        </div>

        <!-- Totals -->
        <div style="background:#1E293B;border-radius:12px;padding:14px 16px;margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="color:#64748B;font-size:13px;padding:4px 0">Subtotal</td>
              <td style="color:#E2E8F0;font-size:13px;text-align:right">Rs.${subtotal?.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color:#64748B;font-size:13px;padding:4px 0">Delivery</td>
              <td style="font-size:13px;text-align:right">${deliveryRow}</td>
            </tr>
            <tr>
              <td style="color:#fff;font-size:15px;font-weight:800;padding:8px 0 4px;border-top:1px solid #334155">Total</td>
              <td style="color:#A78BFA;font-size:15px;font-weight:800;text-align:right;border-top:1px solid #334155">Rs.${finalTotal?.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <!-- Contact -->
        <div style="border-radius:12px;padding:14px 16px;background:linear-gradient(135deg,#00BFFF10,#8B5CF618);border:1px solid #8B5CF630;text-align:center">
          <p style="margin:0 0 8px;color:#94A3B8;font-size:12px">Questions? Reach us anytime</p>
          <p style="margin:0;font-size:13px">
            <a href="https://wa.me/923277796566" style="color:#10B981;text-decoration:none;font-weight:700">💬 WhatsApp: 0327 7796566</a>
            &nbsp;&nbsp;
            <a href="mailto:support@viro.pk" style="color:#00BFFF;text-decoration:none;font-weight:700">✉️ support@viro.pk</a>
          </p>
        </div>
      </div>
      <!-- Footer -->
      <div style="background:#080E1C;padding:14px;text-align:center">
        <p style="margin:0;color:#334155;font-size:11px">© 2026 Viro · viro.pk · Burewala, Pakistan</p>
      </div>
    </div>
  </body>
  </html>`

  const payload = {
    from: 'Viro <support@viro.pk>',
    to: [email],
    subject: `✅ Order Received — Viro #${orderId?.slice?.(0,8)?.toUpperCase?.() ?? orderId}`,
    html,
  }

  // Fix #18: 8-second timeout so order placement never hangs on email
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    // Call our Edge Function (no CORS issue — same Supabase origin)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'apikey': SUPABASE_ANON,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const data = await res.json()
    if (!res.ok) console.error('Email error:', data)
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('Email send timed out after 8s — order was placed successfully')
    } else {
      console.error('Email send failed:', e)
    }
  } finally {
    clearTimeout(timeout)
  }
}
