import Stripe from "stripe";

export default async function handler(req, res) {
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
      firstName,
      lastName,
      email,
      phone,
      basePrice,
      baseLabel = "Main Product",
      basePriceId = "",
      baseProductId = "",
      productType = "",
      period = "onetime", // 'monthly', 'annual', 'payment_plan', or 'onetime'
      installments = null, // Number of installments for payment plans
      hubspotFormGuid = "",
      acTags = "",
      successUrl = "https://heroic.us",
      mode = "stage", // 'stage' or 'live'
    } = req.body;

    console.log("📩 Incoming data:", req.body);

    // Validate required fields
    if (!firstName || !lastName || !email || !basePrice) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Choose correct Stripe secret key
    const stripeSecretKey =
      mode === "live"
        ? process.env.STRIPE_LIVE_SECRET_KEY
        : process.env.STRIPE_STAGE_SECRET_KEY;

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2022-11-15",
    });

    // Check if customer already exists
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 10,
    });

    if (existingCustomers.data.length === 1) {
      // Customer exists, use existing and update info if needed
      customer = existingCustomers.data[0];

      // Update customer info in case phone or name changed
      customer = await stripe.customers.update(customer.id, {
        name: `${firstName} ${lastName}`,
        phone: phone || customer.phone,
      });

      console.log("✅ Using existing customer:", customer.id);
    } else if (existingCustomers.data.length > 1) {
      // More than 1 user found, check if any are known heroic users
      customer = existingCustomers.data.find(
        (x) => x.metadata["heroic_user_id"]
      );
      if (!customer) {
        // If no heroic customer found, grab the first one
        customer = existingCustomers.data[0];
      }
      console.log("✅ Found multiple customers, using:", customer.id);
    } else {
      // Customer doesn't exist, create new one
      customer = await stripe.customers.create({
        name: `${firstName} ${lastName}`,
        email,
        phone,
      });

      console.log("✅ Created new customer:", customer.id);
    }

    // Determine if this is a subscription or one-time payment
    const isSubscription = (period === "monthly" || period === "annual" || period === "payment_plan");

    // Create Checkout Session with CUSTOM UI mode
    // This allows us to use our own form while still creating proper Checkout Sessions
    // that Revenue Cat can recognize
    const sessionMetadata = {
      basePrice: basePrice.toString(),
      baseLabel,
      email,
      firstname: firstName,
      lastname: lastName,
      basePriceId,
      baseProductId,
      productType,
      period,
      installments: installments?.toString() || '',
      hubspotFormGuid: hubspotFormGuid || '',
      acTags: acTags || '',
      source: "Heroic Pricing Module",
    };

    const sessionMode = isSubscription ? "subscription" : "payment";
    const lineItems = isSubscription && basePriceId
      ? [{ price: basePriceId, quantity: 1 }]
      : [{ price_data: { currency: "usd", product_data: { name: baseLabel }, unit_amount: basePrice }, quantity: 1 }];

    // Create Checkout Session for Revenue Cat tracking
    // Note: We create this but don't actually use it for payment collection
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: sessionMode,
      line_items: lineItems,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: successUrl,
      metadata: {
        ...sessionMetadata,
        custom_form: 'true', // Flag to indicate this was created via custom form
      },
      // Add subscription metadata for payment plans
      ...(period === "payment_plan" && installments && {
        subscription_data: {
          metadata: {
            ...sessionMetadata,
            is_payment_plan: 'true',
          }
        }
      }),
    });

    console.log("✅ Checkout session created:", checkoutSession.id);

    // Now create SetupIntent or PaymentIntent for custom form payment collection
    if (isSubscription) {
      // For subscriptions, create a SetupIntent
      const setupIntent = await stripe.setupIntents.create({
        customer: customer.id,
        payment_method_types: ['card'],
        metadata: {
          ...sessionMetadata,
          checkout_session_id: checkoutSession.id,
        },
      });

      console.log("✅ Setup intent created:", setupIntent.id);

      return res.status(200).json({
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
        checkoutSessionId: checkoutSession.id,
        customerId: customer.id,
        isSubscription: true,
        priceId: basePriceId,
      });
    } else {
      // For one-time payments, create PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: basePrice,
        currency: "usd",
        customer: customer.id,
        automatic_payment_methods: { enabled: true },
        description: baseLabel,
        metadata: {
          ...sessionMetadata,
          checkout_session_id: checkoutSession.id,
        },
      });

      console.log("✅ Payment intent created:", paymentIntent.id);

      return res.status(200).json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        checkoutSessionId: checkoutSession.id,
        customerId: customer.id,
        isSubscription: false,
      });
    }
  } catch (err) {
    console.error("❌ Error in /create-payment-intent:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message,
    });
  }
}
