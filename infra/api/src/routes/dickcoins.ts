import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { requireAuth } from "../middleware/auth";
import { getProfile } from "../services/profiles";
import { T, getItem, putItem, queryItems, scanAll } from "../db";

const r = Router();

const IS_MAINNET = process.env.BASE_CHAIN_ID === "8453";
const BASE_RPC = process.env.BASE_RPC_URL ?? "https://base-mainnet.core.chainstack.com/1f396980c6a698065bdf9bbebbb7fd78";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const PROTOCOL_WALLET = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";

// ── POST /launch — Deploy a DickCoin ─────────────────────────────
r.post("/launch", requireAuth, async (req: Request, res: Response) => {
  try {
    const profile = await getProfile(req.userId!);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    if (!profile.is_verified) return res.status(403).json({ error: "Must be verified to launch a DickCoin" });
    if (!profile.wallet_address) return res.status(400).json({ error: "Connect your wallet first" });

    const { name, ticker, description, imageUrl, circleJerkConfig } = req.body;
    if (!name || !ticker) return res.status(400).json({ error: "Name and ticker required" });

    const now = new Date().toISOString();
    let contractAddress: string;
    let poolAddress: string;
    let txHash: string;

    // ── Deploy via Clanker on mainnet ────────────────────────────
    if (IS_MAINNET && DEPLOYER_KEY) {
      try {
        const { Clanker } = require("clanker-sdk");
        const { createPublicClient, createWalletClient, http } = require("viem");
        const { privateKeyToAccount } = require("viem/accounts");
        const { base } = require("viem/chains");

        const account = privateKeyToAccount(DEPLOYER_KEY as `0x${string}`);
        const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC) });
        const wallet = createWalletClient({ account, chain: base, transport: http(BASE_RPC) });
        const clanker = new Clanker({ wallet, publicClient });

        console.log(`Deploying DickCoin: ${name} ($${ticker}) for @${profile.username}`);

        const tokenAddress = await clanker.deployToken({
          name,
          symbol: ticker.toUpperCase(),
          image: imageUrl || "https://www.wheresizematters.com/og-image.png",
          metadata: {
            description: description ?? `${name} — a DickCoin on SIZE.`,
            socialMediaUrls: [
              { platform: "x", url: "https://x.com/wheresize" },
            ],
          },
          context: {
            interface: "SIZE.",
            platform: "SIZE. (wheresizematters.com)",
            messageId: `dickcoin-${ticker}-${req.userId}`,
            id: `${ticker}-${Date.now()}`,
          },
          pool: {
            quoteToken: "0x4200000000000000000000000000000000000006", // WETH on Base
            initialMarketCap: "1", // 1 ETH initial market cap
          },
          rewardsConfig: {
            creatorReward: 80, // 80% to creator (Clanker max)
            creatorAdmin: profile.wallet_address,
            creatorRewardRecipient: profile.wallet_address,
            interfaceAdmin: PROTOCOL_WALLET,
            interfaceRewardRecipient: PROTOCOL_WALLET,
          },
        });

        contractAddress = tokenAddress;
        poolAddress = ""; // Clanker auto-creates the pool
        txHash = ""; // SDK doesn't return tx hash directly
        console.log(`DickCoin deployed: ${contractAddress}`);

      } catch (clankerErr: any) {
        console.error("Clanker deploy failed:", clankerErr.message);
        return res.status(502).json({
          error: `Token deployment failed: ${clankerErr.message}. Try again or contact support.`,
        });
      }
    } else {
      // ── Testnet / dev fallback — mock deployment ───────────────
      contractAddress = "0x" + uuid().replace(/-/g, "").padEnd(40, "0").slice(0, 40);
      poolAddress = "0x" + uuid().replace(/-/g, "").padEnd(40, "0").slice(0, 40);
      txHash = "0x" + uuid().replace(/-/g, "").padEnd(64, "0");
      console.log(`[TESTNET] Mock DickCoin: ${name} ($${ticker}) → ${contractAddress}`);
    }

    // ── Save DickCoin record ─────────────────────────────────────
    await putItem(T.groups, {
      id: contractAddress,
      name,
      ticker: ticker.toUpperCase(),
      description: description ?? "",
      imageUrl: imageUrl ?? "",
      userId: req.userId!,
      creatorUsername: profile.username,
      creatorWallet: profile.wallet_address,
      poolAddress,
      contractAddress,
      totalVolume: 0,
      totalFeesEarned: 0,
      holderCount: 1,
      hasStaking: false,
      type: "dickcoin",
      deployedOnChain: IS_MAINNET && DEPLOYER_KEY ? true : false,
      circleJerkConfig: circleJerkConfig ?? null,
      createdAt: now,
    });

    // ── Auto-create Circle Jerk membership ───────────────────────
    await putItem(T.group_members, {
      group_id: contractAddress,
      user_id: req.userId!,
      role: "owner",
      joined_at: now,
      last_read_at: now,
    });

    res.json({ contractAddress, poolAddress, txHash, error: null });
  } catch (err: any) {
    console.error("DickCoin launch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /trending — Top DickCoins by volume ──────────────────────
r.get("/trending", async (_req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.groups);
    const dickCoins = all
      .filter((g: any) => g.type === "dickcoin")
      .sort((a: any, b: any) => {
        // Pinned coins always first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.totalVolume ?? 0) - (a.totalVolume ?? 0);
      })
      .slice(0, 50);

    // Hydrate with creator verification status
    const hydrated = await Promise.all(
      dickCoins.map(async (coin: any) => {
        if (!coin.userId) return { ...coin, creatorVerified: false };
        try {
          const profile = await getItem<any>(T.profiles, { id: coin.userId });
          return { ...coin, creatorVerified: !!profile?.is_verified };
        } catch {
          return { ...coin, creatorVerified: false };
        }
      }),
    );

    res.json(hydrated);
  } catch (err: any) {
    console.error("Trending error:", err);
    res.json([]);
  }
});

