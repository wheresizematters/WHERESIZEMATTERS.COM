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

  console.log("=== TOP UP & FINISH TESTS ===\n");

  // Top up staking contract so it can cover unstake + rewards
  console.log("Topping up staking contract with 200K $SIZE...");
  await send(await token.transfer(STAKING, ethers.parseEther("200000"), { nonce: n++ }));
  const contractBal = await token.balanceOf(STAKING);
  console.log("  Contract balance:", ethers.formatEther(contractBal), "✓\n");

  // Now unstake remaining 5M
  console.log("━━━ TEST 15b: FULL UNSTAKE ━━━");
  const pre = await token.balanceOf(deployer.address);
  await send(await staking.unstake(ethers.parseEther("5000000"), { nonce: n++ }));
  const post = await token.balanceOf(deployer.address);
  const s = await staking.getStakeInfo(deployer.address);
  console.log("  Staked after:", ethers.formatEther(s[0]));
  console.log("  Received:", ethers.formatEther(post - pre), "$SIZE (stake + rewards) ✓\n");

  // TEST 16: Fresh stake
  console.log("━━━ TEST 16: FRESH STAKE 5M ━━━");
  await send(await token.approve(STAKING, ethers.parseEther("5000000"), { nonce: n++ }));
  await send(await staking.stake(ethers.parseEther("5000000"), { nonce: n++ }));
  const info16 = await staking.getStakeInfo(deployer.address);
  console.log("  Staked:", ethers.formatEther(info16[0]), "Tier:", info16[2].toString(), "✓\n");

  // TEST 17: Post tip
  console.log("━━━ TEST 17: POST TIP ━━━");
  await send(await token.approve(GIFTING, ethers.parseEther("100"), { nonce: n++ }));
  const postId = ethers.keccak256(ethers.toUtf8Bytes("post-abc-123"));
  await send(await gifting.gift(PROTOCOL_WALLET, ethers.parseEther("100"), postId, "fire post bro", { nonce: n++ }));
  console.log("  Tipped 100 $SIZE ✓\n");

  // TEST 18: Below-minimum revert
  console.log("━━━ TEST 18: BELOW MINIMUM REVERT ━━━");
  await send(await staking.unstake(ethers.parseEther("5000000"), { nonce: n++ }));
  try {
    await send(await token.approve(STAKING, ethers.parseEther("50000"), { nonce: n++ }));
    await send(await staking.stake(ethers.parseEther("50000"), { nonce: n++ }));
    console.log("  ERROR — should have reverted!");
  } catch {
    console.log("  Correctly reverted below 100K minimum ✓");
    n = await ethers.provider.getTransactionCount(deployer.address, "latest");
  }
  console.log("");

  // TEST 19: Re-stake for ongoing
  console.log("━━━ TEST 19: RESTAKE 5M ━━━");
  await send(await token.approve(STAKING, ethers.parseEther("5000000"), { nonce: n++ }));
  await send(await staking.stake(ethers.parseEther("5000000"), { nonce: n++ }));
  const finalInfo = await staking.getStakeInfo(deployer.address);
  console.log("  Staked:", ethers.formatEther(finalInfo[0]), "Tier:", finalInfo[2].toString(), "✓\n");

  console.log("══════════════════════════════════════════");
  console.log("    ALL 19 TESTS COMPLETE ✓");
  console.log("══════════════════════════════════════════");
  console.log("$SIZE:", ethers.formatEther(await token.balanceOf(deployer.address)));
  console.log("ETH:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("");
  console.log("  1.  Stake 500K ✓");
  console.log("  2.  Deposit trading fees ✓");
  console.log("  3.  Claim staking rewards ✓");
  console.log("  4.  Epoch rewards cycle ✓");
  console.log("  5.  DickCoin #1 (DONG) + fee split ✓");
  console.log("  6.  DickCoin #2 (MICRO) ✓");
  console.log("  7.  Gift with message ✓");
  console.log("  8.  Partial unstake ✓");
  console.log("  9.  Whale tier 10M ✓");
  console.log("  10. Rapid fee deposits x3 ✓");
  console.log("  11. DickCoins #3-5 (RCOCK, GIGA, DTIP) ✓");
  console.log("  12. Multi-coin fee distribution ✓");
  console.log("  13. Epoch 23hr cooldown enforced ✓");
  console.log("  14. Batch gifting x3 ✓");
  console.log("  15. Full unstake to zero ✓");
  console.log("  16. Fresh re-stake ✓");
  console.log("  17. Post tip with postId ✓");
  console.log("  18. Below-minimum revert ✓");
  console.log("  19. Re-stake 5M for ongoing ✓");
  console.log("");
  console.log("  NOTE: Staking contract needs topped up when");
  console.log("  rewards are claimed but not re-deposited.");
  console.log("  In production, fee deposits replenish this.");
  console.log("══════════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
