import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    throw new Response("Unhandled webhook topic", { status: 404 });
  }

  const orderPayload = payload as {
    id: number;
    email?: string;
    total_price?: string;
    note?: string;
    line_items?: Array<{
      id: number;
      properties?: Array<{ name: string; value: string }>;
    }>;
  };

  try {
    // Find the generation job ID from line item properties
    let generationJobId: string | null = null;

    for (const item of orderPayload.line_items || []) {
      const props = item.properties || [];
      const jobIdProp = props.find(
        (p) => p.name === "_generation_job_id"
      );
      if (jobIdProp?.value) {
        generationJobId = jobIdProp.value;
        break;
      }
    }

    if (generationJobId) {
      // Create order record linking to generation job
      await prisma.orderRecord.create({
        data: {
          shop,
          shopifyOrderId: String(orderPayload.id),
          generationJobId,
          customerEmail: orderPayload.email || null,
          totalAmount: orderPayload.total_price || null,
        },
      });

      // Update the generation job with the order ID
      await prisma.generationJob.update({
        where: { id: generationJobId },
        data: { shopifyOrderId: String(orderPayload.id) },
      });
    }
  } catch (error) {
    console.error("Webhook order processing error:", error);
    // Don't throw — webhook should always return 200 to Shopify
  }

  return new Response();
};
