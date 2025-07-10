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

    if (!customerId || !upsellAmount || !upsellDescription) {
      return res.status(400).json({ success: false, message: "Missing required parameters" });
    }

    const stripeSecretKey = mode === 'live'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_STAGE_SECRET_KEY;

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2022-11-15' });

    const customer = await stripe.customers.retrieve(customerId);
    const defaultPaymentMethod = customer.invoice_settings.default_payment_method;

    if (!defaultPaymentMethod) {
      return res.status(400).json({
        success: false,
        message: "No default payment method on file for customer."
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      customer: customerId,
      payment_method: defaultPaymentMethod,
      amount: upsellAmount, // in cents
      currency: "usd",
      off_session: true,
      confirm: true,
      description: upsellDescription,
      metadata: {
        upsell: true,
        environment: mode
      }
    });

    return res.status(200).json({
      success: true,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error("❌ Stripe upsell error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
      raw: error
    });
  }
}
