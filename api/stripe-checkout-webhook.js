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

    console.log('============================================');
    console.log('📥 WEBHOOK RECEIVED: checkout.session.completed');
    console.log('Session ID:', session.id);
    console.log('Customer Email:', session.customer_details?.email);
    console.log('Amount Total:', session.amount_total / 100);
    console.log('Payment Status:', session.payment_status);
    console.log('============================================');

    try {
      // Extract metadata
      const metadata = session.metadata;
      console.log('📦 Metadata:', metadata);

      const {
        email,
        firstName,
        lastName,
        phone,
        userId,
        productLabel,
        productType,
        period,
        hubspotFormGuid,
        acTags,
        source
      } = metadata;

      // Only process if this is from the Heroic Pricing Module
      if (source !== 'Heroic Pricing Module') {
        console.log('⚠️ SKIPPED - Not from Heroic Pricing Module (source:', source, ')');
        return res.json({ received: true, skipped: true, reason: 'not_heroic_module' });
      }

      const customerEmail = session.customer_details?.email || email;
      const customerPhone = session.customer_details?.phone || '';

      console.log('👤 Processing for customer:', customerEmail);

      const results = {
        sessionId: session.id,
        customerEmail,
        hubspotSubmitted: false,
        acTagsApplied: false,
        errors: []
      };

      // Submit to HubSpot if form GUID provided
      if (hubspotFormGuid && customerEmail) {
        console.log('📧 Submitting to HubSpot form:', hubspotFormGuid);
        try {
          await submitHubspotForm({
            firstName,
            lastName,
            email: customerEmail,
            phone: customerPhone || phone,
            userId,
            productLabel,
            productType,
            period
          }, session, hubspotFormGuid);

          console.log('✅ HubSpot form submitted successfully');
          results.hubspotSubmitted = true;
        } catch (err) {
          console.error('❌ HubSpot submission failed:', err.message);
          results.errors.push(`HubSpot: ${err.message}`);
        }
      } else {
        console.log('⚠️ Skipping HubSpot - missing form GUID or email');
      }

      // Apply ActiveCampaign tags if configured
      if (acTags && customerEmail) {
        const tags = acTags.split(',').map(t => t.trim()).filter(t => t);
        if (tags.length > 0) {
          console.log('🏷️ Applying AC tags:', tags);
          try {
            const acResponse = await fetch('https://hubspot-vercel-chi.vercel.app/api/tag-with-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: customerEmail,
                tags: tags
              })
            });

            if (acResponse.ok) {
              console.log('✅ ActiveCampaign tags applied successfully');
              results.acTagsApplied = true;
            } else {
              const errorText = await acResponse.text();
              console.error('❌ AC tagging failed:', errorText);
              results.errors.push(`AC: ${errorText}`);
            }
          } catch (err) {
            console.error('❌ AC tagging error:', err.message);
            results.errors.push(`AC: ${err.message}`);
          }
        }
      } else {
        console.log('⚠️ Skipping AC tags - no tags configured or missing email');
      }

      console.log('============================================');
      console.log('✅ WEBHOOK PROCESSING COMPLETE');
      console.log('Results:', results);
      console.log('============================================');

      // Return detailed results (Stripe ignores this, but useful for manual testing)
      return res.json({ received: true, results });

    } catch (error) {
      console.error('============================================');
      console.error('❌ CRITICAL ERROR processing webhook:', error);
      console.error('Stack:', error.stack);
      console.error('============================================');
      // Don't return error to Stripe - we've received the webhook
      return res.json({ received: true, error: error.message });
    }
  }

  console.log('ℹ️ Webhook event type not handled:', event.type);

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
}

// Submit HubSpot form
async function submitHubspotForm(customerData, session, hubspotFormGuid) {
  const totalAmount = session.amount_total / 100;
  const productName = customerData.productLabel;

  const formData = {
    fields: [
      { name: '0-1/firstname', value: customerData.firstName },
      { name: '0-1/lastname', value: customerData.lastName },
      { name: '0-1/email', value: customerData.email },
      { name: '0-1/phone', value: customerData.phone || '' },
      { name: '0-1/website', value: 'https://heroic.us' },
      { name: '0-1/purchase_amount', value: totalAmount.toFixed(2) },
      { name: '0-1/product_name', value: productName },
      { name: '0-1/checkout_session_id', value: session.id },
      {
        name: '0-1/purchase_details',
        value: JSON.stringify({
          checkoutSessionId: session.id,
          customerId: session.customer,
          subscriptionId: session.subscription || '',
          userId: customerData.userId || '',
          totalAmount: totalAmount.toFixed(2),
          productName,
          productType: customerData.productType || '',
          period: customerData.period,
          source: 'Heroic Pricing Module'
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
