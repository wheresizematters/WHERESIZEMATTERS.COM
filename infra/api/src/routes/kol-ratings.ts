import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { T, putItem, scanAll, getItem } from "../db";

const r = Router();

// ── Constants ──────────────────────────────────────────────────────────

const ARKHAM_KEY = process.env.ARKHAM_API_KEY ?? "1551a77e-e082-4b66-87b7-08b759360c3b";
const ARKHAM_URL = "https://api.arkhamintelligence.com";

const ETH_RPC = "https://eth.llamarpc.com";
const BASE_RPC = "https://base-mainnet.core.chainstack.com/1f396980c6a698065bdf9bbebbb7fd78";

const SIZE_TOKEN = "0x21F2D807421e456be5b4BFcC30E5278049eC8b07"; // $SIZE on Base
const STAKING_ADDRESS = "0xC7851342DAA6bb06c805AFE4a0781F5119596B8F";

const BALANCE_OF_SELECTOR = "0x70a08231"; // balanceOf(address)

// ── Blue Chip NFT Collections (Ethereum Mainnet) ───────────────────────

const BLUE_CHIP_NFTS: { name: string; address: string }[] = [
  { name: "Bored Ape Yacht Club", address: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D" },
  { name: "CryptoPunks",          address: "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB" },
  { name: "Milady",               address: "0x5Af0D9827E0c53E4799BB226655A1de152A425a5" },
  { name: "Pudgy Penguins",       address: "0xBd3531dA5CF5857e7CfAA92426877b022e612cf8" },
  { name: "Azuki",                address: "0xED5AF388653567Af2F388E6224dC7C4b3241C544" },
  { name: "Doodles",              address: "0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e" },
];

// ── Staking ABI selectors ──────────────────────────────────────────────

// getStakeInfo(address) returns (uint256,uint256,uint256,uint256,uint256)
const GET_STAKE_INFO_SELECTOR = "0x12065fe0"; // We'll use ethers for this

// ── Low-level RPC helpers ──────────────────────────────────────────────

async function ethCall(rpc: string, to: string, data: string): Promise<string> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to, data }, "latest"],
      id: 1,
    }),
  });
  const json = await res.json();
  return json.result ?? "0x";
}

