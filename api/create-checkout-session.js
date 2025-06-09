const stripe = require('stripe')(process.env.STRIPE_STAGE_SECRET_KEY);

res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(JSON.parse(data)));
      req.on('error', reject);
    });

    const { withBump } = body;

    console.log("🔧 withBump received:", withBump);

    const line_items = [
      { price: 'price_1RY6eLHYlnQjAFkvvJ53TZYt', quantity: 1 }, // $27 main product
    ];

    if (withBump) {
      line_items.push({ price: 'price_1RY6fCHYlnQjAFkvDBBaZ4d4', quantity: 1 }); // $49 bump product
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: 'https://heroic.us/go/parenting-bundle-success',
      cancel_url: 'https://heroic.us/go/parenting-bundle-cancel',
    });

    res.status(200).json({ id: session.id });

  } catch (err) {
    console.error("💥 Function error:", err);
    res.status(500).json({ error: 'Function failed' });
  }
};
