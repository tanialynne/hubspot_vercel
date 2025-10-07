import Stripe from 'stripe';

/**
 * Create Setup Intent for Subscription Payment
 *
 * This creates a Setup Intent that collects payment method details
 * without charging the customer. The payment method is then used
 * to create a subscription.
 */

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
      userId,
      priceId,
      productId,
      mode = "stage"
    } = req.body;

    console.log(`📩 Creating Setup Intent for: ${email} (mode: ${mode})`);

    // Validate required fields
    if (!email || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use defaults if name not provided (for sign-in users)
    const customerFirstName = firstName || 'Heroic';
    const customerLastName = lastName || 'User';

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
      customer = existingCustomers.data[0];

      // Check if customer already has this product (any variant/price)
      if (productId) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'active',
          limit: 100
        });

        // Check if any active subscription has this product
        const hasSameProduct = subscriptions.data.some(sub =>
          sub.items.data.some(item => item.price.product === productId)
        );

        if (hasSameProduct) {
          console.log('⚠️ Customer already has an active subscription to this product');
          return res.status(409).json({
            error: 'You already have an active subscription to this product. Please manage your existing subscription in your account.',
            hasActiveSubscription: true
          });
        }
      }

      // Update customer with Heroic user ID and name if not set
      if (!customer.metadata?.heroic_user_id || !customer.name) {
        customer = await stripe.customers.update(customer.id, {
          name: customer.name || `${customerFirstName} ${customerLastName}`,
          metadata: {
            heroic_user_id: userId
          }
        });
      }

      console.log('✅ Using existing customer:', customer.id);
    } else if (existingCustomers.data.length > 1) {
      customer = existingCustomers.data.find(x => x.metadata['heroic_user_id']);
      if (!customer) {
        customer = existingCustomers.data[0];
      }

      // Check if customer already has this product (any variant/price)
      if (productId) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'active',
          limit: 100
        });

        // Check if any active subscription has this product
        const hasSameProduct = subscriptions.data.some(sub =>
          sub.items.data.some(item => item.price.product === productId)
        );

        if (hasSameProduct) {
          console.log('⚠️ Customer already has an active subscription to this product');
          return res.status(409).json({
            error: 'You already have an active subscription to this product. Please manage your existing subscription in your account.',
            hasActiveSubscription: true
          });
        }
      }

      console.log('✅ Found multiple customers, using:', customer.id);
    } else {
      // Create new customer
      customer = await stripe.customers.create({
        name: `${customerFirstName} ${customerLastName}`,
        email,
        metadata: {
          heroic_user_id: userId
        }
      });

      console.log('✅ Created new customer:', customer.id);
    }

    // Create Setup Intent
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId,
        email,
        firstName: customerFirstName,
        lastName: customerLastName,
        source: 'Heroic Pricing Module'
      }
    });

    console.log('✅ Setup Intent created:', setupIntent.id);

    return res.status(200).json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
      setupIntentId: setupIntent.id
    });

  } catch (err) {
    console.error('❌ Error creating Setup Intent:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
}
