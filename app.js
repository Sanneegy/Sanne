// Sanné Main JS

// 1. Navigation & Mobile Menu
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
  });
}

// 2. Product Data — single source of truth for all filters, search, cart, and AI
const products = [
  {
    id: 'p1',
    name: 'Moisturizing Cream',
    variant: 'For Dry Skin',
    fullName: 'Moisturizing Cream for Dry Skin',
    category: 'moisturizer',
    skinType: 'dry',
    price: 229,
    oldPrice: 279,
    image: 'images/dry_skin.jpg',
    hover_image: 'images/hover_dry_skin_1778922108728.png',
    desc: 'Rich moisture for healthy looking skin, with jojoba oil, sweet almond oil, ceramide NP, and hyaluronic acid.',
    isBestSeller: false,
    isFragrance: false,
    isMoisturizer: true,
    concerns: ['dry', 'flaky', 'tight', 'rough', 'dehydrated', 'dull', 'lacking moisture'],
    keywords: ['dry skin', 'moisturizer', 'moisturizing cream', 'cream', 'hydration', 'jojoba', 'ceramide', 'hyaluronic acid', 'flaky', 'tight', 'rough', 'dehydrated']
  },
  {
    id: 'p2',
    name: 'Moisturizing Cream',
    variant: 'For Oily and Combination Skin',
    fullName: 'Moisturizing Cream for Oily and Combination Skin',
    category: 'moisturizer',
    skinType: 'oily',
    price: 229,
    oldPrice: 279,
    image: 'images/oily_skin.jpg',
    hover_image: 'images/hover_oily_skin_1778922300593.png',
    desc: 'Lightweight daily moisture that supports skin barrier comfort, with naturally derived lipids and soothing extracts.',
    isBestSeller: true,
    isFragrance: false,
    isMoisturizer: true,
    concerns: ['oily', 'shiny', 'greasy', 'combination', 'T-zone', 'acne-prone', 'pores', 'heavy cream sensitivity'],
    keywords: ['oily skin', 'combination skin', 'moisturizer', 'moisturizing cream', 'lightweight', 'non greasy', 'shiny', 'greasy', 'T-zone', 'acne']
  },
  {
    id: 'p3',
    name: 'Bosbos Body Fragrance',
    variant: 'Makhmarya',
    fullName: 'Bosbos Body Fragrance — Makhmarya',
    category: 'body fragrance',
    skinType: 'all',
    price: 89,
    oldPrice: 89,
    image: 'images/bosbos.jpg',
    hover_image: 'images/bosbos_hover.png',
    desc: 'A warm body fragrance made to leave the skin softly scented and beautifully cared for.',
    isBestSeller: true,
    isFragrance: true,
    isMoisturizer: false,
    concerns: ['scent', 'fragrance', 'body care', 'gifting', 'everyday ritual', 'makhmarya'],
    keywords: ['bosbos', 'body fragrance', 'makhmarya', 'scent', 'scented', 'perfume', 'fragrance', 'body care', 'gift']
  },
  {
    id: 'p4',
    name: 'Rose Vanille Body Splash',
    variant: '220 ml',
    fullName: 'Rose Vanille Body Splash — 220 ml',
    category: 'body fragrance',
    skinType: 'all',
    price: 229,
    oldPrice: 229,
    image: 'images/rose_vanille.jpg',
    hover_image: 'images/hover_rose_vanille.jpg',
    desc: 'A refreshing and long-lasting body fragrance mist with delicate rose and warm vanilla notes for your daily scent ritual.',
    isBestSeller: false,
    isFragrance: true,
    isMoisturizer: false,
    concerns: ['scent', 'fragrance', 'body splash', 'mist', 'rose', 'vanilla', 'refreshing', 'spray', '220 ml'],
    keywords: ['body splash', 'rose vanille', 'rose vanilla', 'fragrance mist', 'body fragrance', 'spray', 'scented', 'perfume', 'rose', 'vanilla', 'body scent', 'mist', '220 ml', 'splash']
  },
  {
    id: 'bundle_ritual',
    name: 'The Sanné Ritual',
    variant: 'Rose Vanille Body Splash + Bosbos Makhmarya',
    fullName: 'The Sanné Ritual — Body Splash + Makhmarya Set',
    category: 'body fragrance',
    skinType: 'all',
    price: 280,
    oldPrice: 318,
    image: 'images/bundle_ritual_default.jpg',
    hover_image: 'images/bundle_ritual_hover.jpg',
    desc: 'Two Rose Vanille essentials. One bundle price. Get both for 280 EGP instead of 318 EGP. Made to layer. Better together.',
    isBestSeller: true,
    isFragrance: true,
    isMoisturizer: false,
    isBundle: true,
    concerns: ['scent', 'fragrance', 'bundle', 'ritual', 'set', 'gift', 'makhmarya', 'body splash'],
    keywords: ['ritual', 'sanne ritual', 'bundle', 'set', 'gift set', 'rose vanille', 'makhmarya', 'bosbos', 'splash']
  }
];

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inject ASK SANNÉ and My Loves into navigation
  const navLeft = document.querySelector('.nav-left');
  if (navLeft && !document.querySelector('a[href="ask-sanne.html"]')) {
    navLeft.insertAdjacentHTML('beforeend', `<a href="ask-sanne.html" class="nav-link" style="font-weight: 500;">ASK SANNÉ</a>`);
  }
  const navRight = document.querySelector('.nav-right');
  if (navRight && !document.getElementById('nav-wishlist')) {
    const searchLink = document.getElementById('nav-search');
    if (searchLink) {
      searchLink.insertAdjacentHTML('afterend', `<a href="#" class="nav-link" id="nav-wishlist">MY LOVES ♡</a>`);
    }
  }

  // 2. Inject My Loves Overlay
  if (!document.getElementById('wishlist-overlay')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="wishlist-overlay" id="wishlist-overlay">
        <div class="wishlist-content">
          <button class="close-btn" id="close-wishlist">&times;</button>
          <h2 class="section-title mb-md">My Loves ♡</h2>
          <div id="wishlist-items-container" class="cart-items-container">
            <p class="empty-cart-msg text-center mt-md">Your list of loves is empty.</p>
          </div>
        </div>
      </div>
    `);
  }

  // 3. Update Product Cards & Inject Heart Icons
  document.querySelectorAll('.product-card').forEach(card => {
    const id = card.getAttribute('data-id');
    const product = products.find(p => p.id === id);
    if (product) {
      card.setAttribute('data-name', product.name);
      card.setAttribute('data-variant', product.variant);
      card.setAttribute('data-price', product.price);
      
      const titleEl = card.querySelector('.product-title');
      if (titleEl) titleEl.textContent = product.name;
      
      const varEl = card.querySelector('.product-variant');
      if (varEl) varEl.textContent = product.variant;
      
      const descEl = card.querySelector('.product-desc');
      if (descEl) descEl.textContent = product.desc;
      
      const newPriceEl = card.querySelector('.price-new');
      if (newPriceEl) newPriceEl.textContent = `${product.price} EGP`;
      
      const oldPriceEl = card.querySelector('.price-old');
      if (oldPriceEl) oldPriceEl.textContent = `${product.oldPrice} EGP`;

      const imgContainer = card.querySelector('.product-image-container');
      if (imgContainer && !card.querySelector('.heart-btn')) {
        imgContainer.insertAdjacentHTML('beforeend', `
          <button class="heart-btn" onclick="toggleWishlist('${id}', this)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        `);
      }
    }
  });

  initWishlistLogic();
});

