import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { requireAuth, signToken } from "../middleware/auth";
import {
  getProfile,
  getProfileByEmail,
  getProfileByUsername,
  createProfileWithAuth,
  getProfileByOAuth,
  createOAuthProfile,
  updateProfile,
} from "../services/profiles";

const r = Router();

const BCRYPT_ROUNDS = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── POST /signup ────────────────────────────────────────────────────
r.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, username, sizeInches, ageRange, girthInches } = req.body;

    // Validate required fields
    if (!email || !password || !username || sizeInches == null) {
      res.status(400).json({ error: "email, password, username, and sizeInches are required" });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    if (username.length < 3 || username.length > 30) {
      res.status(400).json({ error: "Username must be 3-30 characters" });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      res.status(400).json({ error: "Username can only contain letters, numbers, and underscores" });
      return;
    }

    // Check for existing email
    const existingEmail = await getProfileByEmail(email.toLowerCase());
    if (existingEmail) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    // Check for existing username
    const existingUsername = await getProfileByUsername(username);
    if (existingUsername) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    // Hash password and create profile
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const profile = await createProfileWithAuth({
      email: email.toLowerCase(),
      passwordHash,
      username,
      sizeInches: parseFloat(sizeInches),
      ageRange: ageRange ?? null,
      girthInches: girthInches != null ? parseFloat(girthInches) : null,
      authProvider: "email",
    });

    const token = signToken({ userId: profile.id, email: profile.email!, username: profile.username });

    res.status(201).json({
      token,
      profile: sanitizeProfile(profile),
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /login ─────────────────────────────────────────────────────
r.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const profile = await getProfileByEmail(email.toLowerCase());
    if (!profile || !profile.password_hash) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ userId: profile.id, email: profile.email!, username: profile.username });

    res.json({
      token,
      profile: sanitizeProfile(profile),
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /oauth/x ──────────────────────────────────────────────────
r.post("/oauth/x", async (req: Request, res: Response) => {
  try {
    const { accessToken, accessSecret } = req.body;

    if (!accessToken || !accessSecret) {
      res.status(400).json({ error: "accessToken and accessSecret are required" });
      return;
    }

    // Verify tokens with X API
    const xUser = await verifyXTokens(accessToken, accessSecret);
    if (!xUser) {
      res.status(401).json({ error: "Invalid X OAuth tokens" });
      return;
    }

    // Find or create profile
    let profile = await getProfileByOAuth("x", xUser.id);

    if (!profile) {
      profile = await createOAuthProfile({
        authProvider: "x",
        oauthProviderId: xUser.id,
        username: xUser.username,
        xHandle: xUser.username,
        xAvatarUrl: xUser.profile_image_url ?? null,
        xName: xUser.name ?? null,
        avatarUrl: xUser.profile_image_url ?? null,
      });
    } else {
      // Update X-specific fields on each login
      await updateProfile(profile.id, {
        x_handle: xUser.username,
        x_avatar_url: xUser.profile_image_url ?? null,
        x_name: xUser.name ?? null,
      });
    }

    const token = signToken({
      userId: profile.id,
      email: profile.email ?? "",
      username: profile.username,
    });

    res.json({
      token,
      profile: sanitizeProfile(profile),
    });
  } catch (err: any) {
    console.error("X OAuth error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /oauth/google ─────────────────────────────────────────────
r.post("/oauth/google", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ error: "idToken is required" });
      return;
    }

    // Verify Google ID token
    const googleUser = await verifyGoogleIdToken(idToken);
    if (!googleUser) {
      res.status(401).json({ error: "Invalid Google ID token" });
      return;
    }

    // Find or create profile
    let profile = await getProfileByOAuth("google", googleUser.sub);

    if (!profile) {
      profile = await createOAuthProfile({
        authProvider: "google",
        oauthProviderId: googleUser.sub,
        username: generateUsernameFromEmail(googleUser.email),
        email: googleUser.email,
        avatarUrl: googleUser.picture ?? null,
      });
    } else {
      // Update avatar on each login
      if (googleUser.picture) {
        await updateProfile(profile.id, { avatar_url: googleUser.picture });
      }
    }

    const token = signToken({
      userId: profile.id,
      email: profile.email ?? "",
      username: profile.username,
    });

    res.json({
      token,
      profile: sanitizeProfile(profile),
    });
  } catch (err: any) {
    console.error("Google OAuth error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /me ─────────────────────────────────────────────────────────
r.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const profile = await getProfile(req.userId!);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(sanitizeProfile(profile));
  } catch (err: any) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /refresh ───────────────────────────────────────────────────
r.post("/refresh", requireAuth, async (req: Request, res: Response) => {
  try {
    const profile = await getProfile(req.userId!);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const token = signToken({
      userId: profile.id,
      email: profile.email ?? "",
      username: profile.username,
    });

    res.json({ token });
  } catch (err: any) {
    console.error("Refresh error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Helpers ─────────────────────────────────────────────────────────

/** Strip sensitive fields before returning profile to client */
function sanitizeProfile(profile: any): any {
  const { password_hash, ...safe } = profile;
  return safe;
}

/** Verify X/Twitter OAuth 1.0a tokens by calling the /2/users/me endpoint */
async function verifyXTokens(
  accessToken: string,
  accessSecret: string,
): Promise<{ id: string; username: string; name: string; profile_image_url?: string } | null> {
  try {
    const consumerKey = process.env.X_CONSUMER_KEY;
    const consumerSecret = process.env.X_CONSUMER_SECRET;
    if (!consumerKey || !consumerSecret) {
      console.error("X_CONSUMER_KEY / X_CONSUMER_SECRET not configured");
      return null;
    }

    // Build OAuth 1.0a signature for GET /2/users/me
    const url = "https://api.x.com/2/users/me?user.fields=profile_image_url";
    const oauthHeader = buildOAuth1Header({
      method: "GET",
      url,
      consumerKey,
      consumerSecret,
      accessToken,
      accessSecret,
    });

    const resp = await fetch(url, {
      headers: { Authorization: oauthHeader },
    });

    if (!resp.ok) return null;

    const body = await resp.json() as any;
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** Build OAuth 1.0a Authorization header */
function buildOAuth1Header(params: {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessSecret: string;
}): string {
  const crypto = require("crypto");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");

  const parsedUrl = new URL(params.url);
  const baseUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;

  // Collect all params (oauth + query string)
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: params.accessToken,
    oauth_version: "1.0",
  };

  // Include query params in signature base
  const allParams: Record<string, string> = { ...oauthParams };
  parsedUrl.searchParams.forEach((val, key) => {
    allParams[key] = val;
  });

  const sortedParams = Object.keys(allParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join("&");

  const signatureBase = `${params.method.toUpperCase()}&${encodeURIComponent(baseUrl)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(params.consumerSecret)}&${encodeURIComponent(params.accessSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(signatureBase).digest("base64");

  oauthParams["oauth_signature"] = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${headerParts}`;
}

/** Verify Google ID token by calling Google's tokeninfo endpoint */
async function verifyGoogleIdToken(
  idToken: string,
): Promise<{ sub: string; email: string; name?: string; picture?: string } | null> {
  try {
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!resp.ok) return null;

    const data = await resp.json() as any;

    // Verify audience matches our Google client ID
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && data.aud !== expectedClientId) {
      console.error("Google ID token audience mismatch");
      return null;
    }

    if (!data.sub || !data.email) return null;

    return {
      sub: data.sub,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  } catch {
    return null;
  }
}

/** Generate a username from an email address, appending random suffix for uniqueness */
function generateUsernameFromEmail(email: string): string {
  const local = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${local}_${suffix}`;
}

export default r;
