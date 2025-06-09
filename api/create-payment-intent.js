const stripe = require('stripe')(process.env.STRIPE_STAGE_SECRET_KEY);  

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    // Parse body manually because Vercel doesn't auto-parse JSON in serverless
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(JSON.parse(data)));
      req.on('error', reject);
    });

    const { firstName, lastName, email, phone, withBump } = body;
    console.log("📩 Incoming data:", body);

    // Create Stripe Customer
    const customer = await stripe.customers.create({
      name: `${firstName} ${lastName}`,
      email,
      phone
    });
    console.log("👤 Created customer:", customer.id);

    // Define total amount in cents
    const basePrice = 2700; // $27 in cents
    const bumpPrice = 4900; // $49 in cents
    const amount = withBump ? basePrice + bumpPrice : basePrice;
    console.log("💵 Total amount (cents):", amount);

    // Create PaymentIntent
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

    console.log("✅ PaymentIntent created:", paymentIntent.id);
    res.status(200).json({ clientSecret: paymentIntent.client_secret });

  } catch (err) {
    console.error("❌ Error in /create-payment-intent:", err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