// 3. Search Logic
const searchNav = document.getElementById('nav-search');
const mobileSearch = document.getElementById('mobile-search');
const searchOverlay = document.getElementById('search-overlay');
const closeSearch = document.getElementById('close-search');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

function openSearch(e) {
  e.preventDefault();
  searchOverlay.classList.add('active');
  if (mobileMenu.classList.contains('active')) {
    mobileMenu.classList.remove('active');
    hamburger.classList.remove('active');
  }
  setTimeout(() => searchInput.focus(), 100);
}

function closeSearchOverlay() {
  searchOverlay.classList.remove('active');
  searchInput.value = '';
  searchResults.innerHTML = '';
}

if (searchNav) searchNav.addEventListener('click', openSearch);
if (mobileSearch) mobileSearch.addEventListener('click', openSearch);
if (closeSearch) closeSearch.addEventListener('click', closeSearchOverlay);

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
      searchResults.innerHTML = '';
      return;
    }
    
    const matches = products.filter(p => {
      return p.name.toLowerCase().includes(term) || 
             p.variant.toLowerCase().includes(term) || 
             p.keywords.some(k => k.includes(term));
    });
    
    if (matches.length === 0) {
      searchResults.innerHTML = '<p class="text-center" style="color: var(--color-text-light);">No products found.</p>';
    } else {
      searchResults.innerHTML = matches.map(p => `
        <div class="search-result-item" style="display: flex; gap: 1rem; margin-bottom: 1rem; align-items: center; cursor: pointer;" onclick="window.location.href='shop.html'">
          <img src="${p.image}" alt="${p.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
          <div>
            <h4 style="font-family: var(--font-serif); font-size: 1.1rem; color: var(--color-dark-brown); margin: 0;">${p.name}</h4>
            <p style="font-size: 0.85rem; color: var(--color-text-light); margin: 0;">${p.variant}</p>
            <p style="font-size: 0.9rem; font-weight: 500; color: var(--color-dark-brown); margin: 0;">${p.price} EGP</p>
          </div>
        </div>
      `).join('');
    }
  });
}

