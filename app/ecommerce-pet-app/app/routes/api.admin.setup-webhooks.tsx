import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

/**
 * Direct webhook registration using stored session token.
 * GET /api/admin/setup-webhooks
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Step 1: Get offline session from database using raw SQL
    const sessions = await prisma.$queryRaw`
      SELECT id, shop, "accessToken", "isOnline"
      FROM "Session"
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;

    const sessionList = sessions as any[];

    if (!sessionList || sessionList.length === 0) {
      return Response.json({
        error: "No sessions found in database",
        hint: "Please install the app from Shopify Admin to create an OAuth session",
      }, { status: 400 });
    }

    // Find offline session (isOnline = false)
    const offlineSession = sessionList.find((s: any) => s.isOnline === false);
    const session = offlineSession || sessionList[0];

    const shop = session.shop;
    const accessToken = session.accessToken;

    if (!accessToken) {
      return Response.json({
        error: "Session found but accessToken is empty",
        shop,
        sessions: sessionList.map((s: any) => ({
          id: s.id,
          shop: s.shop,
          isOnline: s.isOnline,
          hasToken: !!s.accessToken,
        })),
      }, { status: 400 });
    }

    // Step 2: List existing webhooks
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

    // Step 3: Check if orders/create is registered
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
      stack: e.stack?.split("\n").slice(0, 5).join("\n"),
    }, { status: 500 });
  }
}
