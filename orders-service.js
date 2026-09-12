/**
 * orders-service.js — Sanné Production Orders & Shared Donation Service
 *
 * Source of Truth: Supabase Postgres RPCs
 * 1. Orders + Line Items + Donation are created ATOMICALLY via RPC: create_order with status = 'placed'
 * 2. Merchant confirms orders via RPC: confirm_order (sets status = 'confirmed', confirmed_at = NOW())
 * 3. Idempotent & Authorized cancellation via RPC: cancel_order
 * 4. Public donation total is calculated AUTHORITATIVELY via RPC: get_public_donation_total
 */

(function(window) {
  'use strict';

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

  function generateIdempotencyKey() {
    return 'IDEM_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
  }

  const OrdersService = {
    /**
     * Submit order atomically to Supabase RPC create_order
     */
    async submitOrder(checkoutData) {
      const sb = getSupabase();
      const idempotencyKey = checkoutData.idempotency_key || generateIdempotencyKey();

      const rpcPayload = {
        p_idempotency_key: idempotencyKey,
        p_items: (checkoutData.items || []).map(item => ({
          id: item.id,
          quantity: parseInt(item.quantity, 10) || 1,
          is_bundle: !!item.isBundle || item.id === 'bundle_ritual'
        })),
        p_customer_name: String(checkoutData.customer_name || '').trim(),
        p_customer_phone: String(checkoutData.customer_phone || '').trim(),
        p_customer_whatsapp: String(checkoutData.customer_whatsapp || checkoutData.customer_phone || '').trim(),
        p_city: String(checkoutData.city || '').trim(),
        p_address: String(checkoutData.address || '').trim(),
        p_payment_method: String(checkoutData.payment_method || 'Cash').trim(),
        p_donation_amount: Math.max(0, parseFloat(checkoutData.donation_amount) || 0)
      };

      if (sb) {
        const { data, error } = await sb.rpc('create_order', rpcPayload);
        if (error) {
          console.error('Database create_order RPC error:', error);
          throw new Error(error.message || 'Failed to save order to database.');
        }
        return data; // Complete Authoritative Order Breakdown DTO
      }

      // Local fallback for offline testing
      console.warn('Supabase offline/unconfigured. Executing local engine preview.');
      const localTotals = window.PricingEngine 
        ? window.PricingEngine.calculateCartTotals(checkoutData.items, checkoutData.donation_amount, 50)
        : { finalTotalEgp: '0.00 EGP', discountEgp: '0.00 EGP' };

      const mockOrderId = 'SANNE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      return {
        order_id: mockOrderId,
        idempotency_key: idempotencyKey,
        created_at: new Date().toISOString(),
        status: 'placed',
        customer_name: checkoutData.customer_name,
        customer_phone: checkoutData.customer_phone,
        customer_whatsapp: checkoutData.customer_whatsapp || checkoutData.customer_phone,
        city: checkoutData.city,
        address: checkoutData.address,
        payment_method: checkoutData.payment_method || 'Cash',
        items: checkoutData.items.map(i => ({
          product_id: i.id,
          product_name: i.name || i.id,
          quantity: i.quantity,
          base_unit_price: (i.price || 0),
          final_unit_price: (i.price || 0)
        })),
        base_subtotal: parseFloat(localTotals.subtotalEgp) || 0,
        discount_amount: parseFloat(localTotals.discountEgp) || 0,
        donation_amount: parseFloat(checkoutData.donation_amount) || 0,
        delivery_fee: 50,
        final_total: parseFloat(localTotals.finalTotalEgp) || 0,
        promo_code: localTotals.isLaunchEligible ? 'LAUNCH10' : null,
        offer_type: localTotals.offerType || 'none'
      };
    },

    /**
     * Confirm an order (status update ONLY, stock was reserved on placement)
     */
    async confirmOrder(orderId) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.rpc('confirm_order', { p_order_id: orderId });
        if (error) throw new Error(error.message || 'Failed to confirm order.');
        return data;
      }
      return { success: true, order_id: orderId, status: 'confirmed' };
    },

    /**
     * Cancel an order (authorized & idempotent stock refund)
     */
    async cancelOrder(orderId, authKey) {
      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.rpc('cancel_order', { p_order_id: orderId, p_auth_key: authKey });
        if (error) throw new Error(error.message || 'Failed to cancel order.');
        return data;
      }
      return { success: true, order_id: orderId, status: 'cancelled' };
    },

    /**
     * Authoritative donation total
     */
    async getPublicDonationTotal() {
      const sb = getSupabase();
      if (!sb) {
        console.warn('Supabase client not ready — donation total unavailable.');
        return null;
      }
      try {
        const { data, error } = await sb.rpc('get_public_donation_total');
        if (error) {
          console.warn('get_public_donation_total RPC error:', error);
          return null;
        }
        // RPC returns a plain NUMERIC — e.g. 1300.00
        if (typeof data === 'number' && isFinite(data)) return data;
        // Defensive: if the old JSON-object form ever comes back
        if (data && typeof data.total_egp === 'number') return data.total_egp;
        return null;
      } catch (e) {
        console.warn('Donation total fetch exception:', e);
        return null;
      }
    }
  };

  window.OrdersService = OrdersService;
})(window);