// 4. Cart Logic

// Normalize cart items from localStorage against the products catalogue
// Fixes NaN/undefined from legacy entries that only stored { id, quantity, isBundle }
function getNormalizedCart(rawCart) {
  return (rawCart || []).reduce((acc, item) => {
    const product = products.find(p => p.id === item.id);
    if (!product) return acc; // drop unresolvable entries
    const qty = parseInt(item.qty || item.quantity, 10) || 1;
    // Merge: product data wins for name/image/price; keep qty from stored entry
    const existing = acc.find(a => a.id === product.id);
    if (existing) {
      existing.qty += qty;
    } else {
      acc.push({ ...product, qty });
    }
    return acc;
  }, []);
}

let cart = getNormalizedCart(JSON.parse(localStorage.getItem('sanne_cart')) || []);
const cartNav = document.getElementById('nav-cart');
const mobileCart = document.getElementById('mobile-cart');
const cartOverlay = document.getElementById('cart-overlay');
const closeCart = document.getElementById('close-cart');
const cartBadge = document.getElementById('cart-count-badge');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartFooter = document.getElementById('cart-footer');
const cartTotalPrice = document.getElementById('cart-total-price');
const addBtns = document.querySelectorAll('.add-to-cart-btn');

function saveCart() {
  localStorage.setItem('sanne_cart', JSON.stringify(cart));
  updateCartUI();
}

