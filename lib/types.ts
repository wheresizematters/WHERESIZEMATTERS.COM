export interface Profile {
  id: string;
  username: string;
  size_inches: number;
  is_verified: boolean;
  country?: string;
  age_range?: string;
  bio?: string;
  rank?: number;
  created_at: string;
}

export interface Post {
  id: string;
  type: 'discussion' | 'poll';
  content: string;
  author: {
    id: string;
    username: string;
    size_inches: number;
    is_verified: boolean;
  };
  poll_options?: PollOption[];
  comment_count: number;
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
