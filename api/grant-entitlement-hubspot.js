/**
 * HubSpot Webhook Endpoint: Create Account + Grant RevenueCat Entitlement
 *
 * This endpoint is called by HubSpot workflows when a payment succeeds.
 * It creates a Firebase account and grants the appropriate RevenueCat entitlement.
 *
 * Expected request body:
 * {
 *   "email": "user@example.com",
 *   "password": "userPassword123!" (OPTIONAL - will auto-generate if not provided),
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "productSku": "prod_LIqSeKqv73Qh1Q",
 *   "billingPeriod": "monthly" | "annually",
 *   "mode": "stage" | "live"
 * }
 */

/**
 * Generate a secure random password
 * Format: 12 characters with uppercase, lowercase, numbers, and symbols
 */
function generateSecurePassword() {
  const length = 12;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';

  const allChars = uppercase + lowercase + numbers + symbols;

  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

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
      password: providedPassword,
      firstName,
      lastName = "",
      productSku,
      billingPeriod = "monthly",
      mode = "live",
    } = req.body;

    console.log(
      `📩 Processing entitlement grant for: ${email}, SKU: ${productSku}, Period: ${billingPeriod}, Mode: ${mode}`
    );
    console.log(`📋 Full request body:`, JSON.stringify(req.body, null, 2));

    // Auto-generate secure password if not provided
    const password = providedPassword || generateSecurePassword();
    const passwordWasGenerated = !providedPassword;

    if (passwordWasGenerated) {
      console.log(`🔐 Auto-generated secure password for user`);
    }

    // Validate required fields
    if (!email || !firstName || !productSku) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["email", "firstName", "productSku"],
      });
    }

    // Map Product SKU to RevenueCat Entitlement Identifier
    // NOTE: Use the Identifier from RevenueCat Dashboard Entitlements tab
    // Go to Product Catalog > Entitlements > Click on entitlement > Copy the "Identifier" field at the TOP
    const skuToEntitlement = {
      "prod_T5BhaH9IrB8aSx": "prod_T5BhaH9IrB8aSx", // Heroic Live (tier2)
      "prod_Khm6LKC72e2PKq": "prod_Khm6LKC72e2PKq", // Heroic Premium
      "prod_T6eTaEOoW1jH3N": "prod_T6eTaEOoW1jH3N", // Mastery one-time
      "mastery_multi_pay": "prod_T6eTaEOoW1jH3N", // Mastery multi-pay → same entitlement
      "prod_RLpwKxAeiuNmCe": "prod_RLpwKxAeiuNmCe", // Heroic Elite
      "prod_T9LTjZp9tDN642": "prod_T9LTjZp9tDN642", // Coach one-time
      "coach_multi_pay": "prod_T9LTjZp9tDN642", // Coach multi-pay → same entitlement
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

      // IMPORTANT: accountData.userId is a custom DB ID, not the Firebase Auth UID
      // We need to decode the JWT token to get the real Firebase Auth UID
      if (accountData.token) {
        try {
          // Decode JWT to get Firebase UID (it's in the 'sub' or 'user_id' claim)
          const tokenParts = accountData.token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            firebaseUserId = payload.user_id || payload.sub;
            console.log(`✅ Firebase Auth UID extracted from token: ${firebaseUserId}`);
            console.log(`   (Custom DB ID was: ${accountData.userId})`);
          }
        } catch (err) {
          console.log(`⚠️ Could not decode token, using DB ID as fallback:`, err.message);
          firebaseUserId = accountData.userId;
        }
      } else {
        firebaseUserId = accountData.userId;
      }

      accountCreated = true;
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
                mode: "live",
              }),
            }
          );

          if (signinResponse.ok) {
            const signinData = await signinResponse.json();

            // Extract Firebase UID from token (same as signup)
            if (signinData.token) {
              try {
                const tokenParts = signinData.token.split('.');
                if (tokenParts.length === 3) {
                  const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                  firebaseUserId = payload.user_id || payload.sub;
                  console.log(`✅ Signed in, Firebase Auth UID: ${firebaseUserId}`);
                  console.log(`   (Custom DB ID was: ${signinData.userId})`);
                }
              } catch (err) {
                console.log(`⚠️ Could not decode token, using DB ID:`, err.message);
                firebaseUserId = signinData.userId;
              }
            } else {
              firebaseUserId = signinData.userId;
            }
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

    // Determine purchase type and duration
    const isOneTimePurchase = productSku === 'prod_T9LTjZp9tDN642' || productSku === 'prod_T6eTaEOoW1jH3N';
    const isMultiPayPlan = productSku === 'coach_multi_pay' || productSku === 'mastery_multi_pay';

    // Calculate end time based on purchase type
    const startTime = Date.now();
    let endTime;

    if (isOneTimePurchase) {
      // One-time purchases: 100 years (lifetime access)
      endTime = startTime + (100 * 365 * 24 * 60 * 60 * 1000);
      console.log(`🎁 One-time purchase (${productSku}) - granting lifetime access (100 years)`);
    } else if (isMultiPayPlan) {
      // Multi-pay plan: grant 35 days per payment (like monthly subscription)
      // User gets renewed each month until payment 12, then needs manual conversion to lifetime
      endTime = startTime + (35 * 24 * 60 * 60 * 1000);
      console.log(`📅 Multi-pay plan (${productSku}) - granting 35 days (use renewal workflow for subsequent payments)`);
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

    // Generate password reset URL
    const passwordResetUrl = mode === 'live'
      ? 'https://heroic.us/reset-password'
      : 'https://dev.heroic.us/reset-password';

    return res.status(200).json({
      success: true,
      userId: firebaseUserId,
      email: email,
      password: passwordWasGenerated ? password : '[provided by user]',
      passwordWasGenerated: passwordWasGenerated,
      passwordResetUrl: passwordResetUrl,
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
