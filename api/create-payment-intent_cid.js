import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_STAGE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});

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
    const { firstName, lastName, email, phone, withBump, basePrice, bumpPrice } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if customer already exists
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: email,
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
      // More then 1 user found lets check if any are known heroic users
      customer = existingCustomers.data.find(x => x.metadata['heroic_user_id'])
      if (!customer) {
        // If no heroic customer are found just grab the first one
        customer = existingCustomers.data[0]
      }
    }
    if (!customer) {
      // Customer doesn't exist, create new one
      customer = await stripe.customers.create({
        name: `${firstName} ${lastName}`,
        email,
        phone
      });

      console.log('✅ Created new customer:', customer.id);
    }

    // Use prices from request body instead of hardcoded values
    const amount = withBump ? basePrice + bumpPrice : basePrice;

    // Create payment intent linked to customer
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customer.id,
      description: withBump ? 'Main + Order Bump' : 'Main Only',
      metadata: {
        withBump: withBump.toString(),
        email,
        name: `${firstName} ${lastName}`,
        basePrice: basePrice.toString(),
        bumpPrice: bumpPrice.toString(),
        source: 'Hubspot',
      }
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      customerId: customer.id
    });
  } catch (err) {
    console.error('❌ Stripe error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
}
