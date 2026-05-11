-- ============================================================
-- Viro v46 — Single Complete PostgreSQL Setup (FINAL)
-- Includes: base schema + v43-v46 patches + coupons + site_settings
-- Run this ONCE in Supabase SQL Editor — safe to re-run (idempotent)
-- ============================================================
-- SECTIONS:
--  1. Extensions
--  2. Schema columns (all ADD COLUMN IF NOT EXISTS)
--  3. Admin password
--  4. Unique phone constraint
--  5. Stock functions (decrement/restore)
--  6. Timer functions (combined_timer_check)
--  7. Stock reservation functions
--  8. Performance indexes
--  9. Row-Level Security (products, customers, orders, order_items)
-- 10. Service role grants
-- 11. Wishlist note
-- 12. Site settings table + seed
-- 13. Coupons table + redeem RPC
--
-- ✅ Run ONCE in Supabase SQL Editor (fresh or existing DB).
-- ✅ Every statement is idempotent — safe to re-run anytime.
-- ✅ Uses DO $$ BEGIN IF NOT EXISTS ... END $$ guards throughout.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- SECTION 1 — Extensions
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ══════════════════════════════════════════════════════════════
-- SECTION 2 — Schema: ensure all required columns exist
-- ══════════════════════════════════════════════════════════════

-- launch_at: coming_soon countdown timer
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS launch_at timestamptz DEFAULT NULL;

-- show_order_count: per-product toggle — admin enables to show "X ordered" badge
-- Hidden by default (0 orders on new products)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS show_order_count boolean DEFAULT false;

-- stock_queue: units currently held in QUEUE orders (soft hold).
-- Incremented when order → QUEUE, decremented when → CONFIRMED or CANCELLED.
-- Available units = stock - stock_queue.
-- NOTE: stock_reserved was removed in v46 (redundant with stock_queue).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_queue integer DEFAULT 0;

-- Drop stock_reserved if it exists from a previous migration
ALTER TABLE products DROP COLUMN IF EXISTS stock_reserved;

-- stock_complete: lifetime units that passed through CONFIRMED orders
-- Incremented on CONFIRMED, decremented on CANCEL-from-CONFIRMED+
-- Useful for analytics: how many units of this product have been sold
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_complete integer DEFAULT 0;

-- Non-negative guards
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_queue_non_negative') THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_queue_non_negative CHECK (stock_queue >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_complete_non_negative') THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_complete_non_negative CHECK (stock_complete >= 0);
  END IF;
  -- Drop old stock_reserved constraint if exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_reserved_non_negative') THEN
    ALTER TABLE products DROP CONSTRAINT products_stock_reserved_non_negative;
  END IF;
END $$;

-- sale timer columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sale_active  boolean   DEFAULT false;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz DEFAULT NULL;

-- admin_sessions expiry
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_sessions' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE admin_sessions
      ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '7 days');
  END IF;
END $$;

-- Backfill existing admin_sessions rows
UPDATE admin_sessions
SET expires_at = created_at + interval '7 days'
WHERE expires_at IS NULL;

-- Remove already-expired sessions
DELETE FROM admin_sessions WHERE expires_at < now();


-- ══════════════════════════════════════════════════════════════
-- SECTION 3 — Admin password hash (SHA-256 via pgcrypto)
-- Default password: viro@2026
-- To change: SELECT encode(digest('newpassword','sha256'),'hex');
-- ══════════════════════════════════════════════════════════════

UPDATE admin_credentials
SET password_hash = encode(digest('viro@2026', 'sha256'), 'hex')
WHERE username = 'admin'
  AND length(password_hash) < 60;


-- ══════════════════════════════════════════════════════════════
-- SECTION 4 — Unique phone constraint on customers
-- Prevents duplicate rows on repeat orders from same phone.
-- ══════════════════════════════════════════════════════════════

-- Deduplicate first (keep most recent per phone)
DELETE FROM customers
WHERE id NOT IN (
  SELECT DISTINCT ON (phone) id
  FROM customers
  ORDER BY phone, created_at DESC
);

-- Add constraint only if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_phone_unique'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_phone_unique UNIQUE (phone);
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 5 — Stock management functions
--
-- Flow:
--   Place order  → status=UNPAID    → stock UNCHANGED
--   Admin confirm → status=CONFIRMED → stock DECREMENTED  ✅
--   Delivered    → status=DELIVERED  → stock stays as-is  ✅
--   Cancelled    → status=CANCELLED  → stock RESTORED (if confirmed) ↩️
-- ══════════════════════════════════════════════════════════════

