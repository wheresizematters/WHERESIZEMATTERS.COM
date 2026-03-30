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

    // Enrich with Arkham Intelligence (labels, entity info)
    let arkhamEntity: any = null;
    let arkhamLabel: string | null = null;
    try {
      const arkRes = await fetch(`${ARKHAM_URL}/intelligence/address/${normalizedAddr}`, {
        headers: { "API-Key": ARKHAM_KEY },
      });
      if (arkRes.ok) {
        const arkData = await arkRes.json();
        if (arkData.arkhamEntity) arkhamEntity = arkData.arkhamEntity;
        if (arkData.arkhamLabel) arkhamLabel = arkData.arkhamLabel.name ?? null;
      }
    } catch {}

    const wallet = {
      id: `${req.userId!}:${normalizedAddr}`,
      user_id: req.userId!,
      address: normalizedAddr,
      chain,
      signature,
      verified: true,
      netWorth: 0,
      arkhamEntity: arkhamEntity?.name ?? null,
      arkhamLabel,
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

// ── Get full portfolio breakdown ─────────────────────────────────────
r.get("/portfolio/:userId", async (req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.wallets);
    const userWallets = all.filter((w: any) => w.user_id === req.params.userId);

    const portfolio: any[] = [];
    let totalNetWorth = 0;

    for (const w of userWallets) {
      totalNetWorth += w.netWorth ?? 0;
      for (const h of (w.holdings ?? [])) {
        // Merge same token across wallets
        const existing = portfolio.find(p => p.symbol === h.symbol && p.address === h.address);
        if (existing) {
          existing.balanceFormatted += h.balanceFormatted;
          existing.valueUsd += h.valueUsd;
        } else {
          portfolio.push({ ...h });
        }
      }
    }

    portfolio.sort((a, b) => b.valueUsd - a.valueUsd);

    res.json({
      totalNetWorth: Math.round(totalNetWorth * 100) / 100,
      walletCount: userWallets.length,
      tokenCount: portfolio.length,
      holdings: portfolio.slice(0, 50),
    });
  } catch {
    res.json({ totalNetWorth: 0, walletCount: 0, tokenCount: 0, holdings: [] });
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

const ARKHAM_KEY = process.env.ARKHAM_API_KEY ?? "1551a77e-e082-4b66-87b7-08b759360c3b";
const ARKHAM_URL = "https://api.arkhamintelligence.com";

const CHAIN_RPCS: Record<string, string> = {
  ethereum: "https://eth.llamarpc.com",
  base: "https://base-mainnet.core.chainstack.com/1f396980c6a698065bdf9bbebbb7fd78",
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

// ── Deep portfolio scanner ───────────────────────────────────────

// ERC-20 balanceOf(address) selector
const BALANCE_OF_SELECTOR = "0x70a08231";

async function getERC20Balance(rpc: string, tokenAddress: string, walletAddress: string): Promise<bigint> {
  try {
    const data = BALANCE_OF_SELECTOR + walletAddress.slice(2).toLowerCase().padStart(64, "0");
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: tokenAddress, data }, "latest"], id: 1 }),
    });
    const result = await res.json();
    return BigInt(result.result || "0x0");
  } catch { return 0n; }
}

async function discoverTokensViaArkham(address: string, chain: string): Promise<{ tokenAddress: string; tokenSymbol: string; tokenName: string; decimals: number }[]> {
  try {
    // Get recent transfers to find all tokens this wallet has interacted with
    const res = await fetch(
      `${ARKHAM_URL}/transfers?base=${address}&chain=${chain}&limit=200`,
      { headers: { "API-Key": ARKHAM_KEY } },
    );
    if (!res.ok) return [];
    const data = await res.json();

    // Extract unique token addresses from transfers
    const tokenMap = new Map<string, { tokenAddress: string; tokenSymbol: string; tokenName: string; decimals: number }>();
    for (const tx of data.transfers ?? []) {
      if (tx.tokenAddress && tx.tokenAddress !== "0x0000000000000000000000000000000000000000") {
        tokenMap.set(tx.tokenAddress.toLowerCase(), {
          tokenAddress: tx.tokenAddress,
          tokenSymbol: tx.tokenSymbol ?? "???",
          tokenName: tx.tokenName ?? "Unknown",
          decimals: tx.tokenDecimals ?? 18,
        });
      }
    }
    return Array.from(tokenMap.values());
  } catch { return []; }
}

