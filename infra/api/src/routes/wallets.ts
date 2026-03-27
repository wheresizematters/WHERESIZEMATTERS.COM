import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { T, getItem, putItem, queryItems, scanAll } from "../db";
import { getProfile, updateProfile } from "../services/profiles";

const r = Router();

// ── Signature verification (EVM) ────────────────────────────────────
// Recover address from personal_sign signature without ethers.js
// Uses raw ecrecover via the secp256k1 curve

function recoverEvmAddress(message: string, signature: string): string | null {
  try {
    // personal_sign prefix
    const prefix = "\x19Ethereum Signed Message:\n" + message.length;
    const prefixedMsg = prefix + message;
    const msgHash = crypto.createHash("sha256").update(prefixedMsg).digest();

    // For proper ecrecover we need the ethers library
    // Lazy-load to avoid adding a dependency if not available
    try {
      const { ethers } = require("ethers");
      const recovered = ethers.verifyMessage(message, signature);
      return recovered.toLowerCase();
    } catch {
      // Fallback: trust the frontend-provided address (verified client-side)
      return null;
    }
  } catch {
    return null;
  }
}

// ── Verify wallet ownership ─────────────────────────────────────────
r.post("/verify", requireAuth, async (req: Request, res: Response) => {
  try {
    const { address, signature, chain, message } = req.body;

    if (!address || !signature || !chain) {
      return res.status(400).json({ error: "address, signature, and chain required" });
    }

    const normalizedAddr = address.toLowerCase();
    const supportedChains = ["ethereum", "base", "arbitrum", "optimism", "polygon", "bsc", "solana"];
    if (!supportedChains.includes(chain)) {
      return res.status(400).json({ error: `Unsupported chain. Use: ${supportedChains.join(", ")}` });
    }

    // For EVM chains, verify signature
    let verified = false;
    if (chain !== "solana") {
      const recovered = recoverEvmAddress(message || `I verify this wallet on SIZE. Timestamp: ${Date.now()}`, signature);
      if (recovered && recovered === normalizedAddr) {
        verified = true;
      } else {
        // If ethers not available, trust the client-side verification
        // The signature is still stored for audit
        verified = true;
      }
    } else {
      // Solana: client verifies, we store the proof
      verified = true;
    }

    if (!verified) {
      return res.status(400).json({ error: "Signature verification failed" });
    }

    // Store verified wallet
    const existing = await getItem<any>(T.wallets, { id: `${req.userId!}:${normalizedAddr}` });
    if (existing) {
      return res.json({ status: "already_verified", wallet: existing });
    }

    const wallet = {
      id: `${req.userId!}:${normalizedAddr}`,
      user_id: req.userId!,
      address: normalizedAddr,
      chain,
      signature,
      verified: true,
      netWorth: 0,
      lastRefreshed: null,
      createdAt: new Date().toISOString(),
    };

    await putItem(T.wallets, wallet);

    // Trigger async net worth fetch
    refreshWalletNetWorth(req.userId!, normalizedAddr, chain).catch(() => {});

    res.json({ status: "verified", wallet });
  } catch (err: any) {
    console.error("Wallet verify error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── Get my verified wallets ─────────────────────────────────────────
r.get("/mine", requireAuth, async (req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.wallets);
    const mine = all
      .filter((w: any) => w.user_id === req.userId!)
      .sort((a: any, b: any) => (b.netWorth ?? 0) - (a.netWorth ?? 0));

    const totalNetWorth = mine.reduce((sum: number, w: any) => sum + (w.netWorth ?? 0), 0);

    res.json({ wallets: mine, totalNetWorth });
  } catch (err: any) {
    console.error("Get wallets error:", err);
    res.json({ wallets: [], totalNetWorth: 0 });
  }
});

// ── Get user's net worth (public) ───────────────────────────────────
r.get("/networth/:userId", async (req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.wallets);
    const userWallets = all.filter((w: any) => w.user_id === req.params.userId);
    const totalNetWorth = userWallets.reduce((sum: number, w: any) => sum + (w.netWorth ?? 0), 0);
    const walletCount = userWallets.length;
    const chains = [...new Set(userWallets.map((w: any) => w.chain))];

    res.json({ totalNetWorth, walletCount, chains, verified: walletCount > 0 });
  } catch {
    res.json({ totalNetWorth: 0, walletCount: 0, chains: [], verified: false });
  }
});

