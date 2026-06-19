/**
 * CORS utility for App API routes.
 * Allows cross-origin requests from the frontend (Vercel).
 */

const ALLOWED_ORIGINS = [
  "https://pet-paiting-frontend.vercel.app",
  "http://localhost:3000",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Allow no-origin (same-origin, server-to-server)
  return ALLOWED_ORIGINS.some((o) => origin.startsWith(o));
}

/**
 * Wrap a Response with CORS headers.
 * Use this for all API route responses.
 */
export function withCors(response: Response): Response {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Shop-Domain");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

/**
 * Handle OPTIONS preflight request.
 * Returns a 204 response with CORS headers, or null if not OPTIONS.
 */
export function handleCorsPreflight(request: Request): Response | null {
  if (request.method !== "OPTIONS") return null;
  return withCors(new Response(null, { status: 204 }));
}
