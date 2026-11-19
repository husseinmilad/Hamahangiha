const { getApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { OAuth2Client } = require('google-auth-library');


const googleClientId = defineSecret('GOOGLE_WEB_CLIENT_ID');
const verifier = new OAuth2Client();

exports.googleAuthExchange = onRequest(
  { region: 'us-central1', cors: true, secrets: [googleClientId], maxInstances: 20 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST').status(405).json({ error: 'method_not_allowed' });
      return;
    }

    try {
      const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
      if (!idToken || idToken.length > 10000) {
        res.status(400).json({ error: 'invalid_request' });
        return;
      }

      const ticket = await verifier.verifyIdToken({
        idToken,
        audience: googleClientId.value(),
      });
      const claims = ticket.getPayload();
      if (!claims?.sub || !claims.email || claims.email_verified !== true) {
        res.status(401).json({ error: 'unverified_google_account' });
        return;
      }

      const auth = getAuth();
      let user;
      try {
        // Preserve existing Firebase UIDs so Firestore documents and membership links remain valid.
        user = await auth.getUserByEmail(claims.email);
        if (user.disabled) {
          res.status(403).json({ error: 'account_disabled' });
          return;
        }
        const googleProvider = user.providerData.find((provider) => provider.providerId === 'google.com');
        if (!googleProvider || googleProvider.uid !== claims.sub) {
          res.status(409).json({ error: 'account_identity_conflict' });
          return;
        }
      } catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
        user = await auth.createUser({
          uid: `google_${claims.sub}`.slice(0, 128),
          email: claims.email,
          emailVerified: true,
          displayName: claims.name || claims.email,
          photoURL: claims.picture || undefined,
        });
      }

      const customToken = await auth.createCustomToken(user.uid, {
        authProvider: 'google',
        googleSub: claims.sub,
      });
      res.set('Cache-Control', 'no-store').status(200).json({ customToken });
    } catch (error) {
      console.error('Google token exchange failed', error.message);
      res.status(401).json({ error: 'google_token_rejected' });
    }
  }
);