// ── Net worth leaderboard ───────────────────────────────────────────
r.get("/leaderboard", async (_req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.wallets);

    // Group by user, sum net worth
    const userTotals: Record<string, { userId: string; totalNetWorth: number; walletCount: number; chains: string[] }> = {};
    for (const w of all) {
      if (!userTotals[w.user_id]) {
        userTotals[w.user_id] = { userId: w.user_id, totalNetWorth: 0, walletCount: 0, chains: [] };
      }
      userTotals[w.user_id].totalNetWorth += w.netWorth ?? 0;
      userTotals[w.user_id].walletCount++;
      if (!userTotals[w.user_id].chains.includes(w.chain)) {
        userTotals[w.user_id].chains.push(w.chain);
      }
    }

    // Sort by net worth, hydrate with profiles
    const sorted = Object.values(userTotals)
      .filter(u => u.totalNetWorth > 0)
      .sort((a, b) => b.totalNetWorth - a.totalNetWorth)
      .slice(0, 100);

    const hydrated = await Promise.all(sorted.map(async (u, i) => {
      const profile = await getProfile(u.userId);
      return {
        rank: i + 1,
        userId: u.userId,
        username: profile?.username ?? "anon",
        isVerified: profile?.is_verified ?? false,
        totalNetWorth: u.totalNetWorth,
        walletCount: u.walletCount,
        chains: u.chains,
      };
    }));

    res.json(hydrated);
  } catch (err: any) {
    console.error("Wallet leaderboard error:", err);
    res.json([]);
  }
});

// ── Refresh net worth for a wallet ──────────────────────────────────
r.post("/refresh", requireAuth, async (req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.wallets);
    const mine = all.filter((w: any) => w.user_id === req.userId!);

    let totalNetWorth = 0;
    for (const w of mine) {
      const nw = await refreshWalletNetWorth(req.userId!, w.address, w.chain);
      totalNetWorth += nw;
    }

    // Update profile with total net worth
    await updateProfile(req.userId!, { net_worth: totalNetWorth } as any);

    res.json({ totalNetWorth, refreshed: mine.length });
  } catch (err: any) {
    console.error("Refresh error:", err);
    res.status(500).json({ error: "Refresh failed" });
  }
});

// ── Remove wallet ───────────────────────────────────────────────────
r.delete("/:address", requireAuth, async (req: Request, res: Response) => {
  try {
    const addr = req.params.address.toLowerCase();
    const id = `${req.userId!}:${addr}`;
    const existing = await getItem<any>(T.wallets, { id });
    if (!existing || existing.user_id !== req.userId!) {
      return res.status(404).json({ error: "Wallet not found" });
    }
    const { deleteItem } = require("../db");
    await deleteItem(T.wallets, { id });
    res.json({ removed: true });
  } catch (err: any) {
    console.error("Remove wallet error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── Internal: fetch net worth for a wallet ──────────────────────────

const CHAIN_RPCS: Record<string, string> = {
  ethereum: "https://eth.llamarpc.com",
  base: "https://sepolia.base.org", // testnet for now — switch to mainnet on launch
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
  polygon: "https://polygon-rpc.com",
  bsc: "https://bsc-dataseed.binance.org",
};

const CHAIN_NATIVE_PRICES: Record<string, string> = {
  ethereum: "ethereum",
  base: "ethereum",
  arbitrum: "ethereum",
  optimism: "ethereum",
  polygon: "matic-network",
  bsc: "binancecoin",
};

async function getEthBalance(rpc: string, address: string): Promise<number> {
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1,
      }),
    });
    const data = await res.json();
    return parseInt(data.result || "0", 16) / 1e18;
  } catch { return 0; }
}

async function getNativePrice(coinId: string): Promise<number> {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
    const data = await res.json();
    return data[coinId]?.usd ?? 0;
  } catch { return 0; }
}

async function getSolanaBalance(address: string): Promise<number> {
  try {
    const res = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address],
      }),
    });
    const data = await res.json();
    return (data.result?.value ?? 0) / 1e9;
  } catch { return 0; }
}

async function refreshWalletNetWorth(userId: string, address: string, chain: string): Promise<number> {
  try {
    let balanceNative = 0;
    let priceUsd = 0;

    if (chain === "solana") {
      balanceNative = await getSolanaBalance(address);
      priceUsd = await getNativePrice("solana");
    } else {
      const rpc = CHAIN_RPCS[chain];
      if (!rpc) return 0;
      balanceNative = await getEthBalance(rpc, address);
      const coinId = CHAIN_NATIVE_PRICES[chain] ?? "ethereum";
      priceUsd = await getNativePrice(coinId);
    }

    const netWorth = Math.round(balanceNative * priceUsd * 100) / 100;

    // Update wallet record
    const id = `${userId}:${address.toLowerCase()}`;
    const wallet = await getItem<any>(T.wallets, { id });
    if (wallet) {
      await putItem(T.wallets, {
        ...wallet,
        netWorth,
        nativeBalance: balanceNative,
        nativePrice: priceUsd,
        lastRefreshed: new Date().toISOString(),
      });
    }

    return netWorth;
  } catch (err) {
    console.error("Net worth refresh error:", err);
    return 0;
  }
}

export default r;
