/**
 * donation-helpers.js — Shared localStorage donation counter for Sanné
 *
 * Key: sanneDonationTotal
 * Base: 1,000 EGP
 *
 * Load this file on every page that needs to read or update the donation total.
 */

const DONATION_TOTAL_KEY = 'sanneDonationTotal';
const INITIAL_DONATION_TOTAL = 1000;

function getDonationTotal() {
  const stored = localStorage.getItem(DONATION_TOTAL_KEY);
  const value = stored ? Number(stored) : INITIAL_DONATION_TOTAL;
  return Number.isFinite(value) ? value : INITIAL_DONATION_TOTAL;
}

function setDonationTotal(amount) {
  localStorage.setItem(DONATION_TOTAL_KEY, String(amount));
}

function addDonationToTotal(donationAmount) {
  const cleanDonation = Number(donationAmount);
  if (!Number.isFinite(cleanDonation) || cleanDonation <= 0) return;

  const currentTotal = getDonationTotal();
  const newTotal = currentTotal + cleanDonation;
  setDonationTotal(newTotal);
}

function renderDonationTotal() {
  const donationTotalElement = document.querySelector('[data-donation-total]');
  if (!donationTotalElement) return;

  const total = getDonationTotal();
  donationTotalElement.textContent = total.toLocaleString('en-US') + ' EGP';
}

document.addEventListener('DOMContentLoaded', renderDonationTotal);
