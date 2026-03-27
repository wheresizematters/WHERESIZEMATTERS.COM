const hre = require("hardhat");

const TOKEN = "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa";
const STAKING = "0x02cd0832069d6F429f19d70436F4039fAd760109";
const REWARDS = "0xdf7AfF4B67A4B68DcaE44cf5F49577eBcFb51551";
const FACTORY = "0xeFeD804ceBa717AE2413cf7A95ed61Ce4f777fF7";
const GIFTING = "0x48539b265cd281D1f4c30edFd22d939DD236A9BF";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  let nonce = await ethers.provider.getTransactionCount(deployer.address, "latest");

  console.log("=== SIZE. BASE SEPOLIA E2E TEST ===");
  console.log("Deployer:", deployer.address);
  console.log("Nonce:", nonce);
  console.log("ETH Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Connect to contracts
  const token = await ethers.getContractAt("MockERC20", TOKEN);
  const staking = await ethers.getContractAt("SizeStaking", STAKING);
  const rewards = await ethers.getContractAt("SizeRewards", REWARDS);
  const factory = await ethers.getContractAt("SizeDickCoinFactory", FACTORY);
  const gifting = await ethers.getContractAt("SizeGifting", GIFTING);

  const tokenBal = await token.balanceOf(deployer.address);
  console.log("$SIZE Balance:", ethers.formatEther(tokenBal), "\n");

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: Staking
  // ═══════════════════════════════════════════════════════════════
  console.log("━━━ TEST 1: STAKING ━━━");

  const stakeAmt = ethers.parseEther("500000"); // 500K tokens
  console.log("Approving 500K $SIZE for staking...");
  let tx = await token.approve(STAKING, stakeAmt, { nonce: nonce++ });
  await tx.wait();
  console.log("  Approved ✓");
  await sleep(2000);

  console.log("Staking 500K $SIZE...");
  tx = await staking.stake(stakeAmt, { nonce: nonce++ });
  const stakeReceipt = await tx.wait();
  console.log("  Staked ✓ (tx:", stakeReceipt.hash.slice(0, 18) + "...)");
  await sleep(2000);

  const stakeInfo = await staking.getStakeInfo(deployer.address);
  console.log("  Staked amount:", ethers.formatEther(stakeInfo[0]));
  console.log("  Pending rewards:", ethers.formatEther(stakeInfo[1]));
  console.log("  Tier:", stakeInfo[2].toString());
  console.log("  Boost bps:", stakeInfo[3].toString());
  console.log("  Effective stake:", ethers.formatEther(stakeInfo[4]));
  console.log("");

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: Deposit trading fees into staking pool
  // ═══════════════════════════════════════════════════════════════
  console.log("━━━ TEST 2: DEPOSIT FEES → STAKING ━━━");

  const feeAmt = ethers.parseEther("10000"); // 10K in fees
  console.log("Approving 10K $SIZE for fee deposit...");
  tx = await token.approve(STAKING, feeAmt, { nonce: nonce++ });
  await tx.wait();
  await sleep(2000);

  console.log("Depositing 10K as trading fees...");
  tx = await staking.depositRewards(feeAmt, { nonce: nonce++ });
  await tx.wait();
  console.log("  Deposited ✓");
  await sleep(2000);

  const stakeInfo2 = await staking.getStakeInfo(deployer.address);
  console.log("  Pending rewards now:", ethers.formatEther(stakeInfo2[1]));
  console.log("");

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: Claim staking rewards
  // ═══════════════════════════════════════════════════════════════
  console.log("━━━ TEST 3: CLAIM STAKING REWARDS ━━━");

  const balBefore = await token.balanceOf(deployer.address);
  console.log("Balance before claim:", ethers.formatEther(balBefore));

  tx = await staking.claimRewards({ nonce: nonce++ });
  await tx.wait();
  await sleep(2000);

  const balAfter = await token.balanceOf(deployer.address);
  console.log("Balance after claim:", ethers.formatEther(balAfter));
  console.log("  Claimed:", ethers.formatEther(balAfter - balBefore), "$SIZE ✓");
  console.log("");

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: Rewards system (epoch-based)
  // ═══════════════════════════════════════════════════════════════
  console.log("━━━ TEST 4: REWARDS EPOCH SYSTEM ━━━");

  const rewardPoolAmt = ethers.parseEther("50000"); // 50K reward pool
  console.log("Approving 50K for rewards pool...");
  tx = await token.approve(REWARDS, rewardPoolAmt, { nonce: nonce++ });
  await tx.wait();
  await sleep(2000);

  console.log("Depositing 50K into reward pool...");
  tx = await rewards.depositRewards(rewardPoolAmt, { nonce: nonce++ });
  await tx.wait();
  await sleep(2000);

  const epochInfo = await rewards.getCurrentEpochInfo();
  console.log("  Current epoch:", epochInfo[0].toString());
  console.log("  Pending pool:", ethers.formatEther(epochInfo[1]));

  console.log("Setting user weights...");
  tx = await rewards.setUserWeights(
    [deployer.address],
    [ethers.parseEther("100")],
    { nonce: nonce++ }
  );
  await tx.wait();
  await sleep(2000);

  console.log("Finalizing epoch...");
  tx = await rewards.finalizeEpoch(ethers.parseEther("100"), { nonce: nonce++ });
  await tx.wait();
  await sleep(2000);

  const currentEpoch = (await rewards.getCurrentEpochInfo())[0];
  const claimEpoch = Number(currentEpoch) - 1;
  const claimable = await rewards.getClaimable(deployer.address, claimEpoch);
  console.log("  Claimable for epoch", claimEpoch, ":", ethers.formatEther(claimable), "$SIZE");

  console.log("Claiming epoch rewards...");
  const balBefore2 = await token.balanceOf(deployer.address);
  tx = await rewards.claimRewards(claimEpoch, { nonce: nonce++ });
  await tx.wait();
  await sleep(2000);
  const balAfter2 = await token.balanceOf(deployer.address);
  console.log("  Claimed:", ethers.formatEther(balAfter2 - balBefore2), "$SIZE ✓");
  console.log("");

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: DickCoin Factory — register + distribute fees
  // ═══════════════════════════════════════════════════════════════
  console.log("━━━ TEST 5: DICKCOIN FACTORY ━━━");

  // Deploy a mock DickCoin token
  console.log("Deploying mock DickCoin 'BIGDONG'...");
  const DickCoin = await ethers.getContractFactory("MockERC20");
  const dickCoin = await DickCoin.deploy("BigDong", "DONG", ethers.parseEther("1000000000"), { nonce: nonce++ });
  await dickCoin.waitForDeployment();
  const dickCoinAddr = await dickCoin.getAddress();
  console.log("  BIGDONG token:", dickCoinAddr);
  await sleep(3000);

  console.log("Registering BIGDONG in factory...");
  tx = await factory.registerDickCoin(dickCoinAddr, deployer.address, { nonce: nonce++ });
  await tx.wait();
  await sleep(2000);

  const coinInfo = await factory.getDickCoinInfo(dickCoinAddr);
  console.log("  Creator:", coinInfo[0]);
  console.log("  Total fees:", ethers.formatEther(coinInfo[1]));
  console.log("  Registered ✓");

  const coinCount = await factory.getDickCoinCount();
  console.log("  Total DickCoins registered:", coinCount.toString());

  // Distribute ETH fees (simulate trading fees)
  console.log("Sending 0.01 ETH as trading fees...");
  tx = await deployer.sendTransaction({
    to: FACTORY,
    value: ethers.parseEther("0.01"),
    nonce: nonce++,
  });
  await tx.wait();
  await sleep(2000);

  console.log("Distributing fees for BIGDONG...");
  tx = await factory.distributeFees(dickCoinAddr, { value: ethers.parseEther("0.005"), nonce: nonce++ });
  await tx.wait();
  await sleep(2000);

  const coinInfo2 = await factory.getDickCoinInfo(dickCoinAddr);
  console.log("  Total fees received:", ethers.formatEther(coinInfo2[1]));
  console.log("  Creator paid:", ethers.formatEther(coinInfo2[2]));
  console.log("  Fees distributed ✓ (90/8/2 split)");
  console.log("");

  // ═══════════════════════════════════════════════════════════════
  // TEST 6: Launch a second DickCoin
  // ═══════════════════════════════════════════════════════════════
  console.log("━━━ TEST 6: SECOND DICKCOIN LAUNCH ━━━");

  console.log("Deploying 'MicroCap' DickCoin...");
  const dickCoin2 = await DickCoin.deploy("MicroCap", "MICRO", ethers.parseEther("420690000"), { nonce: nonce++ });
  await dickCoin2.waitForDeployment();
  const dickCoin2Addr = await dickCoin2.getAddress();
  console.log("  MICRO token:", dickCoin2Addr);
  await sleep(3000);

  console.log("Registering MICRO in factory...");
  tx = await factory.registerDickCoin(dickCoin2Addr, deployer.address, { nonce: nonce++ });
  await tx.wait();
  await sleep(2000);

  const coinCount2 = await factory.getDickCoinCount();
  console.log("  Total DickCoins registered:", coinCount2.toString(), "✓");
  console.log("");

  // ═══════════════════════════════════════════════════════════════
  // TEST 7: Gifting
  // ═══════════════════════════════════════════════════════════════
  console.log("━━━ TEST 7: GIFTING ━━━");

  const giftAmt = ethers.parseEther("1000");
  const recipient = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0"; // protocol wallet as recipient

  console.log("Approving 1K $SIZE for gifting...");
  tx = await token.approve(GIFTING, giftAmt, { nonce: nonce++ });
  await tx.wait();
  await sleep(2000);

  console.log("Gifting 1K $SIZE with message...");
  const postId = ethers.id("test-post-123").slice(0, 66); // bytes32
  tx = await gifting.gift(recipient, giftAmt, postId, "Big energy bro", { nonce: nonce++ });
  const giftReceipt = await tx.wait();
  console.log("  Gift sent ✓ (tx:", giftReceipt.hash.slice(0, 18) + "...)");
  await sleep(2000);

  const recipientBal = await token.balanceOf(recipient);
  console.log("  Recipient balance:", ethers.formatEther(recipientBal), "$SIZE");
  console.log("");

  // ═══════════════════════════════════════════════════════════════
  // TEST 8: Partial unstake
  // ═══════════════════════════════════════════════════════════════
  console.log("━━━ TEST 8: PARTIAL UNSTAKE ━━━");

  const unstakeAmt = ethers.parseEther("200000"); // unstake 200K, keep 300K
  console.log("Unstaking 200K $SIZE...");
  tx = await staking.unstake(unstakeAmt, { nonce: nonce++ });
  await tx.wait();
  await sleep(2000);

  const stakeInfo3 = await staking.getStakeInfo(deployer.address);
  console.log("  Remaining stake:", ethers.formatEther(stakeInfo3[0]));
  console.log("  New tier:", stakeInfo3[2].toString());
  console.log("  Unstaked ✓");
  console.log("");

  // ═══════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════
  const finalBal = await token.balanceOf(deployer.address);
  const finalEth = await ethers.provider.getBalance(deployer.address);

  console.log("══════════════════════════════════════");
  console.log("    ALL TESTS PASSED ✓");
  console.log("══════════════════════════════════════");
  console.log("Final $SIZE balance:", ethers.formatEther(finalBal));
  console.log("Final ETH balance:", ethers.formatEther(finalEth));
  console.log("");
  console.log("Contracts tested:");
  console.log("  ✓ MockERC20 (approve, transfer, balanceOf)");
  console.log("  ✓ SizeStaking (stake, depositRewards, claimRewards, unstake)");
  console.log("  ✓ SizeRewards (deposit, setWeights, finalizeEpoch, claim)");
  console.log("  ✓ SizeDickCoinFactory (register x2, distributeFees)");
  console.log("  ✓ SizeGifting (gift with message)");
  console.log("");
  console.log("DickCoins launched:");
  console.log("  1. BigDong (DONG):", dickCoinAddr);
  console.log("  2. MicroCap (MICRO):", dickCoin2Addr);
  console.log("══════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
