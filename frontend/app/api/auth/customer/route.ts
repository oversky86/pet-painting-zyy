import { NextRequest, NextResponse } from "next/server";
import {
  getCustomerProfile,
  refreshAccessToken,
  type CustomerProfile,
} from "@/lib/customer-account";

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get("customer_access_token")?.value;
  const refreshToken = req.cookies.get("customer_refresh_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ customer: null });
  }

  // Try to get customer profile with current token
  let customer: CustomerProfile | null = await getCustomerProfile(accessToken);

  // If token expired and we have a refresh token, try refreshing
  if (!customer && refreshToken) {
    const newTokens = await refreshAccessToken(refreshToken);
    if (newTokens) {
      customer = await getCustomerProfile(newTokens.access_token);
      if (customer) {
        // Update cookies with new tokens
        const res = NextResponse.json({ customer });
        const isSecure = process.env.NODE_ENV === "production";

        res.cookies.set("customer_access_token", newTokens.access_token, {
          httpOnly: true,
          secure: isSecure,
          sameSite: "lax",
          path: "/",
          maxAge: newTokens.expires_in || 3600,
        });

        if (newTokens.refresh_token) {
          res.cookies.set(
            "customer_refresh_token",
            newTokens.refresh_token,
            {
              httpOnly: true,
              secure: isSecure,
              sameSite: "lax",
              path: "/",
              maxAge: 60 * 60 * 24 * 30,
            }
          );
        }

        if (newTokens.id_token) {
          res.cookies.set("customer_id_token", newTokens.id_token, {
            httpOnly: true,
            secure: isSecure,
            sameSite: "lax",
            path: "/",
            maxAge: newTokens.expires_in || 3600,
          });
        }

        return res;
      }
    }

    // Refresh failed — clear all auth cookies
    const res = NextResponse.json({ customer: null });
    clearAuthCookies(res);
    return res;
  }

  if (!customer) {
    const res = NextResponse.json({ customer: null });
    clearAuthCookies(res);
    return res;
  }

  return NextResponse.json({ customer });
}

function clearAuthCookies(res: NextResponse) {
  const isSecure = process.env.NODE_ENV === "production";
  const opts = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  res.cookies.set("customer_access_token", "", opts);
  res.cookies.set("customer_refresh_token", "", opts);
  res.cookies.set("customer_id_token", "", opts);
}
