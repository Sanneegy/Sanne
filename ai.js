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

    // 1. UNSUPPORTED MEDICAL / CURE CLAIMS
    if (/(cure|treat|heal|doctor|prescription|eczema|psoriasis|dermatitis|rosacea)/i.test(q)) {
      newState.lastIntent = 'disclaimer';
      return {
        reply: "Sanné products provide gentle cosmetic daily care and moisture barrier support. For medical skin conditions or treatment, we recommend consulting a dermatologist ♡",
        intent: "disclaimer",
        productIds: [],
        state: newState
      };
    }

    // 2. RESOLVE PENDING CLARIFICATION & INTENT RESUMPTION
    if (newState.pendingClarification === 'moisturizer_variant' || (q.includes('dry') || q.includes('oily'))) {
      if (q.includes('dry') || q.includes('flaky') || q.includes('tight') || q.includes('ناشفة')) {
        newState.currentProductId = 'p1';
        newState.activeConstraints.skinType = 'dry';
      } else if (q.includes('oily') || q.includes('shiny') || q.includes('greasy') || q.includes('بتزيت')) {
        newState.currentProductId = 'p2';
        newState.activeConstraints.skinType = 'oily';
      }

      if (newState.pendingIntent === 'ingredient_question' || newState.pendingIntent === 'formula') {
        const activeName = newState.currentProductId === 'p1' ? 'Moisturizing Cream for Dry Skin' : 'Moisturizing Cream for Oily & Combination Skin';
        newState.pendingIntent = null;
        newState.pendingClarification = null;
        newState.lastIntent = 'ingredient_question';
        return {
          reply: `The full ingredient details for our moisturizers are still being finalized for ASK SANNÉ and will be available soon ♡ I can still help you choose between the Dry Skin and Oily & Combination formulas based on what your skin needs.`,
          intent: "ingredient_question",
          productIds: [],
          state: newState
        };
      }
    }

    // 3. PRODUCT SPECIFIC IDENTIFICATION & SWITCHING
    if (/(makhmarya|makhmaria|bosbos|مخمرية)/i.test(q)) {
      newState.currentProductId = 'p3';
      newState.candidateProductIds = ['p3'];
    } else if (/(body splash|rose vanille|rose vanilla|splash|mist)/i.test(q)) {
      newState.currentProductId = 'p4';
      newState.candidateProductIds = ['p4'];
    } else if (/(dry skin moisturizer|cream for dry skin|dry moisturizer)/i.test(q)) {
      newState.currentProductId = 'p1';
      newState.candidateProductIds = ['p1'];
    } else if (/(oily skin moisturizer|cream for oily skin|oily moisturizer)/i.test(q)) {
      newState.currentProductId = 'p2';
      newState.candidateProductIds = ['p2'];
    }

    // 4. EXPLICIT CATALOGUE REQUEST
    if (/(what products do you have|what do you have|show me all|show all products|all products|full catalogue|everything you have|all collection)/i.test(q)) {
      newState.lastIntent = 'catalogue';
      return {
        reply: "Here is our complete Sanné collection — two targeted facial moisturizers (229 EGP each), our signature Bosbos Makhmarya body fragrance (79 EGP), and our Rose Vanille Body Splash (229 EGP, 220 ml).",
        intent: "catalogue",
        productIds: ['p1', 'p2', 'p3', 'p4'],
        state: newState
      };
    }

    // 5. CATEGORY DISCOVERY: "give me body fragrance" / "show me body fragrances"
    if (/(body fragrance|body fragrances|body scent|scented for body|scent for body|برفان جسم|معطر جسم)/i.test(q) && !q.includes('what is') && !q.includes('ingredient')) {
      newState.candidateProductIds = ['p3', 'p4'];
      newState.lastIntent = 'discovery';
      return {
        reply: "We offer two body fragrances: Bosbos Body Fragrance (Makhmarya) at 79 EGP (gel format) and Rose Vanille Body Splash at 229 EGP (220 ml mist).",
        intent: "discovery",
        productIds: ['p3', 'p4'],
        state: newState
      };
    }

    // 6. INGREDIENT / FORMULA SYNONYM NORMALIZATION
    const isIngredientQuery = /(ingredient|ingredients|formula|formulation|what's inside|what is inside|what's in it|what does it contain|what is it made|ingrediants|ingredents|gel texture|softer feel|alcohol|glycerin|carbopol)/i.test(q);

    if (isIngredientQuery) {
      newState.lastIntent = 'ingredient_question';

      if (newState.currentProductId === 'p1' || newState.currentProductId === 'p2' || (q.includes('moisturizer') && !newState.currentProductId)) {
        if (!newState.currentProductId) {
          newState.pendingIntent = 'ingredient_question';
          newState.pendingClarification = 'moisturizer_variant';
          newState.candidateProductIds = ['p1', 'p2'];
          return {
            reply: "Does your skin usually feel dry and tight, or does it become oily and shiny during the day?",
            intent: "clarification",
            productIds: [],
            state: newState
          };
        }
        return {
          reply: "The full ingredient details for our moisturizers are still being finalized for ASK SANNÉ and will be available soon ♡ I can still help you choose between the Dry Skin and Oily & Combination formulas based on what your skin needs.",
          intent: "ingredient_question",
          productIds: [],
          state: newState
        };
      }

      if (newState.currentProductId === 'p3' || q.includes('makhmarya')) {
        newState.currentProductId = 'p3';
        if (q.includes('gel texture') || q.includes('texture')) {
          return { reply: "Carbopol 940 creates the gel texture and structure in our Makhmarya.", intent: "ingredient_question", productIds: [], state: newState };
        }
        if (q.includes('softer') || q.includes('moisturizing') || q.includes('glycerin')) {
          return { reply: "Glycerin acts as a humectant to attract water at the skin surface, while PEG-12 Dimethicone contributes to a softer feel.", intent: "ingredient_question", productIds: [], state: newState };
        }
        return { reply: "Key ingredients in Makhmarya include glycerin for moisture, Carbopol 940 for its gel structure, PEG-12 Dimethicone for a soft feel, and fragrance oil.", intent: "ingredient_question", productIds: [], state: newState };
      }

      if (newState.currentProductId === 'p4' || q.includes('splash') || q.includes('alcohol')) {
        newState.currentProductId = 'p4';
        if (q.includes('alcohol')) {
          return { reply: "Yes. The Body Splash contains ethanol, which acts as the lightweight fragrance carrier so it spreads and dries quickly.", intent: "ingredient_question", productIds: [], state: newState };
        }
        if (q.includes('scent') || q.includes('smell')) {
          return { reply: "Fragrance oil provides the Rose Vanilla scent in the Body Splash.", intent: "ingredient_question", productIds: [], state: newState };
        }
        return { reply: "Key ingredients in Body Splash include fragrance oil for the Rose Vanilla scent, ethanol as the lightweight carrier, and DPG & PG to distribute the scent evenly.", intent: "ingredient_question", productIds: [], state: newState };
      }
    }

    // 7. PURPOSE & USAGE SYNONYM NORMALIZATION ("what is it for", "what does it do", "what's its purpose")
    if (/(what is it for|what does it do|why would i use it|what's its purpose|how does it help|what is this used for)/i.test(q)) {
      newState.lastIntent = 'purpose_question';
      if (newState.currentProductId === 'p3') {
        return { reply: "Bosbos Body Fragrance (Makhmarya) is a scented body gel format designed to melt into skin and pulse points for a warm, lasting scent ritual.", intent: "purpose_question", productIds: [], state: newState };
      }
      if (newState.currentProductId === 'p4') {
        return { reply: "Rose Vanille Body Splash (220 ml) is a light, refreshing all-over fragrance mist with rose and vanilla notes for daily spraying.", intent: "purpose_question", productIds: [], state: newState };
      }
      if (newState.currentProductId === 'p1') {
        return { reply: "The Dry Skin Moisturizer provides rich daily barrier moisture for dry, tight, or flaky skin.", intent: "purpose_question", productIds: [], state: newState };
      }
      if (newState.currentProductId === 'p2') {
        return { reply: "The Oily & Combination Moisturizer provides balanced lightweight hydration and shine control.", intent: "purpose_question", productIds: [], state: newState };
      }
    }

    // 8. PRICE & SIZE QUESTIONS
    if (/(how much|price|cost|kam|بكام|سعره كام)/i.test(q)) {
      newState.lastIntent = 'price_question';
      if (newState.currentProductId === 'p3') return { reply: "Bosbos Body Fragrance (Makhmarya) is 79 EGP.", intent: "price_question", productIds: [], state: newState };
      if (newState.currentProductId === 'p4') return { reply: "Rose Vanille Body Splash is 229 EGP (220 ml).", intent: "price_question", productIds: [], state: newState };
      if (newState.currentProductId === 'p1' || newState.currentProductId === 'p2') return { reply: "Sanné Moisturizing Creams are 229 EGP each.", intent: "price_question", productIds: [], state: newState };
    }

    if (/(size|how big|how many ml|ml|الحجم|كام ملي)/i.test(q)) {
      newState.lastIntent = 'size_question';
      if (newState.currentProductId === 'p4') return { reply: "Rose Vanille Body Splash is 220 ml.", intent: "size_question", productIds: [], state: newState };
      if (newState.currentProductId === 'p1' || newState.currentProductId === 'p2') return { reply: "Our Moisturizing Creams are 200 ml.", intent: "size_question", productIds: [], state: newState };
    }

    // 9. BUDGET EXTRACTOR & RELEVANCE
    let budget = null;
    const budgetMatch = q.match(/(?:under|less than|below|budget is|have|max|up to|for|around|at)\s*(\d+)/i) || q.match(/(\d+)\s*(?:egp|le|pounds)/i);
    if (budgetMatch) {
      budget = parseInt(budgetMatch[1], 10);
      newState.activeConstraints.budgetMax = budget;
    }

    const wantsOily = /(oily|greasy|shine|shiny|sebum|combination|t-zone|بتزيت|بتلمع|weshy byzayt)/i.test(q);
    const wantsDry = /(dry|flaky|rough|tight|dehydrated|ناشفة|بتقشر|beshrety nashfa)/i.test(q);

    if (budget !== null) {
      if (wantsDry && budget < 229) {
        newState.currentProductId = 'p1';
        return {
          reply: `The Dry Skin Moisturizer is the right match for what you described, but it is 229 EGP, so I currently don't have a matching moisturizer under ${budget} EGP.`,
          intent: "recommendation",
          productIds: [],
          state: newState
        };
      }
      if (wantsOily && budget < 229) {
        newState.currentProductId = 'p2';
        return {
          reply: `The Oily & Combination Moisturizer is the right match for what you described, but it is 229 EGP, so I currently don't have a matching moisturizer under ${budget} EGP.`,
          intent: "recommendation",
          productIds: [],
          state: newState
        };
      }
      if (budget < 229) {
        newState.currentProductId = 'p3';
        newState.candidateProductIds = ['p3'];
        newState.lastIntent = 'recommendation';
        return {
          reply: `Under ${budget} EGP, we have our Bosbos Body Fragrance (Makhmarya) at 79 EGP.`,
          intent: "recommendation",
          productIds: ['p3'],
          state: newState
        };
      }
    }

    // 10. PRONOUN / REFERENCE FOLLOW-UP RESOLUTION ("what is it", "why that one")
    if (/(what is it|tell me more|why that one|why did you recommend)/i.test(q)) {
      newState.lastIntent = 'follow_up';
      if (newState.currentProductId === 'p3') {
        return { reply: "Bosbos Body Fragrance (Makhmarya) is 79 EGP. It is our scented body gel format for pulse points.", intent: "follow_up", productIds: [], state: newState };
      }
      if (newState.currentProductId === 'p4') {
        return { reply: "Rose Vanille Body Splash is 229 EGP (220 ml). It is a body fragrance mist with rose and vanilla notes.", intent: "follow_up", productIds: [], state: newState };
      }
      if (newState.currentProductId === 'p1') {
        return { reply: "The Dry Skin Moisturizer is 229 EGP. We recommended it because you described dry, tight, or flaky skin.", intent: "follow_up", productIds: [], state: newState };
      }
      if (newState.currentProductId === 'p2') {
        return { reply: "The Oily & Combination Moisturizer is 229 EGP. We recommended it because you described skin that gets oily or shiny during the day.", intent: "follow_up", productIds: [], state: newState };
      }
    }

    // 11. SKIN TYPE MATCHING
    if (wantsOily) {
      newState.currentProductId = 'p2';
      newState.candidateProductIds = ['p2'];
      newState.lastIntent = 'recommendation';
      const isArabic = /[\u0600-\u06FF]/.test(query);
      const replyText = isArabic 
        ? "للبشرة التي تفرز زيوت وتلمع خلال اليوم، أنصحك بـ Moisturizing Cream for Oily and Combination Skin (229 EGP) لترطيب خفيف دون ملمس دهني."
        : "For skin that becomes oily or shiny during the day, our Moisturizing Cream for Oily & Combination Skin (229 EGP) provides lightweight barrier comfort.";
      return { reply: replyText, intent: "recommendation", productIds: ['p2'], state: newState };
    }

    if (wantsDry) {
      newState.currentProductId = 'p1';
      newState.candidateProductIds = ['p1'];
      newState.lastIntent = 'recommendation';
      return { reply: "For dry, tight, or flaky skin, our Moisturizing Cream for Dry Skin (229 EGP) provides deep moisture barrier care.", intent: "recommendation", productIds: ['p1'], state: newState };
    }

    // 12. COMPARISON
    if ((q.includes('difference') || q.includes('compare') || q.includes('versus') || q.includes('vs')) &&
        (q.includes('makhmarya') || q.includes('bosbos')) && (q.includes('splash') || q.includes('mist'))) {
      newState.lastIntent = 'comparison';
      return { reply: "Bosbos Body Fragrance (Makhmarya) is 79 EGP in a gel format. Rose Vanille Body Splash is 229 EGP (220 ml) as a fragrance mist.", intent: "comparison", productIds: ['p3', 'p4'], state: newState };
    }

    // Default Fallback
    newState.lastIntent = 'clarification';
    return {
      reply: "I can help with Sanné moisturizers, body fragrance, skin guidance, ingredients, and prices. Tell me what your skin needs or what you're looking for ♡",
      intent: "clarification",
      productIds: [],
      state: newState
    };
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
