import { ethers } from "hardhat";

// Wallet addresses — DO NOT CHANGE without updating all contracts
const ADDRESSES = {
  protocolTreasury: "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0",
  gasWallet: "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0",
  feeCollectorBot: "0xa8d00375c8b8accef44352d45ca1f65422624557",
  rewardsBot: "0x2466b3f0e3891db3380b335b7d0a132dea0360d9",
};

async function main() {
  const SIZE_TOKEN = process.env.SIZE_TOKEN_ADDRESS;
  if (!SIZE_TOKEN) throw new Error("Set SIZE_TOKEN_ADDRESS env var");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Token:", SIZE_TOKEN);
  console.log("");

  // 1. SizeStaking
  console.log("Deploying SizeStaking...");
  const Staking = await ethers.getContractFactory("SizeStaking");
  const staking = await Staking.deploy(SIZE_TOKEN);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("  SizeStaking:", stakingAddr);

  // Setup: add fee collector as depositor
  await staking.setDepositor(ADDRESSES.feeCollectorBot, true);
  console.log("  Fee collector authorized as depositor");

  // 2. SizeRewards
  console.log("\nDeploying SizeRewards...");
  const Rewards = await ethers.getContractFactory("SizeRewards");
  const rewards = await Rewards.deploy(SIZE_TOKEN, ADDRESSES.protocolTreasury, ADDRESSES.gasWallet);
  await rewards.waitForDeployment();
  const rewardsAddr = await rewards.getAddress();
  console.log("  SizeRewards:", rewardsAddr);

  // Setup: add bots as distributors
  await rewards.setDistributor(ADDRESSES.feeCollectorBot, true);
  await rewards.setDistributor(ADDRESSES.rewardsBot, true);
  console.log("  Fee collector + rewards bot authorized as distributors");

  // 3. SizeDickCoinFactory
  console.log("\nDeploying SizeDickCoinFactory...");
  const Factory = await ethers.getContractFactory("SizeDickCoinFactory");
  const factory = await Factory.deploy(ADDRESSES.protocolTreasury, ADDRESSES.gasWallet);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("  SizeDickCoinFactory:", factoryAddr);

  // 4. SizeGifting
  console.log("\nDeploying SizeGifting...");
  const Gifting = await ethers.getContractFactory("SizeGifting");
  const gifting = await Gifting.deploy(SIZE_TOKEN);
  await gifting.waitForDeployment();
  const giftingAddr = await gifting.getAddress();
  console.log("  SizeGifting:", giftingAddr);

  // Summary
  console.log("\n========================================");
  console.log("ALL CONTRACTS DEPLOYED");
  console.log("========================================");
  console.log("SizeStaking:         ", stakingAddr);
  console.log("SizeRewards:         ", rewardsAddr);
  console.log("SizeDickCoinFactory: ", factoryAddr);
  console.log("SizeGifting:         ", giftingAddr);
  console.log("========================================");
  console.log("\nVerify commands:");
  console.log(`npx hardhat verify --network base ${stakingAddr} ${SIZE_TOKEN}`);
  console.log(`npx hardhat verify --network base ${rewardsAddr} ${SIZE_TOKEN} ${ADDRESSES.protocolTreasury} ${ADDRESSES.gasWallet}`);
  console.log(`npx hardhat verify --network base ${factoryAddr} ${ADDRESSES.protocolTreasury} ${ADDRESSES.gasWallet}`);
  console.log(`npx hardhat verify --network base ${giftingAddr} ${SIZE_TOKEN}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
