import type { ActionFunctionArgs } from "react-router";
import { nanoid } from "nanoid";
import prisma from "../db.server";
import { createPrediction } from "../utils/replicate.server";
import { buildPrompt } from "../utils/prompts.server";

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { photo_url, style } = await request.json();

    if (!photo_url || !style) {
      return Response.json(
        { error: "photo_url and style are required" },
        { status: 400 }
      );
    }

    const shop = request.headers.get("X-Shop-Domain") || "default";
    const jobId = nanoid();
    const prompt = buildPrompt(style);

    // Create Replicate prediction (async, does not wait)
    const prediction = await createPrediction(photo_url, prompt);

    // Store job metadata in database
    await prisma.generationJob.create({
      data: {
        id: jobId,
        shop,
        petPhotoUrl: photo_url,
        paintingStyle: style,
        prompt,
        status: "processing",
        replicateId: prediction.id,
      },
    });

    return Response.json({ job_id: jobId, status: "accepted" });
  } catch (error) {
    console.error("Generate preview error:", error);
    return Response.json(
      { error: "AI service temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
}
