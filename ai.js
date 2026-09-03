/**
 * ai.js — Sanné Conversational AI Advisor
 *
 * Source of Truth for Products: window.products array (from app.js)
 * State & Context: Retains conversation history and current_product_id across turns.
 * Dual-Engine Architecture:
 *   1. Remote Engine: Supabase Edge Function + OpenAI
 *   2. Local Engine: Stateful offline fallback & guardrail engine
 */

(function(window) {
  'use strict';

  // Configuration — Live Production Environment
  const SUPABASE_EDGE_URL = 'https://kqvoediolbpyvwpvbhty.supabase.co/functions/v1/sanne-chat';
  const SUPABASE_ANON_KEY = 'sb_publishable_Jmo112ZKxUE58oKXyCIOyg_KrSfiZst';

  let chatHistory = [];
  let currentProductId = null; // Tracks active product context ('p1', 'p2', 'p3', 'p4')
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
   * Main Send Message Handler
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
      const isEdgeConfigured = SUPABASE_EDGE_URL && !SUPABASE_EDGE_URL.includes('YOUR_SUPABASE_URL');

      if (isEdgeConfigured) {
        try {
          response = await callEdgeAI(chatHistory, currentProductId);
        } catch (e) {
          console.warn('Edge AI function fallback:', e);
          response = localRecommendationEngine(text, chatHistory, currentProductId);
        }
      } else {
        await new Promise(r => setTimeout(r, 400));
        response = localRecommendationEngine(text, chatHistory, currentProductId);
      }

      removeTyping();

      if (response && response.reply) {
        if (response.currentProductId) {
          currentProductId = response.currentProductId;
        }

        // Render product cards ONLY for recommendations / catalog / comparisons
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
   * Calls remote Supabase Edge Function with full context
   */
  async function callEdgeAI(history, activeProductId) {
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
        current_product_id: activeProductId
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Edge Function status ${res.status}`);
    }

    return await res.json();
  }

  function shouldRenderCards(intent, productIds) {
    if (!productIds || !productIds.length) return false;
    const cardIntents = ['recommendation', 'catalogue', 'comparison', 'product_discovery'];
    return intent ? cardIntents.includes(intent) : true;
  }

  /**
   * Stateful Local Recommendation & Guardrail Engine
   */
  function localRecommendationEngine(query, history, activeProductId) {
    const q = query.toLowerCase().trim();
    let activeId = activeProductId;

    // Detect explicit product switches or mentions
    if (/(makhmarya|makhmaria|bosbos)/i.test(q)) {
      activeId = 'p3';
    } else if (/(body splash|rose vanille|rose vanilla|splash|mist)/i.test(q)) {
      activeId = 'p4';
    } else if (/(dry skin moisturizer|moisturizer for dry skin|cream for dry skin)/i.test(q)) {
      activeId = 'p1';
    } else if (/(oily skin moisturizer|moisturizer for oily skin|oily and combination|cream for oily)/i.test(q)) {
      activeId = 'p2';
    }

    // 1. UNSUPPORTED MEDICAL / CURE CLAIMS
    if (/(cure|treat|heal|doctor|prescription|eczema|psoriasis|dermatitis|rosacea)/i.test(q)) {
      return {
        reply: "Sanné products provide gentle cosmetic daily care and moisture barrier support. For medical skin conditions or treatment, we recommend consulting a dermatologist ♡",
        intent: "disclaimer",
        productIds: [],
        currentProductId: activeId
      };
    }

    // 2. EXPLICIT CATALOGUE REQUEST
    if (/(what products do you have|what do you have|show me all|show all products|all products|full catalogue|everything you have|all collection)/i.test(q)) {
      return {
        reply: "Here is our complete Sanné collection — two targeted facial moisturizers (229 EGP each), our signature Bosbos Makhmarya body fragrance (79 EGP), and our Rose Vanille Body Splash (229 EGP, 220 ml).",
        intent: "catalogue",
        productIds: ['p1', 'p2', 'p3', 'p4'],
        currentProductId: activeId
      };
    }

    // 3. COMPARISON (Makhmarya vs Body Splash)
    if ((q.includes('difference') || q.includes('compare') || q.includes('versus') || q.includes('vs')) &&
        (q.includes('makhmarya') || q.includes('bosbos') || q.includes('fragrance')) &&
        (q.includes('splash') || q.includes('rose vanille') || q.includes('mist'))) {
      return {
        reply: "Bosbos Body Fragrance (Makhmarya) is 79 EGP in a gel format for pulse points. Rose Vanille Body Splash is 229 EGP (220 ml) as a refreshing fragrance mist.",
        intent: "comparison",
        productIds: ['p3', 'p4'],
        currentProductId: 'p4'
      };
    }

    // 4. INGREDIENT INQUIRIES
    const isIngredientQuery = /(ingredient|ingredients|contain|contains|alcohol|glycerin|carbopol|formula|what's inside|what is inside|gives it the scent|gives the scent|what gives|gives it the gel|what gives it|helps distribute|helps with the softer)/i.test(q);
    
    if (isIngredientQuery) {
      // Moisturizer ingredients asked -> Always unavailable notice
      if (activeId === 'p1' || activeId === 'p2' || q.includes('moisturizer') || q.includes('cream')) {
        return {
          reply: "The full ingredient details for our moisturizers are still being finalized for ASK SANNÉ and will be available soon ♡ I can still help you choose between the Dry Skin and Oily & Combination formulas based on what your skin needs.",
          intent: "ingredient_question",
          productIds: [],
          currentProductId: activeId || 'p1'
        };
      }

      // Makhmarya specific ingredient questions
      if (activeId === 'p3' || q.includes('makhmarya') || q.includes('bosbos')) {
        activeId = 'p3';
        if (q.includes('gel texture') || q.includes('texture')) {
          return {
            reply: "Carbopol 940 creates the gel texture and structure in our Makhmarya.",
            intent: "ingredient_question",
            productIds: [],
            currentProductId: 'p3'
          };
        }
        if (q.includes('moisturizing') || q.includes('softer') || q.includes('feel') || q.includes('glycerin')) {
          return {
            reply: "Glycerin acts as a humectant to attract moisture at the skin surface, while PEG-12 Dimethicone contributes to a smoother, softer feel.",
            intent: "ingredient_question",
            productIds: [],
            currentProductId: 'p3'
          };
        }
        return {
          reply: "Key ingredients in Makhmarya include glycerin to retain moisture, Carbopol 940 for its gel texture, PEG-12 Dimethicone for a soft feel, and fragrance oil for the scent.",
          intent: "ingredient_question",
          productIds: [],
          currentProductId: 'p3'
        };
      }

      // Body Splash specific ingredient questions
      if (activeId === 'p4' || q.includes('splash') || q.includes('rose vanille') || q.includes('alcohol') || q.includes('scent')) {
        activeId = 'p4';
        if (q.includes('alcohol')) {
          return {
            reply: "Yes. The Body Splash contains ethanol, which acts as the lightweight fragrance carrier so it spreads and dries quickly.",
            intent: "ingredient_question",
            productIds: [],
            currentProductId: 'p4'
          };
        }
        if (q.includes('scent')) {
          return {
            reply: "Fragrance oil provides the Rose Vanilla scent in the Body Splash.",
            intent: "ingredient_question",
            productIds: [],
            currentProductId: 'p4'
          };
        }
        if (q.includes('distribute') || q.includes('disperse')) {
          return {
            reply: "DPG and PG help carry and distribute the fragrance evenly, while PEG-40 Hydrogenated Castor Oil keeps the fragrance oil dispersed in the base.",
            intent: "ingredient_question",
            productIds: [],
            currentProductId: 'p4'
          };
        }
        return {
          reply: "Key ingredients include fragrance oil for the Rose Vanilla scent, ethanol as the lightweight fragrance carrier, and DPG and PG to help distribute the scent evenly.",
          intent: "ingredient_question",
          productIds: [],
          currentProductId: 'p4'
        };
      }
    }

    // 5. BUDGET EXTRACTOR
    let budget = null;
    const budgetMatch = q.match(/(?:under|less than|below|budget is|have|max|up to|for|around|at)\s*(\d+)/i) || q.match(/(\d+)\s*(?:egp|le|pounds)/i);
    if (budgetMatch) {
      budget = parseInt(budgetMatch[1], 10);
    }

    // Category and Concern Detectors (English, Arabic, Arabizi)
    const wantsOily = /(oily|greasy|shine|shiny|sebum|combination|combo|t-zone|t zone|بتزيت|بتلمع|بشرتي بتزيت|weshy byzayt)/i.test(q);
    const wantsDry = /(dry|flaky|flake|rough|tight|dehydrated|peeling|ناشفة|بتقشر|بشرتي ناشفة|beshrety nashfa)/i.test(q);
    const wantsMoisturizer = /(moisturizer|moisturizers|cream|creams|face cream|lotion|مرطب)/i.test(q);
    const wantsFragrance = /(fragrance|perfume|scent|scented|smell|splash|makhmarya|bosbos|مخمرية|معطر)/i.test(q);

    // 6. COMBINING CONSTRAINTS (Budget + Category)
    if (budget !== null) {
      // Dry skin requested under 229 EGP -> DO NOT recommend Makhmarya!
      if (wantsDry && budget < 229) {
        return {
          reply: `The Dry Skin Moisturizer is the right match for what you described, but it is 229 EGP, so I currently don't have a matching moisturizer under ${budget} EGP.`,
          intent: "recommendation",
          productIds: [],
          currentProductId: 'p1'
        };
      }
      if (wantsOily && budget < 229) {
        return {
          reply: `The Oily & Combination Moisturizer is the right match for what you described, but it is 229 EGP, so I currently don't have a matching moisturizer under ${budget} EGP.`,
          intent: "recommendation",
          productIds: [],
          currentProductId: 'p2'
        };
      }
      if (budget < 79) {
        return {
          reply: `Our lowest priced product is the Bosbos Body Fragrance (Makhmarya) at 79 EGP. We currently don't have items below ${budget} EGP.`,
          intent: "recommendation",
          productIds: [],
          currentProductId: activeId
        };
      }
      if (budget < 229) {
        activeId = 'p3';
        return {
          reply: `Under ${budget} EGP, we have our Bosbos Body Fragrance (Makhmarya) at 79 EGP.`,
          intent: "recommendation",
          productIds: ['p3'],
          currentProductId: 'p3'
        };
      }
    }

    // 7. FOLLOW-UP PRONOUN RESOLUTION ("What is it?", "Why that one?", "How much is it?")
    if (/(what is it|tell me more|how much is it|what's the price|why that one|why did you recommend|how do i use it)/i.test(q)) {
      if (activeId === 'p3') {
        return {
          reply: "Bosbos Body Fragrance (Makhmarya) is 79 EGP. It is our signature scented body gel format.",
          intent: "follow_up",
          productIds: [],
          currentProductId: 'p3'
        };
      }
      if (activeId === 'p4') {
        return {
          reply: "Rose Vanille Body Splash is 229 EGP (220 ml). It is a fragrance mist with rose and vanilla notes.",
          intent: "follow_up",
          productIds: [],
          currentProductId: 'p4'
        };
      }
      if (activeId === 'p1') {
        return {
          reply: "The Dry Skin Moisturizer is 229 EGP. We recommended it because you described dry, tight, or flaky skin.",
          intent: "follow_up",
          productIds: [],
          currentProductId: 'p1'
        };
      }
      if (activeId === 'p2') {
        return {
          reply: "The Oily & Combination Moisturizer is 229 EGP. We recommended it because you described skin that gets oily or shiny during the day.",
          intent: "follow_up",
          productIds: [],
          currentProductId: 'p2'
        };
      }
    }

    // 8. SKIN CONCERN MATCHING
    if (wantsOily) {
      activeId = 'p2';
      const isArabic = /[\u0600-\u06FF]/.test(query);
      const replyText = isArabic 
        ? "للبشرة التي تفرز زيوت وتلمع خلال اليوم، أنصحك بـ Moisturizing Cream for Oily and Combination Skin (229 EGP) لترطيب خفيف دون ملمس دهني."
        : "For skin that becomes oily or shiny during the day, our Moisturizing Cream for Oily & Combination Skin (229 EGP) provides lightweight barrier comfort.";
      return {
        reply: replyText,
        intent: "recommendation",
        productIds: ['p2'],
        currentProductId: 'p2'
      };
    }

    if (wantsDry) {
      activeId = 'p1';
      return {
        reply: "For dry, tight, or flaky skin, our Moisturizing Cream for Dry Skin (229 EGP) provides deep, restorative moisture barrier care.",
        intent: "recommendation",
        productIds: ['p1'],
        currentProductId: 'p1'
      };
    }

    // 9. AMBIGUOUS MOISTURIZER QUESTION
    if (wantsMoisturizer || q.includes('which moisturizer') || q.includes('which cream')) {
      return {
        reply: "Does your skin usually feel dry and tight, or does it become oily and shiny during the day?",
        intent: "clarification",
        productIds: [],
        currentProductId: activeId,
        needsClarification: true
      };
    }

    // 10. PRODUCT SPECIFIC LOOKUPS
    if (activeId === 'p3' || wantsFragrance) {
      return {
        reply: "Bosbos Body Fragrance (Makhmarya) is 79 EGP, and Rose Vanille Body Splash (220 ml) is 229 EGP.",
        intent: "product_discovery",
        productIds: ['p3', 'p4'],
        currentProductId: activeId || 'p3'
      };
    }

    // Default Fallback
    return {
      reply: "I can help with Sanné moisturizers, body fragrance, skin-type guidance, ingredients, and prices. Tell me what your skin needs or what you're looking for ♡",
      intent: "clarification",
      productIds: [],
      currentProductId: activeId
    };
  }

  /**
   * Product Card Renderer — Uses shared window.products catalogue
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
