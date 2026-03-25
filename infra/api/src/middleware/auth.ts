import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

/**
 * Auth middleware — validates Supabase JWT from Authorization header.
 * Supabase Auth stays as the identity provider; we just verify tokens.
 * Sets req.userId on success.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ error: "Auth failed" });
  }
}

/** Optional auth — sets userId if present, doesn't block if missing */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) { next(); return; }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) req.userId = user.id;
  } catch {}
  next();
}
