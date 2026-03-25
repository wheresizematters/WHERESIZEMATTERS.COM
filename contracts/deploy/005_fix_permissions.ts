const hre = require("hardhat");

async function main() {
  const ethers = hre.ethers;
  const [deployer] = await ethers.getSigners();
  console.log("Fixing permissions from:", deployer.address);

  const rewards = await ethers.getContractAt("SizeRewards", "0x59B989EB83BAe00c8d6ee613b7fCeBa88ae176C0");
  
  console.log("Setting fee collector as distributor...");
  const tx1 = await rewards.setDistributor("0xa8d00375c8b8accef44352d45ca1f65422624557", true, { gasLimit: 100000 });
  await tx1.wait();
  console.log("  Done:", tx1.hash);

  console.log("Setting rewards bot as distributor...");
  const tx2 = await rewards.setDistributor("0x2466b3f0e3891db3380b335b7d0a132dea0360d9", true, { gasLimit: 100000 });
  await tx2.wait();
  console.log("  Done:", tx2.hash);

  console.log("\nAll permissions set!");
}

main().catch(console.error);
