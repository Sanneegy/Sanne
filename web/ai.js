/**
 * ai.js — Sanné AI Advisor frontend logic
 *
 * This file handles the chat UI and communicates with either the secure
 * Supabase Edge Function (when configured) or the built-in local recommendation
 * engine that precisely maps skin concerns, product categories, and budgets.
 */

// Configuration — replace with actual Supabase keys when deploying live
const SUPABASE_EDGE_URL = 'https://YOUR_SUPABASE_URL.supabase.co/functions/v1/sanne-chat';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

let chatHistory = [];
let isWaiting = false;

// Auto-resize textarea as user types
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('chat-input');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
});

/**
 * Quick prompt chips
 */
window.sendQuickPrompt = function(btn) {
  const text = btn.textContent.trim();
  const input = document.getElementById('chat-input');
  if (input) input.value = text;
  
  const qp = document.getElementById('quick-prompts');
  if (qp) qp.style.display = 'none';
  
  sendMessage();
};

/**
 * Main send function
 */
window.sendMessage = async function() {
  if (isWaiting) return;

  const input = document.getElementById('chat-input');
  const text = (input?.value || '').trim();
  if (!text) return;

  // Show user message
  appendMessage('user', text);
  input.value = '';
  input.style.height = 'auto';

  // Hide quick prompts after first message
  const qp = document.getElementById('quick-prompts');
  if (qp) qp.style.display = 'none';

  // Show typing indicator
  showTyping();
  isWaiting = true;
  setSendDisabled(true);

  chatHistory.push({ role: 'user', content: text });

  try {
    let response = null;

    // Check if real Supabase Edge Function is configured
    const isEdgeConfigured = SUPABASE_EDGE_URL && !SUPABASE_EDGE_URL.includes('YOUR_SUPABASE_URL');

    if (isEdgeConfigured) {
      try {
        response = await callEdgeAI(chatHistory);
      } catch (e) {
        console.warn('Edge function unavailable, using local recommendation engine:', e);
        response = localRecommendationEngine(text, chatHistory);
      }
    } else {
      // Local controlled recommendation engine with slight natural typing delay
      await new Promise(r => setTimeout(r, 600));
      response = localRecommendationEngine(text, chatHistory);
    }

    removeTyping();

    if (response && response.reply) {
      const productCards = renderProductCards(response.productIds || []);
      appendMessage('ai', response.reply, productCards);
      chatHistory.push({ role: 'assistant', content: response.reply });
    } else {
      appendMessage('ai', "I'm sorry, I couldn't process that. Please try telling me your skin type or budget.");
    }

  } catch (err) {
    removeTyping();
    console.error('Advisor error:', err);
    appendMessage('ai', "I can currently help with moisturizers, body fragrance, skin type guidance, and budget-based recommendations. Try telling me your skin type, what kind of product you want, or your budget.");
  }

  isWaiting = false;
  setSendDisabled(false);
};

/**
 * Calls remote Supabase Edge Function if configured
 */
async function callEdgeAI(history) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(SUPABASE_EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ messages: history }),
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`Edge function returned ${res.status}`);
  }

  return await res.json();
}

/**
 * Controlled Local Recommendation Engine
 * Strictly follows Sanné catalogue logic, budget constraints, and semantic matching.
 */
/**
 * Controlled Local Recommendation Engine
 * Strictly follows Sanné catalogue logic, budget constraints, and semantic matching.
 */
