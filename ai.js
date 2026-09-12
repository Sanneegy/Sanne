/**
 * ai.js — Sanné Conversational AI Advisor
 *
 * Single Source of Truth for Product Identity & Cards: window.products (from app.js)
 * Conversational State Model:
 *   - state = { currentProductId, candidateProductIds, lastIntent, pendingIntent, pendingClarification, activeConstraints }
 * Dual-Engine Architecture:
 *   - Remote Path: Supabase Edge Function (sanne-chat) + OpenAI GPT-4o-mini
 *   - Fallback Path: Stateful local recommendation & guardrail engine
 */

(function(window) {
  'use strict';

  const SUPABASE_EDGE_URL = 'https://kqvoediolbpyvwpvbhty.supabase.co/functions/v1/sanne-chat';
  const SUPABASE_ANON_KEY = 'sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst';

  let chatHistory = [];
  let state = {
    currentProductId: null,
    candidateProductIds: [],
    lastIntent: null,
    pendingIntent: null,
    pendingClarification: null,
    activeConstraints: {
      skinType: null,
      budgetMax: null,
      category: null
    }
  };

  let isWaiting = false;

  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chat-input');
    if (!input) return;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window.sendMessage();
      }
    });

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
  });

  window.sendQuickPrompt = function(btn) {
    const text = btn.textContent.trim();
    const input = document.getElementById('chat-input');
    if (input) input.value = text;
    
    const qp = document.getElementById('quick-prompts');
    if (qp) qp.style.display = 'none';
    
    window.sendMessage();
  };

  /**
   * Main Send Message Function
   */
  window.sendMessage = async function() {
    if (isWaiting) return;

    const input = document.getElementById('chat-input');
    const text = (input?.value || '').trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';
    input.style.height = 'auto';

    const qp = document.getElementById('quick-prompts');
    if (qp) qp.style.display = 'none';

    showTyping();
    isWaiting = true;
    setSendDisabled(true);

    chatHistory.push({ role: 'user', content: text });

    try {
      let response = null;
      let engineType = 'remote';

      try {
        response = await callEdgeAI(chatHistory, state);
        console.log("ASK_SANNE_ENGINE=remote", response);
      } catch (e) {
        engineType = 'local-fallback';
        console.warn("ASK_SANNE_ENGINE=local-fallback", "Reason: " + e.message);
        response = localRecommendationEngine(text, chatHistory, state);
      }

      removeTyping();

      if (response && response.reply) {
        // Update state
        if (response.state) {
          state = { ...state, ...response.state };
        } else if (response.currentProductId) {
          state.currentProductId = response.currentProductId;
        }

        // Determine card rendering
        const showCards = shouldRenderCards(response.intent, response.productIds);
        const productCards = showCards ? renderProductCards(response.productIds || []) : null;

        appendMessage('ai', response.reply, productCards);
        chatHistory.push({ role: 'assistant', content: response.reply });
      } else {
        appendMessage('ai', "I can help with moisturizers, body fragrance, skin guidance, and pricing. Tell me your skin type or what you're looking for ♡");
      }

    } catch (err) {
      removeTyping();
      console.error('Advisor error:', err);
      appendMessage('ai', "I can help with moisturizers, body fragrance, skin guidance, and pricing. Tell me your skin type or what you're looking for ♡");
    }

    isWaiting = false;
    setSendDisabled(false);
  };

  /**
   * Call Remote Edge Function
   */
  async function callEdgeAI(history, currentState) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(SUPABASE_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        messages: history,
        state: currentState
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Edge Function HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  }

  function shouldRenderCards(intent, productIds) {
    if (!productIds || !productIds.length) return false;
    const noCardIntents = ['ingredient_question', 'size_question', 'purpose_question', 'follow_up', 'disclaimer'];
    if (intent && noCardIntents.includes(intent)) return false;
    return true;
  }

  /**
   * Stateful Local Engine (Fallback & Guardrails)
   * Covers: medical disclaimer, pending clarification, product identification,
   * delivery, payment, donation, brand, upcoming, orders, reviews, wishlist,
   * scent, layering, how-to-use, gifts, catalogue, ingredients, purpose,
   * price, size, bundle, budget, follow-up, comparison, skin-type, unknown-intent logger.
   */
  function localRecommendationEngine(query, history, currentState) {
    const q = query.toLowerCase().trim();
    let newState = JSON.parse(JSON.stringify(currentState || {
      currentProductId: null,
      candidateProductIds: [],
      lastIntent: null,
      pendingIntent: null,
      pendingClarification: null,
      activeConstraints: { skinType: null, budgetMax: null, category: null }
    }));

    // 1. MEDICAL / CURE DISCLAIMER
    if (/(cure|treat|heal|doctor|prescription|eczema|psoriasis|dermatitis|rosacea)/i.test(q)) {
      newState.lastIntent = 'disclaimer';
      return { reply: "Sann\u00e9 products provide gentle cosmetic daily care and moisture barrier support. For medical skin conditions, we recommend consulting a dermatologist \u2661", intent: "disclaimer", productIds: [], state: newState };
    }

    // 2. RESOLVE PENDING CLARIFICATION
    if (newState.pendingClarification === 'moisturizer_variant') {
      if (/dry|flaky|tight|\u0646\u0627\u0634\u0641\u0629|nashfa|jafa|gafa/i.test(q)) {
        newState.currentProductId = 'p1';
        newState.activeConstraints.skinType = 'dry';
      } else if (/oily|shiny|greasy|\u0628\u062a\u0632\u064a\u062a|dehniya|byzayt/i.test(q)) {
        newState.currentProductId = 'p2';
        newState.activeConstraints.skinType = 'oily';
      }
      if (newState.pendingIntent === 'ingredient_question' || newState.pendingIntent === 'formula') {
        newState.pendingIntent = null; newState.pendingClarification = null; newState.lastIntent = 'ingredient_question';
        return { reply: "The full ingredient details for our moisturizers are still being finalized for Ask Sann\u00e9 and will be available soon \u2661 I can still help you choose between the Dry Skin and Oily & Combination formulas based on what your skin needs.", intent: "ingredient_question", productIds: [], state: newState };
      }
    }

    // 3. PRODUCT IDENTIFICATION (Arabic/Franco-Arabic aliases included)
    const isMakhmarya = /makhmarya|makhmaria|makhmariah|bosbos|bosboss|bosbuss|\u0645\u062e\u0645\u0631\u064a\u0629|\u0628\u0635\u0628\u0635|el gel|the gel|3etr el gel|body gel|gel fragrance/i.test(q);
    const isSplash    = /body splash|rose vanille|rose vanilla|splash|mist|body mist|bespray|bspray|sparay|\u0631\u0648\u0632 \u0641\u0627\u0646\u064a\u0644|\u0633\u0628\u0644\u0627\u0634|\u0628\u0648\u062f\u064a \u0633\u0628\u0644\u0627\u0634|220\s?ml|el splash/i.test(q);
    const isRitual    = /ritual|the ritual|sann[e\u00e9] ritual|bundle|el set|el combo|combo|\u0643\u0648\u0645\u0628\u0648|\u0645\u062c\u0645\u0648\u0639\u0629|el routine|both products/i.test(q);
    const isDryCream  = /dry skin (?:cream|moisturizer)|cream for dry skin|dry moisturizer|\u0643\u0631\u064a\u0645 \u0627\u0644\u0628\u0634\u0631\u0629 \u0627\u0644\u062c\u0627\u0641\u0629|\u0643\u0631\u064a\u0645 \u0644\u0644\u0628\u0634\u0631\u0629 \u0627\u0644\u062c\u0627\u0641\u0629/i.test(q);
    const isOilyCream = /oily skin (?:cream|moisturizer)|cream for oily skin|oily moisturizer|combination cream|\u0643\u0631\u064a\u0645 \u0644\u0644\u0628\u0634\u0631\u0629 \u0627\u0644\u062f\u0647\u0646\u064a\u0629/i.test(q);

    if (isMakhmarya)      { newState.currentProductId = 'p3'; newState.candidateProductIds = ['p3']; }
    else if (isSplash)    { newState.currentProductId = 'p4'; newState.candidateProductIds = ['p4']; }
    else if (isRitual)    { newState.currentProductId = 'bundle_ritual'; newState.candidateProductIds = ['bundle_ritual']; }
    else if (isDryCream)  { newState.currentProductId = 'p1'; newState.candidateProductIds = ['p1']; }
    else if (isOilyCream) { newState.currentProductId = 'p2'; newState.candidateProductIds = ['p2']; }

    // 4. DELIVERY
    if (/delivery|\u062a\u0648\u0635\u064a\u0644|tasleem|taysel|shipping|ship|dawwer|how long|how many days|\u0643\u0627\u0645 \u064a\u0648\u0645|\u0645\u062a\u0649 \u064a\u0648\u0635\u0644|when will|arrival|arrive/i.test(q)) {
      newState.lastIntent = 'delivery_question';
      if (/fee|cost|price|how much|\u0628\u0643\u0627\u0645|kam|\u0633\u0639\u0631 \u0627\u0644\u062a\u0648\u0635\u064a\u0644/i.test(q)) {
        return { reply: "Delivery fees are calculated automatically at checkout based on your city \u2661 Just add your items and enter your address.", intent: "delivery_question", productIds: [], state: newState };
      }
      return { reply: "We deliver across Egypt \u2661 Fees are shown at checkout based on your city, and delivery typically takes 2\u20135 business days depending on your governorate.", intent: "delivery_question", productIds: [], state: newState };
    }

    // 5. PAYMENT
    if (/pay|payment|cash|cod|instapay|inta ?pay|inta2pay|visa|mastercard|card|online pay|\u0627\u062f\u0641\u0639|\u0628\u064a\u062a\u0645 \u0627\u0644\u062f\u0641\u0639|\u0628\u0627\u062f\u0641\u0639/i.test(q)) {
      newState.lastIntent = 'payment_question';
      return { reply: "We accept Cash on Delivery (COD) and Instapay only. No credit cards or online gateways \u2014 simple and secure \u2661", intent: "payment_question", productIds: [], state: newState };
    }

    // 6. SANA'S LIGHT / DONATION
    if (/sanas? light|donation|donate|charity|community giving|\u062a\u0628\u0631\u0639|\u062e\u064a\u0631/i.test(q)) {
      newState.lastIntent = 'donation_question';
      return { reply: "Sana\u2019s Light is Sann\u00e9\u2019s community giving initiative \u2661 A portion of every order goes toward causes we believe in \u2014 so every purchase does a little more.", intent: "donation_question", productIds: [], state: newState };
    }

    // 7. BRAND STORY
    if (/who is sann[e\u00e9]|what is sann[e\u00e9]|about sann[e\u00e9]|brand story|20 years|egyptian brand|tell me about/i.test(q)) {
      newState.lastIntent = 'brand_story';
      return { reply: "Sann\u00e9 is an Egyptian beauty brand rooted in a 20-year legacy of skincare and fragrance. Our Rose Vanille collection is made to layer, designed to linger, and built around the belief that beauty is a daily ritual \u2661", intent: "brand_story", productIds: [], state: newState };
    }

    // 8. UPCOMING PRODUCTS
    if (/upcoming|new product|coming soon|what.?s next|future release|\u0642\u0627\u062f\u0645|\u062c\u062f\u064a\u062f|\u0647\u064a\u0637\u0644\u0639/i.test(q)) {
      newState.lastIntent = 'upcoming_question';
      return { reply: "We have more exciting things in development \u2661 Stay tuned \u2014 follow us for the first look.", intent: "upcoming_question", productIds: [], state: newState };
    }

    // 9. ORDER STATUS
    if (/order status|where is my order|track my order|\u062a\u062a\u0628\u0639|\u0623\u0648\u0631\u062f\u0631|my order|\u0637\u0644\u0628\u064a|\u0644\u0633\u0647 \u062c\u0647/i.test(q)) {
      newState.lastIntent = 'order_question';
      return { reply: "I can\u2019t look up live order status here \u2014 for the fastest help, reach us on WhatsApp and we\u2019ll track it for you right away \u2661", intent: "order_question", productIds: [], state: newState };
    }

    // 10. REVIEWS
    if (/review|reviews|\u062a\u0642\u064a\u064a\u0645|\u062a\u0642\u064a\u064a\u0645\u0627\u062a|rating|leave a review/i.test(q)) {
      newState.lastIntent = 'review_question';
      return { reply: "You can leave a review on each product page \u2014 we love hearing from you \u2661", intent: "review_question", productIds: [], state: newState };
    }

    // 11. MY LOVES / WISHLIST
    if (/my loves|wishlist|wish list|\u062d\u0628\u0627\u064a\u0628\u064a|saved items|favourite|favorite/i.test(q)) {
      newState.lastIntent = 'wishlist_question';
      return { reply: "Your My Loves \u2661 are saved on the website \u2014 tap the heart on any product to save it, and access your list from the nav bar.", intent: "wishlist_question", productIds: [], state: newState };
    }

    // 12. SCENT
    if (/scent|smell|how does it smell|\u0631\u064a\u062d\u062a\u0647|\u0628\u062a\u062a\u0639\u0637\u0631|perfume|\u0639\u0637\u0631|what does it smell|reeh|rih/i.test(q)) {
      newState.lastIntent = 'scent_question';
      if (newState.currentProductId === 'p3' || isMakhmarya) return { reply: "Makhmarya is warm, velvety, and intimate \u2014 a musky rose-vanilla with depth. Think of it as a skin-scent that lingers beautifully at pulse points \u2661", intent: "scent_question", productIds: [], state: newState };
      if (newState.currentProductId === 'p4' || isSplash)    return { reply: "Rose Vanille Body Splash is fresh, feminine, and bright \u2014 a light rose and vanilla mist, perfect for everyday wear \u2661", intent: "scent_question", productIds: [], state: newState };
      return { reply: "Both fragrances share a rose-vanilla DNA \u2661 Makhmarya (89 EGP) is the warmer concentrated gel; Rose Vanille Splash (229 EGP, 220ml) is the lighter everyday mist.", intent: "scent_question", productIds: ['p3','p4'], state: newState };
    }

    // 13. LAYERING
    if (/layer|layering|together|combine|stack|routine|both|mix|\u0645\u0639 \u0628\u0639\u0636|\u062a\u0631\u062a\u064a\u0628/i.test(q) && !isRitual) {
      newState.lastIntent = 'layering_question';
      return { reply: "Apply Makhmarya gel first to your pulse points \u2014 wrists, neck, behind ears \u2014 then spray Rose Vanille Body Splash all over. The two were made to layer together for a richer, longer-lasting rose-vanilla ritual \u2661", intent: "layering_question", productIds: ['p3','p4'], state: newState };
    }

    // 14. HOW TO USE
    if (/how (?:to use|do i use|should i use|to apply)|\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645|\u0628\u0633\u062a\u062e\u062f\u0645\u0647\u0627 \u0625\u0632\u0627\u064a/i.test(q)) {
      newState.lastIntent = 'how_to_use';
      if (newState.currentProductId === 'p3' || isMakhmarya) return { reply: "Warm a small amount of Makhmarya between your fingertips, then press gently onto pulse points \u2014 wrists, neck, behind the ears. Less is more \u2661", intent: "how_to_use", productIds: [], state: newState };
      if (newState.currentProductId === 'p4' || isSplash)    return { reply: "Spray Rose Vanille Body Splash all over after your shower, while skin is still slightly warm. You can also spray on hair and clothes for a lingering effect \u2661", intent: "how_to_use", productIds: [], state: newState };
      if (newState.currentProductId === 'p1') return { reply: "Apply the Dry Skin Moisturizer to cleansed face morning and evening. Focus on dry areas and massage gently \u2661", intent: "how_to_use", productIds: [], state: newState };
      if (newState.currentProductId === 'p2') return { reply: "Apply the Oily & Combination Moisturizer to cleansed face morning and evening \u2014 it absorbs quickly without a greasy finish \u2661", intent: "how_to_use", productIds: [], state: newState };
      return { reply: "Which product would you like guidance on? \u2661 I can walk you through how to use Makhmarya, the Body Splash, or our moisturizers.", intent: "how_to_use", productIds: [], state: newState };
    }

    // 15. GIFT RECOMMENDATIONS
    if (/gift|\u0647\u062f\u064a\u0629|present|for (?:someone|a friend|my mom|my sister|my wife|her)/i.test(q)) {
      newState.lastIntent = 'gift_recommendation';
      const gm = q.match(/(\d+)/); const gb = gm ? parseInt(gm[1]) : null;
      if (gb !== null && gb >= 299) return { reply: "The Sann\u00e9 Ritual gift set (299 EGP) is perfect \u2014 both the Makhmarya gel and Rose Vanille Body Splash together, beautifully packaged \u2661", intent: "gift_recommendation", productIds: ['bundle_ritual'], state: newState };
      if (gb !== null && gb >= 89 && gb < 229) return { reply: "Bosbos Makhmarya (89 EGP) makes a gorgeous, unique gift \u2014 an intimate fragrance gel she\u2019ll love \u2661", intent: "gift_recommendation", productIds: ['p3'], state: newState };
      return { reply: "The Sann\u00e9 Ritual gift set (299 EGP) is our most gifted choice \u2014 both fragrances in one set \u2661 For a smaller budget, Bosbos Makhmarya (89 EGP) is a standout gift on its own.", intent: "gift_recommendation", productIds: ['bundle_ritual','p3'], state: newState };
    }

    // 16. FULL CATALOGUE
    if (/what products do you have|show me all|all products|full catalogue|everything you have|\u0643\u0644 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a/i.test(q)) {
      newState.lastIntent = 'catalogue';
      return { reply: "Here\u2019s our full Sann\u00e9 collection: two facial moisturizers (229 EGP each \u00b7 200ml), Bosbos Makhmarya body fragrance gel (89 EGP \u00b7 50ml), Rose Vanille Body Splash (229 EGP \u00b7 220ml), and The Sann\u00e9 Ritual gift set (299 EGP) \u2661", intent: "catalogue", productIds: ['p1','p2','p3','p4','bundle_ritual'], state: newState };
    }

    // 17. CATEGORY DISCOVERY — body fragrance
    if (/body fragrance|body fragrances|body scent|\u0628\u0631\u0641\u0627\u0646 \u062c\u0633\u0645|\u0645\u0639\u0637\u0631 \u062c\u0633\u0645/i.test(q) && !/what is|ingredient/.test(q)) {
      newState.candidateProductIds = ['p3','p4','bundle_ritual']; newState.lastIntent = 'discovery';
      return { reply: "We have two body fragrances in the Rose Vanille family: Makhmarya (89 EGP, 50ml gel) and Rose Vanille Splash (229 EGP, 220ml mist). The Sann\u00e9 Ritual (299 EGP) bundles both \u2661", intent: "discovery", productIds: ['p3','p4','bundle_ritual'], state: newState };
    }

    // 18. INGREDIENTS / FORMULA
    if (/ingredient|ingredients|formula|formulation|what.?s inside|what is inside|what.?s in it|what does it contain|what is it made|ingrediants|ingredents|gel texture|softer feel|alcohol|glycerin|carbopol|shea butter|vitamin e|jojoba|almond oil/i.test(q)) {
      newState.lastIntent = 'ingredient_question';
      if (newState.currentProductId === 'p1' || newState.currentProductId === 'p2' || (/moisturizer/i.test(q) && !newState.currentProductId)) {
        if (!newState.currentProductId) {
          newState.pendingIntent = 'ingredient_question'; newState.pendingClarification = 'moisturizer_variant'; newState.candidateProductIds = ['p1','p2'];
          return { reply: "Does your skin usually feel dry and tight, or does it become oily and shiny during the day?", intent: "clarification", productIds: [], state: newState };
        }
        return { reply: "The full ingredient details for our moisturizers are still being finalized for Ask Sann\u00e9 and will be available soon \u2661 I can still help you choose between the Dry Skin and Oily & Combination formulas based on your skin needs.", intent: "ingredient_question", productIds: [], state: newState };
      }
      if (newState.currentProductId === 'p3' || isMakhmarya) {
        newState.currentProductId = 'p3';
        if (/gel texture|texture/.test(q)) return { reply: "Carbopol 940 creates the gel structure and texture in Makhmarya.", intent: "ingredient_question", productIds: [], state: newState };
        if (/softer|glycerin/.test(q)) return { reply: "Glycerin attracts water to the skin surface; Jojoba Oil and Sweet Almond Oil add skin-softening nourishment \u2661", intent: "ingredient_question", productIds: [], state: newState };
        if (/shea/.test(q)) return { reply: "Shea Butter in Makhmarya provides deep nourishing emolliency \u2014 it helps the gel melt into skin beautifully \u2661", intent: "ingredient_question", productIds: [], state: newState };
        return { reply: "Makhmarya\u2019s key ingredients: Shea Butter, Sweet Almond Oil, Jojoba Oil, Vitamin E, Rose Extract, Vanilla Extract, Glycerin (humectant), and Carbopol 940 (gel structure) \u2661", intent: "ingredient_question", productIds: [], state: newState };
      }
      if (newState.currentProductId === 'p4' || isSplash) {
        newState.currentProductId = 'p4';
        if (/alcohol|ethanol/.test(q)) return { reply: "Yes \u2014 the Body Splash contains ethanol, which acts as the lightweight fragrance carrier so it spreads and dries quickly \u2661", intent: "ingredient_question", productIds: [], state: newState };
        return { reply: "Rose Vanille Body Splash: Fragrance Oil (rose-vanilla scent), Ethanol (lightweight carrier), DPG and PG to distribute the scent evenly \u2661", intent: "ingredient_question", productIds: [], state: newState };
      }
    }

    // 19. PURPOSE
    if (/what is it for|what does it do|what.?s its purpose|how does it help|what is this used for/i.test(q)) {
      newState.lastIntent = 'purpose_question';
      if (newState.currentProductId === 'p3') return { reply: "Makhmarya is a concentrated fragrance gel \u2014 apply to pulse points for a warm, intimate, lingering scent ritual \u2661", intent: "purpose_question", productIds: [], state: newState };
      if (newState.currentProductId === 'p4') return { reply: "Rose Vanille Body Splash (220ml) is a light all-over fragrance mist \u2014 fresh, feminine, and perfect for everyday wear \u2661", intent: "purpose_question", productIds: [], state: newState };
      if (newState.currentProductId === 'p1') return { reply: "The Dry Skin Moisturizer provides rich daily moisture for dry, tight, or flaky skin \u2661", intent: "purpose_question", productIds: [], state: newState };
      if (newState.currentProductId === 'p2') return { reply: "The Oily & Combination Moisturizer provides lightweight balanced hydration without greasiness \u2661", intent: "purpose_question", productIds: [], state: newState };
    }

    // 20. PRICE
    if (/how much|price|cost|kam|\u0628\u0643\u0627\u0645|\u0633\u0639\u0631\u0647 \u0643\u0627\u0645|el price|bi kam|3amla|3amlo/i.test(q)) {
      newState.lastIntent = 'price_question';
      if (newState.currentProductId === 'p3') return { reply: "Bosbos Makhmarya is 89 EGP \u2014 and 80.10 EGP with the current launch offer when ordered on its own \u2661", intent: "price_question", productIds: [], state: newState };
      if (newState.currentProductId === 'p4') return { reply: "Rose Vanille Body Splash is 229 EGP (220ml) \u2014 and 206.10 EGP with the current launch offer when ordered on its own \u2661", intent: "price_question", productIds: [], state: newState };
      if (newState.currentProductId === 'bundle_ritual') return { reply: "The Sann\u00e9 Ritual is 299 EGP \u2014 both fragrances together, saving you 19 EGP vs buying separately \u2661", intent: "price_question", productIds: [], state: newState };
      if (newState.currentProductId === 'p1' || newState.currentProductId === 'p2') return { reply: "Our Moisturizing Creams are 229 EGP each (200ml) \u2661", intent: "price_question", productIds: [], state: newState };
      return { reply: "Quick price guide: Makhmarya 89 EGP \u00b7 Body Splash 229 EGP \u00b7 Moisturizers 229 EGP each \u00b7 The Ritual set 299 EGP \u2661", intent: "price_question", productIds: [], state: newState };
    }

    // 21. SIZE
    if (/size|how big|how many ml|\bml\b|\u0627\u0644\u062d\u062c\u0645|\u0643\u0627\u0645 \u0645\u0644\u064a|volume/i.test(q)) {
      newState.lastIntent = 'size_question';
      if (newState.currentProductId === 'p3') return { reply: "Makhmarya is 50ml \u2014 a compact gel concentrated for pulse points \u2661", intent: "size_question", productIds: [], state: newState };
      if (newState.currentProductId === 'p4') return { reply: "Rose Vanille Body Splash is 220ml \u2014 a generous mist for daily all-over use \u2661", intent: "size_question", productIds: [], state: newState };
      if (newState.currentProductId === 'p1' || newState.currentProductId === 'p2') return { reply: "Our Moisturizing Creams are 200ml each \u2661", intent: "size_question", productIds: [], state: newState };
    }

    // 22. BUNDLE + DISCOUNT QUESTION
    if (isRitual && /discount|10%|offer|launch|10 percent/i.test(q)) {
      newState.lastIntent = 'bundle_question';
      return { reply: "The Sann\u00e9 Ritual is fixed at 299 EGP \u2014 it already saves you 19 EGP vs buying both separately. The standalone 10% launch offer doesn\u2019t apply to the bundle \u2661", intent: "bundle_question", productIds: ['bundle_ritual'], state: newState };
    }

    // 23. BUDGET EXTRACTOR
    let budget = null;
    const bm = q.match(/(?:under|less than|below|budget is|have|max|up to|for|around|at)\s*(\d+)/i) || q.match(/(\d+)\s*(?:egp|le|pounds)/i);
    if (bm) { budget = parseInt(bm[1], 10); newState.activeConstraints.budgetMax = budget; }

    const wantsOily = /oily|greasy|shine|shiny|sebum|combination|t-zone|\u0628\u062a\u0632\u064a\u062a|\u0628\u062a\u0644\u0645\u0639|dehniya|\u062f\u0647\u0646\u064a\u0629/i.test(q);
    const wantsDry  = /dry|flaky|rough|tight|dehydrated|\u0646\u0627\u0634\u0641\u0629|\u0628\u062a\u0642\u0634\u0631|nashfa|jafa|gafa/i.test(q);

    if (budget !== null) {
      if (wantsDry  && budget < 229) return { reply: "The Dry Skin Moisturizer is 229 EGP \u2014 just over a " + budget + " EGP budget. For a fragrance treat in range, Makhmarya is 89 EGP \u2661", intent: "recommendation", productIds: ['p3'], state: newState };
      if (wantsOily && budget < 229) return { reply: "The Oily & Combination Moisturizer is 229 EGP \u2014 just over a " + budget + " EGP budget. For something in range, Makhmarya is 89 EGP \u2661", intent: "recommendation", productIds: ['p3'], state: newState };
      if (budget >= 299) return { reply: "With " + budget + " EGP, The Sann\u00e9 Ritual (299 EGP) is a wonderful choice \u2014 both fragrances in one beautiful set \u2661", intent: "recommendation", productIds: ['bundle_ritual'], state: newState };
      if (budget >= 229) return { reply: "Within " + budget + " EGP, Rose Vanille Body Splash (229 EGP, 220ml) is a beautiful pick \u2661", intent: "recommendation", productIds: ['p4'], state: newState };
      if (budget >= 89)  return { reply: "Within " + budget + " EGP, Bosbos Makhmarya (89 EGP) is our standout pick \u2014 a warm fragrance gel for pulse points \u2661", intent: "recommendation", productIds: ['p3'], state: newState };
      return { reply: "Our most affordable product is Makhmarya at 89 EGP (80.10 EGP with the current launch offer). Delivery is added at checkout \u2661", intent: "recommendation", productIds: [], state: newState };
    }

    // 24. PRONOUN FOLLOW-UP
    if (/what is it|tell me more|why that one|why did you recommend|more about it|and this one/i.test(q)) {
      newState.lastIntent = 'follow_up';
      if (newState.currentProductId === 'p3') return { reply: "Bosbos Makhmarya is 89 EGP \u2014 a warm, concentrated fragrance gel for pulse points. Intimate and lingering \u2661", intent: "follow_up", productIds: [], state: newState };
      if (newState.currentProductId === 'p4') return { reply: "Rose Vanille Body Splash is 229 EGP (220ml) \u2014 a fresh mist to spray all over for everyday fragrance \u2661", intent: "follow_up", productIds: [], state: newState };
      if (newState.currentProductId === 'p1') return { reply: "The Dry Skin Moisturizer is 229 EGP. Recommended because you described dry, tight, or flaky skin \u2661", intent: "follow_up", productIds: [], state: newState };
      if (newState.currentProductId === 'p2') return { reply: "The Oily & Combination Moisturizer is 229 EGP. Recommended because your skin tends to get oily or shiny during the day \u2661", intent: "follow_up", productIds: [], state: newState };
      if (newState.currentProductId === 'bundle_ritual') return { reply: "The Sann\u00e9 Ritual is 299 EGP \u2014 Makhmarya (50ml gel) + Rose Vanille Body Splash (220ml) for the complete rose-vanilla routine \u2661", intent: "follow_up", productIds: [], state: newState };
    }

    // 25. COMPARISON
    if (/difference|compare|versus| vs |\u0623\u062d\u0633\u0646|\u0628\u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629/i.test(q) && (isMakhmarya || isSplash)) {
      newState.lastIntent = 'comparison';
      if (isMakhmarya && isSplash) return { reply: "Makhmarya (89 EGP, 50ml) is a warm concentrated gel for pulse points \u2014 intimate and lingering. Body Splash (229 EGP, 220ml) is a light fresh mist for all-over use. Both rose-vanilla, made to layer \u2661", intent: "comparison", productIds: ['p3','p4'], state: newState };
    }

    // 26. SKIN TYPE MATCHING
    if (wantsOily) {
      newState.currentProductId = 'p2'; newState.candidateProductIds = ['p2']; newState.lastIntent = 'recommendation';
      const isAr = /[\u0600-\u06FF]/.test(query);
      return { reply: isAr ? "\u0644\u0644\u0628\u0634\u0631\u0629 \u0627\u0644\u062f\u0647\u0646\u064a\u0629 \u0648\u0627\u0644\u0645\u062e\u062a\u0644\u0637\u0629\u060c \u0623\u0646\u0635\u062d\u0643 \u0628\u0640 Moisturizing Cream for Oily & Combination Skin (229 EGP) \u2014 \u062a\u0631\u0637\u064a\u0628 \u062e\u0641\u064a\u0641 \u0628\u062f\u0648\u0646 \u0645\u0644\u0645\u0633 \u062f\u0647\u0646\u064a \u2661" : "For skin that becomes oily or shiny, our Moisturizing Cream for Oily & Combination Skin (229 EGP) provides lightweight hydration without greasiness \u2661", intent: "recommendation", productIds: ['p2'], state: newState };
    }
    if (wantsDry) {
      newState.currentProductId = 'p1'; newState.candidateProductIds = ['p1']; newState.lastIntent = 'recommendation';
      return { reply: "For dry, tight, or flaky skin, our Moisturizing Cream for Dry Skin (229 EGP) provides deep moisture barrier care \u2661", intent: "recommendation", productIds: ['p1'], state: newState };
    }

    // 27. DEFAULT FALLBACK \u2014 log unknown intent
    newState.lastIntent = 'clarification';
    logUnknownIntent(query);
    return { reply: "I can help with Sann\u00e9 products, scent, layering, delivery, payment, or anything about the brand \u2661 What are you looking for?", intent: "clarification", productIds: [], state: newState };
  }

  /**
   * Unknown-Intent Analytics Logger (anonymized, localStorage)
   */
  function logUnknownIntent(query) {
    try {
      const key = 'sanne_unknown_intents';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({ t: Date.now(), q: query.substring(0, 80) });
      if (existing.length > 50) existing.splice(0, existing.length - 50);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch(e) { /* silent */ }
  }


  /**
   * Product Card Renderer — Uses canonical window.products array
   */
  function renderProductCards(ids) {
    if (!ids || !ids.length || typeof window.products === 'undefined') return null;

    const container = document.createElement('div');
    container.className = 'ai-product-cards';

    ids.forEach(id => {
      const product = window.products.find(p => p.id === id);
      if (!product) return;

      const inWishlist = (typeof window.wishlist !== 'undefined') && window.wishlist.includes(id);

      const card = document.createElement('div');
      card.className = 'ai-product-card';
      card.innerHTML = `
        <img src="${product.image}" alt="${product.name}">
        <div class="ai-product-card-info">
          <h4>${product.name}</h4>
          <p>${product.variant}</p>
          <p style="font-weight: 600; color: var(--color-dark-brown); margin: 0.2rem 0;">${product.price} EGP</p>
          <div class="ai-product-card-actions">
            <button class="add-btn" onclick="addToCart(${JSON.stringify(product).replace(/"/g, '&quot;')}, 1); this.textContent='Added ✓'">Add to Cart</button>
            <button class="wishlist-btn ${inWishlist ? 'active' : ''}" id="ai-wish-${id}" onclick="handleAIWishlist('${id}', this)">${inWishlist ? '♥' : '♡'}</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    return container;
  }

  window.handleAIWishlist = function(id, btn) {
    if (typeof window.wishlist === 'undefined') return;
    window.toggleWishlist(id, btn);
    btn.textContent = window.wishlist.includes(id) ? '♥' : '♡';
  };

  // DOM Helpers
  function appendMessage(role, text, extraEl) {
    const messages = document.getElementById('chat-messages');
    if (!messages) return;

    const msg = document.createElement('div');
    msg.className = `message ${role === 'user' ? 'user-msg' : 'ai-msg'}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = role === 'user' ? 'YOU' : '✦';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    msg.appendChild(avatar);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.flexDirection = 'column';
    right.style.gap = '0.5rem';
    right.appendChild(bubble);
    if (extraEl) right.appendChild(extraEl);
    msg.appendChild(right);

    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping() {
    const messages = document.getElementById('chat-messages');
    if (!messages) return;

    const msg = document.createElement('div');
    msg.className = 'message ai-msg';
    msg.id = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = '✦';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  function setSendDisabled(val) {
    const btn = document.getElementById('chat-send-btn');
    if (btn) btn.disabled = val;
  }

  window.localRecommendationEngine = localRecommendationEngine;
})(window);
