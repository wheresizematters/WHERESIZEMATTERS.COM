import { ethers } from "ethers";
import { STAKING_ABI, StakingEvent } from "./types";
import { putPosition, putEvent } from "./db";
import { writeEventLog } from "./s3";

const RPC_URL = process.env.BASE_RPC_URL ?? "https://base-mainnet.core.chainstack.com/1f396980c6a698065bdf9bbebbb7fd78";
const WSS_URL = process.env.BASE_WSS_URL ?? "wss://base-mainnet.core.chainstack.com/1f396980c6a698065bdf9bbebbb7fd78";
const STAKING_ADDRESS = process.env.STAKING_CONTRACT_ADDRESS ?? "";
const CONFIRMATIONS = 2; // blocks to wait before processing

let provider: ethers.WebSocketProvider | ethers.JsonRpcProvider;
let contract: ethers.Contract;
let lastProcessedBlock = 0;

export function initChainListener(): void {
  if (!STAKING_ADDRESS) {
    console.warn("[chain-listener] No STAKING_CONTRACT_ADDRESS set, skipping");
    return;
  }

  // Prefer WSS for real-time events, fall back to HTTP polling
  try {
    provider = new ethers.WebSocketProvider(WSS_URL);
    console.log("[chain-listener] Connected via WebSocket");
  } catch {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("[chain-listener] Falling back to HTTP polling");
  }

  contract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);
  listenForEvents();
  startPolling();
}

// ── Real-time event listeners ──────────────────────────────────────

function listenForEvents(): void {
  contract.on("Staked", async (user: string, amount: bigint, tier: bigint, event: ethers.EventLog) => {
    await handleEvent("staked", user, amount, Number(tier), event);
  });

  contract.on("Unstaked", async (user: string, amount: bigint, tier: bigint, event: ethers.EventLog) => {
    await handleEvent("unstaked", user, amount, Number(tier), event);
  });

  contract.on("RewardsClaimed", async (user: string, amount: bigint, event: ethers.EventLog) => {
    await handleEvent("claimed", user, amount, 0, event);
  });

  contract.on("RewardsDeposited", async (depositor: string, amount: bigint, event: ethers.EventLog) => {
    await handleEvent("deposited", depositor, amount, 0, event);
  });

  contract.on("EmergencyWithdraw", async (user: string, amount: bigint, event: ethers.EventLog) => {
    await handleEvent("unstaked", user, amount, 0, event);
  });

  console.log("[chain-listener] Listening for staking events on", STAKING_ADDRESS);
}

async function handleEvent(
  eventType: StakingEvent["event_type"],
  walletAddress: string,
  amount: bigint,
  tierAtTime: number,
  event: ethers.EventLog
): Promise<void> {
  try {
    const block = await event.getBlock();
    if (!block) return;

    const currentBlock = await provider.getBlockNumber();
    if (currentBlock - block.number < CONFIRMATIONS) {
      // Wait for confirmations
      console.log(`[chain-listener] Waiting for ${CONFIRMATIONS} confirmations for tx ${event.transactionHash}`);
      await waitForConfirmations(event.transactionHash, CONFIRMATIONS);
    }

    const timestamp = block.timestamp;
    const stakingEvent: StakingEvent = {
      wallet_address: walletAddress.toLowerCase(),
      sort_key: `${timestamp}#${event.transactionHash}`,
      event_type: eventType,
      amount: amount.toString(),
      block_number: block.number,
      tx_hash: event.transactionHash,
      tier_at_time: tierAtTime,
      timestamp,
    };

    // Write to DynamoDB
    await putEvent(stakingEvent);

    // Update position from on-chain state
    await syncPositionFromChain(walletAddress, block.number);

    // Audit log to S3
    await writeEventLog(eventType, walletAddress, event.transactionHash, stakingEvent);

    console.log(`[chain-listener] ${eventType} — ${walletAddress.slice(0, 8)}... — ${ethers.formatEther(amount)} $SIZE`);
  } catch (err) {
    console.error(`[chain-listener] Error handling ${eventType}:`, err);
  }
}

// ── Sync position from chain (source of truth) ────────────────────

async function syncPositionFromChain(walletAddress: string, blockNumber: number): Promise<void> {
  try {
    const info = await contract.getStakeInfo(walletAddress);
    await putPosition({
      wallet_address: walletAddress.toLowerCase(),
      staked_amount: info.stakedAmount.toString(),
      tier: Number(info.tier),
      effective_stake: info.effectiveStake.toString(),
      pending_rewards: info.pendingRewards.toString(),
      staked_at: 0, // filled from events if needed
      last_claim_at: 0,
      last_updated_block: blockNumber,
    });
  } catch (err) {
    console.error(`[chain-listener] Failed to sync position for ${walletAddress}:`, err);
  }
}

// ── Confirmation waiter ────────────────────────────────────────────

async function waitForConfirmations(txHash: string, required: number): Promise<void> {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return;
  await receipt.confirmations();
}

// ── Polling fallback (catches missed events) ───────────────────────

function startPolling(): void {
  const POLL_INTERVAL = 30_000; // 30 seconds

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (lastProcessedBlock === 0) {
        lastProcessedBlock = currentBlock - 100; // start 100 blocks back on first run
      }

      if (currentBlock <= lastProcessedBlock) return;

      const fromBlock = lastProcessedBlock + 1;
      const toBlock = Math.min(currentBlock - CONFIRMATIONS, fromBlock + 1000); // max 1000 blocks per poll

      if (toBlock < fromBlock) return;

      const events = await contract.queryFilter("*" as any, fromBlock, toBlock);

      for (const event of events) {
        if (event instanceof ethers.EventLog) {
          const eventName = event.eventName;
          if (!eventName) continue;

          // Events already handled by real-time listener will be idempotent
          // because DynamoDB PutCommand with same key just overwrites
          const args = event.args;
          if (eventName === "Staked" || eventName === "Unstaked") {
            await handleEvent(
              eventName.toLowerCase() as "staked" | "unstaked",
              args[0], args[1], Number(args[2]), event
            );
          } else if (eventName === "RewardsClaimed") {
            await handleEvent("claimed", args[0], args[1], 0, event);
          } else if (eventName === "RewardsDeposited") {
            await handleEvent("deposited", args[0], args[1], 0, event);
          } else if (eventName === "EmergencyWithdraw") {
            await handleEvent("unstaked", args[0], args[1], 0, event);
          }
        }
      }

      lastProcessedBlock = toBlock;
    } catch (err) {
      console.error("[chain-listener] Polling error:", err);
    }
  }, POLL_INTERVAL);
}
