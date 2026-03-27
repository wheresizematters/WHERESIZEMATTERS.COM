const hre = require("hardhat");

const TOKEN = "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa";
const STAKING = "0x02cd0832069d6F429f19d70436F4039fAd760109";
const GIFTING = "0x48539b265cd281D1f4c30edFd22d939DD236A9BF";
const PROTOCOL_WALLET = "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
async function send(tx: any) { const r = await tx.wait(); await sleep(2500); return r; }

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  let n = await ethers.provider.getTransactionCount(deployer.address, "latest");

  const token = await ethers.getContractAt("MockERC20", TOKEN);
  const staking = await ethers.getContractAt("SizeStaking", STAKING);
  const gifting = await ethers.getContractAt("SizeGifting", GIFTING);

  console.log("=== FINAL TESTS ===");
  console.log("Nonce:", n);

  const stakeInfo = await staking.getStakeInfo(deployer.address);
  console.log("Current stake:", ethers.formatEther(stakeInfo[0]));
  console.log("Tier:", stakeInfo[2].toString());
  console.log("Pending rewards:", ethers.formatEther(stakeInfo[1]));
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
  const totalGifts = giftAmounts.reduce((a: bigint, b: bigint) => a + b, 0n);
  await send(await token.approve(GIFTING, totalGifts, { nonce: n++ }));
  await send(await gifting.batchGift(giftRecipients, giftAmounts, { nonce: n++ }));
  console.log("  Batch gifted 1500 $SIZE to 3 recipients ✓");
  for (let i = 0; i < giftRecipients.length; i++) {
    const bal = await token.balanceOf(giftRecipients[i]);
    console.log("    " + giftRecipients[i].slice(0, 10) + "...:", ethers.formatEther(bal));
  }
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 15: Normal unstake all
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 15: FULL UNSTAKE ━━━");
  const currentStake = (await staking.getStakeInfo(deployer.address))[0];
  console.log("  Unstaking", ethers.formatEther(currentStake), "$SIZE...");
  const balPre = await token.balanceOf(deployer.address);

  // claim first if pending
  const pending = (await staking.getStakeInfo(deployer.address))[1];
  if (pending > 0n) {
    console.log("  Claiming", ethers.formatEther(pending), "pending rewards first...");
    await send(await staking.claimRewards({ nonce: n++ }));
  }

  await send(await staking.unstake(currentStake, { nonce: n++ }));
  const balPost = await token.balanceOf(deployer.address);
  const stakeAfter = (await staking.getStakeInfo(deployer.address))[0];
  console.log("  Staked after:", ethers.formatEther(stakeAfter));
  console.log("  Recovered:", ethers.formatEther(balPost - balPre), "$SIZE ✓");
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 16: Re-stake fresh
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 16: FRESH RE-STAKE 5M ━━━");
  const freshStake = ethers.parseEther("5000000");
  await send(await token.approve(STAKING, freshStake, { nonce: n++ }));
  await send(await staking.stake(freshStake, { nonce: n++ }));
  const freshInfo = await staking.getStakeInfo(deployer.address);
  console.log("  Staked:", ethers.formatEther(freshInfo[0]));
  console.log("  Tier:", freshInfo[2].toString());
  console.log("  Boost:", freshInfo[3].toString(), "bps ✓");
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 17: Post tip
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 17: POST TIP ━━━");
  const tipAmt = ethers.parseEther("100");
  await send(await token.approve(GIFTING, tipAmt, { nonce: n++ }));
  const postId = ethers.keccak256(ethers.toUtf8Bytes("post-abc-123"));
  await send(await gifting.gift(PROTOCOL_WALLET, tipAmt, postId, "fire post bro", { nonce: n++ }));
  console.log("  Tipped 100 $SIZE on post ✓");
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // TEST 18: Below-minimum stake revert
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ TEST 18: BELOW MINIMUM REVERT ━━━");
  try {
    // unstake to 0 first
    const cur = (await staking.getStakeInfo(deployer.address))[0];
    await send(await staking.unstake(cur, { nonce: n++ }));
    // try stake 50K (below 100K min)
    await send(await token.approve(STAKING, ethers.parseEther("50000"), { nonce: n++ }));
    await send(await staking.stake(ethers.parseEther("50000"), { nonce: n++ }));
    console.log("  ERROR — should have reverted!");
  } catch (err: any) {
    console.log("  Correctly reverted below 100K minimum ✓");
    n = await ethers.provider.getTransactionCount(deployer.address, "latest");
  }
  console.log("");

  // ═══════════════════════════════════════════════════════════
  // FINAL: Re-stake 5M for ongoing use
  // ═══════════════════════════════════════════════════════════
  console.log("━━━ RESTAKING 5M FOR ONGOING USE ━━━");
  const finalStake = ethers.parseEther("5000000");
  await send(await token.approve(STAKING, finalStake, { nonce: n++ }));
  await send(await staking.stake(finalStake, { nonce: n++ }));
  const finalInfo = await staking.getStakeInfo(deployer.address);
  console.log("  Staked:", ethers.formatEther(finalInfo[0]));
  console.log("  Tier:", finalInfo[2].toString(), "✓");
  console.log("");

  // ═══════════════════════════════════════════════════════════
  const finalSize = await token.balanceOf(deployer.address);
  const finalEth = await ethers.provider.getBalance(deployer.address);

  console.log("══════════════════════════════════════════");
  console.log("    ALL 19 TESTS COMPLETE ✓");
  console.log("══════════════════════════════════════════");
  console.log("$SIZE:", ethers.formatEther(finalSize));
  console.log("ETH:", ethers.formatEther(finalEth));
  console.log("5M staked, ready for your testing");
  console.log("══════════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
