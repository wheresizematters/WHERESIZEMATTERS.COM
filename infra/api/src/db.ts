import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand, GetCommand, QueryCommand, UpdateCommand,
  DeleteCommand, ScanCommand, BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" });
export const ddb = DynamoDBDocumentClient.from(client);

// ── Table names (from env or defaults) ─────────────────────────────
export const T = {
  profiles:       process.env.TABLE_PROFILES       ?? "size-profiles",
  posts:          process.env.TABLE_POSTS           ?? "size-posts",
  poll_options:   process.env.TABLE_POLL_OPTIONS    ?? "size-poll-options",
  votes:          process.env.TABLE_VOTES           ?? "size-votes",
  post_votes:     process.env.TABLE_POST_VOTES      ?? "size-post-votes",
  comments:       process.env.TABLE_COMMENTS        ?? "size-comments",
  conversations:  process.env.TABLE_CONVERSATIONS   ?? "size-conversations",
  messages:       process.env.TABLE_MESSAGES         ?? "size-messages",
  follows:        process.env.TABLE_FOLLOWS          ?? "size-follows",
  verifications:  process.env.TABLE_VERIFICATIONS    ?? "size-verifications",
  // New
  groups:         process.env.TABLE_GROUPS           ?? "size-groups",
  group_members:  process.env.TABLE_GROUP_MEMBERS    ?? "size-group-members",
  group_messages: process.env.TABLE_GROUP_MESSAGES   ?? "size-group-messages",
  communities:    process.env.TABLE_COMMUNITIES      ?? "size-communities",
  community_members: process.env.TABLE_COMMUNITY_MEMBERS ?? "size-community-members",
  community_posts: process.env.TABLE_COMMUNITY_POSTS ?? "size-community-posts",
  analytics:       process.env.TABLE_ANALYTICS        ?? "size-analytics",
};

// ── Generic helpers ────────────────────────────────────────────────

export async function getItem<T>(table: string, key: Record<string, any>): Promise<T | null> {
  const { Item } = await ddb.send(new GetCommand({ TableName: table, Key: key }));
  return (Item as T) ?? null;
}

export async function putItem(table: string, item: Record<string, any>): Promise<void> {
  // DynamoDB does not accept null or undefined values — strip them
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(item)) {
    if (v !== null && v !== undefined && v !== '') clean[k] = v;
  }
  await ddb.send(new PutCommand({ TableName: table, Item: clean }));
}

export async function updateItem(
  table: string,
  key: Record<string, any>,
  updates: Record<string, any>,
): Promise<void> {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;

  const expr = entries.map(([k], i) => `#k${i} = :v${i}`).join(", ");
  const names: Record<string, string> = {};
  const values: Record<string, any> = {};
  entries.forEach(([k, v], i) => {
    names[`#k${i}`] = k;
    values[`:v${i}`] = v;
  });

  await ddb.send(new UpdateCommand({
    TableName: table,
    Key: key,
    UpdateExpression: `SET ${expr}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export async function deleteItem(table: string, key: Record<string, any>): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: table, Key: key }));
}

export async function queryItems<T>(
  table: string,
  keyExpr: string,
  exprValues: Record<string, any>,
  options?: {
    indexName?: string;
    limit?: number;
    scanForward?: boolean;
    filterExpr?: string;
    exprNames?: Record<string, string>;
  },
): Promise<T[]> {
  const params: any = {
    TableName: table,
    KeyConditionExpression: keyExpr,
    ExpressionAttributeValues: exprValues,
    ScanIndexForward: options?.scanForward ?? false,
  };
  if (options?.indexName) params.IndexName = options.indexName;
  if (options?.limit) params.Limit = options.limit;
  if (options?.filterExpr) params.FilterExpression = options.filterExpr;
  if (options?.exprNames) params.ExpressionAttributeNames = options.exprNames;

  const { Items } = await ddb.send(new QueryCommand(params));
  return (Items ?? []) as T[];
}

export async function scanAll<T>(table: string, filterExpr?: string, exprValues?: Record<string, any>): Promise<T[]> {
  const params: any = { TableName: table };
  if (filterExpr) params.FilterExpression = filterExpr;
  if (exprValues) params.ExpressionAttributeValues = exprValues;

  let items: T[] = [];
  let lastKey: any;
  do {
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const result = await ddb.send(new ScanCommand(params));
    items = items.concat((result.Items ?? []) as T[]);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

export async function batchWrite(table: string, items: Record<string, any>[]): Promise<void> {
  // DynamoDB batch limit is 25
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    await ddb.send(new BatchWriteCommand({
      RequestItems: {
        [table]: batch.map((item) => ({ PutRequest: { Item: item } })),
      },
    }));
  }
}
