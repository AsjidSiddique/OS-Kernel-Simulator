# Viro Ecommerce Platform

**Smart Shopping, Better Living** — viro.pk

## 🚀 Quick Start

```bash
npm install
npm run dev
```

## ⚙️ Environment Setup

Copy `.env.example` to `.env` and fill in your keys:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_RESEND_API_KEY=re_your_resend_key_here
```

## 🗄️ Supabase Database Setup

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Products table
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  discount_price NUMERIC,
  stock INTEGER DEFAULT 0,
  images JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  total_price NUMERIC NOT NULL,
  delivery_charges NUMERIC DEFAULT 0,
  final_total NUMERIC NOT NULL,
  status TEXT DEFAULT 'UNPAID',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items table
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL
);

-- Enable Row Level Security (RLS) - allow public reads on products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public can insert customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can insert order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Public can read order_items" ON order_items FOR SELECT USING (true);
CREATE POLICY "Public can read customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Public can update orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "Admin can do all on products" ON products FOR ALL USING (true);
```

## 📦 Tech Stack

- **React 18** + **Vite**
- **Tailwind CSS** — dark premium UI
- **Supabase** — database & backend
- **Resend** — transactional emails

## 🚚 Delivery Rules

| City        | Free Delivery Threshold |
|-------------|------------------------|
| Burewala    | Rs. 550+               |
| Chichawatni | Rs. 2000+              |
| Vehari      | Rs. 1500+              |
| Gaggo       | Rs. 1200+              |
| Others      | Rs. 150 charge         |

## 📱 Features

- Mobile-first app-like UI
- Product gallery with multiple images
- Stock status (In Stock / Out of Stock)
- Discount price with strikethrough original
- City-based delivery calculator
- Order confirmation with WhatsApp
- Email notifications via Resend
- Admin panel: add/edit/delete products, manage orders
- Floating WhatsApp button
- localStorage cart persistence

## 📞 Contact

- Phone: +92 327 7796566
- Email: support@viro.pk
- Location: Mandi Burewala, Punjab, Pakistan

---
**VIRO — VALUE | VARIETY | VISION**
