import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { json } from "react-router";

/**
 * App setup page — runs within the embedded app (same-origin).
 * Provides buttons to register webhooks and fix metafields.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  if (!admin) {
    return json({ error: "No admin session" }, { status: 401 });
  }

  // Get session info
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "unknown";

  return json({
    shop,
    appUrl: process.env.SHOPIFY_APP_URL || "",
    message: "Setup page loaded successfully",
  });
}