async function getEthBalance(address: string): Promise<number> {
  try {
    const res = await fetch(ETH_RPC, {
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
  } catch {
    return 0;
  }
}

async function getERC20Balance(rpc: string, tokenAddress: string, walletAddress: string): Promise<bigint> {
  try {
    const data = BALANCE_OF_SELECTOR + walletAddress.slice(2).toLowerCase().padStart(64, "0");
    const result = await ethCall(rpc, tokenAddress, data);
    return BigInt(result || "0x0");
  } catch {
    return 0n;
  }
}

// ── Blue Chip NFT Checker ──────────────────────────────────────────────

interface BlueChipHolding {
  name: string;
  address: string;
  balance: number;
}

/**
 * Check all blue chip NFT collections for a given wallet on Ethereum mainnet.
 * Uses raw ERC-721 balanceOf calls via RPC (no ethers dependency).
 * CryptoPunks uses a different ABI (punkIndexToAddress mapping), so we
 * use the wrapped Punks balanceOf which is standard ERC-721.
 */
async function checkBlueChipNFTs(walletAddress: string): Promise<BlueChipHolding[]> {
  const holdings: BlueChipHolding[] = [];
  const paddedAddr = walletAddress.slice(2).toLowerCase().padStart(64, "0");
  const calldata = BALANCE_OF_SELECTOR + paddedAddr;

  const results = await Promise.allSettled(
    BLUE_CHIP_NFTS.map(async (nft) => {
      try {
        const result = await ethCall(ETH_RPC, nft.address, calldata);
        const balance = parseInt(result || "0x0", 16);
        return { ...nft, balance };
      } catch {
        return { ...nft, balance: 0 };
      }
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value.balance > 0) {
      holdings.push(r.value);
    }
  }

  return holdings;
}

// ── Arkham Intelligence lookup ─────────────────────────────────────────

interface ArkhamInfo {
  entityName: string | null;
  twitter: string | null;
  labels: string[];
  isKnown: boolean;
}

async function getArkhamInfo(address: string): Promise<ArkhamInfo> {
  try {
    const res = await fetch(`${ARKHAM_URL}/intelligence/address/${address}`, {
      headers: { "API-Key": ARKHAM_KEY },
    });
    if (!res.ok) return { entityName: null, twitter: null, labels: [], isKnown: false };

    const data = await res.json();
    const entity = data.arkhamEntity;
    const label = data.arkhamLabel;

    return {
      entityName: entity?.name ?? label?.name ?? null,
      twitter: entity?.twitter ?? null,
      labels: [
        ...(entity?.labels ?? []),
        ...(label?.name ? [label.name] : []),
      ].filter(Boolean),
      isKnown: !!(entity?.name || label?.name),
    };
  } catch {
    return { entityName: null, twitter: null, labels: [], isKnown: false };
  }
}

// ── $SIZE balance + staking position ───────────────────────────────────

interface SizePosition {
  balance: number;
  staked: number;
  pendingRewards: number;
  tier: number;
  tierName: string;
  effectiveStake: number;
}

const TIER_NAMES = ["None", "Shrimp", "Bull", "Horse", "Whale"];

async function getSizePosition(address: string): Promise<SizePosition> {
  let balance = 0;
  let staked = 0;
  let pendingRewards = 0;
  let tier = 0;
  let effectiveStake = 0;

  try {
    // $SIZE balance on Base
    const rawBal = await getERC20Balance(BASE_RPC, SIZE_TOKEN, address);
    balance = Number(rawBal) / 1e18;
  } catch {}

  try {
    // Staking position via ethers (contract has complex return types)
    const { ethers } = require("ethers");
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const stakingAbi = [
      "function getStakeInfo(address _user) view returns (uint256 stakedAmount, uint256 pendingRewards, uint256 tier, uint256 boost, uint256 effectiveStake)",
    ];
    const contract = new ethers.Contract(STAKING_ADDRESS, stakingAbi, provider);
    const info = await contract.getStakeInfo(address);
    staked = Number(ethers.formatEther(info[0]));
    pendingRewards = Number(ethers.formatEther(info[1]));
    tier = Number(info[2]);
    effectiveStake = Number(ethers.formatEther(info[4]));
  } catch {}

  return {
    balance: Math.round(balance),
    staked: Math.round(staked),
    pendingRewards: Math.round(pendingRewards),
    tier,
    tierName: TIER_NAMES[tier] ?? "Unknown",
    effectiveStake: Math.round(effectiveStake),
  };
}

// ── Farcaster / Neynar lookup ──────────────────────────────────────────

interface FarcasterInfo {
  fid: number | null;
  username: string | null;
  displayName: string | null;
  followerCount: number;
  followingCount: number;
  isOG: boolean; // FID < 10000
  pfpUrl: string | null;
}

async function getFarcasterInfo(address: string): Promise<FarcasterInfo> {
  const empty: FarcasterInfo = {
    fid: null,
    username: null,
    displayName: null,
    followerCount: 0,
    followingCount: 0,
    isOG: false,
    pfpUrl: null,
  };

  try {
    // Neynar public lookup by address (free tier / public endpoint)
    const neynarKey = process.env.NEYNAR_API_KEY ?? "";
    const headers: Record<string, string> = { accept: "application/json" };
    if (neynarKey) headers["x-api-key"] = neynarKey;

    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address.toLowerCase()}`,
      { headers },
    );

    if (!res.ok) return empty;
    const data = await res.json();

    // Response is keyed by lowercase address
    const users = data[address.toLowerCase()];
    if (!users || users.length === 0) return empty;

    const user = users[0]; // Take the primary account
    const fid = user.fid ?? null;

    return {
      fid,
      username: user.username ?? null,
      displayName: user.display_name ?? null,
      followerCount: user.follower_count ?? 0,
      followingCount: user.following_count ?? 0,
      isOG: fid !== null && fid < 10000,
      pfpUrl: user.pfp_url ?? null,
    };
  } catch {
    return empty;
  }
}

// ── ETH price helper ───────────────────────────────────────────────────

async function getEthPrice(): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const data = await res.json();
    return data.ethereum?.usd ?? 0;
  } catch {
    return 0;
  }
}

// ── SIZE Score Calculator ──────────────────────────────────────────────

interface SizeScore {
  total: number;
  breakdown: {
    ethValue: number;
    sizeHoldings: number;
    sizeStaking: number;
    blueChipNFTs: number;
    arkhamRecognition: number;
    farcasterPresence: number;
  };
  tier: string;
}

function calculateSizeScore(
  ethBalanceUsd: number,
  sizePosition: SizePosition,
  blueChips: BlueChipHolding[],
  arkham: ArkhamInfo,
  farcaster: FarcasterInfo,
): SizeScore {
  // ETH value: 1 point per $1000, max 200 points
  const ethScore = Math.min(200, Math.floor(ethBalanceUsd / 1000));

  // $SIZE holdings: 1 point per 10,000 $SIZE held, max 150 points
  const sizeHoldScore = Math.min(150, Math.floor(sizePosition.balance / 10000));

  // $SIZE staking: 1 point per 5,000 $SIZE staked, max 200 points
  // Bonus for higher tiers
  const stakingBase = Math.min(150, Math.floor(sizePosition.staked / 5000));
  const tierBonus = sizePosition.tier * 10; // 0-40 bonus
  const sizeStakeScore = Math.min(200, stakingBase + tierBonus);

  // Blue chip NFTs: 50 points each, max 200 points
  const nftScore = Math.min(200, blueChips.length * 50);

  // Arkham recognition: 100 points if known entity
  const arkhamScore = arkham.isKnown ? 100 : 0;

  // Farcaster: up to 150 points based on followers + OG bonus
  let fcScore = 0;
  if (farcaster.fid) {
    fcScore += 20; // Has a Farcaster account
    fcScore += Math.min(80, Math.floor(farcaster.followerCount / 100)); // 1 pt per 100 followers, max 80
    if (farcaster.isOG) fcScore += 50; // OG FID bonus
  }
  fcScore = Math.min(150, fcScore);

  const total = ethScore + sizeHoldScore + sizeStakeScore + nftScore + arkhamScore + fcScore;

  // Tier based on total score
  let tier = "Plankton";
  if (total >= 800) tier = "Leviathan";
  else if (total >= 600) tier = "Whale";
  else if (total >= 400) tier = "Shark";
  else if (total >= 250) tier = "Dolphin";
  else if (total >= 100) tier = "Fish";
  else if (total >= 25) tier = "Shrimp";

  return {
    total,
    breakdown: {
      ethValue: ethScore,
      sizeHoldings: sizeHoldScore,
      sizeStaking: sizeStakeScore,
      blueChipNFTs: nftScore,
      arkhamRecognition: arkhamScore,
      farcasterPresence: fcScore,
    },
    tier,
  };
}

// ── Full wallet rating ─────────────────────────────────────────────────

interface WalletRating {
  address: string;
  score: SizeScore;
  ethBalance: number;
  ethBalanceUsd: number;
  sizePosition: SizePosition;
  blueChipNFTs: BlueChipHolding[];
  arkham: ArkhamInfo;
  farcaster: FarcasterInfo;
  ratedAt: string;
}

async function rateWallet(address: string): Promise<WalletRating> {
  // Run all lookups in parallel
  const [ethBalance, ethPrice, sizePosition, blueChips, arkham, farcaster] = await Promise.all([
    getEthBalance(address),
    getEthPrice(),
    getSizePosition(address),
    checkBlueChipNFTs(address),
    getArkhamInfo(address),
    getFarcasterInfo(address),
  ]);

  const ethBalanceUsd = ethBalance * ethPrice;
  const score = calculateSizeScore(ethBalanceUsd, sizePosition, blueChips, arkham, farcaster);

  return {
    address: address.toLowerCase(),
    score,
    ethBalance: Math.round(ethBalance * 10000) / 10000,
    ethBalanceUsd: Math.round(ethBalanceUsd * 100) / 100,
    sizePosition,
    blueChipNFTs: blueChips,
    arkham,
    farcaster,
    ratedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════

// ── Rate a single wallet ───────────────────────────────────────────────

r.get("/rate/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;

    // Basic EVM address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: "Invalid EVM address" });
    }

    const rating = await rateWallet(address);

    // Cache result in DynamoDB analytics table for /top endpoint
    try {
      await putItem(T.analytics, {
        id: `kol-rating:${address.toLowerCase()}`,
        type: "kol-rating",
        address: address.toLowerCase(),
        score: rating.score.total,
        tier: rating.score.tier,
        entityName: rating.arkham.entityName,
        farcasterUsername: rating.farcaster.username,
        ratedAt: rating.ratedAt,
        data: JSON.stringify(rating),
      });
    } catch {}

    res.json(rating);
  } catch (err: any) {
    console.error("KOL rate error:", err);
    res.status(500).json({ error: "Failed to rate wallet" });
  }
});

// ── Compare two wallets ────────────────────────────────────────────────

r.get("/compare/:addr1/:addr2", async (req: Request, res: Response) => {
  try {
    const addr1 = req.params.addr1 as string;
    const addr2 = req.params.addr2 as string;

    if (!/^0x[a-fA-F0-9]{40}$/.test(addr1) || !/^0x[a-fA-F0-9]{40}$/.test(addr2)) {
      return res.status(400).json({ error: "Invalid EVM address(es)" });
    }

    // Rate both in parallel
    const [rating1, rating2] = await Promise.all([rateWallet(addr1), rateWallet(addr2)]);

    // Cache both
    try {
      await Promise.all([
        putItem(T.analytics, {
          id: `kol-rating:${addr1.toLowerCase()}`,
          type: "kol-rating",
          address: addr1.toLowerCase(),
          score: rating1.score.total,
          tier: rating1.score.tier,
          entityName: rating1.arkham.entityName,
          farcasterUsername: rating1.farcaster.username,
          ratedAt: rating1.ratedAt,
          data: JSON.stringify(rating1),
        }),
        putItem(T.analytics, {
          id: `kol-rating:${addr2.toLowerCase()}`,
          type: "kol-rating",
          address: addr2.toLowerCase(),
          score: rating2.score.total,
          tier: rating2.score.tier,
          entityName: rating2.arkham.entityName,
          farcasterUsername: rating2.farcaster.username,
          ratedAt: rating2.ratedAt,
          data: JSON.stringify(rating2),
        }),
      ]);
    } catch {}

    // Build comparison
    const winner = rating1.score.total > rating2.score.total ? addr1 : addr2;
    const comparison = {
      wallet1: rating1,
      wallet2: rating2,
      winner: winner.toLowerCase(),
      winnerScore: Math.max(rating1.score.total, rating2.score.total),
      differential: Math.abs(rating1.score.total - rating2.score.total),
      categoryWinners: {
        ethValue: rating1.score.breakdown.ethValue >= rating2.score.breakdown.ethValue ? addr1 : addr2,
        sizeHoldings: rating1.score.breakdown.sizeHoldings >= rating2.score.breakdown.sizeHoldings ? addr1 : addr2,
        sizeStaking: rating1.score.breakdown.sizeStaking >= rating2.score.breakdown.sizeStaking ? addr1 : addr2,
        blueChipNFTs: rating1.score.breakdown.blueChipNFTs >= rating2.score.breakdown.blueChipNFTs ? addr1 : addr2,
        arkhamRecognition: rating1.score.breakdown.arkhamRecognition >= rating2.score.breakdown.arkhamRecognition ? addr1 : addr2,
        farcasterPresence: rating1.score.breakdown.farcasterPresence >= rating2.score.breakdown.farcasterPresence ? addr1 : addr2,
      },
      trash_talk: generateTrashTalk(rating1, rating2),
    };

    res.json(comparison);
  } catch (err: any) {
    console.error("KOL compare error:", err);
    res.status(500).json({ error: "Failed to compare wallets" });
  }
});

// ── Top rated KOLs (from cache) ────────────────────────────────────────

r.get("/top", async (_req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.analytics);
    const ratings = all
      .filter((item: any) => item.type === "kol-rating" && item.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 50)
      .map((item: any, i: number) => ({
        rank: i + 1,
        address: item.address,
        score: item.score,
        tier: item.tier,
        entityName: item.entityName ?? null,
        farcasterUsername: item.farcasterUsername ?? null,
        ratedAt: item.ratedAt,
      }));

    res.json({
      leaderboard: ratings,
      count: ratings.length,
      lastUpdated: ratings[0]?.ratedAt ?? null,
    });
  } catch (err: any) {
    console.error("KOL top error:", err);
    res.json({ leaderboard: [], count: 0, lastUpdated: null });
  }
});

// ── Farcaster lookup by address ────────────────────────────────────────

r.get("/farcaster/:address", async (req: Request, res: Response) => {
  try {
    const address = req.params.address as string;

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: "Invalid EVM address" });
    }

    const info = await getFarcasterInfo(address);

    if (!info.fid) {
      return res.json({
        address: address.toLowerCase(),
        found: false,
        message: "No Farcaster account linked to this address",
      });
    }

    res.json({
      address: address.toLowerCase(),
      found: true,
      ...info,
    });
  } catch (err: any) {
    console.error("Farcaster lookup error:", err);
    res.status(500).json({ error: "Failed to lookup Farcaster info" });
  }
});

// ── Trash talk generator for comparisons ───────────────────────────────

function generateTrashTalk(w1: WalletRating, w2: WalletRating): string {
  const diff = w1.score.total - w2.score.total;
  const winner = diff >= 0 ? w1 : w2;
  const loser = diff >= 0 ? w2 : w1;
  const absDiff = Math.abs(diff);

  const winnerName = winner.arkham.entityName ?? winner.farcaster.username ?? winner.address.slice(0, 10);
  const loserName = loser.arkham.entityName ?? loser.farcaster.username ?? loser.address.slice(0, 10);

  if (absDiff === 0) return `Dead even. Both wallets are the same SIZE.`;
  if (absDiff > 500) return `${winnerName} absolutely mogged ${loserName}. Not even close.`;
  if (absDiff > 200) return `${winnerName} is bigger. ${loserName} needs to stack more.`;
  if (absDiff > 50) return `${winnerName} edges out ${loserName}. Competitive, but there's a clear winner.`;
  return `Neck and neck. ${winnerName} barely beats ${loserName} by ${absDiff} points.`;
}

export default r;