-- decrement_stock: called on CONFIRM
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id uuid, p_qty int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_stock int;
BEGIN
  SELECT GREATEST(0, stock - p_qty) INTO v_new_stock
  FROM products WHERE id = p_product_id;

  UPDATE products
  SET
    stock  = v_new_stock,
    status = CASE
               WHEN v_new_stock = 0 AND status = 'active'
               THEN 'out_of_stock'
               ELSE status
             END
  WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_stock(uuid, int) TO anon, authenticated;


-- restore_stock: called on CANCEL (only if order was previously CONFIRMED)
CREATE OR REPLACE FUNCTION restore_stock(p_product_id uuid, p_qty int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_stock int;
BEGIN
  SELECT stock + p_qty INTO v_new_stock
  FROM products WHERE id = p_product_id;

  UPDATE products
  SET
    stock  = v_new_stock,
    status = CASE
               WHEN status = 'out_of_stock' AND v_new_stock > 0
               THEN 'active'
               ELSE status
             END
  WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION restore_stock(uuid, int) TO anon, authenticated;


-- ══════════════════════════════════════════════════════════════
-- SECTION 6 — Timer automation functions
--
-- v46 key behaviour:
--   • combined_timer_check() is now called CLIENT-SIDE too
--     (from CountdownTimer onExpire → supabase.rpc())
--     so status flips at the exact moment the countdown hits zero.
--   • The Edge Function / pg_cron is a safety net — not the only trigger.
-- ══════════════════════════════════════════════════════════════

-- auto_activate_coming_soon: flips status → active when launch_at has passed
CREATE OR REPLACE FUNCTION auto_activate_coming_soon()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE products
  SET
    status    = 'active',
    is_active = true
  WHERE
    status    = 'coming_soon'
    AND launch_at IS NOT NULL
    AND launch_at <= NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION auto_activate_coming_soon() TO service_role;


-- auto_disable_expired_sales: disables sale timer and reverts discount price
CREATE OR REPLACE FUNCTION auto_disable_expired_sales()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- v46 fix: ALSO clear sale_ends_at so future discounts are never blocked
  -- by the stale past date. Without this, any new bulk/single discount
  -- applied later would still see sale_ends_at in the past → effectiveDisc=false.
  UPDATE products
  SET
    sale_active    = false,
    discount_price = NULL,
    sale_ends_at   = NULL
  WHERE
    sale_active  = true
    AND sale_ends_at IS NOT NULL
    AND sale_ends_at <= NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION auto_disable_expired_sales() TO service_role;


-- reserve_stock: increments stock_queue when order → QUEUE
CREATE OR REPLACE FUNCTION reserve_stock(p_product_id uuid, p_qty int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE products
  SET stock_queue = COALESCE(stock_queue, 0) + p_qty
  WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_stock(uuid, int) TO anon, authenticated, service_role;


-- release_reservation: decrements stock_queue when CANCELLED from QUEUE
CREATE OR REPLACE FUNCTION release_reservation(p_product_id uuid, p_qty int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE products
  SET stock_queue = GREATEST(0, COALESCE(stock_queue, 0) - p_qty)
  WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION release_reservation(uuid, int) TO anon, authenticated, service_role;


-- combined_timer_check: single RPC — called by Edge Function, pg_cron,
--   AND now also called client-side when the countdown hits zero (v46).
--   Granted to anon + authenticated so the browser can invoke it directly.
CREATE OR REPLACE FUNCTION combined_timer_check()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Priority 1: activate products whose launch timer has expired
  UPDATE products
  SET
    status    = 'active',
    is_active = true
  WHERE
    status    = 'coming_soon'
    AND launch_at IS NOT NULL
    AND launch_at <= NOW();

  -- Priority 2: disable expired sale timers, revert discount price
  -- v46 fix: also NULL sale_ends_at so future discounts are never blocked
  UPDATE products
  SET
    sale_active    = false,
    discount_price = NULL,
    sale_ends_at   = NULL
  WHERE
    sale_active  = true
    AND sale_ends_at IS NOT NULL
    AND sale_ends_at <= NOW();
END;
$$;

-- v46: anon + authenticated needed so the client browser can call this RPC directly
GRANT EXECUTE ON FUNCTION combined_timer_check() TO service_role, anon, authenticated;


-- ══════════════════════════════════════════════════════════════
-- SECTION 7 — Performance indexes
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_orders_customer_id          ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status               ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id        ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone             ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_products_status             ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_is_active          ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_launch_coming_soon ON products(launch_at)
  WHERE status = 'coming_soon' AND launch_at IS NOT NULL;


-- ══════════════════════════════════════════════════════════════
-- SECTION 8 — Row-Level Security (RLS)
-- ══════════════════════════════════════════════════════════════

-- ── products ─────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products' AND policyname = 'Public read products'
  ) THEN
    CREATE POLICY "Public read products"
      ON products FOR SELECT USING (true);
  END IF;
END $$;

-- ── customers ────────────────────────────────────────────────
-- Customers are created by the browser (anon) on checkout.
-- Allow anon to INSERT and SELECT (needed for phone lookup).
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'Anon insert customers'
  ) THEN
    CREATE POLICY "Anon insert customers"
      ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'Anon select customers'
  ) THEN
    CREATE POLICY "Anon select customers"
      ON customers FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'Anon update customers'
  ) THEN
    CREATE POLICY "Anon update customers"
      ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── orders ───────────────────────────────────────────────────
