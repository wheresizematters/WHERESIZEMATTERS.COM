import { ethers } from "ethers";
import { STAKING_ABI, ERC20_ABI } from "./types";
import { writeAdminLog } from "./s3";

/**
 * Fee collector — runs on a daily cron schedule.
 *
 * 1. Checks $SIZE token balance held by the fee collector wallet
 * 2. Approves the staking contract to spend the tokens
 * 3. Calls depositRewards() to distribute 75% fee tokens to stakers
 *
 * The 25% ETH split is handled separately at the Uniswap pool level
 * or via a manual claim from the clawn.ch fee collector.
 */

const RPC_URL = process.env.BASE_RPC_URL ?? "https://base-mainnet.core.chainstack.com/1f396980c6a698065bdf9bbebbb7fd78";
const STAKING_ADDRESS = process.env.STAKING_CONTRACT_ADDRESS ?? "";
const TOKEN_ADDRESS = process.env.SIZE_TOKEN_ADDRESS ?? "";
const FEE_COLLECTOR_KEY = process.env.FEE_COLLECTOR_PRIVATE_KEY ?? "";

// Minimum $SIZE balance to trigger a deposit (avoid dust deposits wasting gas)
const MIN_DEPOSIT = ethers.parseEther("10000"); // 10K $SIZE minimum

export async function collectAndDistributeFees(): Promise<void> {
  if (!STAKING_ADDRESS || !TOKEN_ADDRESS || !FEE_COLLECTOR_KEY) {
    console.warn("[fee-collector] Missing config, skipping");
    return;
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(FEE_COLLECTOR_KEY, provider);
  const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);
  const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, wallet);

  console.log("[fee-collector] Collector wallet:", wallet.address);

  // Check $SIZE balance
  const balance: bigint = await token.balanceOf(wallet.address);
  console.log("[fee-collector] $SIZE balance:", ethers.formatEther(balance));

  if (balance < MIN_DEPOSIT) {
    console.log("[fee-collector] Below minimum deposit threshold, skipping");
    return;
  }

  // Check ETH for gas
  const ethBalance = await provider.getBalance(wallet.address);
  if (ethBalance < ethers.parseEther("0.001")) {
    console.error("[fee-collector] Insufficient ETH for gas");
    await writeAdminLog("fee-collection-failed", {
      reason: "insufficient_gas",
      ethBalance: ethers.formatEther(ethBalance),
      sizeBalance: ethers.formatEther(balance),
    });
    return;
  }

  try {
    // Approve staking contract
    console.log("[fee-collector] Approving staking contract...");
    const approveTx = await token.approve(STAKING_ADDRESS, balance);
    await approveTx.wait(2);

    // Deposit rewards
    console.log("[fee-collector] Depositing", ethers.formatEther(balance), "$SIZE as rewards...");
    const depositTx = await staking.depositRewards(balance);
    const receipt = await depositTx.wait(2);

    console.log("[fee-collector] Rewards deposited. TX:", receipt.hash);

    // Audit log
    await writeAdminLog("fee-collection-success", {
      amount: ethers.formatEther(balance),
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      collector: wallet.address,
    });
  } catch (err: any) {
    console.error("[fee-collector] Deposit failed:", err.message);
    await writeAdminLog("fee-collection-failed", {
      reason: err.message,
      sizeBalance: ethers.formatEther(balance),
    });
  }
}

// Run directly if called as script
if (require.main === module) {
  collectAndDistributeFees()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
