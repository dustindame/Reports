/* ===========================================================
   Cloudflare Worker entry point.

   Adds two API routes for a WEB-based Pro purchase path (Stripe),
   independent of Google Play Billing -- launched 2026-08-06 because
   the Play Store distribution channel is stuck behind a mandatory
   14-day closed-testing window and fantasy draft season can't wait
   that long. Everything else falls through to the static site
   unchanged.

   Both purchase paths (this one, and Play Billing once it's live)
   write to the exact same `draft_config.is_pro` column, so a league
   upgraded here shows Pro immediately on every device/app viewing it
   -- web, phone, TV -- with zero extra plumbing needed on that end.

   Required secrets (set via `wrangler secret put <NAME>`, never
   committed): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
   SUPABASE_SERVICE_ROLE_KEY.
   =========================================================== */

const SUPABASE_URL = "https://esoywmghcnvtauxzabvx.supabase.co";
const PRO_PRICE_CENTS = 399; // $3.99, matches the Play Store product

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/create-checkout-session" && request.method === "POST") {
      return createCheckoutSession(request, env, url);
    }
    if (url.pathname === "/api/stripe-webhook" && request.method === "POST") {
      return handleStripeWebhook(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function createCheckoutSession(request, env, requestUrl) {
  let leagueCode;
  try {
    const body = await request.json();
    leagueCode = String(body.leagueCode || "").trim().toUpperCase();
  } catch (e) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  if (!leagueCode) {
    return jsonResponse({ error: "Missing league code." }, 400);
  }

  const origin = `${requestUrl.protocol}//${requestUrl.host}`;
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": "Bid Board Pro Upgrade",
    "line_items[0][price_data][unit_amount]": String(PRO_PRICE_CENTS),
    "line_items[0][quantity]": "1",
    client_reference_id: leagueCode,
    success_url: `${origin}/setup.html?purchase=success&league=${encodeURIComponent(leagueCode)}`,
    cancel_url: `${origin}/setup.html?purchase=cancelled`,
  });

  const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!stripeResp.ok) {
    const errText = await stripeResp.text();
    return jsonResponse({ error: `Stripe error: ${errText}` }, 502);
  }

  const session = await stripeResp.json();
  return jsonResponse({ url: session.url });
}

async function handleStripeWebhook(request, env) {
  const signatureHeader = request.headers.get("Stripe-Signature");
  const rawBody = await request.text();

  const valid = await verifyStripeSignature(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const leagueCode = session.client_reference_id;
    if (leagueCode) {
      await markLeaguePro(leagueCode, env);
    }
  }

  return new Response("ok", { status: 200 });
}

async function markLeaguePro(leagueCode, env) {
  await fetch(`${SUPABASE_URL}/rest/v1/draft_config?league_code=eq.${encodeURIComponent(leagueCode)}`, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ is_pro: true }),
  });
  // No is_pro-downgrade path exists anywhere in this system by design
  // (see 20260731150000_never_downgrade_league_pro.sql) -- a webhook
  // retry or duplicate event safely re-applies the same true value.
}

async function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(computedSig, expectedSig);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
