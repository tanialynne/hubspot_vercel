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
    const { firstName, lastName, email, phone, withBump } = req.body;

    const customer = await stripe.customers.create({
      name: `${firstName} ${lastName}`,
      email,
      phone
    });

    const basePrice = 2700;
    const bumpPrice = 4900;
    const amount = withBump ? basePrice + bumpPrice : basePrice;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customer.id,
      description: withBump ? 'Main + Order Bump' : 'Main Only',
      metadata: {
        withBump: withBump.toString(),
        email,
        name: `${firstName} ${lastName}`
      }
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('❌ Stripe error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
