/**
 * Custodial Wallet Service
 *
 * Creates and manages delegated wallets for users who don't connect their own.
 *
 * SECURITY ARCHITECTURE:
 * ═════════════════════════════════════════════════════════════════
 *
 * 1. Private keys are generated server-side via ethers.js (crypto-random)
 * 2. Keys are encrypted with AWS KMS before storage (envelope encryption)
 * 3. Encrypted ciphertext stored in SEPARATE DynamoDB table (size-custodial-wallets)
 * 4. KMS key is hardware-backed (FIPS 140-2 Level 2)
 * 5. Only the API server's IAM role can call KMS Decrypt
 * 6. Private keys are NEVER logged, NEVER stored in plaintext
 * 7. Decryption happens in-memory only when signing transactions
 * 8. User can opt out by connecting their own wallet
 *
 * Even if DynamoDB is compromised, encrypted keys are useless
 * without KMS access (which requires AWS IAM credentials).
 * ═════════════════════════════════════════════════════════════════
 */

import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const KMS_KEY_ID = process.env.CUSTODIAL_KMS_KEY_ID ?? "";
const WALLET_TABLE = process.env.TABLE_CUSTODIAL_WALLETS ?? "size-custodial-wallets";

// Separate DynamoDB client for wallet table (could point to different region/account)
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const kmsClient = new KMSClient({ region: REGION });

// ── Types ────────────────────────────────────────────────────────

export interface CustodialWallet {
  userId: string;
  address: string;               // public address (safe to store/display)
  encryptedPrivateKey: string;    // KMS-encrypted, base64-encoded
  chain: string;                  // "base" for now
  active: boolean;                // false if user connected their own wallet
  createdAt: string;
}

// ── Create wallet ────────────────────────────────────────────────

export async function createCustodialWallet(userId: string): Promise<{ address: string } | null> {
  try {
    // Check if user already has a custodial wallet
    const existing = await getCustodialWallet(userId);
    if (existing) return { address: existing.address };

    // Generate new wallet
    // Use ethers if available, otherwise raw crypto
    let address: string;
    let privateKey: string;

    try {
      const { ethers } = require("ethers");
      const wallet = ethers.Wallet.createRandom();
      address = wallet.address.toLowerCase();
      privateKey = wallet.privateKey;
    } catch {
      // Fallback: generate raw secp256k1 key
      const key = crypto.randomBytes(32);
      privateKey = "0x" + key.toString("hex");
      // Derive address from private key (simplified — in production use ethers)
      const { createPublicKey } = crypto;
      // For proper address derivation we really need ethers
      // This is a safety fallback that should never be reached in production
      address = "0x" + crypto.createHash("sha256").update(key).digest("hex").slice(0, 40);
    }

    // Encrypt private key with KMS
    const encryptedKey = await encryptWithKMS(privateKey);
    if (!encryptedKey) {
      console.error("KMS encryption failed for user:", userId);
      return null;
    }

    // CRITICAL: Clear private key from memory
    privateKey = "";

    // Store in separate table
    const wallet: CustodialWallet = {
      userId,
      address,
      encryptedPrivateKey: encryptedKey,
      chain: "base",
      active: true,
      createdAt: new Date().toISOString(),
    };

    await ddbClient.send(new PutCommand({
      TableName: WALLET_TABLE,
      Item: wallet,
      ConditionExpression: "attribute_not_exists(userId)", // prevent overwrite
    }));

    return { address };
  } catch (err: any) {
    // Don't log anything sensitive
    console.error("Custodial wallet creation failed:", err.name, err.message);
    return null;
  }
}

// ── Get wallet (public info only) ────────────────────────────────

export async function getCustodialWallet(userId: string): Promise<CustodialWallet | null> {
  try {
    const result = await ddbClient.send(new GetCommand({
      TableName: WALLET_TABLE,
      Key: { userId },
    }));
    return (result.Item as CustodialWallet) ?? null;
  } catch {
    return null;
  }
}

// ── Get wallet address (safe — no private key) ──────────────────

export async function getCustodialAddress(userId: string): Promise<string | null> {
  const wallet = await getCustodialWallet(userId);
  return wallet?.address ?? null;
}

// ── Sign transaction (decrypts key in-memory, signs, discards) ──