function addToCart(productData, qty = 1) {
  const existing = cart.find(item => item.id === productData.id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ ...productData, qty: qty });
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
    item.qty += change;
    if (item.qty <= 0) removeFromCart(id);
    else saveCart();
  }
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  if (cartBadge) cartBadge.textContent = `(${totalItems})`;
  
  if (!cartItemsContainer) return;
  
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<p class="empty-cart-msg text-center mt-md" style="color: var(--color-text-light);">Your cart is empty.</p>';
    if (cartFooter) cartFooter.style.display = 'none';
  } else {
    const donation = parseInt(document.getElementById('sidebar-donation-amount')?.value, 10) || 0;
    const totals = window.PricingEngine ? window.PricingEngine.calculateCartTotals(cart, donation, 0) : null;
    const isLaunchEligible = totals ? totals.isLaunchEligible : false;

    let subtotal = 0;
    cartItemsContainer.innerHTML = cart.map(item => {
      let unitPriceDisplay = `${item.price} EGP`;
      let lineTotal = item.price * item.qty;

      if (isLaunchEligible && cart.length === 1 && (item.id === 'p3' || item.id === 'p4')) {
        const discUnit = item.id === 'p3' ? '80.10 EGP' : '206.10 EGP';
        lineTotal = item.id === 'p3' ? 80.10 : 206.10;
        unitPriceDisplay = `<span style="text-decoration:line-through;color:var(--color-text-light);margin-right:0.3rem;font-size:0.85em;">${item.price} EGP</span><span style="font-weight:600;color:var(--color-dark-brown);">${discUnit}</span>`;
      }
      subtotal += lineTotal;

      return `
        <div class="cart-item" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; align-items: center;">
          <img src="${item.image}" alt="${item.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">
          <div style="flex: 1;">
            <h4 style="font-family: var(--font-serif); font-size: 1.1rem; margin: 0; color: var(--color-dark-brown);">${item.name}</h4>
            <p style="font-size: 0.85rem; color: var(--color-text-light); margin: 0 0 0.5rem 0;">${item.variant}</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 500;">${unitPriceDisplay}</span>
              <div style="display: flex; align-items: center; border: 1px solid var(--color-border); border-radius: 4px;">
                <button onclick="updateQty('${item.id}', -1)" style="background: none; border: none; padding: 0.2rem 0.6rem; cursor: pointer;">-</button>
                <span style="font-size: 0.9rem; padding: 0 0.5rem;">${item.qty}</span>
                <button onclick="updateQty('${item.id}', 1)" style="background: none; border: none; padding: 0.2rem 0.6rem; cursor: pointer;">+</button>
              </div>
            </div>
          </div>
          <button onclick="removeFromCart('${item.id}')" style="background: none; border: none; color: var(--color-text-light); font-size: 1.2rem; cursor: pointer;">&times;</button>
        </div>
      `;
    }).join('');
    
    if (cartFooter) cartFooter.style.display = 'block';
    
    const origSubtotal = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const discountAmt = totals ? totals.discountPiastres / 100 : 0;
    const grandTotal = (origSubtotal - discountAmt) + donation;

    if (cartTotalPrice) cartTotalPrice.textContent = `${grandTotal.toFixed(2).replace(/\.00$/, '')} EGP`;
    
    const breakdownEl = document.getElementById('cart-breakdown');
    if (breakdownEl) {
      breakdownEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--color-text-light);margin-bottom:0.3rem;"><span>Subtotal</span><span>${origSubtotal} EGP</span></div>
        ${discountAmt > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#8A333C;font-weight:600;margin-bottom:0.3rem;"><span>10% Launch Discount</span><span>-${discountAmt.toFixed(2)} EGP</span></div>` : ''}
        ${donation > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--color-soft-gold);margin-bottom:0.3rem;"><span>Donation</span><span>${donation} EGP</span></div>` : ''}
      `;
    }
  }
}

function openCart(e) {
  if(e) e.preventDefault();
  cartOverlay.classList.add('active');
  if (mobileMenu.classList.contains('active')) {
    mobileMenu.classList.remove('active');
    hamburger.classList.remove('active');
  }
}

function closeCartOverlay() {
  cartOverlay.classList.remove('active');
  // Clear customer form inputs but keep cart products
  const checkoutFormEl = document.getElementById('checkout-form');
  if (checkoutFormEl) checkoutFormEl.reset();
  const successEl = document.getElementById('checkout-success-msg');
  if (successEl) successEl.style.display = 'none';
  const donationInput = document.getElementById('sidebar-donation-amount');
  if (donationInput) donationInput.value = '';
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

// 5. Checkout Logic (Document-level event delegation for guaranteed listener binding)
document.addEventListener('submit', (e) => {
  const checkoutFormEl = e.target.closest('#checkout-form');
  if (!checkoutFormEl) return;

  const nameEl = document.getElementById('checkout-name');
  if (!nameEl) return;

  e.preventDefault();
  
  if (cart.length === 0) return;
    
    const name = nameEl.value;
    const phone = document.getElementById('checkout-phone').value;
    const whatsapp = document.getElementById('checkout-whatsapp').value || phone;
    const city = document.getElementById('checkout-city').value;
    const address = document.getElementById('checkout-address').value;
    const notes = document.getElementById('checkout-notes').value;

    const deliveryFees = {
      "Belbeis": 15, "Zagazig": 25, "10th of Ramadan": 30, "Cairo": 45, "Alex": 50,
      "Ismailia": 45, "Aswan": 95, "Assiut": 80, "Luxor": 95, "Red Sea": 90,
      "Beheira": 50, "Giza": 45, "Dakahlia": 45, "Suez": 50, "Gharbia": 45,
      "Fayoum": 50, "Menoufia": 45, "Minya": 75, "New Valley": 95, "Beni Suef": 55,
      "Port Said": 50, "South Sinai": 70, "Damietta": 50, "Sohag": 90, "North Sinai": 55,
      "Qena": 95, "Kafr El Sheikh": 50, "Matrouh": 80, "Sharqiyah": 40
    };
    const deliveryFee = deliveryFees[city] || 0;
    
    const donationAmt = Math.max(0, parseInt(document.getElementById('sidebar-donation-amount')?.value || document.getElementById('checkout-donation-amount')?.value, 10) || 0);
    const totals = window.PricingEngine ? window.PricingEngine.calculateCartTotals(cart, donationAmt, deliveryFee) : null;
    const isEligible = totals ? totals.isLaunchEligible : false;
    const discountAmt = totals ? totals.discountPiastres / 100 : 0;
    const baseSubtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const grandTotal = (baseSubtotal - discountAmt) + deliveryFee + donationAmt;
    const orderId = 'SANNE-' + Math.random().toString(36).substr(2, 6).toUpperCase();

    let orderLines = '';
    cart.forEach(item => {
      if (isEligible && (item.id === 'p3' || item.id === 'p4')) {
        const discUnit = item.id === 'p3' ? 80.10 : 206.10;
        const discVal = item.id === 'p3' ? 8.90 : 22.90;
        orderLines += `• ${item.name} (${item.variant}) × ${item.qty}\n  Regular Price: ${item.price.toFixed(2)} EGP\n  Launch Discount: -${discVal.toFixed(2)} EGP\n  Final Product Price: ${discUnit.toFixed(2)} EGP\n`;
      } else {
        orderLines += `• ${item.name} (${item.variant}) × ${item.qty} (${item.price.toFixed(2)} EGP)\n`;
      }
    });

    const orderItemsPayload = cart.map(item => {
      const discVal = (isEligible && (item.id === 'p3' || item.id === 'p4')) ? (item.id === 'p3' ? 8.90 : 22.90) : 0;
      return {
        product_id: item.id,
        product_name: `${item.name} (${item.variant || ''})`.trim(),
        unit_price_egp: Number(item.price),
        discount_amount_egp: discVal,
        quantity: Number(item.qty),
        line_total_egp: Number(item.price - discVal) * Number(item.qty)
      };
    });

    const orderPayload = {
      order_number: orderId,
      customer: { name, phone, whatsapp, city, address, notes },
      product_subtotal_egp: baseSubtotal,
      delivery_fee_egp: deliveryFee,
      discount_egp: discountAmt,
      donation_egp: donationAmt,
      final_total_egp: grandTotal,
      items: orderItemsPayload
    };

    console.log("LIVE CART USED FOR CHECKOUT", cart);
    console.log("DONATION INPUT VALUE", donationAmt);
    console.log("ORDER PAYLOAD", orderPayload);
    console.log("ORDER ITEMS PAYLOAD", orderItemsPayload);

    const submitBtn = document.querySelector('#checkout-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';
    }

    const messageBody = `Hello Sanné 🌿 I'd like to place an order.

Order ID: ${orderId}

*Order Details:*
${orderLines}
*Subtotal:* ${baseSubtotal.toFixed(2)} EGP
${discountAmt > 0 ? `*Launch Discount:* -${discountAmt.toFixed(2)} EGP\n` : ''}*Delivery Fee:* ${deliveryFee.toFixed(2)} EGP
${donationAmt > 0 ? `*Donation:* ${donationAmt.toFixed(2)} EGP\n` : ''}*Total:* ${grandTotal.toFixed(2)} EGP
*Payment Method:* Cash or Instapay

*Customer Details:*
Name: ${name}
Phone: ${phone}
WhatsApp: ${whatsapp}
City: ${city}
Address: ${address}
${notes ? `Notes: ${notes}` : ''}`;

    const encodedMsg = encodeURIComponent(messageBody);
    const whatsappUrl = `https://wa.me/201032138278?text=${encodedMsg}`;

    (async () => {
      try {
        console.log("BEFORE SUPABASE INSERT", orderPayload);
        if (window.OrdersService && typeof window.OrdersService.submitOrder === 'function') {
          await window.OrdersService.submitOrder(orderPayload);
        }

        // Show success message
        const successEl = document.getElementById('checkout-success-msg');
        if (successEl) {
          successEl.style.display = 'block';
          successEl.textContent = `Order ${orderId} submitted (pending confirmation)! Opening WhatsApp...`;
        }

        if (checkoutFormEl) checkoutFormEl.reset();
        cart = [];
        saveCart();

        // Open WhatsApp ONLY after database insert succeeds
        setTimeout(() => {
          console.log("BEFORE WHATSAPP REDIRECT", whatsappUrl);
          window.open(whatsappUrl, '_blank');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Complete Order';
          }
        }, 800);

      } catch (err) {
        console.error('Order submission failed:', err);
        alert(`Order Submission Error: ${err.message || 'Could not save order to database.'}`);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Complete Order';
        }
      }
    })();
  });

