const hre = require("hardhat");

const TOKEN = "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa";
const PROTOCOL = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";
const GAS_WALLET = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";
const FEE_BOT = "0xa8d00375c8b8accef44352d45ca1f65422624557";
const REWARDS_BOT = "0x2466b3f0e3891db3380b335b7d0a132dea0360d9";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
async function send(tx: any) { const r = await tx.wait(); await sleep(2500); return r; }

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  let n = await ethers.provider.getTransactionCount(deployer.address, "latest");

  console.log("=== DEPLOY ALL v2 CONTRACTS — BASE SEPOLIA ===");
  console.log("Deployer:", deployer.address);
  console.log("Nonce:", n);
  console.log("ETH:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "\n");

  // 1. SizeStaking
  console.log("1/4 SizeStaking...");
  const Staking = await ethers.getContractFactory("SizeStaking");
  const staking = await Staking.deploy(TOKEN, { nonce: n++ });
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("  ", stakingAddr);
  await sleep(3000);
  await send(await staking.setDepositor(FEE_BOT, true, { nonce: n++ }));

  // 2. SizeRewards
  console.log("2/4 SizeRewards...");
  const Rewards = await ethers.getContractFactory("SizeRewards");
  const rewards = await Rewards.deploy(TOKEN, PROTOCOL, GAS_WALLET, { nonce: n++ });
  await rewards.waitForDeployment();
  const rewardsAddr = await rewards.getAddress();
  console.log("  ", rewardsAddr);
  await sleep(3000);
  await send(await rewards.setDistributor(FEE_BOT, true, { nonce: n++ }));
  await send(await rewards.setDistributor(REWARDS_BOT, true, { nonce: n++ }));

  // 3. SizeDickCoinFactory
  console.log("3/4 SizeDickCoinFactory...");
  const Factory = await ethers.getContractFactory("SizeDickCoinFactory");
  const factory = await Factory.deploy(PROTOCOL, GAS_WALLET, { nonce: n++ });
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("  ", factoryAddr);
  await sleep(3000);

  // 4. SizeGifting
  console.log("4/4 SizeGifting...");
  const Gifting = await ethers.getContractFactory("SizeGifting");
  const gifting = await Gifting.deploy(TOKEN, { nonce: n++ });
  await gifting.waitForDeployment();
  const giftingAddr = await gifting.getAddress();
  console.log("  ", giftingAddr);
  await sleep(3000);

  // Quick smoke test
  console.log("\n━━━ SMOKE TEST ━━━");
  const token = await ethers.getContractAt("MockERC20", TOKEN);

  // Stake 1M
  await send(await token.approve(stakingAddr, ethers.parseEther("1000000"), { nonce: n++ }));
  await send(await staking.stake(ethers.parseEther("1000000"), { nonce: n++ }));
  const info = await staking.getStakeInfo(deployer.address);
  console.log("  Staked 1M, tier:", info[2].toString(), "✓");

  // Deposit fees
  await send(await token.approve(stakingAddr, ethers.parseEther("5000"), { nonce: n++ }));
  await send(await staking.depositRewards(ethers.parseEther("5000"), { nonce: n++ }));
  const info2 = await staking.getStakeInfo(deployer.address);
  console.log("  Deposited 5K fees, pending:", ethers.formatEther(info2[1]), "✓");

  // Claim
  await send(await staking.claimRewards({ nonce: n++ }));
  console.log("  Claimed rewards ✓");

  // Gift
  await send(await token.approve(giftingAddr, ethers.parseEther("100"), { nonce: n++ }));
  await send(await gifting.gift(PROTOCOL, ethers.parseEther("100"), ethers.ZeroHash, "test", { nonce: n++ }));
  console.log("  Gift 100 ✓");

  // DickCoin register + fee distribute
  const DC = await ethers.getContractFactory("MockERC20");
  const dc = await DC.deploy("TestCoin", "TEST", ethers.parseEther("1000000"), { nonce: n++ });
  await dc.waitForDeployment();
  const dcAddr = await dc.getAddress();
  await sleep(3000);
  await send(await factory.registerDickCoin(dcAddr, deployer.address, { nonce: n++ }));
  await send(await factory.distributeFees(dcAddr, { value: ethers.parseEther("0.005"), nonce: n++ }));
  const dcInfo = await factory.getDickCoinInfo(dcAddr);
  console.log("  DickCoin registered + fees split:", ethers.formatEther(dcInfo[1]), "ETH ✓");

  // Rewards epoch
  await send(await token.approve(rewardsAddr, ethers.parseEther("10000"), { nonce: n++ }));
  await send(await rewards.depositRewards(ethers.parseEther("10000"), { nonce: n++ }));
  await send(await rewards.setUserWeights([deployer.address], [ethers.parseEther("100")], { nonce: n++ }));
  await send(await rewards.finalizeEpoch(ethers.parseEther("100"), { nonce: n++ }));
  await send(await rewards.claimRewards(0, { nonce: n++ }));
  console.log("  Rewards epoch 0 finalized + claimed ✓");

  // Unstake (test penalty)
  const preview = await staking.previewUnstake(deployer.address, ethers.parseEther("500000"));
  console.log("  Unstake preview: receive", ethers.formatEther(preview[0]), "penalty", ethers.formatEther(preview[1]), "✓");

  console.log("\n══════════════════════════════════════════");
  console.log("  ALL v2 CONTRACTS DEPLOYED & VERIFIED");
  console.log("══════════════════════════════════════════");
  console.log("  SizeStaking:         ", stakingAddr);
  console.log("  SizeRewards:         ", rewardsAddr);
  console.log("  SizeDickCoinFactory: ", factoryAddr);
  console.log("  SizeGifting:         ", giftingAddr);
  console.log("  Mock $SIZE:          ", TOKEN);
  console.log("══════════════════════════════════════════");
  console.log("  ETH remaining:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
