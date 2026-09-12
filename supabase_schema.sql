-- Sanné Production Database Schema & RPC DDL
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

-- Historical component snapshot table for bundles at order creation time
CREATE TABLE IF NOT EXISTS order_item_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  quantity_per_bundle INT NOT NULL CHECK (quantity_per_bundle >= 1),
  total_quantity INT NOT NULL CHECK (total_quantity >= 1)
);

CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_components_order_id ON order_item_components(order_id);
CREATE INDEX IF NOT EXISTS idx_donations_order_id ON donations(order_id);

-- ============================================================================
-- 3. SEED AUTHORITATIVE DATA
-- ============================================================================
INSERT INTO products (id, name, category, base_price, stock) VALUES
  ('p1', 'Moisturizing Cream for Dry Skin', 'moisturizer', 229.00, 100),
  ('p2', 'Moisturizing Cream for Oily and Combination Skin', 'moisturizer', 229.00, 100),
  ('p3', 'Bosbos Body Fragrance — Makhmarya', 'body fragrance', 89.00, 100),
  ('p4', 'Rose Vanille Body Splash', 'body fragrance', 229.00, 100)
ON CONFLICT (id) DO UPDATE SET base_price = EXCLUDED.base_price, name = EXCLUDED.name;

INSERT INTO bundles (id, name, bundle_price) VALUES
  ('bundle_ritual', 'The Sanné Ritual', 299.00)
ON CONFLICT (id) DO UPDATE SET bundle_price = EXCLUDED.bundle_price;

INSERT INTO bundle_components (bundle_id, product_id, quantity) VALUES
  ('bundle_ritual', 'p3', 1),
  ('bundle_ritual', 'p4', 1)
ON CONFLICT (bundle_id, product_id) DO NOTHING;

-- Africa/Cairo Launch Window: Monday Sept 14 11:00 AM to Thursday Sept 17 11:59:59 PM Cairo Time (UTC+3)
-- Exclusive End UTC TIMESTAMPTZ: 2026-09-14 08:00:00Z to 2026-09-17 21:00:00Z
INSERT INTO promotions (promo_code, starts_at, ends_at, discount_percent, eligible_product_ids) VALUES
  ('LAUNCH10', '2026-09-14 08:00:00+00'::TIMESTAMPTZ, '2026-09-17 21:00:00+00'::TIMESTAMPTZ, 10.00, '["p3", "p4"]'::jsonb)
ON CONFLICT (promo_code) DO UPDATE SET starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, eligible_product_ids = EXCLUDED.eligible_product_ids;

INSERT INTO delivery_zones (city, delivery_fee) VALUES
  ('Cairo', 50.00),
  ('Giza', 50.00),
  ('Alexandria', 65.00),
  ('Belbeis', 65.00),
  ('Zagazig', 65.00),
  ('10th of Ramadan', 65.00),
  ('Other', 75.00)
ON CONFLICT (city) DO UPDATE SET delivery_fee = EXCLUDED.delivery_fee;

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) & POLICIES
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

DROP POLICY IF EXISTS "Public read products" ON products;
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read bundles" ON bundles;
CREATE POLICY "Public read bundles" ON bundles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read bundle_components" ON bundle_components;
CREATE POLICY "Public read bundle_components" ON bundle_components FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read promotions" ON promotions;
CREATE POLICY "Public read promotions" ON promotions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read delivery_zones" ON delivery_zones;
CREATE POLICY "Public read delivery_zones" ON delivery_zones FOR SELECT USING (true);

