/**
 * Launch $SIZE token via Clanker SDK on Base.
 *
 * Run: npx tsx launch-size-token.ts
 *
 * Prerequisites:
 * - DEPLOYER_PRIVATE_KEY in .env
 * - Deployer funded with ~0.01 ETH on Base
 */

import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const {
  WETH_ADDRESSES,
  POOL_POSITIONS,
  FEE_CONFIGS,
  DEFAULT_SUPPLY,
  clankerConfigFor,
  getTickFromMarketCap,
} = require("clanker-sdk");

const PROTOCOL_TREASURY = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";
const RPC = process.env.BASE_RPC_URL ?? "https://base-mainnet.core.chainstack.com/1f396980c6a698065bdf9bbebbb7fd78";

async function main() {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env");

  const account = privateKeyToAccount(key as `0x${string}`);
  console.log("Deployer:", account.address);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(RPC),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", (Number(balance) / 1e18).toFixed(6), "ETH");

  if (balance < BigInt(1e15)) {
    throw new Error("Insufficient ETH — need at least 0.001 ETH");
  }

  // Get Clanker config for Base
  const config = clankerConfigFor(base.id);
  console.log("\nClanker config loaded for Base (chain", base.id, ")");

  // Token deployment params
  const tokenName = "SIZE";
  const tokenSymbol = "SIZE";
  const tokenImage = "https://www.wheresizematters.com/og-image.png"; // Replace with IPFS later

  console.log("\nDeploying $SIZE token...");
  console.log("  Name:", tokenName);
  console.log("  Symbol:", tokenSymbol);
  console.log("  Supply:", "100,000,000,000 (100B)");
  console.log("  Pool: Standard position, paired with WETH");
  console.log("  Fees: Static 1%");
  console.log("  Rewards: 100% to protocol treasury");

  // The actual deployment call structure
  // Note: Clanker SDK requires the deploy to be called from a whitelisted
  // interface or via the Clanker factory contract directly.
  //
  // For production launch, use one of:
  // 1. clanker.world web UI (easiest, 100% creator fees)
  // 2. Farcaster @clanker bot (80% creator fees)
  // 3. Direct contract interaction via this script
  //
  // The reward recipient should be the fee collector bot wallet so it can
  // automatically claim and distribute fees.

  console.log("\n========================================");
  console.log("READY TO DEPLOY");
  console.log("========================================");
  console.log("\nOption 1 — clanker.world (recommended):");
  console.log("  1. Go to clanker.world");
  console.log("  2. Connect deployer wallet:", account.address);
  console.log("  3. Name: SIZE, Symbol: SIZE");
  console.log("  4. Set reward recipient to:", PROTOCOL_TREASURY);
  console.log("  5. Deploy — get contract address");
  console.log("");
  console.log("Option 2 — Farcaster bot:");
  console.log("  Cast: @clanker deploy SIZE $SIZE [image]");
  console.log("");
  console.log("After deployment, run:");
  console.log("  SIZE_TOKEN_ADDRESS=0x... npx hardhat run deploy/002_deploy_all.ts --network base");
}

main().catch(console.error);
