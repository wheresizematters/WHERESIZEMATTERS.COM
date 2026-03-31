import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profiles";
import postRoutes from "./routes/posts";
import messagingRoutes from "./routes/messaging";
import communityRoutes from "./routes/communities";
import followRoutes from "./routes/follows";
import storageRoutes from "./routes/storage";
import dickcoinRoutes from "./routes/dickcoins";
import circleJerkRoutes from "./routes/circlejerks";
import verificationRoutes from "./routes/verifications";
import giftRoutes from "./routes/gifts";
import stripeRoutes from "./routes/stripe";
import analyticsRoutes from "./routes/analytics";
import walletRoutes from "./routes/wallets";
import custodialRoutes from "./routes/custodial";
import logoGenRoutes from "./routes/logo-gen";
import referralRoutes from "./routes/referrals";
import kolRatingRoutes from "./routes/kol-ratings";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

app.set("trust proxy", 1); // Behind nginx
app.use(cors());
app.use(express.json({ limit: "5mb" })); // Allow larger uploads

// Rate limiting
app.use(rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Health
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "size-api", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/profiles", profileRoutes);
app.use("/api/v1/storage", storageRoutes);
app.use("/api/v1/posts", postRoutes);
app.use("/api/v1/messaging", messagingRoutes);
app.use("/api/v1/communities", communityRoutes);
app.use("/api/v1/users", followRoutes);
app.use("/api/v1/dickcoins", dickcoinRoutes);
app.use("/api/v1/circle-jerks", circleJerkRoutes);
app.use("/api/v1/verifications", verificationRoutes);
app.use("/api/v1/gifts", giftRoutes);
app.use("/api/v1/stripe", stripeRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/wallets", walletRoutes);
app.use("/api/v1/custodial", custodialRoutes);
app.use("/api/v1/logo", logoGenRoutes);
app.use("/api/v1/referrals", referralRoutes);
app.use("/api/v1/kol", kolRatingRoutes);

app.listen(PORT, () => {
  console.log("=== SIZE. API ===");
  console.log(`  Listening on port ${PORT}`);
  console.log(`  Tables prefix: size-`);
  console.log(`  Region: ${process.env.AWS_REGION ?? "us-east-1"}`);
});

export default app;
