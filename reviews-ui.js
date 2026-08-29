/**
 * reviews-ui.js — UI Controller for Sanné Real Public Customer Reviews
 */

(function() {
  'use strict';

  let currentFilter = 'all';
  let selectedRating = 5;
  let allReviews = [];

  const PRODUCT_NAMES = {
    'p1': 'Moisturizing Cream For Dry Skin',
    'p2': 'Moisturizing Cream For Oily & Combination Skin',
    'p3': 'Bosbos Body Fragrance — Makhmarya',
    'p4': 'Rose Vanille Body Splash — 220 ml'
  };

  const RATING_DESCRIPTIONS = {
    1: '1 Star — Needs improvement',
    2: '2 Stars — Fair',
    3: '3 Stars — Good experience',
    4: '4 Stars — Really loved it ♡',
    5: '5 Stars — Pure magic on my skin ♡'
  };

  function formatDate(isoStr) {
    if (!isoStr) return 'Recently';
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 5) return 'Just now';
      if (diffHours < 1) return `${diffMins} minutes ago`;
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays} days ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  }

  function renderStars(rating) {
    const full = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      stars += i <= full ? '<span class="star-gold">★</span>' : '<span class="star-empty">☆</span>';
    }
    return stars;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Render reviews cards or empty state
   */
  function renderReviewsFeed() {
    const container = document.getElementById('reviews-cards-container');
    const filterBar = document.getElementById('reviews-filter-bar');
    if (!container) return;

    // Handle overall zero reviews case
    if (!allReviews || allReviews.length === 0) {
      if (filterBar) filterBar.style.display = 'none';
      container.innerHTML = `
        <div class="reviews-empty-state">
          <div class="empty-state-heart">♡</div>
          <h4 class="empty-state-title">Your words could be the first ♡</h4>
          <p class="empty-state-desc">Tried Sanné? Leave a little note for the girl discovering her next favorite.</p>
          <button type="button" class="btn-write-review-compact" onclick="openReviewModal()">
            <span class="btn-pen-icon">✦</span> Write your Sanné note <span class="btn-heart-icon">♡</span>
          </button>
        </div>
      `;
      return;
    }

    if (filterBar) filterBar.style.display = 'flex';

    // Apply Filter
    let filtered = allReviews;
    if (currentFilter === 'p1') {
      filtered = allReviews.filter(r => r.product_id === 'p1');
    } else if (currentFilter === 'p2') {
      filtered = allReviews.filter(r => r.product_id === 'p2');
    } else if (currentFilter === 'p3') {
      filtered = allReviews.filter(r => r.product_id === 'p3');
    } else if (currentFilter === 'p4') {
      filtered = allReviews.filter(r => r.product_id === 'p4');
    } else if (currentFilter === '5stars') {
      filtered = allReviews.filter(r => Number(r.rating) === 5);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="reviews-empty-state">
          <h4 class="empty-state-title">No notes in this category yet</h4>
          <p class="empty-state-desc">Be the first to share your experience with this Sanné product ♡</p>
          <button type="button" class="btn-write-review-compact" onclick="openReviewModal('${currentFilter.startsWith('p') ? currentFilter : ''}')">
            <span class="btn-pen-icon">✦</span> Write your Sanné note <span class="btn-heart-icon">♡</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(rev => {
      const prodName = rev.product_name || PRODUCT_NAMES[rev.product_id] || 'Sanné Product';
      const displayName = rev.display_name || rev.customer_name || 'Sanné Girl';
      const initial = (displayName.trim()[0] || 'S').toUpperCase();
      const skinBadge = rev.skin_type ? `<span class="card-skin-badge">Skin: ${escapeHtml(rev.skin_type)}</span>` : '';
      const recBadge = rev.would_recommend ? `<span class="card-rec-badge">♡ Recommends</span>` : '';

      return `
        <article class="real-review-card">
          <div class="card-header-row">
            <div class="card-stars">${renderStars(rev.rating)}</div>
            <span class="card-timestamp">${formatDate(rev.created_at)}</span>
          </div>

          <div class="card-product-label">
            <span class="label-dot">✦</span>
            <span>${escapeHtml(prodName)}</span>
          </div>

          <p class="card-text">"${escapeHtml(rev.review_text)}"</p>

          <div class="card-author-row">
            <div class="author-avatar-wrap">
              <span class="author-circle">${initial}</span>
              <span class="author-name">${escapeHtml(displayName)}</span>
            </div>
            <div class="card-tags-wrap">
              ${skinBadge}
              ${recBadge}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  /**
   * Update header scorecard based on REAL database records
   */
  async function updateScorecard() {
    if (!window.ReviewsService) return;
    const stats = await window.ReviewsService.getStats();
    const scorecardEl = document.getElementById('cl-scorecard-wrap');
    if (!scorecardEl) return;

    if (!stats.hasReviews || stats.count === 0) {
      scorecardEl.innerHTML = `
        <div class="scorecard-empty-prompt">
          <span class="prompt-spark">✦</span>
          <span>Be the first to leave a Sanné note ♡</span>
        </div>
      `;
    } else {
      scorecardEl.innerHTML = `
        <div class="scorecard-stars">${renderStars(stats.average)}</div>
        <div class="scorecard-numbers">
          <span class="scorecard-rating">${stats.average.toFixed(1)}</span>
          <span class="scorecard-divider">·</span>
          <span class="scorecard-count">Based on <strong>${stats.count}</strong> ${stats.count === 1 ? 'review' : 'reviews'}</span>
        </div>
      `;
    }

    // Update product card summaries
    updateProductCardRatings();
  }

  /**
   * Update rating badges on product cards on shop page
   */
  async function updateProductCardRatings() {
    if (!window.ReviewsService) return;
    const cards = document.querySelectorAll('.product-card');
    for (const card of cards) {
      const pid = card.getAttribute('data-id');
      if (!pid) continue;
      const stats = await window.ReviewsService.getStats(pid);
      let badgeEl = card.querySelector('.product-rating-summary');
      if (!badgeEl) {
        badgeEl = document.createElement('div');
        badgeEl.className = 'product-rating-summary';
        const titleEl = card.querySelector('.product-title, h3, h4');
        if (titleEl) {
          titleEl.insertAdjacentElement('afterend', badgeEl);
        } else {
          card.appendChild(badgeEl);
        }
      }
      if (stats.count > 0) {
        badgeEl.innerHTML = `
          <span class="prs-stars">★</span>
          <span class="prs-score">${stats.average.toFixed(1)}</span>
          <span class="prs-count">(${stats.count} ${stats.count === 1 ? 'review' : 'reviews'})</span>
        `;
      } else {
        badgeEl.innerHTML = `<span class="prs-count">No reviews yet</span>`;
      }
    }
  }

  /**
   * Modal & Star Selector initialization
   */
  function initStarSelector() {
    const container = document.getElementById('modal-star-selector');
    const labelEl = document.getElementById('modal-rating-label');
    if (!container) return;

    function renderPicker(activeVal) {
      container.innerHTML = [1, 2, 3, 4, 5].map(val => `
        <button type="button" class="star-pick-btn ${val <= activeVal ? 'selected' : ''}" data-value="${val}" aria-label="${val} stars">
          ★
        </button>
      `).join('');

      if (labelEl) {
        labelEl.textContent = RATING_DESCRIPTIONS[activeVal] || `${activeVal} Stars`;
      }

      container.querySelectorAll('.star-pick-btn').forEach(btn => {
        const btnVal = parseInt(btn.getAttribute('data-value'), 10);
        btn.addEventListener('click', () => {
          selectedRating = btnVal;
          renderPicker(selectedRating);
        });
        btn.addEventListener('mouseenter', () => {
          renderPicker(btnVal);
        });
        btn.addEventListener('mouseleave', () => {
          renderPicker(selectedRating);
        });
      });
    }

    renderPicker(selectedRating);
  }

  window.openReviewModal = function(defaultProductId = null) {
    const modal = document.getElementById('review-modal');
    const form = document.getElementById('review-submit-form');
    const successBox = document.getElementById('review-success-box');
    const errorBox = document.getElementById('review-error-box');

    if (!modal) return;

    if (form) {
      form.reset();
      form.style.display = 'block';
    }
    if (successBox) successBox.style.display = 'none';
    if (errorBox) {
      errorBox.style.display = 'none';
      errorBox.textContent = '';
    }

    if (defaultProductId) {
      const prodSelect = document.getElementById('modal-product-select');
      if (prodSelect) prodSelect.value = defaultProductId;
    }

    selectedRating = 5;
    initStarSelector();

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeReviewModal = function() {
    const modal = document.getElementById('review-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  /**
   * Main Initialize
   */
  async function init() {
    // 1. Filter pill click listeners
    const pills = document.querySelectorAll('.reviews-filter-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.getAttribute('data-filter') || 'all';
        renderReviewsFeed();
      });
    });

    // 2. Fetch real reviews
    if (window.ReviewsService) {
      allReviews = await window.ReviewsService.getReviews();
      renderReviewsFeed();
      await updateScorecard();
    }

    // 3. Form submission
    const form = document.getElementById('review-submit-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('btn-submit-review');
        const errorBox = document.getElementById('review-error-box');
        const successBox = document.getElementById('review-success-box');

        const nameInput = document.getElementById('modal-name-input');
        const prodSelect = document.getElementById('modal-product-select');
        const textInput = document.getElementById('modal-text-input');
        const skinInput = document.getElementById('modal-skin-select');
        const recRadio = document.querySelector('input[name="modal-recommend"]:checked');

        const name = nameInput ? nameInput.value.trim() : '';
        const prodId = prodSelect ? prodSelect.value : 'p1';
        const text = textInput ? textInput.value.trim() : '';
        const skin = skinInput ? skinInput.value : '';
        const rec = recRadio ? recRadio.value === 'yes' : true;

        if (!name) {
          if (errorBox) {
            errorBox.textContent = 'Please enter your name.';
            errorBox.style.display = 'block';
          }
          return;
        }

        if (!text) {
          if (errorBox) {
            errorBox.textContent = 'Please share your experience in your review.';
            errorBox.style.display = 'block';
          }
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Sharing your note...';
        }

        try {
          await window.ReviewsService.submitReview({
            display_name: name,
            customer_name: name,
            product_id: prodId,
            product_name: PRODUCT_NAMES[prodId] || 'Sanné Product',
            rating: selectedRating,
            review_text: text,
            skin_type: skin,
            would_recommend: rec
          });

          // Refresh reviews immediately from database
          allReviews = await window.ReviewsService.getReviews();
          renderReviewsFeed();
          await updateScorecard();

          if (form) form.style.display = 'none';
          if (successBox) successBox.style.display = 'block';

          setTimeout(() => {
            closeReviewModal();
          }, 2200);

        } catch (err) {
          console.error('Submit review error:', err);
          if (errorBox) {
            errorBox.textContent = 'Failed to submit review. Please try again.';
            errorBox.style.display = 'block';
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Share my review ✦';
          }
        }
      });
    }

    // 4. Close on backdrop click
    const modal = document.getElementById('review-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeReviewModal();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