-- Orders are placed by the browser (anon) on checkout.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Anon insert orders'
  ) THEN
    CREATE POLICY "Anon insert orders"
      ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Anon select orders'
  ) THEN
    CREATE POLICY "Anon select orders"
      ON orders FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Anon update orders'
  ) THEN
    CREATE POLICY "Anon update orders"
      ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── order_items ──────────────────────────────────────────────
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items' AND policyname = 'Anon insert order_items'
  ) THEN
    CREATE POLICY "Anon insert order_items"
      ON order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items' AND policyname = 'Anon select order_items'
  ) THEN
    CREATE POLICY "Anon select order_items"
      ON order_items FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 9 — Service role grants (admin reliability)
-- ══════════════════════════════════════════════════════════════

GRANT ALL ON TABLE orders      TO service_role;
GRANT ALL ON TABLE order_items TO service_role;
GRANT ALL ON TABLE products    TO service_role;
GRANT ALL ON TABLE customers   TO service_role;

-- Also grant anon the table-level permissions (RLS policies above control row access)
GRANT SELECT, INSERT, UPDATE ON TABLE customers   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE orders      TO anon, authenticated;
GRANT SELECT, INSERT         ON TABLE order_items TO anon, authenticated;


-- ══════════════════════════════════════════════════════════════
-- SECTION 10 — Wishlist (100% client-side, no DB changes needed)
-- ══════════════════════════════════════════════════════════════
--
-- Current implementation uses localStorage key: viro_wishlist
-- No tables required. If you later want server-side wishlists:
--
--   CREATE TABLE wishlists (
--     id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--     session_id text NOT NULL,
--     product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
--     created_at timestamptz DEFAULT now(),
--     UNIQUE (session_id, product_id)
--   );
--   ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "Users manage own wishlist"
--     ON wishlists FOR ALL
--     USING (session_id = current_setting('request.headers')::json->>'x-session-id')
--     WITH CHECK (session_id = current_setting('request.headers')::json->>'x-session-id');


-- ══════════════════════════════════════════════════════════════
-- SECTION 11 — Scheduled timer automation (CHOOSE ONE)
-- ══════════════════════════════════════════════════════════════

-- ── Option A: pg_cron (Supabase Pro only) ───────────────────
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- SELECT cron.schedule(
--   'viro-timer-check',   -- job name
--   '* * * * *',          -- every minute
--   'SELECT combined_timer_check()'
-- );
--
-- To list:   SELECT * FROM cron.job;
-- To remove: SELECT cron.unschedule('viro-timer-check');

-- ── Option B: Supabase Edge Function (Free + Pro) ────────────
--
-- File: supabase/functions/timer-check/index.ts (included in project)
-- Deploy: supabase functions deploy timer-check
-- Schedule: Supabase Dashboard → Edge Functions → timer-check → Schedules
-- Cron: * * * * *  (every minute)
--
-- v46 note: the client browser ALSO calls combined_timer_check() the instant
-- any coming_soon countdown hits zero — so the status flip is near-instant
-- even if the cron job hasn't run yet. The Edge Function is a reliable backup.


-- ══════════════════════════════════════════════════════════════
-- SECTION 12 — site_settings default rows
-- Run once — safe to re-run (ON CONFLICT DO NOTHING)
-- ══════════════════════════════════════════════════════════════

-- Create site_settings table if not exists
CREATE TABLE IF NOT EXISTS site_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Public read (customers need delivery rules, contact info)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Public read site_settings'
  ) THEN
    CREATE POLICY "Public read site_settings"
      ON site_settings FOR SELECT USING (true);
  END IF;
END $$;

-- Admin write (via service role in Edge Functions)
GRANT ALL ON TABLE site_settings TO service_role;

