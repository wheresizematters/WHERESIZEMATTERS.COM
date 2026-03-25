import { v4 as uuid } from "uuid";
import { T, getItem, putItem, updateItem, queryItems } from "../db";
import { getProfile, awardCoins } from "./profiles";

// ── DM Conversations (existing) ────────────────────────────────────

export interface Conversation {
  id: string;
  user_1_id: string;  // lexicographically smaller UUID
  user_2_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  user_1_last_read: string | null;
  user_2_last_read: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  viewed_at: string | null;
  created_at: string;
}

export async function getConversations(userId: string): Promise<any[]> {
  // Query both sides (user is user_1 or user_2)
  const [asUser1, asUser2] = await Promise.all([
    queryItems<Conversation>(T.conversations, "user_1_id = :uid", { ":uid": userId }, { indexName: "user1-index" }),
    queryItems<Conversation>(T.conversations, "user_2_id = :uid", { ":uid": userId }, { indexName: "user2-index" }),
  ]);

  const all = [...asUser1, ...asUser2];
  all.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

  // Hydrate with user profiles
  return Promise.all(
    all.map(async (c) => {
      const [user1, user2] = await Promise.all([getProfile(c.user_1_id), getProfile(c.user_2_id)]);
      return {
        ...c,
        user1: user1 ? { id: user1.id, username: user1.username, size_inches: user1.size_inches, is_verified: user1.is_verified } : null,
        user2: user2 ? { id: user2.id, username: user2.username, size_inches: user2.size_inches, is_verified: user2.is_verified } : null,
      };
    })
  );
}

export async function getOrCreateConversation(
  myId: string,
  otherId: string,
): Promise<{ id: string | null; error: string | null }> {
  const [user_1_id, user_2_id] = myId < otherId ? [myId, otherId] : [otherId, myId];

  // Check existing
  const existing = await queryItems<Conversation>(
    T.conversations,
    "user_1_id = :u1",
    { ":u1": user_1_id },
    { indexName: "user1-index" },
  );
  const found = existing.find((c) => c.user_2_id === user_2_id);
  if (found) return { id: found.id, error: null };

  // Create new
  const id = uuid();
  const now = new Date().toISOString();
  await putItem(T.conversations, {
    id,
    user_1_id,
    user_2_id,
    last_message_at: now,
    last_message_preview: null,
    user_1_last_read: null,
    user_2_last_read: null,
    created_at: now,
  });

  awardCoins(myId, 500).catch(() => {});
  return { id, error: null };
}

export async function getMessages(conversationId: string, limit = 60): Promise<Message[]> {
  return queryItems<Message>(
    T.messages,
    "conversation_id = :cid",
    { ":cid": conversationId },
    { limit, scanForward: false },
  );
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: "image" | "video",
): Promise<{ error: string | null }> {
  const id = uuid();
  const now = new Date().toISOString();

  await putItem(T.messages, {
    id,
    conversation_id: conversationId,
    sender_id: senderId,
    content,
    media_url: mediaUrl ?? null,
    media_type: mediaType ?? null,
    viewed_at: null,
    created_at: now,
  });

  // Update conversation
  await updateItem(T.conversations, { id: conversationId }, {
    last_message_at: now,
    last_message_preview: content.slice(0, 60),
  });

  return { error: null };
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const conv = await getItem<Conversation>(T.conversations, { id: conversationId });
  if (!conv) return;
  const field = conv.user_1_id === userId ? "user_1_last_read" : "user_2_last_read";
  await updateItem(T.conversations, { id: conversationId }, { [field]: new Date().toISOString() });
}

export async function markMediaViewed(messageId: string): Promise<void> {
  // Need to find conversation_id first since messages use composite key
  // For simplicity, update by scan (or pass conversation_id from client)
  await updateItem(T.messages, { id: messageId }, { viewed_at: new Date().toISOString() });
}

// ── Group Chats (new) ──────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  created_by: string;
  member_count: number;
  last_message_at: string;
  last_message_preview: string | null;
  is_private: boolean;
  max_members: number;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  last_read_at: string | null;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  created_at: string;
}

