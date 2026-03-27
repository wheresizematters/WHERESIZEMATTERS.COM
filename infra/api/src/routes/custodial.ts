import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { getProfile, updateProfile } from "../services/profiles";
import {
  createCustodialWallet,
  getCustodialWallet,
  deactivateCustodialWallet,
  reactivateCustodialWallet,
  exportPrivateKey,
} from "../services/custodial-wallet";

const r = Router();

// ── Get my custodial wallet ──────────────────────────────────────
r.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const wallet = await getCustodialWallet(req.userId!);
    if (!wallet) {
      return res.json({ hasCustodialWallet: false, address: null, active: false });
    }
    // NEVER return the encrypted private key
    res.json({
      hasCustodialWallet: true,
      address: wallet.address,
      active: wallet.active,
      chain: wallet.chain,
      createdAt: wallet.createdAt,
    });
  } catch (err: any) {
    console.error("Get custodial wallet error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── Create custodial wallet (auto-called on signup, or manual) ──
r.post("/create", requireAuth, async (req: Request, res: Response) => {
  try {
    const existing = await getCustodialWallet(req.userId!);
    if (existing) {
      return res.json({ address: existing.address, alreadyExists: true });
    }

    const result = await createCustodialWallet(req.userId!);
    if (!result) {
      return res.status(500).json({ error: "Failed to create wallet" });
    }

    // Update profile with custodial wallet address
    await updateProfile(req.userId!, { wallet_address: result.address } as any);

    res.json({ address: result.address, created: true });
  } catch (err: any) {
    console.error("Create custodial wallet error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── Opt out: user connects their own wallet ─────────────────────
r.post("/opt-out", requireAuth, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress required" });
    }

    // Deactivate custodial wallet
    await deactivateCustodialWallet(req.userId!);

    // Update profile with user's own wallet
    await updateProfile(req.userId!, { wallet_address: walletAddress.toLowerCase() } as any);

    res.json({ success: true, walletAddress: walletAddress.toLowerCase() });
  } catch (err: any) {
    console.error("Opt out error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── Opt back in: user disconnects wallet, reactivate custodial ──
r.post("/opt-in", requireAuth, async (req: Request, res: Response) => {
  try {
    const wallet = await getCustodialWallet(req.userId!);
    if (!wallet) {
      // Create one if they never had one
      const result = await createCustodialWallet(req.userId!);
      if (!result) return res.status(500).json({ error: "Failed to create wallet" });
      await updateProfile(req.userId!, { wallet_address: result.address } as any);
      return res.json({ address: result.address, created: true });
    }

    await reactivateCustodialWallet(req.userId!);
    await updateProfile(req.userId!, { wallet_address: wallet.address } as any);

    res.json({ address: wallet.address, reactivated: true });
  } catch (err: any) {
    console.error("Opt in error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── Export private key (user takes full custody) ────────────────
r.post("/export", requireAuth, async (req: Request, res: Response) => {
  try {
    const { confirm } = req.body;
    if (confirm !== "I_UNDERSTAND_THIS_IS_IRREVERSIBLE") {
      return res.status(400).json({
        error: "Send { confirm: 'I_UNDERSTAND_THIS_IS_IRREVERSIBLE' } to export your private key. This deactivates your custodial wallet permanently.",
      });
    }

    const privateKey = await exportPrivateKey(req.userId!);
    if (!privateKey) {
      return res.status(404).json({ error: "No custodial wallet found" });
    }

    // This is the ONLY time the private key leaves the server
    res.json({
      privateKey,
      warning: "Save this key securely. It will never be shown again. Your custodial wallet has been deactivated.",
    });
  } catch (err: any) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default r;
