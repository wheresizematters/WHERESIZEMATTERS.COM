import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const BUCKET = process.env.S3_AUDIT_BUCKET ?? "size-staking-audit-logs";

export async function writeAuditLog(
  category: "events" | "admin" | "snapshots",
  filename: string,
  data: unknown
): Promise<void> {
  const now = new Date();
  const datePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(now.getUTCDate()).padStart(2, "0")}`;
  const key = `${category}/${datePath}/${filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    })
  );
}

export async function writeEventLog(
  eventName: string,
  walletAddress: string,
  txHash: string,
  data: unknown
): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const filename = `${eventName}-${walletAddress.slice(0, 8)}-${timestamp}-${txHash.slice(0, 10)}.json`;
  await writeAuditLog("events", filename, {
    eventName,
    walletAddress,
    txHash,
    indexerTimestamp: new Date().toISOString(),
    data,
  });
}

export async function writeSnapshotLog(data: unknown): Promise<void> {
  const now = new Date();
  const filename = `hourly-${String(now.getUTCHours()).padStart(2, "0")}.json`;
  await writeAuditLog("snapshots", filename, data);
}

export async function writeAdminLog(action: string, data: unknown): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const filename = `${action}-${timestamp}.json`;
  await writeAuditLog("admin", filename, {
    action,
    timestamp: new Date().toISOString(),
    data,
  });
}
