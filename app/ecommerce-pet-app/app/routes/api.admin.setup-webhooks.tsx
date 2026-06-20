import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

/**
 * Direct webhook registration using stored session token.
 * GET /api/admin/setup-webhooks
 * Bypasses Shopify SDK authenticate.admin() to avoid crashes.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Step 1: Get session from database
    const sessions = await prisma.session.findMany({
      where: { isOnline: false },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    if (sessions.length === 0) {
      return Response.json({
        error: "No offline session found. Please install the app from Shopify Admin first.",
        sessions: await prisma.session.count(),
      }, { status: 400 });
    }

    const session = sessions[0];
    const shop = session.shop;
    const accessToken = session.accessToken;

    // Step 2: Check existing webhooks via REST API
    const listResp = await fetch(
      `https://${shop}/admin/api/2025-04/webhooks.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    const listData = await listResp.json() as any;
    const existingWebhooks = (listData.webhooks || []).map((w: any) => ({
      id: w.id,
      topic: w.topic,
      address: w.address,
    }));

    // Step 3: Check if orders/create is already registered
    const appUrl = process.env.SHOPIFY_APP_URL || "";
    const webhookAddress = `${appUrl}/webhooks/orders/create`;
    const hasOrdersCreate = existingWebhooks.some(
      (w: any) => w.topic === "orders/create"
    );

    if (hasOrdersCreate) {
      return Response.json({
        status: "done",
        shop,
        message: "ORDERS_CREATE webhook already exists",
        existingWebhooks,
      });
    }

    // Step 4: Register orders/create webhook
    const createResp = await fetch(
      `https://${shop}/admin/api/2025-04/webhooks.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhook: {
            topic: "orders/create",
            address: webhookAddress,
            format: "json",
          },
        }),
      }
    );

    const createData = await createResp.json() as any;

    return Response.json({
      status: createResp.ok ? "done" : "error",
      shop,
      webhookAddress,
      result: createData,
      existingWebhooks,
    });
  } catch (e: any) {
    return Response.json({
      error: e.message || "Unknown error",
      stack: e.stack?.split("\n").slice(0, 3).join("\n"),
    }, { status: 500 });
  }
}
