import { TOKEN_ADDRESS, RPC_URL, BASE_CHAIN_ID_HEX } from './web3';

export const STAKING_CONTRACT_ADDRESS = '0x297144aF8c96E69E0488C00a0D94E37572B3169d'; // Base Sepolia v2

export const TIER_NAMES = ['None', 'Grower', 'Shower', 'Shlong', 'Whale'] as const;
export const TIER_COLORS = ['#666666', '#888888', '#0A84FF', '#BF5AF2', '#E8500A'];
export const TIER_APY = [0, 8, 18, 40, 80];
export const TIER_BOOST = [0, 1, 2, 5, 12];
export const TIER_MIN = [0, 100_000, 1_000_000, 10_000_000, 100_000_000];

// ABI function selectors (keccak256 first 4 bytes)
const SEL = {
  approve:       '0x095ea7b3', // approve(address,uint256)
  stake:         '0xa694fc3a', // stake(uint256)
  unstake:       '0x2e17de78', // unstake(uint256)
  claimRewards:  '0x372500ab', // claimRewards()
  getStakeInfo:  '0x7e49a653', // getStakeInfo(address)
  totalStaked:   '0x817b1cd2', // totalStaked()
};

// ── Helpers ────────────────────────────────────────────────────────

function padAddress(addr: string): string {
  return addr.slice(2).toLowerCase().padStart(64, '0');
}

function padUint256(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

function getEth(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).ethereum ?? null;
}

async function sendTx(to: string, data: string): Promise<string> {
  const eth = getEth();
  if (!eth) throw new Error('No wallet connected');

  const [from] = await eth.request({ method: 'eth_accounts' });
  if (!from) throw new Error('No account connected');

  // Ensure on Base
  const chainId = await eth.request({ method: 'eth_chainId' });
  if (chainId !== BASE_CHAIN_ID_HEX) {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });
  }

  const txHash: string = await eth.request({
    method: 'eth_sendTransaction',
    params: [{ from, to, data }],
  });

  return txHash;
}

async function ethCall(to: string, data: string): Promise<string> {
  const eth = getEth();
  if (!eth) throw new Error('No wallet connected');

  return eth.request({
    method: 'eth_call',
    params: [{ to, data }, 'latest'],
  });
}

// ── Read functions ─────────────────────────────────────────────────

export interface StakeInfoResult {
  stakedAmount: bigint;
  pendingRewards: bigint;
  tier: number;
  boost: number;
  effectiveStake: bigint;
}

export async function getStakeInfo(walletAddress: string): Promise<StakeInfoResult | null> {
  if (!STAKING_CONTRACT_ADDRESS) return null;

  try {
    const data = SEL.getStakeInfo + padAddress(walletAddress);
    const result = await ethCall(STAKING_CONTRACT_ADDRESS, data);

    // Decode 5 uint256 values (each 32 bytes = 64 hex chars)
    const hex = result.slice(2); // remove 0x
    const stakedAmount = BigInt('0x' + hex.slice(0, 64));
    const pendingRewards = BigInt('0x' + hex.slice(64, 128));
    const tier = Number(BigInt('0x' + hex.slice(128, 192)));
    const boost = Number(BigInt('0x' + hex.slice(192, 256)));
    const effectiveStake = BigInt('0x' + hex.slice(256, 320));

    return { stakedAmount, pendingRewards, tier, boost, effectiveStake };
  } catch {
    return null;
  }
}

export async function getTotalStaked(): Promise<string> {
  if (!STAKING_CONTRACT_ADDRESS) return '0';

  try {
    const result = await ethCall(STAKING_CONTRACT_ADDRESS, SEL.totalStaked);
    const raw = BigInt(result);
    return (Number(raw) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return '0';
  }
}

// ── Write functions ────────────────────────────────────────────────

/** Approve staking contract to spend $SIZE tokens */
export async function approveStaking(amount: bigint): Promise<string> {
  if (!TOKEN_ADDRESS) throw new Error('Token address not set');
  const data = SEL.approve + padAddress(STAKING_CONTRACT_ADDRESS) + padUint256(amount);
  return sendTx(TOKEN_ADDRESS, data);
}

/** Stake $SIZE tokens */
export async function stakeTokens(amount: bigint): Promise<string> {
  if (!STAKING_CONTRACT_ADDRESS) throw new Error('Staking contract not set');
  const data = SEL.stake + padUint256(amount);
  return sendTx(STAKING_CONTRACT_ADDRESS, data);
}

/** Unstake $SIZE tokens */
export async function unstakeTokens(amount: bigint): Promise<string> {
  if (!STAKING_CONTRACT_ADDRESS) throw new Error('Staking contract not set');
  const data = SEL.unstake + padUint256(amount);
  return sendTx(STAKING_CONTRACT_ADDRESS, data);
}

/** Claim pending staking rewards */
export async function claimStakingRewards(): Promise<string> {
  if (!STAKING_CONTRACT_ADDRESS) throw new Error('Staking contract not set');
  return sendTx(STAKING_CONTRACT_ADDRESS, SEL.claimRewards);
}

// ── Formatting helpers ─────────────────────────────────────────────

export function formatTokenAmount(wei: bigint): string {
  const num = Number(wei) / 1e18;
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function parseTokenAmount(display: string): bigint {
  const num = parseFloat(display.replace(/,/g, ''));
  if (isNaN(num) || num <= 0) return 0n;
  return BigInt(Math.floor(num * 1e18));
}
