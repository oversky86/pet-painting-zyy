import { type ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import prisma from "../db.server";

/**
 * Admin endpoint to initialize database tables and run diagnostics.
 * POST /api/admin/db-init
 */
export async function action({ request }: ActionFunctionArgs) {
  const results: Record<string, unknown> = {};

  // Step 1: Check connection info
  try {
    const connInfo = await prisma.$queryRaw`
      SELECT current_database() as db, current_user as usr, current_schema() as schema, version() as ver`;
    results.connectionInfo = connInfo;
  } catch (e: any) {
    results.connectionInfo = `ERROR: ${e.message}`;
  }

  // Step 2: Check existing tables
  try {
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    results.existingTables = tables;
  } catch (e: any) {
    results.existingTables = `ERROR: ${e.message}`;
  }

  // Step 3: Try to create tables via raw SQL DDL
  try {
    // Session table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "shop" TEXT NOT NULL,
        "state" TEXT NOT NULL,
        "isOnline" BOOLEAN NOT NULL DEFAULT false,
        "scope" TEXT,
        "expires" TIMESTAMP(3),
        "accessToken" TEXT NOT NULL,
        "userId" BIGINT,
        "firstName" TEXT,
        "lastName" TEXT,
        "email" TEXT,
        "accountOwner" BOOLEAN NOT NULL DEFAULT false,
        "locale" TEXT,
        "collaborator" BOOLEAN DEFAULT false,
        "emailVerified" BOOLEAN DEFAULT false,
        "refreshToken" TEXT,
        "refreshTokenExpires" TIMESTAMP(3)
      )
    `);
    results.sessionTable = "CREATED";

    // GenerationJob table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GenerationJob" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "shop" TEXT NOT NULL,
        "petPhotoUrl" TEXT NOT NULL,
        "paintingStyle" TEXT NOT NULL,
        "prompt" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "resultUrl" TEXT,
        "replicateId" TEXT,
        "shopifyOrderId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      )
    `);
    results.generationJobTable = "CREATED";

    // PaintingStyle table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PaintingStyle" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "name" TEXT NOT NULL UNIQUE,
        "description" TEXT NOT NULL,
        "prompt" TEXT NOT NULL,
        "previewUrl" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "sortOrder" INTEGER NOT NULL DEFAULT 0
      )
    `);
    results.paintingStyleTable = "CREATED";

    // OrderRecord table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OrderRecord" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "shop" TEXT NOT NULL,
        "shopifyOrderId" TEXT NOT NULL UNIQUE,
        "generationJobId" TEXT NOT NULL,
        "customerEmail" TEXT,
        "totalAmount" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OrderRecord_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    results.orderRecordTable = "CREATED";

    // Prisma migration tracking table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "finished_at" TIMESTAMP(3),
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMP(3),
        "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )
    `);
    results.prismaMigrationsTable = "CREATED";

  } catch (e: any) {
    results.ddlError = `DDL FAILED: ${e.message}`;
  }

  // Step 4: Verify tables exist after DDL
  try {
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
    results.tablesAfterDDL = tables;
  } catch (e: any) {
    results.tablesAfterDDL = `ERROR: ${e.message}`;
  }

  // Step 5: Supabase Storage check
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase.storage.listBuckets();
    results.supabaseStorage = error
      ? `ERROR: ${error.message}`
      : `OK — buckets: ${data.map((b) => b.name).join(", ")}`;
  } catch (e: any) {
    results.supabaseStorage = `EXCEPTION: ${e.message}`;
  }

  return Response.json({ status: "done", results, time: new Date().toISOString() });
}
