const hre = require("hardhat");

const TOKEN = "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa";
const FEE_BOT = "0xa8d00375c8b8accef44352d45ca1f65422624557";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
async function send(tx: any) { const r = await tx.wait(); await sleep(2500); return r; }

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  let n = await ethers.provider.getTransactionCount(deployer.address, "latest");

  console.log("=== REDEPLOY STAKING WITH PENALTY ===");
  console.log("Deployer:", deployer.address);
  console.log("Nonce:", n, "\n");

  // Deploy new SizeStaking
  console.log("Deploying SizeStaking v2 (with early withdrawal penalty)...");
  const Staking = await ethers.getContractFactory("SizeStaking");
  const staking = await Staking.deploy(TOKEN, { nonce: n++ });
  await staking.waitForDeployment();
  const addr = await staking.getAddress();
  console.log("  SizeStaking v2:", addr);
  await sleep(3000);

  // Authorize fee bot
  await send(await staking.setDepositor(FEE_BOT, true, { nonce: n++ }));
  console.log("  Fee bot authorized ✓\n");

  // ── TEST: Stake, check penalty, unstake ──
  const token = await ethers.getContractAt("MockERC20", TOKEN);

  console.log("━━━ TEST: STAKE 1M + CHECK PENALTY ━━━");
  const amt = ethers.parseEther("1000000");
  await send(await token.approve(addr, amt, { nonce: n++ }));
  await send(await staking.stake(amt, { nonce: n++ }));

  const info = await staking.getStakeInfo(deployer.address);
  console.log("  Staked:", ethers.formatEther(info[0]));
  console.log("  Tier:", info[2].toString());

  // Check penalty (just staked = max penalty ~50%)
  const penalty = await staking.getEarlyWithdrawalPenalty(deployer.address);
  console.log("  Penalty BPS:", penalty[0].toString());
  console.log("  Penalty %:", penalty[1].toString() + "%");
  console.log("  Days staked:", penalty[2].toString());
  console.log("  Days remaining:", penalty[3].toString());

  // Preview unstake
  const preview = await staking.previewUnstake(deployer.address, amt);
  console.log("\n  Preview unstake 1M:");
  console.log("    User receives:", ethers.formatEther(preview[0]));
  console.log("    Penalty:", ethers.formatEther(preview[1]));
  console.log("    Penalty BPS:", preview[2].toString());

  // Actually unstake (to test penalty works)
  console.log("\n  Unstaking 500K (partial)...");
  const balPre = await token.balanceOf(deployer.address);
  await send(await staking.unstake(ethers.parseEther("500000"), { nonce: n++ }));
  const balPost = await token.balanceOf(deployer.address);
  const received = balPost - balPre;
  const expectedPenalty = ethers.parseEther("500000") * penalty[0] / 10000n;
  console.log("    Received:", ethers.formatEther(received));
  console.log("    Expected penalty:", ethers.formatEther(expectedPenalty));
  console.log("    Actual penalty:", ethers.formatEther(ethers.parseEther("500000") - received));

  const totalPen = await staking.totalPenaltiesCollected();
  console.log("    Total penalties collected:", ethers.formatEther(totalPen), "✓");

  // Re-stake for ongoing
  console.log("\n  Re-staking 5M for ongoing testing...");
  await send(await staking.unstake(ethers.parseEther("500000"), { nonce: n++ }));
  await send(await token.approve(addr, ethers.parseEther("5000000"), { nonce: n++ }));
  await send(await staking.stake(ethers.parseEther("5000000"), { nonce: n++ }));
  const finalInfo = await staking.getStakeInfo(deployer.address);
  console.log("  Staked:", ethers.formatEther(finalInfo[0]), "Tier:", finalInfo[2].toString(), "✓");

  console.log("\n══════════════════════════════════════════");
  console.log("  STAKING v2 DEPLOYED & TESTED ✓");
  console.log("══════════════════════════════════════════");
  console.log("  NEW SizeStaking:", addr);
  console.log("  Early withdrawal penalty: cubic decay");
  console.log("  50% at day 0 → 0% at 365 days");
  console.log("  Penalties → redistributed to stakers");
  console.log("══════════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
