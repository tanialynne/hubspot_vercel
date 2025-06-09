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
    const {
      firstName,
      lastName,
      email,
      phone,
      withBump,
      basePrice = 2700,
      bumpPrice = 4900,
      successUrl = "https://yourdomain.com/success",
      cancelUrl = "https://yourdomain.com/cancel",
      baseLabel = "Main Product",
      bumpLabel = "Order Bump Product",
      basePriceId,
      bumpPriceId,
      baseProductId,
      bumpProductId
    } = req.body;


    console.log("📩 Incoming data:", req.body);

    const customer = await stripe.customers.create({
      name: `${firstName} ${lastName}`,
      email,
      phone
    });

    const amount = withBump ? basePrice + bumpPrice : basePrice;

    const line_items = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: baseLabel
          },
          unit_amount: basePrice
        },
        quantity: 1
      }
    ];

    if (withBump) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: bumpLabel
          },
          unit_amount: bumpPrice
        },
        quantity: 1
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customer.id,
      description: withBump ? `${baseLabel} + ${bumpLabel}` : baseLabel,
      metadata: {
        withBump: withBump.toString(),
        basePrice: basePrice.toString(),
        bumpPrice: bumpPrice.toString(),
        baseLabel,
        bumpLabel,
        email,
        name: `${firstName} ${lastName}`,
        basePriceId,
        bumpPriceId: withBump ? bumpPriceId : '',
        baseProductId,
        bumpProductId: withBump ? bumpProductId : ''
      }
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });

  } catch (err) {
    console.error('❌ Error in /create-payment-intent:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
