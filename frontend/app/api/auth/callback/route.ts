import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  decryptValue,
} from "@/lib/customer-account";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const origin = `${url.protocol}//${url.host}`;

  // Handle OAuth errors (e.g. prompt=none → login_required)
  if (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(new URL("/?auth_error=" + error, req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?auth_error=missing_params", req.url));
  }

  // Read and decrypt PKCE state from cookie
  const oauthStateCookie = req.cookies.get("__oauth_state")?.value;
  if (!oauthStateCookie) {
    return NextResponse.redirect(new URL("/?auth_error=no_state_cookie", req.url));
  }

  let pkceState: { state: string; codeVerifier: string; returnTo: string };
  try {
    pkceState = JSON.parse(decryptValue(oauthStateCookie));
  } catch {
    return NextResponse.redirect(new URL("/?auth_error=invalid_state", req.url));
  }

  // Verify state matches (CSRF protection)
  if (pkceState.state !== state) {
    return NextResponse.redirect(new URL("/?auth_error=state_mismatch", req.url));
  }

  try {
    const callbackUrl = `${origin}/api/auth/callback`;

    // Exchange authorization code for tokens
    const tokenData = await exchangeCodeForToken(
      code,
      pkceState.codeVerifier,
      callbackUrl
    );

    const returnTo = pkceState.returnTo || "/";
    const res = NextResponse.redirect(new URL(returnTo, req.url));

    // Store tokens in HTTP-only cookies
    const isSecure = process.env.NODE_ENV === "production";

    res.cookies.set("customer_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: tokenData.expires_in || 3600,
    });

    if (tokenData.refresh_token) {
      res.cookies.set("customer_refresh_token", tokenData.refresh_token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    if (tokenData.id_token) {
      res.cookies.set("customer_id_token", tokenData.id_token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        path: "/",
        maxAge: tokenData.expires_in || 3600,
      });
    }

    // Clear temporary OAuth state cookie
    res.cookies.set("__oauth_state", "", {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (err) {
    console.error("Callback token exchange error:", err);
    return NextResponse.redirect(new URL("/?auth_error=token_exchange", req.url));
  }
}
