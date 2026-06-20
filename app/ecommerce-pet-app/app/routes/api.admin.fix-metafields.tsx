import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * Debug endpoint to manually set order metafields.
 * POST /api/admin/fix-metafields
 * Body: { orderId: "123456", original_photo_url, painting_url, style }
 */
export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  if (!admin) {
    return Response.json({ error: "No admin session" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orderId, original_photo_url, painting_url, style } = body;

    if (!orderId) {
      return Response.json({ error: "orderId is required" }, { status: 400 });
    }

    const ownerId = `gid://shopify/Order/${orderId}`;
    const results: Record<string, unknown> = {};

    // Step 1: Ensure metafield definitions exist
    const definitions = [
      {
        name: "Original Photo URL",
        namespace: "custom",
        key: "original_photo_url",
        type: "single_line_text_field",
        ownerType: "ORDER",
        pin: true,
        access: { admin: "MERCHANT_READ" as const },
      },
      {
        name: "Painting URL",
        namespace: "custom",
        key: "painting_url",
        type: "single_line_text_field",
        ownerType: "ORDER",
        pin: true,
        access: { admin: "MERCHANT_READ" as const },
      },
      {
        name: "Painting Style",
        namespace: "custom",
        key: "painting_style",
        type: "single_line_text_field",
        ownerType: "ORDER",
        pin: true,
        access: { admin: "MERCHANT_READ" as const },
      },
    ];

    for (const def of definitions) {
      try {
        const defResp = await admin.graphql(
          `mutation CreateMetafieldDef($definition: MetafieldDefinitionInput!) {
            metafieldDefinitionCreate(definition: $definition) {
              createdDefinition { id name namespace key }
              userErrors { message field code }
            }
          }`,
          { variables: { definition: def } }
        );
        const defJson = await defResp.json();
        const defErrors = defJson.data?.metafieldDefinitionCreate?.userErrors;
        results[`def_${def.key}`] = defErrors?.length ? defErrors : "OK";
      } catch (e: any) {
        results[`def_${def.key}`] = `ERROR: ${e.message}`;
      }
    }

    // Step 2: Set metafields on the order
    const metafields = [
      original_photo_url && {
        ownerId,
        namespace: "custom",
        key: "original_photo_url",
        value: original_photo_url,
        type: "single_line_text_field",
      },
      painting_url && {
        ownerId,
        namespace: "custom",
        key: "painting_url",
        value: painting_url,
        type: "single_line_text_field",
      },
      style && {
        ownerId,
        namespace: "custom",
        key: "painting_style",
        value: style,
        type: "single_line_text_field",
      },
    ].filter(Boolean);

    if (metafields.length > 0) {
      const mfResp = await admin.graphql(
        `mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { id key namespace value }
            userErrors { message field code }
          }
        }`,
        { variables: { metafields } }
      );
      const mfJson = await mfResp.json();
      results.metafieldsSet = mfJson.data?.metafieldsSet?.userErrors?.length
        ? mfJson.data.metafieldsSet.userErrors
        : mfJson.data?.metafieldsSet?.metafields || "OK";
    }

    return Response.json({ status: "done", results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
