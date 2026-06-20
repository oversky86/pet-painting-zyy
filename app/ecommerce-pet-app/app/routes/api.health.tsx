import { type LoaderFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import prisma from "../db.server";

export async function loader(_args: LoaderFunctionArgs) {
  const checks: Record<string, unknown> = {
    SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
    DATABASE_URL: !!process.env.DATABASE_URL,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    REPLICATE_API_TOKEN: !!process.env.REPLICATE_API_TOKEN,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL || "(not set)",
  };

  // Test Supabase Storage
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase.storage.listBuckets();
    checks.supabaseStorage = error
      ? `ERROR: ${error.message}`
      : `OK — buckets: ${data.map((b) => b.name).join(", ")}`;
  } catch (e: any) {
    checks.supabaseStorage = `EXCEPTION: ${e.message}`;
  }

  // Test Database
  try {
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    checks.database = `OK — tables: ${(tables as any[]).map((t: any) => t.tablename).join(", ")}`;

    // Check Session table
    const sessionCount = await prisma.$queryRaw`SELECT count(*) as cnt FROM "Session"`;
    checks.sessionCount = (sessionCount as any[])?.[0]?.cnt || 0;

    const sessions = await prisma.$queryRaw`SELECT id, shop, "isOnline" FROM "Session" LIMIT 5`;
    checks.sessions = sessions;
  } catch (e: any) {
    checks.database = `EXCEPTION: ${e.message}`;
  }

  return Response.json({
    status: "ok",
    checks,
    time: new Date().toISOString(),
  });
}
