import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { requireAuth } from "../middleware/auth";
import { getProfile } from "../services/profiles";
import { T, getItem, putItem, queryItems, scanAll } from "../db";

const r = Router();

// ── POST /launch — Deploy a DickCoin via Clanker ───────────────────
r.post("/launch", requireAuth, async (req: Request, res: Response) => {
  try {
    const profile = await getProfile(req.userId!);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    if (!profile.is_verified) return res.status(403).json({ error: "Must be verified to launch a DickCoin" });
    if (!profile.wallet_address) return res.status(400).json({ error: "Connect your wallet first" });

    const { name, ticker, description, imageUrl, circleJerkConfig } = req.body;
    if (!name || !ticker) return res.status(400).json({ error: "Name and ticker required" });

    // For now, create the DickCoin record in DynamoDB
    // In production, this would call Clanker SDK to deploy the token
    const contractAddress = "0x" + uuid().replace(/-/g, "").slice(0, 40); // placeholder
    const poolAddress = "0x" + uuid().replace(/-/g, "").slice(0, 40);

    const now = new Date().toISOString();

    // Save DickCoin record
    await putItem(T.groups, {
      id: contractAddress,
      name,
      ticker: ticker.toUpperCase(),
      description: description ?? "",
      imageUrl: imageUrl ?? "",
      userId: req.userId!,
      creatorUsername: profile.username,
      poolAddress,
      contractAddress,
      totalVolume: 0,
      totalFeesEarned: 0,
      holderCount: 1,
      hasStaking: false,
      type: "dickcoin",
      circleJerkConfig: circleJerkConfig ?? null,
      createdAt: now,
    });

    // Auto-create Circle Jerk (group) for this DickCoin
    await putItem(T.group_members, {
      group_id: contractAddress,
      user_id: req.userId!,
      role: "owner",
      joined_at: now,
      last_read_at: now,
    });

    res.json({
      contractAddress,
      poolAddress,
      txHash: "0x" + uuid().replace(/-/g, ""),
      error: null,
    });
  } catch (err: any) {
    console.error("DickCoin launch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /trending — Top DickCoins by volume ────────────────────────
r.get("/trending", async (_req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.groups);
    const dickCoins = all
      .filter((g: any) => g.type === "dickcoin")
      .sort((a: any, b: any) => (b.totalVolume ?? 0) - (a.totalVolume ?? 0))
      .slice(0, 50);
    res.json(dickCoins);
  } catch (err: any) {
    console.error("Trending error:", err);
    res.json([]);
  }
});

// ── GET /my-circle-jerks — DickCoins user is a member of ──────────
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

// ── GET /user/:userId — DickCoins launched by a user ───────────────
r.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.groups);
    const userCoins = all.filter((g: any) => g.type === "dickcoin" && g.userId === req.params.userId);
    res.json(userCoins);
  } catch { res.json([]); }
});

// ── GET /:contractAddress — DickCoin info ──────────────────────────
r.get("/:contractAddress", async (req: Request, res: Response) => {
  try {
    const coin = await getItem<any>(T.groups, { id: req.params.contractAddress });
    if (!coin || coin.type !== "dickcoin") return res.status(404).json({ error: "Not found" });
    res.json(coin);
  } catch { res.status(500).json({ error: "Internal error" }); }
});

// ── GET /:contractAddress/holders — DickCoin holders ───────────────
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

// ── POST /:contractAddress/config — Update Circle Jerk config ──────
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
