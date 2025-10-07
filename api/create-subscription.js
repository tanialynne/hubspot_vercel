import Stripe from 'stripe';

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
      customerId,
      setupIntentId,
      priceId,
      productLabel,
      productType,
      period,
      hubspotFormGuid,
      acTags,
      userId,
      firstName,
      lastName,
      email,
      mode = 'stage'
    } = req.body;

    console.log(`📩 Creating subscription for customer: ${customerId} (mode: ${mode})`);

    // Validate required fields
    if (!customerId || !setupIntentId || !priceId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Choose correct Stripe secret key
    const stripeSecretKey =
      mode === 'live'
        ? process.env.STRIPE_LIVE_SECRET_KEY
        : process.env.STRIPE_STAGE_SECRET_KEY;

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2022-11-15',
    });

    // Get the Setup Intent to retrieve the payment method
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (!setupIntent.payment_method) {
      return res.status(400).json({ error: 'No payment method found on Setup Intent' });
    }

    console.log('✅ Retrieved Setup Intent:', setupIntent.id);
    console.log('✅ Payment Method:', setupIntent.payment_method);

    let paymentResult;
    let isOneTime = period === 'onetime';

    if (isOneTime) {
      // For one-time purchases, get the price to determine amount
      const price = await stripe.prices.retrieve(priceId);

      // Create a Payment Intent for one-time payment
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price.unit_amount,
        currency: price.currency,
        customer: customerId,
        payment_method: setupIntent.payment_method,
        confirm: true,
        off_session: true,
        metadata: {
          productLabel: productLabel || '',
          productType: productType || '',
          period: 'onetime',
          hubspotFormGuid: hubspotFormGuid || '',
          acTags: acTags || '',
          userId: userId || '',
          firstName: firstName || '',
          lastName: lastName || '',
          email: email || '',
          source: 'Heroic Pricing Module'
        }
      });

      console.log('✅ Payment Intent created:', paymentIntent.id);
      paymentResult = {
        id: paymentIntent.id,
        status: paymentIntent.status,
        items: { data: [{ price: { unit_amount: price.unit_amount } }] }
      };
    } else {
      // Create the subscription for recurring payments
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price: priceId,
        }],
        default_payment_method: setupIntent.payment_method,
        metadata: {
          productLabel: productLabel || '',
          productType: productType || '',
          period: period || '',
          hubspotFormGuid: hubspotFormGuid || '',
          acTags: acTags || '',
          userId: userId || '',
          firstName: firstName || '',
          lastName: lastName || '',
          email: email || '',
          source: 'Heroic Pricing Module'
        }
      });

      console.log('✅ Subscription created:', subscription.id);
      paymentResult = subscription;
    }

    // Submit to HubSpot
    if (hubspotFormGuid && email) {
      try {
        await submitHubspotForm({
          firstName,
          lastName,
          email,
          userId,
          productLabel,
          productType,
          period,
          hubspotFormGuid
        }, paymentResult, isOneTime);

        console.log('✅ HubSpot form submitted');
      } catch (err) {
        console.error('❌ HubSpot submission failed:', err.message);
        // Don't fail the request if HubSpot fails
      }
    }

    // Apply ActiveCampaign tags
    if (acTags && email) {
      try {
        const tags = acTags.split(',').map(t => t.trim()).filter(t => t);
        if (tags.length > 0) {
          await fetch('https://hubspot-vercel-chi.vercel.app/api/tag-with-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, tags })
          });
          console.log('✅ AC tags applied:', tags);
        }
      } catch (err) {
        console.error('❌ AC tagging failed:', err.message);
        // Don't fail the request if AC fails
      }
    }

    return res.status(200).json({
      subscriptionId: paymentResult.id,
      customerId: customerId,
      status: paymentResult.status,
      type: isOneTime ? 'payment' : 'subscription'
    });

  } catch (err) {
    console.error('❌ Error creating subscription:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
}

// Submit HubSpot form
async function submitHubspotForm(customerData, paymentResult, isOneTime) {
  const totalAmount = paymentResult.items.data[0].price.unit_amount / 100;
  const productName = customerData.productLabel;

  const formData = {
    fields: [
      { name: '0-1/firstname', value: customerData.firstName },
      { name: '0-1/lastname', value: customerData.lastName },
      { name: '0-1/email', value: customerData.email },
      { name: '0-1/phone', value: '' },
      { name: '0-1/website', value: 'https://heroic.us' },
      { name: '0-1/purchase_amount', value: totalAmount.toFixed(2) },
      { name: '0-1/product_name', value: productName },
      { name: '0-1/subscription_id', value: paymentResult.id },
      {
        name: '0-1/purchase_details',
        value: JSON.stringify({
          id: paymentResult.id,
          type: isOneTime ? 'payment' : 'subscription',
          customerId: paymentResult.customer,
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

  const url = `https://api.hsforms.com/submissions/v3/integration/submit/45764384/${customerData.hubspotFormGuid}`;

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