// Make functions global for inline onclick handlers
window.updateQty = updateQty;
window.removeFromCart = removeFromCart;

// 6. Values Hover Logic (About Page)
const valueItems = document.querySelectorAll('.value-item');
const valueImgs = document.querySelectorAll('.value-img');

if (valueItems.length > 0) {
  valueItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      const targetId = item.getAttribute('data-target');
      
      valueItems.forEach(v => v.classList.remove('active'));
      valueImgs.forEach(img => img.classList.remove('active'));
      
      item.classList.add('active');
      const targetImg = document.getElementById(targetId);
      if (targetImg) targetImg.classList.add('active');
    });
  });
}

// 7. Wishlist Logic
let wishlist = JSON.parse(localStorage.getItem('sanne_wishlist')) || [];

window.initWishlistLogic = function() {
  const wishlistNav = document.getElementById('nav-wishlist');
  const wishlistOverlay = document.getElementById('wishlist-overlay');
  const closeWishlistBtn = document.getElementById('close-wishlist');

  if (wishlistNav) {
    wishlistNav.addEventListener('click', (e) => {
      e.preventDefault();
      wishlistOverlay.classList.add('active');
    });
  }

  if (closeWishlistBtn) {
    closeWishlistBtn.addEventListener('click', () => {
      wishlistOverlay.classList.remove('active');
    });
  }

  // Restore heart button states on load
  document.querySelectorAll('.heart-btn').forEach(btn => {
    const card = btn.closest('.product-card');
    if (card) {
      const id = card.getAttribute('data-id');
      if (wishlist.includes(id)) {
        btn.classList.add('active');
      }
    }
  });

  updateWishlistUI();
};

