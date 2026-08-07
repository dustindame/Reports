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

   Also records each purchase by email in `pro_purchases` (see
   20260807100000_add_pro_purchases.sql), so someone who bought Pro on
   one platform can "restore" the same persistent per-device unlock on
   another via /api/restore-purchase -- e.g. bought on the web tonight,
   restores it inside the Play Store app once that's live in ~2 weeks.
   Web and native purchases are otherwise two separate systems (browser
   localStorage vs. Google's own purchase records) with no automatic
   link between them; email is the bridge, entered voluntarily.

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
    if (url.pathname === "/api/register-purchase" && request.method === "POST") {
      return registerPurchase(request, env);
    }
    if (url.pathname === "/api/restore-purchase" && request.method === "POST") {
      return restorePurchase(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function createCheckoutSession(request, env, requestUrl) {
  let leagueCode, email;
  try {
    const body = await request.json();
    leagueCode = String(body.leagueCode || "").trim().toUpperCase();
    email = String(body.email || "").trim().toLowerCase();
  } catch (e) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  if (!leagueCode) {
    return jsonResponse({ error: "Missing league code." }, 400);
  }
  if (!email) {
    return jsonResponse({ error: "Sign in with Google first." }, 400);
  }

  const origin = `${requestUrl.protocol}//${requestUrl.host}`;
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": "Bid Board Pro Upgrade",
    "line_items[0][price_data][unit_amount]": String(PRO_PRICE_CENTS),
    "line_items[0][quantity]": "1",
    client_reference_id: leagueCode,
    // Pre-fills AND locks the checkout email to the verified Google
    // sign-in identity, rather than letting the buyer type any email
    // at checkout -- this is what makes the pro_purchases record
    // trustworthy enough to restore from later.
    customer_email: email,
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
    const email = session.customer_details?.email;
    if (email) {
      await recordPurchase(email, "stripe", env);
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

// Called by the Android app right after a real, confirmed Play
// purchase (the user is asked, optionally, for an email to enable
// cross-platform restore -- purchase itself already succeeded on
// their device regardless of whether they provide one).
//
// DISABLED as of 2026-08-07: as originally written, this endpoint
// accepted ANY email with zero proof a real purchase happened --
// anyone who found the URL could grant themselves (or anyone) a
// permanent free Pro unlock via restore-purchase. Closed off entirely
// rather than left exploitable, since nothing in the current UI
// legitimately calls this yet anyway (native Google Sign-In is itself
// disabled right now -- see shared/pro.js isInNativeApp()). Before
// re-enabling: verify the purchase server-side against Google's Play
// Developer API (requires a service account + purchases.products.get
// call using the actual purchase token from the client, not just a
// self-reported "trust me, I bought it" email).
async function registerPurchase(request, env) {
  return jsonResponse({ error: "Not available yet." }, 501);
}

// Called from Setup's "Restore Pro by email" flow, on either platform.
// Only ever returns a plain yes/no -- never leaks anything else about
// the stored row (source, timestamp) to the client.
async function restorePurchase(request, env) {
  let email;
  try {
    const body = await request.json();
    email = String(body.email || "").trim().toLowerCase();
  } catch (e) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  if (!email) {
    return jsonResponse({ error: "Enter your email." }, 400);
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/pro_purchases?email=eq.${encodeURIComponent(email)}&select=email`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!resp.ok) {
    return jsonResponse({ error: "Couldn't check that right now -- try again." }, 502);
  }
  const rows = await resp.json();
  return jsonResponse({ purchased: rows.length > 0 });
}

async function recordPurchase(email, source, env) {
  await fetch(`${SUPABASE_URL}/rest/v1/pro_purchases`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ email: email.toLowerCase(), source }),
  });
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
