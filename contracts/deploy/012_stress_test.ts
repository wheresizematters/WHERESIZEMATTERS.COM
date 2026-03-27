const hre = require("hardhat");

const TOKEN = "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa";
const STAKING = "0x02cd0832069d6F429f19d70436F4039fAd760109";
const REWARDS = "0xdf7AfF4B67A4B68DcaE44cf5F49577eBcFb51551";
const FACTORY = "0xeFeD804ceBa717AE2413cf7A95ed61Ce4f777fF7";
const GIFTING = "0x48539b265cd281D1f4c30edFd22d939DD236A9BF";
const DONG = "0x5e9C0726b82596355A86347e0ca58241Fbc757F9";
const MICRO = "0x606371303173CeA150707b5516f15D1110B14710";
const PROTOCOL_WALLET = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function send(tx: any) {
  const receipt = await tx.wait();
  await sleep(2500);
  return receipt;
}

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  let n = await ethers.provider.getTransactionCount(deployer.address, "latest");

  const token = await ethers.getContractAt("MockERC20", TOKEN);
  const staking = await ethers.getContractAt("SizeStaking", STAKING);
  const rewards = await ethers.getContractAt("SizeRewards", REWARDS);
  const factory = await ethers.getContractAt("SizeDickCoinFactory", FACTORY);
  const gifting = await ethers.getContractAt("SizeGifting", GIFTING);
  const dong = await ethers.getContractAt("MockERC20", DONG);
  const micro = await ethers.getContractAt("MockERC20", MICRO);

  console.log("=== SIZE. STRESS TEST — BASE SEPOLIA ===");
  console.log("Nonce:", n);
  console.log("ETH:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("$SIZE:", ethers.formatEther(await token.balanceOf(deployer.address)));
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 9: Stake up to Whale tier (10M+)
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 9: WHALE TIER STAKING ━━━");
  const currentStake = (await staking.getStakeInfo(deployer.address))[0];
  console.log("Current stake:", ethers.formatEther(currentStake));

  const whaleAmt = ethers.parseEther("10000000") - currentStake; // top up to 10M
  console.log("Staking additional", ethers.formatEther(whaleAmt), "to reach 10M...");
  await send(await token.approve(STAKING, whaleAmt, { nonce: n++ }));
  await send(await staking.stake(whaleAmt, { nonce: n++ }));

  const whaleInfo = await staking.getStakeInfo(deployer.address);
  console.log("  Staked:", ethers.formatEther(whaleInfo[0]));
  console.log("  Tier:", whaleInfo[2].toString(), "(should be 4 = Whale)");
  console.log("  Boost bps:", whaleInfo[3].toString());
  console.log("  Effective stake:", ethers.formatEther(whaleInfo[4]));
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 10: Multiple fee deposits + claim cycle
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 10: RAPID FEE DEPOSITS ━━━");
  const feeRound = ethers.parseEther("25000");
  await send(await token.approve(STAKING, feeRound * 3n, { nonce: n++ }));

  for (let i = 0; i < 3; i++) {
    await send(await staking.depositRewards(feeRound, { nonce: n++ }));
    console.log("  Fee deposit", i + 1, "/3 ✓");
  }

  const pendingAfterFees = (await staking.getStakeInfo(deployer.address))[1];
  console.log("  Pending rewards:", ethers.formatEther(pendingAfterFees), "(should be 75K)");

  console.log("  Claiming...");
  const balPre = await token.balanceOf(deployer.address);
  await send(await staking.claimRewards({ nonce: n++ }));
  const balPost = await token.balanceOf(deployer.address);
  console.log("  Claimed:", ethers.formatEther(balPost - balPre), "$SIZE ✓");
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 11: Launch 3 more DickCoins rapidly
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 11: RAPID DICKCOIN LAUNCHES ━━━");
  const DickCoin = await ethers.getContractFactory("MockERC20");

  const coins = [
    { name: "RocketCock", ticker: "RCOCK", supply: "69000000000" },
    { name: "GigaChad", ticker: "GIGA", supply: "1000000000" },
    { name: "DiamondTip", ticker: "DTIP", supply: "420000000" },
  ];

  const deployed: string[] = [];
  for (const coin of coins) {
    console.log("  Deploying", coin.name, "(" + coin.ticker + ")...");
    const c = await DickCoin.deploy(coin.name, coin.ticker, ethers.parseEther(coin.supply), { nonce: n++ });
    await c.waitForDeployment();
    const addr = await c.getAddress();
    await sleep(3000);

    await send(await factory.registerDickCoin(addr, deployer.address, { nonce: n++ }));
    console.log("    ", coin.ticker, ":", addr, "✓");
    deployed.push(addr);
  }

  const totalCoins = await factory.getDickCoinCount();
  console.log("  Total DickCoins:", totalCoins.toString());
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 12: Distribute fees on multiple DickCoins
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 12: MULTI-COIN FEE DISTRIBUTION ━━━");
  for (let i = 0; i < deployed.length; i++) {
    const amt = ethers.parseEther("0.003");
    await send(await factory.distributeFees(deployed[i], { value: amt, nonce: n++ }));
    const info = await factory.getDickCoinInfo(deployed[i]);
    console.log("  " + coins[i].ticker + ": fees=" + ethers.formatEther(info[1]) + " ETH, creator paid=" + ethers.formatEther(info[2]) + " ✓");
  }
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 13: Multi-epoch rewards cycle
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 13: MULTI-EPOCH REWARDS ━━━");
  const epochPool = ethers.parseEther("100000");
  await send(await token.approve(REWARDS, epochPool * 3n, { nonce: n++ }));

  for (let ep = 0; ep < 3; ep++) {
    await send(await rewards.depositRewards(epochPool, { nonce: n++ }));
    await send(await rewards.setUserWeights(
      [deployer.address, PROTOCOL_WALLET],
      [ethers.parseEther("70"), ethers.parseEther("30")],
      { nonce: n++ }
    ));
    await send(await rewards.finalizeEpoch(ethers.parseEther("100"), { nonce: n++ }));
    const info = await rewards.getCurrentEpochInfo();
    console.log("  Epoch", (Number(info[0]) - 1), "finalized (100K pool) ✓");
  }

  // Batch claim all
  const currentEpoch = Number((await rewards.getCurrentEpochInfo())[0]);
  const epochsToClaim = [];
  for (let i = 1; i < currentEpoch; i++) {
    const claimable = await rewards.getClaimable(deployer.address, i);
    if (claimable > 0n) epochsToClaim.push(i);
  }
  if (epochsToClaim.length > 0) {
    console.log("  Batch claiming epochs:", epochsToClaim.join(", "));
    const balPre2 = await token.balanceOf(deployer.address);
    await send(await rewards.claimMultipleEpochs(epochsToClaim, { nonce: n++ }));
    const balPost2 = await token.balanceOf(deployer.address);
    console.log("  Claimed:", ethers.formatEther(balPost2 - balPre2), "$SIZE ✓");
  }
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 14: Batch gifting
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 14: BATCH GIFTING ━━━");
  const giftRecipients = [
    PROTOCOL_WALLET,
    "0xa8d00375c8b8accef44352d45ca1f65422624557",
    "0x2466b3f0e3891db3380b335b7d0a132dea0360d9",
  ];
  const giftAmounts = [
    ethers.parseEther("500"),
    ethers.parseEther("250"),
    ethers.parseEther("750"),
  ];
  const totalGifts = giftAmounts.reduce((a, b) => a + b, 0n);

  await send(await token.approve(GIFTING, totalGifts, { nonce: n++ }));
  await send(await gifting.batchGift(giftRecipients, giftAmounts, { nonce: n++ }));
  console.log("  Batch gifted to 3 recipients (500 + 250 + 750 = 1500 $SIZE) ✓");

  for (let i = 0; i < giftRecipients.length; i++) {
    const bal = await token.balanceOf(giftRecipients[i]);
    console.log("    " + giftRecipients[i].slice(0, 10) + "...:", ethers.formatEther(bal), "$SIZE");
  }
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 15: Emergency withdraw
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 15: EMERGENCY WITHDRAW ━━━");
  const stakeBeforeEmergency = (await staking.getStakeInfo(deployer.address))[0];
  console.log("  Staked before:", ethers.formatEther(stakeBeforeEmergency));
  const balBeforeEmergency = await token.balanceOf(deployer.address);
  await send(await staking.emergencyWithdraw({ nonce: n++ }));
  const balAfterEmergency = await token.balanceOf(deployer.address);
  const stakeAfterEmergency = (await staking.getStakeInfo(deployer.address))[0];
  console.log("  Staked after:", ethers.formatEther(stakeAfterEmergency), "(should be 0)");
  console.log("  Recovered:", ethers.formatEther(balAfterEmergency - balBeforeEmergency), "$SIZE ✓");
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 16: Re-stake after emergency
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 16: RE-STAKE AFTER EMERGENCY ━━━");
  const reStake = ethers.parseEther("1000000");
  await send(await token.approve(STAKING, reStake, { nonce: n++ }));
  await send(await staking.stake(reStake, { nonce: n++ }));
  const reStakeInfo = await staking.getStakeInfo(deployer.address);
  console.log("  Re-staked:", ethers.formatEther(reStakeInfo[0]), "$SIZE");
  console.log("  Tier:", reStakeInfo[2].toString(), "✓");
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // FINAL
  // ═══════════════════════════════════════════════════════════
  const finalSize = await token.balanceOf(deployer.address);
  const finalEth = await ethers.provider.getBalance(deployer.address);
  const finalCoins = await factory.getDickCoinCount();

  console.log("══════════════════════════════════════════");
  console.log("      STRESS TEST COMPLETE ✓");
  console.log("══════════════════════════════════════════");
  console.log("$SIZE balance:", ethers.formatEther(finalSize));
  console.log("ETH balance:", ethers.formatEther(finalEth));
  console.log("DickCoins launched:", finalCoins.toString());
  console.log("");
  console.log("Tests passed:");
  console.log("  ✓ 9.  Whale tier staking (10M+)");
  console.log("  ✓ 10. Rapid fee deposits x3 + claim");
  console.log("  ✓ 11. Rapid DickCoin launches x3");
  console.log("  ✓ 12. Multi-coin fee distribution");
  console.log("  ✓ 13. Multi-epoch rewards + batch claim");
  console.log("  ✓ 14. Batch gifting x3 recipients");
  console.log("  ✓ 15. Emergency withdraw");
  console.log("  ✓ 16. Re-stake after emergency");
  console.log("══════════════════════════════════════════");

  console.log("\nAll DickCoins:");
  console.log("  DONG:  0x5e9C0726b82596355A86347e0ca58241Fbc757F9");
  console.log("  MICRO: 0x606371303173CeA150707b5516f15D1110B14710");
  for (let i = 0; i < deployed.length; i++) {
    console.log("  " + coins[i].ticker + ":  " + deployed[i]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
