-- ══════════════════════════════════════════════════════════════
-- URGENT FIX — Run this NOW in Supabase SQL Editor
-- Fixes: "new row violates row-level security policy"
-- on customers / orders / order_items tables
-- ══════════════════════════════════════════════════════════════

-- 1. customers — allow browser (anon) to insert/select/update
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Anon insert customers') THEN
    CREATE POLICY "Anon insert customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Anon select customers') THEN
    CREATE POLICY "Anon select customers" ON customers FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Anon update customers') THEN
    CREATE POLICY "Anon update customers" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON TABLE customers TO anon, authenticated;

-- 2. orders — allow browser (anon) to insert/select/update
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='Anon insert orders') THEN
    CREATE POLICY "Anon insert orders" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='Anon select orders') THEN
    CREATE POLICY "Anon select orders" ON orders FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='Anon update orders') THEN
    CREATE POLICY "Anon update orders" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON TABLE orders TO anon, authenticated;

-- 3. order_items — allow browser (anon) to insert/select
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_items' AND policyname='Anon insert order_items') THEN
    CREATE POLICY "Anon insert order_items" ON order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_items' AND policyname='Anon select order_items') THEN
    CREATE POLICY "Anon select order_items" ON order_items FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

GRANT SELECT, INSERT ON TABLE order_items TO anon, authenticated;

-- Done ✅ — orders should now place successfully
