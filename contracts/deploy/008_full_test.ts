const hre = require("hardhat");

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address, "\n");

  const token = await ethers.getContractAt("MockERC20", "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa");
  const staking = await ethers.getContractAt("SizeStaking", "0x02cd0832069d6F429f19d70436F4039fAd760109");
  const rewards = await ethers.getContractAt("SizeRewards", "0x59B989EB83BAe00c8d6ee613b7fCeBa88ae176C0");
  const gifting = await ethers.getContractAt("SizeGifting", "0x48539b265cd281D1f4c30edFd22d939DD236A9BF");

  // Big approval for all contracts
  console.log("Approving all contracts...");
  const BIG = ethers.parseEther("50000000000"); // 50B
  await (await token.approve(staking.target, BIG, { gasLimit: 100000 })).wait();
  await (await token.approve(rewards.target, BIG, { gasLimit: 100000 })).wait();
  await (await token.approve(gifting.target, BIG, { gasLimit: 100000 })).wait();
  
  const a1 = await token.allowance(deployer.address, staking.target);
  const a2 = await token.allowance(deployer.address, rewards.target);
  const a3 = await token.allowance(deployer.address, gifting.target);
  console.log("  Staking allowance:", ethers.formatEther(a1));
  console.log("  Rewards allowance:", ethers.formatEther(a2));
  console.log("  Gifting allowance:", ethers.formatEther(a3));

  // STAKING
  console.log("\n=== STAKING ===");
  let tx;
  tx = await staking.stake(ethers.parseEther("200000"), { gasLimit: 500000 });
  await tx.wait();
  let info = await staking.getStakeInfo(deployer.address);
  console.log("  Staked:", ethers.formatEther(info.stakedAmount), "Tier:", info.tier.toString());

  tx = await staking.depositRewards(ethers.parseEther("5000"), { gasLimit: 300000 });
  await tx.wait();
  info = await staking.getStakeInfo(deployer.address);
  console.log("  Pending rewards:", ethers.formatEther(info.pendingRewards));

  tx = await staking.claimRewards({ gasLimit: 200000 });
  await tx.wait();
  console.log("  Claimed rewards");

  tx = await staking.unstake(ethers.parseEther("200000"), { gasLimit: 300000 });
  await tx.wait();
  info = await staking.getStakeInfo(deployer.address);
  console.log("  After unstake:", ethers.formatEther(info.stakedAmount));

  // REWARDS
  console.log("\n=== REWARDS ===");
  tx = await rewards.depositRewards(ethers.parseEther("10000"), { gasLimit: 300000 });
  await tx.wait();
  const pool = await rewards.pendingRewardPool();
  console.log("  Pool:", ethers.formatEther(pool));

  tx = await rewards.setUserWeights([deployer.address], [500n], { gasLimit: 200000 });
  await tx.wait();
  tx = await rewards.finalizeEpoch(500n, { gasLimit: 200000 });
  await tx.wait();
  const epoch = await rewards.currentEpoch();
  console.log("  Epoch:", epoch.toString());

  const claimable = await rewards.getClaimable(deployer.address, epoch - 1n);
  console.log("  Claimable:", ethers.formatEther(claimable));

  tx = await rewards.claimRewards(epoch - 1n, { gasLimit: 200000 });
  await tx.wait();
  console.log("  Claimed epoch rewards");

  // GIFTING
  console.log("\n=== GIFTING ===");
  const recipientBefore = await token.balanceOf("0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0");
  tx = await gifting.gift(
    "0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0",
    ethers.parseEther("500"),
    ethers.zeroPadBytes("0x", 32),
    "hello from test",
    { gasLimit: 200000 }
  );
  await tx.wait();
  const recipientAfter = await token.balanceOf("0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0");
  console.log("  Gifted 500 tokens");
  console.log("  Recipient balance:", ethers.formatEther(recipientAfter));

  console.log("\n========================================");
  console.log("ALL TESTS PASSED");
  console.log("========================================");
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("ETH remaining:", ethers.formatEther(bal));
}

main().catch(e => { console.error("FAILED:", e.message?.slice(0, 200)); process.exit(1); });
