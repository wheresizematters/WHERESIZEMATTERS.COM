// Base mainnet config — fill TOKEN_ADDRESS once Saif deploys
export const BASE_CHAIN_ID = 8453;
export const BASE_CHAIN_ID_HEX = '0x2105';
export const TOKEN_ADDRESS = process.env.EXPO_PUBLIC_SIZE_TOKEN_ADDRESS ?? '';
export const RPC_URL =
  process.env.EXPO_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org';

// Minimal ERC-20 ABI for balance + transfer
export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

/** Switch MetaMask/Coinbase Wallet to Base mainnet */
export async function switchToBase(): Promise<boolean> {
  const eth = (window as any).ethereum;
  if (!eth) return false;
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });
    return true;
  } catch (switchError: any) {
    // Chain not added yet — add it
    if (switchError.code === 4902) {
      try {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base',
            nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: ['https://basescan.org'],
          }],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/** Get $SIZE token balance for a wallet address (requires contract deployed) */
export async function getSizeTokenBalance(walletAddress: string): Promise<string> {
  if (!TOKEN_ADDRESS) return '0';
  try {
    const eth = (window as any).ethereum;
    if (!eth) return '0';

    // Encode balanceOf(address) call
    const selector = '0x70a08231';
    const paddedAddress = walletAddress.slice(2).padStart(64, '0');
    const data = selector + paddedAddress;

    const result = await eth.request({
      method: 'eth_call',
      params: [{ to: TOKEN_ADDRESS, data }, 'latest'],
    });

    // Parse result as BigInt and format with 18 decimals
    const raw = BigInt(result);
    const formatted = (Number(raw) / 1e18).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    });
    return formatted;
  } catch {
    return '0';
  }
}
