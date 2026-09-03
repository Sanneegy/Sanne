/**
 * Supabase Edge Function: sanne-chat
 *
 * Single Source of Truth for Catalogue: ./products-catalogue.json
 * Stateful Contract: Accepts & returns { reply, intent, productIds, state }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import CATALOGUE from './products-catalogue.json' with { type: 'json' };

const SYSTEM_PROMPT = `You are Sanné's personal beauty advisor. You are warm, concise, and helpful.

AUTHORITATIVE PRODUCT CATALOGUE:
${JSON.stringify(CATALOGUE, null, 2)}

AI-SPECIFIC INGREDIENT & PURPOSE METADATA:
1. p1 (Moisturizing Cream for Dry Skin, 229 EGP):
   Best for: Dry, tight, flaky, rough, dehydrated, dull skin.
   Ingredients status: UNAVAILABLE.
   Rule: If asked for ingredients, reply: "The full ingredient details for our moisturizers are still being finalized for ASK SANNÉ and will be available soon ♡ I can still help you choose between the Dry Skin and Oily & Combination formulas based on what your skin needs." NEVER invent ingredients.

2. p2 (Moisturizing Cream for Oily & Combination Skin, 229 EGP):
   Best for: Oily, shiny, greasy, combination skin, T-zone oiliness.
   Ingredients status: UNAVAILABLE.
   Rule: Same as p1. NEVER invent ingredients.

3. p3 (Bosbos Body Fragrance — Makhmarya, 79 EGP):
   Purpose: Concentrated warm body fragrance gel for pulse points.
   Key Ingredients & Roles:
   - Glycerin: Humectant that attracts and retains water at skin surface.
   - Carbopol 940: Creates the gel texture and structure.
   - PEG-12 Dimethicone: Contributes to a smoother, softer feel.
   - PEG-40 Hydrogenated Castor Oil: Disperses/solubilizes fragrance oil.
   - DPG & PG: Fragrance carriers. PG has humectant properties.
   - Fragrance Oil: Provides scent.

4. p4 (Rose Vanille Body Splash, 229 EGP, 220 ml):
   Purpose: Refreshing body fragrance mist with rose and vanilla notes.
   Key Ingredients & Roles:
   - Fragrance Oil: Rose Vanilla scent.
   - Ethyl Alcohol / Ethanol: Lightweight fragrance carrier, quick drying.
   - DPG: Distributes fragrance evenly.
   - PG: Solvent/carrier with humectant properties.
   - PEG-40 Hydrogenated Castor Oil: Solubilizer for fragrance oil in base.

---

RULES FOR STATE & INTENT RESOLUTION:

1. PENDING INTENT / CLARIFICATION:
   - If incoming state has pendingIntent (e.g. 'ingredient_question') and pendingClarification ('moisturizer_variant'), and the user's message resolves the clarification (e.g. 'dry' -> p1), YOU MUST RESUME THE PENDING INTENT!
   - Do NOT treat the clarification answer as a new recommendation query.

2. PRONOUN & REFERENCE RESOLUTION:
   - Resolve 'it', 'this', 'that', 'its ingredients', 'what is it for', 'how much' using state.currentProductId or state.candidateProductIds.

3. INGREDIENT RULES:
   - Never dump full internal formulas. Answer 2-4 key ingredients and roles.
   - Full list request: "I can share the key ingredients and what they do for you. The formula includes..."
   - Specific questions: Alcohol in Body Splash -> Yes, ethanol as lightweight carrier. Gel texture in Makhmarya -> Carbopol 940. Moisturizing feel -> Glycerin.
   - Moisturizers: Always use the exact unavailable text. NEVER invent ingredients.

4. BUDGET + RELEVANCE:
   - Dry skin under 100 EGP: Explain Dry Skin Moisturizer is 229 EGP, no matching moisturizer under 100 EGP. DO NOT recommend Makhmarya.

5. MEDICAL & COSMETIC BOUNDARIES:
   - Provide cosmetic guidance for described traits (oily T-zone -> p2).
   - Do NOT diagnose medical conditions or claim acne/disease cures.

6. LANGUAGE:
   - Respond in customer's language (English, Arabic, Arabizi).
   - Keep answers short: 1 to 4 sentences maximum.

RESPONSE FORMAT (JSON ONLY):
{
  "reply": "Conversational text response",
  "intent": "recommendation" | "ingredient_question" | "purpose_question" | "price_question" | "size_question" | "comparison" | "catalogue" | "clarification" | "disclaimer" | "follow_up",
  "productIds": ["p1"],
  "state": {
    "currentProductId": "p1",
    "candidateProductIds": ["p1"],
    "lastIntent": "ingredient_question",
    "pendingIntent": null,
    "pendingClarification": null,
    "activeConstraints": { "skinType": "dry", "budgetMax": null, "category": null }
  }
}`;

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
    const { messages, state } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request: messages array required' }), { status: 400 });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY secret not configured in Supabase' }), { status: 500 });
    }

    const systemMessageWithContext = `${SYSTEM_PROMPT}\n\nACTIVE CONVERSATION STATE:\n${JSON.stringify(state || {}, null, 2)}`;

    const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessageWithContext },
          ...messages
        ],
        temperature: 0.3,
        max_tokens: 350,
        response_format: { type: 'json_object' }
      })
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      console.error('OpenAI API Error:', errText);
      return new Response(JSON.stringify({ error: 'LLM call failed', details: errText }), { status: 502 });
    }

    const openAiData = await openAiRes.json();
    const content = openAiData.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{}');

    // Safety check: validate productIds against canonical catalogue
    const validIds = CATALOGUE.map(p => p.id);
    parsed.productIds = (parsed.productIds || []).filter(id => validIds.includes(id));

    return new Response(JSON.stringify(parsed), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    console.error('Edge Function Exception:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error', message: err.message }), { status: 500 });
  }
});
