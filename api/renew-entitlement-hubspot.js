/**
 * HubSpot Webhook Endpoint: Renew RevenueCat Entitlement
 *
 * This endpoint is called by HubSpot workflows when a subscription renewal payment succeeds.
 * It extends the existing RevenueCat entitlement for another billing period.
 *
 * Expected request body:
 * {
 *   "email": "user@example.com",
 *   "productSku": "prod_LIqSeKqv73Qh1Q",
 *   "billingPeriod": "monthly" | "annually"
 * }
 */

export default async function handler(req, res) {
  // CORS headers
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      email,
      productSku,
      billingPeriod = "monthly",
    } = req.body;

    console.log(
      `🔄 Processing entitlement RENEWAL for: ${email}, SKU: ${productSku}, Period: ${billingPeriod}`
    );
    console.log(`📋 Full request body:`, JSON.stringify(req.body, null, 2));

    // Validate required fields
    if (!email || !productSku) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["email", "productSku"],
      });
    }

    // Map Stripe Product SKU to RevenueCat Entitlement Identifier
    const skuToEntitlement = {
      "prod_T5BhaH9IrB8aSx": "prod_T5BhaH9IrB8aSx", // Heroic Live (tier2)
      "prod_Khm6LKC72e2PKq": "prod_Khm6LKC72e2PKq", // Heroic Premium
      "prod_T6eTaEOoW1jH3N": "prod_T6eTaEOoW1jH3N", // Mastery test
      "prod_RLpwKxAeiuNmCe": "prod_RLpwKxAeiuNmCe", // Heroic Elite
      "prod_T9LTjZp9tDN642": "prod_T9LTjZp9tDN642", // Coach test
    };

    const entitlement = skuToEntitlement[productSku];
    if (!entitlement) {
      return res.status(400).json({
        error: "Invalid product SKU",
        sku: productSku,
      });
    }

    // Calculate duration
    const duration = billingPeriod === "monthly" ? "P1M" : "P1Y";

    // Step 1: Sign in to get the user's Firebase UID
    console.log("🔐 Looking up user Firebase UID...");

    const signinResponse = await fetch(
      "https://hubspot-vercel-chi.vercel.app/api/create-heroic-account",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          // Note: We don't have the password for renewal, so we need to look up the user differently
          // This is a limitation - we'll need to use email to find the Firebase UID
          action: "lookup", // This would need to be implemented in create-heroic-account.js
        }),
      }
    );

    let firebaseUserId;

    if (signinResponse.ok) {
      const userData = await signinResponse.json();
      if (userData.token) {
        const tokenParts = userData.token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          firebaseUserId = payload.user_id || payload.sub;
        }
      }
    }

    // Fallback: Query RevenueCat by email attribute to find the user
    if (!firebaseUserId) {
      console.log("⚠️ Could not get Firebase UID via login, searching RevenueCat by email...");

      // This is a workaround: we'll need to search for the user in RevenueCat
      // For now, we'll require the firebaseUserId to be passed in the request
      firebaseUserId = req.body.firebaseUserId;

      if (!firebaseUserId) {
        return res.status(400).json({
          error: "Could not determine Firebase UID. Please include firebaseUserId in request.",
          hint: "Add firebaseUserId as a custom property in HubSpot or use a different lookup method"
        });
      }
    }

    console.log(`✅ Found Firebase UID: ${firebaseUserId}`);

    // Step 2: Get current entitlement from RevenueCat
    const REVENUECAT_V1_API_KEY = "sk_xLwqCozTkMdLOzMjqiccWGaaQjNpZ";

    console.log(`👤 Fetching current entitlement from RevenueCat...`);

    const getSubscriberResponse = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(firebaseUserId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${REVENUECAT_V1_API_KEY}`,
        },
      }
    );

    if (!getSubscriberResponse.ok) {
      const error = await getSubscriberResponse.json();
      return res.status(404).json({
        error: "User not found in RevenueCat",
        details: error,
      });
    }

    const subscriberData = await getSubscriberResponse.json();
    const currentEntitlement = subscriberData.subscriber?.entitlements?.[entitlement];

    let startTime, endTime;

    if (currentEntitlement && currentEntitlement.expires_date) {
      // Extend from current expiration date
      const currentExpiry = new Date(currentEntitlement.expires_date).getTime();
      startTime = currentExpiry;
      console.log(`📅 Extending from current expiry: ${new Date(currentExpiry).toISOString()}`);
    } else {
      // Start from now if no current entitlement
      startTime = Date.now();
      console.log(`📅 No current entitlement, starting from now`);
    }

    // Calculate new end time
    if (billingPeriod === "monthly") {
      endTime = startTime + (35 * 24 * 60 * 60 * 1000); // 35 days
      console.log(`📅 Monthly renewal - adding 35 days`);
    } else {
      endTime = startTime + (370 * 24 * 60 * 60 * 1000); // 370 days
      console.log(`📅 Annual renewal - adding 370 days`);
    }

    console.log(`⏰ New entitlement period: ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

    // Step 3: Grant/extend the entitlement
    const grantUrl = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(firebaseUserId)}/entitlements/${encodeURIComponent(entitlement)}/promotional`;
    const grantPayload = {
      start_time_ms: startTime,
      end_time_ms: endTime,
    };

    console.log(`📤 Renewing entitlement...`);

    const revenueCatResponse = await fetch(grantUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REVENUECAT_V1_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(grantPayload),
    });

    if (!revenueCatResponse.ok) {
      const rcError = await revenueCatResponse.json();
      console.error("❌ RevenueCat API error:", rcError);
      return res.status(500).json({
        error: "Failed to renew entitlement",
        details: rcError,
      });
    }

    const rcData = await revenueCatResponse.json();
    console.log("✅ RevenueCat entitlement renewed:", rcData);

    return res.status(200).json({
      success: true,
      userId: firebaseUserId,
      entitlement: entitlement,
      duration: duration,
      previousExpiry: currentEntitlement?.expires_date || null,
      newExpiry: new Date(endTime).toISOString(),
      revenueCatResponse: rcData,
    });

  } catch (err) {
    console.error("❌ Error in renew-entitlement-hubspot:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message,
    });
  }
}
