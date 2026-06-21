import type { UploadResponse, GenerateResponse, JobStatusResponse } from "./types";

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function uploadPhoto(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("photo", file);
  const res = await fetch(`${APP_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Upload failed: ${res.status} — ${body.detail || body.error || "unknown"}`);
  }
  return res.json();
}

export async function generatePreview(
  photoUrl: string,
  style: string,
  generate?: boolean
): Promise<GenerateResponse> {
  const res = await fetch(`${APP_BASE_URL}/api/generate-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo_url: photoUrl, style, generate: generate ?? false }),
  });
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
  return res.json();
}

// Performance: AbortSignal support for cancelling stale polling requests
export async function getJobStatus(
  jobId: string,
  signal?: AbortSignal
): Promise<JobStatusResponse> {
  const res = await fetch(`${APP_BASE_URL}/api/job-status/${jobId}`, {
    signal,
  });
  if (!res.ok) throw new Error(`Job status check failed: ${res.status}`);
  return res.json();
}
