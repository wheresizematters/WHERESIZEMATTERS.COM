export interface StakingPosition {
  wallet_address: string;
  staked_amount: string;        // BigInt as string
  tier: number;                 // 0-4
  effective_stake: string;
  pending_rewards: string;
  staked_at: number;            // unix timestamp
  last_claim_at: number;
  last_updated_block: number;
}

export interface StakingEvent {
  wallet_address: string;
  sort_key: string;             // `${timestamp}#${txHash}`
  event_type: "staked" | "unstaked" | "claimed" | "deposited";
  amount: string;
  block_number: number;
  tx_hash: string;
  tier_at_time: number;
  timestamp: number;
}

export interface ActivityScore {
  wallet_address: string;
  supabase_user_id: string;
  login_streak: number;
  posts_this_week: number;
  is_verified: boolean;
  referral_count: number;
  activity_multiplier: number;  // 1.0 - 4.0
  last_synced_at: number;
}

export interface RewardSnapshot {
  snapshot_date: string;        // YYYY-MM-DD
  snapshot_hour: string;        // HH
  total_staked: string;
  total_stakers: number;
  reward_pool_balance: string;
  acc_reward_per_share: string;
  tier_counts: {
    grower: number;
    shower: number;
    shlong: number;
    whale: number;
  };
}

export const TIER_NAMES = ["None", "Grower", "Shower", "Shlong", "Whale"] as const;

export const STAKING_ABI = [
  "event Staked(address indexed user, uint256 amount, uint256 newTier)",
  "event Unstaked(address indexed user, uint256 amount, uint256 newTier)",
  "event RewardsClaimed(address indexed user, uint256 amount)",
  "event RewardsDeposited(address indexed depositor, uint256 amount)",
  "event EmergencyWithdraw(address indexed user, uint256 amount)",
  "function getStakeInfo(address user) view returns (uint256 stakedAmount, uint256 pendingRewards, uint256 tier, uint256 boost, uint256 effectiveStake)",
  "function totalStaked() view returns (uint256)",
  "function totalEffectiveStaked() view returns (uint256)",
  "function accRewardPerShare() view returns (uint256)",
  "function depositRewards(uint256 amount) external",
];

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];
