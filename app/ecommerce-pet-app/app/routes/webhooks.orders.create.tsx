import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload, admin } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    throw new Response("Unhandled webhook topic", { status: 404 });
  }

  const orderPayload = payload as {
    id: number;
    email?: string;
    total_price?: string;
    line_items?: Array<{
      id: number;
      properties?: Array<{ name: string; value: string }>;
    }>;
  };

  try {
    // Extract custom painting attributes from line item properties
    const customAttrs: Record<string, string> = {};
    const attrKeys = ["original_photo_url", "painting_url", "style"];

    for (const item of orderPayload.line_items || []) {
      for (const prop of item.properties || []) {
        if (attrKeys.includes(prop.name) && prop.value) {
          customAttrs[prop.name] = prop.value;
        }
      }
      if (Object.keys(customAttrs).length === attrKeys.length) break;
    }

    // Set order metafields via Admin API if custom attributes exist
    if (Object.keys(customAttrs).length > 0 && admin) {
      const metafields = [
        customAttrs.original_photo_url && {
          namespace: "custom",
          key: "original_photo_url",
          value: customAttrs.original_photo_url,
          type: "single_line_text_field",
        },
        customAttrs.painting_url && {
          namespace: "custom",
          key: "painting_url",
          value: customAttrs.painting_url,
          type: "single_line_text_field",
        },
        customAttrs.style && {
          namespace: "custom",
          key: "painting_style",
          value: customAttrs.style,
          type: "single_line_text_field",
        },
      ].filter(Boolean);

      if (metafields.length > 0) {
        const ownerId = `gid://shopify/Order/${orderPayload.id}`;
        await admin.graphql(
          `mutation SetOrderMetafields($ownerId: ID!, $metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields { id key namespace }
              userErrors { message field }
            }
          }`,
          {
            variables: {
              ownerId,
              metafields: metafields.map((mf) => ({
                ...mf,
                ownerId,
              })),
            },
          }
        );
        console.log(`Order ${orderPayload.id}: set ${metafields.length} metafields`);
      }
    }
  } catch (error) {
    console.error("Webhook order processing error:", error);
    // Don't throw — webhook should always return 200 to Shopify
  }

  return new Response();
};
