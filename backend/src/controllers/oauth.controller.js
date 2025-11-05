import * as client from "openid-client";
import User from "../models/user.model.js";
// using console for logging to avoid external logger dependency
import { generateToken } from "../lib/utils.js";

let googleConfig = null;
const ensureGoogleConfig = async () => {
  if (googleConfig) return googleConfig;
  
  const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GOOGLE_CLIENT_SECRET;
  
  googleConfig = await client.discovery(
    new URL("https://accounts.google.com"),
    clientId,
    clientSecret
  );
  
  return googleConfig;
};

export const googleRedirect = async (req, res) => {
  try {
    const termsAccepted = String(req.query?.termsAccepted || "");
    if (termsAccepted !== "1") {
      return res.status(400).json({ message: "You must accept Terms & Conditions" });
    }

    const config = await ensureGoogleConfig();
    const state = client.randomState();
    const nonce = client.randomNonce();
    
    // Store state/nonce in short-lived cookies for CSRF protection
    res.cookie("oauth_state", state, {
      maxAge: 5 * 60 * 1000,
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "development" ? "lax" : "strict",
      secure: process.env.NODE_ENV !== "development",
    });
    res.cookie("oauth_nonce", nonce, {
      maxAge: 5 * 60 * 1000,
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "development" ? "lax" : "strict",
      secure: process.env.NODE_ENV !== "development",
    });

    const base = process.env.OAUTH_CALLBACK_BASE || "http://localhost:5001";
    const redirectUri = `${base}/api/auth/oauth/google/callback`;
    
    const authUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: "openid email profile",
      state,
      nonce,
    });
    
    return res.redirect(authUrl.href);
  } catch (error) {
    console.error("googleRedirect failed:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const googleCallback = async (req, res) => {
  try {
    const config = await ensureGoogleConfig();
    const base = process.env.OAUTH_CALLBACK_BASE || "http://localhost:5001";
    const redirectUri = `${base}/api/auth/oauth/google/callback`;
    
    const state = req.cookies?.oauth_state;
    const nonce = req.cookies?.oauth_nonce;
    
    // Clear cookies immediately
    try { res.cookie("oauth_state", "", { maxAge: 0 }); } catch {}
    try { res.cookie("oauth_nonce", "", { maxAge: 0 }); } catch {}

    const currentUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      expectedState: state,
      expectedNonce: nonce,
    });

    // Get user info from the ID token
    const claims = client.getValidatedIdTokenClaims(tokens);

    const email = String(claims?.email || "").toLowerCase().trim();
    const emailVerified = Boolean(claims?.email_verified);
    const fullName = String(claims?.name || "User").trim();
    const oauthId = String(claims?.sub || "");

    if (!email || !oauthId) {
      console.error("Missing email or OAuth ID from Google");
      return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }

    let user = await User.findOne({ email });
    if (user) {
      // Link existing user to OAuth
      user.oauthProvider = "google";
      user.oauthId = oauthId;
      user.emailVerified = emailVerified;
      if (user.accountStatus !== "active") {
        user.accountStatus = "pending_onboarding";
      }
      await user.save();
    } else {
      // Create new user
      user = new User({
        email,
        fullName,
        emailVerified,
        oauthProvider: "google",
        oauthId,
        hasPassword: false,
        termsAccepted: false, // Will be set during onboarding
        accountStatus: "pending_onboarding",
      });
      await user.save();
    }

    const token = generateToken(user._id, res);
    return res.redirect(`${process.env.CLIENT_URL}/onboarding`);
  } catch (error) {
    console.error("googleCallback failed:", error);
    return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
  }
};