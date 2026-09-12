// Sanné Main JS — Production Commerce & UI Architecture

// 1. Navigation & Mobile Menu
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
  });
}

// 2. Authoritative Frontend Product Catalogue Reference
const products = [
  {
    id: 'p1',
    name: 'Moisturizing Cream',
    variant: 'For Dry Skin',
    fullName: 'Moisturizing Cream for Dry Skin',
    category: 'moisturizer',
    skinType: 'dry',
    price: 229,
    image: 'images/dry_skin.jpg',
    hover_image: 'images/hover_dry_skin_1778922108728.png',
    desc: 'Rich moisture for healthy looking skin, with jojoba oil, sweet almond oil, ceramide NP, and hyaluronic acid.',
    isBestSeller: false,
    isFragrance: false,
    isMoisturizer: true,
    isBundle: false,
    concerns: ['dry', 'flaky', 'tight', 'rough', 'dehydrated', 'dull', 'lacking moisture']
  },
  {
    id: 'p2',
    name: 'Moisturizing Cream',
    variant: 'For Oily and Combination Skin',
    fullName: 'Moisturizing Cream for Oily and Combination Skin',
    category: 'moisturizer',
    skinType: 'oily',
    price: 229,
    image: 'images/oily_skin.jpg',
    hover_image: 'images/hover_oily_skin_1778922300593.png',
    desc: 'Lightweight daily moisture that supports skin barrier comfort, with naturally derived lipids and soothing extracts.',
    isBestSeller: true,
    isFragrance: false,
    isMoisturizer: true,
    isBundle: false,
    concerns: ['oily', 'shiny', 'greasy', 'combination', 'T-zone', 'acne-prone', 'pores', 'heavy cream sensitivity']
  },
  {
    id: 'p3',
    name: 'Bosbos Body Fragrance',
    variant: 'Makhmarya',
    fullName: 'Bosbos Body Fragrance — Makhmarya',
    category: 'body fragrance',
    skinType: 'all',
    price: 89, // Authoritative Base Price
    image: 'images/bosbos.jpg',
    hover_image: 'images/bosbos_hover.png',
    desc: 'A warm body fragrance made to leave the skin softly scented and beautifully cared for.',
    isBestSeller: true,
    isFragrance: true,
    isMoisturizer: false,
    isBundle: false,
    concerns: ['scent', 'fragrance', 'body care', 'gifting', 'everyday ritual', 'makhmarya']
  },
  {
    id: 'p4',
    name: 'Rose Vanille Body Splash',
    variant: '220 ml',
    fullName: 'Rose Vanille Body Splash — 220 ml',
    category: 'body fragrance',
    skinType: 'all',
    price: 229, // Authoritative Base Price
    image: 'images/rose_vanille.jpg',
    hover_image: 'images/hover_rose_vanille.jpg',
    desc: 'A refreshing and long-lasting body fragrance mist with delicate rose and warm vanilla notes for your daily scent ritual.',
    isBestSeller: false,
    isFragrance: true,
    isMoisturizer: false,
    isBundle: false,
    concerns: ['scent', 'fragrance', 'body splash', 'mist', 'rose', 'vanilla', 'refreshing', 'spray', '220 ml']
  },
  {
    id: 'bundle_ritual',
    name: 'The Sanné Ritual',
    variant: 'Gift Set (Makhmarya + Body Splash)',
    fullName: 'The Sanné Ritual — Curated Scent Set',
    category: 'bundle',
    skinType: 'all',
    price: 299, // Authoritative Bundle Base Price
    image: 'images/bosbos.jpg',
    hover_image: 'images/rose_vanille.jpg',
    desc: 'Complete your scent ritual. Pair Rose Vanille Body Splash with Makhmarya for a layered, soft scent that stays with you all day.',
    isBestSeller: true,
    isFragrance: true,
    isMoisturizer: false,
    isBundle: true,
    concerns: ['bundle', 'ritual', 'gift', 'set', 'makhmarya', 'splash']
  }
];

window.products = products;
if (window.PricingEngine && typeof window.PricingEngine.updateCatalogueCache === 'function') {
  window.PricingEngine.updateCatalogueCache(products);
}

// 3. Wishlist / MY LOVES ♡ Implementation
let wishlist = JSON.parse(localStorage.getItem('sanne_wishlist')) || [];

