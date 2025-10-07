/**
 * Sign In to Heroic Account API Endpoint
 *
 * This endpoint signs in an existing Heroic user via GraphQL.
 *
 * MODE CONFIGURATION:
 * - mode: "stage" -> Signs in to DEV (api.dev.heroic.us)
 * - mode: "live"  -> Signs in to PRODUCTION (api.heroic.us)
 *
 * The mode is passed from the frontend based on module.stripe_mode setting.
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
    const { email, password, mode = "stage" } = req.body;

    console.log(`📩 Signing in to Heroic account: ${email} (mode: ${mode})`);

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Choose correct API URL
    const apiUrl = mode === 'live'
      ? 'https://api.heroic.us/graphql'
      : 'https://api.dev.heroic.us/graphql';

    // Sign in via GraphQL mutation
    const signInMutation = `
      mutation SignIn($email: String!, $password: String!) {
        signIn(input: { email: $email, password: $password }) {
          userId
          token
          user {
            firstName
            lastName
            email
          }
        }
      }
    `;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: signInMutation,
        variables: {
          email,
          password
        }
      })
    });

    const result = await response.json();

    console.log("📩 GraphQL response:", result);

    if (result.errors) {
      console.error('❌ GraphQL errors:', result.errors);

      // Check for common errors
      const errorMessage = result.errors[0]?.message || 'Failed to sign in';

      if (errorMessage.includes('Invalid') || errorMessage.includes('not found')) {
        return res.status(401).json({
          error: 'Invalid email or password',
          details: errorMessage
        });
      }

      return res.status(400).json({
        error: 'Failed to sign in',
        details: errorMessage
      });
    }

    if (!result.data?.signIn?.userId) {
      return res.status(500).json({ error: 'Failed to sign in - no user ID returned' });
    }

    console.log('✅ Signed in successfully:', result.data.signIn.userId);

    return res.status(200).json({
      userId: result.data.signIn.userId,
      token: result.data.signIn.token,
      firstName: result.data.signIn.user?.firstName || '',
      lastName: result.data.signIn.user?.lastName || '',
      email: result.data.signIn.user?.email || email,
      success: true
    });

  } catch (err) {
    console.error('❌ Error signing in to Heroic account:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
}
