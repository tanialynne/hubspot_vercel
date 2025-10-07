/**
 * Heroic Account Authentication API Endpoint
 *
 * This endpoint handles both sign-up and sign-in via GraphQL.
 *
 * MODE CONFIGURATION:
 * - mode: "stage" -> Uses DEV (api.dev.heroic.us)
 * - mode: "live"  -> Uses PRODUCTION (api.heroic.us)
 *
 * ACTION:
 * - action: "signup" -> Creates new account (requires firstName)
 * - action: "signin" -> Signs in existing account (firstName optional)
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
    const { email, password, firstName, action = "signup", mode = "stage" } = req.body;

    const isSignIn = action === "signin";
    console.log(`📩 ${isSignIn ? 'Signing in' : 'Creating account'} for: ${email} (mode: ${mode})`);

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!isSignIn && !firstName) {
      return res.status(400).json({ error: 'First name is required for sign up' });
    }

    // Validate password requirements for signup
    if (!isSignIn) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?1234567890]/.test(password)) {
        return res.status(400).json({ error: 'Password must contain at least 1 symbol or number' });
      }
    }

    // Choose correct API URL
    const apiUrl = mode === 'live'
      ? 'https://api.heroic.us/graphql'
      : 'https://api.dev.heroic.us/graphql';

    let mutation, variables;

    if (isSignIn) {
      // Sign In mutation (uses 'login' not 'signIn')
      mutation = `
        mutation Login($email: String!, $password: String!) {
          login(email: $email, password: $password) {
            userId
            sessionCookie {
              value
              expires
            }
          }
        }
      `;
      variables = { email, password };
    } else {
      // Sign Up mutation
      mutation = `
        mutation SignUp($email: String!, $password: String!, $firstName: String!) {
          signUp(input: { email: $email, password: $password, firstName: $firstName, startFree30DayPremiumTrial: false }) {
            userId
            token
          }
        }
      `;
      variables = { email, password, firstName };
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: mutation,
        variables
      })
    });

    const result = await response.json();

    console.log("📩 GraphQL response:", result);

    if (result.errors) {
      console.error('❌ GraphQL errors:', result.errors);

      // Check for common errors
      const errorMessage = result.errors[0]?.message || `Failed to ${isSignIn ? 'sign in' : 'create account'}`;

      if (isSignIn && (errorMessage.includes('Invalid') || errorMessage.includes('not found'))) {
        return res.status(401).json({
          error: 'Invalid email or password',
          details: errorMessage
        });
      }

      if (!isSignIn && (errorMessage.includes('already') || errorMessage.includes('exists'))) {
        return res.status(409).json({
          error: 'Account already exists with this email',
          details: errorMessage
        });
      }

      return res.status(400).json({
        error: `Failed to ${isSignIn ? 'sign in' : 'create account'}`,
        details: errorMessage
      });
    }

    const responseData = isSignIn ? result.data?.login : result.data?.signUp;

    if (!responseData?.userId) {
      return res.status(500).json({ error: `Failed to ${isSignIn ? 'sign in' : 'create account'} - no user ID returned` });
    }

    console.log(`✅ ${isSignIn ? 'Signed in' : 'Account created'}:`, responseData.userId);

    // Extract token from sessionCookie
    const token = responseData.sessionCookie?.value || responseData.token;

    // For sign-in, fetch user profile data
    let userFirstName = firstName || '';
    let userLastName = '';

    if (isSignIn && token) {
      try {
        const profileQuery = `
          query Me {
            me {
              id
              email
              userProfile {
                firstName
                lastName
              }
            }
          }
        `;

        const profileResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            query: profileQuery
          })
        });

        const profileResult = await profileResponse.json();

        if (profileResult.data?.me?.userProfile) {
          userFirstName = profileResult.data.me.userProfile.firstName || '';
          userLastName = profileResult.data.me.userProfile.lastName || '';
        }
      } catch (err) {
        console.error('⚠️ Failed to fetch user profile:', err);
        // Don't fail the request, just use empty name
      }
    }

    return res.status(200).json({
      userId: responseData.userId,
      token: token,
      firstName: userFirstName,
      lastName: userLastName,
      email: email,
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
