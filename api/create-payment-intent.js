const stripe = require('stripe')(process.env.STRIPE_STAGE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    let body = req.body;

    // Fallback to manual parsing if req.body is undefined
    if (!body || Object.keys(body).length === 0) {
      body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => (data += chunk));
        req.on('end', () => resolve(JSON.parse(data)));
        req.on('error', reject);
      });
    }

    const { firstName, lastName, email, phone, withBump } = body;

    console.log('📩 Incoming data:', body);

    const customer = await stripe.customers.create({
      name: `${firstName} ${lastName}`,
      email,
      phone,
    });
    console.log('👤 Created customer:', customer.id);

    const basePrice = 2700;
    const bumpPrice = 4900;
    const amount = withBump ? basePrice + bumpPrice : basePrice;

    console.log('💵 Total amount (cents):', amount);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customer.id,
      description: withBump ? 'Main + Order Bump' : 'Main Only',
      metadata: {
        withBump: withBump.toString(),
        email,
        name: `${firstName} ${lastName}`,
      },
    });

    console.log('✅ PaymentIntent created:', paymentIntent.id);
    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('❌ Error in /create-payment-intent:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
