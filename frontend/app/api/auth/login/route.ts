import { NextRequest, NextResponse } from "next/server";
import {
  getOpenIDConfig,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  encryptValue,
  CLIENT_ID,
} from "@/lib/customer-account";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const returnTo = url.searchParams.get("returnTo") || "/";
    const origin = `${url.protocol}//${url.host}`;
    const callbackUrl = `${origin}/api/auth/callback`;

    // Fetch OpenID configuration
    const openidConfig = await getOpenIDConfig();

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store PKCE state in encrypted cookie (5 min expiry)
    const oauthState = encryptValue(
      JSON.stringify({ state, codeVerifier, returnTo })
    );

    // Build authorization URL
    const authUrl = new URL(openidConfig.authorization_endpoint);
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("scope", "openid email customer-account-api:full");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    const res = NextResponse.redirect(authUrl.toString());
    res.cookies.set("__oauth_state", oauthState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 300, // 5 minutes
    });

    return res;
  } catch (error) {
    console.error("Login initiation error:", error);
    return NextResponse.redirect(
      new URL("/?auth_error=login_failed", req.url)
    );
  }
}
