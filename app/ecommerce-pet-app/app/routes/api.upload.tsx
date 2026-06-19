import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { nanoid } from "nanoid";
import { uploadOriginalPhoto } from "../utils/supabase.server";
import { withCors, handleCorsPreflight } from "../utils/cors.server";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

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
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file) {
      return withCors(Response.json({ error: "No photo provided" }, { status: 400 }));
    }

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return withCors(
        Response.json({ error: "Invalid file type. Accepted: JPG, PNG, WebP" }, { status: 400 })
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return withCors(Response.json({ error: "File too large. Maximum size is 10MB" }, { status: 400 }));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const shop = request.headers.get("X-Shop-Domain") || "default";
    const jobId = nanoid();

    const photoUrl = await uploadOriginalPhoto(buffer, shop, jobId);

    return withCors(Response.json({ photo_url: photoUrl, job_id: jobId }));
  } catch (error) {
    console.error("Upload error:", error);
    return withCors(
      Response.json({ error: "Upload failed. Please try again." }, { status: 503 })
    );
  }
}