function localRecommendationEngine(query, history) {
  const q = query.toLowerCase().trim();

  // 1. Budget extraction
  let budget = null;
  const budgetMatch = q.match(/(?:under|less than|below|budget is|have|max|up to|for|around|at)\s*(\d+)/i) || q.match(/(\d+)\s*(?:egp|le|pounds)/i);
  if (budgetMatch) {
    budget = parseInt(budgetMatch[1], 10);
  }

  // 2. Broad / Catalog questions (when no specific budget/filter is specified)
  if (
    budget === null &&
    (
      q.includes('what products do you have') ||
      q.includes('what do you have') ||
      q.includes('show me all') ||
      q.includes('show all products') ||
      q.includes('all products') ||
      q.includes('full catalogue') ||
      q.includes('everything you have') ||
      q.includes('all collection') ||
      q.includes('full collection')
    )
  ) {
    return {
      reply: "Here is our complete Sanné collection — two targeted facial moisturizers formulated for your skin's daily barrier comfort (229 EGP each), our signature Bosbos Makhmarya body fragrance (79 EGP), and our Rose Vanille Body Splash (229 EGP).",
      productIds: ['p1', 'p2', 'p3', 'p4']
    };
  }

  // 3. Distinguish Makhmarya from Body Splash
  if (
    (q.includes('difference') || q.includes('compare') || q.includes('versus') || q.includes('vs') || q.includes('which is better')) &&
    (q.includes('makhmarya') || q.includes('bosbos') || q.includes('fragrance')) &&
    (q.includes('splash') || q.includes('body splash') || q.includes('spray') || q.includes('mist') || q.includes('rose vanille'))
  ) {
    return {
      reply: "Here is the difference between our two Sanné body fragrance creations:\n\n• **Bosbos Body Fragrance (Makhmarya)** (79 EGP): A warm, velvety concentrated fragrance ritual designed to melt into skin and pulse points.\n• **Rose Vanille Body Splash** (229 EGP, 220 ml): A light, refreshing all-over fragrance mist with romantic rose and soothing vanilla notes for daily spraying.",
      productIds: ['p3', 'p4']
    };
  }

  // 4. Exact Body Splash / Rose Vanilla requests
  const wantsBodySplash = /(body splash|splash|rose vanille|rose vanilla|fragrance mist|body spray|body mist)/i.test(q);
  const wantsRoseVanilla = /(rose vanille|rose vanilla|rose and vanilla|rose with vanilla|vanilla and rose)/i.test(q);

  // Category and skin type intents
  const wantsOily = /(oily|greasy|shine|shiny|acne|breakout|pores|sebum|combination|combo|t-zone|t zone)/i.test(q);
  const wantsDry = /(dry|flaky|flake|rough|tight|tightness|dehydrated|dehydration|parched|peeling|tired and dehydrated|dull)/i.test(q);
  const wantsMakhmaryaOnly = /(makhmarya|makhmaria|bosbos)/i.test(q);
  const wantsFragrance = /(makhmarya|makhmaria|bosbos|fragrance|perfume|scent|scented|body fragrance|body scent|smell|splash|body splash)/i.test(q);
  const wantsMoisturizer = /(moisturizer|moisturizers|cream|creams|face cream|moisturising|lotion)/i.test(q);
  const asksBestSeller = /(best seller|bestseller|most popular|popular|favorite)/i.test(q);

  // 5. Ambiguous moisturizer query: "Which moisturizer is better for me?"
  if (
    (q.includes('which moisturizer') || q.includes('which cream') || q.includes('better for me') || q.includes('what moisturizer')) &&
    !wantsOily && !wantsDry && !wantsFragrance
  ) {
    return {
      reply: "Does your skin usually feel dry and tight, or does it become oily and shiny during the day?",
      productIds: []
    };
  }

  // 6. Budget Constraints
  if (budget !== null) {
    // Body splash specific budget check
    if (wantsBodySplash && budget < 229) {
      return {
        reply: `Our **Rose Vanille Body Splash** (220 ml) is 229 EGP. Currently, we do not have a body splash within a ${budget} EGP budget, but we'd love to help whenever you're ready.`,
        productIds: []
      };
    }

    // Fragrance with exact/specific budget intent
    if ((wantsFragrance || wantsMakhmaryaOnly) && !wantsMoisturizer && !wantsOily && !wantsDry) {
      if (budget < 79) {
        return {
          reply: `Our lowest priced fragrance is the **Bosbos Body Fragrance (Makhmarya)** at 79 EGP. We currently don't have items below ${budget} EGP.`,
          productIds: []
        };
      } else if (budget < 229) {
        return {
          reply: `Under ${budget} EGP, our **Bosbos Body Fragrance (Makhmarya)** at 79 EGP is the perfect warm, scented ritual for your body.`,
          productIds: ['p3']
        };
      } else if (budget === 229 || wantsBodySplash || wantsRoseVanilla) {
        // e.g. "What fragrance do you have for 229 EGP?"
        return {
          reply: `For 229 EGP, our **Rose Vanille Body Splash** (220 ml) provides an elegant, refreshing body fragrance mist with rose and vanilla notes.`,
          productIds: ['p4']
        };
      } else {
        return {
          reply: `Within your ${budget} EGP budget, you can choose from our body fragrance collection: **Bosbos Body Fragrance (Makhmarya)** (79 EGP) or our **Rose Vanille Body Splash** (229 EGP).`,
          productIds: ['p3', 'p4']
        };
      }
    }

    // Dry skin product with budget
    if (wantsDry && budget < 229) {
      return {
        reply: `Our **Moisturizing Cream for Dry Skin** is 229 EGP. Currently, we do not have a facial moisturizer within a ${budget} EGP budget.`,
        productIds: []
      };
    }
    // Oily skin product with budget
    if (wantsOily && budget < 229) {
      return {
        reply: `Our **Moisturizing Cream for Oily and Combination Skin** is 229 EGP. Currently, we do not have a facial moisturizer within a ${budget} EGP budget.`,
        productIds: []
      };
    }
    // General moisturizer with budget < 229 EGP
    if (wantsMoisturizer && !wantsFragrance && budget < 229) {
      return {
        reply: `Both of our Sanné Moisturizing Creams are 229 EGP. We currently do not have a moisturizer within a ${budget} EGP budget.`,
        productIds: []
      };
    }

    // Oily + Under budget
    if (wantsOily && budget >= 229) {
      return {
        reply: "For oily and combination skin within your budget, our **Moisturizing Cream for Oily and Combination Skin** (229 EGP) delivers balanced hydration and shine control without heavy residue.",
        productIds: ['p2']
      };
    }

    // Dry + Under budget
    if (wantsDry && budget >= 229) {
      return {
        reply: "For dry skin within your budget, our **Moisturizing Cream for Dry Skin** (229 EGP) provides rich, restorative barrier care with ceramides and hyaluronic acid.",
        productIds: ['p1']
      };
    }

    // Strict general budget query: "What can I get under 100 EGP?" or "What do you have for 229 EGP?"
    if (!wantsOily && !wantsDry && !wantsMoisturizer && !wantsFragrance) {
      if (budget < 79) {
        return {
          reply: `Our lowest priced product is the **Bosbos Body Fragrance (Makhmarya)** at 79 EGP. We currently don't have items below ${budget} EGP.`,
          productIds: []
        };
      } else if (budget < 229) {
        return {
          reply: `Under ${budget} EGP, we have our **Bosbos Body Fragrance (Makhmarya)** at 79 EGP — a warm, velvety scented ritual for the body.`,
          productIds: ['p3']
        };
      } else if (budget === 229) {
        return {
          reply: `For 229 EGP, we have three options: our **Moisturizing Cream for Dry Skin** (229 EGP), our **Moisturizing Cream for Oily and Combination Skin** (229 EGP), and our new **Rose Vanille Body Splash** (229 EGP).`,
          productIds: ['p1', 'p2', 'p4']
        };
      } else {
        return {
          reply: `Within a ${budget} EGP budget, you can choose any of our products: our targeted Moisturizing Creams (229 EGP each), our **Rose Vanille Body Splash** (229 EGP), or our **Bosbos Body Fragrance** (79 EGP).`,
          productIds: ['p1', 'p2', 'p4', 'p3']
        };
      }
    }
  }

  // 7. Specific Body Splash / Rose Vanilla queries (without budget)
  if (wantsBodySplash || wantsRoseVanilla) {
    return {
      reply: "Our **Rose Vanille Body Splash** (220 ml, 229 EGP) is a refreshing, long-lasting body fragrance mist featuring delicate rose and warm vanilla notes for your everyday ritual.",
      productIds: ['p4']
    };
  }

  // 8. Makhmarya specific query
  if (wantsMakhmaryaOnly) {
    return {
      reply: "For a warm, feminine, long-lasting scent, **Bosbos Body Fragrance (Makhmarya)** (79 EGP) is our signature scented skin ritual that leaves you softly and beautifully fragrant.",
      productIds: ['p3']
    };
  }

  // 9. General Body Fragrance / Scent query: "What body fragrances do you have?" / "I want something scented for my body"
  if (wantsFragrance && !wantsMoisturizer && !wantsOily && !wantsDry) {
    return {
      reply: "We offer two delightful body fragrances: our signature **Bosbos Body Fragrance (Makhmarya)** (79 EGP) for warm, intimate fragrance, and our **Rose Vanille Body Splash** (220 ml, 229 EGP) for an all-over refreshing mist.",
      productIds: ['p3', 'p4']
    };
  }

  // 10. Oily / Combination Skin
  if (wantsOily) {
    return {
      reply: "For skin that gets oily, shiny, or has an active T-zone, our **Moisturizing Cream for Oily and Combination Skin** (229 EGP) provides lightweight, soothing barrier comfort without greasiness.",
      productIds: ['p2']
    };
  }

  // 11. Dry / Tight / Dehydrated Skin
  if (wantsDry) {
    return {
      reply: "For skin that feels tight, dry, flaky, or dehydrated, our **Moisturizing Cream for Dry Skin** (229 EGP) deeply replenishes and locks in moisture with ceramides, hyaluronic acid, and sweet almond oil.",
      productIds: ['p1']
    };
  }

  // 12. General Moisturizers query: "Show me moisturizers"
  if (wantsMoisturizer) {
    return {
      reply: "We offer two tailored moisturizing creams (229 EGP each): one for dry skin needing deep nourishment, and one for oily/combination skin wanting lightweight barrier comfort.",
      productIds: ['p1', 'p2']
    };
  }

  // 13. Best Sellers
  if (asksBestSeller) {
    return {
      reply: "Our community favorites are the **Moisturizing Cream for Oily and Combination Skin** (229 EGP) and our beloved **Bosbos Body Fragrance (Makhmarya)** (79 EGP).",
      productIds: ['p2', 'p3']
    };
  }

  // 14. Graceful Fallback
  return {
    reply: "I can currently help with moisturizers, body fragrance, skin type guidance, and budget-based recommendations. Try telling me your skin type, what kind of product you want, or your budget.",
    productIds: []
  };
}

/**
 * Renders recommendation product cards
 */
function renderProductCards(ids) {
  if (!ids || ids.length === 0 || typeof products === 'undefined') return null;

  const container = document.createElement('div');
  container.className = 'ai-product-cards';

  ids.forEach(id => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const inWishlist = (typeof wishlist !== 'undefined') && wishlist.includes(id);

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
  if (typeof wishlist === 'undefined') return;
  toggleWishlist(id, btn);
  btn.textContent = wishlist.includes(id) ? '♥' : '♡';
};

// ────────────── DOM helpers ──────────────

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
