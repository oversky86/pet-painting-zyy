import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { getPrediction, downloadImage } from "../utils/replicate.server";
import { uploadPainting } from "../utils/supabase.server";
import { withCors, handleCorsPreflight } from "../utils/cors.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  // Handle CORS preflight
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  // Only allow GET
  if (request.method !== "GET") {
    return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }));
  }

  const jobId = params.jobId;
  if (!jobId) {
    return withCors(Response.json({ status: "not_found" }, { status: 404 }));
  }

  try {
    // Look up the job in the database
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return Response.json({ status: "not_found" }, { status: 404 });
    }

    // If already completed, return cached result
    if (job.status === "completed") {
      return withCors(Response.json({ status: "completed", result_url: job.resultUrl }));
    }

    // If already failed, return error
    if (job.status === "failed") {
      return withCors(Response.json({ status: "failed", error: "Generation failed" }));
    }

    // Poll Replicate for prediction status
    if (!job.replicateId) {
      return withCors(Response.json({ status: "processing" }));
    }

    const prediction = await getPrediction(job.replicateId);

    // Handle failed prediction
    if (prediction.status === "failed") {
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { status: "failed" },
      });
      return withCors(Response.json({
        status: "failed",
        error: prediction.error || "Generation failed",
      }));
    }

    // Handle successful prediction: download → upload to Supabase
    if (prediction.status === "succeeded" && prediction.output) {
      const outputUrl =
        typeof prediction.output === "string"
          ? prediction.output
          : Array.isArray(prediction.output)
            ? prediction.output[0]
            : "";

      if (!outputUrl) {
        return withCors(Response.json({ status: "processing" }));
      }

      // Image transfer: Replicate output → memory download → Supabase Storage upload
      const imageBuffer = await downloadImage(outputUrl);
      const paintingUrl = await uploadPainting(imageBuffer, job.shop, jobId);

      // Update job with result
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { status: "completed", resultUrl: paintingUrl },
      });

      return withCors(Response.json({ status: "completed", result_url: paintingUrl }));
    }

    // Still processing
    return withCors(Response.json({ status: "processing" }));
  } catch (error) {
    console.error("Job status check error:", error);
    return withCors(Response.json({ status: "processing" }));
  }
}
