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
      firstName,
      lastName,
      email,
      phone,
      priceId,
      productLabel,
      productType,
      period,
      successUrl,
      hubspotFormGuid,
      acTags,
      userId, // Heroic user ID
      mode = "stage" // 'stage' or 'live'
    } = req.body;

    console.log("📩 Incoming data:", req.body);

    // Validate required fields
    if (!firstName || !lastName || !email || !priceId) {
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

    // Check if customer already exists
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 10
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
      // More than 1 user found, check if any are known heroic users
      customer = existingCustomers.data.find(x => x.metadata['heroic_user_id']);
      if (!customer) {
        // If no heroic customer found, grab the first one
        customer = existingCustomers.data[0];
      }
      console.log('✅ Found multiple customers, using:', customer.id);
    } else {
      // Customer doesn't exist, create new one
      customer = await stripe.customers.create({
        name: `${firstName} ${lastName}`,
        email,
        phone,
        metadata: {
          heroic_user_id: userId || ''
        }
      });

      console.log('✅ Created new customer:', customer.id);
    }

    // Update customer with Heroic user ID if provided
    if (userId && !customer.metadata?.heroic_user_id) {
      customer = await stripe.customers.update(customer.id, {
        metadata: {
          heroic_user_id: userId
        }
      });
      console.log('✅ Updated customer with Heroic user ID:', userId);
    }

    // Build success URL with query parameters
    const returnUrl = `${successUrl}?session_id={CHECKOUT_SESSION_ID}&cid=${customer.id}&name=${encodeURIComponent(firstName)}&product=${encodeURIComponent(productLabel)}&type=${encodeURIComponent(productType || '')}`;

    // Create Checkout Session
    // Note: mode is determined by the Price ID type in Stripe (recurring vs one-time)
    // We'll try 'subscription' first, and if the price is one-time, we'll fall back to 'payment'
    let session;
    let sessionMode = 'subscription';

    try {
      const sessionParams = {
        ui_mode: 'embedded',
        customer: customer.id,
        customer_email: email, // Prefill email
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: sessionMode,
        return_url: returnUrl,
        custom_text: {
          terms_of_service_acceptance: {
            message: `By continuing, you agree to Heroic's [Terms & Conditions](https://heroic.us/terms) and [Privacy Policy](https://heroic.us/privacy)`,
          },
        },
        consent_collection: {
          terms_of_service: 'required',
        },
        metadata: {
          productLabel,
          productType: productType || '',
          period,
          hubspotFormGuid: hubspotFormGuid || '',
          acTags: acTags || '',
          firstName,
          lastName,
          email,
          phone: phone || '',
          userId: userId || '',
          source: 'Heroic Pricing Module'
        },
        // Pre-fill customer info
        billing_address_collection: 'auto'
      };

      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (error) {
      // If subscription mode fails (likely because price is one-time), try payment mode
      if (error.message?.includes('mode') || error.message?.includes('recurring')) {
        console.log('⚠️ Subscription mode failed, trying payment mode for one-time price');
        sessionMode = 'payment';

        const sessionParams = {
          ui_mode: 'embedded',
          customer: customer.id,
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          mode: sessionMode,
          return_url: returnUrl,
          custom_text: {
            terms_of_service_acceptance: {
              message: `By continuing, you agree to Heroic's [Terms & Conditions](https://heroic.us/terms) and [Privacy Policy](https://heroic.us/privacy)`,
            },
          },
          consent_collection: {
            terms_of_service: 'required',
          },
          metadata: {
            productLabel,
            productType: productType || '',
            period,
            hubspotFormGuid: hubspotFormGuid || '',
            acTags: acTags || '',
            firstName,
            lastName,
            email,
            phone: phone || '',
            userId: userId || '',
            source: 'Heroic Pricing Module'
          }
        };

        session = await stripe.checkout.sessions.create(sessionParams);
      } else {
        throw error;
      }
    }

    console.log('✅ Checkout session created:', session.id);

    return res.status(200).json({
      clientSecret: session.client_secret,
      sessionId: session.id,
      customerId: customer.id
    });
  } catch (err) {
    console.error('❌ Error in /create-checkout-session:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
}