export async function createGroup(
  creatorId: string,
  name: string,
  description: string,
  isPrivate = false,
  memberIds: string[] = [],
): Promise<{ id: string; error: string | null }> {
  const id = uuid();
  const now = new Date().toISOString();

  await putItem(T.groups, {
    id,
    name,
    description,
    avatar_url: null,
    created_by: creatorId,
    member_count: 1 + memberIds.length,
    last_message_at: now,
    last_message_preview: null,
    is_private: isPrivate,
    max_members: 100,
    created_at: now,
  });

  // Add creator as owner
  await putItem(T.group_members, {
    group_id: id,
    user_id: creatorId,
    role: "owner",
    joined_at: now,
    last_read_at: now,
  });

  // Add initial members
  for (const memberId of memberIds) {
    await putItem(T.group_members, {
      group_id: id,
      user_id: memberId,
      role: "member",
      joined_at: now,
      last_read_at: null,
    });
  }

  return { id, error: null };
}

export async function getGroup(groupId: string): Promise<Group | null> {
  return getItem<Group>(T.groups, { id: groupId });
}

export async function getUserGroups(userId: string): Promise<any[]> {
  const memberships = await queryItems<GroupMember>(
    T.group_members,
    "user_id = :uid",
    { ":uid": userId },
    { indexName: "user-groups-index" },
  );

  return Promise.all(
    memberships.map(async (m) => {
      const group = await getGroup(m.group_id);
      return { ...group, membership: m };
    })
  );
}

export async function getGroupMembers(groupId: string): Promise<any[]> {
  const members = await queryItems<GroupMember>(
    T.group_members,
    "group_id = :gid",
    { ":gid": groupId },
  );

  return Promise.all(
    members.map(async (m) => {
      const profile = await getProfile(m.user_id);
      return { ...m, profile };
    })
  );
}

export async function addGroupMember(
  groupId: string,
  userId: string,
  addedBy: string,
): Promise<{ error: string | null }> {
  // Check adder is admin/owner
  const adderMembership = await getItem<GroupMember>(T.group_members, { group_id: groupId, user_id: addedBy });
  if (!adderMembership || adderMembership.role === "member") {
    return { error: "Only admins can add members" };
  }

  const group = await getGroup(groupId);
  if (!group) return { error: "Group not found" };
  if (group.member_count >= group.max_members) return { error: "Group is full" };

  await putItem(T.group_members, {
    group_id: groupId,
    user_id: userId,
    role: "member",
    joined_at: new Date().toISOString(),
    last_read_at: null,
  });

  await updateItem(T.groups, { id: groupId }, { member_count: group.member_count + 1 });
  return { error: null };
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
  removedBy: string,
): Promise<{ error: string | null }> {
  // Can remove yourself, or admins can remove others
  if (userId !== removedBy) {
    const removerMembership = await getItem<GroupMember>(T.group_members, { group_id: groupId, user_id: removedBy });
    if (!removerMembership || removerMembership.role === "member") {
      return { error: "Only admins can remove members" };
    }
  }

  await deleteItem(T.group_members, { group_id: groupId, user_id: userId });

  const group = await getGroup(groupId);
  if (group) {
    await updateItem(T.groups, { id: groupId }, { member_count: Math.max(0, group.member_count - 1) });
  }
  return { error: null };
}

export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: "image" | "video",
): Promise<{ error: string | null }> {
  // Verify sender is member
  const membership = await getItem<GroupMember>(T.group_members, { group_id: groupId, user_id: senderId });
  if (!membership) return { error: "Not a member of this group" };

  const id = uuid();
  const now = new Date().toISOString();

  await putItem(T.group_messages, {
    id,
    group_id: groupId,
    sender_id: senderId,
    content,
    media_url: mediaUrl ?? null,
    media_type: mediaType ?? null,
    created_at: now,
  });

  await updateItem(T.groups, { id: groupId }, {
    last_message_at: now,
    last_message_preview: content.slice(0, 60),
  });

  return { error: null };
}

export async function getGroupMessages(groupId: string, limit = 60): Promise<any[]> {
  const messages = await queryItems<GroupMessage>(
    T.group_messages,
    "group_id = :gid",
    { ":gid": groupId },
    { limit, scanForward: false },
  );

  return Promise.all(
    messages.map(async (m) => {
      const sender = await getProfile(m.sender_id);
      return {
        ...m,
        sender: sender ? {
          id: sender.id, username: sender.username,
          size_inches: sender.size_inches, is_verified: sender.is_verified,
        } : null,
      };
    })
  );
}

export async function markGroupRead(groupId: string, userId: string): Promise<void> {
  await updateItem(T.group_members, { group_id: groupId, user_id: userId }, {
    last_read_at: new Date().toISOString(),
  });
}
