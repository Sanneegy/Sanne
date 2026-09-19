-- Sanné Official Production Database Schema & RPC Functions
-- Single Authoritative Source for Products, Prices, Stock, Promotions, Bundles, and Delivery Fees

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS bundles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bundle_price NUMERIC(10, 2) NOT NULL CHECK (bundle_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS bundle_components (
  bundle_id TEXT REFERENCES bundles(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  PRIMARY KEY (bundle_id, product_id)
);

CREATE TABLE IF NOT EXISTS promotions (
  promo_code TEXT PRIMARY KEY,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00 CHECK (discount_percent BETWEEN 0 AND 100),
  eligible_product_ids JSONB NOT NULL,
  max_line_items INT NOT NULL DEFAULT 1 CHECK (max_line_items >= 1),
  max_quantity INT NOT NULL DEFAULT 1 CHECK (max_quantity >= 1),
  allow_bundles BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS delivery_zones (
  city TEXT PRIMARY KEY,
  delivery_fee NUMERIC(10, 2) NOT NULL CHECK (delivery_fee >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_whatsapp TEXT,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'instapay')),
  base_subtotal NUMERIC(10, 2) NOT NULL CHECK (base_subtotal >= 0),
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  donation_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (donation_amount >= 0),
  delivery_fee NUMERIC(10, 2) NOT NULL CHECK (delivery_fee >= 0),
  final_total NUMERIC(10, 2) NOT NULL CHECK (final_total >= 0),
  promo_code TEXT,
  offer_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'confirmed', 'cancelled', 'pending_payment', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- Backward-compatible schema migration helpers for pre-existing orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_whatsapp TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS base_subtotal NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS donation_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS final_total NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offer_type TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'placed';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity >= 1),
  is_bundle BOOLEAN NOT NULL DEFAULT false,
  base_unit_price NUMERIC(10, 2) NOT NULL CHECK (base_unit_price >= 0),
  final_unit_price NUMERIC(10, 2) NOT NULL CHECK (final_unit_price >= 0),
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  bundle_name_snapshot TEXT
);

CREATE TABLE IF NOT EXISTS order_item_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  quantity_per_bundle INT NOT NULL CHECK (quantity_per_bundle >= 1),
  total_quantity INT NOT NULL CHECK (total_quantity >= 1)
);

CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backward-compatible column migration for donations table
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2);
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS order_id UUID UNIQUE;

-- ============================================================================
-- 2. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_components_order_id ON order_item_components(order_id);
CREATE INDEX IF NOT EXISTS idx_donations_order_id ON donations(order_id);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Public READ policies
CREATE POLICY "Public Read Products" ON products FOR SELECT USING (true);
CREATE POLICY "Public Read Bundles" ON bundles FOR SELECT USING (true);
CREATE POLICY "Public Read Bundle Components" ON bundle_components FOR SELECT USING (true);
CREATE POLICY "Public Read Promotions" ON promotions FOR SELECT USING (true);
CREATE POLICY "Public Read Delivery Zones" ON delivery_zones FOR SELECT USING (true);

-- Customer/Service INSERT policies
CREATE POLICY "Anon Create Orders" ON orders FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);
CREATE POLICY "Anon Create Order Items" ON order_items FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);
CREATE POLICY "Anon Create Component Snapshots" ON order_item_components FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);
CREATE POLICY "Anon Create Donations" ON donations FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);

