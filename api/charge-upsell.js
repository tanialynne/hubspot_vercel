// pages/api/charge-upsell.ts

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
    const { customerId, upsellAmount, upsellDescription, mode = 'stage' } = req.body;

    const stripeSecretKey = mode === 'live'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_STAGE_SECRET_KEY;

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2022-11-15' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: upsellAmount,
      currency: 'usd',
      customer: customerId,
      confirm: true,
      off_session: true,
      description: upsellDescription
    });

    return res.status(200).json({ success: true, paymentIntent });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
