import { NextRequest, NextResponse } from "next/server";
import { getOpenIDConfig } from "@/lib/customer-account";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const idToken = req.cookies.get("customer_id_token")?.value;

  // Clear all auth cookies
  const isSecure = process.env.NODE_ENV === "production";
  const clearOpts = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  let logoutUrl: string;
  try {
    const openidConfig = await getOpenIDConfig();
    const endSessionUrl = new URL(openidConfig.end_session_endpoint);
    if (idToken) {
      endSessionUrl.searchParams.set("id_token_hint", idToken);
    }
    endSessionUrl.searchParams.set("post_logout_redirect_uri", origin);
    logoutUrl = endSessionUrl.toString();
  } catch {
    // Fallback: redirect to homepage
    logoutUrl = origin;
  }

  const res = NextResponse.redirect(logoutUrl);
  res.cookies.set("customer_access_token", "", clearOpts);
  res.cookies.set("customer_refresh_token", "", clearOpts);
  res.cookies.set("customer_id_token", "", clearOpts);

  return res;
}
