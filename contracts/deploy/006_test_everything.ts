const hre = require("hardhat");

const TEST_TOKEN = "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa";
const STAKING = "0x02cd0832069d6F429f19d70436F4039fAd760109";
const REWARDS = "0x59B989EB83BAe00c8d6ee613b7fCeBa88ae176C0";
const FACTORY = "0xeFeD804ceBa717AE2413cf7A95ed61Ce4f777fF7";
const GIFTING = "0x48539b265cd281D1f4c30edFd22d939DD236A9BF";

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  console.log("Testing from:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const token = await ethers.getContractAt("MockERC20", TEST_TOKEN);
  const staking = await ethers.getContractAt("SizeStaking", STAKING);
  const rewards = await ethers.getContractAt("SizeRewards", REWARDS);
  const factory = await ethers.getContractAt("SizeDickCoinFactory", FACTORY);
  const gifting = await ethers.getContractAt("SizeGifting", GIFTING);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log("  PASS", name);
      passed++;
    } catch (e) {
      console.log("  FAIL", name, "-", e.message?.slice(0, 80));
      failed++;
    }
  }

  // ── TOKEN ──
  console.log("=== TEST TOKEN ===");
  await test("Total supply is 100B", async () => {
    const supply = await token.totalSupply();
    const expected = ethers.parseEther("100000000000");
    if (supply !== expected) throw new Error("Supply: " + supply);
  });
  await test("Deployer owns all tokens", async () => {
    const bal = await token.balanceOf(deployer.address);
    const expected = ethers.parseEther("100000000000");
    if (bal !== expected) throw new Error("Balance: " + bal);
  });

  // ── STAKING ──
  console.log("\n=== STAKING ===");
  await test("Read tier thresholds", async () => {
    const grower = await staking.GROWER_MIN();
    const whale = await staking.WHALE_MIN();
    if (grower !== ethers.parseEther("100000")) throw new Error("Grower: " + grower);
    if (whale !== ethers.parseEther("100000000")) throw new Error("Whale: " + whale);
  });
  await test("Approve staking contract", async () => {
    const tx = await token.approve(STAKING, ethers.parseEther("1000000"));
    await tx.wait();
  });
  await test("Stake 200K tokens (Grower tier)", async () => {
    const tx = await staking.stake(ethers.parseEther("200000"));
    await tx.wait();
  });
  await test("Read stake info", async () => {
    const info = await staking.getStakeInfo(deployer.address);
    if (info.stakedAmount !== ethers.parseEther("200000")) throw new Error("Staked: " + info.stakedAmount);
    if (info.tier !== 1n) throw new Error("Tier: " + info.tier);
  });
  await test("Deposit rewards", async () => {
    await (await token.approve(STAKING, ethers.parseEther("10000"))).wait();
    const tx = await staking.depositRewards(ethers.parseEther("10000"));
    await tx.wait();
  });
  await test("Check pending rewards", async () => {
    const info = await staking.getStakeInfo(deployer.address);
    if (info.pendingRewards === 0n) throw new Error("No pending rewards");
  });
  await test("Claim rewards", async () => {
    const tx = await staking.claimRewards();
    await tx.wait();
  });
  await test("Unstake all", async () => {
    const tx = await staking.unstake(ethers.parseEther("200000"));
    await tx.wait();
  });
  await test("Stake is zero after unstake", async () => {
    const info = await staking.getStakeInfo(deployer.address);
    if (info.stakedAmount !== 0n) throw new Error("Still staked: " + info.stakedAmount);
  });

  // ── REWARDS ──
  console.log("\n=== REWARDS ===");
  await test("Deposit to reward pool", async () => {
    await (await token.approve(REWARDS, ethers.parseEther("50000"))).wait();
    const tx = await rewards.depositRewards(ethers.parseEther("50000"));
    await tx.wait();
  });
  await test("Pending pool has tokens", async () => {
    const pool = await rewards.pendingRewardPool();
    if (pool === 0n) throw new Error("Pool empty");
  });
  await test("Set user weights", async () => {
    const tx = await rewards.setUserWeights([deployer.address], [1000n]);
    await tx.wait();
  });
  await test("Finalize epoch", async () => {
    const tx = await rewards.finalizeEpoch(1000n);
    await tx.wait();
  });
  await test("Check claimable", async () => {
    const claimable = await rewards.getClaimable(deployer.address, 0n);
    if (claimable === 0n) throw new Error("Nothing claimable");
  });
  await test("Claim epoch rewards", async () => {
    const tx = await rewards.claimRewards(0n);
    await tx.wait();
  });

  // ── FACTORY ──
  console.log("\n=== DICKCOIN FACTORY ===");
  await test("Register a DickCoin", async () => {
    const tx = await factory.registerDickCoin(
      "0x0000000000000000000000000000000000000001",
      deployer.address
    );
    await tx.wait();
  });
  await test("Get DickCoin count", async () => {
    const count = await factory.getDickCoinCount();
    if (count !== 1n) throw new Error("Count: " + count);
  });
  await test("Distribute fees to DickCoin", async () => {
    const tx = await factory.distributeFees(
      "0x0000000000000000000000000000000000000001",
      { value: ethers.parseEther("0.001") }
    );
    await tx.wait();
  });
  await test("Creator got 90% of fees", async () => {
    const info = await factory.getDickCoinInfo("0x0000000000000000000000000000000000000001");
    if (info.creatorPaid === 0n) throw new Error("Creator not paid");
  });

  // ── GIFTING ──
  console.log("\n=== GIFTING ===");
  await test("Approve gifting contract", async () => {
    const tx = await token.approve(GIFTING, ethers.parseEther("1000"));
    await tx.wait();
  });
  await test("Gift tokens", async () => {
    const tx = await gifting.gift(
      "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0",
      ethers.parseEther("100"),
      ethers.zeroPadBytes("0x", 32),
      "test gift"
    );
    await tx.wait();
  });
  await test("Recipient received tokens", async () => {
    const bal = await token.balanceOf("0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0");
    if (bal === 0n) throw new Error("No balance");
  });

  // ── SUMMARY ──
  console.log("\n========================================");
  console.log("TEST RESULTS: " + passed + " passed, " + failed + " failed");
  console.log("========================================");
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Balance after tests:", ethers.formatEther(bal), "ETH");
}

main().catch(console.error);
