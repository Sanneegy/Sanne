/**
 * donation-helpers.js — Authoritative Sanné Donation Renderer
 *
 * Single source of truth: Supabase RPC get_public_donation_total()
 *
 * NO localStorage fallback.
 * NO counterapi.dev / third-party sync.
 * NO hardcoded donation values displayed to the user.
 *
 * If the RPC is unavailable, show nothing (empty string) rather than a stale/wrong value.
 */

async function getDonationTotal() {
  // Only authoritative source: Supabase RPC via OrdersService
  if (window.OrdersService && typeof window.OrdersService.getPublicDonationTotal === 'function') {
    return await window.OrdersService.getPublicDonationTotal();
  }
  // No fallback — return null so the caller can decide whether to render
  return null;
}

async function renderDonationTotal() {
  const donationTotalElements = document.querySelectorAll('[data-donation-total]');
  if (!donationTotalElements.length) return;

  try {
    const total = await getDonationTotal();
    donationTotalElements.forEach(el => {
      if (total !== null && typeof total === 'number' && isFinite(total)) {
        el.textContent = Number(total).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' EGP';
      }
      // If total is null, leave the element empty / loading — never show a stale hardcoded value
    });
  } catch (e) {
    console.warn('Error rendering donation total:', e);
  }
}

document.addEventListener('DOMContentLoaded', renderDonationTotal);
window.renderDonationTotal = renderDonationTotal;
