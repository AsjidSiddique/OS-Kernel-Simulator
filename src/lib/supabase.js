import { createClient } from '@supabase/supabase-js'

// v46: Service key REMOVED from frontend entirely.
// All privileged admin writes now go through the admin-action Edge Function.
// See: src/lib/adminApi.js
const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// supabaseAdmin is now just an alias for supabase (anon key only).
// Any operation that needed the service key now goes through adminApi().
export const supabaseAdmin = supabase
