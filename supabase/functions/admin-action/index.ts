// ══════════════════════════════════════════════════════════════
// Viro — admin-action Edge Function  (v46)
// ALL privileged admin writes flow through here.
// Secret key stored as Deno.env SERVICE_KEY — never in browser.
// ══════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function svcHeaders(key: string) {
  return {
    "apikey": key, "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json", "Prefer": "return=representation",
  }
}

async function dbGet(path: string, key: string, base: string) {
  const r = await fetch(`${base}/rest/v1/${path}`, { headers: svcHeaders(key) })
  return r.json()
}
async function dbPatch(table: string, match: Record<string,string>, patch: Record<string,unknown>, key: string, base: string) {
  const qs = Object.entries(match).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&")
  const r = await fetch(`${base}/rest/v1/${table}?${qs}`, { method:"PATCH", headers:svcHeaders(key), body:JSON.stringify(patch) })
  return r.ok ? { ok:true } : { ok:false, error: await r.text() }
}
async function dbInsert(table: string, data: Record<string,unknown>, key: string, base: string) {
  const r = await fetch(`${base}/rest/v1/${table}`, { method:"POST", headers:svcHeaders(key), body:JSON.stringify(data) })
  const body = await r.json()
  return r.ok ? { ok:true, data: body } : { ok:false, error: JSON.stringify(body) }
}
async function dbDelete(table: string, match: Record<string,string>, key: string, base: string) {
  const qs = Object.entries(match).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&")
  const r = await fetch(`${base}/rest/v1/${table}?${qs}`, { method:"DELETE", headers:svcHeaders(key) })
  return r.ok ? { ok:true } : { ok:false, error: await r.text() }
}
async function dbRpc(fn: string, args: Record<string,unknown>, key: string, base: string) {
  const r = await fetch(`${base}/rest/v1/rpc/${fn}`, { method:"POST", headers:svcHeaders(key), body:JSON.stringify(args) })
  return r.ok ? { ok:true } : { ok:false, error: await r.text() }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const BASE = Deno.env.get("SUPABASE_URL") ?? ""
  const KEY  = Deno.env.get("SERVICE_KEY") ?? ""
  if (!KEY) return json({ error: "Service key not configured" }, 500)

  // ── Auth ─────────────────────────────────────────────────────
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim()
  if (!token) return json({ error: "No token" }, 401)

  const sessions = await dbGet(`admin_sessions?token=eq.${encodeURIComponent(token)}&select=token,expires_at&limit=1`, KEY, BASE)
  if (!Array.isArray(sessions) || !sessions.length) return json({ error: "Unauthorized" }, 401)
  if (sessions[0].expires_at && new Date(sessions[0].expires_at) < new Date()) {
    await dbDelete("admin_sessions", { token }, KEY, BASE)
    return json({ error: "Session expired" }, 401)
  }

  let body: Record<string,unknown>
  try { body = await req.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const action = body.action as string

  // ══════════════════════════════════════════════════════════════
  // order_status — full stock flow
  // ══════════════════════════════════════════════════════════════
  if (action === "order_status") {
    const orderId   = body.order_id as string
    const newStatus = body.new_status as string
    const orderRows = await dbGet(`orders?id=eq.${orderId}&select=status&limit=1`, KEY, BASE)
    const oldStatus = orderRows?.[0]?.status
    if (!oldStatus) return json({ error: "Order not found" }, 404)
    if (oldStatus === newStatus) return json({ ok:true, message:"no-op" })

    await dbPatch("orders", { id:orderId }, { status:newStatus }, KEY, BASE)
    const items: Array<{product_id:string; quantity:number}> =
      await dbGet(`order_items?order_id=eq.${orderId}&select=product_id,quantity`, KEY, BASE) ?? []

    const DEDUCTED = ["CONFIRMED","PROCESSING","SHIPPED","DELIVERED"]
    const RESERVED = ["QUEUE"]
    const warnings: string[] = []

    if (newStatus === "QUEUE" && ![...RESERVED, ...DEDUCTED].includes(oldStatus)) {
      for (const item of items) {
        const prods = await dbGet(`products?id=eq.${item.product_id}&select=stock,stock_queue,name`, KEY, BASE)
        const p = prods?.[0]; if (!p) continue
        const free = (p.stock??0) - (p.stock_queue??0)
        if (item.quantity > free) warnings.push(`Low stock: "${p.name}" has ${free} free, needs ${item.quantity}`)
        await dbPatch("products", { id:item.product_id }, { stock_queue:(p.stock_queue??0)+item.quantity }, KEY, BASE)
      }
    }
    if (newStatus === "CONFIRMED" && !DEDUCTED.includes(oldStatus)) {
      for (const item of items) {
        if (RESERVED.includes(oldStatus)) {
          const prods = await dbGet(`products?id=eq.${item.product_id}&select=stock_queue`, KEY, BASE)
          const p = prods?.[0]
          if (p) await dbPatch("products", { id:item.product_id }, { stock_queue:Math.max(0,(p.stock_queue??0)-item.quantity) }, KEY, BASE)
        }
        const prods2 = await dbGet(`products?id=eq.${item.product_id}&select=stock,stock_complete,name`, KEY, BASE)
        const p2 = prods2?.[0]
        if (p2 && item.quantity > p2.stock) warnings.push(`Low stock: "${p2.name}" has ${p2.stock} left`)
        await dbRpc("decrement_stock", { p_product_id:item.product_id, p_qty:item.quantity }, KEY, BASE)
        await dbPatch("products", { id:item.product_id }, { stock_complete:(p2?.stock_complete??0)+item.quantity }, KEY, BASE)
      }
    }
    if (newStatus === "CANCELLED") {
      if (DEDUCTED.includes(oldStatus)) {
        for (const item of items) {
          await dbRpc("restore_stock", { p_product_id:item.product_id, p_qty:item.quantity }, KEY, BASE)
          const prods = await dbGet(`products?id=eq.${item.product_id}&select=stock_complete`, KEY, BASE)
          const p = prods?.[0]
          await dbPatch("products", { id:item.product_id }, { stock_complete:Math.max(0,(p?.stock_complete??0)-item.quantity) }, KEY, BASE)
        }
      } else if (RESERVED.includes(oldStatus)) {
        for (const item of items) {
          const prods = await dbGet(`products?id=eq.${item.product_id}&select=stock_queue`, KEY, BASE)
          const p = prods?.[0]
          if (p) await dbPatch("products", { id:item.product_id }, { stock_queue:Math.max(0,(p.stock_queue??0)-item.quantity) }, KEY, BASE)
        }
      }
    }
    return json({ ok:true, warnings })
  }

  // ══════════════════════════════════════════════════════════════
  // product_update / product_delete / category_delete
  // ══════════════════════════════════════════════════════════════
  if (action === "product_update") {
    const patch = body.patch as Record<string,unknown>
    const id = body.id as string|undefined
    const ids = body.ids as string[]|undefined
    if (id) return json(await dbPatch("products", { id }, patch, KEY, BASE))
    if (ids?.length) {
      const qs = `id=in.(${ids.map(i => encodeURIComponent(i)).join(",")})`
      const r = await fetch(`${BASE}/rest/v1/products?${qs}`, { method:"PATCH", headers:svcHeaders(KEY), body:JSON.stringify(patch) })
      return json(r.ok ? { ok:true } : { ok:false, error:await r.text() })
    }
    return json({ error:"id or ids required" }, 400)
  }
  if (action === "product_delete") return json(await dbDelete("products", { id:body.id as string }, KEY, BASE))
  if (action === "category_delete") return json(await dbDelete("categories", { id:body.id as string }, KEY, BASE))

  // ══════════════════════════════════════════════════════════════
  // coupon_create
  // { action, code, type, value, min_order, max_uses, expires_at, enabled }
  // ══════════════════════════════════════════════════════════════
  if (action === "coupon_create") {
    const r = await dbInsert("coupons", {
      code:       (body.code as string).toUpperCase().trim(),
      type:       body.type,        // 'percent' | 'fixed'
      value:      body.value,       // e.g. 15 (%) or 200 (Rs.)
      min_order:  body.min_order ?? 0,
      max_uses:   body.max_uses ?? null,
      starts_at:  body.starts_at  ?? null,
      expires_at: body.expires_at ?? null,
      enabled:    body.enabled ?? true,
      used_count: 0,
    }, KEY, BASE)
    return json(r)
  }

  // coupon_update — toggle enabled, change value, extend expiry etc.
  if (action === "coupon_update") {
    return json(await dbPatch("coupons", { id:body.id as string }, body.patch as Record<string,unknown>, KEY, BASE))
  }

  // coupon_delete
  if (action === "coupon_delete") {
    return json(await dbDelete("coupons", { id:body.id as string }, KEY, BASE))
  }

  return json({ error:`Unknown action: ${action}` }, 400)
})
