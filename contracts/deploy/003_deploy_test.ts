const hre = require("hardhat");

const PROTOCOL = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";
const GAS_WALLET = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";
const FEE_BOT = "0xa8d00375c8b8accef44352d45ca1f65422624557";
const REWARDS_BOT = "0x2466b3f0e3891db3380b335b7d0a132dea0360d9";

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // 1. TEST token
  console.log("1/5 Deploying TEST token...");
  const Token = await ethers.getContractFactory("MockERC20");
  const token = await Token.deploy("TEST", "TEST", ethers.parseEther("100000000000"));
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("  TEST:", tokenAddr);

  // 2. SizeStaking
  console.log("2/5 Deploying SizeStaking...");
  const Staking = await ethers.getContractFactory("SizeStaking");
  const staking = await Staking.deploy(tokenAddr);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("  SizeStaking:", stakingAddr);
  await (await staking.setDepositor(FEE_BOT, true)).wait();
  console.log("  Fee collector authorized");

  // 3. SizeRewards
  console.log("3/5 Deploying SizeRewards...");
  const Rewards = await ethers.getContractFactory("SizeRewards");
  const rewards = await Rewards.deploy(tokenAddr, PROTOCOL, GAS_WALLET);
  await rewards.waitForDeployment();
  const rewardsAddr = await rewards.getAddress();
  console.log("  SizeRewards:", rewardsAddr);
  await (await rewards.setDistributor(FEE_BOT, true)).wait();
  await (await rewards.setDistributor(REWARDS_BOT, true)).wait();
  console.log("  Bots authorized");

  // 4. SizeDickCoinFactory
  console.log("4/5 Deploying SizeDickCoinFactory...");
  const Factory = await ethers.getContractFactory("SizeDickCoinFactory");
  const factory = await Factory.deploy(PROTOCOL, GAS_WALLET);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("  SizeDickCoinFactory:", factoryAddr);

  // 5. SizeGifting
  console.log("5/5 Deploying SizeGifting...");
  const Gifting = await ethers.getContractFactory("SizeGifting");
  const gifting = await Gifting.deploy(tokenAddr);
  await gifting.waitForDeployment();
  const giftingAddr = await gifting.getAddress();
  console.log("  SizeGifting:", giftingAddr);

  console.log("\n========================================");
  console.log("ALL 5 CONTRACTS DEPLOYED ON BASE");
  console.log("========================================");
  console.log("TEST Token:          ", tokenAddr);
  console.log("SizeStaking:         ", stakingAddr);
  console.log("SizeRewards:         ", rewardsAddr);
  console.log("SizeDickCoinFactory: ", factoryAddr);
  console.log("SizeGifting:         ", giftingAddr);
  console.log("========================================");
  const balAfter = await ethers.provider.getBalance(deployer.address);
  console.log("Balance after:", ethers.formatEther(balAfter), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