-- ============================================================================
-- 5. HELPER: GET FULL AUTHORITATIVE ORDER DTO
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
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'product_id', product_id,
    'product_name', product_name_snapshot,
    'quantity', quantity,
    'is_bundle', is_bundle,
    'base_unit_price', base_unit_price,
    'final_unit_price', final_unit_price,
    'discount_amount', discount_amount,
    'bundle_name', bundle_name_snapshot
  )) INTO v_items FROM order_items WHERE order_id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'idempotency_key', v_order.idempotency_key,
    'created_at', v_order.created_at,
    'status', v_order.status,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'customer_whatsapp', v_order.customer_whatsapp,
    'city', v_order.city,
    'address', v_order.address,
    'payment_method', v_order.payment_method,
    'items', COALESCE(v_items, '[]'::jsonb),
    'base_subtotal', v_order.base_subtotal,
    'discount_amount', v_order.discount_amount,
    'donation_amount', v_order.donation_amount,
    'delivery_fee', v_order.delivery_fee,
    'final_total', v_order.final_total,
    'promo_code', v_order.promo_code,
    'offer_type', v_order.offer_type
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. RPC: CREATE_ORDER (Atomic Transaction)
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
  p_donation_amount NUMERIC
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_order_id UUID;
  v_order_id UUID;
  v_order_item_id UUID;
  v_item RECORD;
  v_prod RECORD;
  v_bundle RECORD;
  v_bc RECORD;
  v_delivery_fee NUMERIC(10, 2);
  v_base_subtotal NUMERIC(10, 2) := 0.00;
  v_discount_amount NUMERIC(10, 2) := 0.00;
  v_final_total NUMERIC(10, 2) := 0.00;
  v_promo RECORD;
  v_is_launch_eligible BOOLEAN := false;
  v_offer_type TEXT := 'none';
  v_donation NUMERIC(10, 2);
  v_unit_base NUMERIC(10, 2);
  v_unit_final NUMERIC(10, 2);
  v_line_discount NUMERIC(10, 2);
  v_is_bundle_item BOOLEAN;
  v_prod_name_snap TEXT;
  v_norm_payment TEXT;
