import { type LoaderFunctionArgs } from "react-router";

export function loader(_args: LoaderFunctionArgs) {
  return Response.json({
    status: "ok",
    env: {
      SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
      SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
      DATABASE_URL: !!process.env.DATABASE_URL,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      REPLICATE_API_TOKEN: !!process.env.REPLICATE_API_TOKEN,
    },
    time: new Date().toISOString(),
  });
}
