/**
 * pricing-engine.js — Sanné Commercial Pricing Engine & Template Renderer
 *
 * Responsibilities:
 * - Authoritative base prices: Makhmarya (89 EGP), Body Splash (229 EGP), Sanné Ritual (299 EGP).
 * - Integer minor unit financial arithmetic (piastres / cents) to eliminate floating-point artifacts.
 * - Dynamic UI price rendering (HTML data-product-id elements).
 * - Client-side launch eligibility checks for anti-286.20 bug warnings & bundle switch recommendations.
 * - All order totals are validated server-side by Supabase RPCs.
 */

(function(window) {
  'use strict';

  // Configured Launch Window: Sept 14, 2026 11:00 AM to Sept 17, 2026 11:59:59 PM Cairo Time (UTC+3)
  // Exclusive End: 2026-09-17T21:00:00Z
  const PROMO_CONFIG = {
    code: 'LAUNCH10',
    startsAt: '2026-09-01T08:00:00Z',
    endsAt:   '2026-09-17T21:00:00Z',
    discountPercent: 10,
    eligibleProductIds: ['p3', 'p4']
  };

  // Catalogue Cache (Base prices in piastres: 1 EGP = 100 piastres)
  let catalogueCache = {
    'p1': { id: 'p1', name: 'Moisturizing Cream for Dry Skin', basePricePiastres: 22900, isBundle: false },
    'p2': { id: 'p2', name: 'Moisturizing Cream for Oily and Combination Skin', basePricePiastres: 22900, isBundle: false },
    'p3': { id: 'p3', name: 'Bosbos Body Fragrance — Makhmarya', basePricePiastres: 8900, isBundle: false },
    'p4': { id: 'p4', name: 'Rose Vanille Body Splash', basePricePiastres: 22900, isBundle: false },
    'bundle_ritual': { id: 'bundle_ritual', name: 'The Sanné Ritual', basePricePiastres: 29900, isBundle: true }
  };

  function isLaunchActive(nowDate) {
    const now = nowDate ? new Date(nowDate) : new Date();
    const start = new Date(PROMO_CONFIG.startsAt);
    const end = new Date(PROMO_CONFIG.endsAt);
    return now >= start && now < end;
  }

  function formatMoney(piastres) {
    return (piastres / 100).toFixed(2) + ' EGP';
  }

  function formatMoneyWhole(piastres) {
    const egp = piastres / 100;
    return Number.isInteger(egp) ? egp + ' EGP' : egp.toFixed(2) + ' EGP';
  }

  function getBasePricePiastres(id) {
    const item = catalogueCache[id];
    return item ? item.basePricePiastres : 0;
  }

  /**
   * Client-side LAUNCH10 Eligibility Evaluation
   * Strict Rule: Exactly 1 line item, qty 1, product ID in eligibleProductIds (p3, p4), active launch window.
   */
  function checkLaunchEligibility(cart, nowDate) {
    if (!isLaunchActive(nowDate)) return { eligible: false, discountPiastres: 0 };
    if (!cart || cart.length !== 1) return { eligible: false, discountPiastres: 0 };
    
    const line = cart[0];
    const qty = parseInt(line.quantity || line.qty, 10) || 1;
    if (qty !== 1 || line.isBundle || line.id === 'bundle_ritual') return { eligible: false, discountPiastres: 0 };

    if (!PROMO_CONFIG.eligibleProductIds.includes(line.id)) {
      return { eligible: false, discountPiastres: 0 };
    }

    const basePiastres = getBasePricePiastres(line.id);
    const discountPiastres = Math.round(basePiastres * (PROMO_CONFIG.discountPercent / 100));

    return {
      eligible: true,
      productId: line.id,
      basePiastres: basePiastres,
      discountPiastres: discountPiastres,
      finalPiastres: basePiastres - discountPiastres
    };
  }

  /**
   * Anti-286.20 Bug Detection
   * Triggers if both p3 (Makhmarya) and p4 (Body Splash) are present in cart separately.
   */
  function checkSeparateBundleRecommendation(cart) {
    if (!cart || cart.length < 2) return false;
    const hasMakh = cart.some(item => item.id === 'p3' && !item.isBundle);
    const hasSplash = cart.some(item => item.id === 'p4' && !item.isBundle);
    return hasMakh && hasSplash;
  }

  /**
   * Calculate Complete Cart Preview Totals in Integer Minor Units
   */
  function calculateCartTotals(cart, donationEgp, deliveryEgp, nowDate) {
    let subtotalPiastres = 0;

    (cart || []).forEach(item => {
      const baseUnit = getBasePricePiastres(item.id);
      const qty = parseInt(item.quantity || item.qty, 10) || 1;
      subtotalPiastres += baseUnit * qty;
    });

    const launchResult = checkLaunchEligibility(cart, nowDate);
    const discountPiastres = launchResult.eligible ? launchResult.discountPiastres : 0;

    const donationPiastres = Math.max(0, Math.round((parseFloat(donationEgp) || 0) * 100));
    const deliveryPiastres = Math.max(0, Math.round((parseFloat(deliveryEgp) || 0) * 100));

    const finalTotalPiastres = (subtotalPiastres - discountPiastres) + donationPiastres + deliveryPiastres;

    return {
      subtotalPiastres,
      subtotalEgp: formatMoney(subtotalPiastres),
      discountPiastres,
      discountEgp: formatMoney(discountPiastres),
      donationPiastres,
      donationEgp: formatMoney(donationPiastres),
      deliveryPiastres,
      deliveryEgp: formatMoney(deliveryPiastres),
      finalTotalPiastres,
      finalTotalEgp: formatMoney(finalTotalPiastres),
      isLaunchEligible: launchResult.eligible,
      offerType: launchResult.eligible ? 'launch_10' : (cart && cart.length === 1 && cart[0].id === 'bundle_ritual' ? 'sanne_ritual_bundle' : 'none'),
      shouldRecommendRitualBundle: checkSeparateBundleRecommendation(cart)
    };
  }

  /**
   * Dynamic Price Badge Renderer for HTML Elements with data-product-id
   */
  function renderDynamicPrices(nowDate) {
    const priceElements = document.querySelectorAll('[data-product-id]');
    const active = isLaunchActive(nowDate);

    priceElements.forEach(el => {
      const id = el.getAttribute('data-product-id');
      const item = catalogueCache[id];
      if (!item) return;

      const baseP = item.basePricePiastres;
      const isEligibleProd = PROMO_CONFIG.eligibleProductIds.includes(id);

      if (item.isBundle || id === 'bundle_ritual') {
        // The Sanné Ritual (299 EGP vs 318 EGP value) — BUNDLE & SAVE badge
        el.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem;">
            <span style="text-decoration: line-through; color: var(--color-text-light); font-size: 0.9em; white-space: nowrap;">318 EGP</span>
            <span style="font-weight: 700; color: var(--color-dark-brown); font-size: 1.15em; white-space: nowrap;">299 EGP</span>
            <span style="display: inline-block; background: #EADDCB; color: #4A3C2B; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.2rem 0.5rem; border-radius: 3px; white-space: nowrap;">BUNDLE & SAVE</span>
          </div>
        `;
      } else if (isEligibleProd) {
        if (active) {
          const discP = Math.round(baseP * (PROMO_CONFIG.discountPercent / 100));
          const finalP = baseP - discP;
          el.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem;">
              <span style="text-decoration: line-through; color: var(--color-text-light); font-size: 0.9em; white-space: nowrap;">${formatMoneyWhole(baseP)}</span>
              <span style="font-weight: 700; color: var(--color-dark-brown); font-size: 1.15em; white-space: nowrap;">${formatMoney(finalP)}</span>
              <span style="display: inline-block; background: #8A333C; color: #FFFFFF; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.2rem 0.5rem; border-radius: 3px; white-space: nowrap;">10% LAUNCH OFFER</span>
            </div>
          `;
        } else {
          el.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem;">
              <span style="font-weight: 700; color: var(--color-dark-brown); font-size: 1.1em; white-space: nowrap;">${formatMoneyWhole(baseP)}</span>
              <span style="display: inline-block; background: #F8F6F0; border: 1px solid #CBAA77; color: #8C7355; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.2rem 0.5rem; border-radius: 3px; white-space: nowrap;">10% LAUNCH OFFER FROM MONDAY</span>
            </div>
          `;
        }
      } else {
        // Base Price (Moisturizers, etc.)
        el.innerHTML = `<span style="font-weight: 600; color: var(--color-dark-brown); white-space: nowrap;">${formatMoneyWhole(baseP)}</span>`;
      }
    });
  }

  function buildWhatsAppMessage(orderDTO) {
    if (!orderDTO) return '';
    const fmt = (val) => Number(val || 0).toFixed(2) + ' EGP';
    let itemLines = '';
    (orderDTO.items || []).forEach(it => {
      if (it.is_bundle) {
        itemLines += `• ${it.product_name || 'Item'} × ${it.quantity}\n  Bundle Price: ${fmt(it.final_unit_price)}\n`;
      } else {
        if (it.discount_amount > 0) {
          itemLines += `• ${it.product_name || 'Item'} × ${it.quantity}\n  Regular Price: ${fmt(it.base_unit_price)}\n  Launch Discount: -${fmt(it.discount_amount)}\n  Final Product Price: ${fmt(it.final_unit_price)}\n`;
        } else {
          itemLines += `• ${it.product_name || 'Item'} × ${it.quantity} (${fmt(it.final_unit_price)})\n`;
        }
      }
    });

    return `Hello Sanné 🌿 I'd like to place an order.

Order ID: ${orderDTO.order_id || 'N/A'}

*Order Details:*
${itemLines}
*Subtotal:* ${fmt(orderDTO.base_subtotal)}
${orderDTO.discount_amount > 0 ? `*Launch Discount:* -${fmt(orderDTO.discount_amount)}\n` : ''}*Delivery Fee:* ${fmt(orderDTO.delivery_fee)}
${orderDTO.donation_amount > 0 ? `*Donation:* ${fmt(orderDTO.donation_amount)}\n` : ''}*Total:* ${fmt(orderDTO.final_total)}
*Payment Method:* ${orderDTO.payment_method || 'Cash'}

*Customer Details:*
Name: ${orderDTO.customer_name}
Phone: ${orderDTO.customer_phone}
WhatsApp: ${orderDTO.customer_whatsapp || orderDTO.customer_phone}
City: ${orderDTO.city}
Address: ${orderDTO.address}`;
  }

  // Export Engine API
  window.PricingEngine = {
    PROMO_CONFIG,
    isLaunchActive,
    formatMoney,
    formatMoneyWhole,
    getBasePricePiastres,
    checkLaunchEligibility,
    checkSeparateBundleRecommendation,
    calculateCartTotals,
    renderDynamicPrices,
    buildWhatsAppMessage,
    updateCatalogueCache: function(newCat) {
      if (Array.isArray(newCat)) {
        newCat.forEach(p => {
          catalogueCache[p.id] = {
            id: p.id,
            name: p.name,
            basePricePiastres: Math.round((p.base_price || p.price) * 100),
            isBundle: !!p.is_bundle || p.id === 'bundle_ritual'
          };
        });
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderDynamicPrices();
  });

})(window);
