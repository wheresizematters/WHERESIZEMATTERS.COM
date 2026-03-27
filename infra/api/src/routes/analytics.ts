import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { T, putItem, scanAll } from "../db";
import crypto from "crypto";

const r = Router();

// TOTP secret — add to Google Authenticator or override via TOTP_SECRET env var
const TOTP_SECRET = process.env.TOTP_SECRET ?? "Z2ZKI7AUM2HPM5S5H7ZMSOZ5KXTZVZYR";

// ── Track page view ─────────────────────────────────────────────
r.post("/track", async (req: Request, res: Response) => {
  try {
    const { page, referrer, screenWidth, screenHeight, language, timezone } = req.body;
    const ua = req.headers["user-agent"] ?? "";
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? req.ip ?? "";

    // Hash IP for privacy
    const ipHash = crypto.createHash("sha256").update(ip + "size-salt-2026").digest("hex").slice(0, 16);

    // Parse device info from UA
    const isMobile = /iPhone|iPad|Android|Mobile/i.test(ua);
    const browser = ua.match(/(Chrome|Safari|Firefox|Edge|OPR|Opera)/)?.[1] ?? "Other";
    const os = ua.match(/(Windows|Mac OS|Linux|Android|iOS|iPhone)/)?.[1] ?? "Other";

    await putItem(T.analytics, {
      id: uuid(),
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split("T")[0],
      page: page ?? "/",
      referrer: referrer ?? "",
      ipHash,
      userAgent: ua.slice(0, 300),
      browser,
      os,
      isMobile,
      screenWidth: screenWidth ?? 0,
      screenHeight: screenHeight ?? 0,
      language: language ?? "",
      timezone: timezone ?? "",
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Analytics track error:", err);
    res.json({ ok: true }); // Never fail tracking
  }
});

// ── TOTP helpers ────────────────────────────────────────────────
function decodeBase32(secret: string): Buffer {
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.replace(/[\s=]/g, "").toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const c of clean) {
    const idx = base32Chars.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotpCode(secret: string, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(0, 0);
  buffer.writeUInt32BE(counter, 4);

  const hmac = crypto.createHmac("sha1", decodeBase32(secret));
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    (((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)) %
    1000000;

  return code.toString().padStart(6, "0");
}

function verifyTOTP(secret: string, token: string): boolean {
  const time = Math.floor(Date.now() / 1000 / 30);
  for (const offset of [0, -1, 1]) {
    if (hotpCode(secret, time + offset) === token) return true;
  }
  return false;
}

// ── Admin dashboard data (TOTP protected) ───────────────────────
r.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const token = req.query.totp as string;
    if (!token || !verifyTOTP(TOTP_SECRET, token)) {
      return res.status(403).json({ error: "Invalid TOTP code" });
    }

    const events = await scanAll<any>(T.analytics);

    // Aggregate stats
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];

    const todayEvents = events.filter((e) => e.date === today);
    const yesterdayEvents = events.filter((e) => e.date === yesterday);
    const weekEvents = events.filter((e) => e.date >= weekAgo);

    // Unique visitors by ipHash
    const uniqueToday = new Set(todayEvents.map((e) => e.ipHash)).size;
    const uniqueYesterday = new Set(yesterdayEvents.map((e) => e.ipHash)).size;
    const uniqueWeek = new Set(weekEvents.map((e) => e.ipHash)).size;
    const uniqueTotal = new Set(events.map((e) => e.ipHash)).size;

    // Page views
    const pageCounts: Record<string, number> = {};
    const browserCounts: Record<string, number> = {};
    const osCounts: Record<string, number> = {};
    const referrerCounts: Record<string, number> = {};
    const dailyCounts: Record<string, { views: number; unique: Set<string> }> = {};
    let mobileCount = 0;
    let desktopCount = 0;

    for (const e of events) {
      pageCounts[e.page] = (pageCounts[e.page] ?? 0) + 1;
      browserCounts[e.browser] = (browserCounts[e.browser] ?? 0) + 1;
      osCounts[e.os] = (osCounts[e.os] ?? 0) + 1;
      if (e.referrer) referrerCounts[e.referrer] = (referrerCounts[e.referrer] ?? 0) + 1;
      if (e.isMobile) mobileCount++;
      else desktopCount++;

      if (!dailyCounts[e.date]) dailyCounts[e.date] = { views: 0, unique: new Set() };
      dailyCounts[e.date].views++;
      dailyCounts[e.date].unique.add(e.ipHash);
    }

    // Sort and top 20
    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    const topBrowsers = Object.entries(browserCounts).sort((a, b) => b[1] - a[1]);
    const topOS = Object.entries(osCounts).sort((a, b) => b[1] - a[1]);
    const topReferrers = Object.entries(referrerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    // Daily chart data (last 30 days)
    const dailyChart = Object.entries(dailyCounts)
      .map(([date, d]) => ({ date, views: d.views, unique: d.unique.size }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    // Recent events (last 50)
    const recent = events
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 50)
      .map((e) => ({
        time: e.timestamp,
        page: e.page,
        browser: e.browser,
        os: e.os,
        mobile: e.isMobile,
        referrer: e.referrer,
        screen: e.screenWidth ? `${e.screenWidth}x${e.screenHeight}` : "",
        lang: e.language,
        tz: e.timezone,
      }));

    // Hourly distribution for today
    const hourly: number[] = new Array(24).fill(0);
    for (const e of todayEvents) {
      const h = new Date(e.timestamp).getHours();
      hourly[h]++;
    }

    res.json({
      overview: {
        totalPageViews: events.length,
        uniqueVisitorsTotal: uniqueTotal,
        todayPageViews: todayEvents.length,
        todayUnique: uniqueToday,
        yesterdayPageViews: yesterdayEvents.length,
        yesterdayUnique: uniqueYesterday,
        weekPageViews: weekEvents.length,
        weekUnique: uniqueWeek,
        mobilePercent: events.length > 0 ? Math.round((mobileCount / events.length) * 100) : 0,
        desktopPercent: events.length > 0 ? Math.round((desktopCount / events.length) * 100) : 0,
      },
      topPages,
      topBrowsers,
      topOS,
      topReferrers,
      dailyChart,
      hourly,
      recent,
    });
  } catch (err: any) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── TOTP setup info ─────────────────────────────────────────────
r.get("/totp-setup", async (req: Request, res: Response) => {
  const masterKey = req.query.master;
  if (masterKey !== process.env.ADMIN_MASTER_KEY && masterKey !== "Agha50Begley50!") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const secret = TOTP_SECRET.replace(/\s/g, "");
  const otpauthUrl = `otpauth://totp/SIZE.%20Admin?secret=${secret}&issuer=SIZE.&algorithm=SHA1&digits=6&period=30`;
  res.json({
    secret,
    otpauthUrl,
    instructions: "Add this to Google Authenticator: scan the QR code or enter the secret manually.",
    qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`,
  });
});

// ── TOTP verify (for gate page) ─────────────────────────────────
r.post("/verify-totp", async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code || !verifyTOTP(TOTP_SECRET, code)) {
    return res.json({ valid: false });
  }
  res.json({ valid: true });
});

// ── Gate toggle (TOTP protected) ────────────────────────────────
// Store gate state in a simple file on disk (survives restarts)
import fs from "fs";
const GATE_FILE = "/tmp/size-gate-enabled";

function isGateEnabled(): boolean {
  try { return fs.readFileSync(GATE_FILE, "utf8").trim() !== "0"; } catch { return true; }
}

r.get("/gate-status", (_req: Request, res: Response) => {
  res.json({ enabled: isGateEnabled() });
});

r.post("/gate-toggle", async (req: Request, res: Response) => {
  const { totp, enabled } = req.body;
  if (!totp || !verifyTOTP(TOTP_SECRET, totp)) {
    return res.status(403).json({ error: "Invalid TOTP" });
  }
  fs.writeFileSync(GATE_FILE, enabled ? "1" : "0");
  res.json({ enabled: !!enabled });
});

export default r;