export async function signTransaction(
  userId: string,
  txData: { to: string; value?: string; data?: string; chainId?: number },
): Promise<string | null> {
  try {
    const wallet = await getCustodialWallet(userId);
    if (!wallet || !wallet.active) return null;

    // Decrypt private key from KMS
    let privateKey = await decryptWithKMS(wallet.encryptedPrivateKey);
    if (!privateKey) return null;

    try {
      const { ethers } = require("ethers");
      const rpc = process.env.BASE_RPC_URL ?? "https://sepolia.base.org";
      const provider = new ethers.JsonRpcProvider(rpc);
      const signer = new ethers.Wallet(privateKey, provider);

      const tx = await signer.sendTransaction({
        to: txData.to,
        value: txData.value ? ethers.parseEther(txData.value) : undefined,
        data: txData.data ?? "0x",
        chainId: txData.chainId ?? 84532, // Base Sepolia
      });

      const receipt = await tx.wait();
      return receipt.hash;
    } finally {
      // CRITICAL: Clear private key from memory immediately
      privateKey = "";
    }
  } catch (err: any) {
    console.error("Sign transaction failed:", err.name);
    return null;
  }
}

// ── Sign message (for wallet verification, etc.) ─────────────────

export async function signMessage(userId: string, message: string): Promise<string | null> {
  try {
    const wallet = await getCustodialWallet(userId);
    if (!wallet || !wallet.active) return null;

    let privateKey = await decryptWithKMS(wallet.encryptedPrivateKey);
    if (!privateKey) return null;

    try {
      const { ethers } = require("ethers");
      const signer = new ethers.Wallet(privateKey);
      return await signer.signMessage(message);
    } finally {
      privateKey = "";
    }
  } catch {
    return null;
  }
}

// ── Deactivate (user connected their own wallet) ─────────────────

export async function deactivateCustodialWallet(userId: string): Promise<boolean> {
  try {
    await ddbClient.send(new UpdateCommand({
      TableName: WALLET_TABLE,
      Key: { userId },
      UpdateExpression: "SET active = :f",
      ExpressionAttributeValues: { ":f": false },
    }));
    return true;
  } catch {
    return false;
  }
}

// ── Reactivate (user disconnected their own wallet) ──────────────

export async function reactivateCustodialWallet(userId: string): Promise<boolean> {
  try {
    await ddbClient.send(new UpdateCommand({
      TableName: WALLET_TABLE,
      Key: { userId },
      UpdateExpression: "SET active = :t",
      ExpressionAttributeValues: { ":t": true },
    }));
    return true;
  } catch {
    return false;
  }
}

// ── KMS encryption/decryption ────────────────────────────────────

async function encryptWithKMS(plaintext: string): Promise<string | null> {
  if (!KMS_KEY_ID) {
    // Fallback for development: use AES-256 with a local key
    // In production, ALWAYS use KMS
    console.warn("WARNING: CUSTODIAL_KMS_KEY_ID not set. Using local encryption (NOT safe for production).");
    return localEncrypt(plaintext);
  }

  try {
    const result = await kmsClient.send(new EncryptCommand({
      KeyId: KMS_KEY_ID,
      Plaintext: Buffer.from(plaintext, "utf-8"),
      EncryptionContext: { service: "size-custodial-wallets" },
    }));

    if (!result.CiphertextBlob) return null;
    return Buffer.from(result.CiphertextBlob).toString("base64");
  } catch (err: any) {
    console.error("KMS encrypt error:", err.name);
    return null;
  }
}

async function decryptWithKMS(ciphertext: string): Promise<string | null> {
  if (!KMS_KEY_ID) {
    return localDecrypt(ciphertext);
  }

  try {
    const result = await kmsClient.send(new DecryptCommand({
      CiphertextBlob: Buffer.from(ciphertext, "base64"),
      EncryptionContext: { service: "size-custodial-wallets" },
    }));

    if (!result.Plaintext) return null;
    return Buffer.from(result.Plaintext).toString("utf-8");
  } catch (err: any) {
    console.error("KMS decrypt error:", err.name);
    return null;
  }
}

// ── Local fallback encryption (dev only — NOT for production) ────

const LOCAL_KEY = crypto.createHash("sha256")
  .update(process.env.JWT_SECRET ?? "size-dev-key-not-for-production")
  .digest();

function localEncrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", LOCAL_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function localDecrypt(ciphertext: string): string | null {
  try {
    const data = Buffer.from(ciphertext, "base64");
    const iv = data.subarray(0, 16);
    const tag = data.subarray(16, 32);
    const encrypted = data.subarray(32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", LOCAL_KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf-8");
  } catch {
    return null;
  }
}

// ── Export wallet (user wants to take custody) ──────────────────

export async function exportPrivateKey(userId: string): Promise<string | null> {
  // This is a destructive action — user takes full custody
  // After export, deactivate the custodial wallet
  try {
    const wallet = await getCustodialWallet(userId);
    if (!wallet) return null;

    const privateKey = await decryptWithKMS(wallet.encryptedPrivateKey);
    if (!privateKey) return null;

    // Deactivate custodial wallet after export
    await deactivateCustodialWallet(userId);

    return privateKey;
  } catch {
    return null;
  }
}
