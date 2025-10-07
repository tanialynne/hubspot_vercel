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

    // Build line items for checkout session
    const lineItems = [];

    if (basePriceId) {
      // Use existing Stripe Price ID
      lineItems.push({
        price: basePriceId,
        quantity: 1,
      });
    } else {
      // Create ad-hoc price
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: baseLabel,
          },
          unit_amount: basePrice,
        },
        quantity: 1,
      });
    }

    // Determine session mode based on period
    // monthly, annual, and payment_plan are subscriptions; onetime is a one-time payment
    const sessionMode = (period === "monthly" || period === "annual" || period === "payment_plan")
      ? "subscription"
      : "payment";

    // Build session params
    const sessionParams = {
      line_items: lineItems,
      mode: sessionMode,
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: {
        basePrice: basePrice.toString(),
        baseLabel,
        email,
        firstname: firstName,
        lastname: lastName,
        basePriceId,
        baseProductId,
        productType,
        period,
        hubspotFormGuid: hubspotFormGuid || '',
        acTags: acTags || '',
        source: "Heroic Pricing Module",
      },
      success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: successUrl,
    };

    // Only add payment_intent_data for one-time payments
    if (sessionMode === "payment") {
      sessionParams.payment_intent_data = {
        setup_future_usage: "off_session",
        capture_method: 'automatic',
        metadata: {
          basePrice: basePrice.toString(),
          baseLabel,
          email,
          firstname: firstName,
          lastname: lastName,
          basePriceId,
          baseProductId,
          productType,
          source: "Heroic Pricing Module",
        },
      };
    } else {
      // For subscriptions, add subscription_data instead
      sessionParams.subscription_data = {
        metadata: {
          basePrice: basePrice.toString(),
          baseLabel,
          email,
          firstname: firstName,
          lastname: lastName,
          basePriceId,
          baseProductId,
          productType,
          period,
          source: "Heroic Pricing Module",
        },
      };

      // If this is a payment plan with fixed installments, cancel after N payments
      if (period === "payment_plan" && installments) {
        sessionParams.subscription_data.trial_settings = {
          end_behavior: {
            missing_payment_method: 'cancel'
          }
        };
        // Note: Stripe doesn't natively support "cancel after N payments" in checkout sessions
        // You'll need to use a webhook to cancel the subscription after 12 payments
        sessionParams.subscription_data.metadata.installments = installments.toString();
        sessionParams.subscription_data.metadata.is_payment_plan = 'true';
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("✅ Checkout session created:", session.id);

    // For one-time payments, retrieve the payment intent to get client secret
    if (sessionMode === "payment" && session.payment_intent) {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent
      );

      return res.status(200).json({
        clientSecret: paymentIntent.client_secret,
        sessionId: session.id,
        customerId: customer.id,
        isSubscription: false,
      });
    }

    // For subscriptions, return the session ID for redirect to Stripe Checkout
    return res.status(200).json({
      sessionId: session.id,
      customerId: customer.id,
      isSubscription: true,
    });
  } catch (err) {
    console.error("❌ Error in /create-payment-intent:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message,
    });
  }
}
