/**
 * Migration script: Supabase → DynamoDB
 *
 * Pulls all data from Supabase Postgres and writes it to DynamoDB tables.
 * Supabase Auth + Storage stay as-is; only data tables are migrated.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... tsx scripts/migrate-from-supabase.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { batchWrite, T } from "../src/db";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fetchAll(table: string): Promise<any[]> {
  let all: any[] = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(offset, offset + pageSize - 1);
    if (error) { console.error(`Error fetching ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function migrateTable(supabaseTable: string, dynamoTable: string, transform?: (row: any) => any) {
  console.log(`\n→ Migrating ${supabaseTable} → ${dynamoTable}`);
  const rows = await fetchAll(supabaseTable);
  console.log(`  Found ${rows.length} rows`);

  if (rows.length === 0) return;

  const items = transform ? rows.map(transform) : rows;

  // Remove null/undefined values (DynamoDB doesn't allow them)
  const cleaned = items.map((item) => {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(item)) {
      if (v !== null && v !== undefined) clean[k] = v;
    }
    return clean;
  });

  await batchWrite(dynamoTable, cleaned);
  console.log(`  ✓ Wrote ${cleaned.length} items`);
}

async function main() {
  console.log("=== SIZE. Data Migration: Supabase → DynamoDB ===");
  console.log(`  Source: ${SUPABASE_URL}`);
  console.log(`  Target: DynamoDB (${process.env.AWS_REGION ?? "us-east-1"})`);

  await migrateTable("profiles", T.profiles, (row) => ({
    ...row,
    size_coins: row.size_coins ?? 0,
    is_verified: row.is_verified ?? false,
    has_set_size: row.has_set_size ?? false,
    is_admin: row.is_admin ?? false,
    is_premium: row.is_premium ?? false,
    notifications_enabled: row.notifications_enabled ?? true,
    staking_tier: row.staking_tier ?? 0,
    staking_amount: row.staking_amount ?? 0,
  }));

  await migrateTable("posts", T.posts, (row) => ({
    ...row,
    comment_count: row.comment_count ?? 0,
    score: row.score ?? 0,
  }));

  await migrateTable("poll_options", T.poll_options, (row) => ({
    ...row,
    vote_count: row.vote_count ?? 0,
  }));

  await migrateTable("votes", T.votes);
  await migrateTable("post_votes", T.post_votes);
  await migrateTable("comments", T.comments);
  await migrateTable("conversations", T.conversations);
  await migrateTable("messages", T.messages);
  await migrateTable("follows", T.follows);
  await migrateTable("verification_requests", T.verifications);

  console.log("\n=== Migration complete ===");
  console.log("Note: Supabase Auth + Storage remain active.");
  console.log("Update the app to point to the new API server.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
