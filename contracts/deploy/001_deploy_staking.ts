import { ethers } from "hardhat";

async function main() {
  const SIZE_TOKEN_ADDRESS = process.env.SIZE_TOKEN_ADDRESS;
  if (!SIZE_TOKEN_ADDRESS) {
    throw new Error("SIZE_TOKEN_ADDRESS env var required");
  }

  console.log("Deploying SizeStaking...");
  console.log("  $SIZE token:", SIZE_TOKEN_ADDRESS);

  const [deployer] = await ethers.getSigners();
  console.log("  Deployer:", deployer.address);
  console.log("  Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const SizeStaking = await ethers.getContractFactory("SizeStaking");
  const staking = await SizeStaking.deploy(SIZE_TOKEN_ADDRESS);
  await staking.waitForDeployment();

  const address = await staking.getAddress();
  console.log("\n  SizeStaking deployed to:", address);
  console.log("\n  Verify with:");
  console.log(`  npx hardhat verify --network base ${address} ${SIZE_TOKEN_ADDRESS}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
