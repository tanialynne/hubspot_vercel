import Stripe from 'stripe';

export default async function handler(req, res) {
  // CORS + Preflight
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
      basePrice = 2700,
      bumpPrice = 4900,
      successUrl = "https://yourdomain.com/success",
      cancelUrl = "https://yourdomain.com/cancel",
      baseLabel = "Main Product",
      bumpLabel = "Order Bump Product",
      basePriceId,
      bumpPriceId,
      baseProductId,
      bumpProductId,
      mode = "stage" // 'stage' or 'live'
    } = req.body;

    console.log("📩 Incoming data:", req.body);

    // Choose correct Stripe secret key
    const stripeSecretKey =
      mode === 'live'
        ? process.env.STRIPE_LIVE_SECRET_KEY
        : process.env.STRIPE_STAGE_SECRET_KEY;

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2022-11-15',
    });

    // Create customer
    /*const customer = await stripe.customers.create({
      name: `${firstName} ${lastName}`,
      email,
      phone
    });*/
    // Check if customer already exists by email
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1
    });

    let customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      console.log(`✅ Found existing customer: ${customer.id}`);
    } else {
      // Create new customer if not found
      customer = await stripe.customers.create({
        name: `${firstName} ${lastName}`,
        email,
        phone
      });
      console.log(`✅ Created new customer: ${customer.id}`);
    }

    // Calculate total amount
    const amount = withBump ? basePrice + bumpPrice : basePrice;

    // Create payment intent
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
        bumpProductId: withBump ? bumpProductId : ''
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
    } else {
      console.warn(`⚠️ No payment method found on payment intent ${paymentIntent.id}`);
    }


    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      customerId: customer.id
    });

  } catch (err) {
    console.error('❌ Error in /create-payment-intent:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
