/**
 * donation-helpers.js — Authoritative Sanné Donation Renderer
 * Base: 1,000 EGP + SUM(submitted customer donations in database)
 */

const INITIAL_DONATION_TOTAL = 1000;

async function getDonationTotal() {
  if (window.OrdersService && typeof window.OrdersService.getPublicDonationTotal === 'function') {
    return await window.OrdersService.getPublicDonationTotal();
  }
  if (window.DonationService && typeof window.DonationService.getPublicTotal === 'function') {
    return await window.DonationService.getPublicTotal();
  }
  const stored = localStorage.getItem('sanneDonationTotal');
  const val = stored ? Number(stored) : INITIAL_DONATION_TOTAL;
  return Number.isFinite(val) ? val : INITIAL_DONATION_TOTAL;
}

async function renderDonationTotal() {
  const donationTotalElements = document.querySelectorAll('[data-donation-total]');
  if (!donationTotalElements.length) return;

  try {
    const total = await getDonationTotal();
    donationTotalElements.forEach(el => {
      el.textContent = Number(total).toLocaleString('en-US') + ' EGP';
    });
  } catch (e) {
    console.warn('Error rendering donation total:', e);
  }
}

document.addEventListener('DOMContentLoaded', renderDonationTotal);
window.renderDonationTotal = renderDonationTotal;

