const hre = require("hardhat");

const PROTOCOL = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";
const GAS_WALLET = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";
const FEE_BOT = "0xa8d00375c8b8accef44352d45ca1f65422624557";
const REWARDS_BOT = "0x2466b3f0e3891db3380b335b7d0a132dea0360d9";
const TOKEN = "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  const nonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
  console.log("Deployer:", deployer.address);
  console.log("Current nonce:", nonce);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // SizeRewards
  console.log("1/3 Deploying SizeRewards...");
  const Rewards = await ethers.getContractFactory("SizeRewards");
  const rewards = await Rewards.deploy(TOKEN, PROTOCOL, GAS_WALLET, { nonce });
  await rewards.waitForDeployment();
  const rewardsAddr = await rewards.getAddress();
  console.log("  SizeRewards:", rewardsAddr);
  await sleep(3000);
  await (await rewards.setDistributor(FEE_BOT, true, { nonce: nonce + 1 })).wait();
  await sleep(2000);
  await (await rewards.setDistributor(REWARDS_BOT, true, { nonce: nonce + 2 })).wait();
  console.log("  Bots authorized");
  await sleep(3000);

  // SizeDickCoinFactory
  console.log("2/3 Deploying SizeDickCoinFactory...");
  const Factory = await ethers.getContractFactory("SizeDickCoinFactory");
  const factory = await Factory.deploy(PROTOCOL, GAS_WALLET, { nonce: nonce + 3 });
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("  SizeDickCoinFactory:", factoryAddr);
  await sleep(3000);

  // SizeGifting
  console.log("3/3 Deploying SizeGifting...");
  const Gifting = await ethers.getContractFactory("SizeGifting");
  const gifting = await Gifting.deploy(TOKEN, { nonce: nonce + 4 });
  await gifting.waitForDeployment();
  const giftingAddr = await gifting.getAddress();
  console.log("  SizeGifting:", giftingAddr);

  console.log("\n========================================");
  console.log("BASE SEPOLIA — ALL CONTRACTS");
  console.log("========================================");
  console.log("Mock $SIZE Token:    ", TOKEN);
  console.log("SizeStaking:         ", "0x02cd0832069d6F429f19d70436F4039fAd760109");
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