-- Default contact info
INSERT INTO site_settings (key, value) VALUES (
  'contact',
  '{"phone":"+923277796566","whatsapp":"923277796566","email":"support@viro.pk","address":"Mandi Burewala, Punjab, Pakistan"}'
) ON CONFLICT (key) DO NOTHING;

-- Default delivery rules — city-by-city, first match wins
-- cities: array of lowercase city names, or ["*"] for catch-all
INSERT INTO site_settings (key, value) VALUES (
  'delivery_rules',
  '[
    {"label":"Burewala",     "cities":["burewala"], "freeThreshold":550,  "charge":150},
    {"label":"Other Cities", "cities":["*"],        "freeThreshold":2500, "charge":150}
  ]'
) ON CONFLICT (key) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- SECTION 12 — site_settings table
-- Key-value store for all live admin-editable site config.
-- Keys: contact, delivery_rules, announcement, hero, theme, hot_ads
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS site_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='site_settings' AND policyname='Public read site_settings'
  ) THEN
    CREATE POLICY "Public read site_settings"
      ON site_settings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='site_settings' AND policyname='Service role write site_settings'
  ) THEN
    CREATE POLICY "Service role write site_settings"
      ON site_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed default contact & delivery rules (only if not already set)
-- Orders badge global visibility
INSERT INTO site_settings (key, value) VALUES
  ('orders_badge_settings', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Coupon field visibility (admin controls from Coupons tab)
INSERT INTO site_settings (key, value) VALUES
  ('coupon_settings', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_settings (key, value) VALUES
  ('contact', '{
    "phone":    "+923277796566",
    "whatsapp": "923277796566",
    "email":    "support@viro.pk",
    "address":  "Mandi Burewala, Punjab, Pakistan"
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── Delivery rules seed ────────────────────────────────────────
-- Structure per rule:
--   label         : display name (shown in admin and checkout preview)
--   cities        : array of lowercase city names, or ["*"] for all others
--   freeThreshold : order subtotal at or above which delivery is FREE
--   charge        : flat delivery fee when order is below freeThreshold
--
-- Admin can change any of these from Settings → Delivery Charges.
-- Changes apply immediately on customer checkout (fetched from DB each load).
--
-- Example below:
--   Burewala  : Rs.150 delivery, free on Rs.999+
--   Vehari    : Rs.150 delivery, free on Rs.1500+
--   All others: Rs.150 delivery, free on Rs.2500+
--   (Admin can add/remove cities and change any charge value any time)

INSERT INTO site_settings (key, value) VALUES
  ('delivery_rules', '[
    {
      "label":         "Burewala",
      "cities":        ["burewala"],
      "freeThreshold": 999,
      "charge":        150
    },
    {
      "label":         "Vehari",
      "cities":        ["vehari"],
      "freeThreshold": 1500,
      "charge":        150
    },
    {
      "label":         "All Other Cities",
      "cities":        ["*"],
      "freeThreshold": 2500,
      "charge":        150
    }
  ]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ⚠️  To UPDATE existing delivery rules (if you already ran this SQL before):
-- UPDATE site_settings
-- SET value = '[
--   {"label":"Burewala",         "cities":["burewala"], "freeThreshold":999,  "charge":150},
--   {"label":"Vehari",           "cities":["vehari"],   "freeThreshold":1500, "charge":150},
--   {"label":"All Other Cities", "cities":["*"],        "freeThreshold":2500, "charge":150}
-- ]'::jsonb
-- WHERE key = 'delivery_rules';

GRANT SELECT ON site_settings TO anon, authenticated;
GRANT ALL    ON site_settings TO service_role;


-- ══════════════════════════════════════════════════════════════
-- SECTION 13 — Coupons
-- Admin-managed discount codes with analytics tracking.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS coupons (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL UNIQUE,           -- e.g. VIRO20
  type        text        NOT NULL DEFAULT 'percent', -- 'percent' | 'fixed'
  value       numeric     NOT NULL,                   -- 20 = 20% or Rs.20
  min_order   numeric     NOT NULL DEFAULT 0,         -- 0 = no minimum
  max_uses    int         DEFAULT NULL,               -- NULL = unlimited
  used_count  int         NOT NULL DEFAULT 0,
  starts_at   timestamptz DEFAULT NULL,               -- NULL = active immediately
  expires_at  timestamptz DEFAULT NULL,               -- NULL = never expires
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Add starts_at to coupons if upgrading existing DB
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS starts_at timestamptz DEFAULT NULL;

-- Add coupon columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code     text    DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount numeric DEFAULT 0;

-- RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Public can read enabled coupons (to validate at checkout)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='coupons' AND policyname='Public read enabled coupons') THEN
    CREATE POLICY "Public read enabled coupons"
      ON coupons FOR SELECT TO anon, authenticated USING (enabled = true);
  END IF;
  -- Service role can do everything (admin writes go via Edge Function)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='coupons' AND policyname='Service role full coupons') THEN
    CREATE POLICY "Service role full coupons"
      ON coupons FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT ON coupons TO anon, authenticated;
GRANT ALL    ON coupons TO service_role;

-- redeem_coupon: atomically increment used_count (safe for concurrent requests)
CREATE OR REPLACE FUNCTION redeem_coupon(p_coupon_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE id = p_coupon_id;
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_coupon(uuid) TO anon, authenticated, service_role;

-- Index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_coupons_code    ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_enabled ON coupons(enabled);


-- ══════════════════════════════════════════════════════════════
-- SECTION 14 — Reviews
-- Star ratings (1-5) from customers who received their order.
-- Text reviews optional. Admin can enable/disable per product + globally.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reviews (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id     uuid        NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  customer_id  uuid        REFERENCES customers(id)          ON DELETE SET NULL,
  rating       int         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title        text        DEFAULT NULL,     -- optional short title
  body         text        DEFAULT NULL,     -- optional text review
  reviewer_name text       DEFAULT NULL,     -- display name (auto from customer)
  status       text        NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'hidden'
  created_at   timestamptz DEFAULT now()
);

-- Prevent duplicate reviews (one per customer per product per order)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_order_product_unique'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_order_product_unique
      UNIQUE (order_id, product_id);
  END IF;
END $$;

-- Per-product review enable/disable (admin toggle)
ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews_enabled boolean DEFAULT true;

-- Global review system toggle (stored in site_settings key = 'review_settings')
-- { enabled: true, auto_approve: false }

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Public read approved reviews') THEN
    CREATE POLICY "Public read approved reviews"
      ON reviews FOR SELECT TO anon, authenticated
      USING (status = 'approved');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Anon insert reviews') THEN
    CREATE POLICY "Anon insert reviews"
      ON reviews FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Service role full reviews') THEN
    CREATE POLICY "Service role full reviews"
      ON reviews FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT ON reviews TO anon, authenticated;
GRANT ALL            ON reviews TO service_role;

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status      ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id    ON reviews(order_id);

-- Seed review settings
INSERT INTO site_settings (key, value) VALUES
  ('review_settings', '{"enabled": true, "auto_approve": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed orders_badge_settings if not already
INSERT INTO site_settings (key, value) VALUES
  ('orders_badge_settings', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- SECTION 15 — Product Rating View
-- Computes avg_rating and review_count per product from approved reviews.
-- Used by ProductCard and ProductDetail to show star ratings.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW product_ratings AS
SELECT
  product_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(*)                        AS review_count
FROM reviews
WHERE status = 'approved'
GROUP BY product_id;

GRANT SELECT ON product_ratings TO anon, authenticated, service_role;

-- ══════════════════════════════════════════════════════════════
-- DONE ✅
-- ══════════════════════════════════════════════════════════════
--
-- Changelog by version:
--
--   v43:
--   • decrement_stock() — called on order CONFIRM
--   • restore_stock()   — called on order CANCEL
--   • admin_sessions.expires_at column + backfill + cleanup
--   • SHA-256 admin password hash (pgcrypto)
--   • Performance indexes on orders, customers, products
--   • RLS policy: public read on products
--
--   v44:
--   • customers.phone UNIQUE constraint (deduplicates first)
--   • decrement_stock / restore_stock rewritten with DECLARE variable (safer)
--   • service_role granted full access to core tables
--
--   v45:
--   • launch_at / sale_active / sale_ends_at columns (IF NOT EXISTS)
--   • auto_activate_coming_soon() — flips coming_soon → active at launch_at
--   • auto_disable_expired_sales() — disables expired sales, nulls discount
--   • combined_timer_check() — single RPC for both (used by Edge Function)
--   • Index on products(launch_at) for fast timer queries
--   • Edge Function: supabase/functions/timer-check/index.ts
--
--   v46 (queue + stock flow):
--   • combined_timer_check() now ALSO called client-side the moment countdown
--     hits zero (CountdownTimer onExpire → supabase.rpc('combined_timer_check'))
--   • ProductCard: self-updates its own product state after RPC call —
--     no full page reload needed
--   • ProductDetail: same — calls RPC on LaunchCountdownFull onExpire
--   • LaunchCountdownBadge: new compact purple badge for ProductCard
--   • All SQL patches merged into one idempotent file (this file)
--   • Removed all small per-version patch files
-- ══════════════════════════════════════════════════════════════
