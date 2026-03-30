// Base Mainnet
export const BASE_CHAIN_ID = 8453;
export const BASE_CHAIN_ID_HEX = '0x2105';
export const TOKEN_ADDRESS = '0x21F2D807421e456be5b4BFcC30E5278049eC8b07';
export const STAKING_ADDRESS = '0xC7851342DAA6bb06c805AFE4a0781F5119596B8F';
export const RPC_URL = 'https://base-mainnet.core.chainstack.com/1f396980c6a698065bdf9bbebbb7fd78';

// Minimal ERC-20 ABI for balance + transfer
export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

/** Switch MetaMask/Coinbase Wallet to Base Sepolia testnet */
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
            rpcUrls: ['https://mainnet.base.org'],
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

/** Get $SIZE token balance for a wallet address */
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