function saveWishlist() {
  localStorage.setItem('sanne_wishlist', JSON.stringify(wishlist));
  updateWishlistUI();
}

function toggleWishlist(id, btn) {
  const index = wishlist.indexOf(id);
  if (index > -1) {
    wishlist.splice(index, 1);
    if (btn) btn.classList.remove('active');
  } else {
    wishlist.push(id);
    if (btn) btn.classList.add('active');
  }
  saveWishlist();
}

function updateWishlistUI() {
  const wishlistNav = document.getElementById('nav-wishlist');
  if (wishlistNav) {
    wishlistNav.textContent = wishlist.length > 0 ? `MY LOVES ♡ (${wishlist.length})` : 'MY LOVES ♡';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateWishlistUI();
  
  const searchLink = document.getElementById('nav-search');
  if (searchLink && !document.getElementById('nav-wishlist')) {
    searchLink.insertAdjacentHTML('afterend', `<a href="#" class="nav-link" id="nav-wishlist">MY LOVES ♡</a>`);
    document.getElementById('nav-wishlist')?.addEventListener('click', (e) => {
      e.preventDefault();
      openWishlistOverlay();
    });
  }
});

function openWishlistOverlay() {
  let overlay = document.getElementById('wishlist-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'wishlist-overlay';
    overlay.className = 'cart-overlay';
    overlay.innerHTML = `
      <div class="cart-sidebar">
        <div class="cart-header">
          <h3 style="font-family:var(--font-serif);font-size:1.4rem;margin:0;">MY LOVES ♡</h3>
          <button id="close-wishlist" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
        </div>
        <div class="cart-items mt-md" id="wishlist-items-container"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('close-wishlist')?.addEventListener('click', () => overlay.classList.remove('active'));
  }

  const container = document.getElementById('wishlist-items-container');
  if (container) {
    if (wishlist.length === 0) {
      container.innerHTML = '<p class="text-center mt-md" style="color:var(--color-text-light);">Your loved items list is empty ♡</p>';
    } else {
      container.innerHTML = wishlist.map(id => {
        const item = products.find(p => p.id === id);
        if (!item) return '';
        return `
          <div style="display:flex;gap:1rem;margin-bottom:1.2rem;align-items:center;">
            <img src="${item.image}" style="width:70px;height:70px;object-fit:cover;border-radius:4px;">
            <div style="flex:1;">
              <h4 style="font-family:var(--font-serif);margin:0;font-size:1rem;color:var(--color-dark-brown);">${item.name}</h4>
              <p style="font-size:0.8rem;color:var(--color-text-light);margin:0 0 0.4rem;">${item.variant}</p>
              <div data-product-id="${item.id}">
                <span style="font-weight:600;">${item.price} EGP</span>
              </div>
            </div>
            <button onclick="addToCart(window.products.find(p=>p.id==='${item.id}')); this.textContent='Added ✓'" style="background:var(--color-dark-brown);color:#fff;border:none;padding:0.4rem 0.7rem;border-radius:4px;font-size:0.75rem;cursor:pointer;">Add</button>
            <button onclick="toggleWishlist('${item.id}'); openWishlistOverlay();" style="background:none;border:none;color:var(--color-soft-brown);cursor:pointer;">&times;</button>
          </div>
        `;
      }).join('');
    }
  }
  overlay.classList.add('active');
}

// 4. Cart State & LocalStorage Migration Logic
let rawCartData = JSON.parse(localStorage.getItem('sanne_cart')) || [];

// Migration / Sanitization: Persist ONLY { id, quantity, isBundle }
let cart = rawCartData.map(item => {
  const prodId = item.id || item.product_id;
  const qty = parseInt(item.qty || item.quantity, 10) || 1;
  const isBundle = !!item.isBundle || prodId === 'bundle_ritual';
  return { id: prodId, quantity: qty, isBundle: isBundle };
}).filter(item => products.some(p => p.id === item.id));

function saveCart() {
  // Store only SKU identifiers and quantities
  const sanitized = cart.map(item => ({ id: item.id, quantity: item.quantity, isBundle: item.isBundle }));
  localStorage.setItem('sanne_cart', JSON.stringify(sanitized));
  updateCartUI();
}

function addToCart(productData, qty = 1) {
  const prodId = productData.id || productData;
  const prod = products.find(p => p.id === prodId);
  if (!prod) return;

  const existing = cart.find(item => item.id === prod.id);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ id: prod.id, quantity: qty, isBundle: !!prod.isBundle || prod.id === 'bundle_ritual' });
  }
  saveCart();
  openCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
}

function updateQty(id, change) {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.quantity += change;
    if (item.quantity <= 0) removeFromCart(id);
    else saveCart();
  }
}

window.switchToRitualBundle = function() {
  cart = cart.filter(item => item.id !== 'p3' && item.id !== 'p4');
  cart.push({ id: 'bundle_ritual', quantity: 1, isBundle: true });
  saveCart();
};

const cartNav = document.getElementById('nav-cart');
const mobileCart = document.getElementById('mobile-cart');
const cartOverlay = document.getElementById('cart-overlay');
const closeCart = document.getElementById('close-cart');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartFooter = document.getElementById('cart-footer');
const cartTotalPrice = document.getElementById('cart-total-price');
const cartBadge = document.getElementById('cart-badge');
const addBtns = document.querySelectorAll('.add-to-cart-btn');

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartBadge) cartBadge.textContent = `(${totalItems})`;
  
  if (!cartItemsContainer) return;
  
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<p class="empty-cart-msg text-center mt-md" style="color: var(--color-text-light);">Your cart is empty.</p>';
    if (cartFooter) cartFooter.style.display = 'none';
  } else {
    const donationVal = parseFloat(document.getElementById('sidebar-donation-amount')?.value || document.getElementById('checkout-donation-amount')?.value) || 0;
    const totals = window.PricingEngine 
      ? window.PricingEngine.calculateCartTotals(cart, donationVal, 50)
      : { subtotalEgp: '0 EGP', finalTotalEgp: '0 EGP', discountEgp: '0 EGP', shouldRecommendRitualBundle: false };

    cartItemsContainer.innerHTML = cart.map(item => {
      const prod = products.find(p => p.id === item.id);
      if (!prod) return '';

      return `
        <div class="cart-item" style="display: flex; gap: 1rem; margin-bottom: 1.2rem; align-items: center;">
          <img src="${prod.image}" alt="${prod.name}" style="width: 75px; height: 75px; object-fit: cover; border-radius: 4px;">
          <div style="flex: 1;">
            <h4 style="font-family: var(--font-serif); font-size: 1.05rem; margin: 0; color: var(--color-dark-brown);">${prod.name}</h4>
            <p style="font-size: 0.82rem; color: var(--color-text-light); margin: 0 0 0.3rem 0;">${prod.variant}</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 600; color: var(--color-dark-brown);">${prod.price} EGP</span>
              <div style="display: flex; align-items: center; border: 1px solid var(--color-border); border-radius: 4px;">
                <button onclick="updateQty('${item.id}', -1)" style="background: none; border: none; padding: 0.2rem 0.5rem; cursor: pointer;">-</button>
                <span style="font-size: 0.9rem; padding: 0 0.4rem;">${item.quantity}</span>
                <button onclick="updateQty('${item.id}', 1)" style="background: none; border: none; padding: 0.2rem 0.5rem; cursor: pointer;">+</button>
              </div>
            </div>
          </div>
          <button onclick="removeFromCart('${item.id}')" style="background: none; border: none; color: var(--color-text-light); font-size: 1.2rem; cursor: pointer;">&times;</button>
        </div>
      `;
    }).join('');

    // Render Anti-286.20 Bundle Recommendation Banner if separate items exist
    if (totals.shouldRecommendRitualBundle) {
      cartItemsContainer.insertAdjacentHTML('beforeend', `
        <div style="background: var(--color-cream); border: 1px solid var(--color-soft-gold); border-radius: 6px; padding: 0.9rem; margin-top: 1rem; text-align: center;">
          <p style="font-family: var(--font-serif); font-size: 0.95rem; color: var(--color-dark-brown); margin: 0 0 0.2rem; font-weight: 600;">Complete your order as The Sanné Ritual</p>
          <p style="font-size: 0.82rem; color: var(--color-text-light); margin: 0 0 0.6rem;">Get both Makhmarya & Body Splash together for 299 EGP</p>
          <button onclick="switchToRitualBundle()" style="background: var(--color-soft-brown); color: #fff; border: none; padding: 0.4rem 0.9rem; border-radius: 4px; font-size: 0.8rem; font-weight: 500; cursor: pointer;">Switch to The Sanné Ritual</button>
        </div>
      `);
    }
    
    if (cartFooter) cartFooter.style.display = 'block';
    if (cartTotalPrice) cartTotalPrice.textContent = totals.finalTotalEgp;

    const breakdownEl = document.getElementById('cart-breakdown');
    if (breakdownEl) {
      breakdownEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--color-text-light);margin-bottom:0.3rem;"><span>Subtotal</span><span>${totals.subtotalEgp}</span></div>
        ${totals.isLaunchEligible ? `<div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--color-soft-gold);margin-bottom:0.3rem;"><span>Opening Offer (-10%)</span><span>-${totals.discountEgp}</span></div>` : ''}
        ${donationVal > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--color-soft-gold);margin-bottom:0.3rem;"><span>Sana's Light Donation</span><span>${totals.donationEgp}</span></div>` : ''}
      `;
    }
  }

  if (window.PricingEngine && typeof window.PricingEngine.renderDynamicPrices === 'function') {
    window.PricingEngine.renderDynamicPrices();
  }
}

function openCart(e) {
  if (e) e.preventDefault();
  if (cartOverlay) cartOverlay.classList.add('active');
  if (mobileMenu && mobileMenu.classList.contains('active')) {
    mobileMenu.classList.remove('active');
    if (hamburger) hamburger.classList.remove('active');
  }
}

function closeCartOverlay() {
  if (cartOverlay) cartOverlay.classList.remove('active');
}

if (cartNav) cartNav.addEventListener('click', openCart);
if (mobileCart) mobileCart.addEventListener('click', openCart);
if (closeCart) closeCart.addEventListener('click', closeCartOverlay);

addBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (card) {
      const id = card.getAttribute('data-id');
      const product = products.find(p => p.id === id);
      if (product) addToCart(product);
    }
  });
});

updateCartUI(); // Init cart UI

// 5. Checkout Handler
const checkoutForm = document.getElementById('checkout-form');
if (checkoutForm) {
  checkoutForm.addEventListener('submit', async (e) => {
    const nameEl = document.getElementById('checkout-name');
    if (!nameEl) return;

    e.preventDefault();
    if (cart.length === 0) return;

    const name = nameEl.value.trim();
    const phone = document.getElementById('checkout-phone').value.trim();
    const whatsapp = document.getElementById('checkout-whatsapp')?.value.trim() || phone;
    const city = document.getElementById('checkout-city').value.trim();
    const address = document.getElementById('checkout-address').value.trim();
    const paymentMethod = document.getElementById('checkout-payment-method')?.value || 'Cash';

    const donationAmt = Math.max(0, parseFloat(document.getElementById('sidebar-donation-amount')?.value || document.getElementById('checkout-donation-amount')?.value) || 0);

    const idempotencyKey = 'IDEM_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();

    const checkoutPayload = {
      idempotency_key: idempotencyKey,
      items: cart,
      customer_name: name,
      customer_phone: phone,
      customer_whatsapp: whatsapp,
      city: city,
      address: address,
      payment_method: paymentMethod,
      donation_amount: donationAmt
    };

    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing Order...';
    }

    try {
      // 1. Submit to Supabase create_order RPC
      const dbResult = await window.OrdersService.submitOrder(checkoutPayload);

      // 2. Format WhatsApp confirmation message from AUTHORITATIVE RETURNED DTO
      const whatsappMsg = window.PricingEngine.buildWhatsAppMessage(dbResult);

      const whatsappUrl = `https://wa.me/201032138278?text=${encodeURIComponent(whatsappMsg)}`;

      // Clear Cart
      cart = [];
      saveCart();

      // Show Success Message & Redirect to WhatsApp
      const successEl = document.getElementById('checkout-success-msg');
      if (successEl) {
        successEl.style.display = 'block';
        successEl.textContent = `Order placed successfully! Opening WhatsApp...`;
      }

      setTimeout(() => {
        window.open(whatsappUrl, '_blank');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Complete Order';
        }
      }, 600);

    } catch (err) {
      console.error('Checkout error:', err);
      alert(`Checkout Error: ${err.message || 'Could not complete order.'}`);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Complete Order';
      }
    }
  });
}
