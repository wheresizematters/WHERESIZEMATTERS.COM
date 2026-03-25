const hre = require("hardhat");

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();

  const token = await ethers.getContractAt("MockERC20", "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa");
  const staking = await ethers.getContractAt("SizeStaking", "0x02cd0832069d6F429f19d70436F4039fAd760109");

  // Check owner
  const owner = await staking.owner();
  console.log("Staking owner:", owner);
  console.log("Deployer:", deployer.address);
  console.log("Match:", owner.toLowerCase() === deployer.address.toLowerCase());

  // Check token address
  const sizeToken = await staking.sizeToken();
  console.log("\nStaking token:", sizeToken);
  console.log("TEST token:", "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa");
  console.log("Match:", sizeToken.toLowerCase() === "0x3Cb7fEb17BD78f6f1A3ec6C914A35C5664c9faEa".toLowerCase());

  // Check allowance
  const allowance = await token.allowance(deployer.address, "0x02cd0832069d6F429f19d70436F4039fAd760109");
  console.log("\nAllowance for staking:", ethers.formatEther(allowance));

  // Check balance
  const bal = await token.balanceOf(deployer.address);
  console.log("Deployer token balance:", ethers.formatEther(bal));

  // Try a simple transfer to see if token works
  console.log("\nTesting token transfer...");
  try {
    const tx = await token.transfer("0x117c1e5d49e545021c21a0e3ade73dc42fd8ccf0", ethers.parseEther("100"));
    await tx.wait();
    console.log("  Token transfer works!");
  } catch(e) {
    console.log("  Token transfer failed:", e.message?.slice(0, 100));
  }

  // Try approve again with explicit gas
  console.log("\nApproving staking with explicit gas...");
  try {
    const tx = await token.approve("0x02cd0832069d6F429f19d70436F4039fAd760109", ethers.MaxUint256, { gasLimit: 100000 });
    await tx.wait();
    console.log("  Approved!");
    const newAllowance = await token.allowance(deployer.address, "0x02cd0832069d6F429f19d70436F4039fAd760109");
    console.log("  New allowance:", ethers.formatEther(newAllowance));
  } catch(e) {
    console.log("  Approve failed:", e.message?.slice(0, 100));
  }

  // Try stake with explicit gas
  console.log("\nStaking 200K with explicit gas...");
  try {
    const tx = await staking.stake(ethers.parseEther("200000"), { gasLimit: 300000 });
    await tx.wait();
    console.log("  Staked!");
    const info = await staking.getStakeInfo(deployer.address);
    console.log("  Staked amount:", ethers.formatEther(info.stakedAmount));
    console.log("  Tier:", info.tier.toString());
  } catch(e) {
    console.log("  Stake failed:", e.message?.slice(0, 150));
  }
}

main().catch(console.error);
