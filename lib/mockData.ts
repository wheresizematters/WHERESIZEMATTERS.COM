import { LeaderboardEntry, Post } from './types';

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1,  id: 'u1',  username: 'ThunderRod',    size_inches: 9.4, country: '🇧🇷', is_verified: true },
  { rank: 2,  id: 'u2',  username: 'BigMike88',     size_inches: 9.1, country: '🇺🇸', is_verified: true },
  { rank: 3,  id: 'u3',  username: 'KingKong_X',    size_inches: 8.9, country: '🇳🇬', is_verified: true },
  { rank: 4,  id: 'u4',  username: 'LargeAndNCharge', size_inches: 8.7, country: '🇫🇷', is_verified: true },
  { rank: 5,  id: 'u5',  username: 'Atlas_XXL',     size_inches: 8.6, country: '🇩🇪', is_verified: true },
  { rank: 6,  id: 'u6',  username: 'Goliath99',     size_inches: 8.5, country: '🇺🇸', is_verified: true },
  { rank: 7,  id: 'u7',  username: 'MightyMoose',   size_inches: 8.4, country: '🇨🇦', is_verified: true },
  { rank: 8,  id: 'u8',  username: 'TowerOfPower',  size_inches: 8.3, country: '🇬🇧', is_verified: false },
  { rank: 9,  id: 'u9',  username: 'SteelCityBull', size_inches: 8.2, country: '🇺🇸', is_verified: true },
  { rank: 10, id: 'u10', username: 'IronMike',      size_inches: 8.1, country: '🇲🇽', is_verified: true },
  { rank: 11, id: 'u11', username: 'BigSurfer',     size_inches: 7.9, country: '🇦🇺', is_verified: true },
  { rank: 12, id: 'u12', username: 'NordicGiant',   size_inches: 7.8, country: '🇳🇴', is_verified: false },
  { rank: 13, id: 'u13', username: 'MediterraneoX', size_inches: 7.7, country: '🇮🇹', is_verified: true },
  { rank: 14, id: 'u14', username: 'MidwestMonster', size_inches: 7.6, country: '🇺🇸', is_verified: true },
  { rank: 15, id: 'u15', username: 'ProudPrince',   size_inches: 7.5, country: '🇯🇵', is_verified: false },
];

export const MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    type: 'poll',
    content: 'Does size actually matter in relationships?',
    author: { id: 'u1', username: 'ThunderRod', size_inches: 9.4, is_verified: true },
    poll_options: [
      { id: 'o1', text: 'Yes, very much', vote_count: 892, user_voted: false },
      { id: 'o2', text: 'Somewhat', vote_count: 1204, user_voted: false },
      { id: 'o3', text: "Not really", vote_count: 567, user_voted: false },
      { id: 'o4', text: 'Not at all', vote_count: 231, user_voted: false },
    ],
    comment_count: 342,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'p2',
    type: 'discussion',
    content: 'Finally got verified 👑 Took a while but worth it. Who else recently joined the XL club?',
    author: { id: 'u3', username: 'KingKong_X', size_inches: 8.9, is_verified: true },
    comment_count: 87,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'p3',
    type: 'poll',
    content: 'What do you think the global average is?',
    author: { id: 'u6', username: 'Goliath99', size_inches: 8.5, is_verified: true },
    poll_options: [
      { id: 'o5', text: 'Under 5"', vote_count: 123, user_voted: false },
      { id: 'o6', text: '5" – 5.5"', vote_count: 445, user_voted: false },
      { id: 'o7', text: '5.5" – 6"', vote_count: 892, user_voted: false },
      { id: 'o8', text: 'Over 6"', vote_count: 334, user_voted: false },
    ],
    comment_count: 156,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'p3b',
    type: 'discussion',
    content: 'Just hit a new PR 💪 verification coming soon',
    author: { id: 'u4', username: 'LargeAndNCharge', size_inches: 8.7, is_verified: true },
    media_url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
    media_type: 'image',
    comment_count: 52,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  } as any,
  {
    id: 'p4',
    type: 'discussion',
    content: 'Girth or length — what matters more? Drop your honest take below 👇',
    author: { id: 'u9', username: 'SteelCityBull', size_inches: 8.2, is_verified: true },
    comment_count: 214,
    created_at: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'p5',
    type: 'poll',
    content: 'Have you ever felt insecure about your size?',
    author: { id: 'u11', username: 'BigSurfer', size_inches: 7.9, is_verified: true },
    poll_options: [
      { id: 'o9',  text: 'Used to, not anymore', vote_count: 1102, user_voted: false },
      { id: 'o10', text: 'Never',                vote_count: 678,  user_voted: false },
      { id: 'o11', text: 'Sometimes still do',   vote_count: 445,  user_voted: false },
      { id: 'o12', text: 'All the time',          vote_count: 198,  user_voted: false },
    ],
    comment_count: 523,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
];

export const WORLD_AVERAGE = 5.17; // inches, per scientific studies