window.toggleWishlist = function(id, btn) {
  if (wishlist.includes(id)) {
    wishlist = wishlist.filter(itemId => itemId !== id);
    btn.classList.remove('active');
  } else {
    wishlist.push(id);
    btn.classList.add('active');
  }
  localStorage.setItem('sanne_wishlist', JSON.stringify(wishlist));
  updateWishlistUI();
};

window.removeFromWishlist = function(id) {
  wishlist = wishlist.filter(itemId => itemId !== id);
  localStorage.setItem('sanne_wishlist', JSON.stringify(wishlist));
  
  // Un-heart on page if visible
  const card = document.querySelector(`.product-card[data-id="${id}"]`);
  if (card) {
    const btn = card.querySelector('.heart-btn');
    if (btn) btn.classList.remove('active');
  }
  updateWishlistUI();
};

window.addFromWishlistToCart = function(id) {
  const product = products.find(p => p.id === id);
  if (product) {
    addToCart(product, 1);
  }
};

function updateWishlistUI() {
  const container = document.getElementById('wishlist-items-container');
  if (!container) return;

  if (wishlist.length === 0) {
    container.innerHTML = '<p class="empty-cart-msg text-center mt-md" style="color: var(--color-text-light);">Your wishlist is empty.</p>';
  } else {
    container.innerHTML = wishlist.map(id => {
      const item = products.find(p => p.id === id);
      if (!item) return '';
      return `
        <div class="cart-item" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; align-items: center;">
          <img src="${item.image}" alt="${item.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">
          <div style="flex: 1;">
            <h4 style="font-family: var(--font-serif); font-size: 1.1rem; margin: 0; color: var(--color-dark-brown);">${item.name}</h4>
            <p style="font-size: 0.85rem; color: var(--color-text-light); margin: 0 0 0.5rem 0;">${item.variant}</p>
            <span style="font-weight: 500;">${item.price} EGP</span>
            <button class="btn btn-primary" onclick="addFromWishlistToCart('${item.id}')" style="display: block; width: 100%; margin-top: 0.5rem; padding: 0.5rem; font-size: 0.8rem;">Add to Cart</button>
          </div>
          <button onclick="removeFromWishlist('${item.id}')" style="background: none; border: none; color: var(--color-text-light); font-size: 1.2rem; cursor: pointer; align-self: flex-start;">&times;</button>
        </div>
      `;
    }).join('');
  }
}

