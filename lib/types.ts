export interface Profile {
  id: string;
  username: string;
  size_inches: number;
  is_verified: boolean;
  has_set_size: boolean;
  country?: string;
  age_range?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
  header_url?: string;
  rank?: number;
  created_at: string;
}

export interface Post {
  id: string;
  type: 'discussion' | 'poll';
  title?: string | null;
  content: string;
  tag?: string | null;
  media_url?: string | null;
  author: {
    id: string;
    username: string;
    size_inches: number;
    is_verified: boolean;
  };
  poll_options?: PollOption[];
  comment_count: number;
  score: number;
  user_vote?: 0 | 1 | -1;
  created_at: string;
}

export interface PollOption {
  id: string;
  text: string;
  vote_count: number;
  user_voted?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  size_inches: number;
  country: string;
  is_verified: boolean;
}

export interface ConversationUser {
  id: string;
  username: string;
  size_inches: number;
  is_verified: boolean;
}

export interface Conversation {
  id: string;
  user_1_id: string;
  user_2_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  user_1_last_read: string | null;
  user_2_last_read: string | null;
  user1: ConversationUser;
  user2: ConversationUser;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  viewed_at: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  author: {
    id: string;
    username: string;
    size_inches: number;
    is_verified: boolean;
  };
  created_at: string;
}

export interface VerificationRequest {
  id: string;
  user_id: string;
  image_path: string;
  reported_size: number;
  ai_est_size: number | null;
  ai_confidence: 'low' | 'medium' | 'high' | null;
  ai_notes: string | null;
  status: 'pending' | 'auto_verified' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  profile?: { username: string; size_inches: number };
}
