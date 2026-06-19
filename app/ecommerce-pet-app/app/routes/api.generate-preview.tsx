import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { nanoid } from "nanoid";
import { createJob } from "../utils/job-store.server";
import { buildPrompt } from "../utils/prompts.server";
import { withCors, handleCorsPreflight } from "../utils/cors.server";

// TODO: Restore Replicate integration — currently using uploaded photo as placeholder
const USE_REPLICATE = false;

// Handle CORS preflight (OPTIONS)
export function loader({ request }: LoaderFunctionArgs) {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }));
}

export async function action({ request }: ActionFunctionArgs) {
  // Handle CORS preflight
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  // Only allow POST
  if (request.method !== "POST") {
    return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }));
  }

  try {
    const { photo_url, style } = await request.json();

    if (!photo_url || !style) {
      return withCors(Response.json(
        { error: "photo_url and style are required" },
        { status: 400 }
      ));
    }

    const shop = request.headers.get("X-Shop-Domain") || "default";
    const jobId = nanoid();
    const prompt = buildPrompt(style);

    if (USE_REPLICATE) {
      // TODO: Restore Replicate flow
      // const prediction = await createPrediction(photo_url, prompt);
      // await createJob({ ... replicateId: prediction.id, status: "processing" });
      return withCors(Response.json({ error: "Replicate not enabled" }, { status: 503 }));
    }

    // Mock mode: immediately complete with uploaded photo as result
    await createJob({
      id: jobId,
      shop,
      petPhotoUrl: photo_url,
      paintingStyle: style,
      prompt,
      status: "completed",
      replicateId: null,
      resultUrl: photo_url,
    });

    return withCors(Response.json({ job_id: jobId, status: "accepted" }));
  } catch (error) {
    console.error("Generate preview error:", error);
    return withCors(Response.json(
      { error: "AI service temporarily unavailable. Please try again." },
      { status: 503 }
    ));
  }
}
