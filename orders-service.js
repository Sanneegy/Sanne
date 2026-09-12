/**
 * orders-service.js — Sanné Production Orders & Shared Donation Service
 *
 * Source of Truth: Supabase Postgres RPCs
 * 1. Orders + Line Items + Donation are created ATOMICALLY via RPC: create_order with status = 'pending'
 * 2. Merchant confirms orders via RPC: confirm_order (sets status = 'confirmed', confirmed_at = NOW())
 * 3. Public donation total is calculated AUTHORITATIVELY via RPC: get_public_donation_total (confirmed donations ONLY)
 * 4. Row-Level Security protects customer data; only aggregate totals are publicly readable.
 */

(function(window) {
  'use strict';

  // Supabase Configuration — Live Production Environment
  const SUPABASE_CONFIG = {
    url: 'https://kqvoediolbpyvwpvbhty.supabase.co',
    anonKey: 'sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst'
  };

  let supabaseClient = null;

  function getSupabase() {
    if (!supabaseClient && window.supabase && SUPABASE_CONFIG.url && !SUPABASE_CONFIG.url.includes('YOUR_SUPABASE_URL')) {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      } catch (e) {
        console.warn('Supabase client initialization warning:', e);
      }
    }
    return supabaseClient;
  }

  function generateOrderNumber() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SANNE-${dateStr}-${randStr}`;
  }

  const OrdersService = {
    /**
     * Submit a new pending order atomically to Supabase database.
     */
    async submitOrder(orderPayload) {
      const sb = getSupabase();
      const orderNumber = orderPayload.order_number || generateOrderNumber();
      const idempotencyKey = orderPayload.idempotency_key || `${orderNumber}_${Date.now()}`;

      const rpcPayload = {
        p_order_number: orderNumber,
        p_customer_name: String(orderPayload.customer.name || '').trim(),
        p_phone: String(orderPayload.customer.phone || '').trim(),
        p_whatsapp_phone: String(orderPayload.customer.whatsapp || orderPayload.customer.phone || '').trim(),
        p_city: String(orderPayload.customer.city || '').trim(),
        p_delivery_address: String(orderPayload.customer.address || '').trim(),
        p_customer_notes: String(orderPayload.customer.notes || '').trim(),
        p_product_subtotal_egp: Number(orderPayload.product_subtotal_egp) || 0,
        p_delivery_fee_egp: Number(orderPayload.delivery_fee_egp) || 0,
        p_discount_egp: Number(orderPayload.discount_egp) || 0,
        p_final_total_egp: Number(orderPayload.final_total_egp) || 0,
        p_donation_egp: Number(orderPayload.donation_egp) || 0,
        p_idempotency_key: idempotencyKey,
        p_items: (orderPayload.items || []).map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          unit_price_egp: Number(item.unit_price_egp),
          quantity: Number(item.quantity),
          line_total_egp: Number(item.line_total_egp)
        }))
      };

      if (sb) {
        const { data, error } = await sb.rpc('create_order', rpcPayload);
        if (error) {
          console.error('Database order submission error:', error);
          throw new Error(error.message || 'Failed to save order to database.');
        }
        return data;
      }

      // Local fallback for staging/offline testing
      console.warn('Supabase keys not configured. Simulating pending database order.');
      const localLedgerKey = 'sanne_mock_db_orders';
      const existing = JSON.parse(localStorage.getItem(localLedgerKey) || '[]');
      existing.push({ order_number: orderNumber, status: 'pending', payload: rpcPayload, created_at: new Date().toISOString() });
      localStorage.setItem(localLedgerKey, JSON.stringify(existing));

      return {
        success: true,
        order_number: orderNumber,
        status: 'pending',
        duplicate: false,
        notice: 'Mock local persistence used'
      };
    },

    /**
     * Merchant RPC: Confirm an order in Supabase database.
     * Sets order status = 'confirmed', confirmed_at = NOW(), and donation status = 'confirmed'.
     */
    async confirmOrder(orderNumber) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.rpc('confirm_order', { p_order_number: orderNumber });
        if (error) {
          console.error('Database confirm order error:', error);
          throw new Error(error.message || 'Failed to confirm order in database.');
        }
        return data;
      }

      // Local fallback
      const localLedgerKey = 'sanne_mock_db_orders';
      const existing = JSON.parse(localStorage.getItem(localLedgerKey) || '[]');
      const order = existing.find(o => o.order_number === orderNumber);
      if (order) {
        order.status = 'confirmed';
        order.confirmed_at = new Date().toISOString();
        localStorage.setItem(localLedgerKey, JSON.stringify(existing));
        if (order.payload && order.payload.p_donation_egp > 0) {
          const currDonation = Number(localStorage.getItem('sanneDonationTotal') || 1000);
          localStorage.setItem('sanneDonationTotal', String(currDonation + order.payload.p_donation_egp));
        }
        return { success: true, order_number: orderNumber, status: 'confirmed', confirmed_at: order.confirmed_at };
      }
      throw new Error(`Order ${orderNumber} not found in mock store.`);
    },

    /**
     * Merchant RPC: Fetch all pending orders for confirmation dashboard.
     */
    async getPendingOrders() {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.rpc('get_pending_orders');
        if (error) {
          console.error('Failed to fetch pending orders:', error);
          throw new Error(error.message || 'Failed to fetch pending orders.');
        }
        return Array.isArray(data) ? data : [];
      }

      // Local fallback
      const localLedgerKey = 'sanne_mock_db_orders';
      const existing = JSON.parse(localStorage.getItem(localLedgerKey) || '[]');
      return existing
        .filter(o => o.status === 'pending')
        .map(o => ({
          order_number: o.order_number,
          customer_name: o.payload.p_customer_name,
          phone: o.payload.p_phone,
          city: o.payload.p_city,
          delivery_address: o.payload.p_delivery_address,
          final_total_egp: o.payload.p_final_total_egp,
          donation_egp: o.payload.p_donation_egp,
          status: o.status,
          created_at: o.created_at
        }));
    },

    /**
     * Get authoritative public donation total from database RPC.
     * STRICTLY counts 1,000 EGP starting seed + SUM(confirmed donations).
     */
    async getPublicDonationTotal() {
      const sb = getSupabase();
      if (sb) {
        try {
          const { data, error } = await sb.rpc('get_public_donation_total');
          if (!error && typeof data === 'number') {
            return data;
          }
          if (!error && data && typeof data.total_egp === 'number') {
            return data.total_egp;
          }
          if (error) {
            console.warn('Supabase get_public_donation_total RPC error:', error);
          }
        } catch (e) {
          console.warn('Network error fetching donation total from database:', e);
        }
      }

      // Local fallback
      const stored = localStorage.getItem('sanneDonationTotal');
      const val = stored ? Number(stored) : 1000;
      return Number.isFinite(val) ? val : 1000;
    }
  };

  window.OrdersService = OrdersService;
})(window);
