const hre = require("hardhat");

// Already deployed
const TEST_TOKEN = "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa";
const STAKING = "0x02cd0832069d6F429f19d70436F4039fAd760109";

const PROTOCOL = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";
const GAS_WALLET = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";
const FEE_BOT = "0xa8d00375c8b8accef44352d45ca1f65422624557";
const REWARDS_BOT = "0x2466b3f0e3891db3380b335b7d0a132dea0360d9";

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Setup staking permissions
  console.log("Setting up SizeStaking permissions...");
  const staking = await ethers.getContractAt("SizeStaking", STAKING);
  try {
    const tx = await staking.setDepositor(FEE_BOT, true);
    await tx.wait();
    console.log("  Fee collector authorized on staking");
  } catch(e) { console.log("  Staking setup failed:", e.message?.slice(0, 80)); }

  // 3. SizeRewards
  console.log("\nDeploying SizeRewards...");
  const Rewards = await ethers.getContractFactory("SizeRewards");
  const rewards = await Rewards.deploy(TEST_TOKEN, PROTOCOL, GAS_WALLET);
  await rewards.waitForDeployment();
  const rewardsAddr = await rewards.getAddress();
  console.log("  SizeRewards:", rewardsAddr);
  try {
    await (await rewards.setDistributor(FEE_BOT, true)).wait();
    await (await rewards.setDistributor(REWARDS_BOT, true)).wait();
    console.log("  Bots authorized");
  } catch(e) { console.log("  Rewards setup failed:", e.message?.slice(0, 80)); }

  // 4. SizeDickCoinFactory
  console.log("\nDeploying SizeDickCoinFactory...");
  const Factory = await ethers.getContractFactory("SizeDickCoinFactory");
  const factory = await Factory.deploy(PROTOCOL, GAS_WALLET);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("  SizeDickCoinFactory:", factoryAddr);

  // 5. SizeGifting
  console.log("\nDeploying SizeGifting...");
  const Gifting = await ethers.getContractFactory("SizeGifting");
  const gifting = await Gifting.deploy(TEST_TOKEN);
  await gifting.waitForDeployment();
  const giftingAddr = await gifting.getAddress();
  console.log("  SizeGifting:", giftingAddr);

  console.log("\n========================================");
  console.log("ALL CONTRACTS ON BASE MAINNET");
  console.log("========================================");
  console.log("TEST Token:          ", TEST_TOKEN);
  console.log("SizeStaking:         ", STAKING);
  console.log("SizeRewards:         ", rewardsAddr);
  console.log("SizeDickCoinFactory: ", factoryAddr);
  console.log("SizeGifting:         ", giftingAddr);
  console.log("========================================");
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Balance after:", ethers.formatEther(bal), "ETH");
}

main().catch(console.error);
