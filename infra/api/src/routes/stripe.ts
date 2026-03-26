import { Router, Request, Response } from "express";
import { updateProfile, getProfile } from "../services/profiles";
import { scanAll } from "../db";

const r = Router();

// Stripe webhook — called by Stripe after successful payment
// Grants premium to the user identified by client_reference_id
r.post("/webhook", async (req: Request, res: Response) => {
  try {
    const event = req.body;

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      const userId = session?.client_reference_id ?? session?.metadata?.supabase_user_id;

      if (userId) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await updateProfile(userId, {
          is_premium: true,
          premium_expires_at: expiresAt,
        } as any);
        console.log("Premium granted to:", userId);
      }
    }

    // Handle subscription updates
    if (event.type === "customer.subscription.updated") {
      const sub = event.data?.object;
      const userId = sub?.metadata?.supabase_user_id ?? sub?.metadata?.user_id;
      if (userId) {
        const active = sub.status === "active" || sub.status === "trialing";
        const expiresAt = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        await updateProfile(userId, {
          is_premium: active,
          premium_expires_at: expiresAt,
        } as any);
      }
    }

    // Handle subscription deleted
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data?.object;
      const userId = sub?.metadata?.supabase_user_id ?? sub?.metadata?.user_id;
      if (userId) {
        await updateProfile(userId, {
          is_premium: false,
          premium_expires_at: null,
        } as any);
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Manual premium grant — for when webhook doesn't fire (payment links)
// Called by the frontend after redirect with ?subscribed=1
r.post("/check-premium", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const profile = await getProfile(userId);
    if (!profile) return res.status(404).json({ error: "User not found" });

    // If already premium, just confirm
    if (profile.is_premium) {
      return res.json({ premium: true });
    }

    // Grant premium (payment was confirmed by Stripe redirect)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await updateProfile(userId, {
      is_premium: true,
      premium_expires_at: expiresAt,
    } as any);

    res.json({ premium: true, granted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default r;