// ── GET /my-circle-jerks — DickCoins user is a member of ────────
r.get("/my-circle-jerks", requireAuth, async (req: Request, res: Response) => {
  try {
    const memberships = await queryItems<any>(
      T.group_members,
      "user_id = :uid",
      { ":uid": req.userId! },
      { indexName: "user-groups-index" },
    );

    const dickCoins = await Promise.all(
      memberships.map(async (m: any) => {
        const coin = await getItem<any>(T.groups, { id: m.group_id });
        if (coin?.type !== "dickcoin") return null;
        return { ...coin, membership: m };
      })
    );

    res.json(dickCoins.filter(Boolean));
  } catch (err: any) {
    console.error("My circle jerks error:", err);
    res.json([]);
  }
});

// ── GET /user/:userId — DickCoins launched by a user ─────────────
r.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.groups);
    const userCoins = all.filter((g: any) => g.type === "dickcoin" && g.userId === req.params.userId);
    res.json(userCoins);
  } catch { res.json([]); }
});

// ── GET /:contractAddress — DickCoin info ────────────────────────
r.get("/:contractAddress", async (req: Request, res: Response) => {
  try {
    const coin = await getItem<any>(T.groups, { id: req.params.contractAddress });
    if (!coin || coin.type !== "dickcoin") return res.status(404).json({ error: "Not found" });
    res.json(coin);
  } catch { res.status(500).json({ error: "Internal error" }); }
});

// ── GET /:contractAddress/holders — DickCoin holders ─────────────
r.get("/:contractAddress/holders", async (req: Request, res: Response) => {
  try {
    const members = await queryItems<any>(
      T.group_members,
      "group_id = :gid",
      { ":gid": req.params.contractAddress },
    );
    res.json(members);
  } catch { res.json([]); }
});

// ── POST /:contractAddress/config — Update Circle Jerk config ────
r.post("/:contractAddress/config", requireAuth, async (req: Request, res: Response) => {
  try {
    const coin = await getItem<any>(T.groups, { id: req.params.contractAddress });
    if (!coin || coin.type !== "dickcoin") return res.status(404).json({ error: "Not found" });
    if (coin.userId !== req.userId!) return res.status(403).json({ error: "Only creator can edit config" });

    const { circleJerkConfig } = req.body;
    await putItem(T.groups, { ...coin, circleJerkConfig });
    res.json({ error: null });
  } catch { res.status(500).json({ error: "Internal error" }); }
});

export default r;
