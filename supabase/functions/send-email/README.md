# Viro — send-email Edge Function

Proxies Resend API calls server-side to fix browser CORS errors.

## ⚡ Deploy (one time, takes 2 minutes)

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link your project (get ref from Supabase dashboard URL)
supabase link --project-ref rwinhwekqthzsuzobxiw

# 4. Set your Resend API key as a secret
supabase secrets set RESEND_API_KEY=re_your_key_here

# 5. Deploy — IMPORTANT: use --no-verify-jwt flag
supabase functions deploy send-email --no-verify-jwt
```

## ✅ Verify it works
After deploy, test in browser console:
```js
fetch('https://rwinhwekqthzsuzobxiw.supabase.co/functions/v1/send-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'apikey': 'YOUR_ANON_KEY' },
  body: JSON.stringify({ from:'Viro <support@viro.pk>', to:['you@email.com'], subject:'Test', html:'<p>Works!</p>' })
}).then(r => r.json()).then(console.log)
```

## Why --no-verify-jwt?
Without this flag, Supabase requires a user JWT token.
Since customers are anonymous (not logged in), they can't get one.
`--no-verify-jwt` lets the anon key be used instead — which is safe here
because the function only sends emails (no sensitive data exposed).