-- ============================================================================
-- 4. SEED DATA
-- ============================================================================
INSERT INTO products (id, name, category, base_price, stock, is_active) VALUES
  ('p1', 'Moisturizing Cream for Dry Skin', 'moisturizer', 229.00, 100, true),
  ('p2', 'Moisturizing Cream for Oily and Combination Skin', 'moisturizer', 229.00, 100, true),
  ('p3', 'Bosbos Body Fragrance — Makhmarya', 'body fragrance', 89.00, 100, true),
  ('p4', 'Rose Vanille Body Splash', 'body fragrance', 229.00, 100, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  base_price = EXCLUDED.base_price,
  is_active = EXCLUDED.is_active;

INSERT INTO bundles (id, name, bundle_price, is_active) VALUES
  ('bundle_ritual', 'The Sanné Ritual', 299.00, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  bundle_price = EXCLUDED.bundle_price,
  is_active = EXCLUDED.is_active;

INSERT INTO bundle_components (bundle_id, product_id, quantity) VALUES
  ('bundle_ritual', 'p3', 1),
  ('bundle_ritual', 'p4', 1)
ON CONFLICT (bundle_id, product_id) DO UPDATE SET
  quantity = EXCLUDED.quantity;

-- Launch window: Sept 14 11:00 AM Cairo to Wednesday Sept 23 11:59:59 PM Cairo (UTC+3) -> 2026-09-23 20:59:59+00
INSERT INTO promotions (promo_code, starts_at, ends_at, discount_percent, eligible_product_ids, max_line_items, max_quantity, allow_bundles, is_active) VALUES
  ('LAUNCH10', '2026-09-14 08:00:00+00', '2026-09-23 20:59:59+00', 10.00, '["p3", "p4"]'::jsonb, 1, 1, false, true)
ON CONFLICT (promo_code) DO UPDATE SET
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  discount_percent = EXCLUDED.discount_percent,
  eligible_product_ids = EXCLUDED.eligible_product_ids,
  is_active = EXCLUDED.is_active;

INSERT INTO delivery_zones (city, delivery_fee) VALUES
  ('Belbeis', 15.00), ('Zagazig', 25.00), ('10th of Ramadan', 30.00),
  ('Cairo', 45.00), ('Giza', 45.00), ('Ismailia', 45.00), ('Dakahlia', 45.00),
  ('Gharbia', 45.00), ('Menoufia', 45.00), ('Alexandria', 50.00), ('Alex', 50.00),
  ('Beheira', 50.00), ('Suez', 50.00), ('Fayoum', 50.00), ('Port Said', 50.00),
  ('Damietta', 50.00), ('Kafr El Sheikh', 50.00), ('Beni Suef', 55.00), ('North Sinai', 55.00),
  ('Sharqiyah', 40.00), ('South Sinai', 70.00), ('Minya', 75.00), ('Assiut', 80.00),
  ('Matrouh', 80.00), ('Red Sea', 90.00), ('Sohag', 90.00), ('Aswan', 95.00),
  ('Luxor', 95.00), ('New Valley', 95.00), ('Qena', 95.00), ('Other', 75.00)
ON CONFLICT (city) DO UPDATE SET
  delivery_fee = EXCLUDED.delivery_fee;

-- ============================================================================
-- 5. RPC: GET_FULL_ORDER_BREAKDOWN
-- ============================================================================
CREATE OR REPLACE FUNCTION get_full_order_breakdown(p_order_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_items JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Order % does not exist.', p_order_id;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'product_id', product_id,
    'product_name', COALESCE(bundle_name_snapshot, product_name_snapshot),
    'quantity', quantity,
    'is_bundle', is_bundle,
    'base_unit_price', base_unit_price,
    'final_unit_price', final_unit_price,
    'discount_amount', discount_amount
  )) INTO v_items
  FROM order_items WHERE order_id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'idempotency_key', v_order.idempotency_key,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'customer_whatsapp', v_order.customer_whatsapp,
    'city', v_order.city,
    'address', v_order.address,
    'payment_method', v_order.payment_method,
    'base_subtotal', v_order.base_subtotal,
    'discount_amount', v_order.discount_amount,
    'donation_amount', v_order.donation_amount,
    'delivery_fee', v_order.delivery_fee,
    'final_total', v_order.final_total,
    'promo_code', v_order.promo_code,
    'offer_type', v_order.offer_type,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'items', v_items
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. RPC: CREATE_ORDER (Authoritative Transactional Creation)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_order(
  p_idempotency_key TEXT,
  p_items JSONB,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_whatsapp TEXT,
  p_city TEXT,
  p_address TEXT,
  p_payment_method TEXT,
  p_donation_amount NUMERIC DEFAULT 0.00
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_order_id UUID;
  v_order_item_id UUID;
  v_item RECORD;
  v_prod RECORD;
  v_bundle RECORD;
  v_bc RECORD;
  v_promo RECORD;
  v_zone RECORD;

  v_base_subtotal NUMERIC(10, 2) := 0.00;
  v_discount_amount NUMERIC(10, 2) := 0.00;
  v_delivery_fee NUMERIC(10, 2) := 0.00;
  v_donation NUMERIC(10, 2) := 0.00;
  v_final_total NUMERIC(10, 2) := 0.00;

  v_is_launch_eligible BOOLEAN := false;
  v_total_line_count INT := 0;
  v_total_item_qty INT := 0;
  v_single_prod_id TEXT := NULL;
  v_unit_base NUMERIC(10, 2) := 0.00;
  v_unit_final NUMERIC(10, 2) := 0.00;
  v_line_discount NUMERIC(10, 2) := 0.00;
  v_offer_type TEXT := 'none';
  v_norm_payment TEXT;
BEGIN
  -- 1. Idempotency Check
  SELECT id INTO v_existing_id FROM orders WHERE idempotency_key = p_idempotency_key;
  IF v_existing_id IS NOT NULL THEN
    RETURN get_full_order_breakdown(v_existing_id);
  END IF;

  -- 2. Validate Inputs
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART: Order must contain at least one item.';
  END IF;

  v_norm_payment := LOWER(TRIM(COALESCE(p_payment_method, 'cash')));
  IF v_norm_payment NOT IN ('cash', 'instapay') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: Payment method must be cash or instapay.';
  END IF;

  v_donation := GREATEST(0.00, COALESCE(p_donation_amount, 0.00));

  -- 3. Resolve Delivery Fee
  SELECT * INTO v_zone FROM delivery_zones WHERE LOWER(city) = LOWER(TRIM(p_city));
  IF v_zone.city IS NOT NULL THEN
    v_delivery_fee := v_zone.delivery_fee;
  ELSE
    SELECT delivery_fee INTO v_delivery_fee FROM delivery_zones WHERE city = 'Other';
    IF v_delivery_fee IS NULL THEN v_delivery_fee := 75.00; END IF;
  END IF;

  -- 4. Temporary table for inventory checks
  CREATE TEMP TABLE temp_req_stock (product_id TEXT PRIMARY KEY, total_qty INT) ON COMMIT DROP;

  -- 5. Calculate Base Subtotal & Accumulate Stock Requirements
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, quantity INT) LOOP
    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: Quantity for product % must be greater than zero.', v_item.id;
    END IF;

    v_total_line_count := v_total_line_count + 1;
    v_total_item_qty := v_total_item_qty + v_item.quantity;
    v_single_prod_id := v_item.id;

    SELECT * INTO v_prod FROM products WHERE id = v_item.id AND is_active = true;
    IF v_prod.id IS NOT NULL THEN
      v_base_subtotal := v_base_subtotal + (v_prod.base_price * v_item.quantity);
      INSERT INTO temp_req_stock VALUES (v_prod.id, v_item.quantity)
      ON CONFLICT (product_id) DO UPDATE SET total_qty = temp_req_stock.total_qty + EXCLUDED.total_qty;
    ELSE
      SELECT * INTO v_bundle FROM bundles WHERE id = v_item.id AND is_active = true;
      IF v_bundle.id IS NOT NULL THEN
        v_base_subtotal := v_base_subtotal + (v_bundle.bundle_price * v_item.quantity);
        v_offer_type := 'sanne_ritual_bundle';

        FOR v_bc IN SELECT * FROM bundle_components WHERE bundle_id = v_bundle.id LOOP
          INSERT INTO temp_req_stock VALUES (v_bc.product_id, v_bc.quantity * v_item.quantity)
          ON CONFLICT (product_id) DO UPDATE SET total_qty = temp_req_stock.total_qty + EXCLUDED.total_qty;
        FOR END;
      ELSE
        RAISE EXCEPTION 'UNKNOWN_PRODUCT: Item % is not an active product or bundle.', v_item.id;
      END IF;
    END IF;
  END LOOP;

  -- Verify Atomic Stock Availability
  FOR v_item IN SELECT * FROM temp_req_stock LOOP
    SELECT * INTO v_prod FROM products WHERE id = v_item.product_id FOR UPDATE;
    IF v_prod.stock < v_item.total_qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: Insufficient stock for product % (Available: %, Requested: %).',
        v_prod.name, v_prod.stock, v_item.total_qty;
    END IF;
  END LOOP;

  -- 6. Evaluate Promotion (LAUNCH10)
  SELECT * INTO v_promo FROM promotions WHERE promo_code = 'LAUNCH10' AND is_active = true;
  IF v_promo.promo_code IS NOT NULL AND NOW() >= v_promo.starts_at AND NOW() < v_promo.ends_at THEN
    IF v_total_line_count = 1 AND v_total_item_qty = 1 THEN
      IF v_promo.eligible_product_ids ? v_single_prod_id THEN
        v_is_launch_eligible := true;
        SELECT base_price INTO v_unit_base FROM products WHERE id = v_single_prod_id;
        v_discount_amount := ROUND((v_unit_base * (v_promo.discount_percent / 100.00)), 2);
        v_offer_type := 'launch_10';
      END IF;
    END IF;
  END IF;

  v_final_total := (v_base_subtotal - v_discount_amount) + v_donation + v_delivery_fee;

  -- 7. Insert Order Record
  INSERT INTO orders (
    idempotency_key, customer_name, customer_phone, customer_whatsapp, city, address, payment_method,
    base_subtotal, discount_amount, donation_amount, delivery_fee, final_total,
    promo_code, offer_type, status
  ) VALUES (
    p_idempotency_key, p_customer_name, p_customer_phone, COALESCE(p_customer_whatsapp, p_customer_phone), p_city, p_address, v_norm_payment,
    v_base_subtotal, v_discount_amount, v_donation, v_delivery_fee, v_final_total,
    CASE WHEN v_is_launch_eligible THEN 'LAUNCH10' ELSE NULL END, v_offer_type, 'placed'
  ) RETURNING id INTO v_order_id;

  -- 8. Insert Order Items & Historical Component Snapshots
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, quantity INT) LOOP
    SELECT * INTO v_prod FROM products WHERE id = v_item.id;
    IF v_prod.id IS NOT NULL THEN
      v_unit_base := v_prod.base_price;
      v_line_discount := CASE WHEN v_is_launch_eligible THEN ROUND((v_unit_base * (v_promo.discount_percent / 100.00)), 2) ELSE 0.00 END;
      v_unit_final := v_unit_base - v_line_discount;
      INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, is_bundle, base_unit_price, final_unit_price, discount_amount)
      VALUES (v_order_id, v_prod.id, v_prod.name, v_item.quantity, false, v_unit_base, v_unit_final, v_line_discount * v_item.quantity);
    ELSE
      SELECT * INTO v_bundle FROM bundles WHERE id = v_item.id;
      INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, is_bundle, base_unit_price, final_unit_price, discount_amount, bundle_name_snapshot)
      VALUES (v_order_id, v_bundle.id, v_bundle.name, v_item.quantity, true, v_bundle.bundle_price, v_bundle.bundle_price, 0.00, v_bundle.name)
      RETURNING id INTO v_order_item_id;

      -- Save historical order_item_components snapshot
      FOR v_bc IN SELECT * FROM bundle_components WHERE bundle_id = v_bundle.id LOOP
        INSERT INTO order_item_components (order_item_id, order_id, product_id, quantity_per_bundle, total_quantity)
        VALUES (v_order_item_id, v_order_id, v_bc.product_id, v_bc.quantity, v_bc.quantity * v_item.quantity);
      END FOR;
    END IF;
  END LOOP;

  -- 9. Deduct Inventory Atomically
  FOR v_item IN SELECT * FROM temp_req_stock LOOP
    UPDATE products SET stock = stock - v_item.total_qty WHERE id = v_item.product_id;
  END LOOP;

  -- 10. Record Donation Atomically
  IF v_donation > 0 THEN
    INSERT INTO donations (order_id, amount) VALUES (v_order_id, v_donation);
  END IF;

  RETURN get_full_order_breakdown(v_order_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. RPC: CONFIRM_ORDER (Status Only)
-- ============================================================================
CREATE OR REPLACE FUNCTION confirm_order(p_order_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Order % does not exist.', p_order_id;
  END IF;

  IF v_status NOT IN ('placed', 'pending_payment') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Cannot confirm order in status %.', v_status;
  END IF;

  UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Order status updated to confirmed.');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. RPC: CANCEL_ORDER (Authorized, Idempotent, Stock Restoration)
-- ============================================================================
CREATE OR REPLACE FUNCTION cancel_order(p_order_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_comp RECORD;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: Order % does not exist.', p_order_id;
  END IF;

  -- Idempotency check: return success if already cancelled
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order is already cancelled.');
  END IF;

  IF v_order.status NOT IN ('placed', 'pending_payment') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Cannot cancel order in status %.', v_order.status;
  END IF;

  -- Restore component inventory from order_item_components and order_items
  FOR v_item IN SELECT * FROM order_items WHERE order_id = p_order_id LOOP
    IF v_item.is_bundle THEN
      -- Restore from historical component snapshot
      FOR v_comp IN SELECT * FROM order_item_components WHERE order_item_id = v_item.id LOOP
        UPDATE products SET stock = stock + v_comp.total_quantity WHERE id = v_comp.product_id;
      END FOR;
    ELSE
      UPDATE products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  -- Remove donation from public donation total
  DELETE FROM donations WHERE order_id = p_order_id;

  UPDATE orders SET status = 'cancelled' WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'message', 'Order cancelled, stock restored, and donation voided.');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. RPC: GET_PUBLIC_DONATION_TOTAL
-- ============================================================================
CREATE OR REPLACE FUNCTION get_public_donation_total()
RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), COALESCE(SUM(amount_egp), 0.00)) INTO v_sum FROM donations;
  RETURN 1000.00 + v_sum; -- 1,000 EGP baseline + actual confirmed/placed donations
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. PERMISSIONS & ROLE GRANTS (STRICT SECURITY)
-- ============================================================================
REVOKE EXECUTE ON FUNCTION confirm_order(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION cancel_order(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION create_order(TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_full_order_breakdown(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_public_donation_total() TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION confirm_order(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION cancel_order(UUID) TO service_role;
