import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { StakingPosition, StakingEvent, ActivityScore, RewardSnapshot } from "./types";

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const ddb = DynamoDBDocumentClient.from(client);

const POSITIONS_TABLE = process.env.DYNAMO_POSITIONS_TABLE ?? "size-staking-positions";
const EVENTS_TABLE = process.env.DYNAMO_EVENTS_TABLE ?? "size-staking-events";
const ACTIVITY_TABLE = process.env.DYNAMO_ACTIVITY_TABLE ?? "size-activity-scores";
const SNAPSHOTS_TABLE = process.env.DYNAMO_SNAPSHOTS_TABLE ?? "size-reward-snapshots";

// ── Positions ──────────────────────────────────────────────────────

export async function getPosition(walletAddress: string): Promise<StakingPosition | null> {
  const { Item } = await ddb.send(
    new GetCommand({ TableName: POSITIONS_TABLE, Key: { wallet_address: walletAddress.toLowerCase() } })
  );
  return (Item as StakingPosition) ?? null;
}

export async function putPosition(position: StakingPosition): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: POSITIONS_TABLE,
      Item: { ...position, wallet_address: position.wallet_address.toLowerCase() },
    })
  );
}

export async function getAllPositions(): Promise<StakingPosition[]> {
  const result = await ddb.send(new ScanCommand({ TableName: POSITIONS_TABLE }));
  return (result.Items ?? []) as StakingPosition[];
}

export async function getPositionCount(): Promise<number> {
  const result = await ddb.send(
    new ScanCommand({ TableName: POSITIONS_TABLE, Select: "COUNT" })
  );
  return result.Count ?? 0;
}

// ── Events ─────────────────────────────────────────────────────────

export async function putEvent(event: StakingEvent): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: EVENTS_TABLE,
      Item: { ...event, wallet_address: event.wallet_address.toLowerCase() },
    })
  );
}

export async function getEventsByWallet(
  walletAddress: string,
  limit = 50
): Promise<StakingEvent[]> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "wallet_address = :wa",
      ExpressionAttributeValues: { ":wa": walletAddress.toLowerCase() },
      ScanIndexForward: false, // newest first
      Limit: limit,
    })
  );
  return (Items ?? []) as StakingEvent[];
}

// ── Activity Scores ────────────────────────────────────────────────

export async function getActivityScore(walletAddress: string): Promise<ActivityScore | null> {
  const { Item } = await ddb.send(
    new GetCommand({ TableName: ACTIVITY_TABLE, Key: { wallet_address: walletAddress.toLowerCase() } })
  );
  return (Item as ActivityScore) ?? null;
}

export async function putActivityScore(score: ActivityScore): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: ACTIVITY_TABLE,
      Item: { ...score, wallet_address: score.wallet_address.toLowerCase() },
    })
  );
}

// ── Snapshots ──────────────────────────────────────────────────────

export async function putSnapshot(snapshot: RewardSnapshot): Promise<void> {
  await ddb.send(new PutCommand({ TableName: SNAPSHOTS_TABLE, Item: snapshot }));
}

export async function getLatestSnapshot(): Promise<RewardSnapshot | null> {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const hour = now.getUTCHours().toString().padStart(2, "0");

  const { Item } = await ddb.send(
    new GetCommand({ TableName: SNAPSHOTS_TABLE, Key: { snapshot_date: date, snapshot_hour: hour } })
  );
  return (Item as RewardSnapshot) ?? null;
}

// ── Stats helpers ──────────────────────────────────────────────────

export async function getTierCounts(): Promise<Record<string, number>> {
  const positions = await getAllPositions();
  const counts = { grower: 0, shower: 0, shlong: 0, whale: 0 };
  for (const p of positions) {
    if (p.tier === 1) counts.grower++;
    else if (p.tier === 2) counts.shower++;
    else if (p.tier === 3) counts.shlong++;
    else if (p.tier === 4) counts.whale++;
  }
  return counts;
}
