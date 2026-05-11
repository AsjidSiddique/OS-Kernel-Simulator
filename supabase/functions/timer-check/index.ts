// ══════════════════════════════════════════════════════════════
// Viro v46 — timer-check Edge Function
// Runs every minute via Supabase Scheduled Functions (cron: * * * * *)
//
// What it does:
//  1. Activates products whose coming_soon timer (launch_at) has expired
//     → status: coming_soon → active, is_active: true
//  2. Disables expired sale timers
//     → sale_active: false
//
// Setup:
//  1. Deploy: supabase functions deploy timer-check
//  2. In Supabase Dashboard → Edge Functions → timer-check → Schedules
//     Add schedule: * * * * * (every minute)
//  OR use the combined_timer_check() RPC if pg_cron is available (Pro plan)
// ══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_KEY')!,
    )

    // Call the combined timer check RPC (defined in viro-v45-patches.sql)
    const { error } = await supabase.rpc('combined_timer_check')

    if (error) {
      console.error('[timer-check] RPC error:', error.message)
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[timer-check] ✅ Timer check complete at', new Date().toISOString())
    return new Response(
      JSON.stringify({ ok: true, ts: new Date().toISOString() }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[timer-check] Unexpected error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