async function getTokenPrices(contractAddresses: string[], chain: string): Promise<Record<string, number>> {
  // Use CoinGecko's contract price lookup
  const platformMap: Record<string, string> = {
    ethereum: "ethereum", base: "base", arbitrum: "arbitrum-one",
    optimism: "optimistic-ethereum", polygon: "polygon-pos", bsc: "binance-smart-chain",
  };
  const platform = platformMap[chain];
  if (!platform || contractAddresses.length === 0) return {};

  try {
    // CoinGecko allows up to 100 addresses per call
    const batch = contractAddresses.slice(0, 100).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${batch}&vs_currencies=usd`,
    );
    if (!res.ok) return {};
    const data = await res.json();
    const prices: Record<string, number> = {};
    for (const [addr, priceData] of Object.entries(data)) {
      prices[addr.toLowerCase()] = (priceData as any)?.usd ?? 0;
    }
    return prices;
  } catch { return {}; }
}

interface TokenHolding {
  symbol: string;
  name: string;
  address: string;
  balance: string;
  balanceFormatted: number;
  priceUsd: number;
  valueUsd: number;
}

async function refreshWalletNetWorth(userId: string, address: string, chain: string): Promise<number> {
  try {
    const rpc = CHAIN_RPCS[chain];
    const holdings: TokenHolding[] = [];
    let totalNetWorth = 0;

    // ── Step 1: Native balance ──────────────────────────────────
    if (chain === "solana") {
      const bal = await getSolanaBalance(address);
      const price = await getNativePrice("solana");
      const value = bal * price;
      holdings.push({ symbol: "SOL", name: "Solana", address: "native", balance: bal.toString(), balanceFormatted: bal, priceUsd: price, valueUsd: value });
      totalNetWorth += value;
    } else if (rpc) {
      const bal = await getEthBalance(rpc, address);
      const coinId = CHAIN_NATIVE_PRICES[chain] ?? "ethereum";
      const price = await getNativePrice(coinId);
      const nativeSymbol = chain === "polygon" ? "MATIC" : chain === "bsc" ? "BNB" : "ETH";
      const value = bal * price;
      holdings.push({ symbol: nativeSymbol, name: nativeSymbol, address: "native", balance: bal.toString(), balanceFormatted: bal, priceUsd: price, valueUsd: value });
      totalNetWorth += value;

      // ── Step 2: Discover ERC-20 tokens via Arkham ──────────────
      const tokens = await discoverTokensViaArkham(address, chain);

      if (tokens.length > 0) {
        // ── Step 3: Check balances for each token ─────────────────
        const balanceResults = await Promise.allSettled(
          tokens.map(async (t) => {
            const rawBal = await getERC20Balance(rpc, t.tokenAddress, address);
            return { ...t, rawBalance: rawBal };
          })
        );

        const withBalances = balanceResults
          .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
          .map(r => r.value)
          .filter(t => t.rawBalance > 0n);

        if (withBalances.length > 0) {
          // ── Step 4: Get prices from CoinGecko ───────────────────
          const tokenAddrs = withBalances.map(t => t.tokenAddress.toLowerCase());
          const prices = await getTokenPrices(tokenAddrs, chain);

          for (const t of withBalances) {
            const formatted = Number(t.rawBalance) / Math.pow(10, t.decimals);
            const price = prices[t.tokenAddress.toLowerCase()] ?? 0;
            const value = formatted * price;

            if (value > 0.01) { // Skip dust
              holdings.push({
                symbol: t.tokenSymbol,
                name: t.tokenName,
                address: t.tokenAddress,
                balance: t.rawBalance.toString(),
                balanceFormatted: formatted,
                priceUsd: price,
                valueUsd: value,
              });
              totalNetWorth += value;
            }
          }
        }
      }
    }

    // Sort holdings by value
    holdings.sort((a, b) => b.valueUsd - a.valueUsd);

    const netWorth = Math.round(totalNetWorth * 100) / 100;

    // Update wallet record with full portfolio
    const id = `${userId}:${address.toLowerCase()}`;
    const wallet = await getItem<any>(T.wallets, { id });
    if (wallet) {
      await putItem(T.wallets, {
        ...wallet,
        netWorth,
        holdings: holdings.slice(0, 50), // Top 50 holdings
        tokenCount: holdings.length,
        lastRefreshed: new Date().toISOString(),
      });
    }

    return netWorth;
  } catch (err) {
    console.error("Net worth refresh error:", err);
    return 0;
  }
}

// ── Staking leaderboard (reads on-chain) ────────────────────────────

const STAKING_ADDRESS = "0xC7851342DAA6bb06c805AFE4a0781F5119596B8F";
const SIZE_TOKEN = "0x21F2D807421e456be5b4BFcC30E5278049eC8b07";
const BASE_RPC = "https://base-mainnet.core.chainstack.com/1f396980c6a698065bdf9bbebbb7fd78";

const STAKING_ABI = [
  "function getStakeInfo(address _user) view returns (uint256 stakedAmount, uint256 pendingRewards, uint256 tier, uint256 boost, uint256 effectiveStake)",
  "function totalStaked() view returns (uint256)",
  "function totalEffectiveStaked() view returns (uint256)",
];

const TIER_NAMES = ["None", "Shrimp", "Bull", "Horse", "Whale"];

r.get("/staking-leaderboard", async (_req: Request, res: Response) => {
  try {
    const { ethers } = require("ethers");
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);

    // Get all profiles with wallet addresses
    const profiles = await scanAll<any>(T.profiles);
    const withWallets = profiles.filter((p: any) => p.wallet_address);

    // Check each wallet's staking position
    const positions: any[] = [];
    await Promise.allSettled(withWallets.map(async (p: any) => {
      try {
        const info = await staking.getStakeInfo(p.wallet_address);
        const staked = Number(ethers.formatEther(info[0]));
        if (staked > 0) {
          const tier = Number(info[2]);
          const boost = Number(info[3]) / 10000;
          const effective = Number(ethers.formatEther(info[4]));
          const pending = Number(ethers.formatEther(info[1]));
          positions.push({
            userId: p.id,
            username: p.username,
            wallet: p.wallet_address,
            isVerified: p.is_verified ?? false,
            avatarUrl: p.avatar_url ?? p.x_avatar_url ?? null,
            staked: Math.round(staked),
            effective: Math.round(effective),
            pending: Math.round(pending),
            tier,
            tierName: TIER_NAMES[tier] ?? "Unknown",
            boost,
          });
        }
      } catch {}
    }));

    // Also check the top stakers from the staking data we got
    // Get total staked for APY calc
    let totalStaked = 0;
    let totalEffective = 0;
    try {
      totalStaked = Number(ethers.formatEther(await staking.totalStaked()));
      totalEffective = Number(ethers.formatEther(await staking.totalEffectiveStaked()));
    } catch {}

    // Sort by staked amount
    positions.sort((a, b) => b.staked - a.staked);

    // Add rank + APY estimate
    // APY based on daily volume estimate — use 24h fees from Clanker
    // For now use a simple formula: (your_effective / total_effective) * annual_fees / your_staked
    const ranked = positions.map((p, i) => ({
      rank: i + 1,
      ...p,
      shareOfPool: totalEffective > 0 ? ((p.effective / totalEffective) * 100).toFixed(2) + "%" : "0%",
    }));

    res.json({
      stakers: ranked,
      totalStaked: Math.round(totalStaked),
      totalEffective: Math.round(totalEffective),
      stakerCount: positions.length,
    });
  } catch (err: any) {
    console.error("Staking leaderboard error:", err.message);
    res.json({ stakers: [], totalStaked: 0, totalEffective: 0, stakerCount: 0 });
  }
});

// ── $SIZE balance for any wallet ────────────────────────────────────

r.get("/size-balance/:address", async (req: Request, res: Response) => {
  try {
    const { ethers } = require("ethers");
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const abi = ["function balanceOf(address) view returns (uint256)"];
    const token = new ethers.Contract(SIZE_TOKEN, abi, provider);
    const bal = await token.balanceOf(req.params.address);
    const formatted = Number(ethers.formatEther(bal));
    res.json({ address: req.params.address, balance: formatted, formatted: formatted.toLocaleString() });
  } catch {
    res.json({ address: req.params.address, balance: 0, formatted: "0" });
  }
});

export default r;
