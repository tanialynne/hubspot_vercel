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
    const { email, password, firstName, mode = "stage" } = req.body;

    console.log("📩 Creating Heroic account for:", email);

    // Validate required fields
    if (!email || !password || !firstName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate password requirements
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?1234567890]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least 1 symbol or number' });
    }

    // Choose correct API URL
    const apiUrl = mode === 'live'
      ? 'https://api.heroic.us/graphql'
      : 'https://api.dev.heroic.us/graphql';

    // Create account via GraphQL mutation
    const signUpMutation = `
      mutation SignUp($email: String!, $password: String!, $firstName: String!) {
        signUp(input: { email: $email, password: $password, firstName: $firstName, startFree30DayPremiumTrial: false }) {
          userId
          token
        }
      }
    `;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: signUpMutation,
        variables: {
          email,
          password,
          firstName
        }
      })
    });

    const result = await response.json();

    console.log("📩 GraphQL response:", result);

    if (result.errors) {
      console.error('❌ GraphQL errors:', result.errors);

      // Check for common errors
      const errorMessage = result.errors[0]?.message || 'Failed to create account';

      if (errorMessage.includes('already') || errorMessage.includes('exists')) {
        return res.status(409).json({
          error: 'Account already exists with this email',
          details: errorMessage
        });
      }

      return res.status(400).json({
        error: 'Failed to create account',
        details: errorMessage
      });
    }

    if (!result.data?.signUp?.userId) {
      return res.status(500).json({ error: 'Failed to create account - no user ID returned' });
    }

    console.log('✅ Heroic account created:', result.data.signUp.userId);

    return res.status(200).json({
      userId: result.data.signUp.userId,
      token: result.data.signUp.token,
      success: true
    });

  } catch (err) {
    console.error('❌ Error creating Heroic account:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
}
