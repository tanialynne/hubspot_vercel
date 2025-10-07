import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sig = req.headers['stripe-signature'];

  // You'll need to set this environment variable with your webhook signing secret
  const webhookSecret = process.env.STRIPE_CHECKOUT_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    const stripeSecretKey = req.body.livemode
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_STAGE_SECRET_KEY;

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2022-11-15',
    });

    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    console.log('✅ Checkout session completed:', session.id);

    try {
      // Extract metadata
      const metadata = session.metadata;
      const {
        email,
        firstname,
        lastname,
        basePrice,
        baseLabel,
        basePriceId,
        baseProductId,
        productType,
        period,
        hubspotFormGuid,
        acTags,
        source
      } = metadata;

      // Only process if this is from the Heroic Pricing Module
      if (source !== 'Heroic Pricing Module') {
        console.log('⚠️ Skipping - not from Heroic Pricing Module');
        return res.json({ received: true });
      }

      const customerEmail = session.customer_details?.email || email;
      const customerPhone = session.customer_details?.phone || '';

      // Submit to HubSpot if form GUID provided
      if (hubspotFormGuid && customerEmail) {
        await submitHubspotForm({
          firstName: firstname,
          lastName: lastname,
          email: customerEmail,
          phone: customerPhone,
          basePrice: parseInt(basePrice),
          baseLabel,
          basePriceId,
          baseProductId,
        }, session.id, hubspotFormGuid, parseInt(basePrice) / 100, baseLabel);

        console.log('✅ HubSpot form submitted for:', customerEmail);
      }

      // Apply ActiveCampaign tags if configured
      if (acTags && customerEmail) {
        const tags = acTags.split(',').map(t => t.trim()).filter(t => t);
        if (tags.length > 0) {
          await fetch('https://hubspot-vercel-chi.vercel.app/api/tag-with-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: customerEmail,
              tags: tags
            })
          });
          console.log('✅ ActiveCampaign tags applied for:', customerEmail);
        }
      }

    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      // Don't return error to Stripe - we've received the webhook
    }
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
}

// Submit HubSpot form
async function submitHubspotForm(customerData, sessionId, hubspotFormGuid, totalAmount, productName) {
  const formData = {
    fields: [
      { name: '0-1/firstname', value: customerData.firstName },
      { name: '0-1/lastname', value: customerData.lastName },
      { name: '0-1/email', value: customerData.email },
      { name: '0-1/phone', value: customerData.phone || '' },
      { name: '0-1/website', value: 'https://heroic.us' },
      { name: '0-1/purchase_amount', value: totalAmount.toFixed(2) },
      { name: '0-1/product_name', value: productName },
      { name: '0-1/checkout_session_id', value: sessionId },
      {
        name: '0-1/purchase_details',
        value: JSON.stringify({
          sessionId,
          totalAmount: totalAmount.toFixed(2),
          productName,
          basePrice: (customerData.basePrice / 100).toFixed(2),
          baseLabel: customerData.baseLabel,
          basePriceId: customerData.basePriceId,
          baseProductId: customerData.baseProductId
        })
      }
    ]
  };

  const url = `https://api.hsforms.com/submissions/v3/integration/submit/45764384/${hubspotFormGuid}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });

  if (!response.ok) {
    throw new Error(`HubSpot submission failed: ${response.statusText}`);
  }

  return response.json();
}
