const hre = require("hardhat");

const TOKEN = "0x21F2D807421e456be5b4BFcC30E5278049eC8b07";
const PROTOCOL = "0xa1113D1a049Fcc81bf9B93d8f8175F4e031eaBad";
const GAS_WALLET = "0xd5bbfc98f467a1304736e48c407175c0d8e5736c";
const FEE_BOT = "0xa8d00375c8b8accef44352d45ca1f65422624557";
const REWARDS_BOT = "0x2466b3f0e3891db3380b335b7d0a132dea0360d9";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
async function send(tx: any) { const r = await tx.wait(); await sleep(3000); return r; }

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  let n = await ethers.provider.getTransactionCount(deployer.address, "latest");

  console.log("═══════════════════════════════════════════");
  console.log("  SIZE. — BASE MAINNET DEPLOYMENT");
  console.log("═══════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log("Nonce:", n);
  console.log("ETH:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("Token:", TOKEN, "\n");

  // 1. SizeStaking
  console.log("1/4 Deploying SizeStaking...");
  const Staking = await ethers.getContractFactory("SizeStaking");
  const staking = await Staking.deploy(TOKEN, { nonce: n++ });
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("  SizeStaking:", stakingAddr);
  await sleep(3000);
  await send(await staking.setDepositor(FEE_BOT, true, { nonce: n++ }));
  console.log("  Fee collector authorized");

  // 2. SizeRewards
  console.log("2/4 Deploying SizeRewards...");
  const Rewards = await ethers.getContractFactory("SizeRewards");
  const rewards = await Rewards.deploy(TOKEN, PROTOCOL, GAS_WALLET, { nonce: n++ });
  await rewards.waitForDeployment();
  const rewardsAddr = await rewards.getAddress();
  console.log("  SizeRewards:", rewardsAddr);
  await sleep(3000);
  await send(await rewards.setDistributor(FEE_BOT, true, { nonce: n++ }));
  await send(await rewards.setDistributor(REWARDS_BOT, true, { nonce: n++ }));
  console.log("  Bots authorized");

  // 3. SizeDickCoinFactory
  console.log("3/4 Deploying SizeDickCoinFactory...");
  const Factory = await ethers.getContractFactory("SizeDickCoinFactory");
  const factory = await Factory.deploy(PROTOCOL, GAS_WALLET, { nonce: n++ });
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("  SizeDickCoinFactory:", factoryAddr);
  await sleep(3000);

  // 4. SizeGifting
  console.log("4/4 Deploying SizeGifting...");
  const Gifting = await ethers.getContractFactory("SizeGifting");
  const gifting = await Gifting.deploy(TOKEN, { nonce: n++ });
  await gifting.waitForDeployment();
  const giftingAddr = await gifting.getAddress();
  console.log("  SizeGifting:", giftingAddr);

  console.log("\n═══════════════════════════════════════════");
  console.log("  ALL CONTRACTS DEPLOYED — BASE MAINNET");
  console.log("═══════════════════════════════════════════");
  console.log("  $SIZE Token:          ", TOKEN);
  console.log("  SizeStaking:          ", stakingAddr);
  console.log("  SizeRewards:          ", rewardsAddr);
  console.log("  SizeDickCoinFactory:  ", factoryAddr);
  console.log("  SizeGifting:          ", giftingAddr);
  console.log("═══════════════════════════════════════════");
  console.log("  ETH remaining:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