// 8. Lightbox Logic
function initLightbox() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  if (!document.getElementById('lightbox')) {
    if (document.body && document.body.insertAdjacentHTML) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="lightbox" id="lightbox">
          <button class="lightbox-close" id="lightbox-close">&times;</button>
          <img src="" id="lightbox-img" alt="Review">
        </div>
      `);
      
      const closeBtn = document.getElementById('lightbox-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          document.getElementById('lightbox')?.classList.remove('active');
        });
      }
      
      const lb = document.getElementById('lightbox');
      if (lb) {
        lb.addEventListener('click', (e) => {
          if (e.target.id === 'lightbox') {
            lb.classList.remove('active');
          }
        });
      }
    }
  }
}
window.initLightbox = initLightbox;

window.openLightbox = function(src) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (img) img.src = src;
  if (lightbox) lightbox.classList.add('active');
};

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', initLightbox);
}

// 9. Category Filter Pills (Shop page)
function initCategoryFilter() {
  const pills = document.querySelectorAll('.category-pills .pill');
  if (!pills.length) return;

  function filterProducts(filter) {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.product-card'));
    let visibleCount = 0;

    cards.forEach(card => {
      const id = card.getAttribute('data-id');
      const product = products.find(p => p.id === id);
      if (!product) { card.style.display = 'none'; return; }

      let show = false;
      if (filter === 'all') {
        show = true;
      } else if (filter === 'moisturizer') {
        show = product.isMoisturizer === true;
      } else if (filter === 'fragrance') {
        show = product.isFragrance === true;
      } else if (filter === 'bestseller') {
        show = product.isBestSeller === true;
      }
      card.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    // Prevent cards from stretching when only 1 result
    if (visibleCount === 1) {
      grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
      // On small screens just let it be single column naturally
      if (window.innerWidth <= 768) grid.style.gridTemplateColumns = '1fr';
    } else if (visibleCount === 2) {
      grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    } else {
      grid.style.gridTemplateColumns = '';
    }
  }

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const label = pill.textContent.trim().toLowerCase();
      if (label === 'shop all') filterProducts('all');
      else if (label === 'moisturizers') filterProducts('moisturizer');
      else if (label === 'body fragrance') filterProducts('fragrance');
      else if (label === 'best sellers') filterProducts('bestseller');
    });
  });
}

document.addEventListener('DOMContentLoaded', initCategoryFilter);
