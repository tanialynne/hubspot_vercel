/**
 * HubSpot Webhook Endpoint: Create Account + Grant RevenueCat Entitlement
 *
 * This endpoint is called by HubSpot workflows when a payment succeeds.
 * It creates a Firebase account and grants the appropriate RevenueCat entitlement.
 *
 * Expected request body:
 * {
 *   "email": "user@example.com",
 *   "password": "userPassword123!",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "productSku": "prod_LIqSeKqv73Qh1Q",
 *   "billingPeriod": "monthly" | "annually",
 *   "mode": "stage" | "live"
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
      password,
      firstName,
      lastName = "",
      productSku,
      billingPeriod = "monthly",
      mode = "live",
    } = req.body;

    console.log(
      `📩 Processing entitlement grant for: ${email}, SKU: ${productSku}, Period: ${billingPeriod}`
    );

    // Validate required fields
    if (!email || !password || !firstName || !productSku) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["email", "password", "firstName", "productSku"],
      });
    }

    // Map Stripe Product SKU to RevenueCat Entitlement Identifier
    // NOTE: Use the Identifier from RevenueCat Dashboard Entitlements tab
    // Go to Product Catalog > Entitlements > Click on entitlement > Copy the "Identifier" field at the TOP
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

    // Step 1: Create Firebase account using existing endpoint
    console.log("🔥 Creating Firebase account...");
    const accountResponse = await fetch(
      "https://hubspot-vercel-chi.vercel.app/api/create-heroic-account",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          action: "signup",
          mode: "live",
        }),
      }
    );

    let firebaseUserId = email; // Fallback to email
    let accountCreated = false;

    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      firebaseUserId = accountData.userId;
      accountCreated = true;
      console.log(`✅ Firebase account created: ${firebaseUserId}`);
    } else {
      const errorData = await accountResponse.json();
      console.log("⚠️ Account creation failed:", errorData.error);

      // If account already exists, try to sign in to get the userId
      if (
        errorData.error?.includes("already exists") ||
        errorData.error?.includes("already-in-use")
      ) {
        console.log("📧 Account exists, attempting sign-in to get userId...");

        try {
          const signinResponse = await fetch(
            "https://hubspot-vercel-chi.vercel.app/api/create-heroic-account",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email,
                password,
                action: "signin",
                "live",
              }),
            }
          );

          if (signinResponse.ok) {
            const signinData = await signinResponse.json();
            firebaseUserId = signinData.userId;
            console.log(`✅ Signed in, userId: ${firebaseUserId}`);
          } else {
            console.log("⚠️ Sign-in failed, using email as userId");
          }
        } catch (signinError) {
          console.log("⚠️ Sign-in error:", signinError.message);
        }
      } else {
        console.log("⚠️ Using email as fallback userId");
      }
    }

    // Step 2: Create subscriber in RevenueCat first
    const REVENUECAT_V1_API_KEY = "sk_xLwqCozTkMdLOzMjqiccWGaaQjNpZ";

    console.log(`👤 Initializing RevenueCat subscriber: ${firebaseUserId}`);
    console.log(`🔑 Using entitlement identifier: ${entitlement}`);

    // Get subscriber info (this creates the subscriber if it doesn't exist)
    try {
      const getSubscriberResponse = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(firebaseUserId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${REVENUECAT_V1_API_KEY}`,
          },
        }
      );

      if (getSubscriberResponse.ok) {
        const subscriberData = await getSubscriberResponse.json();
        console.log(`✅ RevenueCat subscriber found:`, JSON.stringify(subscriberData.subscriber?.subscriptions || {}, null, 2));
      } else {
        const errorData = await getSubscriberResponse.json();
        console.log(`⚠️ Subscriber GET returned ${getSubscriberResponse.status}:`, errorData);
      }

      // Set subscriber attributes
      const attrResponse = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(firebaseUserId)}/attributes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${REVENUECAT_V1_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            attributes: {
              $email: { value: email },
              $displayName: { value: `${firstName} ${lastName}`.trim() },
            },
          }),
        }
      );

      if (attrResponse.ok) {
        console.log(`✅ Subscriber attributes updated`);
      } else {
        const attrError = await attrResponse.json();
        console.log(`⚠️ Attribute update failed:`, attrError);
      }
    } catch (err) {
      console.log(`⚠️ Subscriber initialization warning:`, err.message);
    }

    // Step 3: Grant RevenueCat entitlement
    console.log(
      `🎟️ Granting RevenueCat entitlement: ${entitlement} for ${duration}`
    );

    // Determine if this is a one-time purchase (Coach) or subscription
    const isOneTimePurchase = productSku === 'prod_T9LTjZp9tDN642'; // Coach bundle

    // Calculate end time based on purchase type
    const startTime = Date.now();
    let endTime;

    if (isOneTimePurchase) {
      // One-time purchases: 100 years (lifetime access)
      endTime = startTime + (100 * 365 * 24 * 60 * 60 * 1000);
      console.log(`🎁 One-time purchase detected - granting lifetime access (100 years)`);
    } else if (duration === 'P1M') {
      // Monthly subscription: 35 days (5 day grace period)
      endTime = startTime + (35 * 24 * 60 * 60 * 1000);
      console.log(`📅 Monthly subscription - granting 35 days (renewal workflow needed)`);
    } else if (duration === 'P1Y') {
      // Annual subscription: 370 days (5 day grace period)
      endTime = startTime + (370 * 24 * 60 * 60 * 1000);
      console.log(`📅 Annual subscription - granting 370 days (renewal workflow needed)`);
    } else {
      // Default to 1 year
      endTime = startTime + (365 * 24 * 60 * 60 * 1000);
    }

    console.log(`⏰ Setting entitlement from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

    // Grant promotional entitlement
    // Note: The subscriber MUST exist in RevenueCat before granting promotional entitlements
    const grantUrl = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(firebaseUserId)}/entitlements/${encodeURIComponent(entitlement)}/promotional`;
    const grantPayload = {
      start_time_ms: startTime,
      end_time_ms: endTime,
    };

    console.log(`📤 Grant URL: ${grantUrl}`);
    console.log(`📤 Grant Payload:`, JSON.stringify(grantPayload, null, 2));

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
        error: "Failed to grant entitlement",
        details: rcError,
        userId: firebaseUserId,
        accountCreated: accountCreated,
      });
    }

    const rcData = await revenueCatResponse.json();
    console.log("✅ RevenueCat entitlement granted:", rcData);

    return res.status(200).json({
      success: true,
      userId: firebaseUserId,
      entitlement: entitlement,
      duration: duration,
      accountCreated: accountCreated,
      revenueCatResponse: rcData,
    });
  } catch (err) {
    console.error("❌ Error in grant-entitlement-hubspot:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message,
    });
  }
}
