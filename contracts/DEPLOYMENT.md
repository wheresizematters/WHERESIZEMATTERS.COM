# SIZE. Contract Deployment Guide

## Contracts (deploy in this order)

### 1. SizeStaking.sol
- **Purpose:** Tier-based staking (Grower/Shower/Shlong/Whale)
- **Constructor:** `(address _sizeToken)`
- **Deploy after:** $SIZE token is live on Clanker
- **Admin setup:** Call `setDepositor(feeCollectorWallet, true)`

### 2. SizeRewards.sol
- **Purpose:** Proportional daily reward distribution
- **Constructor:** `(address _sizeToken, address _protocolWallet, address _gasWallet)`
- **Admin setup:** Call `setDistributor(backendBot, true)`
- **Daily operation:** Backend computes user weights → `setUserWeights()` → `finalizeEpoch()`

### 3. SizeDickCoinFactory.sol
- **Purpose:** Fee splitting for DickCoin trades (90% creator / 8% protocol / 2% gas)
- **Constructor:** `(address _protocolWallet, address _gasWallet)`
- **Admin setup:** Register DickCoins as they launch via `registerDickCoin()`

### 4. SizeGifting.sol
- **Purpose:** $SIZE token gifting between users + post tipping
- **Constructor:** `(address _sizeToken)`
- **No admin needed** — permissionless

## Wallet Addresses (Base Mainnet)

| Wallet | Address | Purpose |
|--------|---------|---------|
| **Deployer** | `0xa1113d1a049fcc81bf9b93d8f8175f4e031eabad` | Deploys contracts |
| **Protocol Treasury** | `0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0` | Team revenue — 25% $SIZE fees + 8% DickCoin fees |
| **Gas Wallet** | `0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0` | Subsidizes user txns — 2% DickCoin fees |
| **Fee Collector Bot** | `0xa8d00375c8b8accef44352d45ca1f65422624557` | Claims LP fees daily, deposits to contracts |
| **Rewards Bot** | `0x2466b3f0e3891db3380b335b7d0a132dea0360d9` | Sets user weights, finalizes daily epochs |

## Reward Weight System

Each user action earns a proportional weight of the daily pool:

| Action | Weight (bps of pool) | Daily Cap |
|--------|---------------------|-----------|
| Verify | 10 bps (0.001%) | 1 per lifetime |
| Refer | 8 bps (0.0008%) | 5 per day |
| Upvote received | 5 bps (0.0005%) | 50 per day |
| Post | 3 bps (0.0003%) | 5 per day |
| Login | 1 bp (0.0001%) | 1 per day |
| Message | 1 bp (0.0001%) | 10 per day |

**Daily flow:**
1. Fee collector claims LP fees from Clanker (daily cron)
2. 75% of fees deposited to SizeRewards as $SIZE
3. Backend computes each user's total weight from DynamoDB activity logs
4. Backend calls `setUserWeights()` on-chain
5. Backend calls `finalizeEpoch()` — locks in the distribution
6. Users can claim anytime (gas paid by gas wallet)

## Fee Architecture

```
$SIZE trades → Uniswap V4 LP fees
  ├── 75% → SizeRewards.sol → proportional to stakers + active users
  └── 25% → Protocol wallet (ETH)

DickCoin trades → Clanker LP fees
  ├── 90% → DickCoin creator
  ├── 8%  → Protocol wallet
  └── 2%  → Gas wallet
```

## Environment Variables for Backend

```
DEPLOYER_PRIVATE_KEY=         # contract deployer
FEE_COLLECTOR_PRIVATE_KEY=    # claims LP fees
BACKEND_BOT_PRIVATE_KEY=      # sets weights, finalizes epochs
SIZE_TOKEN_ADDRESS=           # from Clanker launch
STAKING_CONTRACT_ADDRESS=     # after deploy
REWARDS_CONTRACT_ADDRESS=     # after deploy
FACTORY_CONTRACT_ADDRESS=     # after deploy
GIFTING_CONTRACT_ADDRESS=     # after deploy
PROTOCOL_WALLET=              # team multisig
GAS_WALLET=                   # gas subsidy wallet
```

## Hardhat Deploy Commands

```bash
cd contracts
npm install

# Deploy to Base Sepolia (testnet)
SIZE_TOKEN_ADDRESS=0x... npx hardhat run deploy/001_deploy_staking.ts --network baseSepolia

# Deploy to Base mainnet
SIZE_TOKEN_ADDRESS=0x... npx hardhat run deploy/001_deploy_staking.ts --network base

# Verify on Basescan
npx hardhat verify --network base CONTRACT_ADDRESS CONSTRUCTOR_ARGS
```
