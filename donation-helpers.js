/**
 * donation-helpers.js — Authoritative Sanné Donation Renderer
 * Source of Truth: Supabase Postgres RPC get_public_donation_total
 */

const INITIAL_DONATION_TOTAL = 1000;

async function getDonationTotal() {
  if (window.OrdersService && typeof window.OrdersService.getPublicDonationTotal === 'function') {
    try {
      const val = await window.OrdersService.getPublicDonationTotal();
      const num = Number(val);
      if (!isNaN(num) && num > 0) return num;
    } catch (e) {
      console.warn('OrdersService getPublicDonationTotal failed:', e);
    }
  }

  // Direct fetch fallback from Supabase public RPC
  try {
    const res = await fetch('https://kqvoediolbpyvwpvbhty.supabase.co/rest/v1/rpc/get_public_donation_total', {
      method: 'POST',
      headers: {
        'apikey': 'sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst',
        'Authorization': 'Bearer sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst',
        'Content-Type': 'application/json'
      },
      body: '{}',
      cache: 'no-store'
    });
    if (res.ok) {
      const num = Number(await res.json());
      if (!isNaN(num) && num > 0) return num;
    }
  } catch (e) {
    console.warn('Direct get_public_donation_total fetch failed:', e);
  }

  return INITIAL_DONATION_TOTAL;
}

async function renderDonationTotal() {
  const donationTotalElements = document.querySelectorAll('[data-donation-total]');
  if (!donationTotalElements.length) return;

  try {
    const total = await getDonationTotal();
    const formatted = Number(total).toLocaleString('en-US') + ' EGP';
    donationTotalElements.forEach(el => {
      el.textContent = formatted;
    });
  } catch (e) {
    console.warn('Error rendering donation total:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderDonationTotal);
} else {
  renderDonationTotal();
}
window.addEventListener('pageshow', renderDonationTotal);
window.renderDonationTotal = renderDonationTotal;

