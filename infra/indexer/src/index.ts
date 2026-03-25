import "dotenv/config";
import app from "./api";
import { initChainListener } from "./chain-listener";
import { syncActivityScores } from "./reward-engine";
import { collectAndDistributeFees } from "./fee-collector";
import { writeSnapshotLog } from "./s3";
import { getAllPositions, getTierCounts, putSnapshot } from "./db";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const ACTIVITY_SYNC_INTERVAL = 15 * 60_000;   // 15 minutes
const SNAPSHOT_INTERVAL = 60 * 60_000;          // 1 hour
const FEE_COLLECTION_INTERVAL = 24 * 60 * 60_000; // 24 hours (daily)

async function main() {
  console.log("=== SIZE Staking Indexer ===");
  console.log(`  Port: ${PORT}`);
  console.log(`  Staking contract: ${process.env.STAKING_CONTRACT_ADDRESS ?? "NOT SET"}`);
  console.log(`  Base RPC: ${process.env.BASE_RPC_URL?.slice(0, 40) ?? "default"}...`);

  // Start API server
  app.listen(PORT, () => {
    console.log(`[api] Listening on port ${PORT}`);
  });

  // Start chain event listener
  initChainListener();

  // Activity score sync (every 15 min)
  syncActivityScores().catch(console.error);
  setInterval(() => {
    syncActivityScores().catch(console.error);
  }, ACTIVITY_SYNC_INTERVAL);

  // Hourly snapshots
  setInterval(async () => {
    try {
      const positions = await getAllPositions();
      const tierCounts = await getTierCounts();
      const now = new Date();
      const totalStaked = positions.reduce(
        (sum, p) => sum + BigInt(p.staked_amount || "0"), 0n
      );

      const snapshot = {
        snapshot_date: now.toISOString().split("T")[0],
        snapshot_hour: String(now.getUTCHours()).padStart(2, "0"),
        total_staked: totalStaked.toString(),
        total_stakers: positions.filter((p) => p.staked_amount !== "0").length,
        reward_pool_balance: "0", // TODO: read from contract
        acc_reward_per_share: "0",
        tier_counts: tierCounts as any,
      };

      await putSnapshot(snapshot);
      await writeSnapshotLog(snapshot);
      console.log(`[snapshot] Recorded at ${now.toISOString()}`);
    } catch (err) {
      console.error("[snapshot] Error:", err);
    }
  }, SNAPSHOT_INTERVAL);

  // Fee collection (once daily)
  if (process.env.FEE_COLLECTOR_PRIVATE_KEY) {
    setInterval(() => {
      collectAndDistributeFees().catch(console.error);
    }, FEE_COLLECTION_INTERVAL);
    console.log("[fee-collector] Scheduled once daily");
  } else {
    console.log("[fee-collector] No FEE_COLLECTOR_PRIVATE_KEY, fee collection disabled");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
