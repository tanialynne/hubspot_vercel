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
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      email,
      password,
      firstName,
      lastName = '',
      productSku,
      billingPeriod = 'annually',
      mode = 'stage'
    } = req.body;

    console.log(`📩 Processing entitlement grant for: ${email}, SKU: ${productSku}, Period: ${billingPeriod}`);

    // Validate required fields
    if (!email || !password || !firstName || !productSku) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password', 'firstName', 'productSku']
      });
    }

    // Map SKU to RevenueCat entitlement
    const skuToEntitlement = {
      'prod_LIqSeKqv73Qh1Q': 'premium',
      'prod_T5BhaH9IrB8aSx': 'prod_T5BhaH9IrB8aSx',
      'prod_Khm6LKC72e2PKq': 'premium',
      'prod_T6eTaEOoW1jH3N': 'mastery',
      'prod_RLpwKxAeiuNmCe': 'elite',
      'prod_T9LTjZp9tDN642': 'coach'
    };

    const entitlement = skuToEntitlement[productSku];
    if (!entitlement) {
      return res.status(400).json({
        error: 'Invalid product SKU',
        sku: productSku
      });
    }

    // Calculate duration
    const duration = billingPeriod === 'monthly' ? 'P1M' : 'P1Y';

    // Step 1: Create Firebase account using existing endpoint
    console.log('🔥 Creating Firebase account...');
    const accountResponse = await fetch('https://hubspot-vercel-chi.vercel.app/api/create-heroic-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        firstName,
        lastName,
        action: 'signup',
        mode
      })
    });

    let firebaseUserId = email; // Fallback to email
    let accountCreated = false;

    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      firebaseUserId = accountData.userId;
      accountCreated = true;
      console.log(`✅ Firebase account created: ${firebaseUserId}`);
    } else {
      const errorData = await accountResponse.json();
      console.log('⚠️ Account creation failed:', errorData.error);

      // If account already exists, continue with email as userId
      if (errorData.error?.includes('already exists')) {
        console.log('📧 Account exists, using email as userId');
      } else {
        console.log('⚠️ Using email as fallback userId');
      }
    }

    // Step 2: Grant RevenueCat entitlement
    console.log(`🎟️ Granting RevenueCat entitlement: ${entitlement} for ${duration}`);

    const REVENUECAT_SECRET_KEY = 'sk_jDIqjivDBkOxfPYAETptVTOIsMDiS';
    const REVENUECAT_PROJECT_ID = 'fda392bf';

    const revenueCatResponse = await fetch(
      `https://api.revenuecat.com/v2/projects/${REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(firebaseUserId)}/entitlements/${entitlement}/promotional`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REVENUECAT_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          duration: duration,
          start_time_ms: Date.now()
        })
      }
    );

    if (!revenueCatResponse.ok) {
      const rcError = await revenueCatResponse.json();
      console.error('❌ RevenueCat API error:', rcError);
      return res.status(500).json({
        error: 'Failed to grant entitlement',
        details: rcError,
        userId: firebaseUserId,
        accountCreated: accountCreated
      });
    }

    const rcData = await revenueCatResponse.json();
    console.log('✅ RevenueCat entitlement granted:', rcData);

    return res.status(200).json({
      success: true,
      userId: firebaseUserId,
      entitlement: entitlement,
      duration: duration,
      accountCreated: accountCreated,
      revenueCatResponse: rcData
    });

  } catch (err) {
    console.error('❌ Error in grant-entitlement-hubspot:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
}