BEGIN
  -- 1. Input Validation
  v_donation := COALESCE(p_donation_amount, 0.00);
  IF v_donation < 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: Donation amount cannot be negative.';
  END IF;

  v_norm_payment := LOWER(TRIM(p_payment_method));
  IF v_norm_payment NOT IN ('cash', 'instapay') THEN
    RAISE EXCEPTION 'INVALID_INPUT: Unsupported payment method %. Must be cash or instapay.', p_payment_method;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: Cart items array cannot be empty.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, quantity INT) LOOP
    IF v_item.quantity IS NULL OR v_item.quantity < 1 THEN
      RAISE EXCEPTION 'INVALID_INPUT: Item quantity must be an integer of at least 1.';
    END IF;
  END LOOP;

  -- 2. Idempotency Check
  SELECT id INTO v_existing_order_id FROM orders WHERE idempotency_key = p_idempotency_key;
  IF v_existing_order_id IS NOT NULL THEN
    RETURN get_full_order_breakdown(v_existing_order_id);
  END IF;

  -- 3. Lookup Authoritative Delivery Fee
  SELECT delivery_fee INTO v_delivery_fee FROM delivery_zones WHERE LOWER(city) = LOWER(p_city);
  IF v_delivery_fee IS NULL THEN
    SELECT delivery_fee INTO v_delivery_fee FROM delivery_zones WHERE city = 'Other';
    IF v_delivery_fee IS NULL THEN
      RAISE EXCEPTION 'INVALID_CITY: Delivery zone % is unsupported.', p_city;
    END IF;
  END IF;

  -- 4. Generic Component Expansion & Inventory Locking (Deterministic ID order)
  CREATE TEMP TABLE temp_req_stock ON COMMIT DROP AS
  WITH expanded_items AS (
    SELECT (x->>'id') AS item_id, (x->>'quantity')::INT AS qty
    FROM jsonb_array_elements(p_items) x
  ),
  resolved_components AS (
    -- Standalone products
    SELECT ei.item_id AS product_id, ei.qty
    FROM expanded_items ei
    JOIN products p ON p.id = ei.item_id
    UNION ALL
    -- Bundles expanded via bundle_components
    SELECT bc.product_id, ei.qty * bc.quantity AS qty
    FROM expanded_items ei
    JOIN bundle_components bc ON bc.bundle_id = ei.item_id
  )
  SELECT product_id, SUM(qty)::INT AS total_qty
  FROM resolved_components
  GROUP BY product_id
  ORDER BY product_id ASC;

  -- Lock affected product rows in deterministic order
  FOR v_item IN SELECT * FROM temp_req_stock LOOP
    SELECT name INTO v_prod_name_snap FROM products WHERE id = v_item.product_id AND is_active = true FOR UPDATE;
    IF v_prod_name_snap IS NULL THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: Product % is out of stock or inactive.', v_item.product_id;
    END IF;

    IF (SELECT stock FROM products WHERE id = v_item.product_id) < v_item.total_qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: Insufficient stock for %.', v_prod_name_snap;
    END IF;
  END LOOP;

  -- 5. Server-Side Automatic Launch Promotion Evaluation
  SELECT * INTO v_promo FROM promotions WHERE promo_code = 'LAUNCH10' AND is_active = true;
  IF v_promo IS NOT NULL AND NOW() >= v_promo.starts_at AND NOW() < v_promo.ends_at THEN
    IF jsonb_array_length(p_items) = 1 AND (p_items->0->>'quantity')::INT = 1 THEN
      SELECT EXISTS (SELECT 1 FROM products WHERE id = (p_items->0->>'id')) INTO v_is_bundle_item;
      IF v_is_bundle_item AND v_promo.eligible_product_ids ? (p_items->0->>'id') THEN
        v_is_launch_eligible := true;
        v_offer_type := 'launch_10';
      END IF;
    END IF;
  END IF;

  IF NOT v_is_launch_eligible AND jsonb_array_length(p_items) = 1 THEN
    SELECT EXISTS (SELECT 1 FROM bundles WHERE id = (p_items->0->>'id')) INTO v_is_bundle_item;
    IF v_is_bundle_item THEN
      v_offer_type := 'sanne_ritual_bundle';
    END IF;
  END IF;

  -- 6. Calculate Subtotal & Line Prices
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, quantity INT) LOOP
    SELECT * INTO v_prod FROM products WHERE id = v_item.id;
    IF v_prod.id IS NOT NULL THEN
      v_unit_base := v_prod.base_price;
      IF v_is_launch_eligible THEN
        v_line_discount := ROUND((v_unit_base * (v_promo.discount_percent / 100.00)), 2);
        v_unit_final := v_unit_base - v_line_discount;
      ELSE
        v_line_discount := 0.00;
        v_unit_final := v_unit_base;
      END IF;
      v_base_subtotal := v_base_subtotal + (v_unit_base * v_item.quantity);
      v_discount_amount := v_discount_amount + (v_line_discount * v_item.quantity);
    ELSE
      SELECT * INTO v_bundle FROM bundles WHERE id = v_item.id;
      IF v_bundle.id IS NOT NULL THEN
        v_unit_base := v_bundle.bundle_price;
        v_unit_final := v_bundle.bundle_price;
        v_line_discount := 0.00;
        v_base_subtotal := v_base_subtotal + (v_unit_base * v_item.quantity);
      ELSE
        RAISE EXCEPTION 'INVALID_SKU: Product or Bundle % does not exist.', v_item.id;
      END IF;
    END IF;
  END LOOP;

  v_final_total := (v_base_subtotal - v_discount_amount) + v_donation + v_delivery_fee;

  -- 7. Insert Order Row with UNIQUE Idempotency Key
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
  SELECT COALESCE(SUM(amount), 0.00) INTO v_sum FROM donations;
  RETURN 1000.00 + v_sum; -- 1,000 EGP baseline + actual confirmed/placed donations
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. PERMISSIONS & ROLE GRANTS (STRICT SECURITY)
-- ============================================================================
-- Revoke default public permissions on mutation functions
REVOKE EXECUTE ON FUNCTION confirm_order(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION cancel_order(UUID) FROM PUBLIC, anon, authenticated;

-- Grant customer-facing execution to anon, authenticated, service_role
GRANT EXECUTE ON FUNCTION create_order(TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_full_order_breakdown(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_public_donation_total() TO anon, authenticated, service_role;

-- Grant admin mutation functions ONLY to service_role
GRANT EXECUTE ON FUNCTION confirm_order(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION cancel_order(UUID) TO service_role;
