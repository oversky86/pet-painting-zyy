import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * Register webhook subscriptions via Admin API.
 * GET or POST /api/admin/register-webhooks
 */

// GET handler — for easy testing from browser URL bar
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { admin, session } = await authenticate.admin(request);
    const shop = session?.shop || "unknown";

    if (!admin) {
      return Response.json({ error: "No admin session", shop });
    }

    // Just list existing webhooks
    const existingResp = await admin.graphql(`
      {
        webhookSubscriptions(first: 20) {
          edges {
            node {
              id
              topic
              endpoint {
                ... on WebhookHttpEndpoint { callbackUrl }
              }
            }
          }
        }
      }
    `);
    const existingJson = await existingResp.json();
    const existing = existingJson.data?.webhookSubscriptions?.edges || [];

    return Response.json({
      status: "ok",
      shop,
      webhooks: existing.map((e: any) => ({
        topic: e.node.topic,
        url: e.node.endpoint?.callbackUrl,
      })),
      hint: "POST to this endpoint to register ORDERS_CREATE webhook",
    });
  } catch (e: any) {
    return Response.json({
      error: e.message || "Unknown error",
      status: e.status || 500,
      stack: e.stack?.split("\n").slice(0, 3).join("\n"),
    }, { status: 500 });
  }
}

// POST handler — register the webhook
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin, session } = await authenticate.admin(request);

    if (!admin) {
      return Response.json({ error: "No admin session" }, { status: 401 });
    }

    const results: Record<string, unknown> = {};
    const shop = session?.shop || "unknown";
    results.shop = shop;

    // Check existing webhook subscriptions
    const existingResp = await admin.graphql(`
      {
        webhookSubscriptions(first: 20) {
          edges {
            node {
              id
              topic
              endpoint {
                ... on WebhookHttpEndpoint { callbackUrl }
              }
            }
          }
        }
      }
    `);
    const existingJson = await existingResp.json();
    const existing = existingJson.data?.webhookSubscriptions?.edges || [];
    results.existingWebhooks = existing.map((e: any) => ({
      topic: e.node.topic,
      url: e.node.endpoint?.callbackUrl,
    }));

    // Check if orders/create webhook already exists
    const appUrl = process.env.SHOPIFY_APP_URL || "";
    const ordersCreateUrl = `${appUrl}/webhooks/orders/create`;
    const hasOrdersCreate = existing.some(
      (e: any) =>
        e.node.topic === "ORDERS_CREATE" &&
        e.node.endpoint?.callbackUrl?.includes("/webhooks/orders/create")
    );

    if (hasOrdersCreate) {
      results.ordersCreateWebhook = "ALREADY_EXISTS";
    } else {
      // Create the orders/create webhook subscription
      const createResp = await admin.graphql(
        `mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            webhookSubscription {
              id
              topic
              endpoint {
                ... on WebhookHttpEndpoint { callbackUrl }
              }
            }
            userErrors { message field }
          }
        }`,
        {
          variables: {
            topic: "ORDERS_CREATE",
            webhookSubscription: {
              callbackUrl: ordersCreateUrl,
              format: "JSON",
            },
          },
        }
      );
      const createJson = await createResp.json();
      const errors = createJson.data?.webhookSubscriptionCreate?.userErrors;
      results.ordersCreateWebhook = errors?.length
        ? { error: errors }
        : createJson.data?.webhookSubscriptionCreate?.webhookSubscription;
    }

    return Response.json({ status: "done", results });
  } catch (e: any) {
    return Response.json({
      error: e.message || "Unknown error",
      status: e.status || 500,
      stack: e.stack?.split("\n").slice(0, 3).join("\n"),
    }, { status: 500 });
  }
}
