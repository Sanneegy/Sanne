-- ==============================================================================
-- Sanné Official Production Database Schema & RPC Functions
-- Shared source of truth for Orders, Order Items, and Campaign Donations
-- Workflow: Checkout -> pending order -> Merchant Confirm -> confirmed order -> Public Donation Counter
-- ==============================================================================

-- 1. APP SETTINGS (Global campaign configuration)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial donation total at 1,000 EGP
INSERT INTO public.app_settings (key, value, description)
VALUES ('donation_seed_egp', '1000', 'Public campaign starting donation total in EGP')
ON CONFLICT (key) DO NOTHING;

-- 2. ORDERS (Durable order header record)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'cancelled')),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_phone TEXT,
  city TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  customer_notes TEXT,
  product_subtotal_egp NUMERIC(10,2) NOT NULL CHECK (product_subtotal_egp >= 0),
  delivery_fee_egp NUMERIC(10,2) NOT NULL CHECK (delivery_fee_egp >= 0),
  discount_egp NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_egp >= 0),
  final_total_egp NUMERIC(10,2) NOT NULL CHECK (final_total_egp >= 0),
  idempotency_key TEXT UNIQUE,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add confirmed_at column if updating existing table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 3. ORDER ITEMS (Historical product price and line item snapshots)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price_egp NUMERIC(10,2) NOT NULL CHECK (unit_price_egp >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_egp NUMERIC(10,2) NOT NULL CHECK (line_total_egp >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. DONATIONS (Durable donation attached to an order)
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_egp NUMERIC(10,2) NOT NULL CHECK (amount_egp > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance and aggregation
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_donations_order_id ON public.donations(order_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON public.donations(status);

-- ==============================================================================
-- TRANSACTIONAL RPC: ATOMIC ORDER SUBMISSION (create_order)
-- Creates order header with status = 'pending', line items, and optional donation with status = 'pending'.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_order(
  p_order_number TEXT,
  p_customer_name TEXT,
  p_phone TEXT,
  p_whatsapp_phone TEXT,
  p_city TEXT,
  p_delivery_address TEXT,
  p_customer_notes TEXT,
  p_product_subtotal_egp NUMERIC,
  p_delivery_fee_egp NUMERIC,
  p_discount_egp NUMERIC,
  p_final_total_egp NUMERIC,
  p_donation_egp NUMERIC,
  p_idempotency_key TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_item_product_id TEXT;
  v_item_product_name TEXT;
  v_item_unit_price NUMERIC;
  v_item_quantity INT;
  v_item_line_total NUMERIC;
  v_existing_order_id UUID;
BEGIN
  -- Idempotency check: if order with idempotency_key already exists, return cleanly
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT id INTO v_existing_order_id FROM public.orders WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_existing_order_id,
        'order_number', p_order_number,
        'status', 'pending',
        'duplicate', true
      );
    END IF;
  END IF;

  -- 1. Insert Order Header with status = 'pending'
  INSERT INTO public.orders (
    order_number,
    customer_name,
    phone,
    whatsapp_phone,
    city,
    delivery_address,
    customer_notes,
    product_subtotal_egp,
    delivery_fee_egp,
    discount_egp,
    final_total_egp,
    idempotency_key,
    status
  ) VALUES (
    p_order_number,
    TRIM(p_customer_name),
    TRIM(p_phone),
    TRIM(COALESCE(p_whatsapp_phone, p_phone)),
    TRIM(p_city),
    TRIM(p_delivery_address),
    TRIM(p_customer_notes),
    COALESCE(p_product_subtotal_egp, 0),
    COALESCE(p_delivery_fee_egp, 0),
    COALESCE(p_discount_egp, 0),
    COALESCE(p_final_total_egp, 0),
    NULLIF(TRIM(p_idempotency_key), ''),
    'pending'
  )
  RETURNING id INTO v_order_id;

  -- 2. Insert Line Items
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_item_product_id := v_item->>'product_id';
      v_item_product_name := v_item->>'product_name';
      v_item_unit_price := (v_item->>'unit_price_egp')::NUMERIC;
      v_item_quantity := (v_item->>'quantity')::INT;
      v_item_line_total := (v_item->>'line_total_egp')::NUMERIC;

      INSERT INTO public.order_items (
        order_id,
        product_id,
        product_name,
        unit_price_egp,
        quantity,
        line_total_egp
      ) VALUES (
        v_order_id,
        v_item_product_id,
        v_item_product_name,
        v_item_unit_price,
        v_item_quantity,
        v_item_line_total
      );
    END LOOP;
  ELSE
    RAISE EXCEPTION 'Order must contain at least one product item.';
  END IF;

  -- 3. Insert Donation if amount > 0 with status = 'pending'
  IF p_donation_egp IS NOT NULL AND p_donation_egp > 0 THEN
    INSERT INTO public.donations (
      order_id,
      amount_egp,
      status
    ) VALUES (
      v_order_id,
      p_donation_egp,
      'pending'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', p_order_number,
    'status', 'pending',
    'duplicate', false
  );
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- ==============================================================================
-- MERCHANT RPC: CONFIRM ORDER (confirm_order)
-- Updates order status to 'confirmed', sets confirmed_at = NOW(), and confirms donation.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.confirm_order(
  p_order_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_current_status TEXT;
  v_confirmed_at TIMESTAMPTZ := NOW();
  v_donation_amount NUMERIC := 0;
BEGIN
  -- Find order by order_number or id
  SELECT id, status INTO v_order_id, v_current_status
  FROM public.orders
  WHERE order_number = p_order_number OR id::text = p_order_number;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found: ' || p_order_number
    );
  END IF;

  -- Update Order status to 'confirmed' and record timestamp
  UPDATE public.orders
  SET status = 'confirmed',
      confirmed_at = v_confirmed_at
  WHERE id = v_order_id;

  -- Update associated donation status to 'confirmed' if exists
  UPDATE public.donations
  SET status = 'confirmed'
  WHERE order_id = v_order_id
  RETURNING amount_egp INTO v_donation_amount;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', p_order_number,
    'status', 'confirmed',
    'confirmed_at', v_confirmed_at,
    'donation_confirmed_egp', COALESCE(v_donation_amount, 0)
  );
END;
$$;

-- ==============================================================================
-- MERCHANT RPC: GET PENDING ORDERS (get_pending_orders)
-- Fetches all pending orders for the merchant admin confirmation view.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_orders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'customer_name', o.customer_name,
      'phone', o.phone,
      'city', o.city,
      'delivery_address', o.delivery_address,
      'product_subtotal_egp', o.product_subtotal_egp,
      'delivery_fee_egp', o.delivery_fee_egp,
      'donation_egp', COALESCE(d.amount_egp, 0),
      'final_total_egp', o.final_total_egp,
      'status', o.status,
      'created_at', o.created_at
    ) ORDER BY o.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.orders o
  LEFT JOIN public.donations d ON d.order_id = o.id
  WHERE o.status = 'pending';

  RETURN v_result;
END;
$$;

-- ==============================================================================
-- PUBLIC RPC: AUTHORITATIVE DONATION TOTAL (get_public_donation_total)
-- Computes: Seed (1,000 EGP) + SUM(d.amount_egp WHERE d.status = 'confirmed' AND o.status = 'confirmed')
-- Exposes ONLY aggregate count, shielding private customer details.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_public_donation_total()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seed NUMERIC := 1000;
  v_sum NUMERIC := 0;
  v_total NUMERIC := 1000;
BEGIN
  -- Read seed setting if defined
  SELECT COALESCE(value::NUMERIC, 1000) INTO v_seed
  FROM public.app_settings
  WHERE key = 'donation_seed_egp';

  -- Calculate SUM of donations WHERE donation AND order status are STRICTLY 'confirmed'
  SELECT COALESCE(SUM(d.amount_egp), 0) INTO v_sum
  FROM public.donations d
  JOIN public.orders o ON d.order_id = o.id
  WHERE d.status = 'confirmed'
    AND o.status = 'confirmed';

  v_total := COALESCE(v_seed, 1000) + COALESCE(v_sum, 0);

  RETURN jsonb_build_object(
    'total_egp', v_total,
    'seed_egp', COALESCE(v_seed, 1000),
    'confirmed_donations_sum_egp', v_sum
  );
END;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVACY GRANTS
-- ==============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Revoke direct table access from public anonymous website visitors
REVOKE ALL ON public.orders FROM anon, authenticated;
REVOKE ALL ON public.order_items FROM anon, authenticated;
REVOKE ALL ON public.donations FROM anon, authenticated;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

-- Grant EXECUTE permissions ON RPC functions
GRANT EXECUTE ON FUNCTION public.create_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_orders TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_donation_total TO anon, authenticated;
