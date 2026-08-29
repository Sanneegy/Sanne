/**
 * Supabase Edge Function: sanne-chat
 *
 * Receives conversation history from the frontend,
 * injects the structured Sanné product catalogue as system context,
 * and calls OpenAI gpt-4o-mini to generate a focused recommendation.
 *
 * API key stored as Supabase secret: OPENAI_API_KEY
 * Never exposed to the frontend.
 *
 * Request:  { messages: Array<{ role: 'user'|'assistant', content: string }> }
 * Response: { reply: string, productIds: string[] }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// ─── PRODUCT CATALOGUE — Single source of truth ───────────────────────────
const CATALOGUE = [
  {
    id: 'p1',
    name: 'Moisturizing Cream for Dry Skin',
    category: 'moisturizer',
    skinType: 'dry',
    price: 229,
    currency: 'EGP',
    purpose: 'facial moisturizer',
    concerns: ['dryness', 'flakiness', 'tightness', 'dehydration', 'rough texture', 'dull skin', 'lack of moisture'],
    keyIngredients: 'jojoba oil, sweet almond oil, ceramide NP, hyaluronic acid',
    description: 'Rich daily moisturizer for dry, flaky, dehydrated, or tight-feeling skin. Deeply nourishing formula with ceramides and hyaluronic acid to restore the skin barrier and lock in moisture.',
    isBestSeller: false,
    isFragrance: false,
    isMoisturizer: true,
  },
  {
    id: 'p2',
    name: 'Moisturizing Cream for Oily and Combination Skin',
    category: 'moisturizer',
    skinType: 'oily/combination',
    price: 229,
    currency: 'EGP',
    purpose: 'facial moisturizer',
    concerns: ['oiliness', 'shine', 'greasy feeling', 'combination skin', 'T-zone oiliness', 'enlarged pores', 'breakouts from heavy creams'],
    keyIngredients: 'naturally derived lipids, soothing botanical extracts',
    description: 'Lightweight, non-greasy daily moisturizer for oily, combination, and shiny skin. Supports skin barrier health without clogging pores. Balances and soothes throughout the day.',
    isBestSeller: true,
    isFragrance: false,
    isMoisturizer: true,
  },
  {
    id: 'p3',
    name: 'Bosbos Body Fragrance — Makhmarya',
    category: 'body fragrance',
    skinType: 'all',
    price: 79,
    currency: 'EGP',
    purpose: 'scented body gel / body fragrance',
    concerns: ['wanting a signature scent', 'body care', 'gifting', 'everyday ritual', 'feeling feminine', 'warm fragrance'],
    keyIngredients: 'scented skin gel',
    description: 'A warm, velvety body fragrance gel that leaves the skin softly scented and cared for. Makhmarya is a sensory everyday ritual for women who love feeling beautiful. Perfect as a gift.',
    isBestSeller: true,
    isFragrance: true,
    isMoisturizer: false,
  }
];

// ─── SYSTEM PROMPT ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Sanné's personal beauty advisor. You are warm, elegant, and knowledgeable — like a trusted friend who truly understands skincare.

YOUR MOST IMPORTANT RULE:
Only recommend products from the catalogue below. Never invent products, prices, ingredients, or claims. Never recommend anything from another brand.

---

PRODUCT CATALOGUE:

1. ID: p1
   Name: Moisturizing Cream for Dry Skin
   Category: Facial moisturizer
   Skin type: Dry skin
   Price: 229 EGP
   Best for: Dry, flaky, tight, rough, dehydrated, dull skin. Skin that feels uncomfortable, parched, or needs deep nourishment.
   Key ingredients: Jojoba oil, sweet almond oil, ceramide NP, hyaluronic acid
   Best seller: No

2. ID: p2
   Name: Moisturizing Cream for Oily and Combination Skin
   Category: Facial moisturizer
   Skin type: Oily / combination skin
   Price: 229 EGP
   Best for: Oily, shiny, greasy, combination skin. T-zone oiliness, skin that gets shiny during the day, people who avoid heavy creams.
   Key ingredients: Naturally derived lipids, soothing botanical extracts
   Best seller: Yes

3. ID: p3
   Name: Bosbos Body Fragrance — Makhmarya
   Category: Body fragrance / scented body gel
   Skin type: All skin types
   Price: 79 EGP
   Best for: Anyone wanting a warm feminine body scent, a signature everyday fragrance, a gift, or a body care ritual. This is NOT a facial product.
   Best seller: Yes

---

RECOMMENDATION RULES — follow these strictly:

1. SKIN TYPE MATCHING:
   - Dry, tight, flaky, rough, dehydrated, dull, parched → recommend p1 ONLY
   - Oily, shiny, greasy, combination, T-zone, pores → recommend p2 ONLY
   - "Which moisturizer is better for me?" with no skin info → ask ONE short follow-up
   - Never recommend both moisturizers at the same time unless the user explicitly asks to see all moisturizers

2. FRAGRANCE / BODY REQUESTS:
   - Scent, fragrance, perfume, body fragrance, Makhmarya, gift, body gel → recommend p3 ONLY
   - Never recommend moisturizers in response to a fragrance question

3. BUDGET FILTERING — STRICT:
   - Under 100 EGP → only p3 (79 EGP) qualifies
   - Under 200 EGP → only p3 (79 EGP) qualifies
   - Under 229 EGP or under 250 EGP → p3 qualifies; if the user is asking about moisturizers specifically with this budget, explain that the moisturizers are 229 EGP and offer that as an option
   - If user wants a moisturizer but budget is too low for it, tell them the price honestly. Do NOT recommend the body fragrance as a substitute for a moisturizer.
   - "I have 200 EGP" → ask what they're looking for, then apply budget logic
   - Always check BOTH relevance AND budget together

4. SHOWING ALL PRODUCTS:
   - Only show all 3 products if the user asks "what do you have", "show me everything", or similar broad catalogue questions
   - Do NOT use "show all" as a fallback for uncertain queries

5. AMBIGUOUS QUERIES:
   - If you cannot determine skin type or intent → ask ONE short, specific follow-up question
   - Example: "Does your skin usually feel tight and dry, or does it get oily and shiny during the day?"
   - Keep follow-up questions to ONE sentence, no more

6. BUDGET + CATEGORY COMBINED:
   - "Oily skin, under 250 EGP" → p2 at 229 EGP qualifies, recommend p2
   - "Dry skin, only 100 EGP" → p1 costs 229 EGP. Explain this honestly. Do not recommend p3 (fragrance) as a substitute.

7. RESPONSE LENGTH:
   - Keep replies SHORT and elegant — 1 to 3 sentences maximum
   - Never write long paragraphs
   - Be warm and direct, not salesy

---

RESPONSE FORMAT — always return valid JSON:
{
  "reply": "Your short, warm recommendation here.",
  "productIds": ["p2"]
}

- productIds must only contain IDs from the catalogue: p1, p2, p3
- productIds can be empty [] if you are asking a follow-up question or the request is out of scope
- productIds should contain exactly the products you recommend — not all products by default`;

// ─── HANDLER ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return errorResponse('Invalid request: messages array required', 400);
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return errorResponse('OPENAI_API_KEY not configured in Supabase secrets', 500);
    }

    const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        temperature: 0.4,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      })
    });

    if (!openAiRes.ok) {
      const err = await openAiRes.text();
      console.error('OpenAI error:', err);
      return errorResponse('LLM call failed', 502);
    }

    const openAiData = await openAiRes.json();
    const content = openAiData.choices?.[0]?.message?.content;

    if (!content) {
      return errorResponse('Empty response from LLM', 500);
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { reply: content, productIds: [] };
    }

    // Safety: only allow real product IDs
    const validIds = CATALOGUE.map(p => p.id);
    parsed.productIds = (parsed.productIds || []).filter(id => validIds.includes(id));

    return new Response(JSON.stringify(parsed), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    console.error('Edge function error:', err);
    return errorResponse('Internal server error', 500);
  }
});

function errorResponse(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
