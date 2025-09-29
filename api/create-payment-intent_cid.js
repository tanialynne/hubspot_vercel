import Stripe from 'stripe';

export default async function handler(req, res) {
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
      firstName,
      lastName,
      email,
      phone,
      withBump = false,
      basePrice,
      bumpPrice = 0,
      baseLabel = "Main Product",
      bumpLabel = "",
      basePriceId = "",
      bumpPriceId = "",
      baseProductId = "",
      bumpProductId = "",
      mode = "stage" // 'stage' or 'live'
    } = req.body;

    console.log("📩 Incoming data:", req.body);

    // Validate required fields
    if (!firstName || !lastName || !email || !basePrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Choose correct Stripe secret key
    const stripeSecretKey =
      mode === 'live'
        ? process.env.STRIPE_LIVE_SECRET_KEY
        : process.env.STRIPE_STAGE_SECRET_KEY;

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2022-11-15',
    });

    // Check if customer already exists
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 10
    });

    if (existingCustomers.data.length === 1) {
      // Customer exists, use existing and update info if needed
      customer = existingCustomers.data[0];

      // Update customer info in case phone or name changed
      customer = await stripe.customers.update(customer.id, {
        name: `${firstName} ${lastName}`,
        phone: phone || customer.phone
      });

      console.log('✅ Using existing customer:', customer.id);
    } else if (existingCustomers.data.length > 1) {
      // More than 1 user found, check if any are known heroic users
      customer = existingCustomers.data.find(x => x.metadata['heroic_user_id']);
      if (!customer) {
        // If no heroic customer found, grab the first one
        customer = existingCustomers.data[0];
      }
      console.log('✅ Found multiple customers, using:', customer.id);
    } else {
      // Customer doesn't exist, create new one
      customer = await stripe.customers.create({
        name: `${firstName} ${lastName}`,
        email,
        phone
      });

      console.log('✅ Created new customer:', customer.id);
    }

    // Calculate total amount
    const amount = withBump ? basePrice + bumpPrice : basePrice;

    // Create payment intent linked to customer
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customer.id,
      setup_future_usage: 'off_session',
      automatic_payment_methods: { enabled: true },
      description: withBump ? `${baseLabel} + ${bumpLabel}` : baseLabel,
      metadata: {
        withBump: withBump.toString(),
        basePrice: basePrice.toString(),
        bumpPrice: withBump ? bumpPrice.toString() : '0',
        baseLabel,
        bumpLabel: withBump ? bumpLabel : '',
        email,
        firstname: firstName,
        lastname: lastName,
        basePriceId,
        bumpPriceId: withBump ? bumpPriceId : '',
        baseProductId,
        bumpProductId: withBump ? bumpProductId : '',
        source: 'Heroic Pricing Module'
      }
    });

    // Retrieve confirmed payment intent to get payment method ID
    const confirmedPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
    const paymentMethodId = confirmedPaymentIntent.payment_method;

    if (paymentMethodId) {
      // Explicitly attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
      console.log(`✅ Attached payment method ${paymentMethodId} to customer ${customer.id}`);

      // Set as default payment method
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethodId }
      });
      console.log(`✅ Set default payment method for customer ${customer.id}`);

      // Create a SetupIntent to confirm off-session usage
      await stripe.setupIntents.create({
        customer: customer.id,
        payment_method: paymentMethodId,
        usage: 'off_session'
      });
      console.log(`✅ SetupIntent created to confirm off-session usage for payment method ${paymentMethodId}`);
    } else {
      console.warn(`⚠️ No payment method found on payment intent ${paymentIntent.id}`);
    }

    console.log('✅ Payment intent created:', paymentIntent.id);

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      customerId: customer.id
    });

  } catch (err) {
    console.error('❌ Error in /create-payment-intent-cid:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
}
