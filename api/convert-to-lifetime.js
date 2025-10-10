/**
 * Convert Multi-Pay User to Lifetime Access
 *
 * This endpoint is called when a user completes their 12th payment on a multi-pay plan.
 * It converts their limited entitlement to lifetime access (100 years).
 *
 * Expected request body:
 * {
 *   "email": "user@example.com",
 *   "firebaseUserId": "OlEnUDeyHmRgXwG2jkVlyylL5fj2",
 *   "productSku": "coach_multi_pay" | "mastery_multi_pay"
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
    const { email, firebaseUserId, productSku } = req.body;

    console.log(`🎓 Converting multi-pay user to lifetime access`);
    console.log(`   Email: ${email}`);
    console.log(`   Firebase UID: ${firebaseUserId}`);
    console.log(`   Product SKU: ${productSku}`);

    // Validate required fields
    if (!email || !firebaseUserId || !productSku) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["email", "firebaseUserId", "productSku"],
      });
    }

    // Map multi-pay SKUs to entitlements
    const skuToEntitlement = {
      "coach_multi_pay": "prod_T9LTjZp9tDN642",
      "mastery_multi_pay": "prod_T6eTaEOoW1jH3N",
    };

    const entitlement = skuToEntitlement[productSku];
    if (!entitlement) {
      return res.status(400).json({
        error: "Invalid product SKU for multi-pay conversion",
        sku: productSku,
        validSkus: Object.keys(skuToEntitlement),
      });
    }

    const REVENUECAT_V1_API_KEY = "sk_xLwqCozTkMdLOzMjqiccWGaaQjNpZ";

    // Step 1: Get current entitlement to verify user exists
    console.log(`📋 Checking current entitlement...`);

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

    if (currentEntitlement) {
      console.log(`✅ Current entitlement expires: ${currentEntitlement.expires_date}`);
    } else {
      console.log(`⚠️ No current entitlement found for ${entitlement}`);
    }

    // Step 2: Grant lifetime access (100 years)
    const startTime = Date.now();
    const endTime = startTime + (100 * 365 * 24 * 60 * 60 * 1000); // 100 years

    console.log(`🎁 Granting lifetime access (100 years)`);
    console.log(`⏰ New expiry: ${new Date(endTime).toISOString()}`);

    const grantUrl = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(firebaseUserId)}/entitlements/${encodeURIComponent(entitlement)}/promotional`;
    const grantPayload = {
      start_time_ms: startTime,
      end_time_ms: endTime,
    };

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
        error: "Failed to convert to lifetime access",
        details: rcError,
      });
    }

    const rcData = await revenueCatResponse.json();
    console.log("✅ Converted to lifetime access:", rcData);

    return res.status(200).json({
      success: true,
      message: "User converted to lifetime access",
      userId: firebaseUserId,
      email: email,
      productSku: productSku,
      entitlement: entitlement,
      previousExpiry: currentEntitlement?.expires_date || null,
      newExpiry: new Date(endTime).toISOString(),
      revenueCatResponse: rcData,
    });

  } catch (err) {
    console.error("❌ Error in convert-to-lifetime:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message,
    });
  }
}
