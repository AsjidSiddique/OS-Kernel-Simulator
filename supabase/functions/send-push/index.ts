// Viro — send-push Edge Function
// Sends branded push notifications via OneSignal REST API

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }

  const APP_ID   = Deno.env.get("ONESIGNAL_APP_ID")
  const REST_KEY = Deno.env.get("ONESIGNAL_REST_KEY")

  if (!APP_ID || !REST_KEY) {
    return new Response(
      JSON.stringify({ error: "Set ONESIGNAL_APP_ID and ONESIGNAL_REST_KEY in Supabase secrets" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  let payload
  try { payload = JSON.parse(await req.text()) }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders }) }

  const { title, body, url } = payload

  const notification = {
    app_id:             APP_ID,
    included_segments:  ["All"],
    headings:           { en: title || "Viro" },
    contents:           { en: body  || "" },
    url:                url || "https://www.viro.pk",

    // ── Viro branding in every notification ──────────────
    // Chrome/Android shows this icon in the notification
    chrome_web_icon:    "https://www.viro.pk/icon-192.png",
    // Firefox icon
    firefox_icon:       "https://www.viro.pk/icon-192.png",
    // Large image shown below notification text (optional but premium look)
    chrome_web_image:   "https://www.viro.pk/icon-512.png",
    // Badge icon (tiny monochrome icon in status bar on Android)
    chrome_web_badge:   "https://www.viro.pk/favicon-32.png",

    web_push_topic: "viro-promo",
  }

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${REST_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(notification),
    })
    const data = await res.json()
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
